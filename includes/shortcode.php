<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * `[trueplayer id="123"]` — renders a mount node the frontend runtime scans
 * for, plus an inline JSON config blob so the player boots without a REST
 * round-trip. The gate check (can I play / is it locked) still happens against
 * the server on mount.
 */
class Shortcode {

	const TAG = 'trueplayer';

	public static function init() {
		$self = new self();
		add_shortcode( self::TAG, [ $self, 'render' ] );
	}

	public function render( $atts ) {
		$atts = shortcode_atts(
			[ 'id' => 0 ],
			$atts,
			self::TAG
		);

		$video_id = (int) $atts['id'];
		if ( ! $video_id || get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return '';
		}

		// Ensure the runtime is on the page.
		wp_enqueue_style( Assets::FRONTEND_STYLE_HANDLE );
		wp_enqueue_script( Assets::FRONTEND_SCRIPT_HANDLE );

		$config = Helper::get_video_config( $video_id );

		// Never leak quiz answer keys into the DOM — grading is server-side.
		$config = self::strip_answer_keys( $config );

		$json = wp_json_encode(
			[
				'videoId' => $video_id,
				'config'  => $config,
			]
		);

		return sprintf(
			'<div class="trueplayer-mount" data-trueplayer data-video-id="%1$d"><script type="application/json" class="trueplayer-config">%2$s</script></div>',
			$video_id,
			$json // already JSON-encoded; rendered inside a JSON script tag.
		);
	}

	/**
	 * Remove `correct`/`answer` keys from any question set before the config
	 * reaches the browser. The gate/grade endpoints hold the source of truth.
	 */
	private static function strip_answer_keys( array $config ): array {
		if ( empty( $config['gating'] ) || ! is_array( $config['gating'] ) ) {
			return $config;
		}
		$gating = $config['gating'];

		$scrub = static function ( $questions ) {
			if ( ! is_array( $questions ) ) {
				return $questions;
			}
			foreach ( $questions as &$q ) {
				unset( $q['correct'], $q['answer'], $q['correctIndex'], $q['correctIndexes'] );
				if ( isset( $q['options'] ) && is_array( $q['options'] ) ) {
					foreach ( $q['options'] as &$opt ) {
						if ( is_array( $opt ) ) {
							unset( $opt['correct'], $opt['isCorrect'] );
						}
					}
					unset( $opt );
				}
			}
			unset( $q );
			return $questions;
		};

		if ( ! empty( $gating['checkpoints'] ) && is_array( $gating['checkpoints'] ) ) {
			foreach ( $gating['checkpoints'] as &$cp ) {
				if ( isset( $cp['questions'] ) ) {
					$cp['questions'] = $scrub( $cp['questions'] );
				}
			}
			unset( $cp );
		}
		if ( ! empty( $gating['finalQuiz']['questions'] ) ) {
			$gating['finalQuiz']['questions'] = $scrub( $gating['finalQuiz']['questions'] );
		}

		$config['gating'] = $gating;
		return $config;
	}
}
