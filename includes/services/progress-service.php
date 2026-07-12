<?php

namespace TruePlayer\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\Subject;
use TruePlayer\Helper;
use TruePlayer\Events;

/**
 * Server-side source of truth for "did this viewer actually watch it".
 *
 * Coverage is stored as a set of non-overlapping [start,end] whole-second
 * ranges. The client sends deltas; the server merges, clamps to the video
 * duration, applies an anti-cheat allowance (you can't gain more coverage than
 * wall-clock time * a small factor), and recomputes watched_seconds/percent.
 */
class ProgressService {

	/** Max coverage seconds acceptable per second of real elapsed time. */
	const MAX_RATE = 3;
	/** Absolute slack added to the per-heartbeat allowance. */
	const SLACK = 3;

	public static function table() {
		global $wpdb;
		return $wpdb->prefix . TRUEPLAYER_DB_PREFIX . '_progress';
	}

	public static function engagement_table() {
		global $wpdb;
		return $wpdb->prefix . TRUEPLAYER_DB_PREFIX . '_engagement';
	}

	public static function daily_table() {
		global $wpdb;
		return $wpdb->prefix . TRUEPLAYER_DB_PREFIX . '_daily';
	}

	/** Distinct 0..99 buckets covered by a set of [start,end] ranges. */
	public static function buckets_from_ranges( array $ranges, $duration ) {
		$duration = (int) $duration;
		if ( $duration <= 0 ) {
			return [];
		}
		$buckets = [];
		foreach ( self::merge_ranges( $ranges ) as $r ) {
			for ( $s = (int) $r[0]; $s < (int) $r[1]; $s++ ) {
				$buckets[ min( 99, (int) floor( $s / $duration * 100 ) ) ] = true;
			}
		}
		return array_keys( $buckets );
	}

	/** Atomic per-bucket increments for retention (reached) + replay (plays). */
	public static function bump_engagement( $video_id, array $new_buckets, array $play_tally ) {
		global $wpdb;
		$table   = self::engagement_table();
		$buckets = array_unique( array_merge( $new_buckets, array_keys( $play_tally ) ) );
		foreach ( $buckets as $b ) {
			$b       = (int) $b;
			$plays   = (int) ( $play_tally[ $b ] ?? 0 );
			$reached = in_array( $b, $new_buckets, false ) ? 1 : 0;
			// INSERT ... ON DUPLICATE KEY UPDATE — atomic accumulation.
			$wpdb->query(
				$wpdb->prepare(
					"INSERT INTO {$table} (video_id, bucket, plays, reached) VALUES (%d, %d, %d, %d)
					 ON DUPLICATE KEY UPDATE plays = plays + %d, reached = reached + %d",
					$video_id,
					$b,
					$plays,
					$reached,
					$plays,
					$reached
				)
			);
		}
	}

