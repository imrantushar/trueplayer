<?php

/**
 * Plugin Name: TruePlayer
 * Plugin URI: https://kodezen.com/trueplayer
 * Description: A watch-verified, quiz-gated video & audio player for WordPress — knows whether a viewer actually watched, locks the video on quiz failure, and fires webhooks for automation.
 * Version: 0.1.0
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
		define( 'TRUEPLAYER_VERSION', '0.1.0' );
		define( 'TRUEPLAYER_DB_VERSION', '2' );
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
		TruePlayer\Playlist::init();
		TruePlayer\Block::init();
		TruePlayer\Events::init();
		TruePlayer\Webhook\Dispatcher::init();
		TruePlayer\Integrations::init();
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
