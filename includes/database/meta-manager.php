<?php

namespace TruePlayer\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the single `_trueplayer_config` JSON meta on the video CPT (and a
 * `_trueplayer_preset` blob on the preset CPT) and exposes them to REST so the
 * admin SPA can read/write the whole player config in one field.
 *
 * The config is stored as a JSON string; it holds source, poster, presetId,
 * branding, controls, chapters[], subtitles[], gating{} and webhooks[].
 */
class MetaManager {

	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'register_meta_fields' ] );
	}

	public function register_meta_fields() {
		register_post_meta(
			TRUEPLAYER_VIDEO_POST_TYPE,
			'_trueplayer_config',
			[
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			]
		);

		// Rendering engine for this item: 'native' (default — TruePlayer's own
		// player) or 'h5p' (rendered by the bundled H5P runtime). A dedicated,
		// queryable meta rather than a key inside `_trueplayer_config` so the
		// Library screen and the frontend router can branch without decoding
		// the whole JSON blob. Absent meta reads as 'native'.
		register_post_meta(
			TRUEPLAYER_VIDEO_POST_TYPE,
			'_trueplayer_engine',
			[
				'type'          => 'string',
				'single'        => true,
				'default'       => 'native',
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			]
		);

		// Links an H5P-engine video to its row in the H5P `contents` table. Only
		// meaningful when `_trueplayer_engine` is `h5p`.
		register_post_meta(
			TRUEPLAYER_VIDEO_POST_TYPE,
			'_trueplayer_h5p_content_id',
			[
				'type'          => 'integer',
				'single'        => true,
				'default'       => 0,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			]
		);

		register_post_meta(
			TRUEPLAYER_PRESET_POST_TYPE,
			'_trueplayer_preset',
			[
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			]
		);
	}
}
