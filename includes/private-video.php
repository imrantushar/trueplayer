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
		} elseif ( 'gumlet' === $type || 'gumletStorage' === $type ) {
			// One branch for both: they are two ways of getting a video into
			// Gumlet, not two things to serve it from.
			$config['source'] = self::sign_gumlet( $config['source'] );
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
	 * Gumlet: a signed playback URL, when the workspace has signed URLs on.
	 *
	 * The source may still be holding only an asset id at this point if it was
	 * saved mid-transcode, so the URL is resolved the same way the render
	 * pipeline does before there is anything to sign.
	 */
	private static function sign_gumlet( array $source ): array {
		$secret = (string) ( \TruePlayer\Services\GumletVideo::config()['signSecret'] ?? '' );
		$src    = (string) ( $source['src'] ?? '' );
		if ( '' === $src ) {
			$src = \TruePlayer\Services\GumletVideo::playback_url( (string) ( $source['assetId'] ?? '' ) );
		}
		// Nothing to sign, or nothing to sign it with: either way the source is
		// returned untouched so playback falls back to plain rather than to a
		// URL carrying a token nobody can verify.
		if ( '' === $src || '' === $secret ) {
			return $source;
		}

		$expires = time() + self::ttl();
		$signed  = self::gumlet_token_url( $src, $secret, $expires );
		if ( '' !== $signed ) {
			$source['src'] = $signed;
			// Reserved for the case where Gumlet's token does not carry over to
			// the manifest's child segments. hls.js fetches each .ts itself and
			// this plugin passes it no request hook today, so if segments come
			// back 403 the fix is to read this in providers/html5.js and append
			// it per request. Empty until that is known to be needed.
			$source['hlsQuery'] = '';
		}
		return $source;
	}

	/**
	 * Append Gumlet's signed-URL token to a playback URL.
	 *
	 * The whole of Gumlet's signing scheme lives in this one method, because it
	 * is the part of the integration that could not be confirmed from public
	 * documentation. Everything around it — when to sign, what to sign, how
	 * long for — is settled; only the recipe is provisional. Confining it here
	 * (and exposing the filter below) means correcting it is a single change
	 * that needs no other part of the integration revisited, and can be proven
	 * against a live account from a mu-plugin before it is committed.
	 *
	 * @param string $src     Absolute playback URL.
	 * @param string $secret  The workspace's signing secret (16-byte hex).
	 * @param int    $expires Unix timestamp the link stops working at.
	 * @return string The signed URL, or '' if the URL had no usable path.
	 */
	private static function gumlet_token_url( string $src, string $secret, int $expires ): string {
		$path = wp_parse_url( $src, PHP_URL_PATH );
		if ( ! $path ) {
			return '';
		}

		// Documented as a 16-byte hex secret, so the bytes it encodes are what
		// gets keyed. A value that isn't valid hex is used verbatim rather than
		// mangled — a mistyped secret should fail to authenticate, not fatal.
		$key = ( ctype_xdigit( $secret ) && 0 === strlen( $secret ) % 2 )
			? (string) hex2bin( $secret )
			: $secret;

		$token = hash_hmac( 'sha256', $path . $expires, $key );
		$url   = add_query_arg( [ 'token' => $token, 'expires' => $expires ], $src );

		/**
		 * Override the signed-URL recipe without editing the plugin.
		 *
		 * @param string $url     The signed URL as built above.
		 * @param string $src     The unsigned playback URL.
		 * @param int    $expires Expiry timestamp.
		 */
		return (string) apply_filters( 'trueplayer/gumlet/signed_url', $url, $src, $expires );
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
