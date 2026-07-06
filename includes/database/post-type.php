<?php

namespace TruePlayer\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the two configuration CPTs:
 *   - trueplayer_video  (tp_video):  one configured player instance
 *   - trueplayer_preset (tp_preset): reusable skin/behaviour presets
 *
 * Both are admin-managed via the React SPA (show_ui false) and exposed to REST
 * for the SPA + block editor. Transactional data (watch progress, quiz
 * attempts) lives in the custom tables, not here.
 */
class PostType {

	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'register_post_types' ] );
	}

	public function register_post_types() {
		register_post_type(
			TRUEPLAYER_VIDEO_POST_TYPE,
			[
				'label'               => __( 'Videos', 'trueplayer' ),
				'public'              => false,
				'show_ui'             => false,
				'show_in_menu'        => false,
				'show_in_rest'        => true,
				'rest_base'           => 'videos',
				'supports'            => [ 'title', 'author', 'custom-fields' ],
				'capability_type'     => 'post',
				'map_meta_cap'        => true,
				'exclude_from_search' => true,
			]
		);

		register_post_type(
			TRUEPLAYER_PRESET_POST_TYPE,
			[
				'label'               => __( 'Player Presets', 'trueplayer' ),
				'public'              => false,
				'show_ui'             => false,
				'show_in_menu'        => false,
				'show_in_rest'        => true,
				'rest_base'           => 'presets',
				'supports'            => [ 'title', 'custom-fields' ],
				'capability_type'     => 'post',
				'map_meta_cap'        => true,
				'exclude_from_search' => true,
			]
		);
	}
}
