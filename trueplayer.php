<?php

/**
 * Plugin Name: TruePlayer
 * Plugin URI: https://kodezen.com/trueplayer
 * Description: A watch-verified, quiz-gated video & audio player for WordPress — knows whether a viewer actually watched, locks the video on quiz failure, and fires webhooks for automation.
 * Version: 1.3.0
 * Author: Kodezen
 * Author URI: https://kodezen.com
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: trueplayer
 * Domain Path: /languages
 * Requires at least: 6.4
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class TruePlayer {

	private function __construct() {
		$this->define_constants();
		$this->set_global_settings();
		$this->load_dependency();
		register_activation_hook( __FILE__, [ $this, 'activate' ] );
		register_deactivation_hook( __FILE__, [ $this, 'deactivate' ] );
		add_action( 'plugins_loaded', [ $this, 'on_plugins_loaded' ] );
		add_action( 'trueplayer_loaded', [ $this, 'init_plugin' ] );
	}

	public static function init() {
		static $instance = false;

		if ( ! $instance ) {
			$instance = new self();
		}

		return $instance;
	}

	public function define_constants() {
		define( 'TRUEPLAYER_VERSION', '1.3.0' );
		define( 'TRUEPLAYER_DB_VERSION', '5' );
		define( 'TRUEPLAYER_SETTINGS_NAME', 'trueplayer_settings' );
		define( 'TRUEPLAYER_PLUGIN_FILE', __FILE__ );
		define( 'TRUEPLAYER_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
		define( 'TRUEPLAYER_PLUGIN_SLUG', 'trueplayer' );
		define( 'TRUEPLAYER_DB_PREFIX', 'tp' );
		define( 'TRUEPLAYER_PREFIX', TRUEPLAYER_DB_PREFIX );
		define( 'TRUEPLAYER_VIDEO_POST_TYPE', TRUEPLAYER_DB_PREFIX . '_video' );
		define( 'TRUEPLAYER_PRESET_POST_TYPE', TRUEPLAYER_DB_PREFIX . '_preset' );
		define( 'TRUEPLAYER_PLUGIN_ROOT_URI', plugins_url( '/', __FILE__ ) );
		define( 'TRUEPLAYER_ROOT_DIR_PATH', plugin_dir_path( __FILE__ ) );
		define( 'TRUEPLAYER_INCLUDES_DIR_PATH', TRUEPLAYER_ROOT_DIR_PATH . 'includes/' );
		define( 'TRUEPLAYER_ASSETS_DIR_PATH', TRUEPLAYER_ROOT_DIR_PATH . 'assets/' );
		define( 'TRUEPLAYER_ASSETS_URI', TRUEPLAYER_PLUGIN_ROOT_URI . 'assets/' );
		define( 'TRUEPLAYER_ADDONS_SETTINGS', 'trueplayer_addons' );
	}

	/**
	 * When WP has loaded all plugins, trigger the `trueplayer_loaded` hook so
	 * add-ons (trueplayer-pro) that registered their loader filter at plugin
	 * construction time are in place before our addon loader runs.
	 */
	public function on_plugins_loaded() {
		do_action( 'trueplayer_loaded' );
	}

	public function init_plugin() {
		do_action( 'trueplayer_before_init' );
		$this->dispatch_hooks();
		$this->load_addons();
		do_action( 'trueplayer_init' );
	}

	public function dispatch_hooks() {
		add_action( 'init', [ 'TruePlayer\\Helper', 'maybe_flush_rewrite_rules' ], 999 );

		if ( is_admin() ) {
			TruePlayer\Admin::init();
		}
		TruePlayer\Assets::init();
		TruePlayer\Api::init();
		TruePlayer\Database::init();
		TruePlayer\Shortcode::init();
		TruePlayer\InstantPage::init();
		TruePlayer\Playlist::init();
		TruePlayer\Block::init();
		TruePlayer\Events::init();
		TruePlayer\Webhook\Dispatcher::init();
		TruePlayer\Integrations::init();
		TruePlayer\WhiteLabel::init();
		TruePlayer\Migrator::init();
		TruePlayer\Services\Retention::init();

		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			\WP_CLI::add_command( 'trueplayer', 'TruePlayer\\CLI' );
		}
	}

	public function load_addons() {
		TruePlayer\Addons::init();
	}

	public function set_global_settings() {
		$GLOBALS['trueplayer_settings'] = json_decode( get_option( TRUEPLAYER_SETTINGS_NAME, '{}' ) );
		$GLOBALS['trueplayer_addons']   = json_decode( get_option( TRUEPLAYER_ADDONS_SETTINGS, '{}' ) );
	}

	public function load_dependency() {
		if ( file_exists( TRUEPLAYER_ROOT_DIR_PATH . 'vendor/autoload.php' ) ) {
			require_once TRUEPLAYER_ROOT_DIR_PATH . 'vendor/autoload.php';
		}
		require_once TRUEPLAYER_INCLUDES_DIR_PATH . 'autoload.php';
		require_once TRUEPLAYER_INCLUDES_DIR_PATH . 'functions.php';

		// StoreEngine license SDK (bundled, not composer-autoloaded). Its init.php
		// registers a plugins_loaded:0 version loader that defines se_license_init()
		// and the SE_License_SDK_* classes. Guarded so multiple Kodezen plugins
		// bundling the SDK don't double-register.
		$sdk_init = TRUEPLAYER_ROOT_DIR_PATH . 'vendor/storeengine/wordpress-sdk/init.php';
		if ( ! function_exists( 'se_license_init' ) && file_exists( $sdk_init ) ) {
			require_once $sdk_init;
		}

		// Configure the SDK (free product 430 — insights only).
		TruePlayer\StoreLicense::init();
	}

	public function activate() {
		TruePlayer\Installer::init();
	}

	public function deactivate() {
		// Nothing to unschedule yet.
	}
}

/**
 * Initializes the main plugin.
 *
 * @return \TruePlayer
 */
function trueplayer_start() {
	return TruePlayer::init();
}

if ( ! function_exists( 'trueplayer_is_pro_active' ) ) {
	function trueplayer_is_pro_active() {
		return defined( 'TRUEPLAYER_PRO_VERSION' ) || did_action( 'trueplayer_pro_init' ) > 0;
	}
}

// Plugin Start.
trueplayer_start();
