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

		// The preview is for authoring, not learning: resuming the author's own
		// half-finished attempt across reloads would show stale answers over the
		// content they're editing, and reporting it would pollute their results.
		add_filter( 'trueplayer/h5p/save_freq', '__return_false' );
		add_filter( 'trueplayer/h5p/track_user', '__return_false' );

		$markup = Module::is_h5p( $video_id ) ? do_shortcode( sprintf( '[trueplayer id="%d"]', $video_id ) ) : '';

		// Minimal, theme-free document. H5P core + library assets and the
		// H5PIntegration global are all footer-enqueued by H5P\Assets, so flushing
		// just those gives the runtime everything it needs — no wp_head, so the
		// theme's styles never bleed into the preview.
		header( 'Content-Type: text/html; charset=utf-8' );
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
		echo '<style>html,body{margin:0;padding:16px;background:#fff;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.trueplayer-h5p-notice{display:none}</style>';
		echo '</head><body>';

		// A freshly created item still has empty required fields, which makes
		// the H5P runtime throw while trying to mount an incomplete runnable
		// (and its own error() helper then crashes logging that error — BUG-4).
		// Attached before any H5P script runs, so it catches that and degrades
		// to a placeholder instead of an uncaught exception + a blank panel.
		echo '<script>(function(){
			var shown=false;
			function fallback(){
				if(shown)return; shown=true;
				var root=document.getElementById("tp-h5p-preview-root");
				if(root)root.style.display="none";
				var msg=document.getElementById("tp-h5p-preview-fallback");
				if(msg)msg.style.display="block";
			}
			window.addEventListener("error",function(e){fallback();e.preventDefault();},true);
			window.addEventListener("unhandledrejection",function(){fallback();});
		})();</script>';

		echo '<div id="tp-h5p-preview-root">';
		echo $markup; // already escaped/built by the renderer + H5P. phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo '</div>';
		$empty = '' === trim( wp_strip_all_tags( $markup ) ) && '' === trim( $markup );
		echo '<p id="tp-h5p-preview-fallback" style="display:' . ( $empty ? 'block' : 'none' ) . ';color:#9ca3af">'
			. ( $empty ? esc_html__( 'Nothing to preview yet.', 'trueplayer' ) : esc_html__( 'Fill in the required fields to preview.', 'trueplayer' ) )
			. '</p>';
		// Flush only the H5P runtime's own footer output — its H5PIntegration
		// global (+ style links) and the footer-enqueued core/library scripts —
		// rather than firing the site-wide wp_footer. Running the full wp_footer
		// stack would execute every unrelated theme/plugin/core footer callback
		// (e.g. the block-template skip link), whose markup — and any PHP
		// deprecation notices under WP_DEBUG_DISPLAY — would bleed into this
		// isolated preview document.
		Assets::print_settings();
		wp_print_footer_scripts();
		echo '</body></html>';
		exit;
	}
}
