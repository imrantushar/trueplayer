<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Server;

/**
 * POST /trueplayer/v1/subtitles/youtube-import  { src, lang } (admin, pro)
 *
 * Best-effort YouTube caption import: fetches the public timedtext track,
 * converts it to WebVTT, stores it in the media library, and returns the URL
 * so it can be attached as a subtitle track. YouTube only exposes captions for
 * videos whose owner published them; auto-captions are frequently unavailable,
 * so a clean "no captions" response is expected, not an error.
 */
class SubtitlesController {

	public function register_routes() {
		register_rest_route(
			TRUEPLAYER_PLUGIN_SLUG . '/v1',
			'/subtitles/youtube-import',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'youtube_import' ],
				'permission_callback' => [ $this, 'admin' ],
				'args'                => [
					'src'  => [ 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ],
					'lang' => [ 'sanitize_callback' => 'sanitize_text_field', 'default' => 'en' ],
				],
			]
		);
	}

	public function admin() {
		return current_user_can( 'manage_options' ) && \TruePlayer\Pro::active();
	}

	public function youtube_import( $request ) {
		$vid  = self::youtube_id( (string) $request->get_param( 'src' ) );
		$lang = sanitize_text_field( (string) $request->get_param( 'lang' ) ) ?: 'en';
		if ( ! $vid ) {
			return new \WP_Error( 'bad_source', __( 'Not a valid YouTube URL or ID.', 'trueplayer' ), [ 'status' => 400 ] );
		}

		$xml = self::fetch_timedtext( $vid, $lang );
		if ( '' === $xml ) {
			return rest_ensure_response( [ 'ok' => false, 'message' => __( 'No public captions found for this video.', 'trueplayer' ) ] );
		}

		$vtt = self::xml_to_vtt( $xml );
		if ( '' === $vtt ) {
			return rest_ensure_response( [ 'ok' => false, 'message' => __( 'Captions could not be parsed.', 'trueplayer' ) ] );
		}

		$upload = wp_upload_bits( 'youtube-' . $vid . '-' . $lang . '.vtt', null, $vtt );
		if ( ! empty( $upload['error'] ) ) {
			return new \WP_Error( 'upload_failed', $upload['error'], [ 'status' => 500 ] );
		}

		return rest_ensure_response( [
			'ok'      => true,
			'url'     => $upload['url'],
			'label'   => strtoupper( $lang ) . ' (YouTube)',
			'srclang' => $lang,
		] );
	}

	private static function fetch_timedtext( string $vid, string $lang ): string {
		$urls = [
			add_query_arg( [ 'lang' => $lang, 'v' => $vid ], 'https://www.youtube.com/api/timedtext' ),
			add_query_arg( [ 'lang' => $lang, 'v' => $vid, 'kind' => 'asr' ], 'https://www.youtube.com/api/timedtext' ),
		];
		foreach ( $urls as $url ) {
			$res = wp_remote_get( $url, [ 'timeout' => 12, 'user-agent' => 'Mozilla/5.0' ] );
			if ( is_wp_error( $res ) ) {
				continue;
			}
			$body = (string) wp_remote_retrieve_body( $res );
			if ( '' !== trim( $body ) && false !== strpos( $body, '<text' ) ) {
				return $body;
			}
		}
		return '';
	}

	/** Convert YouTube timedtext XML to WebVTT. */
	private static function xml_to_vtt( string $xml ): string {
		$prev = libxml_use_internal_errors( true );
		$doc  = simplexml_load_string( $xml );
		libxml_use_internal_errors( $prev );
		if ( ! $doc || ! isset( $doc->text ) ) {
			return '';
		}

		$lines = [ 'WEBVTT', '' ];
		foreach ( $doc->text as $node ) {
			$start = (float) $node['start'];
			$dur   = (float) ( $node['dur'] ?? 2 );
			$text  = html_entity_decode( wp_strip_all_tags( (string) $node ), ENT_QUOTES, 'UTF-8' );
			if ( '' === trim( $text ) ) {
				continue;
			}
			$lines[] = self::ts( $start ) . ' --> ' . self::ts( $start + $dur );
			$lines[] = $text;
			$lines[] = '';
		}
		return count( $lines ) > 2 ? implode( "\n", $lines ) : '';
	}

	private static function ts( float $seconds ): string {
		$h = floor( $seconds / 3600 );
		$m = floor( ( $seconds - $h * 3600 ) / 60 );
		$s = $seconds - $h * 3600 - $m * 60;
		return sprintf( '%02d:%02d:%06.3f', $h, $m, $s );
	}

	private static function youtube_id( string $src ): string {
		$src = trim( $src );
		if ( preg_match( '/^[A-Za-z0-9_-]{11}$/', $src ) ) {
			return $src;
		}
		if ( preg_match( '~(?:youtu\.be/|v=|/embed/|/shorts/)([A-Za-z0-9_-]{11})~', $src, $m ) ) {
			return $m[1];
		}
		return '';
	}
}
