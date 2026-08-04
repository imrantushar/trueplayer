<?php

namespace TruePlayer\H5P;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Isolated live-preview page for the builder.
 *
 * `?trueplayer_h5p_preview=<video>` renders just the H5P content on a minimal,
 * theme-free page so the admin builder can show it in an iframe that reloads on
 * each (debounced) save. Editor-only.
 */
class Preview {

	const QUERY_VAR = 'trueplayer_h5p_preview';

	public static function init() {
		$self = new self();
		add_action( 'template_redirect', [ $self, 'maybe_render' ] );
	}

	/**
	 * Build the preview URL for a video.
	 *
	 * @param int $video_id
	 * @return string
	 */
	public static function url( int $video_id ): string {
		return add_query_arg( self::QUERY_VAR, $video_id, home_url( '/' ) );
	}

	public function maybe_render() {
		if ( ! isset( $_GET[ self::QUERY_VAR ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		$video_id = (int) $_GET[ self::QUERY_VAR ]; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		if ( ! current_user_can( 'edit_posts' ) ) {
			status_header( 403 );
			exit;
		}
		if ( ! $video_id || get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			status_header( 404 );
			exit;
		}

		nocache_headers();
		$markup = Module::is_h5p( $video_id ) ? do_shortcode( sprintf( '[trueplayer id="%d"]', $video_id ) ) : '';

		// Minimal, theme-free document. H5P core + library assets and the
		// H5PIntegration global are all footer-enqueued by H5P\Assets, so a
		// single wp_footer() flushes everything the runtime needs — no wp_head,
		// so the theme's styles never bleed into the preview.
		header( 'Content-Type: text/html; charset=utf-8' );
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
		echo '<style>html,body{margin:0;padding:16px;background:#fff;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.trueplayer-h5p-notice{display:none}</style>';
		echo '</head><body>';
		echo $markup; // already escaped/built by the renderer + H5P. phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		if ( '' === trim( wp_strip_all_tags( $markup ) ) && '' === trim( $markup ) ) {
			echo '<p style="color:#9ca3af">Nothing to preview yet.</p>';
		}
		do_action( 'wp_footer' );
		echo '</body></html>';
		exit;
	}
}
