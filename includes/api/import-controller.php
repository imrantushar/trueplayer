<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Services\ImportService;

/**
 * Migration importer REST surface (free).
 *   GET  /trueplayer/v1/import/scan   → what can be imported
 *   POST /trueplayer/v1/import        → import {source, limit}
 */
class ImportController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'import';
	}

	public function register_routes() {
		register_rest_route( $this->namespace, '/' . $this->rest_base . '/scan', [
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => [ $this, 'scan' ],
			'permission_callback' => [ $this, 'admin' ],
		] );

		register_rest_route( $this->namespace, '/' . $this->rest_base, [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'run' ],
			'permission_callback' => [ $this, 'admin' ],
			'args'                => [
				'source' => [ 'required' => true, 'sanitize_callback' => 'sanitize_key' ],
				'limit'  => [ 'sanitize_callback' => 'absint', 'default' => 50 ],
			],
		] );
	}

	public function admin() {
		return current_user_can( 'manage_options' );
	}

	public function scan() {
		return rest_ensure_response( ImportService::scan() );
	}

	public function run( $request ) {
		$result = ImportService::import(
			(string) $request->get_param( 'source' ),
			(int) $request->get_param( 'limit' )
		);
		return rest_ensure_response( $result );
	}
}
