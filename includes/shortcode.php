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
	 * When the video has a QuizPress-sourced checkpoint/final quiz, put
	 * QuizPress's own frontend bundle on the page — already registered by
	 * QuizPress itself, never bundled/duplicated here. That bundle registers
	 * the `quizpress.question-answer-widget.content` / `quizpress.submit-
	 * question-answer` `@wordpress/hooks` filters the player's stepper reads
	 * (see QuizpressQuiz.jsx) — mirrors Academy LMS's own
	 * `AcademyQuizpress\Frontend::maybe_enqueue_quizpress_player()`.
	 */
	private static function maybe_enqueue_quizpress( array $config ) {
		$gating = is_array( $config['gating'] ?? null ) ? $config['gating'] : [];
		$uses_quizpress = static function ( $quiz ) {
			return is_array( $quiz ) && 'quizpress' === ( $quiz['source'] ?? '' ) && ! empty( $quiz['quizpressId'] );
		};
		$has_quizpress = $uses_quizpress( $gating['finalQuiz'] ?? null );
		if ( ! $has_quizpress && ! empty( $gating['checkpoints'] ) && is_array( $gating['checkpoints'] ) ) {
			foreach ( $gating['checkpoints'] as $cp ) {
				if ( $uses_quizpress( $cp ) ) {
					$has_quizpress = true;
					break;
				}
			}
		}
		if ( ! $has_quizpress || ! wp_script_is( 'quizpress-frontend-scripts', 'registered' ) ) {
			return;
		}
		wp_enqueue_style( 'quizpress-frontend-icon' );
		wp_enqueue_style( 'quizpress-frontend-style' );
		wp_enqueue_script( 'quizpress-frontend-scripts' );
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

		$config = self::resolved_config( $video_id );
		self::maybe_enqueue_quizpress( $config );
		// JSON_HEX_TAG so a `</script>` inside any string (title, caption, filter
		// payload) can't break the inline `<script type="application/json">` block.
		$json   = wp_json_encode( [ 'videoId' => $video_id, 'title' => get_the_title( $video_id ), 'config' => $config ], JSON_HEX_TAG );
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

		// Engine router. Core renders the native player; another engine can claim
		// an item by returning markup from this filter (the interactive addon
		// does, for items authored as H5P). Nothing registered means nothing
		// changes — core carries no knowledge of the other engines.
		$engine = apply_filters( 'trueplayer/render_engine', null, $video_id );
		if ( null !== $engine ) {
			return (string) $engine;
		}

		// Ensure the runtime is on the page.
		wp_enqueue_style( Assets::FRONTEND_STYLE_HANDLE );
		wp_enqueue_script( Assets::FRONTEND_SCRIPT_HANDLE );

		$config = self::resolved_config( $video_id );
		self::maybe_enqueue_quizpress( $config );

		// JSON_HEX_TAG so a `</script>` inside any string (title, caption, filter
		// payload) can't break the inline `<script type="application/json">` block.
		$json = wp_json_encode(
			[
				'videoId' => $video_id,
				'title'   => get_the_title( $video_id ),
				'config'  => $config,
			],
			JSON_HEX_TAG
		);

		$behavior = is_array( $config['customize']['behavior'] ?? null ) ? $config['customize']['behavior'] : [];
		$ap_mode  = $behavior['autoplayMode'] ?? '';
		$autoplay = $ap_mode ? 'off' !== $ap_mode : ! empty( $behavior['autoplay'] );

		// Load strategy — when the real player boots:
		//   facade    (default): a lightweight poster; nothing loads until click.
		//   eager     : boot the player on page load (no facade, no auto-play).
		//   onvisible : boot when scrolled into view (facade until then).
		// Autoplay forces eager (there is nothing to wait for).
		$strategy = in_array( $behavior['loadStrategy'] ?? '', [ 'facade', 'eager', 'onvisible' ], true )
			? $behavior['loadStrategy']
			: 'facade';
		if ( $autoplay ) {
			$strategy = 'eager';
		}
		$use_facade = 'eager' !== $strategy;

		// Dynamic description rendered under the player.
		$description = '';
		if ( ! empty( $config['description'] ) && is_string( $config['description'] ) ) {
			$description = sprintf( '<div class="tp-description">%s</div>', wp_kses_post( wpautop( $config['description'] ) ) );
		}

		$attrs = sprintf( ' data-tp-load="%s"', esc_attr( $strategy ) );
		if ( $autoplay ) {
			$attrs .= ' data-tp-autoplay="1"';
		}

		return self::video_schema( $video_id, $config ) . self::custom_css( $video_id, $config ) . sprintf(
			'<div class="trueplayer-mount tp-v%1$d" data-trueplayer data-video-id="%1$d"%4$s><script type="application/json" class="trueplayer-config">%2$s</script>%3$s</div>%5$s',
			$video_id,
			$json, // already JSON-encoded; rendered inside a JSON script tag.
			$use_facade ? self::render_facade( $config ) : '',
			$attrs,
			$description
		);
	}

	/**
	 * The full frontend config pipeline, shared by the inline and popup embeds:
	 * raw meta → preset merge → free clamp → pro layer/watermark/private-source
	 * preparation → answer-key strip.
	 */
	public static function resolved_config( int $video_id ): array {
		// Resolve the media type FIRST. Everything downstream branches on it —
		// the preset merge picks a video or an audio default, the facade picks
		// its shape — and an item that was never explicitly marked (an import, a
		// pasted URL, anything predating first-class audio) has no answer until
		// this runs. Read-time only; nothing is written back.
		$config = Media::normalize_config( Helper::get_video_config( $video_id ) );
		$config = Helper::apply_preset( $config );
		$config = Helper::with_derived_poster( $config );
		$config = Helper::apply_global_branding( $config );
		$config = Helper::enforce_pro_limits( $config );
		if ( Pro::active() ) {
			$config = self::prepare_layers( $config );
			$config = self::prepare_timed_content( $config );
			$config = self::prepare_watermark( $config );

			/**
			 * Last chance to turn a stored identifier into a playable URL.
			 *
			 * Some sources are stored as a provider's own id rather than a URL
			 * — a Gumlet video saved mid-encode has an asset id and nothing to
			 * play yet — and only the addon that talks to that provider can
			 * resolve one. Runs before signing, since there is nothing to sign
			 * until a URL exists.
			 *
			 * @param array $config   The resolved config.
			 * @param int   $video_id The video being rendered.
			 */
			$config = (array) apply_filters( 'trueplayer/source/resolve', $config, $video_id );

			$config = PrivateVideo::prepare_source( $config, $video_id );
		}
		return self::strip_answer_keys( $config );
	}

	/**
	 * Shortcode layers can't run PHP in the browser — render them now and ship
	 * the HTML. Admin-authored content (manage_options), so shortcodes are
	 * trusted the same way post content is.
	 */
	private static function prepare_layers( array $config ): array {
		if ( empty( $config['layers'] ) || ! is_array( $config['layers'] ) ) {
			return $config;
		}
		foreach ( $config['layers'] as &$layer ) {
			if ( ( $layer['type'] ?? '' ) === 'shortcode' && ! empty( $layer['shortcode'] ) ) {
				$layer['html'] = do_shortcode( wp_kses_post( (string) $layer['shortcode'] ) );
				unset( $layer['shortcode'] );
			}
		}
		unset( $layer );
		return $config;
	}

	/**
	 * Pre-render timed-content segments server-side: shortcodes resolved, HTML
	 * sanitized, exposed as `html` so the client renders trusted markup and
	 * never runs shortcodes itself. The raw `content` is dropped from output.
	 */
	private static function prepare_timed_content( array $config ): array {
		if ( empty( $config['timedContent']['items'] ) || ! is_array( $config['timedContent']['items'] ) ) {
			return $config;
		}
		foreach ( $config['timedContent']['items'] as &$item ) {
			$content      = (string) ( $item['content'] ?? '' );
			$item['html'] = '' !== $content ? do_shortcode( wp_kses_post( $content ) ) : '';
			unset( $item['content'] );
		}
		unset( $item );
		return $config;
	}

	/**
	 * Resolve the dynamic-watermark display text server-side (the browser never
	 * decides what identity to burn in).
	 */
	private static function prepare_watermark( array $config ): array {
		$wm = $config['protection']['dynamicWatermark'] ?? null;
		if ( empty( $wm['enabled'] ) ) {
			return $config;
		}
		$fields = is_array( $wm['fields'] ?? null ) ? $wm['fields'] : [ 'email' ];
		$parts  = [];
		$user   = wp_get_current_user();
		foreach ( $fields as $f ) {
			if ( 'email' === $f && $user && $user->exists() ) {
				$parts[] = $user->user_email;
			} elseif ( 'name' === $f && $user && $user->exists() ) {
				$parts[] = $user->display_name;
			} elseif ( 'ip' === $f && ! empty( $_SERVER['REMOTE_ADDR'] ) ) {
				$parts[] = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
			}
		}
		$config['protection']['dynamicWatermark']['text'] = implode( ' · ', array_filter( $parts ) );
		return $config;
	}

	/**
	 * Per-video custom CSS (`customize.css`, preset-mergeable). Tag content is
	 * neutralized so the style block can't be broken out of. The mount carries
	 * a `tp-v{ID}` class for scoping.
	 */
	private static function custom_css( int $video_id, array $config ): string {
		$css = $config['customize']['css'] ?? '';
		if ( ! is_string( $css ) || '' === trim( $css ) ) {
			return '';
		}
		$css = wp_strip_all_tags( $css );
		return sprintf( '<style id="tp-custom-css-%d">%s</style>', $video_id, $css );
	}

	/**
	 * VideoObject JSON-LD for SEO (Google video rich results). Requires a
	 * thumbnail — provider posters are derived upstream (Helper::with_derived_poster)
	 * when none is set. Filterable/disable-able via `trueplayer/seo_schema`.
	 */
	private static function video_schema( int $video_id, array $config ): string {
		$source = is_array( $config['source'] ?? null ) ? $config['source'] : [];
		$poster = is_string( $source['poster'] ?? null ) ? $source['poster'] : '';
		// Google requires a thumbnail — skip schema rather than emit an invalid one.
		if ( '' === $poster ) {
			return '';
		}
		$post   = get_post( $video_id );
		$schema = [
			'@context'     => 'https://schema.org',
			// An audio item described as a VideoObject is simply wrong data for
			// search engines, and the thumbnail requirement below reads as cover
			// art rather than a video still.
			'@type'        => Media::is_audio( $source ) ? 'AudioObject' : 'VideoObject',
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
		/**
		 * JSON_HEX_TAG is load-bearing, not tidiness.
		 *
		 * json_encode does not escape `<` or `>`, and JSON_UNESCAPED_SLASHES
		 * stops `/` being escaped too — so any schema string containing the
		 * literal text `</script>` closed this block early and everything after
		 * it was parsed as HTML. `name` is the raw post title, and the
		 * `trueplayer/seo_schema` filter lets an addon put anything it likes in
		 * here, so "no input path can produce that" is not a property this
		 * function can rely on. HEX_TAG encodes both angle brackets as \u003C /
		 * \u003E, which is still valid JSON-LD and cannot break out; the
		 * slashes stay unescaped so URLs read normally.
		 */
		return sprintf(
			'<script type="application/ld+json">%s</script>',
			wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG )
		);
	}

	/**
	 * Static poster + play button rendered up front so a page with videos stays
	 * fast: nothing heavy (video element, YouTube/Vimeo iframe, hls.js, gate
	 * request) loads until the visitor clicks this. Pure HTML — no JS needed to
	 * paint it. Skipped when autoplay is on.
	 */
	private static function render_facade( array $config ): string {
		$source = is_array( $config['source'] ?? null ) ? $config['source'] : [];
		// Detected, not merely declared. The facade is painted before any script
		// runs, so if it disagrees with what the player will build the visitor
		// sees a 16:9 black box collapse into an audio bar on boot. Callers pass
		// a normalized config already; this re-resolves cheaply so a future one
		// that doesn't can't reintroduce the flash.
		$is_audio = Media::is_audio( $source );
		$poster   = is_string( $source['poster'] ?? null ) ? $source['poster'] : '';

		$accent = $config['customize']['appearance']['accent'] ?? ( $config['branding']['accent'] ?? '' );
		$ratio  = $config['customize']['appearance']['aspectRatio'] ?? '';
		$rules  = [];
		if ( $accent ) {
			$rules[] = '--tp-accent:' . $accent;
		}
		// Match the player's aspect ratio so the boot swap causes no layout shift.
		if ( $ratio && '16:9' !== $ratio && ! $is_audio && preg_match( '/^\d+:\d+$/', $ratio ) ) {
			$rules[] = 'aspect-ratio:' . str_replace( ':', ' / ', $ratio );
		}
		$style = $rules ? sprintf( ' style="%s"', esc_attr( implode( ';', $rules ) ) ) : '';
		// A derived poster asks for the widest size first, which YouTube 404s
		// on non-HD uploads — the rest of the chain rides on the tag for the
		// runtime to step through (mount.js: attachPosterFallback).
		$fallbacks = array_values( array_filter( (array) ( $source['posterFallbacks'] ?? [] ), 'is_string' ) );
		$chain     = $fallbacks
			? sprintf( ' data-tp-poster-fallback="%s"', esc_attr( wp_json_encode( $fallbacks ) ) )
			: '';
		$img = $poster
			? sprintf(
				'<img class="tp-facade-poster" src="%s" alt="" loading="lazy" decoding="async"%s />',
				esc_url( $poster ),
				$chain
			)
			: '';

		return sprintf(
			'<button type="button" class="tp-facade%1$s"%2$s aria-label="%3$s">%4$s<span class="tp-facade-btn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></button>',
			$is_audio ? ' is-audio' : '',
			$style,
			$is_audio ? esc_attr__( 'Play audio', 'trueplayer' ) : esc_attr__( 'Play video', 'trueplayer' ),
			$img
		);
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
