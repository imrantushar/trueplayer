<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Playlist;

/**
 * Admin CRUD for playlists (tp_playlist). Config stored as the
 * `_trueplayer_playlist` JSON meta. Admin-only.
 */
class PlaylistsController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'playlists';
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				[ 'methods' => WP_REST_Server::READABLE, 'callback' => [ $this, 'index' ], 'permission_callback' => [ $this, 'admin' ] ],
				[ 'methods' => WP_REST_Server::CREATABLE, 'callback' => [ $this, 'create' ], 'permission_callback' => [ $this, 'admin' ] ],
			]
		);
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)',
			[
				[ 'methods' => WP_REST_Server::READABLE, 'callback' => [ $this, 'show' ], 'permission_callback' => [ $this, 'admin' ] ],
				[ 'methods' => WP_REST_Server::EDITABLE, 'callback' => [ $this, 'update' ], 'permission_callback' => [ $this, 'admin' ] ],
				[ 'methods' => WP_REST_Server::DELETABLE, 'callback' => [ $this, 'destroy' ], 'permission_callback' => [ $this, 'admin' ] ],
			]
		);
	}

	public function admin() {
		return current_user_can( 'manage_options' );
	}

	public function index() {
		$posts = get_posts( [ 'post_type' => Playlist::POST_TYPE, 'post_status' => [ 'publish', 'draft' ], 'posts_per_page' => 200, 'orderby' => 'date', 'order' => 'DESC' ] );
		return rest_ensure_response( array_map( [ $this, 'to_item' ], $posts ) );
	}

	public function show( $request ) {
		$id = (int) $request['id'];
		if ( get_post_type( $id ) !== Playlist::POST_TYPE ) {
			return new \WP_Error( 'not_found', 'Not found', [ 'status' => 404 ] );
		}
		return rest_ensure_response( $this->to_item( get_post( $id ) ) );
	}

	public function create( $request ) {
		$body = $request->get_json_params();
		$id   = wp_insert_post( [ 'post_type' => Playlist::POST_TYPE, 'post_status' => 'publish', 'post_title' => sanitize_text_field( $body['title'] ?? __( 'Untitled playlist', 'trueplayer' ) ) ] );
		if ( is_wp_error( $id ) ) {
			return $id;
		}
		update_post_meta( $id, '_trueplayer_playlist', wp_json_encode( $this->sanitize( $body['config'] ?? [] ) ) );
		return rest_ensure_response( $this->to_item( get_post( $id ) ) );
	}

	public function update( $request ) {
		$id = (int) $request['id'];
		if ( get_post_type( $id ) !== Playlist::POST_TYPE ) {
			return new \WP_Error( 'not_found', 'Not found', [ 'status' => 404 ] );
		}
		$body = $request->get_json_params();
		if ( isset( $body['title'] ) ) {
			wp_update_post( [ 'ID' => $id, 'post_title' => sanitize_text_field( $body['title'] ) ] );
		}
		if ( array_key_exists( 'config', $body ) ) {
			update_post_meta( $id, '_trueplayer_playlist', wp_json_encode( $this->sanitize( $body['config'] ) ) );
		}
		return rest_ensure_response( $this->to_item( get_post( $id ) ) );
	}

	public function destroy( $request ) {
		$id = (int) $request['id'];
		if ( get_post_type( $id ) !== Playlist::POST_TYPE ) {
			return new \WP_Error( 'not_found', 'Not found', [ 'status' => 404 ] );
		}
		wp_delete_post( $id, true );
		return rest_ensure_response( [ 'deleted' => true ] );
	}

	private function sanitize( $config ) {
		$config = is_array( $config ) ? $config : [];
		return [
			'title'        => sanitize_text_field( $config['title'] ?? '' ),
			'layout'       => in_array( $config['layout'] ?? 'sidebar', [ 'sidebar', 'grid' ], true ) ? $config['layout'] : 'sidebar',
			'videos'       => array_values( array_filter( array_map( 'absint', (array) ( $config['videos'] ?? [] ) ) ) ),
			'autoplayNext' => ! empty( $config['autoplayNext'] ),
			'showTitles'   => ! isset( $config['showTitles'] ) || ! empty( $config['showTitles'] ),
		];
	}

	private function to_item( $post ) {
		$raw = get_post_meta( $post->ID, '_trueplayer_playlist', true );
		$cfg = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : [];
		return [
			'id'        => $post->ID,
			'title'     => $post->post_title,
			'shortcode' => sprintf( '[trueplayer_playlist id="%d"]', $post->ID ),
			'config'    => is_array( $cfg ) ? $cfg : [],
		];
	}
}
