<?php

namespace TruePlayerInteractive;

use TruePlayer\Helper;
use TruePlayer\Interfaces\AddonInterface;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Interactive content addon — the H5P rendering engine.
 *
 * Most sites only ever embed video, so this is opt-in: off until someone turns
 * it on under Settings → Addons, and switching it on is what creates the eight
 * `tp_h5p_*` tables. An install that never wants quizzes never carries their
 * schema, never loads the runtime, and never sees the section in the library.
 *
 * Core knows nothing about H5P. Everything this addon contributes goes through
 * published seams — the frontend engine router, the schema sync, the addon
 * registry and the localized admin data — so removing the directory removes
 * the feature cleanly.
 *
 * The vendored H5P runtime lives beside this file under `runtime/`; it is a
 * third-party GPL-3 library and is never edited, only wired up (see Core).
 */
final class Interactive implements AddonInterface {

	const ADDON_SLUG = 'interactive';

	private function __construct() {
		$this->define_constants();

		// Registered whatever the status, so the addon can be discovered,
		// described and switched on. Everything that *does* something is gated
		// on is_enabled() inside init_addon().
		add_action( 'trueplayer/addons/activated_' . self::ADDON_SLUG, [ $this, 'addon_activation_hook' ] );
		add_filter( 'trueplayer/addons/can_activate_' . self::ADDON_SLUG, [ __CLASS__, 'can_activate' ] );
		add_filter( 'trueplayer/addons/registry', [ __CLASS__, 'describe' ] );
		add_filter( 'trueplayer/assets/backend_scripts_data', [ __CLASS__, 'expose_state' ] );

		$this->init_addon();
	}

	public static function init() {
		static $instance = false;
		if ( ! $instance ) {
			$instance = new self();
		}
		return $instance;
	}

	public function define_constants() {
		if ( ! defined( 'TRUEPLAYER_INTERACTIVE_ADDON_PATH' ) ) {
			define( 'TRUEPLAYER_INTERACTIVE_ADDON_PATH', TRUEPLAYER_ROOT_DIR_PATH . 'addons/' . self::ADDON_SLUG . '/' );
		}
		if ( ! defined( 'TRUEPLAYER_INTERACTIVE_ADDON_URI' ) ) {
			define( 'TRUEPLAYER_INTERACTIVE_ADDON_URI', TRUEPLAYER_PLUGIN_ROOT_URI . 'addons/' . self::ADDON_SLUG . '/' );
		}
	}

	public function init_addon() {
		// Keep the engine's schema in step on a version bump, but only where the
		// addon is on — core's installer no longer knows these tables exist.
		add_action( 'trueplayer/database/sync_schema', [ __CLASS__, 'sync_schema' ] );

		if ( ! Module::is_available() ) {
			return;
		}

		Module::init();
		API\Controller::init();

		// The frontend engine router: core asks who renders this item, and only
		// an interactive item gets an answer.
		add_filter( 'trueplayer/render_engine', [ __CLASS__, 'render_engine' ], 10, 2 );
	}

	/**
	 * Switching the addon on installs its schema — nothing exists until then.
	 * Switching it off deliberately leaves the tables alone: an author who
	 * disables interactive content for a while must not lose what they built.
	 */
	public function addon_activation_hook() {
		self::create_tables();
	}

	/** @param string|null $prefix Unused; the action passes the table prefix. */
	public static function sync_schema( $prefix = null ) {
		if ( Module::is_enabled() ) {
			self::create_tables();
		}
	}

	private static function create_tables(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		Database\CreateTables::up( $wpdb->prefix, $wpdb->get_charset_collate() );
	}

	/**
	 * Refuse activation where the runtime isn't bundled — the addon would switch
	 * on, create tables, and still have nothing to render.
	 *
	 * @param mixed $can Incoming verdict (true, or a WP_Error from another gate).
	 * @return mixed
	 */
	public static function can_activate( $can ) {
		if ( true !== $can ) {
			return $can;
		}
		return Module::is_installed()
			? true
			: new \WP_Error(
				'interactive_runtime_missing',
				__( 'The interactive content runtime is not bundled in this build.', 'trueplayer' )
			);
	}

	/**
	 * Describe this addon for the Settings → Addons screen. Every addon adds its
	 * own entry, so the screen needs no knowledge of what exists.
	 *
	 * @param array $addons Registry collected so far.
	 * @return array
	 */
	public static function describe( $addons ) {
		$addons[] = [
			'slug'        => self::ADDON_SLUG,
			'label'       => __( 'Interactive content', 'trueplayer' ),
			'description' => __( 'Quizzes, flashcards, fill in the blanks and other interactive activities, embedded with a shortcode like any other player. Results feed the same analytics, webhooks and LMS pipeline as video.', 'trueplayer' ),
			'icon'        => 'spark',
			'active'      => Module::is_enabled(),
			'installed'   => Module::is_installed(),
			'note'        => __( 'Enabling adds the interactive engine’s tables to your database. Turning it back off leaves anything you’ve built untouched.', 'trueplayer' ),
		];
		return $addons;
	}

	/**
	 * Two different questions the admin needs answered: can this build do
	 * interactive content at all, and has the site switched it on?
	 * Installed-but-off is what the library's activation teaser is for.
	 *
	 * @param array $data Localized admin script data.
	 * @return array
	 */
	public static function expose_state( $data ) {
		if ( ! is_array( $data ) ) {
			return $data;
		}
		$data['h5p_available'] = Module::is_available();
		$data['h5p_installed'] = Module::is_installed();

		if ( ! isset( $data['feature_flags'] ) || ! is_array( $data['feature_flags'] ) ) {
			$data['feature_flags'] = [];
		}
		$data['feature_flags'][ self::ADDON_SLUG ] = Module::is_available();
		return $data;
	}

	/**
	 * Render an interactive item, or hand the request back to core untouched.
	 *
	 * An item authored as interactive has no video source, so letting it fall
	 * through to the native player would paint an empty stage — hence the
	 * author-facing notice rather than a null return.
	 *
	 * @param string|null $html     Markup from an earlier engine, if any.
	 * @param int         $video_id Item being rendered.
	 * @return string|null
	 */
	public static function render_engine( $html, $video_id ) {
		if ( null !== $html ) {
			return $html;
		}
		if ( Module::is_h5p( (int) $video_id ) ) {
			return Renderer::render( (int) $video_id );
		}
		if ( Module::is_h5p_authored( (int) $video_id ) ) {
			return Renderer::disabled_notice();
		}
		return null;
	}
}
