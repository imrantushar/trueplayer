<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Central pro capability gate. "Player free, intelligence pro" — everything
 * that tracks, gates, analyzes, automates, or extends is guarded by Pro::active().
 *
 * active() = the pro plugin is loaded AND the license is valid. The license
 * check is a filter seam the pro plugin's StoreLicense hooks (StoreEngine SDK);
 * until a license is wired it defaults to "pro plugin present".
 */
class Pro {

	/** Pro features and their default gate (all gate on active() in phase A). */
	const FEATURES = [
		'gating',          // watch-verification + quiz-gating + lock
		'analytics',       // dashboard + data collection
		'automation',      // webhooks + integrations + opt-in
		'premium_sources', // bunny / mux / hls / signed
		'playlists',       // grid + sidebar
		'premium_skins',   // floating / ambient + reusable presets
		'layers',          // interactive layers: hotspots / banners / forms / shortcodes
		'protection',      // dynamic watermark + private video / expiring links
		'instant_pages',   // standalone public video pages
		'lms',             // Academy LMS progression sync
	];

	/** Premium source types reserved for pro. */
	const PREMIUM_SOURCES = [ 'bunny', 'mux', 'hls' ];

	/** Skins available only with pro. */
	const PREMIUM_SKINS = [ 'floating', 'ambient' ];

	public static function active(): bool {
		return trueplayer_is_pro_active() && self::license_valid();
	}

	public static function license_valid(): bool {
		/**
		 * The pro plugin's StoreLicense returns the SDK verdict here. Defaults
		 * to true so the split works with just the pro plugin before a license
		 * server is configured.
		 */
		return (bool) apply_filters( 'trueplayer/license_valid', true );
	}

	/** Per-feature gate (room to refine per-addon later). */
	public static function can( string $feature ): bool {
		return self::active();
	}

	public static function is_premium_source( $type ): bool {
		return in_array( $type, self::PREMIUM_SOURCES, true );
	}

	public static function is_premium_skin( $skin ): bool {
		return in_array( $skin, self::PREMIUM_SKINS, true );
	}

	/** Feature-flag map exposed to React + the frontend player. */
	public static function feature_flags(): array {
		$active = self::active();
		$flags  = [];
		foreach ( self::FEATURES as $f ) {
			$flags[ $f ] = $active; // phase A: uniform gate
		}
		return $flags;
	}
}
