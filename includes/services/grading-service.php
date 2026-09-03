<?php

namespace TruePlayer\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\Subject;
use TruePlayer\Helper;
use TruePlayer\Events;

/**
 * Server-side quiz grading + lock enforcement. Correct answers live only here
 * and in the stored config — never sent to the client.
 *
 * Fail policy `lock_retry_after_rewatch`: each fail consumes an attempt; when
 * attempts run out the video locks and the coverage is reset so the viewer
 * must re-watch to the threshold (ProgressService unlocks + resets attempts).
 */
class GradingService {

	public static function attempts_table() {
		global $wpdb;
		return $wpdb->prefix . TRUEPLAYER_DB_PREFIX . '_quiz_attempts';
	}

	/**
	 * Grade a submission for a checkpoint (`gate_id` = "checkpoint:<id>") or the
	 * final quiz (`gate_id` = "final").
	 *
	 * @param array $answers              Map of questionId => submitted answer.
	 * @param int   $quizpress_attempt_id The just-finished QuizPress attempt to verify,
	 *                                    for a QuizPress-sourced quiz (ignored otherwise).
	 * @param bool  $preview              Admin editor's live preview: still reads the
	 *                                    real QuizPress result (there's no local answer
	 *                                    key to fall back to for a QuizPress quiz, unlike
	 *                                    the native path), but skips every side effect —
	 *                                    no attempt logged, no lock, no event emitted —
	 *                                    so testing a checkpoint repeatedly in preview
	 *                                    can't lock the video or spam real webhooks.
	 * @return array Sanitized verdict (never includes correct answers).
	 */
	public static function grade( $video_id, Subject $subject, $gate_id, array $answers, $quizpress_attempt_id = 0, $preview = false ) {
		// Quiz-gating is a pro feature.
		if ( ! \TruePlayer\Pro::active() ) {
			return [ 'error' => 'pro_required' ];
		}
		$gating   = ProgressService::gating_config( $video_id );
		$quiz     = self::find_quiz( $gating, $gate_id );
		$is_final = ( 'final' === $gate_id );

		if ( ! $quiz ) {
			return [ 'error' => 'quiz_not_found' ];
		}

		if ( 'quizpress' === ( $quiz['source'] ?? 'native' ) ) {
			return self::grade_quizpress( $video_id, $subject, $gate_id, $is_final, $gating, $quiz, (int) $quizpress_attempt_id, (bool) $preview );
		}

		if ( empty( $quiz['questions'] ) ) {
			return [ 'error' => 'quiz_not_found' ];
		}

		$questions = $quiz['questions'];
		$pass_pct  = isset( $quiz['passPercent'] ) ? (float) $quiz['passPercent'] : 70;
		$total     = count( $questions );
		$correct   = 0;
		$per_q     = [];

		foreach ( $questions as $q ) {
			$qid   = $q['id'] ?? '';
			$given = $answers[ $qid ] ?? null;
			$ok    = self::is_correct( $q, $given );
			$correct += $ok ? 1 : 0;
			$per_q[ $qid ] = $ok; // correctness only — not the right answer
		}

		$score  = $total > 0 ? round( $correct / $total * 100, 2 ) : 0;
		$passed = $score >= $pass_pct;

		return self::record_verdict( $video_id, $subject, $gate_id, $is_final, $gating, $score, $passed, $answers, $per_q );
	}