	public static function bump_daily( $video_id, $day, $views, $completions, $watch_seconds ) {
		global $wpdb;
		$table = self::daily_table();
		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (video_id, day, views, completions, watch_seconds) VALUES (%d, %s, %d, %d, %d)
				 ON DUPLICATE KEY UPDATE views = views + %d, completions = completions + %d, watch_seconds = watch_seconds + %d",
				$video_id,
				$day,
				$views,
				$completions,
				$watch_seconds,
				$views,
				$completions,
				$watch_seconds
			)
		);
	}

	/** Coarse device class from the user-agent for the device split chart. */
	public static function detect_device() {
		$ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';
		if ( preg_match( '/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i', $ua ) ) {
			return 'tablet';
		}
		if ( preg_match( '/Mobile|iPhone|Android.*Mobile|Windows Phone|iPod/i', $ua ) ) {
			return 'mobile';
		}
		return 'desktop';
	}

	public static function get_row( $video_id, Subject $subject ) {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table() . ' WHERE video_id = %d AND subject_type = %s AND subject_id = %s',
				$video_id,
				$subject->type,
				$subject->id
			),
			ARRAY_A
		);
		return $row ?: null;
	}

	/**
	 * Read-only state used by the gate endpoint.
	 */
	public static function state( $video_id, Subject $subject ) {
		$row     = self::get_row( $video_id, $subject );
		$gating  = self::gating_config( $video_id );
		$percent = $row ? (float) $row['percent'] : 0.0;
		$viewed  = $percent >= (float) $gating['completionThreshold'];

		$status   = $row['status'] ?? 'in_progress';
		$locked   = 'locked' === $status;
		$attempts = (int) ( $row['attempts'] ?? 0 );

		return [
			'status'        => $status,
			'locked'        => $locked,
			'canPlay'       => true, // Locked videos remain watchable for re-watch.
			'completed'     => (bool) ( $row['completed'] ?? false ),
			'viewed'        => $viewed,
			'percent'       => $percent,
			'resumeAt'      => (int) ( $row['last_position'] ?? 0 ),
			'attemptsLeft'  => max( 0, (int) $gating['maxAttempts'] - $attempts ),
			'requireRewatch' => $locked, // must reach threshold again to earn a retry
			'threshold'     => (float) $gating['completionThreshold'],
		];
	}

	/**
	 * Record a heartbeat delta. Returns the fresh state.
	 */
	public static function record( $video_id, Subject $subject, array $ranges, $duration, $media_time, $real_elapsed, array $plays = [], $session_start = false ) {
		global $wpdb;

		// Watch-verification + tracking is a pro feature — never write without it.
		if ( ! \TruePlayer\Pro::active() ) {
			return self::state( $video_id, $subject );
		}

		// Guest tracking can be disabled site-wide (privacy) — then guests play
		// freely but nothing is stored for them.
		$enf = Helper::get_settings_section( 'enforcement' );
		if ( 'guest' === $subject->type && array_key_exists( 'trackGuests', $enf ) && ! $enf['trackGuests'] ) {
			return self::state( $video_id, $subject );
		}

		$duration   = max( 0, (int) $duration );
		$media_time = max( 0, (int) $media_time );
		$row        = self::get_row( $video_id, $subject );
		$gating     = self::gating_config( $video_id );

		$existing = $row && $row['watched_ranges'] ? json_decode( $row['watched_ranges'], true ) : [];
		if ( ! is_array( $existing ) ) {
			$existing = [];
		}

		$before_seconds = self::coverage_seconds( $existing );

		// Clamp incoming ranges to [0, duration] and normalize.
		$incoming = self::clamp_ranges( $ranges, $duration );

		// Anti-cheat: cap the NEW coverage this call can add. Normal playback
		// adds ~real_elapsed seconds; a skip-to-build-fake-coverage adds a lot
		// at once and gets trimmed.
		$merged      = self::merge_ranges( array_merge( $existing, $incoming ) );
		$added       = self::coverage_seconds( $merged ) - $before_seconds;
		$allowance   = ( $real_elapsed > 0 ) ? ( (int) $real_elapsed * self::MAX_RATE + self::SLACK ) : PHP_INT_MAX;
		if ( $added > $allowance ) {
			// Re-accept incoming ranges greedily up to the allowance.
			$incoming = self::trim_to_allowance( $existing, $incoming, $before_seconds, $allowance );
			$merged   = self::merge_ranges( array_merge( $existing, $incoming ) );
		}

		$watched_seconds = self::coverage_seconds( $merged );
		$percent         = $duration > 0 ? min( 100, round( $watched_seconds / $duration * 100, 2 ) ) : 0;
		$threshold       = (float) $gating['completionThreshold'];
		$viewed          = $percent >= $threshold;

		$prev_status   = $row['status'] ?? 'in_progress';
		$prev_percent  = $row ? (float) $row['percent'] : 0.0;
		$prev_viewed   = $prev_percent >= $threshold;
		$has_final     = ! empty( $gating['finalQuiz']['questions'] );
		$new_status    = $prev_status;
		$new_completed = (bool) ( $row['completed'] ?? false );
		$attempts      = (int) ( $row['attempts'] ?? 0 );

		// Retry-after-rewatch: a locked viewer who re-reaches the threshold
		// earns a fresh attempt (attempts reset, unlocked).
		$unlocked = false;
		if ( 'locked' === $prev_status && $viewed ) {
			$new_status = 'in_progress';
			$attempts   = 0;
			$unlocked   = true;
		}

		// Watch-verification completion: when there is no final quiz, reaching
		// the threshold completes the video outright.
		if ( 'locked' !== $new_status && $viewed && ! $has_final ) {
			$new_status    = 'completed';
			$new_completed = true;
		}

		/* ---------- analytics: engagement / heat / daily / sessions ---------- */

		$prev_completed = (bool) ( $row['completed'] ?? false );
		$now_mysql      = current_time( 'mysql', true );
		$today          = current_time( 'Y-m-d' );

		// Newly-covered buckets (retention): buckets covered after this merge
		// that weren't covered before → each is a distinct viewer first-reach.
		$before_buckets = self::buckets_from_ranges( $existing, $duration );
		$after_buckets  = self::buckets_from_ranges( $merged, $duration );
		$new_buckets    = array_diff( $after_buckets, $before_buckets );

		// Sanitize the incoming play tally (bucket => count).
		$play_tally = [];
		foreach ( $plays as $b => $c ) {
			$b = (int) $b;
			$c = (int) $c;
			if ( $b >= 0 && $b < 100 && $c > 0 ) {
				$play_tally[ $b ] = min( $c, 3600 ); // clamp absurd values
			}
		}
		$played_seconds = array_sum( $play_tally );

		// Per-viewer heat (replay counts per bucket) merged into the JSON blob.
		$heat = ( $row && ! empty( $row['heat'] ) ) ? json_decode( $row['heat'], true ) : [];
		if ( ! is_array( $heat ) ) {
			$heat = [];
		}
		foreach ( $play_tally as $b => $c ) {
			$heat[ $b ] = ( $heat[ $b ] ?? 0 ) + $c;
		}

		$sessions    = (int) ( $row['sessions'] ?? 0 ) + ( $session_start ? 1 : 0 );
		$completions = (int) ( $row['completions'] ?? 0 ) + ( ( $new_completed && ! $prev_completed ) ? 1 : 0 );

		self::upsert(
			$video_id,
			$subject,
			[
				'watched_ranges'  => wp_json_encode( $merged ),
				'watched_seconds' => $watched_seconds,
				'duration'        => $duration,
				'percent'         => $percent,
				'completed'       => $new_completed ? 1 : 0,
				'last_position'   => $media_time,
				'status'          => $new_status,
				'attempts'        => $attempts,
				'sessions'        => $sessions,
				'completions'     => $completions,
				'heat'            => wp_json_encode( $heat ),
				'device'          => self::detect_device(),
				'first_seen'      => $row['first_seen'] ?? $now_mysql,
				'last_seen'       => $now_mysql,
			]
		);

		// Aggregate engagement: reached (retention) + plays (replay heatmap).
		self::bump_engagement( $video_id, $new_buckets, $play_tally );

		// Daily rollup: views (session starts), completions, watch seconds.
		self::bump_daily(
			$video_id,
			$today,
			$session_start ? 1 : 0,
			( $new_completed && ! $prev_completed ) ? 1 : 0,
			$played_seconds
		);

		// Events.
		self::maybe_emit_milestones( $video_id, $subject, $prev_percent, $percent );
		if ( $viewed && ! $prev_viewed ) {
			Events::emit( 'view.completed', self::event_payload( $video_id, $subject, [ 'coverage_percent' => $percent ] ) );
		}
		if ( $unlocked ) {
			Events::emit( 'video.unlocked', self::event_payload( $video_id, $subject, [ 'coverage_percent' => $percent ] ) );
		}

		return self::state( $video_id, $subject );
	}

	public static function upsert( $video_id, Subject $subject, array $fields ) {
		global $wpdb;
		$row = self::get_row( $video_id, $subject );
		$now = current_time( 'mysql', true );

		if ( $row ) {
			$fields['updated_at'] = $now;
			$wpdb->update( self::table(), $fields, [ 'id' => (int) $row['id'] ] );
			return (int) $row['id'];
		}

		$fields = array_merge(
			[
				'video_id'     => $video_id,
				'subject_type' => $subject->type,
				'subject_id'   => $subject->id,
				'created_at'   => $now,
				'updated_at'   => $now,
			],
			$fields
		);
		$wpdb->insert( self::table(), $fields );
		return (int) $wpdb->insert_id;
	}

	public static function gating_config( $video_id ) {
		$config = Helper::get_video_config( $video_id );
		$gating = isset( $config['gating'] ) && is_array( $config['gating'] ) ? $config['gating'] : [];

		// Site-wide enforcement policy provides the defaults; a video's own
		// gating config overrides any of them.
		$enf = Helper::get_settings_section( 'enforcement' );
		$gating = wp_parse_args(
			$gating,
			[
				'completionThreshold' => isset( $enf['completionThreshold'] ) ? (int) $enf['completionThreshold'] : 90,
				'antiSkip'            => array_key_exists( 'antiSkip', $enf ) ? (bool) $enf['antiSkip'] : true,
				'maxAttempts'         => isset( $enf['maxAttempts'] ) ? (int) $enf['maxAttempts'] : 3,
				'onFail'              => 'lock_retry_after_rewatch',
				'checkpoints'         => [],
				'finalQuiz'           => null,
				'requireLoginForGate' => array_key_exists( 'requireLogin', $enf ) ? (bool) $enf['requireLogin'] : false,
				'strict'              => array_key_exists( 'strict', $enf ) ? (bool) $enf['strict'] : false, // must-watch: 100% coverage, no skipping
				'availableFrom'       => '', // drip: ISO/date string; empty = always available
			]
		);

		// Must-watch-strict forces full coverage and anti-skip regardless of the
		// per-video values — a single switch for compliance-grade enforcement.
		if ( ! empty( $gating['strict'] ) ) {
			$gating['completionThreshold'] = 100;
			$gating['antiSkip']            = true;
		}
		return $gating;
	}

	/**
	 * Drip: the timestamp before which a video is not yet available, or 0 when
	 * it is always available. Filterable so LMS drip (days-after-enrollment) can
	 * compute a per-user release time.
	 */
	public static function available_from( $video_id, $subject = null ) {
		$gating = self::gating_config( $video_id );
		$ts     = ! empty( $gating['availableFrom'] ) ? (int) strtotime( (string) $gating['availableFrom'] ) : 0;
		return (int) apply_filters( 'trueplayer/drip/available_from', $ts, $video_id, $subject );
	}

	private static function maybe_emit_milestones( $video_id, Subject $subject, $prev, $now ) {
		foreach ( [ 25, 50, 75, 100 ] as $m ) {
			if ( $prev < $m && $now >= $m ) {
				Events::emit(
					'progress.milestone',
					self::event_payload( $video_id, $subject, [ 'milestone' => $m, 'coverage_percent' => $now ] )
				);
			}
		}
	}

	public static function event_payload( $video_id, Subject $subject, array $extra = [] ) {
		return array_merge(
			[
				'video_id'    => (int) $video_id,
				'video_title' => get_the_title( $video_id ),
				'subject'     => $subject->to_array(),
			],
			$extra
		);
	}

	/* ---------- range math ---------- */

	private static function clamp_ranges( array $ranges, $duration ) {
		$out = [];
		foreach ( $ranges as $r ) {
			if ( ! is_array( $r ) || count( $r ) < 2 ) {
				continue;
			}
			$s = max( 0, (int) $r[0] );
			$e = (int) $r[1];
			if ( $duration > 0 ) {
				$e = min( $e, $duration );
			}
			if ( $e > $s ) {
				$out[] = [ $s, $e ];
			}
		}
		return self::merge_ranges( $out );
	}

	public static function merge_ranges( array $ranges ) {
		if ( empty( $ranges ) ) {
			return [];
		}
		usort(
			$ranges,
			function ( $a, $b ) {
				return $a[0] <=> $b[0];
			}
		);
		$merged = [ $ranges[0] ];
		foreach ( array_slice( $ranges, 1 ) as $r ) {
			$last = &$merged[ count( $merged ) - 1 ];
			if ( $r[0] <= $last[1] ) {
				$last[1] = max( $last[1], $r[1] );
			} else {
				$merged[] = $r;
			}
			unset( $last );
		}
		return $merged;
	}

	public static function coverage_seconds( array $ranges ) {
		$total = 0;
		foreach ( self::merge_ranges( $ranges ) as $r ) {
			$total += ( $r[1] - $r[0] );
		}
		return $total;
	}

	/**
	 * Greedily accept incoming ranges (sorted) until we've added `allowance`
	 * seconds of NEW coverage over what `existing` already had.
	 */
	private static function trim_to_allowance( array $existing, array $incoming, $before_seconds, $allowance ) {
		usort(
			$incoming,
			function ( $a, $b ) {
				return $a[0] <=> $b[0];
			}
		);
		$accepted = [];
		foreach ( $incoming as $r ) {
			$test  = self::merge_ranges( array_merge( $existing, $accepted, [ $r ] ) );
			$added = self::coverage_seconds( $test ) - $before_seconds;
			if ( $added <= $allowance ) {
				$accepted[] = $r;
			}
		}
		return $accepted;
	}
}
