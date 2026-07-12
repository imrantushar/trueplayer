<?php

namespace TruePlayer\Integrations;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Mailchimp opt-in integration. Available once an API key is configured (in
 * TruePlayer settings under integrations.mailchimp.api_key, or via the
 * `trueplayer/mailchimp/api_key` filter). Audiences = Mailchimp lists; a
 * subscribe upserts the member (idempotent) so repeat opt-ins are safe.
 */
class Mailchimp extends BaseIntegration {

	public function id(): string {
		return 'mailchimp';
	}

	public function name(): string {
		return 'Mailchimp';
	}

	public function is_available(): bool {
		return '' !== $this->api_key();
	}

	private function api_key(): string {
		$settings = json_decode( (string) get_option( TRUEPLAYER_SETTINGS_NAME, '{}' ), true );
		$key      = $settings['integrations']['mailchimp']['api_key'] ?? '';
		return (string) apply_filters( 'trueplayer/mailchimp/api_key', $key );
	}

	/** Mailchimp data-center is the suffix after the last '-' in the API key. */
	private function base_url(): string {
		$key = $this->api_key();
		$dc  = false !== strpos( $key, '-' ) ? substr( $key, strpos( $key, '-' ) + 1 ) : 'us1';
		return "https://{$dc}.api.mailchimp.com/3.0/";
	}

	private function request( string $method, string $path, array $body = null ) {
		$args = [
			'method'  => $method,
			'timeout' => 15,
			'headers' => [
				'Authorization' => 'Basic ' . base64_encode( 'anystring:' . $this->api_key() ),
				'Content-Type'  => 'application/json',
			],
		];
		if ( null !== $body ) {
			$args['body'] = wp_json_encode( $body );
		}
		$res = wp_remote_request( $this->base_url() . ltrim( $path, '/' ), $args );
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		return [
			'code' => (int) wp_remote_retrieve_response_code( $res ),
			'data' => json_decode( (string) wp_remote_retrieve_body( $res ), true ),
		];
	}

	public function lists(): array {
		if ( ! $this->is_available() ) {
			return [];
		}
		$res = $this->request( 'GET', 'lists?count=100&fields=lists.id,lists.name' );
		if ( is_wp_error( $res ) || empty( $res['data']['lists'] ) ) {
			return [];
		}
		return array_map(
			static function ( $l ) {
				return [ 'id' => (string) $l['id'], 'title' => (string) $l['name'] ];
			},
			$res['data']['lists']
		);
	}

	public function subscribe( array $data ): array {
		if ( ! $this->is_available() ) {
			return [ 'ok' => false, 'message' => __( 'Mailchimp is not configured.', 'trueplayer' ) ];
		}
		$email = sanitize_email( $data['email'] ?? '' );
		if ( ! is_email( $email ) ) {
			return [ 'ok' => false, 'message' => __( 'Invalid email.', 'trueplayer' ) ];
		}

		$name  = trim( (string) ( $data['name'] ?? '' ) );
		$parts = '' !== $name ? explode( ' ', $name, 2 ) : [ '', '' ];
		$lists = array_values( array_filter( array_map( 'strval', (array) ( $data['lists'] ?? [] ) ) ) );
		if ( ! $lists ) {
			return [ 'ok' => false, 'message' => __( 'No Mailchimp audience selected.', 'trueplayer' ) ];
		}

		$member = [
			'email_address'  => $email,
			'status_if_new'  => 'subscribed',
			'status'         => 'subscribed',
			'merge_fields'   => [ 'FNAME' => $parts[0] ?? '', 'LNAME' => $parts[1] ?? '' ],
		];

		$ok = false;
		foreach ( $lists as $list_id ) {
			$hash = md5( strtolower( $email ) );
			$res  = $this->request( 'PUT', "lists/{$list_id}/members/{$hash}", $member );
			if ( ! is_wp_error( $res ) && $res['code'] >= 200 && $res['code'] < 300 ) {
				$ok = true;
			}
		}
		return $ok
			? [ 'ok' => true ]
			: [ 'ok' => false, 'message' => __( 'Mailchimp rejected the subscription.', 'trueplayer' ) ];
	}
}
