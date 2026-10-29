<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\API\VideosController;

/**
 * Registers the dynamic `trueplayer/player` block. Render is delegated to the
 * shortcode so there is a single embed code path (and answer-key stripping,
 * gate wiring, etc. all live in one place).
 */
class Block {

	const SCRIPT_HANDLE = 'trueplayer-block';
	const GLOBAL_OBJECT = 'TruePlayerBlock';

	/** Sources an inline block may name. Mirrors VideosController::QUICK_SOURCE_TYPES. */
	const SOURCE_TYPES = [ 'self', 'youtube', 'vimeo', 'url' ];

	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'register' ] );
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
		add_action( 'enqueue_block_editor_assets', [ $self, 'editor_assets' ] );
		add_action( 'enqueue_block_assets', [ $self, 'canvas_assets' ] );
	}

	public function register() {
		// Attributes, supports and metadata live in blocks/player/block.json;
		// the editor script imports the same file, so the two cannot drift.
		register_block_type(
			TRUEPLAYER_ROOT_DIR_PATH . 'blocks/player',
			[ 'render_callback' => [ $this, 'render' ] ]
		);
	}

	public function register_routes() {
		// Stateless preview: the block has no library post to ask about, so the
		// editor sends its attributes and gets back the config the page will use.
		register_rest_route(
			'trueplayer/v1',
			'/block/preview',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'preview' ],
				'permission_callback' => [ VideosController::class, 'can_browse' ],
			]
		);
	}

	public function preview( $request ) {
		$attributes = (array) $request->get_json_params();
		$resolved   = self::resolve( $attributes );
		if ( ! $resolved ) {
			return new \WP_Error( 'tp_source_src', __( 'Choose a file or paste a link first.', 'trueplayer' ), [ 'status' => 400 ] );
		}
		// A saved video is only previewable by someone who may edit it.
		if ( ! empty( $attributes['videoId'] ) && ! current_user_can( 'edit_post', (int) $attributes['videoId'] ) ) {
			return new \WP_Error( 'rest_forbidden', __( 'Sorry, you are not allowed to do that.', 'trueplayer' ), [ 'status' => 403 ] );
		}
		return rest_ensure_response( $resolved );
	}

	/**
	 * What the block will publish: a library video or an inline source, with the
	 * block's own settings layered on top. Shared by render and preview so the
	 * canvas can never differ from the page.
	 *
	 * @return array{id:int,title:string,config:array}|null
	 */
	public static function resolve( array $attributes ): ?array {
		$id = isset( $attributes['videoId'] ) ? (int) $attributes['videoId'] : 0;

		if ( $id ) {
			if ( get_post_type( $id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
				return null;
			}
			$config = Shortcode::resolved_config( $id );
			$over   = self::overrides_from_attributes( $attributes );
			// Never let a block swap the saved video's preset from here.
			unset( $over['presetId'] );
			if ( ! empty( $over['customize'] ) ) {
				$config['customize'] = array_replace_recursive( is_array( $config['customize'] ?? null ) ? $config['customize'] : [], $over['customize'] );
				// Closed lists replace rather than merge element by element.
			}
			foreach ( [ 'chapters', 'description' ] as $key ) {
				if ( ! empty( $over[ $key ] ) ) {
					$config[ $key ] = $over[ $key ];
				}
			}
			return [ 'id' => $id, 'title' => get_the_title( $id ), 'config' => $config ];
		}

		$config = self::config_from_attributes( $attributes );
		if ( ! $config ) {
			return null;
		}
		$inline = self::inline_id( $config );
		return [
			'id'     => $inline,
			'title'  => self::inline_title( $attributes, $config ),
			'config' => Shortcode::finish_config( $config, $inline ),
		];
	}

	public function render( $attributes ) {
		$id = isset( $attributes['videoId'] ) ? (int) $attributes['videoId'] : 0;

		if ( $id && ! self::has_overrides( (array) $attributes ) ) {
			// A saved library video with nothing changed, exactly as before.
			$html = do_shortcode( sprintf( '[trueplayer id="%d"]', $id ) );
		} else {
			$resolved = self::resolve( (array) $attributes );
			if ( ! $resolved ) {
				return '';
			}
			// Another engine may own this item (same router the shortcode uses).
			$engine = $id ? apply_filters( 'trueplayer/render_engine', null, $id ) : null;
			$html   = null !== $engine ? (string) $engine : Shortcode::embed( $resolved['id'], $resolved['title'], $resolved['config'] );
		}

		if ( '' === $html ) {
			return '';
		}
		// The wrapper carries alignment, spacing, anchor and custom class.
		return sprintf( '<div %s>%s</div>', get_block_wrapper_attributes(), $html );
	}

	/** Whether the block sets anything beyond which video it shows. */
	private static function has_overrides( array $a ): bool {
		$over = self::overrides_from_attributes( $a );
		unset( $over['presetId'] );
		return ! empty( $over );
	}

	/**
	 * A player config built from nothing but the block's own attributes.
	 *
	 * Attributes come from whoever can edit the post, not from an administrator,
	 * so every value is checked against a whitelist or a validator here — the
	 * same strictness as the quick-create route. Anything the author left alone
	 * is omitted rather than defaulted, which is what lets the site-wide
	 * defaults (and the built-in ones) keep applying underneath.
	 *
	 * @param array $a Block attributes.
	 * @return array Config, or [] when there is no usable source.
	 */
	public static function config_from_attributes( array $a ): array {
		$type = isset( $a['sourceType'] ) ? (string) $a['sourceType'] : '';
		if ( ! in_array( $type, self::SOURCE_TYPES, true ) ) {
			return [];
		}
		$src = Helper::sanitize_source_src( $type, isset( $a['src'] ) ? (string) $a['src'] : '' );
		if ( '' === $src ) {
			return [];
		}

		$config           = self::overrides_from_attributes( $a );
		$config['source'] = self::source_from_attributes( $a, $type, $src );
		return $config;
	}

	/** The `source` block of an inline embed. */
	private static function source_from_attributes( array $a, string $type, string $src ): array {
		$source = [ 'type' => $type, 'src' => $src ];
		$poster = esc_url_raw( isset( $a['poster'] ) ? (string) $a['poster'] : '', [ 'http', 'https' ] );
		if ( '' !== $poster ) {
			$source['poster'] = $poster;
		}
		$caption = esc_url_raw( isset( $a['captionUrl'] ) ? (string) $a['captionUrl'] : '', [ 'http', 'https' ] );
		if ( '' !== $caption && 'self' === $type ) {
			$lang                 = isset( $a['captionLang'] ) ? preg_replace( '/[^A-Za-z-]/', '', (string) $a['captionLang'] ) : '';
			$source['subtitles'] = [
				[
					'src'     => $caption,
					'label'   => sanitize_text_field( isset( $a['captionLabel'] ) ? (string) $a['captionLabel'] : '' ),
					'srclang' => substr( (string) $lang, 0, 12 ),
					'default' => true,
				],
			];
		}

		$media_type = isset( $a['mediaType'] ) ? (string) $a['mediaType'] : '';
		if ( in_array( $media_type, [ 'audio', 'video' ], true ) ) {
			$source['mediaType'] = $media_type;
		}
		return $source;
	}

	/**
	 * Everything the block can set that is not the source: look, behaviour,
	 * controls, chapters, description, preset. Valid for either mode.
	 */
	private static function overrides_from_attributes( array $a ): array {
		$appearance = [];
		$aspect     = isset( $a['aspectRatio'] ) ? (string) $a['aspectRatio'] : '';
		if ( in_array( $aspect, [ '16:9', '9:16', '4:3', '1:1', '21:9', 'auto' ], true ) ) {
			$appearance['aspectRatio'] = $aspect;
		}
		$skin = isset( $a['skin'] ) ? (string) $a['skin'] : '';
		if ( in_array( $skin, [ 'default', 'modern', 'simple', 'minimal', 'standard' ], true ) ) {
			$appearance['skin'] = $skin;
		}
		$accent = Helper::sanitize_css_color( isset( $a['accent'] ) ? $a['accent'] : '' );
		if ( '' !== $accent ) {
			$appearance['accent'] = $accent;
		}
		$hover = Helper::sanitize_css_color( isset( $a['hoverColor'] ) ? $a['hoverColor'] : '' );
		if ( '' !== $hover ) {
			$appearance['hoverColor'] = $hover;
		}
		$play_style = isset( $a['playButtonStyle'] ) ? (string) $a['playButtonStyle'] : '';
		if ( in_array( $play_style, [ 'circle', 'soft', 'square' ], true ) ) {
			$appearance['playButtonStyle'] = $play_style;
		}
		$play_size = isset( $a['playButtonSize'] ) ? (int) $a['playButtonSize'] : 0;
		if ( in_array( $play_size, [ 56, 72, 88, 108 ], true ) ) {
			$appearance['playButtonSize'] = $play_size;
		}
		$seek_bar = isset( $a['seekBarStyle'] ) ? (string) $a['seekBarStyle'] : '';
		if ( in_array( $seek_bar, [ 'default', 'waveform' ], true ) ) {
			$appearance['seekBarStyle'] = $seek_bar;
		}

		$behavior = [];
		$mode     = isset( $a['autoplayMode'] ) ? (string) $a['autoplayMode'] : '';
		if ( in_array( $mode, [ 'off', 'muted', 'sound' ], true ) ) {
			$behavior['autoplayMode'] = $mode;
		}
		foreach ( [ 'muted', 'loop', 'sticky' ] as $flag ) {
			if ( ! empty( $a[ $flag ] ) ) {
				$behavior[ $flag ] = true;
			}
		}
		// Remembering where a viewer stopped is on unless the author opts out.
		if ( isset( $a['resume'] ) && ! $a['resume'] ) {
			$behavior['savePosition'] = false;
		}
		$preload = isset( $a['preload'] ) ? (string) $a['preload'] : '';
		if ( in_array( $preload, [ 'auto', 'metadata', 'none' ], true ) ) {
			$behavior['preload'] = $preload;
		}
		$strategy = isset( $a['loadStrategy'] ) ? (string) $a['loadStrategy'] : '';
		if ( in_array( $strategy, [ 'facade', 'eager', 'onvisible' ], true ) ) {
			$behavior['loadStrategy'] = $strategy;
		}

		$controls = [];
		if ( isset( $a['controls'] ) && ! $a['controls'] ) {
			// "Controls off" keeps the play button and drops the rest of the bar.
			foreach ( [ 'rewind', 'forward', 'progress', 'currentTime', 'duration', 'mute', 'volume', 'captions', 'chapters', 'settings', 'pip', 'fullscreen' ] as $key ) {
				$controls[ $key ] = false;
			}
		}
		if ( ! empty( $a['download'] ) ) {
			$controls['download'] = true;
		}

		$customize = array_filter(
			[ 'appearance' => $appearance, 'behavior' => $behavior, 'controls' => $controls ]
		);

		$config = [];
		if ( $customize ) {
			$config['customize'] = $customize;
		}

		$chapters = self::parse_chapters( isset( $a['chapters'] ) ? (string) $a['chapters'] : '' );
		if ( $chapters ) {
			$config['chapters'] = $chapters;
		}

		$description = wp_kses_post( isset( $a['description'] ) ? (string) $a['description'] : '' );
		if ( '' !== trim( $description ) ) {
			$config['description'] = $description;
		}

		$preset = isset( $a['presetId'] ) ? (int) $a['presetId'] : 0;
		if ( $preset && get_post_type( $preset ) === TRUEPLAYER_PRESET_POST_TYPE ) {
			$config['presetId'] = $preset;
		}
		return $config;
	}

	/**
	 * "0:00 Intro" lines → [ { at, label } ], sorted, capped.
	 *
	 * Accepts the shapes people paste from a YouTube description: `0:00 Intro`,
	 * `[1:30] Topic`, `01:02:03 - Wrap up`.
	 */
	public static function parse_chapters( string $text ): array {
		$out = [];
		foreach ( preg_split( '/\r\n|\r|\n/', $text ) as $line ) {
			if ( ! preg_match( '/^\s*\[?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]?\s*[-–—:]?\s*(.+?)\s*$/u', $line, $m ) ) {
				continue;
			}
			$label = sanitize_text_field( $m[4] );
			if ( '' === $label ) {
				continue;
			}
			$out[] = [ 'at' => (int) $m[1] * 3600 + (int) $m[2] * 60 + (int) $m[3], 'label' => $label ];
		}
		usort( $out, static fn( $x, $y ) => $x['at'] <=> $y['at'] );
		return array_slice( $out, 0, 60 );
	}

	/**
	 * A stable stand-in for a post id, so resume-position and analytics keys
	 * stay put for an embed that has no library post. Offset far above any real
	 * post id so it can never name one.
	 */
	public static function inline_id( array $config ): int {
		$src = (string) ( $config['source']['src'] ?? '' );
		return 1000000000 + ( (int) sprintf( '%u', crc32( $src ) ) % 1000000000 );
	}

	private static function inline_title( array $attributes, array $config ): string {
		$title = sanitize_text_field( isset( $attributes['title'] ) ? (string) $attributes['title'] : '' );
		if ( '' !== $title ) {
			return $title;
		}
		$path = (string) wp_parse_url( (string) ( $config['source']['src'] ?? '' ), PHP_URL_PATH );
		return sanitize_text_field( rawurldecode( basename( $path ) ) );
	}

	public function editor_assets() {
		$deps = Assets::build_dir() . sprintf( 'block.%s.asset.php', TRUEPLAYER_VERSION );
		$asset = file_exists( $deps ) ? include $deps : [ 'dependencies' => [], 'version' => TRUEPLAYER_VERSION ];

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			Assets::build_uri() . sprintf( 'block.%s.js', TRUEPLAYER_VERSION ),
			$asset['dependencies'],
			$asset['version'],
			true
		);

		wp_localize_script( self::SCRIPT_HANDLE, self::GLOBAL_OBJECT, $this->editor_data() );
		// The in-canvas preview renders the real frontend player, which reads
		// its site-wide defaults from this object exactly as it
		// does on a published page. Without it the preview would quietly fall
		// back to the built-in defaults and stop matching what visitors see.
		wp_localize_script( self::SCRIPT_HANDLE, Assets::GLOBAL_OBJECT, ( new Assets() )->get_frontend_scripts_data() );
		wp_set_script_translations( self::SCRIPT_HANDLE, 'trueplayer', TRUEPLAYER_ROOT_DIR_PATH . 'languages/' );
	}

	/**
	 * The player's stylesheet, inside the editor canvas.
	 *
	 * `enqueue_block_assets` is the hook whose styles WordPress injects into the
	 * iframed canvas — `enqueue_block_editor_assets` only reaches the document
	 * around it, where nothing of ours renders. The stylesheet is the frontend
	 * one, unmodified, because the preview is the frontend player.
	 *
	 * It is NOT imported by the block's JS: sharing a CSS module across two
	 * webpack entries makes the `style` cacheGroup merge them and stop emitting
	 * one of the stylesheets, which is how the real frontend player once ended
	 * up unstyled in production.
	 */
	public function canvas_assets(): void {
		// This hook also fires on the front end, where the shortcode already
		// enqueues the stylesheet on demand — only pages with a player pay for
		// it there, and that should stay true.
		if ( ! is_admin() ) {
			return;
		}
		$file = Assets::build_dir() . 'style-frontend.css';
		wp_enqueue_style(
			'trueplayer-block-canvas',
			Assets::build_uri() . 'style-frontend.css',
			[],
			file_exists( $file ) ? filemtime( $file ) : TRUEPLAYER_VERSION
		);
	}

	/**
	 * What the block editor is told about TruePlayer.
	 *
	 * Deliberately not the admin app's payload (see Assets::get_backend_scripts_data):
	 * this is the block's own chrome — who it is talking to and where the full
	 * editor lives — and nothing more. The player's runtime state rides
	 * separately under TruePlayerGlobal, and the block's own REST calls
	 * authenticate through @wordpress/api-fetch.
	 */
	private function editor_data(): array {
		// `manage_options`, matching the admin menu — an author can create a
		// video from the block but has nowhere to open it, so they are not
		// offered a link into a screen they cannot load.
		$can_manage = current_user_can( 'manage_options' );

		return apply_filters(
			'trueplayer/block/editor_data',
			[
				'brand'      => Helper::brand_name(),
				// The same mark the admin menu uses: a white-label logo, else the video dashicon.
				'logo'       => (string) Helper::brand_logo(),
				'presets'    => $this->preset_options(),
				// Mirrors the REST permission callback rather than restating
				// it, so the dialog can never be offered to someone the
				// endpoint would refuse.
				'canCreate'  => VideosController::can_quick_create(),
				'libraryUrl' => $can_manage ? admin_url( 'admin.php?page=trueplayer-videos' ) : '',
				'editUrl'    => $can_manage ? admin_url( 'admin.php?page=trueplayer-videos&action=edit&id=' ) : '',
			]
		);
	}

	/** Saved presets an author may apply, as id + title + media type. */
	private function preset_options(): array {
		if ( ! VideosController::can_browse() ) {
			return [];
		}
		$posts = get_posts(
			[
				'post_type'      => TRUEPLAYER_PRESET_POST_TYPE,
				'post_status'    => 'publish',
				'posts_per_page' => 100,
				'orderby'        => 'title',
				'order'          => 'ASC',
			]
		);
		return array_map(
			static fn( $p ) => [
				'id'    => $p->ID,
				'title' => $p->post_title,
				'type'  => Helper::get_preset_type( $p->ID ),
			],
			$posts
		);
	}
}
