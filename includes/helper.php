<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Helper {

	/**
	 * Read an addon's active status from the in-memory registry (kept in sync
	 * with the `trueplayer_addons` option by Addons::save_addon_status).
	 */
	public static function get_addon_active_status( $slug ) {
		$addons = isset( $GLOBALS['trueplayer_addons'] ) ? (array) $GLOBALS['trueplayer_addons'] : [];
		return ! empty( $addons[ $slug ] );
	}

	/**
	 * Read a single value from the plugin settings object.
	 */
	public static function get_specific_setting( $key, $default = null ) {
		$settings = isset( $GLOBALS['trueplayer_settings'] ) ? (array) $GLOBALS['trueplayer_settings'] : [];
		return array_key_exists( $key, $settings ) ? $settings[ $key ] : $default;
	}

	/**
	 * One-time rewrite flush, armed via request_rewrite_flush().
	 */
	public static function request_rewrite_flush() {
		update_option( 'trueplayer_flush_rewrite', 'yes' );
	}

	public static function maybe_flush_rewrite_rules() {
		if ( 'yes' === get_option( 'trueplayer_flush_rewrite' ) ) {
			flush_rewrite_rules( false );
			delete_option( 'trueplayer_flush_rewrite' );
		}
	}

	/**
	 * UTC ISO-8601 timestamp used in webhook payloads + log rows.
	 */
	public static function now_iso() {
		return gmdate( 'Y-m-d\TH:i:s\Z' );
	}

	/**
	 * Decode a video's `_trueplayer_config` JSON meta into an array.
	 */
	public static function get_video_config( $video_id ) {
		$raw    = get_post_meta( (int) $video_id, '_trueplayer_config', true );
		$config = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : ( is_array( $raw ) ? $raw : [] );
		if ( ! is_array( $config ) ) {
			$config = [];
		}
		/**
		 * Central seam: pro + Gem integrations mutate the resolved player
		 * config (inject layers, override gating, etc.) without touching core.
		 */
		return apply_filters( 'trueplayer/config', $config, (int) $video_id );
	}

	/** Decode a preset's `_trueplayer_preset` JSON meta into an array. */
	public static function get_preset_config( $preset_id ) {
		$raw = get_post_meta( (int) $preset_id, '_trueplayer_preset', true );
		$cfg = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : ( is_array( $raw ) ? $raw : [] );
		return is_array( $cfg ) ? $cfg : [];
	}

	/**
	 * If a video references a preset (config.presetId), merge the preset's
	 * customize + branding UNDER the video's own settings so per-video values
	 * win. Applied at frontend render only — the admin editor edits the raw
	 * config so authors always see their own overrides.
	 */
	public static function apply_preset( array $config ): array {
		$preset_id = isset( $config['presetId'] ) ? (int) $config['presetId'] : 0;
		if ( ! $preset_id || get_post_type( $preset_id ) !== TRUEPLAYER_PRESET_POST_TYPE ) {
			return $config;
		}
		$preset = self::get_preset_config( $preset_id );
		if ( ! empty( $preset['customize'] ) && is_array( $preset['customize'] ) ) {
			$over               = isset( $config['customize'] ) && is_array( $config['customize'] ) ? $config['customize'] : [];
			$config['customize'] = self::deep_merge( $preset['customize'], $over );
		}
		if ( ! empty( $preset['branding'] ) && is_array( $preset['branding'] ) ) {
			$over               = isset( $config['branding'] ) && is_array( $config['branding'] ) ? $config['branding'] : [];
			$config['branding'] = array_merge( $preset['branding'], $over );
		}
		return $config;
	}

	/**
	 * Clamp pro-only config to free-safe values when pro isn't active. Runs at
	 * frontend render, after apply_preset, so a preset can't smuggle premium
	 * options past the gate either.
	 */
	public static function enforce_pro_limits( array $config ): array {
		if ( Pro::active() ) {
			return $config;
		}
		$skin = $config['customize']['appearance']['skin'] ?? '';
		if ( $skin && Pro::is_premium_skin( $skin ) ) {
			$config['customize']['appearance']['skin'] = 'default';
		}
		// Pro-only config never reaches the free frontend.
		unset( $config['layers'], $config['protection'] );
		return $config;
	}

	/** Recursive array merge where $over wins; list (numeric) arrays are replaced. */
	private static function deep_merge( array $base, array $over ): array {
		foreach ( $over as $k => $v ) {
			if ( is_array( $v ) && isset( $base[ $k ] ) && is_array( $base[ $k ] ) && ! self::is_list( $v ) ) {
				$base[ $k ] = self::deep_merge( $base[ $k ], $v );
			} else {
				$base[ $k ] = $v;
			}
		}
		return $base;
	}

	private static function is_list( array $a ): bool {
		return array_keys( $a ) === range( 0, count( $a ) - 1 );
	}
}
