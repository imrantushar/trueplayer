<?php
/**
 * StoreEngine SDK bootstrap for TruePlayer (free).
 */

namespace TruePlayer;

use SE_License_SDK_Client;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * StoreEngine License SDK configuration — free edition.
 *
 * The SDK ships under this plugin's `vendor/storeengine/wordpress-sdk/` and is
 * loaded through its `init.php` (see TruePlayer::load_dependency). This class
 * only configures the SDK: it defers `se_license_init()` to `plugins_loaded`
 * (the SDK registers its class loader there) and hands it the free product's
 * parameters. There is no gating or custom UI glue — free simply runs the SDK's
 * anonymous, opt-in insights + deactivation-feedback subsystem.
 *
 * Free and Pro are separate StoreEngine products (430 / 431). This free client
 * runs `is_free: true` with only insights enabled: no store-served update
 * channel (`use_update` off — WordPress.org owns updates), no SDK license REST
 * routes (`init_restapi` off — those call `license()`, which throws for a free
 * product), and no manage-license page (`menu` off). Real license activation
 * and the update channel belong to Pro's client (`TruePlayerPro\StoreLicense`).
 */
final class StoreLicense {

	protected static ?SE_License_SDK_Client $sdk_client = null;

	private function __construct() {}

	public static function init(): void {
		if ( ! did_action( 'plugins_loaded' ) ) {
			add_action( 'plugins_loaded', [ __CLASS__, 'load_sdk' ] );
		} else {
			self::load_sdk();
		}
	}

	public static function load_sdk(): void {
		if ( null !== self::$sdk_client ) {
			return;
		}

		if ( ! function_exists( 'se_license_init' ) ) {
			_doing_it_wrong(
				__METHOD__,
				'StoreEngine SDK is missing. Ensure trueplayer/vendor/storeengine/wordpress-sdk is present.',
				'1.0.0'
			);
			return;
		}

		self::$sdk_client = se_license_init( [
			'package_file'        => TRUEPLAYER_PLUGIN_FILE,
			'package_name'        => 'TruePlayer', // no translation — runs too early for the textdomain.
			// Free and Pro are separate StoreEngine products (430 / 431).
			'product_id'          => 430,
			'is_free'             => true,
			'slug'                => TRUEPLAYER_PLUGIN_SLUG,
			'basename'            => TRUEPLAYER_PLUGIN_BASENAME,
			'package_type'        => 'plugin',
			'package_version'     => TRUEPLAYER_VERSION,
			'allow_local'         => true,
			// Free is distributed on WordPress.org, so WP core owns updates and
			// there is no license to manage: no update channel, no REST routes,
			// no manage-license page. Only the opt-in insights + deactivation
			// feedback popup is booted.
			'use_update'          => false,
			'init_restapi'        => false,
			'menu'                => false,
			'init_insights'       => true,
			'license_server'      => 'https://store.kodezen.com/',
			'purchase_url'        => 'https://store.kodezen.com/product/trueplayer-pro/',
			'product_logo'        => defined( 'TRUEPLAYER_ASSETS_URI' ) ? TRUEPLAYER_ASSETS_URI . 'images/logo.svg' : '',
			'store_dashboard_url' => 'https://store.kodezen.com/dashboard/license-keys/',
			'terms_url'           => 'https://kodezen.com/terms-and-conditions/',
			'privacy_policy_url'  => 'https://store.kodezen.com/privacy-policy/',
			'ticket_recipient'    => 'support@kodezen.com',
			'primary_color'       => '#008dff',
			'first_install_time'  => self::first_install_time(),
			'optin_notice_delay'  => 3 * DAY_IN_SECONDS,
		] );
	}

	/**
	 * Install time as a Unix timestamp for the SDK's opt-in notice cadence.
	 *
	 * The plugin's installer records `trueplayer_first_install_time` as an ISO-8601
	 * string (used elsewhere for webhook/log payloads); the SDK requires an int
	 * timestamp, so we convert. Falls back to now when the option is absent.
	 */
	private static function first_install_time(): int {
		$stored = get_option( 'trueplayer_first_install_time' );
		if ( empty( $stored ) ) {
			return time();
		}
		return is_numeric( $stored ) ? (int) $stored : (int) strtotime( (string) $stored );
	}

	public static function get_client(): ?SE_License_SDK_Client {
		return self::$sdk_client;
	}
}

// End of file store-license.php.
