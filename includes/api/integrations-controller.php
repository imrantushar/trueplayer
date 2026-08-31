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
		// Not Pro-gated: the provider picker also serves free email capture, and
		// an empty list there would read as "no providers exist" rather than
		// "this one needs Pro". Availability per provider is reported instead.
		return current_user_can( 'manage_options' );
	}

	public function index() {
		$pro = \TruePlayer\Pro::active();
		$out = array_map(
			function ( $integration ) use ( $pro ) {
				$item = method_exists( $integration, 'to_array' )
					? $integration->to_array()
					: [
						'id'        => $integration->id(),
						'name'      => $integration->name(),
						'available' => $integration->is_available(),
						'lists'     => $integration->is_available() ? $integration->lists() : [],
					];
				// Two different reasons a provider can't be picked, and the admin
				// has to tell them apart: `available` means its dependency is
				// missing, `requiresPro` means the licence is. A CRM on a free
				// install is the second, not the first.
				$item['requiresPro'] = ! $pro && ! Integrations::is_free_provider( $integration->id() );
				return $item;
			},
			Integrations::all()
		);
		return rest_ensure_response( $out );
	}
}
