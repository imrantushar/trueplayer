<?php

namespace TruePlayer\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_REST_Controller;
use WP_REST_Server;
use TruePlayer\Pro;
use TruePlayer\Services\BunnyStorage;

/**
 * Uploading a video to a Bunny.net Storage zone from the editor.
 *
 * The upload is chunked rather than sent as one request, because a video is
 * routinely larger than `upload_max_filesize` and `post_max_size` — limits an
 * author cannot change and a plugin cannot raise reliably. Each chunk is a
 * small ordinary POST that any host accepts; the server appends them to one
 * temp file and only sends the assembled result on to Bunny. That is also what
 * makes a real progress bar possible, since the browser knows how many chunks
 * it has acknowledged.
 *
 * The storage key never leaves the server (see BunnyStorage), so proxying is
 * not an implementation detail here — it is the reason this controller exists.
 */
class BunnyController extends WP_REST_Controller {

	/** How much the browser sends per request. Small enough for any host's limits. */
	const CHUNK_BYTES = 4194304; // 4 MB

	/** How long a half-finished upload is kept before it is swept away. */
	const SESSION_TTL = 6 * HOUR_IN_SECONDS;

	/** Upload scratch space, under uploads/ so it inherits the site's writability. */
	const TMP_DIR = 'trueplayer-tmp';

