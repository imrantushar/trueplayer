<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\Pro;
use WP_REST_Server;

/**
 * Admin-only lookup for the Gating tab (pro): existing QuizPress quizzes to
 * link a checkpoint/final quiz to, in place of authoring questions natively.
 * Empty list when QuizPress isn't installed.
 */
class QuizpressController {

	public function register_routes() {
		register_rest_route(
			TRUEPLAYER_PLUGIN_SLUG . '/v1',
			'/quizpress/options',
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
			return rest_ensure_response( [ 'available' => false, 'quizzes' => [] ] );
		}
		if ( ! post_type_exists( 'quizpress_quiz' ) ) {
			return rest_ensure_response( [ 'available' => false, 'quizzes' => [] ] );
		}

		$quizzes = get_posts(
			[
				'post_type'      => 'quizpress_quiz',
				'post_status'    => 'publish',
				'posts_per_page' => 200,
				'orderby'        => 'title',
				'order'          => 'ASC',
			]
		);

		return rest_ensure_response(
			[
				'available' => true,
				'quizzes'   => array_map(
					static function ( $quiz ) {
						return [
							'id'    => $quiz->ID,
							'title' => $quiz->post_title,
						];
					},
					$quizzes
				),
			]
		);
	}
}
