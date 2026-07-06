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
		$settings = json_decode( get_option( TRUEPLAYER_SETTINGS_NAME, '{}' ), true );
		return rest_ensure_response( is_array( $settings ) ? $settings : [] );
	}

	public function update_settings( $request ) {
		$incoming = $request->get_json_params();
		if ( ! is_array( $incoming ) ) {
			$incoming = [];
		}
		update_option( TRUEPLAYER_SETTINGS_NAME, wp_json_encode( $incoming ) );
		$GLOBALS['trueplayer_settings'] = (object) $incoming;
		return rest_ensure_response( [ 'success' => true, 'settings' => $incoming ] );
	}
}
