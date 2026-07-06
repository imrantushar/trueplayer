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
}
