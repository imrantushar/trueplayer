<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * White-label (pro). When enabled in settings, replaces the "TruePlayer" name
 * across the admin with the site owner's brand and hides the player's
 * "Powered by" attribution. Gated on Pro::active().
 *
 * Settings shape: settings.whiteLabel = { enabled: bool, brand: string }.
 */
class WhiteLabel {

	public static function init(): void {
		if ( ! Pro::active() ) {
			return;
		}
		$settings = json_decode( (string) get_option( TRUEPLAYER_SETTINGS_NAME, '{}' ), true );
		$wl       = is_array( $settings['whiteLabel'] ?? null ) ? $settings['whiteLabel'] : [];
		if ( empty( $wl['enabled'] ) ) {
			return;
		}

		$brand = trim( (string) ( $wl['brand'] ?? '' ) );
		if ( '' !== $brand ) {
			add_filter( 'trueplayer/brand_name', static function () use ( $brand ) {
				return $brand;
			} );
		}

		// Suppress the frontend "Powered by" attribution when white-labelled.
		add_filter( 'trueplayer/show_attribution', '__return_false' );
	}
}
