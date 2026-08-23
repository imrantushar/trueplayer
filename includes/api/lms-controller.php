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
 *
 * Lessons come from each course's own `academy_course_curriculum` meta, not
 * from a `get_posts()` on the `academy_lessons` post type: Academy registers
 * that post type but keeps the rows in its own `wp_academy_lessons` table, so
 * a post query silently returns nothing. Reading the curriculum also scopes
 * the list to the chosen course instead of offering every lesson on the site.
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
			return rest_ensure_response( [ 'available' => false, 'courses' => [] ] );
		}
		if ( ! post_type_exists( 'academy_courses' ) ) {
			return rest_ensure_response( [ 'available' => false, 'courses' => [] ] );
		}

		$courses = get_posts(
			[
				'post_type'      => 'academy_courses',
				'post_status'    => 'publish',
				'posts_per_page' => 200,
				'orderby'        => 'title',
				'order'          => 'ASC',
			]
		);

		return rest_ensure_response(
			[
				'available' => true,
				'courses'   => array_map(
					static function ( $course ) {
						return [
							'id'      => $course->ID,
							'title'   => $course->post_title,
							'lessons' => self::lessons_of( $course->ID ),
						];
					},
					$courses
				),
			]
		);
	}

	/**
	 * The lesson topics of one course, in curriculum order.
	 *
	 * The curriculum is a list of sections, each holding `topics` of mixed type
	 * (`lesson`, `quiz`, …). Only lessons are offered here, matching what the
	 * academy-sync addon marks complete.
	 *
	 * @param int $course_id Academy course post ID.
	 * @return array<int, array{id:int, title:string}>
	 */
	private static function lessons_of( int $course_id ): array {
		$curriculum = get_post_meta( $course_id, 'academy_course_curriculum', true );
		if ( ! is_array( $curriculum ) ) {
			return [];
		}

		$out = [];
		foreach ( $curriculum as $section ) {
			foreach ( (array) ( $section['topics'] ?? [] ) as $topic ) {
				$id = (int) ( $topic['id'] ?? 0 );
				if ( ! $id || 'lesson' !== ( $topic['type'] ?? '' ) ) {
					continue;
				}
				$out[] = [
					'id'    => $id,
					'title' => (string) ( $topic['name'] ?? sprintf( 'Lesson %d', $id ) ),
				];
			}
		}
		return $out;
	}
}