	public function __construct() {
		$this->namespace = TRUEPLAYER_PLUGIN_SLUG . '/v1';
		$this->rest_base = 'bunny';
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
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/files',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'files' ],
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
			'/' . $this->rest_base . '/upload/chunk',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'chunk' ],
				'permission_callback' => [ $this, 'can_upload' ],
				'args'                => [
					'session' => [ 'required' => true ],
					'offset'  => [ 'required' => true ],
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

	/** Bunny.net Storage is a premium source; the whole controller follows it. */
	private function pro_guard() {
		if ( ! Pro::active() ) {
			return new \WP_Error(
				'tp_pro_required',
				__( 'Bunny.net Storage needs TruePlayer Pro.', 'trueplayer' ),
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
		return rest_ensure_response(
			array_merge( BunnyStorage::status(), [ 'chunkSize' => self::CHUNK_BYTES ] )
		);
	}

	public function files( $request ) {
		$guard = $this->pro_guard();
		if ( $guard ) {
			return $guard;
		}
		$folder = (string) $request->get_param( 'folder' );
		$files  = BunnyStorage::listing( '' !== $folder ? $folder : BunnyStorage::config()['folder'] );
		if ( is_wp_error( $files ) ) {
			return $files;
		}
		return rest_ensure_response( [ 'files' => $files ] );
	}

	/**
	 * Open an upload: validate what the browser says it is about to send, and
	 * hand back a session it must quote on every chunk. Nothing is accepted
	 * before this, so an oversized or non-media file is refused up front
	 * rather than after the author has waited through the transfer.
	 */
	public function start( $request ) {
		$guard = $this->pro_guard();
		if ( $guard ) {
			return $guard;
		}
		if ( ! BunnyStorage::is_configured() ) {
			return new \WP_Error(
				'tp_bunny_unconfigured',
				__( 'Add your Bunny.net storage zone, key and pull-zone hostname under Settings → Sources & CDN first.', 'trueplayer' ),
				[ 'status' => 400 ]
			);
		}

		$body = $request->get_json_params();
		$name = BunnyStorage::safe_filename( (string) ( $body['name'] ?? '' ) );
		$size = isset( $body['size'] ) ? (int) $body['size'] : 0;

		if ( '' === $name ) {
			return new \WP_Error(
				'tp_bunny_filetype',
				sprintf(
					/* translators: %s: comma-separated list of file extensions. */
					__( 'That file type cannot be uploaded. Allowed types: %s.', 'trueplayer' ),
					implode( ', ', BunnyStorage::ALLOWED_EXTENSIONS )
				),
				[ 'status' => 400 ]
			);
		}
		$max = BunnyStorage::max_upload_bytes();
		if ( $size <= 0 || $size > $max ) {
			return new \WP_Error(
				'tp_bunny_size',
				sprintf(
					/* translators: %s: formatted maximum file size, e.g. "5 GB". */
					__( 'That file is empty or larger than the %s limit.', 'trueplayer' ),
					size_format( $max )
				),
				[ 'status' => 400 ]
			);
		}

		$dir = $this->tmp_dir();
		if ( is_wp_error( $dir ) ) {
			return $dir;
		}
		$this->sweep( $dir );

		$session = wp_generate_password( 32, false );
		$file    = $dir . '/' . $session . '.part';

		// Create it empty, so the first chunk's offset check has something to
		// measure and a failure to write surfaces now rather than mid-upload.
		if ( false === file_put_contents( $file, '' ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- scratch file in uploads/, not a theme/plugin asset.
			return new \WP_Error( 'tp_bunny_tmp', __( 'The server could not open a temporary file for the upload.', 'trueplayer' ), [ 'status' => 500 ] );
		}

		set_transient(
			$this->session_key( $session ),
			[
				'name' => $name,
				'size' => $size,
				'file' => $file,
				'user' => get_current_user_id(),
			],
			self::SESSION_TTL
		);

		return rest_ensure_response(
			[
				'session'   => $session,
				'name'      => $name,
				'chunkSize' => self::CHUNK_BYTES,
			]
		);
	}

	/**
	 * Append one chunk. The offset is checked against what is already on disk
	 * rather than trusted, so a retried or out-of-order request can never
	 * interleave itself into the middle of the file and produce an object that
	 * uploads cleanly but plays as garbage.
	 */
	public function chunk( $request ) {
		$guard = $this->pro_guard();
		if ( $guard ) {
			return $guard;
		}
		$session = $this->read_session( $request );
		if ( is_wp_error( $session ) ) {
			return $session;
		}
		[ $id, $meta ] = $session;

		$bytes  = (string) $request->get_body();
		$offset = (int) $request->get_param( 'offset' );
		$length = strlen( $bytes );

		if ( 0 === $length ) {
			return new \WP_Error( 'tp_bunny_empty_chunk', __( 'That upload chunk arrived empty.', 'trueplayer' ), [ 'status' => 400 ] );
		}

		clearstatcache( true, $meta['file'] );
		$written = file_exists( $meta['file'] ) ? (int) filesize( $meta['file'] ) : -1;
		if ( $written < 0 ) {
			$this->forget( $id, $meta );
			return new \WP_Error( 'tp_bunny_lost', __( 'This upload expired. Please start it again.', 'trueplayer' ), [ 'status' => 410 ] );
		}
		if ( $offset !== $written ) {
			return new \WP_Error(
				'tp_bunny_offset',
				__( 'That upload chunk arrived out of order.', 'trueplayer' ),
				[ 'status' => 409, 'expected' => $written ]
			);
		}
		if ( $written + $length > (int) $meta['size'] ) {
			$this->forget( $id, $meta );
			return new \WP_Error( 'tp_bunny_overflow', __( 'The upload sent more data than it declared.', 'trueplayer' ), [ 'status' => 400 ] );
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- appending to our own scratch file; WP_Filesystem has no append mode.
		if ( false === file_put_contents( $meta['file'], $bytes, FILE_APPEND ) ) {
			return new \WP_Error( 'tp_bunny_write', __( 'The server could not write the upload to disk.', 'trueplayer' ), [ 'status' => 500 ] );
		}

		// Keep the session alive for as long as the upload is making progress.
		set_transient( $this->session_key( $id ), $meta, self::SESSION_TTL );

		return rest_ensure_response(
			[
				'received' => $written + $length,
				'size'     => (int) $meta['size'],
			]
		);
	}

	/**
	 * Send the assembled file on to Bunny and hand back the playback URL. The
	 * temp file is removed either way — a failed send leaves nothing behind to
	 * resume from, so keeping it would only fill the disk.
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
		[ $id, $meta ] = $session;

		clearstatcache( true, $meta['file'] );
		$written = file_exists( $meta['file'] ) ? (int) filesize( $meta['file'] ) : 0;
		if ( $written !== (int) $meta['size'] ) {
			$this->forget( $id, $meta );
			return new \WP_Error(
				'tp_bunny_incomplete',
				__( 'The upload finished short of its full size. Please try again.', 'trueplayer' ),
				[ 'status' => 400 ]
			);
		}

		// Sending a multi-gigabyte file on to Bunny outlasts the default
		// max_execution_time on most hosts, and being killed part-way leaves a
		// truncated object in the zone that plays as a broken video.
		if ( function_exists( 'set_time_limit' ) ) {
			@set_time_limit( 0 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- disabled by some hosts; the upload still works within whatever limit stands.
		}

		$remote = BunnyStorage::unique_path( $meta['name'] );
		$url    = BunnyStorage::put( $meta['file'], $remote );
		$this->forget( $id, $meta );

		if ( is_wp_error( $url ) ) {
			return $url;
		}

		return rest_ensure_response(
			[
				'url'  => $url,
				'name' => wp_basename( $remote ),
				'path' => $remote,
				'size' => $written,
			]
		);
	}

	/** Cancelled in the browser — drop the partial file now rather than at sweep time. */
	public function abort( $request ) {
		$session = $this->read_session( $request );
		if ( is_wp_error( $session ) ) {
			return rest_ensure_response( [ 'ok' => true ] ); // Already gone; nothing to do.
		}
		[ $id, $meta ] = $session;
		$this->forget( $id, $meta );
		return rest_ensure_response( [ 'ok' => true ] );
	}

	/**
	 * Resolve the session a request names, checking that it is this user's.
	 *
	 * @return array|\WP_Error [ id, meta ]
	 */
	private function read_session( $request ) {
		$body = $request->get_json_params();
		$raw  = (string) ( $request->get_param( 'session' ) ?: ( $body['session'] ?? '' ) );
		$id   = preg_match( '/^[A-Za-z0-9]{32}$/', $raw ) ? $raw : '';
		if ( '' === $id ) {
			return new \WP_Error( 'tp_bunny_session', __( 'That upload session is not valid.', 'trueplayer' ), [ 'status' => 400 ] );
		}

		$meta = get_transient( $this->session_key( $id ) );
		if ( ! is_array( $meta ) || empty( $meta['file'] ) ) {
			return new \WP_Error( 'tp_bunny_session', __( 'This upload expired. Please start it again.', 'trueplayer' ), [ 'status' => 410 ] );
		}
		// A session belongs to the person who opened it — an admin must not be
		// able to finish someone else's upload by quoting its id.
		if ( (int) $meta['user'] !== get_current_user_id() ) {
			return new \WP_Error( 'tp_bunny_session', __( 'That upload session belongs to someone else.', 'trueplayer' ), [ 'status' => 403 ] );
		}
		return [ $id, $meta ];
	}

	private function session_key( string $id ): string {
		return 'tp_bunny_up_' . $id;
	}

	private function forget( string $id, array $meta ): void {
		delete_transient( $this->session_key( $id ) );
		if ( ! empty( $meta['file'] ) && file_exists( $meta['file'] ) ) {
			wp_delete_file( $meta['file'] );
		}
	}

	/**
	 * The scratch directory, created on demand and closed to the web. Partials
	 * are stored with a random name and a `.part` extension so nothing there is
	 * addressable or executable even if a host serves the folder anyway.
	 *
	 * @return string|\WP_Error
	 */
	private function tmp_dir() {
		$uploads = wp_upload_dir();
		if ( ! empty( $uploads['error'] ) ) {
			return new \WP_Error( 'tp_bunny_tmp', $uploads['error'], [ 'status' => 500 ] );
		}
		$dir = trailingslashit( $uploads['basedir'] ) . self::TMP_DIR;
		if ( ! wp_mkdir_p( $dir ) ) {
			return new \WP_Error( 'tp_bunny_tmp', __( 'The uploads folder is not writable.', 'trueplayer' ), [ 'status' => 500 ] );
		}
		// phpcs:disable WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- one-time guard files in our own scratch dir.
		if ( ! file_exists( $dir . '/index.php' ) ) {
			file_put_contents( $dir . '/index.php', "<?php\n// Silence is golden.\n" );
		}
		if ( ! file_exists( $dir . '/.htaccess' ) ) {
			// Both Apache generations — 2.4 ignores Deny, 2.2 doesn't know
			// Require — and nginx reads neither, which is why the partials are
			// randomly named and extensionless rather than relying on this.
			file_put_contents(
				$dir . '/.htaccess',
				"<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n"
				. "<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n"
			);
		}
		// phpcs:enable WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		return $dir;
	}

	/**
	 * Delete partials left behind by uploads nobody finished — a closed tab
	 * never sends `abort`, and their transients expire without touching disk.
	 */
	private function sweep( string $dir ): void {
		$cutoff = time() - self::SESSION_TTL;
		foreach ( (array) glob( $dir . '/*.part' ) as $file ) {
			if ( is_file( $file ) && filemtime( $file ) < $cutoff ) {
				wp_delete_file( $file );
			}
		}
	}
}
