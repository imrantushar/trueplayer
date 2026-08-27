<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\Helper;
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
			'/' . $this->rest_base . '/(?P<id>\d+)/poster',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'save_poster' ],
				'permission_callback' => [ $this, 'can_upload' ],
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

	/**
	 * Marks an attachment as a poster this plugin generated for a given video,
	 * so a later capture can clear the one it replaces without ever touching an
	 * image the author chose themselves.
	 */
	const GENERATED_POSTER_META = '_trueplayer_generated_poster';

	/** Ceiling for a captured frame. A 1280px JPEG lands far under this. */
	const POSTER_MAX_BYTES = 4194304;

	public function admin() {
		return current_user_can( 'manage_options' );
	}

	/** Writing to the media library needs the upload cap on top of admin. */
	public function can_upload() {
		return $this->admin() && current_user_can( 'upload_files' );
	}

	public function index( $request ) {
		$args = [
			'post_type'      => TRUEPLAYER_VIDEO_POST_TYPE,
			'post_status'    => [ 'publish', 'draft' ],
			'posts_per_page' => 500,
			'orderby'        => 'date',
			'order'          => 'DESC',
		];
		// Items on another engine (interactive content) share the tp_video post
		// type but are authored and listed separately, not as players with a
		// source — so the player list excludes them.
		$args['meta_query'] = [
			'relation' => 'OR',
			[ 'key' => \TruePlayer\Database\MetaManager::ENGINE_META, 'compare' => 'NOT EXISTS' ],
			[ 'key' => \TruePlayer\Database\MetaManager::ENGINE_META, 'value' => 'h5p', 'compare' => '!=' ],
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
			// Resolve the provider poster now (Vimeo needs a remote call) so the
			// first page render reads a warm cache instead of paying for it.
			Helper::with_derived_poster( (array) $body['config'] );
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
			// Resolve the provider poster now (Vimeo needs a remote call) so the
			// first page render reads a warm cache instead of paying for it.
			Helper::with_derived_poster( (array) $body['config'] );
			// Now that the config says which poster is in use, any frame
			// captured for this video and then passed over can go.
			$poster = (string) ( $body['config']['source']['poster'] ?? '' );
			$this->prune_generated_posters( $id, $poster ? attachment_url_to_postid( $poster ) : 0 );
		}
		if ( array_key_exists( 'tags', $body ) ) {
			$this->set_tags( $id, $body['tags'] );
		}
		return rest_ensure_response( $this->to_item( get_post( $id ) ) );
	}

	/**
	 * Store a frame the browser captured from a self-hosted video as a media
	 * library image, and hand back its URL for the editor to use as the poster.
	 * The config itself is only written when the author saves, so a capture
	 * they think better of changes nothing that is published.
	 *
	 * The pixels arrive as a raw image body because the server has no way to
	 * produce them itself — decoding video would mean ffmpeg, which no
	 * WordPress host guarantees, so the admin reads the frame off a canvas and
	 * posts it here (admin/utils/frameCapture.js). That makes the body
	 * untrusted input: it is accepted only if PHP can read it as a real image
	 * of a type we allow, and the extension comes from that reading rather
	 * than from anything the client claimed.
	 */
	public function save_poster( $request ) {
		$id = (int) $request['id'];
		if ( get_post_type( $id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', 'Not found', [ 'status' => 404 ] );
		}

		$bytes = (string) $request->get_body();
		if ( '' === $bytes || strlen( $bytes ) > self::POSTER_MAX_BYTES ) {
			return new \WP_Error(
				'tp_poster_invalid',
				__( 'The captured frame was empty or too large to store.', 'trueplayer' ),
				[ 'status' => 400 ]
			);
		}

		$size  = @getimagesizefromstring( $bytes ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- a non-image body is an expected outcome, reported below.
		$types = [ IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp' ];
		$ext   = $size && isset( $types[ $size[2] ] ) ? $types[ $size[2] ] : '';
		if ( ! $ext ) {
			return new \WP_Error(
				'tp_poster_invalid',
				__( 'That frame was not a readable image.', 'trueplayer' ),
				[ 'status' => 400 ]
			);
		}

		$file = wp_upload_bits( $this->poster_filename( $id, $ext, (string) $request->get_param( 'src' ) ), null, $bytes );
		if ( ! empty( $file['error'] ) ) {
			return new \WP_Error( 'tp_poster_write', $file['error'], [ 'status' => 500 ] );
		}

		$title      = get_the_title( $id );
		$attachment = wp_insert_attachment(
			[
				'post_mime_type' => image_type_to_mime_type( $size[2] ),
				'post_title'     => sprintf( /* translators: %s: video title. */ __( '%s poster', 'trueplayer' ), $title ),
				'post_status'    => 'inherit',
			],
			$file['file'],
			$id,
			true
		);
		if ( is_wp_error( $attachment ) ) {
			wp_delete_file( $file['file'] );
			return $attachment;
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';
		wp_update_attachment_metadata( $attachment, wp_generate_attachment_metadata( $attachment, $file['file'] ) );
		update_post_meta( $attachment, '_wp_attachment_image_alt', $title );
		update_post_meta( $attachment, self::GENERATED_POSTER_META, $id );

		return rest_ensure_response(
			[
				'id'  => $attachment,
				'url' => wp_get_attachment_url( $attachment ),
			]
		);
	}

	/**
	 * A filename for a video's poster, named after the video file it came from
	 * so the two sit together in the media library. `wp_upload_bits` de-dupes,
	 * so a re-capture doesn't overwrite an image still in use elsewhere.
	 *
	 * The caller passes the file it actually captured from: a capture fires the
	 * moment a new file is chosen, well before the editor is saved, so the
	 * stored config still names the file being replaced. That is only ever a
	 * filename here, and it is sanitized as one — the extension comes from the
	 * image PHP just read, never from the caller.
	 */
	private function poster_filename( $id, $ext, $src = '' ) {
		if ( '' === $src ) {
			$config = $this->config_of( $id );
			$src    = (string) ( $config['source']['src'] ?? '' );
		}
		$base = $src ? pathinfo( (string) wp_parse_url( $src, PHP_URL_PATH ), PATHINFO_FILENAME ) : '';
		if ( '' === $base ) {
			$base = get_post_field( 'post_name', $id ) ?: 'video-' . $id;
		}
		return sanitize_file_name( $base . '-poster.' . $ext );
	}

	/**
	 * Drop the posters earlier captures generated for this video, so
	 * regenerating — which an author may do several times before settling on a
	 * frame — doesn't leave a trail of orphaned images behind.
	 *
	 * This runs on save rather than on capture, because only the saved config
	 * says which poster is actually in use: pruning as each frame is captured
	 * would delete the live poster of a video whose new capture is then
	 * abandoned, and the published page would 404 its own thumbnail. Abandoned
	 * captures are instead swept up by the next save.
	 *
	 * Only attachments this plugin made for this same video qualify, so a
	 * poster the author chose themselves is never deleted.
	 *
	 * @param int $id   Video id.
	 * @param int $keep Attachment the saved config points at, if any.
	 */
	private function prune_generated_posters( $id, $keep ) {
		$stale = get_posts(
			[
				'post_type'      => 'attachment',
				'post_status'    => 'any',
				'posts_per_page' => 50,
				'fields'         => 'ids',
				'exclude'        => [ $keep ],
				'meta_key'       => self::GENERATED_POSTER_META, // phpcs:ignore WordPress.DB.SlowMetaQuery.slow_db_query -- our own meta, bounded to this video.
				'meta_value'     => $id, // phpcs:ignore WordPress.DB.SlowMetaQuery.slow_db_query
			]
		);
		foreach ( $stale as $attachment ) {
			wp_delete_attachment( $attachment, true );
		}
	}

	/** The stored config for a video, as an array. */
	private function config_of( $id ) {
		$raw    = get_post_meta( $id, '_trueplayer_config', true );
		$config = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : [];
		return is_array( $config ) ? $config : [];
	}

	public function destroy( $request ) {
		$id = (int) $request['id'];
		if ( get_post_type( $id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new \WP_Error( 'not_found', 'Not found', [ 'status' => 404 ] );
		}
		// Deleting a post re-parents its attachments rather than removing them,
		// so a poster we generated would outlive the only video that used it.
		$this->prune_generated_posters( $id, 0 );
		wp_delete_post( $id, true );
		return rest_ensure_response( [ 'deleted' => true ] );
	}

	private function to_item( $post ) {
		$terms = wp_get_object_terms( $post->ID, \TruePlayer\Database\PostType::VIDEO_TAXONOMY );
		$tags  = is_wp_error( $terms ) ? [] : wp_list_pluck( $terms, 'name' );
		return [
			'id'        => $post->ID,
			'title'     => $post->post_title,
			'shortcode' => sprintf( '[trueplayer id="%d"]', $post->ID ),
			'config'    => $this->config_of( $post->ID ),
			'tags'      => array_values( $tags ),
			'modified'  => $post->post_modified_gmt,
		];
	}
}
