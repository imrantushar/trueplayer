<?php

namespace TruePlayer\Webhook;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * HMAC-SHA256 signing for webhook payloads. Receivers verify the
 * `X-TruePlayer-Signature: sha256=<hex>` header against the raw request body
 * using the shared endpoint secret.
 */
class Signer {

	public static function sign( $body, $secret ) {
		return hash_hmac( 'sha256', (string) $body, (string) $secret );
	}

	public static function verify( $body, $secret, $signature ) {
		$expected = 'sha256=' . self::sign( $body, $secret );
		return hash_equals( $expected, (string) $signature );
	}
}
