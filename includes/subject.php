<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves the "who is watching" identity for progress + gating.
 *
 * Logged-in  → type 'user',  id = WP user id (reliable).
 * Guest      → type 'guest', id = a signed uuid stored in the httpOnly
 *              `tp_uid` cookie (best-effort; clearable/spoofable — documented).
 *
 * The cookie value is `uuid.signature` where signature = HMAC(uuid). We only
 * trust the uuid when the signature verifies, so a client can't inject an
 * arbitrary subject id.
 */
class Subject {

	const COOKIE = 'tp_uid';

	public $type;
	public $id;

	public function __construct( $type, $id ) {
		$this->type = $type;
		$this->id   = (string) $id;
	}

	public static function secret() {
		return wp_salt( 'auth' );
	}

	/**
	 * Resolve the current subject. May issue a guest cookie as a side effect
	 * (safe to call before REST output).
	 */
	public static function resolve() {
		if ( is_user_logged_in() ) {
			return new self( 'user', get_current_user_id() );
		}
		return new self( 'guest', self::ensure_guest_id() );
	}

	private static function ensure_guest_id() {
		$raw = isset( $_COOKIE[ self::COOKIE ] ) ? sanitize_text_field( wp_unslash( $_COOKIE[ self::COOKIE ] ) ) : '';
		$uid = self::verify_cookie( $raw );

		if ( ! $uid ) {
			$uid   = wp_generate_uuid4();
			$value = $uid . '.' . hash_hmac( 'sha256', $uid, self::secret() );
			// httpOnly, lax; 1-year. Guarded so headers-already-sent contexts
			// (rare in REST) don't warn.
			if ( ! headers_sent() ) {
				setcookie(
					self::COOKIE,
					$value,
					[
						'expires'  => time() + YEAR_IN_SECONDS,
						'path'     => defined( 'COOKIEPATH' ) ? COOKIEPATH : '/',
						'domain'   => defined( 'COOKIE_DOMAIN' ) ? COOKIE_DOMAIN : '',
						'secure'   => is_ssl(),
						'httponly' => true,
						'samesite' => 'Lax',
					]
				);
			}
			$_COOKIE[ self::COOKIE ] = $value;
		}
		return $uid;
	}

	private static function verify_cookie( $raw ) {
		if ( ! $raw || false === strpos( $raw, '.' ) ) {
			return '';
		}
		list( $uid, $sig ) = explode( '.', $raw, 2 );
		$expected          = hash_hmac( 'sha256', $uid, self::secret() );
		return hash_equals( $expected, (string) $sig ) ? $uid : '';
	}

	public function email() {
		if ( 'user' === $this->type ) {
			$u = get_userdata( (int) $this->id );
			return $u ? $u->user_email : null;
		}
		return null;
	}

	public function name() {
		if ( 'user' === $this->type ) {
			$u = get_userdata( (int) $this->id );
			return $u ? $u->display_name : null;
		}
		return null;
	}

	public function to_array() {
		return [
			'type'  => $this->type,
			'id'    => $this->id,
			'email' => $this->email(),
			'name'  => $this->name(),
		];
	}
}