	/**
	 * QuizPress-sourced checkpoint/final quiz: QuizPress owns authoring,
	 * question types and grading — TruePlayer only reads the one attempt the
	 * viewer just finished (identified by id, not "whatever's most recent")
	 * and runs its real result through the exact same attempt/lock/event
	 * pipeline as a native quiz. Never trusts the browser's
	 * `quizpress:attempt_finished` event, or the attempt id itself, as the
	 * verdict — the id only says which row to go verify server-side; the
	 * score and status are read back from that row, and it's confirmed to
	 * actually belong to this quiz and this subject before any of it is
	 * trusted (see Academy LMS's own QuizPress integration for the same
	 * total_marks/earned_marks -> percentage read this mirrors).
	 */
	private static function grade_quizpress( $video_id, Subject $subject, $gate_id, $is_final, array $gating, array $quiz, $quizpress_attempt_id = 0, $preview = false ) {
		$quizpress_id = (int) ( $quiz['quizpressId'] ?? 0 );
		if ( ! $quizpress_id || ! class_exists( '\\QuizPress\\API\\Query\\Attempts' ) ) {
			return [ 'error' => 'quizpress_unavailable' ];
		}

		// Reliable per-person tracking needs a real user id — guests have none
		// for QuizPress to key attempts on.
		if ( 'user' !== $subject->type ) {
			return [ 'error' => 'login_required' ];
		}

		$attempt = $quizpress_attempt_id ? \QuizPress\API\Query\Attempts::get_quiz_attempt( (int) $quizpress_attempt_id ) : null;
		if ( ! $attempt || (int) $attempt->quiz_id !== $quizpress_id || (int) $attempt->user_id !== (int) $subject->id ) {
			return [ 'error' => 'quiz_not_completed' ];
		}

		$status = (string) $attempt->attempt_status;

		// A quiz containing a manually-reviewed question type (short answer,
		// paragraph, date, number) always finishes 'pending' regardless of
		// score — QuizPress won't compute passed/failed until an admin reviews
		// it in Quiz Insights. Treating 'pending' as a fail would silently
		// consume an attempt and could lock the video before a human ever
		// looks at it, so it gets its own outcome: no attempt consumed, no
		// lock — the gate just re-checks next time and resolves once reviewed.
		if ( 'pending' === $status ) {
			return [ 'passed' => false, 'pending' => true ];
		}

		$passed       = ( 'passed' === $status );
		$total_marks  = (float) $attempt->total_marks;
		$earned_marks = (float) $attempt->earned_marks;
		$score        = $total_marks > 0 ? round( $earned_marks / $total_marks * 100, 2 ) : 0;

		if ( $preview ) {
			return [ 'passed' => $passed, 'score' => $score, 'preview' => true ];
		}

		return self::record_verdict(
			$video_id,
			$subject,
			$gate_id,
			$is_final,
			$gating,
			$score,
			$passed,
			[ 'quizpressId' => $quizpress_id, 'quizpressAttemptId' => $quizpress_attempt_id ],
			[]
		);
	}

	/**
	 * Shared attempt bookkeeping + lock enforcement + event emission for a
	 * graded verdict, regardless of where the score came from.
	 */
	private static function record_verdict( $video_id, Subject $subject, $gate_id, $is_final, array $gating, $score, $passed, array $answers, array $per_q ) {
		$row        = ProgressService::get_row( $video_id, $subject );
		$attempts   = (int) ( $row['attempts'] ?? 0 );
		$attempt_no = $attempts + 1;

		self::log_attempt( $video_id, $subject, $gate_id, $answers, $score, $passed, $attempt_no );

		$payload_extra = [
			'gate_id'    => $gate_id,
			'score'      => $score,
			'passed'     => $passed,
			'attempt_no' => $attempt_no,
		];

		if ( $passed ) {
			if ( $is_final ) {
				ProgressService::upsert( $video_id, $subject, [ 'status' => 'completed', 'completed' => 1 ] );
				Events::emit( 'quiz.passed', ProgressService::event_payload( $video_id, $subject, $payload_extra ) );
				Events::emit( 'view.completed', ProgressService::event_payload( $video_id, $subject, [ 'coverage_percent' => (float) ( $row['percent'] ?? 0 ) ] ) );
			} else {
				Events::emit( 'checkpoint.passed', ProgressService::event_payload( $video_id, $subject, $payload_extra ) );
			}
			return [
				'passed'      => true,
				'score'       => $score,
				'completed'   => $is_final,
				'perQuestion' => $per_q,
			];
		}

		// Failed → consume an attempt.
		$max_attempts = (int) $gating['maxAttempts'];
		$locked       = false;
		if ( $attempt_no >= $max_attempts ) {
			// Lock + reset coverage so the retry requires a full re-watch.
			ProgressService::upsert(
				$video_id,
				$subject,
				[
					'status'          => 'locked',
					'attempts'        => $attempt_no,
					'watched_ranges'  => wp_json_encode( [] ),
					'watched_seconds' => 0,
					'percent'         => 0,
				]
			);
			$locked = true;
			Events::emit( $is_final ? 'quiz.failed' : 'checkpoint.failed', ProgressService::event_payload( $video_id, $subject, $payload_extra ) );
			Events::emit( 'video.locked', ProgressService::event_payload( $video_id, $subject, $payload_extra ) );
		} else {
			ProgressService::upsert( $video_id, $subject, [ 'attempts' => $attempt_no ] );
			Events::emit( $is_final ? 'quiz.failed' : 'checkpoint.failed', ProgressService::event_payload( $video_id, $subject, $payload_extra ) );
		}

		return [
			'passed'       => false,
			'score'        => $score,
			'locked'       => $locked,
			'attemptsLeft' => max( 0, $max_attempts - $attempt_no ),
			'perQuestion'  => $per_q,
		];
	}

