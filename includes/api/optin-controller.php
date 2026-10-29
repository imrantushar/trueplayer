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
 * side), so the client can't redirect the subscription elsewhere.
 *
 * Public endpoint but defended on three fronts because an open subscribe route
 * is an obvious mail-bombing vector:
 *   - permission_callback verifies the `wp_rest` nonce (the player ships one
 *     via `assets.php`), so a scraper posting without a page load is rejected;
 *   - a per-IP+video throttle caps rapid submissions regardless of nonce;
 *   - a hidden honeypot field (`website`) short-circuits ordinary form bots
 *     without needing JavaScript to clear it on the real form.
 */
class OptinController extends WP_REST_Controller {

	/** Minimum seconds between submissions from one IP for the same video. */
	const THROTTLE_SECONDS = 10;

	/** Max submissions from one IP for the same video in an hour. */
	const HOURLY_CAP = 20;

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
				'permission_callback' => [ $this, 'can_submit' ],
			]
		);
	}

	/**
	 * A valid `wp_rest` nonce means the request came from a browser that loaded
	 * one of our pages; everything else is refused. Logged-in users get a fresh
	 * nonce from the player's localized data; anonymous users get the 12-hour
	 * anonymous `wp_rest` nonce (which is what we accept).
	 */
	public function can_submit( $request ) {
		$nonce = $request->get_header( 'x_wp_nonce' );
		if ( empty( $nonce ) ) {
			$nonce = (string) $request->get_param( '_wpnonce' );
		}
		return (bool) wp_verify_nonce( $nonce, 'wp_rest' );
	}

	public function handle( $request ) {
		$body     = (array) $request->get_json_params();
		$video_id = isset( $body['video'] ) && is_scalar( $body['video'] ) ? (int) $body['video'] : 0;
		$email    = isset( $body['email'] ) && is_string( $body['email'] ) ? sanitize_email( $body['email'] ) : '';
		$name     = Helper::text_value( $body['name'] ?? '' );
		$layer_id = Helper::text_value( $body['layer'] ?? '' );
		$website  = isset( $body['website'] ) && is_scalar( $body['website'] ) ? (string) $body['website'] : '';

		// Honeypot — real forms never fill this; bots that walk every input will.
		if ( '' !== trim( $website ) ) {
			return rest_ensure_response( [ 'ok' => true ] );
		}

		if ( ! is_email( $email ) ) {
			return new \WP_Error( 'bad_email', __( 'Please enter a valid email.', 'trueplayer' ), [ 'status' => 400 ] );
		}
		if ( get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'trueplayer' ), [ 'status' => 404 ] );
		}

		$throttle = $this->throttle( $video_id );
		if ( is_wp_error( $throttle ) ) {
			return $throttle;
		}

		$config = Helper::get_video_config( $video_id );
		$target = self::destination( $config, $layer_id );

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
	 * Per-IP+video rate limit, backed by two transients so a short burst and a
	 * sustained hour-long drizzle are both caught. Returns a WP_Error (429) on
	 * trip, true on allow.
	 */
	private function throttle( int $video_id ) {
		$ip = self::client_ip_hash();
		if ( '' === $ip ) {
			// No usable client identifier: share one bucket per video rather than
			// skipping the limit, so a missing address can't be used to bypass it.
			$ip = 'unknown';
		}
		$burst  = 'trueplayer_optin_burst_' . $ip . '_' . $video_id;
		$hourly = 'trueplayer_optin_hour_' . $ip . '_' . $video_id;

		if ( false !== get_transient( $burst ) ) {
			return new \WP_Error(
				'rate_limited',
				__( 'Please wait a moment before trying again.', 'trueplayer' ),
				[ 'status' => 429 ]
			);
		}
		$count = (int) get_transient( $hourly );
		if ( $count >= self::HOURLY_CAP ) {
			return new \WP_Error(
				'rate_limited',
				__( 'Too many submissions. Try again later.', 'trueplayer' ),
				[ 'status' => 429 ]
			);
		}

		set_transient( $burst, 1, self::THROTTLE_SECONDS );
		set_transient( $hourly, $count + 1, HOUR_IN_SECONDS );
		return true;
	}

	/**
	 * Hash of the submitting IP, salted with the install's secret so one site's
	 * transient key cannot be guessed from another. The IP itself is never
	 * stored.
	 *
	 * Only `REMOTE_ADDR` is trusted by default: forwarding headers are written by
	 * the client, so honouring them would let a bot dodge the throttle by sending
	 * a new one with every request. A site behind a proxy it controls can opt a
	 * header in through `trueplayer/optin/ip_headers`.
	 */
	private static function client_ip_hash(): string {
		$ip      = '';
		$headers = (array) apply_filters( 'trueplayer/optin/ip_headers', [ 'REMOTE_ADDR' ] );
		foreach ( $headers as $k ) {
			if ( ! empty( $_SERVER[ $k ] ) ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotValidated
				$raw = sanitize_text_field( wp_unslash( (string) $_SERVER[ $k ] ) );
				$raw = trim( explode( ',', $raw )[0] );
				if ( filter_var( $raw, FILTER_VALIDATE_IP ) ) {
					$ip = $raw;
					break;
				}
			}
		}
		if ( '' === $ip ) {
			return '';
		}
		return substr( wp_hash( $ip, 'nonce' ), 0, 16 );
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

		if ( is_array( $from_layer ) && '' !== (string) ( $from_layer['provider'] ?? '' ) ) {
			return [
				'provider' => (string) $from_layer['provider'],
				'lists'    => (array) ( $from_layer['lists'] ?? [] ),
				'tags'     => (array) ( $from_layer['tags'] ?? [] ),
			];
		}

		// Nothing configured anywhere. Notifying the site beats discarding a
		// contact a viewer deliberately handed over — which is what used to
		// happen, as a 422 the viewer read as their own address being rejected.
		return [ 'provider' => 'wp_mail', 'lists' => [], 'tags' => [] ];
	}
}
