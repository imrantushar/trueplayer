<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Services\AnalyticsService;

/**
 * GET /trueplayer/v1/analytics?video=ID     → aggregate dashboard payload
 * GET /trueplayer/v1/analytics/viewer?id=ID → per-viewer drill-down
 * Admin-only.
 */
class AnalyticsController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'analytics';
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'index' ],
				'permission_callback' => [ $this, 'admin' ],
				'args'                => [ 'video' => [ 'required' => true, 'sanitize_callback' => 'absint' ] ],
			]
		);
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/viewer',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'viewer' ],
				'permission_callback' => [ $this, 'admin' ],
				'args'                => [ 'id' => [ 'required' => true, 'sanitize_callback' => 'absint' ] ],
			]
		);
	}

	public function admin() {
		return current_user_can( 'manage_options' ) && \TruePlayer\Pro::active();
	}

	public function index( $request ) {
		return rest_ensure_response( AnalyticsService::for_video( (int) $request->get_param( 'video' ) ) );
	}

	public function viewer( $request ) {
		$detail = AnalyticsService::viewer_detail( (int) $request->get_param( 'id' ) );
		if ( ! $detail ) {
			return new \WP_Error( 'not_found', 'Viewer not found', [ 'status' => 404 ] );
		}
		return rest_ensure_response( $detail );
	}
}
