<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;

/**
 * Admin CRUD for tp_video items. Stores the whole player config as the
 * `_trueplayer_config` JSON meta. Admin-only.
 */
class VideosController extends WP_REST_Controller {

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'videos';
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
			'/' . $this->rest_base . '/tags',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'tags' ],
				'permission_callback' => [ $this, 'admin' ],
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

	public function index( $request ) {
		$args = [
			'post_type'      => TRUEPLAYER_VIDEO_POST_TYPE,
			'post_status'    => [ 'publish', 'draft' ],
			'posts_per_page' => 500,
			'orderby'        => 'date',
			'order'          => 'DESC',
		];
		// H5P-engine posts share the tp_video post type but are authored and
		// listed as interactive items, not as players with a source.
		$args['meta_query'] = [
			'relation' => 'OR',
			[ 'key' => \TruePlayer\H5P\Module::ENGINE_META, 'compare' => 'NOT EXISTS' ],
			[ 'key' => \TruePlayer\H5P\Module::ENGINE_META, 'value' => 'h5p', 'compare' => '!=' ],
		];

		$tag = $request ? sanitize_title( (string) $request->get_param( 'tag' ) ) : '';
		if ( $tag ) {
			$args['tax_query'] = [
				[
					'taxonomy' => \TruePlayer\Database\PostType::VIDEO_TAXONOMY,
					'field'    => 'slug',
					'terms'    => $tag,
				],
			];
		}
		$posts = get_posts( $args );
		$out   = array_map( [ $this, 'to_item' ], $posts );
		return rest_ensure_response( $out );
	}

	/** All tags in the library, with per-tag video counts. */
	public function tags() {
		$terms = get_terms(
			[
				'taxonomy'   => \TruePlayer\Database\PostType::VIDEO_TAXONOMY,
				'hide_empty' => false,
			]
		);
		if ( is_wp_error( $terms ) ) {
			return rest_ensure_response( [] );
		}
		$out = array_map(
			static function ( $t ) {
				return [ 'id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'count' => (int) $t->count ];
			},
			$terms
		);
		return rest_ensure_response( $out );
	}

	/** Assign the given tag names to a video (creating terms as needed). */
	private function set_tags( $id, $tags ) {
		if ( ! is_array( $tags ) ) {
			return;
		}
		$names = array_values( array_filter( array_map( 'sanitize_text_field', $tags ) ) );
		wp_set_object_terms( (int) $id, $names, \TruePlayer\Database\PostType::VIDEO_TAXONOMY, false );
	}

	public function show( $request ) {
		$id = (int) $request['id'];
		if ( get_post_type( $id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', 'Not found', [ 'status' => 404 ] );
		}
		return rest_ensure_response( $this->to_item( get_post( $id ) ) );
	}

	public function create( $request ) {
		$body  = $request->get_json_params();
		$title = isset( $body['title'] ) ? sanitize_text_field( $body['title'] ) : __( 'Untitled video', 'trueplayer' );
		$id    = wp_insert_post(
			[
				'post_type'   => TRUEPLAYER_VIDEO_POST_TYPE,
				'post_status' => 'publish',
				'post_title'  => $title,
			]
		);
		if ( is_wp_error( $id ) ) {
			return $id;
		}
		if ( isset( $body['config'] ) ) {
			update_post_meta( $id, '_trueplayer_config', wp_json_encode( $body['config'] ) );
		}
		if ( array_key_exists( 'tags', $body ) ) {
			$this->set_tags( $id, $body['tags'] );
		}
		return rest_ensure_response( $this->to_item( get_post( $id ) ) );
	}

	public function update( $request ) {
		$id = (int) $request['id'];
		if ( get_post_type( $id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', 'Not found', [ 'status' => 404 ] );
		}
		$body = $request->get_json_params();
		if ( isset( $body['title'] ) ) {
			wp_update_post( [ 'ID' => $id, 'post_title' => sanitize_text_field( $body['title'] ) ] );
		}
		if ( array_key_exists( 'config', $body ) ) {
			update_post_meta( $id, '_trueplayer_config', wp_json_encode( $body['config'] ) );
		}
		if ( array_key_exists( 'tags', $body ) ) {
			$this->set_tags( $id, $body['tags'] );
		}
		return rest_ensure_response( $this->to_item( get_post( $id ) ) );
	}

	public function destroy( $request ) {
		$id = (int) $request['id'];
		if ( get_post_type( $id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', 'Not found', [ 'status' => 404 ] );
		}
		wp_delete_post( $id, true );
		return rest_ensure_response( [ 'deleted' => true ] );
	}

	private function to_item( $post ) {
		$raw    = get_post_meta( $post->ID, '_trueplayer_config', true );
		$config = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : [];
		$terms = wp_get_object_terms( $post->ID, \TruePlayer\Database\PostType::VIDEO_TAXONOMY );
		$tags  = is_wp_error( $terms ) ? [] : wp_list_pluck( $terms, 'name' );
		return [
			'id'        => $post->ID,
			'title'     => $post->post_title,
			'shortcode' => sprintf( '[trueplayer id="%d"]', $post->ID ),
			'config'    => is_array( $config ) ? $config : [],
			'tags'      => array_values( $tags ),
			'modified'  => $post->post_modified_gmt,
		];
	}
}
