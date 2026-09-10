<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Helper;

/**
 * Admin CRUD for tp_preset items — reusable player styles/behaviour. The whole
 * preset (customize + branding) is stored as the `_trueplayer_preset` JSON meta.
 * A video references a preset by id (config.presetId); the preset is merged
 * under the video's own settings at render time (see Helper::apply_preset).
 */
class PresetsController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'presets';
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'index' ],
					'permission_callback' => [ $this, 'admin' ],
				],
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'create' ],
					'permission_callback' => [ $this, 'admin' ],
				],
			]
		);
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'show' ],
					'permission_callback' => [ $this, 'admin' ],
				],
				[
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => [ $this, 'update' ],
					'permission_callback' => [ $this, 'admin' ],
				],
				[
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'destroy' ],
					'permission_callback' => [ $this, 'admin' ],
				],
			]
		);
	}

	public function admin() {
		return current_user_can( 'manage_options' );
	}

	public function index( $request = null ) {
		$args = [
			'post_type'      => TRUEPLAYER_PRESET_POST_TYPE,
			'post_status'    => [ 'publish', 'draft' ],
			'posts_per_page' => 200,
			'orderby'        => 'title',
			'order'          => 'ASC',
		];

		// Optional ?type=video|audio. The admin app fetches unfiltered and splits
		// the list client-side (it needs both halves at once for the tab counts),
		// but other REST consumers want to ask for one kind.
		$type = $request ? sanitize_text_field( (string) $request->get_param( 'type' ) ) : '';
		if ( 'audio' === $type ) {
			$args['meta_query'] = [
				[
					'key'   => '_trueplayer_preset_type',
					'value' => 'audio',
				],
			];
		} elseif ( 'video' === $type ) {
			// NOT EXISTS is load-bearing: a registered default writes no row, so
			// every preset made before audio existed has no meta to match on.
			$args['meta_query'] = [
				'relation' => 'OR',
				[
					'key'   => '_trueplayer_preset_type',
					'value' => 'video',
				],
				[
					'key'     => '_trueplayer_preset_type',
					'compare' => 'NOT EXISTS',
				],
			];
		}

		return rest_ensure_response( array_map( [ $this, 'to_item' ], get_posts( $args ) ) );
	}

	public function show( $request ) {
		$id = (int) $request['id'];
		if ( get_post_type( $id ) !== TRUEPLAYER_PRESET_POST_TYPE ) {
			return new \WP_Error( 'not_found', 'Not found', [ 'status' => 404 ] );
		}
		return rest_ensure_response( $this->to_item( get_post( $id ) ) );
	}

	public function create( $request ) {
		$body  = $request->get_json_params();
		$title = isset( $body['title'] ) ? sanitize_text_field( $body['title'] ) : __( 'Untitled preset', 'trueplayer' );
		$id    = wp_insert_post(
			[
				'post_type'   => TRUEPLAYER_PRESET_POST_TYPE,
				'post_status' => 'publish',
				'post_title'  => $title,
			]
		);
		if ( is_wp_error( $id ) ) {
			return $id;
		}
		if ( isset( $body['config'] ) ) {
			Helper::update_json_meta( $id, '_trueplayer_preset', $body['config'] );
		}
		// Set at creation and never afterwards — see update() for why.
		if ( 'audio' === ( $body['type'] ?? '' ) ) {
			update_post_meta( $id, '_trueplayer_preset_type', 'audio' );
		}
		return rest_ensure_response( $this->to_item( get_post( $id ) ) );
	}

	/**
	 * Note: `type` is deliberately NOT updatable. A preset's type decides which
	 * player it styles, and videos reference presets by id — flipping an audio
	 * preset to video would silently restyle every item already using it with
	 * settings that mean nothing for their media. Make a new preset instead.
	 */
	public function update( $request ) {
		$id = (int) $request['id'];
		if ( get_post_type( $id ) !== TRUEPLAYER_PRESET_POST_TYPE ) {
			return new \WP_Error( 'not_found', 'Not found', [ 'status' => 404 ] );
		}
		$body = $request->get_json_params();
		if ( isset( $body['title'] ) ) {
			wp_update_post( [ 'ID' => $id, 'post_title' => sanitize_text_field( $body['title'] ) ] );
		}
		if ( array_key_exists( 'config', $body ) ) {
			Helper::update_json_meta( $id, '_trueplayer_preset', $body['config'] );
		}
		return rest_ensure_response( $this->to_item( get_post( $id ) ) );
	}

	public function destroy( $request ) {
		$id = (int) $request['id'];
		if ( get_post_type( $id ) !== TRUEPLAYER_PRESET_POST_TYPE ) {
			return new \WP_Error( 'not_found', 'Not found', [ 'status' => 404 ] );
		}
		wp_delete_post( $id, true );
		return rest_ensure_response( [ 'deleted' => true ] );
	}

	private function to_item( $post ) {
		$raw    = get_post_meta( $post->ID, '_trueplayer_preset', true );
		$config = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : [];
		return [
			'id'       => $post->ID,
			'title'    => $post->post_title,
			'type'     => Helper::get_preset_type( $post->ID ),
			'config'   => is_array( $config ) ? $config : [],
			'modified' => $post->post_modified_gmt,
		];
	}
}
