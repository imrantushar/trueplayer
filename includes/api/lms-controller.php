<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\Pro;
use WP_REST_Server;

/**
 * Admin-only lookups for the LMS progression section (pro): Academy courses
 * and lessons to attach a video to. Empty lists when Academy isn't installed.
 */
class LmsController {

	public function register_routes() {
		register_rest_route(
			TRUEPLAYER_PLUGIN_SLUG . '/v1',
			'/lms/options',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'options' ],
				'permission_callback' => static function () {
					return current_user_can( 'manage_options' );
				},
			]
		);
	}

	public function options() {
		if ( ! Pro::active() ) {
			return rest_ensure_response( [ 'available' => false, 'courses' => [], 'lessons' => [] ] );
		}
		$available = post_type_exists( 'academy_courses' );

		$map = static function ( $post_type ) {
			return array_map(
				static function ( $p ) {
					return [ 'id' => $p->ID, 'title' => $p->post_title ];
				},
				get_posts(
					[
						'post_type'      => $post_type,
						'post_status'    => 'publish',
						'posts_per_page' => 200,
						'orderby'        => 'title',
						'order'          => 'ASC',
					]
				)
			);
		};

		return rest_ensure_response(
			[
				'available' => $available,
				'courses'   => $available ? $map( 'academy_courses' ) : [],
				'lessons'   => post_type_exists( 'academy_lessons' ) ? $map( 'academy_lessons' ) : [],
			]
		);
	}
}
