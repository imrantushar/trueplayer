<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Services\ProgressService;

// Table name comes from ProgressService::table() (our prefix-derived constant);
// %d parameter is passed through $wpdb->prepare().
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

/**
 * Admin viewers list for a video (free-tier reporting) + reset/unlock action.
 * Rich charts/exports live in the pro reporting addon.
 */
class ViewersController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'viewers';
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'index' ],
				'permission_callback' => [ $this, 'admin' ],
				'args'                => [
					'video' => [ 'required' => true, 'sanitize_callback' => 'absint' ],
				],
			]
		);
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/reset',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'reset' ],
				'permission_callback' => [ $this, 'admin' ],
			]
		);
	}

	public function admin() {
		return current_user_can( 'manage_options' );
	}

	public function index( $request ) {
		global $wpdb;
		$video_id = (int) $request->get_param( 'video' );
		$rows     = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . ProgressService::table() . ' WHERE video_id = %d ORDER BY updated_at DESC LIMIT 500',
				$video_id
			),
			ARRAY_A
		);

		$out = array_map(
			function ( $r ) {
				$label = 'guest';
				if ( 'user' === $r['subject_type'] ) {
					$u     = get_userdata( (int) $r['subject_id'] );
					$label = $u ? $u->display_name . ' (' . $u->user_email . ')' : 'user #' . $r['subject_id'];
				} else {
					$label = 'Guest ' . substr( $r['subject_id'], 0, 8 );
				}
				return [
					'id'        => (int) $r['id'],
					'subject'   => $label,
					'type'      => $r['subject_type'],
					'percent'   => (float) $r['percent'],
					'completed' => (bool) $r['completed'],
					'status'    => $r['status'],
					'attempts'  => (int) $r['attempts'],
					'sessions'  => (int) ( $r['sessions'] ?? 0 ),
					'device'    => $r['device'] ?? '',
					'updated'   => $r['updated_at'],
				];
			},
			$rows ?: []
		);

		return rest_ensure_response( $out );
	}

	public function reset( $request ) {
		global $wpdb;
		$id = (int) ( $request->get_json_params()['id'] ?? 0 );
		$wpdb->update(
			ProgressService::table(),
			[
				'status'          => 'in_progress',
				'attempts'        => 0,
				'watched_ranges'  => wp_json_encode( [] ),
				'watched_seconds' => 0,
				'percent'         => 0,
				'completed'       => 0,
			],
			[ 'id' => $id ]
		);
		return rest_ensure_response( [ 'reset' => true ] );
	}
}
