<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;

class SettingsController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'settings';
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_settings' ],
					'permission_callback' => [ $this, 'admin_permission' ],
				],
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'update_settings' ],
					'permission_callback' => [ $this, 'admin_permission' ],
				],
			]
		);
	}

	public function admin_permission() {
		return current_user_can( 'manage_options' );
	}

	public function get_settings() {
		return rest_ensure_response( \TruePlayer\Helper::get_settings() );
	}

	public function update_settings( $request ) {
		$incoming = $request->get_json_params();
		// A body that is not a JSON object must not be saved as "no settings",
		// which would silently wipe every saved value.
		if ( ! is_array( $incoming ) ) {
			return new \WP_Error( 'trueplayer_bad_settings', __( 'Settings must be a JSON object.', 'trueplayer' ), [ 'status' => 400 ] );
		}
		$incoming = \TruePlayer\Helper::sanitize_style_values( $incoming );
		$incoming = self::sanitize_known_fields( $incoming );
		update_option( TRUEPLAYER_SETTINGS_NAME, wp_json_encode( $incoming ) );
		$GLOBALS['trueplayer_settings'] = (object) $incoming;
		return rest_ensure_response(
			[
				'success'  => true,
				'settings' => $incoming,
			]
		);
	}

	/**
	 * Clean the settings that are used as something other than display text:
	 * the notification address (a mail recipient) and the GA4 measurement id
	 * (put in a script URL). Everything else is stored as sent.
	 *
	 * @param array $settings Decoded settings.
	 * @return array
	 */
	private static function sanitize_known_fields( array $settings ): array {
		if ( isset( $settings['integrations']['wp_mail']['to'] ) ) {
			$to                                        = $settings['integrations']['wp_mail']['to'];
			$settings['integrations']['wp_mail']['to'] = is_string( $to ) ? sanitize_email( $to ) : '';
		}
		if ( isset( $settings['integrations']['ga']['measurementId'] ) ) {
			$id = $settings['integrations']['ga']['measurementId'];
			$settings['integrations']['ga']['measurementId'] = is_string( $id ) && preg_match( '/^[A-Za-z0-9_-]{1,40}$/', trim( $id ) ) ? trim( $id ) : '';
		}
		return $settings;
	}
}
