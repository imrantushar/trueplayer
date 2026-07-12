<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Private video / expiring links (pro). Self-hosted files get a signed,
 * short-lived REST stream URL instead of their real attachment URL; Bunny
 * pull zones get CDN Token Authentication query strings. The raw source URL
 * never reaches the DOM for a private video.
 */
class PrivateVideo {

	/** How long a signed link stays valid (seconds). */
	public static function ttl(): int {
		return (int) apply_filters( 'trueplayer/private_video/ttl', 6 * HOUR_IN_SECONDS );
	}

	/** HMAC over the video id + expiry, keyed to this site. */
	public static function sign( int $video_id, int $expires ): string {
		return hash_hmac( 'sha256', $video_id . '|' . $expires, wp_salt( 'auth' ) );
	}

	public static function verify( int $video_id, int $expires, string $sig ): bool {
		if ( $expires < time() ) {
			return false;
		}
		return hash_equals( self::sign( $video_id, $expires ), $sig );
	}

	/**
	 * Swap a private source's URL for a signed one at render time. Called from
	 * the shortcode config pipeline, pro only.
	 */
	public static function prepare_source( array $config, int $video_id ): array {
		$source = is_array( $config['source'] ?? null ) ? $config['source'] : [];
		if ( empty( $source['private'] ) ) {
			return $config;
		}
		$type = $source['type'] ?? '';

		if ( 'self' === $type || 'url' === $type ) {
			$expires = time() + self::ttl();
			$config['source']['src'] = add_query_arg(
				[
					'video' => $video_id,
					'exp'   => $expires,
					'sig'   => self::sign( $video_id, $expires ),
				],
				rest_url( TRUEPLAYER_PLUGIN_SLUG . '/v1/stream' )
			);
			// The stream endpoint re-reads the raw meta for the real file.
			$config['source']['crossOrigin'] = $config['source']['crossOrigin'] ?? false;
		} elseif ( 'bunny' === $type ) {
			$config['source'] = self::sign_bunny_source( $config['source'] );
		}
		return $config;
	}

	/**
	 * Bunny CDN Token Authentication (directory mode): the token covers
	 * everything under /{videoId}/ so hls.js segment requests validate too.
	 * Needs the pull zone's Token Authentication Key in Settings → Bunny.net.
	 */
	private static function sign_bunny_source( array $source ): array {
		$settings = json_decode( get_option( TRUEPLAYER_SETTINGS_NAME, '{}' ), true );
		$key      = is_array( $settings ) ? ( $settings['bunny']['tokenKey'] ?? '' ) : '';
		if ( '' === $key ) {
			return $source; // not configured — plain playback
		}

		$src = $source['src'] ?? '';
		if ( '' === $src ) {
			$zone = preg_replace( '#^https?://#', '', rtrim( (string) ( $source['pullZone'] ?? '' ), '/' ) );
			$src  = 'https://' . $zone . '/' . ( $source['videoId'] ?? '' ) . '/playlist.m3u8';
		}
		$path = wp_parse_url( $src, PHP_URL_PATH );
		if ( ! $path ) {
			return $source;
		}
		$token_path = rtrim( dirname( $path ), '/' ) . '/';
		$expires    = time() + self::ttl();
		$token      = strtr(
			rtrim( base64_encode( hash( 'sha256', $key . $token_path . $expires, true ) ), '=' ),
			'+/',
			'-_'
		);

		$source['src'] = add_query_arg(
			[
				'token'      => $token,
				'expires'    => $expires,
				'token_path' => rawurlencode( $token_path ),
			],
			$src
		);
		return $source;
	}

	/**
	 * Resolve the real file path for a private self-hosted video from the RAW
	 * config meta (never from request input).
	 */
	public static function resolve_file( int $video_id ): string {
		$raw    = get_post_meta( $video_id, '_trueplayer_config', true );
		$config = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : [];
		$source = is_array( $config['source'] ?? null ) ? $config['source'] : [];
		if ( empty( $source['private'] ) ) {
			return '';
		}
		$src = (string) ( $source['src'] ?? '' );
		if ( '' === $src ) {
			return '';
		}
		$attachment_id = ! empty( $source['attachmentId'] )
			? (int) $source['attachmentId']
			: attachment_url_to_postid( $src );
		if ( $attachment_id ) {
			$file = get_attached_file( $attachment_id );
			return $file && file_exists( $file ) ? $file : '';
		}
		// External-URL sources have no local file; the endpoint 302s instead.
		return '';
	}

	/** Raw source URL from meta (for redirect fallback on `url` sources). */
	public static function raw_source_url( int $video_id ): string {
		$raw    = get_post_meta( $video_id, '_trueplayer_config', true );
		$config = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : [];
		$source = is_array( $config['source'] ?? null ) ? $config['source'] : [];
		return empty( $source['private'] ) ? '' : (string) ( $source['src'] ?? '' );
	}
}
