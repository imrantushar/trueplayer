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
		add_shortcode( 'trueplayer_popup', [ $self, 'render_popup' ] );
	}

	/**
	 * `[trueplayer_popup id="N" label="Watch"]` (or wrapping content) — a trigger
	 * that opens the player in a lightbox. Nothing loads until it's clicked.
	 */
	public function render_popup( $atts, $content = '' ) {
		$atts     = shortcode_atts( [ 'id' => 0, 'label' => '' ], $atts, 'trueplayer_popup' );
		$video_id = (int) $atts['id'];
		if ( ! $video_id || get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return '';
		}
		wp_enqueue_style( Assets::FRONTEND_STYLE_HANDLE );
		wp_enqueue_script( Assets::FRONTEND_SCRIPT_HANDLE );

		$config = self::strip_answer_keys( Helper::apply_preset( Helper::get_video_config( $video_id ) ) );
		$json   = wp_json_encode( [ 'videoId' => $video_id, 'title' => get_the_title( $video_id ), 'config' => $config ] );
		$label  = '' !== trim( (string) $content ) ? do_shortcode( $content ) : ( $atts['label'] ?: __( 'Watch video', 'trueplayer' ) );
		$accent = $config['customize']['appearance']['accent'] ?? '';
		$style  = $accent ? sprintf( ' style="--tp-accent:%s"', esc_attr( $accent ) ) : '';

		return sprintf(
			'<span class="trueplayer-popup" data-trueplayer-popup data-video-id="%1$d"%4$s><script type="application/json" class="trueplayer-popup-config">%2$s</script><button type="button" class="trueplayer-popup-trigger"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>%3$s</button></span>',
			$video_id,
			$json,
			wp_kses_post( $label ),
			$style
		);
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

		// Merge a referenced preset under the video's own settings.
		$config = Helper::apply_preset( $config );

		// Never leak quiz answer keys into the DOM — grading is server-side.
		$config = self::strip_answer_keys( $config );

		$json = wp_json_encode(
			[
				'videoId' => $video_id,
				'title'   => get_the_title( $video_id ),
				'config'  => $config,
			]
		);

		$autoplay = ! empty( $config['customize']['behavior']['autoplay'] );

		return self::video_schema( $video_id, $config ) . sprintf(
			'<div class="trueplayer-mount" data-trueplayer data-video-id="%1$d"%4$s><script type="application/json" class="trueplayer-config">%2$s</script>%3$s</div>',
			$video_id,
			$json, // already JSON-encoded; rendered inside a JSON script tag.
			$autoplay ? '' : self::render_facade( $config ),
			$autoplay ? ' data-tp-autoplay="1"' : ''
		);
	}

	/**
	 * VideoObject JSON-LD for SEO (Google video rich results). Requires a
	 * thumbnail — YouTube posters are derived when none is set. Filterable/
	 * disable-able via `trueplayer/seo_schema`.
	 */
	private static function video_schema( int $video_id, array $config ): string {
		$source = is_array( $config['source'] ?? null ) ? $config['source'] : [];
		$poster = is_string( $source['poster'] ?? null ) ? $source['poster'] : '';
		if ( '' === $poster && 'youtube' === ( $source['type'] ?? '' ) ) {
			$yid = self::youtube_id( $source['src'] ?? '' );
			$poster = $yid ? 'https://i.ytimg.com/vi/' . $yid . '/hqdefault.jpg' : '';
		}
		// Google requires a thumbnail — skip schema rather than emit an invalid one.
		if ( '' === $poster ) {
			return '';
		}
		$post   = get_post( $video_id );
		$schema = [
			'@context'     => 'https://schema.org',
			'@type'        => 'VideoObject',
			'name'         => get_the_title( $video_id ),
			'description'  => wp_strip_all_tags( $post && $post->post_excerpt ? $post->post_excerpt : get_the_title( $video_id ) ),
			'thumbnailUrl' => $poster,
			'uploadDate'   => $post ? get_post_time( 'c', true, $post ) : '',
		];
		if ( ! empty( $source['src'] ) && in_array( $source['type'] ?? '', [ 'url', 'hls' ], true ) ) {
			$schema['contentUrl'] = $source['src'];
		}

		$schema = apply_filters( 'trueplayer/seo_schema', $schema, $video_id, $config );
		if ( empty( $schema ) || ! is_array( $schema ) ) {
			return '';
		}
		return sprintf( '<script type="application/ld+json">%s</script>', wp_json_encode( $schema, JSON_UNESCAPED_SLASHES ) );
	}

	/**
	 * Static poster + play button rendered up front so a page with videos stays
	 * fast: nothing heavy (video element, YouTube/Vimeo iframe, hls.js, gate
	 * request) loads until the visitor clicks this. Pure HTML — no JS needed to
	 * paint it. Skipped when autoplay is on.
	 */
	private static function render_facade( array $config ): string {
		$source   = is_array( $config['source'] ?? null ) ? $config['source'] : [];
		$is_audio = ( $source['mediaType'] ?? '' ) === 'audio';
		$poster   = is_string( $source['poster'] ?? null ) ? $source['poster'] : '';

		if ( '' === $poster && 'youtube' === ( $source['type'] ?? '' ) ) {
			$yid = self::youtube_id( $source['src'] ?? '' );
			if ( $yid ) {
				$poster = 'https://i.ytimg.com/vi/' . $yid . '/hqdefault.jpg';
			}
		}

		$accent = $config['customize']['appearance']['accent'] ?? ( $config['branding']['accent'] ?? '' );
		$style  = $accent ? sprintf( ' style="--tp-accent:%s"', esc_attr( $accent ) ) : '';
		$img    = $poster
			? sprintf( '<img class="tp-facade-poster" src="%s" alt="" loading="lazy" decoding="async" />', esc_url( $poster ) )
			: '';

		return sprintf(
			'<button type="button" class="tp-facade%1$s"%2$s aria-label="%3$s">%4$s<span class="tp-facade-btn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></button>',
			$is_audio ? ' is-audio' : '',
			$style,
			esc_attr__( 'Play video', 'trueplayer' ),
			$img
		);
	}

	/** Extract an 11-char YouTube id from a watch/share/embed URL. */
	private static function youtube_id( string $url ): string {
		if ( preg_match( '/(?:v=|\.be\/|embed\/|shorts\/)([\w-]{11})/', $url, $m ) ) {
			return $m[1];
		}
		return '';
	}

	/**
	 * Remove `correct`/`answer` keys from any question set before the config
	 * reaches the browser. The gate/grade endpoints hold the source of truth.
	 */
	public static function strip_answer_keys( array $config ): array {
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
