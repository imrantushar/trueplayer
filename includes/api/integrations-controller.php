<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Integrations;

/**
 * GET /trueplayer/v1/integrations — lists all registered integrations, whether
 * each is available (dependency installed), and the audiences (lists/tags) it
 * can target. Powers the opt-in provider/list pickers. Admin-only.
 */
class IntegrationsController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'integrations';
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'index' ],
				'permission_callback' => [ $this, 'admin' ],
			]
		);
	}

	public function admin() {
		return current_user_can( 'manage_options' ) && \TruePlayer\Pro::active();
	}

	public function index() {
		$out = array_map(
			function ( $integration ) {
				return method_exists( $integration, 'to_array' )
					? $integration->to_array()
					: [
						'id'        => $integration->id(),
						'name'      => $integration->name(),
						'available' => $integration->is_available(),
						'lists'     => $integration->is_available() ? $integration->lists() : [],
					];
			},
			Integrations::all()
		);
		return rest_ensure_response( $out );
	}
}
