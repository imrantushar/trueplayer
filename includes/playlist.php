<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Playlists — group several videos and render them as a grid or a sidebar
 * (main player + list). CPT `tp_playlist` holds the config JSON:
 *   { title, layout:'sidebar'|'grid', videos:[ids], autoplayNext, showTitles }
 *
 * `[trueplayer_playlist id="N"]` renders a mount node; the frontend Playlist
 * component reads the inline member payloads (each video's stripped config).
 */
class Playlist {

	const POST_TYPE = 'tp_playlist';
	const TAG       = 'trueplayer_playlist';

	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'register_cpt' ] );
		add_shortcode( self::TAG, [ $self, 'render' ] );
	}

	public function register_cpt() {
		register_post_type(
			self::POST_TYPE,
			[
				'label'               => __( 'Playlists', 'trueplayer' ),
				'public'              => false,
				'show_ui'             => false,
				'show_in_menu'        => false,
				'show_in_rest'        => false,
				'supports'            => [ 'title' ],
				'exclude_from_search' => true,
			]
		);
		register_post_meta(
			self::POST_TYPE,
			'_trueplayer_playlist',
			[
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => false,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			]
		);
	}

	public static function get_config( $playlist_id ) {
		$raw = get_post_meta( (int) $playlist_id, '_trueplayer_playlist', true );
		$cfg = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : ( is_array( $raw ) ? $raw : [] );
		return is_array( $cfg ) ? $cfg : [];
	}

	/**
	 * Build the client payload for one video (id, title, poster, stripped config).
	 */
	public static function video_payload( $video_id ) {
		$video_id = (int) $video_id;
		if ( get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return null;
		}
		$config = Shortcode::strip_answer_keys( Helper::with_derived_poster( Helper::apply_preset( Helper::get_video_config( $video_id ) ) ) );
		return [
			'videoId' => $video_id,
			'title'   => get_the_title( $video_id ),
			'poster'  => $config['source']['poster'] ?? '',
			'config'  => $config,
		];
	}

	public function render( $atts ) {
		$atts        = shortcode_atts( [ 'id' => 0 ], $atts, self::TAG );
		$playlist_id = (int) $atts['id'];
		if ( ! $playlist_id || get_post_type( $playlist_id ) !== self::POST_TYPE ) {
			return '';
		}

		$cfg   = self::get_config( $playlist_id );
		$items = [];
		foreach ( (array) ( $cfg['videos'] ?? [] ) as $vid ) {
			$payload = self::video_payload( $vid );
			if ( $payload ) {
				$items[] = $payload;
			}
		}
		if ( empty( $items ) ) {
			return '';
		}

		wp_enqueue_style( Assets::FRONTEND_STYLE_HANDLE );
		wp_enqueue_script( Assets::FRONTEND_SCRIPT_HANDLE );

		$data = [
			'title'        => $cfg['title'] ?? get_the_title( $playlist_id ),
			'layout'       => in_array( $cfg['layout'] ?? 'sidebar', [ 'sidebar', 'grid' ], true ) ? $cfg['layout'] : 'sidebar',
			'autoplayNext' => ! empty( $cfg['autoplayNext'] ),
			'showTitles'   => ! isset( $cfg['showTitles'] ) || ! empty( $cfg['showTitles'] ),
			'items'        => $items,
		];

		return sprintf(
			'<div class="trueplayer-playlist" data-trueplayer-playlist><script type="application/json" class="trueplayer-playlist-config">%s</script></div>',
			wp_json_encode( $data )
		);
	}
}
