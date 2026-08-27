<?php

namespace TruePlayerInteractive;

use TruePlayer\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * H5P engine bootstrap.
 *
 * TruePlayer ships two independent rendering engines behind one plugin:
 *
 *   - native : the built-in React player (source/overlays/gating/analytics).
 *   - h5p    : interactive content rendered by the bundled H5P runtime, with
 *              its own authoring UI generated from each content type's
 *              `semantics.json` (styled with the same admin component kit, so
 *              it looks like the rest of TruePlayer).
 *
 * The two engines never share storage or a runtime. They only share the admin
 * shell above them and the services below them (analytics, webhooks, CRM, LMS
 * completion) — H5P's xAPI statements are normalised into the same event
 * pipeline the native player already feeds.
 *
 * This module is the *router primitive*: it decides which engine owns a given
 * video and stays completely dormant until the H5P runtime is present, so the
 * native player is never affected by its existence.
 */
class Module {

	/**
	 * Engine identifiers, also the values stored in the `_trueplayer_engine`
	 * post meta.
	 */
	const ENGINE_NATIVE = 'native';
	const ENGINE_H5P    = 'h5p';

	/** Post meta key; core owns it (see Database\MetaManager::ENGINE_META). */
	const ENGINE_META = \TruePlayer\Database\MetaManager::ENGINE_META;

	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'boot' ], 20 );
	}

	/**
	 * Wire up the engine only once the runtime is actually vendored. Until then
	 * `h5p` is an unavailable engine: the Library screen won't offer it and the
	 * frontend router will fall through to native, so an install without the
	 * runtime behaves exactly as it does today.
	 */
	public function boot() {
		if ( ! self::is_available() ) {
			return;
		}

		// Isolated live-preview page for the builder.
		Preview::init();

		// Save & resume + finished-attempt endpoints for the runtime.
		UserData::init();
	}

	/**
	 * Is the runtime present in this build? This is "could be switched on",
	 * not "is on" — the admin needs the difference to offer activation rather
	 * than hiding interactive content entirely.
	 *
	 * @return bool
	 */
	public static function is_installed(): bool {
		return is_dir( self::runtime_dir() );
	}

	/** Has the site switched the addon on? */
	public static function is_enabled(): bool {
		return (bool) Helper::get_addon_active_status( Interactive::ADDON_SLUG );
	}

	/**
	 * Is the H5P engine usable right now — runtime bundled *and* the addon
	 * switched on? Everything that renders, routes or authors interactive
	 * content hangs off this, so a site that never enables it behaves exactly
	 * as if the engine did not exist. Filterable to force it off without
	 * deleting files.
	 *
	 * @return bool
	 */
	public static function is_available(): bool {
		$available = self::is_installed() && self::is_enabled();
		return (bool) apply_filters( 'trueplayer/h5p/available', $available );
	}

	/**
	 * Absolute path to the vendored H5P runtime (core PHP + JS). Populated when
	 * the runtime is added; absent on a fresh checkout, which is what keeps the
	 * engine dormant.
	 *
	 * @return string
	 */
	public static function runtime_dir(): string {
		return TRUEPLAYER_INTERACTIVE_ADDON_PATH . 'runtime';
	}

	/**
	 * Which engine renders this video. Reads the dedicated meta and falls back
	 * to native for absent/unknown values or when the H5P runtime is missing.
	 *
	 * @param int $video_id
	 * @return string One of the ENGINE_* constants.
	 */
	public static function engine_of( int $video_id ): string {
		$engine = get_post_meta( $video_id, self::ENGINE_META, true );
		if ( self::ENGINE_H5P === $engine && self::is_available() ) {
			return self::ENGINE_H5P;
		}
		return self::ENGINE_NATIVE;
	}

	/**
	 * Convenience predicate for the frontend router.
	 *
	 * @param int $video_id
	 * @return bool
	 */
	public static function is_h5p( int $video_id ): bool {
		return self::ENGINE_H5P === self::engine_of( $video_id );
	}

	/**
	 * Was this item *authored* as interactive content, regardless of whether the
	 * engine can run right now?
	 *
	 * `engine_of()` deliberately falls back to native when the engine is
	 * unavailable, which is right for routing but wrong for an item that has no
	 * video source at all — it would render as an empty, broken player. The
	 * frontend uses this to say so instead.
	 *
	 * @param int $video_id
	 * @return bool
	 */
	public static function is_h5p_authored( int $video_id ): bool {
		return self::ENGINE_H5P === get_post_meta( $video_id, self::ENGINE_META, true );
	}
}
