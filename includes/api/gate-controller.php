<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Subject;
use TruePlayer\Services\ProgressService;
use TruePlayer\Events;

/**
 * GET /trueplayer/v1/gate?video=ID
 *
 * The first call the player makes on mount. Resolves the viewer, returns
 * whether they may play, resume position, completion + lock state. Public
 * (nonce-protected); issues the guest cookie as a side effect.
 */
class GateController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'gate';
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'handle' ],
				'permission_callback' => '__return_true',
				'args'                => [
					'video' => [ 'required' => true, 'sanitize_callback' => 'absint' ],
				],
			]
		);
	}

	public function handle( $request ) {
		$video_id = (int) $request->get_param( 'video' );
		if ( get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'trueplayer' ), [ 'status' => 404 ] );
		}

		// Without pro there is no gating/tracking — always playable, no writes.
		if ( ! \TruePlayer\Pro::active() ) {
			return rest_ensure_response( [ 'canPlay' => true, 'status' => 'in_progress', 'completed' => false, 'resumeAt' => 0, 'pro' => false ] );
		}

		$subject = Subject::resolve();
		$gating  = ProgressService::gating_config( $video_id );

		if ( ! empty( $gating['requireLoginForGate'] ) && 'guest' === $subject->type ) {
			return rest_ensure_response( [
				'canPlay' => false,
				'reason'  => 'login_required',
				'subject' => [ 'type' => 'guest' ],
			] );
		}

		$state = ProgressService::state( $video_id, $subject );

		$row = ProgressService::get_row( $video_id, $subject );
		if ( ! $row ) {
			Events::emit( 'view.started', ProgressService::event_payload( $video_id, $subject ) );
		}

		$state['subject'] = [ 'type' => $subject->type ];
		return rest_ensure_response( $state );
	}
}
