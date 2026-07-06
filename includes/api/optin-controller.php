<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Helper;
use TruePlayer\Integrations;

/**
 * POST /trueplayer/v1/optin — handles an in-player subscribe/email-capture
 * submission. The provider + target lists come from the VIDEO CONFIG (server
 * side), so the client can't redirect the subscription elsewhere. Public
 * (nonce-protected).
 */
class OptinController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'optin';
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
		if ( ! \TruePlayer\Pro::active() ) {
			return new \WP_Error( 'pro_required', __( 'Subscribe/opt-in requires TruePlayer Pro.', 'trueplayer' ), [ 'status' => 403 ] );
		}
		$body     = $request->get_json_params();
		$video_id = isset( $body['video'] ) ? (int) $body['video'] : 0;
		$email    = isset( $body['email'] ) ? sanitize_email( $body['email'] ) : '';
		$name     = isset( $body['name'] ) ? sanitize_text_field( $body['name'] ) : '';

		if ( ! is_email( $email ) ) {
			return new \WP_Error( 'bad_email', __( 'Please enter a valid email.', 'trueplayer' ), [ 'status' => 400 ] );
		}
		if ( get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'trueplayer' ), [ 'status' => 404 ] );
		}

		$config = Helper::get_video_config( $video_id );
		$optin  = isset( $config['optin'] ) && is_array( $config['optin'] ) ? $config['optin'] : [];

		$result = Integrations::subscribe( [
			'email'    => $email,
			'name'     => $name,
			'video_id' => $video_id,
			'provider' => $optin['provider'] ?? '',
			'lists'    => $optin['lists'] ?? [],
			'tags'     => $optin['tags'] ?? [],
		] );

		if ( empty( $result['ok'] ) ) {
			return new \WP_Error( 'subscribe_failed', $result['message'] ?? __( 'Could not subscribe.', 'trueplayer' ), [ 'status' => 422 ] );
		}

		return rest_ensure_response( [ 'ok' => true ] );
	}
}
