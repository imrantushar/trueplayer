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

	/**
	 * Which engine renders an item. Core owns this key even though only addons
	 * set anything other than the default: core has to be able to tell its own
	 * players apart from items another engine authored.
	 */
	const ENGINE_META = '_trueplayer_engine';


	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'register_meta_fields' ] );
	}

	public function register_meta_fields() {
		register_post_meta(
			TRUEPLAYER_VIDEO_POST_TYPE,
			'_trueplayer_config',
			[
				'type'              => 'string',
				'single'            => true,
				'sanitize_callback' => [ __CLASS__, 'sanitize_json_meta' ],
				'show_in_rest'  => true,
				'auth_callback' => [ __CLASS__, 'can_manage_meta' ],
			]
		);

		// Rendering engine for this item: 'native' (default — TruePlayer's own
		// player) or another engine an add-on registers (see the
		// `trueplayer/render_engine` filter). A dedicated, queryable meta so the
		// library and the frontend router can branch without decoding the whole
		// JSON blob. Absent meta reads as 'native'.
		register_post_meta(
			TRUEPLAYER_VIDEO_POST_TYPE,
			'_trueplayer_engine',
			[
				'type'          => 'string',
				'single'        => true,
				'default'           => 'native',
				'sanitize_callback' => 'sanitize_key',
				'show_in_rest'  => true,
				'auth_callback' => [ __CLASS__, 'can_manage_meta' ],
			]
		);

		register_post_meta(
			TRUEPLAYER_PRESET_POST_TYPE,
			'_trueplayer_preset',
			[
				'type'              => 'string',
				'single'            => true,
				'sanitize_callback' => [ __CLASS__, 'sanitize_json_meta' ],
				'show_in_rest'  => true,
				'auth_callback' => [ __CLASS__, 'can_manage_meta' ],
			]
		);

		/**
		 * Whether a preset styles the video player or the audio one.
		 *
		 * A dedicated meta rather than a key inside `_trueplayer_preset` for two
		 * reasons. Everything in that blob is merge payload — Helper::apply_preset
		 * folds it onto a video — and a preset's own classification must never be
		 * something a video can inherit. And it is queryable without decoding
		 * JSON, the same reasoning ENGINE_META documents above.
		 *
		 * The registered default is what makes this free of any migration: every
		 * preset that existed before audio reads as 'video' with no rows written.
		 */
		register_post_meta(
			TRUEPLAYER_PRESET_POST_TYPE,
			'_trueplayer_preset_type',
			[
				'type'          => 'string',
				'single'        => true,
				'default'           => 'video',
				'sanitize_callback' => [ __CLASS__, 'sanitize_preset_type' ],
				'show_in_rest'  => true,
				'auth_callback' => [ __CLASS__, 'can_manage_meta' ],
			]
		);
	}

	/**
	 * Who may write this plugin's meta through core's REST API.
	 *
	 * The config holds layers, gating and other content that only the admin app
	 * is meant to author; editors reach the narrower quick-create route instead.
	 * Gating the meta on `edit_posts` would let any author bypass that.
	 */
	public static function can_manage_meta(): bool {
		return current_user_can( 'manage_options' );
	}

	/** A preset is either an audio or a video preset; anything else is video. */
	public static function sanitize_preset_type( $value ): string {
		return 'audio' === $value ? 'audio' : 'video';
	}

	/**
	 * Validate style values in a JSON config written through the REST meta API.
	 *
	 * @param mixed $value Raw (JSON string) meta value.
	 * @return mixed
	 */
	public static function sanitize_json_meta( $value ) {
		if ( ! is_string( $value ) || '' === $value ) {
			return $value;
		}
		$data = json_decode( $value, true );
		if ( ! is_array( $data ) ) {
			return $value;
		}
		return wp_json_encode( \TruePlayer\Helper::sanitize_style_values( $data ) );
	}
}
