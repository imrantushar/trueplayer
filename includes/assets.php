<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Assets {

	const FRONTEND_SCRIPT_HANDLE = 'trueplayer-frontend';
	const FRONTEND_STYLE_HANDLE  = 'trueplayer-frontend';
	const BACKEND_SCRIPT_HANDLE  = 'trueplayer-backend';
	const BACKEND_STYLE_HANDLE   = 'trueplayer-backend';

	const GLOBAL_OBJECT = 'TruePlayerGlobal';

	public static function init(): void {
		$self = new self();
		add_action( 'admin_enqueue_scripts', [ $self, 'enqueue_app_assets' ] );
		add_action( 'wp_enqueue_scripts', [ $self, 'enqueue_frontend_assets' ] );
	}

	/**
	 * Frontend runtime — only enqueued when a page actually mounts a player.
	 * Shortcode::init flips the `trueplayer_has_player` flag during the_content
	 * render, but we also enqueue on-demand from the shortcode itself; here we
	 * register so dependents resolve and localize the global object.
	 */
	public function enqueue_frontend_assets(): void {
		$deps = $this->load_asset_deps( 'frontend' );

		wp_register_style(
			self::FRONTEND_STYLE_HANDLE,
			TRUEPLAYER_ASSETS_URI . 'build/style-frontend.css',
			[],
			TRUEPLAYER_VERSION
		);

		// Site-wide custom player CSS (Settings → Player defaults → Custom CSS,
		// stored in the settings option under customize.css).
		$defaults   = self::player_defaults();
		$custom_css = isset( $defaults['css'] ) && is_string( $defaults['css'] ) ? wp_strip_all_tags( $defaults['css'] ) : '';
		if ( '' !== trim( $custom_css ) ) {
			wp_add_inline_style( self::FRONTEND_STYLE_HANDLE, $custom_css );
		}

		wp_register_script(
			self::FRONTEND_SCRIPT_HANDLE,
			TRUEPLAYER_ASSETS_URI . sprintf( 'build/frontend.%s.js', TRUEPLAYER_VERSION ),
			$deps['dependencies'],
			$deps['version'],
			true
		);

		wp_localize_script( self::FRONTEND_SCRIPT_HANDLE, self::GLOBAL_OBJECT, $this->get_frontend_scripts_data() );
		wp_set_script_translations( self::FRONTEND_SCRIPT_HANDLE, 'trueplayer', TRUEPLAYER_ROOT_DIR_PATH . 'languages/' );
	}

	public function enqueue_app_assets( string $hook ): void {
		if ( strpos( $hook, '_page_' . TRUEPLAYER_PLUGIN_SLUG ) === false && strpos( $hook, TRUEPLAYER_PLUGIN_SLUG ) === false ) {
			return;
		}

		// Suppress third-party admin notices on our screens so they don't
		// clash with the React app. CSS-only (notices stay in the DOM for
		// screen readers + dismiss workflows) — wp.org flags plugins that nuke
		// admin_notices wholesale.
		add_action( 'admin_head', [ $this, 'hide_admin_notices_on_app_pages' ] );
		// Belt-and-braces: also drop queued notice callbacks on our own pages.
		add_action( 'in_admin_header', [ $this, 'strip_admin_notice_actions' ], 1000 );

		$deps = $this->load_asset_deps( 'backend' );

		// GemCRM uses the native system font stack (no blocking webfont request);
		// the family is set on `.tp-admin` in admin/style.css.

		wp_enqueue_style(
			self::BACKEND_STYLE_HANDLE,
			TRUEPLAYER_ASSETS_URI . 'build/style-backend.css',
			[ 'wp-components' ],
			file_exists( TRUEPLAYER_ASSETS_DIR_PATH . 'build/style-backend.css' ) ? filemtime( TRUEPLAYER_ASSETS_DIR_PATH . 'build/style-backend.css' ) : TRUEPLAYER_VERSION
		);

		// The live preview renders the real frontend player, which needs the
		// frontend player CSS. It's a separate webpack entry, so load it here.
		wp_enqueue_style(
			'trueplayer-preview-player',
			TRUEPLAYER_ASSETS_URI . 'build/style-frontend.css',
			[],
			file_exists( TRUEPLAYER_ASSETS_DIR_PATH . 'build/style-frontend.css' ) ? filemtime( TRUEPLAYER_ASSETS_DIR_PATH . 'build/style-frontend.css' ) : TRUEPLAYER_VERSION
		);

		if ( ! did_action( 'wp_enqueue_media' ) ) {
			wp_enqueue_media();
		}

		// The Gating tab's live preview renders a QuizPress-sourced quiz inline
		// (QuizpressQuiz.jsx), which needs QuizPress's own frontend script for
		// its `quizpress.question-answer-widget.content` / `quizpress.submit-
		// question-answer` hooks. `QuizPress\Assets::frontend_scripts()` only
		// runs on the front-end `wp_enqueue_scripts` hook, which never fires in
		// wp-admin — call it directly here (idempotent: register-only, safe to
		// call twice) rather than re-deriving its build paths ourselves.
		//
		// Script only, deliberately not QuizPress's stylesheet: both plugins
		// ship their own separate Tailwind build with generic, unprefixed
		// utility classes (`.flex`, `.grid`, `.p-6`, …) — loading QuizPress's
		// global CSS into this admin page let its reset/utilities collide with
		// and override this app's own layout (broke the 3-column editor
		// grid). The widget renders a little plainer without it; that's the
		// trade.
		if ( class_exists( '\\QuizPress\\Assets' ) ) {
			( new \QuizPress\Assets() )->frontend_scripts();
			wp_enqueue_script( 'quizpress-frontend-scripts' );
		}

		wp_enqueue_script(
			self::BACKEND_SCRIPT_HANDLE,
			TRUEPLAYER_ASSETS_URI . sprintf( 'build/backend.%s.js', TRUEPLAYER_VERSION ),
			$deps['dependencies'],
			$deps['version'],
			true
		);

		wp_localize_script( self::BACKEND_SCRIPT_HANDLE, self::GLOBAL_OBJECT, $this->get_backend_scripts_data() );
		wp_set_script_translations( self::BACKEND_SCRIPT_HANDLE, 'trueplayer', TRUEPLAYER_ROOT_DIR_PATH . 'languages/' );
	}

	/**
	 * CSS-only suppression of admin notices on TruePlayer app pages. Keeps the
	 * notices in the DOM (dismiss-state, screen readers, other plugins' flows
	 * keep working) but hides them inside the React layout.
	 */
	public function hide_admin_notices_on_app_pages(): void {
		echo '<style>
			#wpbody-content > .notice,
			#wpbody-content > .updated,
			#wpbody-content > .update-nag,
			#wpbody-content > .error,
			.trueplayer-app ~ .notice { display: none !important; }
		</style>';
	}

	/**
	 * Remove queued admin_notices / all_admin_notices callbacks on our pages so
	 * even notices printed before our CSS loads don't flash. Runs late enough
	 * that our own screens are the only ones affected.
	 */
	public function strip_admin_notice_actions(): void {
		remove_all_actions( 'admin_notices' );
		remove_all_actions( 'all_admin_notices' );
	}

	private function load_asset_deps( string $entry ): array {
		$file = TRUEPLAYER_ASSETS_DIR_PATH . sprintf( 'build/%s.%s.asset.php', $entry, TRUEPLAYER_VERSION );
		if ( ! file_exists( $file ) ) {
			return [ 'dependencies' => [], 'version' => TRUEPLAYER_VERSION ];
		}
		$deps = include $file;
		return is_array( $deps ) ? $deps : [ 'dependencies' => [], 'version' => TRUEPLAYER_VERSION ];
	}

	/**
	 * Public because the block editor's live preview renders the real frontend
	 * player and needs the same runtime state the front end gets — site-wide
	 * player defaults above all, which are layered on the client, so a preview
	 * without them would disagree with the page it is previewing.
	 */
	public function get_frontend_scripts_data(): array {
		$data                     = $this->get_common_scripts_data();
		$sources                  = \TruePlayer\Helper::get_settings_section( 'sources' );
		$data['youtube_nocookie'] = ! empty( $sources['youtubeNoCookie'] );

		$ga                        = \TruePlayer\Helper::get_settings_section( 'integrations' )['ga'] ?? [];
		$data['ga_enabled']        = ! empty( $ga['enabled'] );
		$data['ga_measurement_id'] = isset( $ga['measurementId'] ) ? (string) $ga['measurementId'] : '';

		return apply_filters(
			'trueplayer/assets/frontend_scripts_data',
			$data
		);
	}

	private function get_backend_scripts_data(): array {
		return apply_filters(
			'trueplayer/assets/backend_scripts_data',
			array_merge(
				$this->get_common_scripts_data(),
				// Each addon contributes its own state through this same filter
				// (see TruePlayerInteractive\Interactive::expose_state), so core
				// doesn't enumerate features it no longer owns. The registry is
				// what the Settings → Addons screen lists.
				[
					'addons_registry' => \TruePlayer\Addons::registry(),
					// The address email-capture notifications fall back to, shown as
					// the placeholder on that setting so the default is visible
					// rather than merely described.
					'admin_email'     => (string) get_option( 'admin_email' ),
					// The site-wide "default player look" choice — admin only.
					//
					// applyPreset (admin/utils/preset.js) falls back to the preset
					// ids so the editor preview mirrors what Helper::apply_preset
					// will really render. It already read
					// `TruePlayerGlobal.settings.general` — but nothing ever sent
					// that key, so the fallback was dead and the preview showed no
					// preset for every item relying on the site default, which is
					// exactly the case a newly created item is in.
					//
					// Only these four keys are published, not the whole `general`
					// section: pinning the shape here means a future setting added
					// beside them cannot start leaking into the page by accident.
					'settings'        => [
						'general' => self::default_look_settings(),
					],
				]
			)
		);
	}

	private function get_common_scripts_data(): array {
		global $trueplayer_addons;

		return [
			'nonce'                 => wp_create_nonce( 'wp_rest' ),
			'trueplayer_nonce'      => wp_create_nonce( 'trueplayer_nonce' ),
			'rest_url'              => rest_url(),
			'namespace'             => TRUEPLAYER_PLUGIN_SLUG . '/v1/',
			'plugin_root_url'       => TRUEPLAYER_PLUGIN_ROOT_URI,
			'ajax_url'              => esc_url( admin_url( 'admin-ajax.php' ) ),
			'site_url'              => site_url(),
			'admin_url'             => admin_url(),
			'is_login'              => (bool) is_user_logged_in(),
			'user_id'               => get_current_user_id(),
			'is_admin'              => (bool) current_user_can( 'manage_options' ),
			'addons'                => $trueplayer_addons,
			// Installing Pro is what unlocks its features; the licence buys
			// updates and support and is reported separately (license_status),
			// so a missing key never reads as "you don't have Pro".
			'is_pro_active'         => \TruePlayer\Pro::active(),
			// Distinct from is_pro_active: the pro plugin can be running on the
			// permissive pre-license default, and the settings screen must not
			// call that "your license is valid". See Pro::license_status().
			'license_status'        => \TruePlayer\Pro::license_status(),
			'license_url'           => \TruePlayer\Pro::license_page_url(),
			'feature_flags'         => \TruePlayer\Pro::feature_flags(),
			// The site's own name/mark when white-label is on, so the React
			// admin matches the WP menu instead of always saying "TruePlayer".
			'brand'                 => [
				'name' => \TruePlayer\Helper::brand_name(),
				'logo' => \TruePlayer\Helper::brand_logo(),
			],
			// The site-wide watch-verification policy. The per-video gating tab
			// seeds from this so opening it can't silently overwrite the site
			// setting with a hardcoded default (see Helper::enforcement_defaults).
			'enforcement'           => \TruePlayer\Helper::enforcement_defaults(),
			// Site-wide player customization defaults. Per-video config is
			// layered over this on the client (resolveCustomize). Audio keeps
			// its own appearance blob — the two players share almost no
			// appearance vocabulary — while controls, behavior and the shared
			// brand keys still come from `player_defaults` for both.
			'player_defaults'       => self::player_defaults(),
			'player_defaults_audio' => self::player_defaults_audio(),
		];
	}

	/**
	 * The global player customization defaults, stored in the settings option
	 * under `customize`. Empty by default (client falls back to built-ins).
	 */
	public static function player_defaults(): array {
		return self::settings_blob( 'customize' );
	}

	/**
	 * The site-wide AUDIO player defaults (Settings → General → Audio), stored
	 * separately under `customizeAudio`.
	 *
	 * Its own key rather than a branch inside `customize` because the two
	 * players share almost no appearance vocabulary: a skin and an aspect ratio
	 * are treatments of a picture, and an audio bar has no picture. The client
	 * layers the shared keys from `customize` and then this blob on top — see
	 * resolveCustomize() in dev_trueplayer/player/customize.js.
	 *
	 * Empty on an install that has never set an audio default, which is exactly
	 * the pre-1.4 behaviour.
	 */
	public static function player_defaults_audio(): array {
		return self::settings_blob( 'customizeAudio' );
	}

	/**
	 * The site-wide "default player look" choice, per media type.
	 *
	 * Two pairs: the preset id that wins if set, and the starting-point template
	 * key that applies otherwise. Audio has its own of each because a video
	 * preset's skin and aspect ratio mean nothing for a bar — the same split
	 * Helper::apply_preset enforces.
	 *
	 * The template keys are markers, not render inputs: the template's values
	 * are already baked into `customize` / `customizeAudio` when it is chosen.
	 * They are published so the admin can NAME the active look — in the Settings
	 * picker and in the create dialog — rather than only apply it silently.
	 */
	public static function default_look_settings(): array {
		$general = self::settings_blob( 'general' );
		return [
			'defaultPreset'        => (int) ( $general['defaultPreset'] ?? 0 ),
			'defaultAudioPreset'   => (int) ( $general['defaultAudioPreset'] ?? 0 ),
			'defaultTemplate'      => (string) ( $general['defaultTemplate'] ?? '' ),
			'defaultAudioTemplate' => (string) ( $general['defaultAudioTemplate'] ?? '' ),
		];
	}

	/** One top-level settings key, decoded, guaranteed to be an array. */
	private static function settings_blob( string $key ): array {
		$settings = json_decode( get_option( TRUEPLAYER_SETTINGS_NAME, '{}' ), true );
		return ( is_array( $settings ) && ! empty( $settings[ $key ] ) && is_array( $settings[ $key ] ) )
			? $settings[ $key ]
			: [];
	}
}
