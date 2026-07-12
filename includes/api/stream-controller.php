<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\PrivateVideo;
use TruePlayer\Pro;
use WP_REST_Server;

/**
 * GET /trueplayer/v1/stream?video=ID&exp=TS&sig=HMAC — serves a private
 * self-hosted video through a signed, expiring URL (pro). Streams the file
 * with HTTP Range support so seeking works; external-URL sources 302 to the
 * real location instead (the URL still never appears in the page source).
 */
class StreamController {

	public function register_routes() {
		register_rest_route(
			TRUEPLAYER_PLUGIN_SLUG . '/v1',
			'/stream',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'stream' ],
				'permission_callback' => '__return_true', // the signature is the credential
				'args'                => [
					'video' => [ 'type' => 'integer', 'required' => true ],
					'exp'   => [ 'type' => 'integer', 'required' => true ],
					'sig'   => [ 'type' => 'string', 'required' => true ],
				],
			]
		);
	}

	public function stream( $request ) {
		$video_id = (int) $request['video'];
		$expires  = (int) $request['exp'];
		$sig      = (string) $request['sig'];

		if ( ! Pro::active() || ! PrivateVideo::verify( $video_id, $expires, $sig ) ) {
			return new \WP_Error( 'tp_stream_denied', __( 'This link has expired.', 'trueplayer' ), [ 'status' => 403 ] );
		}

		$file = PrivateVideo::resolve_file( $video_id );
		if ( '' === $file ) {
			$url = PrivateVideo::raw_source_url( $video_id );
			if ( $url ) {
				wp_redirect( $url, 302 ); // phpcs:ignore WordPress.Security.SafeRedirect -- external media URL by design
				exit;
			}
			return new \WP_Error( 'tp_stream_missing', __( 'Video file not found.', 'trueplayer' ), [ 'status' => 404 ] );
		}

		$this->send_file( $file );
		exit;
	}

	/**
	 * Minimal Range-aware file sender (single range, the browser norm).
	 * Chunked reads keep memory flat on large files.
	 */
	private function send_file( string $file ): void {
		$size = filesize( $file );
		$type = wp_check_filetype( $file )['type'] ?: 'application/octet-stream';

		$start = 0;
		$end   = $size - 1;
		$range = isset( $_SERVER['HTTP_RANGE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_RANGE'] ) ) : '';

		if ( $range && preg_match( '/bytes=(\d*)-(\d*)/', $range, $m ) ) {
			if ( '' !== $m[1] ) {
				$start = (int) $m[1];
			}
			if ( '' !== $m[2] ) {
				$end = min( (int) $m[2], $size - 1 );
			} elseif ( '' === $m[1] ) {
				$start = max( 0, $size - (int) $m[2] ); // suffix range: bytes=-N
				$end   = $size - 1;
			}
			if ( $start > $end || $start >= $size ) {
				status_header( 416 );
				header( 'Content-Range: bytes */' . $size );
				return;
			}
			status_header( 206 );
			header( 'Content-Range: bytes ' . $start . '-' . $end . '/' . $size );
		} else {
			status_header( 200 );
		}

		header( 'Content-Type: ' . $type );
		header( 'Content-Length: ' . ( $end - $start + 1 ) );
		header( 'Accept-Ranges: bytes' );
		header( 'Cache-Control: private, max-age=0' );

		// Drop any buffered output so headers/bytes go straight through.
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}

		$fh = fopen( $file, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions -- streaming, not FS manipulation
		if ( ! $fh ) {
			return;
		}
		fseek( $fh, $start );
		$remaining = $end - $start + 1;
		while ( $remaining > 0 && ! feof( $fh ) && ! connection_aborted() ) {
			$chunk = fread( $fh, min( 1048576, $remaining ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions
			if ( false === $chunk ) {
				break;
			}
			echo $chunk; // phpcs:ignore WordPress.Security.EscapeOutput -- binary media bytes
			$remaining -= strlen( $chunk );
			flush();
		}
		fclose( $fh ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	}
}
