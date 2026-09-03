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

	/** How long a signed link stays valid (seconds). Settings → Sources & CDN. */
	public static function ttl(): int {
		$sources = \TruePlayer\Helper::get_settings_section( 'sources' );
		$hours   = isset( $sources['signedUrlTtlHours'] ) ? (int) $sources['signedUrlTtlHours'] : 0;
		$default = $hours > 0 ? $hours * HOUR_IN_SECONDS : 6 * HOUR_IN_SECONDS;
		return (int) apply_filters( 'trueplayer/private_video/ttl', $default );
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
			$config['source'] = self::sign_bunny_stream( $config['source'] );
		} elseif ( 'bunnyStorage' === $type ) {
			$config['source'] = self::sign_bunny_storage( $config['source'] );
		}
		return $config;
	}

	/**
	 * Bunny Stream: the source is always an HLS playlist, so the token has to
	 * cover the whole directory — hls.js fetches each segment as its own
	 * request, and a token bound to playlist.m3u8 alone would 403 every one of
	 * them. Needs the Stream pull zone's Token Authentication Key
	 * (Settings → Sources & CDN → Bunny.net Stream).
	 */
	private static function sign_bunny_stream( array $source ): array {
		$key = (string) ( \TruePlayer\Helper::get_settings_section( 'bunny' )['tokenKey'] ?? '' );
		if ( '' === $key ) {
			return $source; // not configured — plain playback
		}

		$src = $source['src'] ?? '';
		if ( '' === $src ) {
			$zone = preg_replace( '#^https?://#', '', rtrim( (string) ( $source['pullZone'] ?? '' ), '/' ) );
			$src  = 'https://' . $zone . '/' . ( $source['videoId'] ?? '' ) . '/playlist.m3u8';
		}

		$signed = self::sign_bunny_url( $src, $key, true );
		if ( '' !== $signed ) {
			$source['src'] = $signed;
		}
		return $source;
	}

	/**
	 * Bunny Storage: a plain file behind a pull zone. Uses that pull zone's own
	 * Token Authentication Key — a different zone and a different key from
	 * Stream's, which is why they are configured separately.
	 *
	 * A single file is signed by its exact path, so the token unlocks that
	 * video and nothing else. Only an .m3u8 falls back to directory mode, and
	 * only because its segments are separate requests that must validate too —
	 * which does mean a token for one playlist covers its whole folder, so
	 * manifests are best kept one per directory.
	 */
	private static function sign_bunny_storage( array $source ): array {
		$storage = \TruePlayer\Helper::get_settings_section( 'bunny' )['storage'] ?? [];
		$key     = is_array( $storage ) ? (string) ( $storage['tokenKey'] ?? '' ) : '';
		$src     = (string) ( $source['src'] ?? '' );
		if ( '' === $key || '' === $src ) {
			return $source; // not configured — plain playback
		}

		$is_manifest = (bool) preg_match( '/\.m3u8($|\?)/i', $src );
		$signed      = self::sign_bunny_url( $src, $key, $is_manifest );
		if ( '' !== $signed ) {
			$source['src'] = $signed;
		}
		return $source;
	}

	/**
	 * Append Bunny CDN Token Authentication to a URL.
	 *
	 * Bunny hashes `key + path + expiry`, where `path` is either the exact URL
	 * path or a directory prefix. Directory mode has to declare that prefix
	 * back to the CDN in `token_path`; path mode must NOT send it, or Bunny
	 * validates against a different string than the one that was signed.
	 *
	 * @param string $src       Absolute URL to sign.
	 * @param string $key       The pull zone's Token Authentication Key.
	 * @param bool   $directory Cover the whole directory rather than one file.
	 * @return string The signed URL, or '' if the URL had no usable path.
	 */
	private static function sign_bunny_url( string $src, string $key, bool $directory ): string {
		$path = wp_parse_url( $src, PHP_URL_PATH );
		if ( ! $path ) {
			return '';
		}

		$signed_path = $directory ? rtrim( dirname( $path ), '/' ) . '/' : $path;
		$expires     = time() + self::ttl();
		$token       = strtr(
			rtrim( base64_encode( hash( 'sha256', $key . $signed_path . $expires, true ) ), '=' ),
			'+/',
			'-_'
		);

		$args = [ 'token' => $token, 'expires' => $expires ];
		if ( $directory ) {
			$args['token_path'] = rawurlencode( $signed_path );
		}
		return add_query_arg( $args, $src );
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
