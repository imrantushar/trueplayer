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
		$body     = $request->get_json_params();
		$video_id = isset( $body['video'] ) ? (int) $body['video'] : 0;
		$email    = isset( $body['email'] ) ? sanitize_email( $body['email'] ) : '';
		$name     = isset( $body['name'] ) ? sanitize_text_field( $body['name'] ) : '';
		$layer_id = isset( $body['layer'] ) ? sanitize_text_field( wp_unslash( (string) $body['layer'] ) ) : '';

		if ( ! is_email( $email ) ) {
			return new \WP_Error( 'bad_email', __( 'Please enter a valid email.', 'trueplayer' ), [ 'status' => 400 ] );
		}
		if ( get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'trueplayer' ), [ 'status' => 404 ] );
		}

		$config = Helper::get_video_config( $video_id );
		$target = self::destination( $config, $layer_id );

		// A provider the licence doesn't cover must not be reachable by posting
		// its id — the destination is resolved from stored config, but the
		// config could predate a lapsed licence.
		if ( '' !== $target['provider'] && ! \TruePlayer\Pro::active() && ! Integrations::is_free_provider( $target['provider'] ) ) {
			return new \WP_Error( 'pro_required', __( 'That subscription provider requires TruePlayer Pro.', 'trueplayer' ), [ 'status' => 403 ] );
		}

		$result = Integrations::subscribe( [
			'email'    => $email,
			'name'     => $name,
			'video_id' => $video_id,
			'layer_id' => $layer_id,
			'provider' => $target['provider'],
			'lists'    => $target['lists'],
			'tags'     => $target['tags'],
		] );

		if ( empty( $result['ok'] ) ) {
			return new \WP_Error( 'subscribe_failed', $result['message'] ?? __( 'Could not subscribe.', 'trueplayer' ), [ 'status' => 422 ] );
		}

		return rest_ensure_response( [ 'ok' => true ] );
	}

	/**
	 * Where this submission's contact should go.
	 *
	 * The submitting layer owns its provider, which is what stops one form
	 * quietly borrowing another's destination — before this, every submission
	 * read `config.optin` no matter which form sent it, so a Layers email form
	 * on a video whose Email capture was never set up had nowhere to go and came
	 * back "No subscription provider is configured."
	 *
	 * Resolved from the STORED config rather than the request, so the client can
	 * never redirect a subscription somewhere the author didn't choose.
	 * `config.optin` remains the fallback for videos not yet migrated.
	 *
	 * @param array  $config   The video's stored config.
	 * @param string $layer_id Layer that submitted, if any.
	 * @return array{provider:string,lists:array,tags:array}
	 */
	private static function destination( array $config, string $layer_id ): array {
		// Lists and tags belong to the provider that defines them — a GemCRM list
		// id means nothing to Mailchimp — so each candidate is taken whole or not
		// at all, never mixed.
		$from_layer = null;
		if ( '' !== $layer_id && ! empty( $config['layers'] ) && is_array( $config['layers'] ) ) {
			foreach ( $config['layers'] as $layer ) {
				if ( is_array( $layer ) && ( $layer['id'] ?? '' ) === $layer_id && 'form' === ( $layer['type'] ?? '' ) ) {
					$from_layer = $layer;
					break;
				}
			}
		}

		$optin = isset( $config['optin'] ) && is_array( $config['optin'] ) ? $config['optin'] : [];

		// The layer's own choice wins. Falling through to the video-level value
		// keeps the forms that predate the merge working: they had no provider
		// field, and every submission used to be routed with `config.optin`.
		foreach ( [ $from_layer, $optin ] as $candidate ) {
			if ( is_array( $candidate ) && '' !== (string) ( $candidate['provider'] ?? '' ) ) {
				return [
					'provider' => (string) $candidate['provider'],
					'lists'    => (array) ( $candidate['lists'] ?? [] ),
					'tags'     => (array) ( $candidate['tags'] ?? [] ),
				];
			}
		}

		// Nothing configured anywhere. Notifying the site beats discarding a
		// contact a viewer deliberately handed over — which is what used to
		// happen, as a 422 the viewer read as their own address being rejected.
		return [ 'provider' => 'wp_mail', 'lists' => [], 'tags' => [] ];
	}
}
