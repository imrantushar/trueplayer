<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Private video / expiring links (pro). A self-hosted file is served through a
 * signed, short-lived REST stream URL instead of its real attachment URL, so
 * the raw source never reaches the DOM.
 *
 * That is the only scheme core implements. Every CDN signs differently, and
 * each of those schemes lives with the addon that talks to that CDN — reached
 * through the `trueplayer/private_video/sign` filter below.
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
			return $config;
		}

		/**
		 * Sign a source served by somebody else's CDN.
		 *
		 * Core knows how to sign its own files and nothing more — every CDN has
		 * its own token scheme, and those live with the code that talks to that
		 * CDN (Pro's source addons). A type nobody claims is returned untouched
		 * and plays unsigned, which is the correct outcome for a provider this
		 * install has no integration for.
		 *
		 * @param array  $source   The resolved source, to be returned modified.
		 * @param string $type     The source type being signed.
		 * @param int    $video_id The video being rendered.
		 */
		$config['source'] = (array) apply_filters( 'trueplayer/private_video/sign', $config['source'], $type, $video_id );

		return $config;
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
