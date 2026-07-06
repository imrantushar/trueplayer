<?php

namespace TruePlayer\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads the raw tables (tp_progress, tp_engagement, tp_daily, tp_quiz_attempts)
 * and computes the per-video analytics payload the dashboard renders:
 * summary, retention curve, replay heatmap, funnel, daily trend, quiz stats,
 * device split, new-vs-returning + derived callouts.
 */
class AnalyticsService {

	public static function for_video( $video_id ) {
		global $wpdb;
		$video_id = (int) $video_id;
		$P        = ProgressService::table();
		$E        = ProgressService::engagement_table();
		$D        = ProgressService::daily_table();
		$Q        = GradingService::attempts_table();

		/* ---- summary ---- */
		$sum = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT COUNT(*) viewers, COALESCE(SUM(sessions),0) views,
					COALESCE(SUM(completions),0) completions,
					COALESCE(SUM(completed),0) completed_viewers,
					COALESCE(AVG(percent),0) avg_coverage,
					COALESCE(AVG(watched_seconds),0) avg_watch,
					COALESCE(SUM(CASE WHEN status='locked' THEN 1 ELSE 0 END),0) locked
				 FROM {$P} WHERE video_id=%d",
				$video_id
			),
			ARRAY_A
		);
		$viewers = (int) ( $sum['viewers'] ?? 0 );

		/* ---- engagement → retention + replay (100 buckets) ---- */
		$eng       = $wpdb->get_results( $wpdb->prepare( "SELECT bucket, plays, reached FROM {$E} WHERE video_id=%d", $video_id ), ARRAY_A );
		$retention = array_fill( 0, 100, 0 );
		$replay    = array_fill( 0, 100, 0 );
		$starters  = 0;
		foreach ( $eng as $e ) {
			$b = (int) $e['bucket'];
			if ( $b < 0 || $b > 99 ) {
				continue;
			}
			$replay[ $b ] = (int) $e['plays'];
			$starters     = max( $starters, (int) $e['reached'] ); // bucket 0 ≈ everyone who started
			$retention[ $b ] = (int) $e['reached'];
		}
		$denom = max( 1, $starters ?: $viewers );
		$retention_pct = array_map( function ( $r ) use ( $denom ) {
			return round( min( 100, $r / $denom * 100 ), 1 );
		}, $retention );

		/* ---- funnel (reached at 0/25/50/75/99) ---- */
		$funnel = [];
		foreach ( [ 0, 25, 50, 75, 99 ] as $b ) {
			$funnel[] = [
				'label'   => ( 99 === $b ? 100 : $b ) . '%',
				'viewers' => $retention[ $b ],
				'pct'     => round( min( 100, $retention[ $b ] / $denom * 100 ), 1 ),
			];
		}

		/* ---- daily trend (last 30 days) ---- */
		$daily = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT day, views, completions, watch_seconds FROM {$D}
				 WHERE video_id=%d AND day >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ORDER BY day ASC",
				$video_id
			),
			ARRAY_A
		);

		/* ---- quiz performance per gate ---- */
		$quiz_rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT gate_id, COUNT(*) attempts, SUM(passed) passes, AVG(score) avg_score, AVG(attempt_no) avg_try
				 FROM {$Q} WHERE video_id=%d GROUP BY gate_id",
				$video_id
			),
			ARRAY_A
		);
		$quiz = array_map( function ( $q ) {
			$attempts = (int) $q['attempts'];
			return [
				'gate'      => $q['gate_id'],
				'attempts'  => $attempts,
				'passes'    => (int) $q['passes'],
				'passRate'  => $attempts ? round( $q['passes'] / $attempts * 100, 1 ) : 0,
				'avgScore'  => round( (float) $q['avg_score'], 1 ),
				'avgTries'  => round( (float) $q['avg_try'], 2 ),
			];
		}, $quiz_rows );

		/* ---- device + new vs returning ---- */
		$devices = $wpdb->get_results( $wpdb->prepare( "SELECT COALESCE(device,'unknown') device, COUNT(*) n FROM {$P} WHERE video_id=%d GROUP BY device", $video_id ), ARRAY_A );
		$nvr     = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT SUM(CASE WHEN sessions<=1 THEN 1 ELSE 0 END) new_v, SUM(CASE WHEN sessions>1 THEN 1 ELSE 0 END) ret_v FROM {$P} WHERE video_id=%d",
				$video_id
			),
			ARRAY_A
		);

		/* ---- derived callouts ---- */
		$most_replayed = null;
		$max_plays     = 0;
		foreach ( $replay as $b => $p ) {
			if ( $p > $max_plays ) {
				$max_plays = $p;
				$most_replayed = $b;
			}
		}
		$biggest_drop = null;
		$max_drop     = 0;
		for ( $b = 1; $b < 100; $b++ ) {
			$drop = $retention[ $b - 1 ] - $retention[ $b ];
			if ( $drop > $max_drop ) {
				$max_drop = $drop;
				$biggest_drop = $b;
			}
		}
		$completion_rate = $viewers ? round( (int) $sum['completed_viewers'] / $viewers * 100, 1 ) : 0;
		$engagement_score = (int) round(
			( (float) $sum['avg_coverage'] * 0.5 ) + ( $completion_rate * 0.5 )
		);

		return [
			'summary' => [
				'viewers'        => $viewers,
				'views'          => (int) $sum['views'],
				'completions'    => (int) $sum['completions'],
				'completionRate' => $completion_rate,
				'avgCoverage'    => round( (float) $sum['avg_coverage'], 1 ),
				'avgWatchTime'   => (int) round( (float) $sum['avg_watch'] ),
				'locked'         => (int) $sum['locked'],
				'engagementScore' => $engagement_score,
			],
			'retention'   => $retention_pct,
			'replay'      => $replay,
			'funnel'      => $funnel,
			'daily'       => $daily,
			'quiz'        => $quiz,
			'devices'     => $devices,
			'newVsReturning' => [ 'new' => (int) ( $nvr['new_v'] ?? 0 ), 'returning' => (int) ( $nvr['ret_v'] ?? 0 ) ],
			'callouts'    => [
				'mostReplayedBucket' => $most_replayed,
				'biggestDropBucket'  => $biggest_drop,
			],
		];
	}

	/** Per-viewer drill-down: their replay heat + quiz attempts. */
	public static function viewer_detail( $row_id ) {
		global $wpdb;
		$P   = ProgressService::table();
		$Q   = GradingService::attempts_table();
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$P} WHERE id=%d", (int) $row_id ), ARRAY_A );
		if ( ! $row ) {
			return null;
		}
		$heat_map = json_decode( $row['heat'] ?? '[]', true );
		$heat     = array_fill( 0, 100, 0 );
		if ( is_array( $heat_map ) ) {
			foreach ( $heat_map as $b => $c ) {
				if ( (int) $b >= 0 && (int) $b < 100 ) {
					$heat[ (int) $b ] = (int) $c;
				}
			}
		}
		$attempts = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT gate_id, score, passed, attempt_no, created_at FROM {$Q}
				 WHERE video_id=%d AND subject_type=%s AND subject_id=%s ORDER BY created_at ASC",
				(int) $row['video_id'],
				$row['subject_type'],
				$row['subject_id']
			),
			ARRAY_A
		);
		return [
			'percent'     => (float) $row['percent'],
			'sessions'    => (int) $row['sessions'],
			'completions' => (int) $row['completions'],
			'status'      => $row['status'],
			'heat'        => $heat,
			'attempts'    => $attempts,
		];
	}
}
