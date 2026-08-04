<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use WP_Error;
use TruePlayer\H5P\Core;
use TruePlayer\H5P\Module;
use TruePlayer\H5P\Importer;

/**
 * Admin REST for the H5P engine — content-type management, semantics retrieval,
 * and content CRUD. All admin-only.
 *
 * Content is stored in the H5P `contents` table (via H5PCore) and linked to a
 * `tp_video` post (engine = h5p), so H5P items live in the same Library as
 * native videos and reuse the same `[trueplayer id="N"]` embed.
 */
class H5pController extends WP_REST_Controller {

	/**
	 * A curated set of field-based content types the semantics-driven builder
	 * handles well out of the box. One-click installable from the H5P hub.
	 */
	const FEATURED = [
		'H5P.MultiChoice'     => 'Multiple Choice',
		'H5P.TrueFalse'       => 'True/False Question',
		'H5P.Blanks'          => 'Fill in the Blanks',
		'H5P.DragText'        => 'Drag the Words',
		'H5P.MarkTheWords'    => 'Mark the Words',
		'H5P.Accordion'       => 'Accordion',
		'H5P.Summary'         => 'Summary',
		'H5P.QuestionSet'     => 'Question Set (Quiz)',
		'H5P.Flashcards'      => 'Flashcards',
		'H5P.Dialogcards'     => 'Dialog Cards',
	];

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'h5p';
	}

	public function register_routes() {
		$ns = $this->namespace;
		$b  = $this->rest_base;

		register_rest_route( $ns, "/$b/content-types", [
			[ 'methods' => WP_REST_Server::READABLE, 'callback' => [ $this, 'content_types' ], 'permission_callback' => [ $this, 'admin' ] ],
			[ 'methods' => WP_REST_Server::CREATABLE, 'callback' => [ $this, 'install_type' ], 'permission_callback' => [ $this, 'admin' ] ],
		] );

		register_rest_route( $ns, "/$b/items", [
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => [ $this, 'items' ],
			'permission_callback' => [ $this, 'admin' ],
		] );

		register_rest_route( $ns, "/$b/semantics/(?P<name>[A-Za-z0-9._-]+)", [
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => [ $this, 'semantics' ],
			'permission_callback' => [ $this, 'admin' ],
		] );

		register_rest_route( $ns, "/$b/content", [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'save_content' ],
			'permission_callback' => [ $this, 'admin' ],
		] );

		register_rest_route( $ns, "/$b/content/(?P<video>\d+)", [
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_content' ],
			'permission_callback' => [ $this, 'admin' ],
		] );

		// Public runtime endpoint: the frontend xAPI bridge posts completions
		// here. Nonce-verified inside (sendBeacon can't set headers).
		register_rest_route( $ns, "/$b/xapi", [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'xapi' ],
			'permission_callback' => '__return_true',
		] );
	}

	public function admin() {
		return Module::is_available() && current_user_can( 'manage_options' );
	}

	/**
	 * Existing H5P-engine items (tp_video posts on the h5p engine).
	 */
	public function items( $request ) {
		$posts = get_posts( [
			'post_type'      => TRUEPLAYER_VIDEO_POST_TYPE,
			'post_status'    => [ 'publish', 'draft' ],
			'posts_per_page' => 200,
			'meta_key'       => '_trueplayer_engine',
			'meta_value'     => 'h5p',
			'orderby'        => 'modified',
			'order'          => 'DESC',
		] );
		$out = [];
		foreach ( $posts as $post ) {
			$out[] = [
				'video'     => $post->ID,
				'title'     => get_the_title( $post ),
				'shortcode' => sprintf( '[trueplayer id="%d"]', $post->ID ),
				'modified'  => get_the_modified_date( 'c', $post ),
			];
		}
		return rest_ensure_response( $out );
	}

	/**
	 * Installed runnable content types + the featured installable set.
	 */
	public function content_types( $request ) {
		global $wpdb;
		$p         = $wpdb->prefix . 'tp_h5p_';
		$installed = [];
		$rows      = $wpdb->get_results( "SELECT name, title, MAX(CONCAT(major_version,'.',minor_version)) AS version FROM {$p}libraries WHERE runnable = 1 GROUP BY name, title" );
		foreach ( $rows as $r ) {
			$installed[ $r->name ] = [
				'machineName' => $r->name,
				'title'       => $r->title,
				'version'     => $r->version,
				'installed'   => true,
			];
		}

		$featured = [];
		foreach ( self::FEATURED as $machine => $title ) {
			$featured[] = [
				'machineName' => $machine,
				'title'       => $title,
				'installed'   => isset( $installed[ $machine ] ),
			];
		}

		return rest_ensure_response( [
			'installed' => array_values( $installed ),
			'featured'  => $featured,
		] );
	}

	/**
	 * Install a content type (+ its dependency libraries) from the H5P hub.
	 */
	public function install_type( $request ) {
		$machine = sanitize_text_field( (string) $request->get_param( 'machineName' ) );
		if ( '' === $machine ) {
			return new WP_Error( 'missing_machine_name', __( 'A content type is required.', 'trueplayer' ), [ 'status' => 400 ] );
		}
		$result = Importer::install_content_type( $machine, false );
		if ( is_wp_error( $result ) ) {
			$result->add_data( [ 'status' => 502 ] );
			return $result;
		}
		return rest_ensure_response( [ 'installed' => true, 'machineName' => $machine ] );
	}

	/**
	 * The semantics (editor schema) for a content type's latest installed version.
	 */
	public function semantics( $request ) {
		$name = (string) $request->get_param( 'name' );
		$core = Core::core();
		global $wpdb;
		$p  = $wpdb->prefix . 'tp_h5p_';
		$lv = $wpdb->get_row( $wpdb->prepare(
			"SELECT major_version, minor_version, title FROM {$p}libraries WHERE name = %s ORDER BY major_version DESC, minor_version DESC LIMIT 1",
			$name
		) );
		if ( ! $lv ) {
			return new WP_Error( 'not_installed', __( 'Content type is not installed.', 'trueplayer' ), [ 'status' => 404 ] );
		}
		// H5PCore::loadLibrarySemantics returns already-decoded semantics (and
		// runs the alter hook); the framework method returns the raw JSON string.
		$semantics = $core->loadLibrarySemantics( $name, (int) $lv->major_version, (int) $lv->minor_version );
		if ( is_string( $semantics ) ) {
			$semantics = json_decode( $semantics );
		}
		return rest_ensure_response( [
			'machineName' => $name,
			'title'       => $lv->title,
			'library'     => sprintf( '%s %d.%d', $name, $lv->major_version, $lv->minor_version ),
			'semantics'   => $semantics ?: [],
		] );
	}

	/**
	 * Create or update an H5P content item and its linked tp_video.
	 *
	 * Body: { video?:int, title:string, library:"H5P.X 1.0", params:object }
	 */
	public function save_content( $request ) {
		$video_id = (int) $request->get_param( 'video' );
		$title    = sanitize_text_field( (string) $request->get_param( 'title' ) );
		$library  = (string) $request->get_param( 'library' );
		$params   = $request->get_param( 'params' );

		$lib = \H5PCore::libraryFromString( $library );
		if ( ! $lib ) {
			return new WP_Error( 'bad_library', __( 'Invalid content type.', 'trueplayer' ), [ 'status' => 400 ] );
		}

		$core       = Core::core();
		$library_id = $core->h5pF->getLibraryId( $lib['machineName'], $lib['majorVersion'], $lib['minorVersion'] );
		if ( ! $library_id ) {
			return new WP_Error( 'library_not_installed', __( 'That content type is not installed.', 'trueplayer' ), [ 'status' => 400 ] );
		}

		if ( '' === $title ) {
			$title = __( 'Untitled interactive', 'trueplayer' );
		}

		// Resolve / create the linked video post.
		if ( $video_id && get_post_type( $video_id ) === TRUEPLAYER_VIDEO_POST_TYPE ) {
			wp_update_post( [ 'ID' => $video_id, 'post_title' => $title ] );
		} else {
			$video_id = wp_insert_post( [
				'post_type'   => TRUEPLAYER_VIDEO_POST_TYPE,
				'post_status' => 'publish',
				'post_title'  => $title,
			] );
			if ( is_wp_error( $video_id ) ) {
				return $video_id;
			}
			update_post_meta( $video_id, '_trueplayer_engine', 'h5p' );
		}

		$content_id = (int) get_post_meta( $video_id, '_trueplayer_h5p_content_id', true );

		$content = [
			'library'  => [
				'libraryId'    => (int) $library_id,
				'machineName'  => $lib['machineName'],
				'majorVersion' => $lib['majorVersion'],
				'minorVersion' => $lib['minorVersion'],
			],
			'params'   => wp_json_encode( $params ),
			'disable'  => 0,
			'metadata' => [ 'title' => $title ],
		];
		if ( $content_id ) {
			$content['id'] = $content_id;
		}

		$content['id'] = $core->saveContent( $content );

		// Reload the full row (slug/title/embedType/name) before filtering so
		// validation + dependency-cache rebuild run against complete content.
		$saved = $core->loadContent( $content['id'] );
		if ( $saved ) {
			$core->filterParameters( $saved );
		}

		update_post_meta( $video_id, '_trueplayer_engine', 'h5p' );
		update_post_meta( $video_id, '_trueplayer_h5p_content_id', (int) $content['id'] );

		return rest_ensure_response( [
			'video'      => (int) $video_id,
			'content_id' => (int) $content['id'],
			'shortcode'  => sprintf( '[trueplayer id="%d"]', $video_id ),
		] );
	}

	/**
	 * Receive a root-level H5P xAPI statement and normalise it into TruePlayer's
	 * event bus — so an H5P completion feeds the same analytics / webhooks / CRM
	 * / LMS pipeline as a native video. Also records a result row.
	 */
	public function xapi( $request ) {
		$nonce = (string) $request->get_param( 'nonce' );
		if ( ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error( 'bad_nonce', __( 'Invalid request.', 'trueplayer' ), [ 'status' => 403 ] );
		}

		$video_id   = (int) $request->get_param( 'video' );
		$content_id = (int) $request->get_param( 'content_id' );
		if ( ! $video_id || get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE || ! Module::is_h5p( $video_id ) ) {
			return new WP_Error( 'not_h5p', __( 'Not an interactive item.', 'trueplayer' ), [ 'status' => 400 ] );
		}

		$raw     = $request->get_param( 'raw' );
		$max     = $request->get_param( 'max' );
		$scaled  = $request->get_param( 'scaled' );
		$success = $request->get_param( 'success' );
		$user    = wp_get_current_user();
		$user_id = $user && $user->exists() ? (int) $user->ID : 0;

		$subject = $user_id
			? [ 'type' => 'user', 'id' => $user_id, 'email' => $user->user_email, 'name' => $user->display_name ]
			: [ 'type' => 'guest', 'id' => 0 ];

		$payload = [
			'video_id'   => $video_id,
			'content_id' => $content_id,
			'subject'    => $subject,
			'source'     => 'h5p',
			'score'      => is_numeric( $raw ) ? (float) $raw : null,
			'max_score'  => is_numeric( $max ) ? (float) $max : null,
			'scaled'     => is_numeric( $scaled ) ? (float) $scaled : null,
		];

		// Persist a result row (best effort).
		if ( is_numeric( $raw ) && is_numeric( $max ) ) {
			global $wpdb;
			$now = time();
			$wpdb->insert(
				$wpdb->prefix . 'tp_h5p_results',
				[
					'content_id' => $content_id,
					'user_id'    => $user_id,
					'score'      => (int) round( (float) $raw ),
					'max_score'  => (int) round( (float) $max ),
					'opened'     => $now,
					'finished'   => $now,
					'time'       => $now,
				],
				[ '%d', '%d', '%d', '%d', '%d', '%d', '%d' ]
			);
		}

		// Completion always; pass/fail when the statement carries success.
		\TruePlayer\Events::emit( 'view.completed', $payload );
		if ( true === $success ) {
			\TruePlayer\Events::emit( 'quiz.passed', $payload );
		} elseif ( false === $success ) {
			\TruePlayer\Events::emit( 'quiz.failed', $payload );
		}

		return rest_ensure_response( [ 'ok' => true ] );
	}

	/**
	 * Load an H5P item for editing: title + library + params object.
	 */
	public function get_content( $request ) {
		$video_id = (int) $request->get_param( 'video' );
		if ( get_post_type( $video_id ) !== TRUEPLAYER_VIDEO_POST_TYPE ) {
			return new WP_Error( 'not_found', __( 'Not found.', 'trueplayer' ), [ 'status' => 404 ] );
		}
		$content_id = (int) get_post_meta( $video_id, '_trueplayer_h5p_content_id', true );
		if ( ! $content_id ) {
			return rest_ensure_response( [ 'video' => $video_id, 'title' => get_the_title( $video_id ), 'library' => '', 'params' => null ] );
		}
		$core    = Core::core();
		$content = $core->loadContent( $content_id );
		if ( ! $content ) {
			return new WP_Error( 'content_missing', __( 'Content could not be loaded.', 'trueplayer' ), [ 'status' => 404 ] );
		}
		return rest_ensure_response( [
			'video'   => $video_id,
			'title'   => $content['title'] ?? get_the_title( $video_id ),
			'library' => \H5PCore::libraryToString( $content['library'] ),
			'params'  => json_decode( $content['params'] ),
		] );
	}
}
