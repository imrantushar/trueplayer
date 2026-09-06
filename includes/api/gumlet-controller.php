<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Pro;
use TruePlayer\Services\GumletVideo;

/**
 * Uploading a video to Gumlet from the editor, and reading an asset back.
 *
 * Deliberately not shaped like BunnyController. Bunny Storage has no scoped
 * upload credential, so every byte has to be proxied through this server in
 * chunks small enough to clear `upload_max_filesize`. Gumlet mints a presigned
 * URL scoped to one object, so the browser PUTs directly to it and PHP never
 * touches the file — no scratch directory, no chunk reassembly, no execution
 * time limits to fight. This controller only mints that URL and reports on the
 * asset afterwards.
 *
 * What it keeps from Bunny's design is the session: the browser is handed an
 * opaque id bound to the user who opened it, so one admin cannot poll or claim
 * another's in-flight upload by quoting its asset id.
 *
 * Transcoding takes minutes, so status is polled by the browser rather than
 * waited on here — a blocking wait would hold a PHP worker past any shared
 * host's timeout, and WP-Cron has no channel back to an open editor tab.
 */
class GumletController extends WP_REST_Controller {

	/** How long a half-finished upload's session is honoured. */
	const SESSION_TTL = 6 * HOUR_IN_SECONDS;

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'gumlet';
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/status',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'status' ],
				'permission_callback' => [ $this, 'admin' ],
			]
		);

		// Resolving a pasted asset id into something playable.
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/asset',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'asset' ],
				'permission_callback' => [ $this, 'admin' ],
				'args'                => [
					'id' => [ 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ],
				],
			]
		);

		// The workspaces this key can see, so Settings can offer a list instead
		// of asking for an id Gumlet's dashboard never displays.
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/collections',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'collections' ],
				'permission_callback' => [ $this, 'admin' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/upload/start',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'start' ],
				'permission_callback' => [ $this, 'can_upload' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/upload/status',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'upload_status' ],
				'permission_callback' => [ $this, 'can_upload' ],
				'args'                => [
					'session' => [ 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/upload/finish',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'finish' ],
				'permission_callback' => [ $this, 'can_upload' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/upload/abort',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'abort' ],
				'permission_callback' => [ $this, 'can_upload' ],
			]
		);
	}

	public function admin() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Sending a file to the site's paid CDN is an upload in every sense, so it
	 * carries the upload capability on top of admin — matching the media
	 * library's own rule rather than treating this as a settings change.
	 */
	public function can_upload() {
		return $this->admin() && current_user_can( 'upload_files' );
	}

	/** Gumlet is a premium source; the whole controller follows it. */
	private function pro_guard() {
		if ( ! Pro::active() ) {
			return new \WP_Error(
				'tp_pro_required',
				__( 'Gumlet needs TruePlayer Pro.', 'trueplayer' ),
				[ 'status' => 403 ]
			);
		}
		return null;
	}

	public function status() {
		$guard = $this->pro_guard();
		if ( $guard ) {
			return $guard;
		}
		return rest_ensure_response( GumletVideo::status() );
	}

	/**
	 * Resolve whatever the author pasted into a real, playable asset — and say
	 * so before the video is saved, rather than leaving them to find out on the
	 * front end that the id was wrong.
	 */
	public function asset( $request ) {
		$guard = $this->pro_guard();
		if ( $guard ) {
			return $guard;
		}

		$asset_id = GumletVideo::parse_asset_id( (string) $request->get_param( 'id' ) );
		if ( '' === $asset_id ) {
			return new \WP_Error(
				'tp_gumlet_bad_asset',
				__( 'That does not look like a Gumlet asset ID or URL.', 'trueplayer' ),
				[ 'status' => 400 ]
			);
		}

		$state = GumletVideo::asset_state( $asset_id );
		if ( 'error' === $state['status'] && '' !== $state['error'] ) {
			return new \WP_Error( 'tp_gumlet_api', $state['error'], [ 'status' => 502 ] );
		}

		return rest_ensure_response(
			array_merge( $state, [ 'assetId' => $asset_id, 'embedUrl' => GumletVideo::embed_url( $asset_id ) ] )
		);
	}

	public function collections() {
		$guard = $this->pro_guard();
		if ( $guard ) {
			return $guard;
		}
		$list = GumletVideo::collections();
		if ( is_wp_error( $list ) ) {
			return $list;
		}
		return rest_ensure_response( [ 'collections' => $list ] );
	}

	/**
	 * Open an upload: create the asset at Gumlet and hand back the presigned
	 * URL the browser will PUT to. Validation happens here, before the transfer,
	 * so an oversized or unsupported file is refused up front rather than after
	 * the author has waited it out.
	 */
	public function start( $request ) {
		$guard = $this->pro_guard();
		if ( $guard ) {
			return $guard;
		}

		$body = (array) $request->get_json_params();
		$name = GumletVideo::safe_filename( (string) ( $body['name'] ?? '' ) );
		$size = isset( $body['size'] ) ? (int) $body['size'] : 0;

		if ( '' === $name ) {
			return new \WP_Error(
				'tp_gumlet_filetype',
				sprintf(
					/* translators: %s: comma-separated list of file extensions. */
					__( 'That file type cannot be uploaded. Accepted: %s.', 'trueplayer' ),
					implode( ', ', GumletVideo::ALLOWED_EXTENSIONS )
				),
				[ 'status' => 400 ]
			);
		}

		// Kept apart from the size ceiling below: an empty file is a different
		// mistake with a different fix, and telling someone their 0-byte file
		// is too large sends them looking in the wrong place.
		if ( $size <= 0 ) {
			return new \WP_Error(
				'tp_gumlet_empty',
				__( 'That file is empty.', 'trueplayer' ),
				[ 'status' => 400 ]
			);
		}

		$max = GumletVideo::max_upload_bytes();
		if ( $size > $max ) {
			return new \WP_Error(
				'tp_gumlet_size',
				sprintf(
					/* translators: %s: human-readable maximum file size. */
					__( 'That file is too large. The limit is %s.', 'trueplayer' ),
					size_format( $max )
				),
				[ 'status' => 400 ]
			);
		}

		$created = GumletVideo::create_direct_upload( $name );
		if ( is_wp_error( $created ) ) {
			return $created;
		}

		$session = wp_generate_password( 32, false );
		set_transient(
			$this->session_key( $session ),
			[
				'user'    => get_current_user_id(),
				'assetId' => $created['assetId'],
				'name'    => $name,
				'size'    => $size,
			],
			self::SESSION_TTL
		);

		return rest_ensure_response(
			[
				'session'   => $session,
				'assetId'   => $created['assetId'],
				'uploadUrl' => $created['uploadUrl'],
				'name'      => $name,
			]
		);
	}

	/** One cheap status read. The browser calls this on a backoff while polling. */
	public function upload_status( $request ) {
		$guard = $this->pro_guard();
		if ( $guard ) {
			return $guard;
		}
		$session = $this->read_session( $request );
		if ( is_wp_error( $session ) ) {
			return $session;
		}
		list( , $meta ) = $session;

		return rest_ensure_response(
			array_merge( GumletVideo::asset_state( $meta['assetId'] ), [ 'assetId' => $meta['assetId'] ] )
		);
	}

	/**
	 * Close an upload and return the source the editor should store.
	 *
	 * Returns the payload whether or not transcoding has finished. An author
	 * must not be held hostage by a queue they cannot see: the asset id is the
	 * durable identity, and a video saved mid-transcode resolves its playback
	 * URL at render time instead (see Helper::resolve_gumlet_source). `ready`
	 * says which of the two happened so the editor can word it honestly.
	 */
	public function finish( $request ) {
		$guard = $this->pro_guard();
		if ( $guard ) {
			return $guard;
		}
		$session = $this->read_session( $request );
		if ( is_wp_error( $session ) ) {
			return $session;
		}
		list( $id, $meta ) = $session;

		$state = GumletVideo::asset_state( $meta['assetId'] );
		if ( '' !== $state['error'] ) {
			$this->forget( $id );
			return new \WP_Error( 'tp_gumlet_failed', $state['error'], [ 'status' => 502 ] );
		}

		$this->forget( $id );

		return rest_ensure_response(
			[
				'assetId'   => $meta['assetId'],
				// Gumlet's own URL when it has one; otherwise left empty and
				// resolved at render time rather than guessed at now.
				'src'       => $state['playbackUrl'],
				'status'    => $state['ready'] ? 'ready' : 'processing',
				'ready'     => $state['ready'],
				'duration'  => $state['duration'],
				'poster'    => $state['thumbnail'],
				'fileName'  => $meta['name'],
				'fileSize'  => (int) $meta['size'],
			]
		);
	}

	/**
	 * Give up on an upload. Deliberately outside the Pro guard, like Bunny's:
	 * cleanup has to keep working even if Pro is deactivated mid-transfer, or
	 * a cancelled upload would leave an orphaned asset behind at Gumlet.
	 */
	public function abort( $request ) {
		$session = $this->read_session( $request );
		if ( is_wp_error( $session ) ) {
			return rest_ensure_response( [ 'ok' => true ] ); // Already gone; nothing to do.
		}
		list( $id, $meta ) = $session;

		// Best effort — the session is dropped either way. An asset Gumlet
		// declines to delete is a tidiness problem, not a correctness one.
		GumletVideo::delete_asset( $meta['assetId'] );
		$this->forget( $id );

		return rest_ensure_response( [ 'ok' => true ] );
	}

	/**
	 * Resolve the session a request names, checking that it is this user's.
	 *
	 * @return array|\WP_Error [ id, meta ]
	 */
	private function read_session( $request ) {
		$body = (array) $request->get_json_params();
		$raw  = (string) ( $request->get_param( 'session' ) ?: ( $body['session'] ?? '' ) );
		$id   = preg_match( '/^[A-Za-z0-9]{32}$/', $raw ) ? $raw : '';
		if ( '' === $id ) {
			return new \WP_Error( 'tp_gumlet_session', __( 'That upload session is not valid.', 'trueplayer' ), [ 'status' => 400 ] );
		}

		$meta = get_transient( $this->session_key( $id ) );
		if ( ! is_array( $meta ) || empty( $meta['assetId'] ) ) {
			return new \WP_Error( 'tp_gumlet_session', __( 'This upload expired. Please start it again.', 'trueplayer' ), [ 'status' => 410 ] );
		}
		// A session belongs to the person who opened it — an admin must not be
		// able to finish or inspect someone else's upload by quoting its id.
		if ( (int) $meta['user'] !== get_current_user_id() ) {
			return new \WP_Error( 'tp_gumlet_session', __( 'That upload session belongs to someone else.', 'trueplayer' ), [ 'status' => 403 ] );
		}
		return [ $id, $meta ];
	}

	private function session_key( string $id ): string {
		return 'tp_gumlet_up_' . $id;
	}

	private function forget( string $id ): void {
		delete_transient( $this->session_key( $id ) );
	}
}
