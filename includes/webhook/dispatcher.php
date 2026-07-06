<?php

namespace TruePlayer\Webhook;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\Helper;

/**
 * Subscribes to the internal event bus and delivers HMAC-signed JSON payloads
 * to configured endpoints. Delivery is async (single cron event) so a slow or
 * dead endpoint never blocks playback or the request that triggered it.
 *
 * Endpoints come from two places:
 *   - global: settings option `webhooks` (array of {url, secret, events, active})
 *   - per-video: config `webhooks` array (same shape)
 */
class Dispatcher {

	const CRON_HOOK = 'trueplayer/webhook/deliver';

	public static function init() {
		$self = new self();
		add_action( 'trueplayer/event', [ $self, 'on_event' ], 10, 2 );
		add_action( self::CRON_HOOK, [ $self, 'deliver' ], 10, 3 );
	}

	/**
	 * @param string $name    Event name.
	 * @param array  $payload Normalized event payload.
	 */
	public function on_event( $name, $payload ) {
		if ( ! \TruePlayer\Pro::active() ) {
			return; // automation is a pro feature
		}
		$video_id  = isset( $payload['video_id'] ) ? (int) $payload['video_id'] : 0;
		$endpoints = $this->endpoints_for( $name, $video_id );

		foreach ( $endpoints as $i => $endpoint ) {
			// A per-endpoint nonce keeps otherwise-identical cron args from
			// being de-duplicated by WP-Cron.
			$nonce = wp_generate_password( 8, false );
			wp_schedule_single_event(
				time(),
				self::CRON_HOOK,
				[ $endpoint, $payload, $nonce ]
			);
		}

		// If cron is effectively disabled, deliver inline on shutdown as a
		// fallback so events aren't silently lost on low-traffic sites.
		if ( defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON && ! empty( $endpoints ) ) {
			foreach ( $endpoints as $endpoint ) {
				$this->deliver( $endpoint, $payload, 'inline' );
			}
		}
	}

	/**
	 * Resolve the endpoints subscribed to $name for this video.
	 */
	public function endpoints_for( $name, $video_id ) {
		$out = [];

		$global = json_decode( get_option( TRUEPLAYER_SETTINGS_NAME, '{}' ), true );
		$global = ( is_array( $global ) && ! empty( $global['webhooks'] ) ) ? $global['webhooks'] : [];

		$per_video = [];
		if ( $video_id ) {
			$config    = Helper::get_video_config( $video_id );
			$per_video = ! empty( $config['webhooks'] ) && is_array( $config['webhooks'] ) ? $config['webhooks'] : [];
		}

		foreach ( array_merge( (array) $global, (array) $per_video ) as $ep ) {
			if ( empty( $ep['url'] ) ) {
				continue;
			}
			if ( isset( $ep['active'] ) && ! $ep['active'] ) {
				continue;
			}
			$events = isset( $ep['events'] ) ? (array) $ep['events'] : [];
			// Empty subscription list = all events.
			if ( ! empty( $events ) && ! in_array( $name, $events, true ) && ! in_array( '*', $events, true ) ) {
				continue;
			}
			$out[] = $ep;
		}

		return apply_filters( 'trueplayer/webhook/endpoints', $out, $name, $video_id );
	}

	/**
	 * Perform one delivery. Runs in a cron context (or inline fallback).
	 */
	public function deliver( $endpoint, $payload, $nonce = '' ) {
		if ( empty( $endpoint['url'] ) ) {
			return;
		}
		$body   = wp_json_encode( $payload );
		$secret = $endpoint['secret'] ?? '';

		$headers = [
			'Content-Type'          => 'application/json',
			'X-TruePlayer-Event'    => $payload['event'] ?? '',
			'X-TruePlayer-Delivery' => is_string( $nonce ) ? $nonce : '',
		];
		if ( '' !== $secret ) {
			$headers['X-TruePlayer-Signature'] = 'sha256=' . Signer::sign( $body, $secret );
		}

		$response = wp_remote_post(
			$endpoint['url'],
			[
				'timeout'  => 8,
				'blocking' => true,
				'headers'  => $headers,
				'body'     => $body,
			]
		);

		$code = is_wp_error( $response ) ? 0 : wp_remote_retrieve_response_code( $response );

		/**
		 * Pro's webhook-logs addon hooks this to persist delivery attempts +
		 * enable retries/replay.
		 */
		do_action(
			'trueplayer/webhook/delivered',
			[
				'url'      => $endpoint['url'],
				'event'    => $payload['event'] ?? '',
				'code'     => $code,
				'error'    => is_wp_error( $response ) ? $response->get_error_message() : '',
				'payload'  => $payload,
			]
		);
	}
}
