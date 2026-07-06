<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Subject;
use TruePlayer\Services\ProgressService;

/**
 * POST /trueplayer/v1/progress
 *
 * Heartbeat endpoint. Body: { video, ranges:[[s,e],…], duration, mediaTime,
 * realElapsed }. The server merges coverage, applies anti-cheat, recomputes
 * percent, and returns fresh state. Public (nonce-protected).
 */
class ProgressController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'progress';
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

		if ( get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'trueplayer' ), [ 'status' => 404 ] );
		}

		$subject      = Subject::resolve();
		$ranges       = isset( $body['ranges'] ) && is_array( $body['ranges'] ) ? $body['ranges'] : [];
		$duration     = isset( $body['duration'] ) ? (int) $body['duration'] : 0;
		$media_time   = isset( $body['mediaTime'] ) ? (int) $body['mediaTime'] : 0;
		$real_elapsed = isset( $body['realElapsed'] ) ? (int) $body['realElapsed'] : 0;
		$plays        = isset( $body['plays'] ) && is_array( $body['plays'] ) ? $body['plays'] : [];
		$session_start = ! empty( $body['sessionStart'] );

		// Cap the number of ranges accepted per call (defensive).
		if ( count( $ranges ) > 2000 ) {
			$ranges = array_slice( $ranges, 0, 2000 );
		}

		$state = ProgressService::record( $video_id, $subject, $ranges, $duration, $media_time, $real_elapsed, $plays, $session_start );
		return rest_ensure_response( $state );
	}
}
