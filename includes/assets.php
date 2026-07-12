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

	private function get_frontend_scripts_data(): array {
		return apply_filters(
			'trueplayer/assets/frontend_scripts_data',
			$this->get_common_scripts_data()
		);
	}

	private function get_backend_scripts_data(): array {
		return apply_filters(
			'trueplayer/assets/backend_scripts_data',
			$this->get_common_scripts_data()
		);
	}

	private function get_common_scripts_data(): array {
		global $trueplayer_addons;

		return [
			'nonce'            => wp_create_nonce( 'wp_rest' ),
			'trueplayer_nonce' => wp_create_nonce( 'trueplayer_nonce' ),
			'rest_url'         => rest_url(),
			'namespace'        => TRUEPLAYER_PLUGIN_SLUG . '/v1/',
			'plugin_root_url'  => TRUEPLAYER_PLUGIN_ROOT_URI,
			'ajax_url'         => esc_url( admin_url( 'admin-ajax.php' ) ),
			'site_url'         => site_url(),
			'admin_url'        => admin_url(),
			'is_login'         => (bool) is_user_logged_in(),
			'is_admin'         => (bool) current_user_can( 'manage_options' ),
			'addons'           => $trueplayer_addons,
			'is_pro_active'    => \TruePlayer\Pro::active(),
			'feature_flags'    => \TruePlayer\Pro::feature_flags(),
			// Site-wide player customization defaults. Per-video config is
			// layered over this on the client (resolveCustomize).
			'player_defaults'  => self::player_defaults(),
		];
	}

	/**
	 * The global player customization defaults, stored in the settings option
	 * under `customize`. Empty by default (client falls back to built-ins).
	 */
	public static function player_defaults(): array {
		$settings = json_decode( get_option( TRUEPLAYER_SETTINGS_NAME, '{}' ), true );
		return ( is_array( $settings ) && ! empty( $settings['customize'] ) && is_array( $settings['customize'] ) )
			? $settings['customize']
			: [];
	}
}
