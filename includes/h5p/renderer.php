<?php

namespace TruePlayer\H5P;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Frontend renderer for H5P-authored items — the counterpart to the native
 * player's markup in Shortcode::render.
 *
 * Resolves the video's linked H5P content id (stored in the
 * `_trueplayer_h5p_content_id` post meta), loads the content through H5PCore,
 * and hands it to Assets to enqueue the runtime and emit the mount node that
 * H5P's own `h5p.js` boots.
 */
class Renderer {

	/** Post meta on a `tp_video` linking it to its H5P content row. */
	const CONTENT_META = '_trueplayer_h5p_content_id';

	/**
	 * @param int $video_id
	 * @return string
	 */
	public static function render( int $video_id ): string {
		if ( ! Module::is_available() ) {
			return '';
		}

		$content_id = (int) get_post_meta( $video_id, self::CONTENT_META, true );
		if ( ! $content_id ) {
			return self::notice( __( 'This interactive content has not been built yet.', 'trueplayer' ) );
		}

		$core    = Core::core();
		$content = $core->loadContent( $content_id );
		if ( ! $content ) {
			return self::notice( __( 'Interactive content could not be loaded.', 'trueplayer' ) );
		}
		$content['id'] = $content_id;

		return '<div class="trueplayer-h5p tp-v' . (int) $video_id . '">' . Assets::add_content( $content ) . '</div>';
	}

	/**
	 * Author-facing inline notice (only shown to users who can edit).
	 *
	 * @param string $message
	 * @return string
	 */
	private static function notice( string $message ): string {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return '';
		}
		return '<div class="trueplayer-h5p-notice" style="padding:1em;border:1px dashed #d0d5dd;border-radius:8px;color:#667085;font-size:14px">' . esc_html( $message ) . '</div>';
	}
}
