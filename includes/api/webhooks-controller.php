<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Webhook\Signer;

/**
 * POST /trueplayer/v1/webhooks/test — sends a sample signed payload to a URL so
 * admins can confirm their receiver is wired up. Admin-only.
 */
class WebhooksController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'webhooks';
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/test',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'test' ],
				'permission_callback' => [ $this, 'admin' ],
			]
		);
	}

	public function admin() {
		return current_user_can( 'manage_options' );
	}

	public function test( $request ) {
		$body   = $request->get_json_params();
		$url    = isset( $body['url'] ) ? esc_url_raw( $body['url'] ) : '';
		$secret = isset( $body['secret'] ) ? (string) $body['secret'] : '';

		if ( ! $url ) {
			return new \WP_Error( 'bad_url', __( 'A valid URL is required.', 'trueplayer' ), [ 'status' => 400 ] );
		}

		$payload = wp_json_encode(
			[
				'event'     => 'webhook.test',
				'video_id'  => 0,
				'timestamp' => \TruePlayer\Helper::now_iso(),
				'site'      => wp_parse_url( home_url(), PHP_URL_HOST ),
				'message'   => 'This is a TruePlayer test delivery.',
			]
		);

		$headers = [
			'Content-Type'       => 'application/json',
			'X-TruePlayer-Event' => 'webhook.test',
		];
		if ( '' !== $secret ) {
			$headers['X-TruePlayer-Signature'] = 'sha256=' . Signer::sign( $payload, $secret );
		}

		$response = wp_remote_post( $url, [ 'timeout' => 8, 'headers' => $headers, 'body' => $payload ] );
		if ( is_wp_error( $response ) ) {
			return rest_ensure_response( [ 'ok' => false, 'error' => $response->get_error_message() ] );
		}
		return rest_ensure_response(
			[
				'ok'   => true,
				'code' => wp_remote_retrieve_response_code( $response ),
			]
		);
	}
}