	private static function find_quiz( array $gating, $gate_id ) {
		if ( 'final' === $gate_id ) {
			return $gating['finalQuiz'] ?? null;
		}
		if ( 0 === strpos( $gate_id, 'checkpoint:' ) ) {
			$cid = substr( $gate_id, strlen( 'checkpoint:' ) );
			foreach ( (array) ( $gating['checkpoints'] ?? [] ) as $cp ) {
				if ( (string) ( $cp['id'] ?? '' ) === (string) $cid ) {
					return $cp;
				}
			}
		}
		return null;
	}

	/**
	 * Compare a submitted answer to the stored correct value. Supports mcq
	 * (single or multi) and boolean questions. The "correct" marker may be an
	 * option id, an array of ids, or per-option isCorrect flags.
	 */
	private static function is_correct( array $q, $given ) {
		$type = $q['type'] ?? 'mcq';

		if ( 'boolean' === $type ) {
			$correct = $q['correct'] ?? ( $q['answer'] ?? null );
			return self::bool( $given ) === self::bool( $correct );
		}

		// Determine the correct set of option ids.
		$correct_ids = [];
		if ( isset( $q['correct'] ) ) {
			$correct_ids = is_array( $q['correct'] ) ? $q['correct'] : [ $q['correct'] ];
		} elseif ( isset( $q['correctIndexes'] ) ) {
			$correct_ids = (array) $q['correctIndexes'];
		} elseif ( isset( $q['options'] ) && is_array( $q['options'] ) ) {
			foreach ( $q['options'] as $opt ) {
				if ( is_array( $opt ) && ! empty( $opt['isCorrect'] ) ) {
					$correct_ids[] = $opt['id'] ?? '';
				}
			}
		}

		$given_ids   = is_array( $given ) ? $given : ( null === $given ? [] : [ $given ] );
		$correct_ids = array_map( 'strval', $correct_ids );
		$given_ids   = array_map( 'strval', $given_ids );
		sort( $correct_ids );
		sort( $given_ids );
		return ! empty( $correct_ids ) && $correct_ids === $given_ids;
	}

	private static function bool( $v ) {
		return filter_var( $v, FILTER_VALIDATE_BOOLEAN );
	}

	private static function log_attempt( $video_id, Subject $subject, $gate_id, array $answers, $score, $passed, $attempt_no ) {
		global $wpdb;
		$wpdb->insert(
			self::attempts_table(),
			[
				'video_id'     => $video_id,
				'gate_id'      => $gate_id,
				'subject_type' => $subject->type,
				'subject_id'   => $subject->id,
				'answers'      => wp_json_encode( $answers ),
				'score'        => $score,
				'passed'       => $passed ? 1 : 0,
				'attempt_no'   => $attempt_no,
				'created_at'   => current_time( 'mysql', true ),
			]
		);
	}
}
