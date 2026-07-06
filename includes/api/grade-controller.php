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
 * Body: { video, gate ('checkpoint:<id>'|'final'), answers:{qid:answer} }.
 * Grades server-side and returns pass/fail + lock state. Never returns the
 * correct answers. Public (nonce-protected).
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

		if ( get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'trueplayer' ), [ 'status' => 404 ] );
		}

		$subject = Subject::resolve();
		$verdict = GradingService::grade( $video_id, $subject, $gate_id, $answers );

		if ( isset( $verdict['error'] ) ) {
			return new \WP_Error( 'grade_error', $verdict['error'], [ 'status' => 400 ] );
		}

		return rest_ensure_response( $verdict );
	}
}
