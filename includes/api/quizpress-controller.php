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
							'id'              => $quiz->ID,
							'title'           => $quiz->post_title,
							'hasManualReview' => self::has_manual_review_question( $quiz->ID ),
						];
					},
					$quizzes
				),
			]
		);
	}

	/**
	 * Whether a quiz contains a manually-reviewed question type (short
	 * answer, paragraph, date, number). QuizPress forces those attempts to
	 * `attempt_status = 'pending'` regardless of score until an admin reviews
	 * them in Quiz Insights — GradingService::grade_quizpress treats that as
	 * its own outcome (never a fail, never locks), but a checkpoint/final
	 * quiz built on one still can't be *passed* until that review happens, so
	 * the Gating tab warns about it up front rather than the admin finding
	 * out from a stuck student.
	 */
	private static function has_manual_review_question( int $quiz_id ): bool {
		if ( ! class_exists( '\\QuizPress\\API\\Query\\Questions' ) ) {
			return false;
		}
		$question_ids = array_column( (array) get_post_meta( $quiz_id, 'quizpress_quiz_questions', true ), 'id' );
		if ( empty( $question_ids ) ) {
			return false;
		}
		return (bool) \QuizPress\API\Query\Questions::is_required_manually_reviewed( $question_ids );
	}
}
