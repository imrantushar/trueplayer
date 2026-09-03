<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Subject;
use TruePlayer\Services\GradingService;

/**
 * POST /trueplayer/v1/grade
 *
 * Body: { video, gate ('checkpoint:<id>'|'final'), answers:{qid:answer},
 * quizpressAttemptId?, preview? }. `quizpressAttemptId` identifies the
 * just-finished QuizPress attempt to verify for a QuizPress-sourced quiz —
 * see GradingService::grade_quizpress(), which reads that attempt's real
 * marks/status rather than trusting anything the client asserts about it.
 * Grades server-side and returns pass/fail + lock state. Never returns the
 * correct answers. Public (nonce-protected) — `preview` is the one exception:
 * honored only for an editor (checked here, not just trusted from the body),
 * since skipping attempt/lock bookkeeping would otherwise let anyone probe
 * pass/fail for free with no attempt ever consumed.
 */
class GradeController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'grade';
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'handle' ],
				'permission_callback' => '__return_true',
			]
		);
	}

	public function handle( $request ) {
		$body     = $request->get_json_params();
		$video_id = isset( $body['video'] ) ? (int) $body['video'] : 0;
		$gate_id  = isset( $body['gate'] ) ? sanitize_text_field( $body['gate'] ) : 'final';
		$answers  = isset( $body['answers'] ) && is_array( $body['answers'] ) ? $body['answers'] : [];
		$quizpress_attempt_id = isset( $body['quizpressAttemptId'] ) ? (int) $body['quizpressAttemptId'] : 0;
		// Never trust the client's own `preview` claim — only an editor gets
		// the side-effect-free read.
		$preview = ! empty( $body['preview'] ) && current_user_can( 'edit_post', $video_id );

		if ( get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'trueplayer' ), [ 'status' => 404 ] );
		}

		$subject = Subject::resolve();
		$verdict = GradingService::grade( $video_id, $subject, $gate_id, $answers, $quizpress_attempt_id, $preview );

		if ( isset( $verdict['error'] ) ) {
			return new \WP_Error( 'grade_error', $verdict['error'], [ 'status' => 400 ] );
		}

		return rest_ensure_response( $verdict );
	}
}
