<?php

namespace TruePlayer\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\Helper;

/**
 * Bunny.net Storage — the transport behind "upload a video to my CDN".
 *
 * A storage zone is written with a plain HTTP PUT authenticated by the zone's
 * password (`AccessKey`). That password grants read, write AND delete over the
 * whole zone and Bunny publishes no scoped or signed upload token for Storage,
 * so it can never be handed to a browser: every upload is proxied through this
 * server, which is the only place the key is allowed to exist.
 *
 * Reading back is a different hostname entirely. The storage host serves
 * nothing publicly — playback comes from a pull zone in front of it — which is
 * why `pullZone` is required rather than optional: without it an upload
 * succeeds and produces a URL nothing can play.
 *
 * Credentials live in Settings → Sources & CDN under `bunny.storage`.
 */
class BunnyStorage {

	/** Region code → storage endpoint host. '' is Bunny's default (Falkenstein). */
	const REGIONS = [
		''    => 'storage.bunnycdn.com',
		'ny'  => 'ny.storage.bunnycdn.com',
		'la'  => 'la.storage.bunnycdn.com',
		'sg'  => 'sg.storage.bunnycdn.com',
		'syd' => 'syd.storage.bunnycdn.com',
		'uk'  => 'uk.storage.bunnycdn.com',
		'se'  => 'se.storage.bunnycdn.com',
		'br'  => 'br.storage.bunnycdn.com',
		'jh'  => 'jh.storage.bunnycdn.com',
	];

	/** Folder inside the zone that uploads land in, unless configured otherwise. */
	const DEFAULT_FOLDER = 'trueplayer';

	/** Extensions accepted for upload — media the player can actually play. */
	const ALLOWED_EXTENSIONS = [ 'mp4', 'm4v', 'mov', 'webm', 'ogv', 'mp3', 'm4a', 'oga', 'ogg', 'wav', 'flac' ];

	/**
	 * The configured zone, as a complete array with every key present.
	 */
	public static function config(): array {
		$bunny   = Helper::get_settings_section( 'bunny' );
		$storage = isset( $bunny['storage'] ) && is_array( $bunny['storage'] ) ? $bunny['storage'] : [];

		$region = isset( $storage['region'] ) ? (string) $storage['region'] : '';

		return [
			'zone'      => isset( $storage['zone'] ) ? trim( (string) $storage['zone'] ) : '',
			'accessKey' => isset( $storage['accessKey'] ) ? trim( (string) $storage['accessKey'] ) : '',
			'region'    => array_key_exists( $region, self::REGIONS ) ? $region : '',
			'pullZone'  => self::host_only( isset( $storage['pullZone'] ) ? (string) $storage['pullZone'] : '' ),
			'folder'    => self::clean_folder( isset( $storage['folder'] ) ? (string) $storage['folder'] : self::DEFAULT_FOLDER ),
			// The pull zone's Token Authentication Key — a different zone and a
			// different secret from Stream's. Only used to sign playback of
			// videos marked private (see PrivateVideo::sign_bunny_storage); it
			// plays no part in uploading, and never reaches the browser.
			'tokenKey'  => isset( $storage['tokenKey'] ) ? trim( (string) $storage['tokenKey'] ) : '',
		];
	}

	/** Whether uploads can run: a zone, its key, and somewhere to play it back from. */
	public static function is_configured(): bool {
		$c = self::config();
		return '' !== $c['zone'] && '' !== $c['accessKey'] && '' !== $c['pullZone'];
	}

	/**
	 * What the editor needs to know before offering the upload UI. Never
	 * includes the access key — the browser has no use for it and must not
	 * carry it, even behind an admin capability.
	 */
	public static function status(): array {
		$c = self::config();
		return [
			'configured' => self::is_configured(),
			'zone'       => $c['zone'],
			'pullZone'   => $c['pullZone'],
			'folder'     => $c['folder'],
			'maxBytes'   => self::max_upload_bytes(),
			'extensions' => self::ALLOWED_EXTENSIONS,
		];
	}

	/**
	 * Largest file this install accepts. Chunking means PHP's own upload
	 * limits don't apply, so the ceiling is about disk and patience rather
	 * than ini settings — hence a plain default rather than a derived one.
	 */
	public static function max_upload_bytes(): int {
		return (int) apply_filters( 'trueplayer/bunny_storage/max_upload_bytes', 5 * GB_IN_BYTES );
	}

	/** The storage API endpoint for a path inside the zone. */
	public static function endpoint( string $remote_path ): string {
		$c    = self::config();
		$host = self::REGIONS[ $c['region'] ] ?? self::REGIONS[''];
		return 'https://' . $host . '/' . rawurlencode( $c['zone'] ) . '/' . self::encode_path( $remote_path );
	}

	/** The public playback URL for a path inside the zone. */
	public static function public_url( string $remote_path ): string {
		$c = self::config();
		if ( '' === $c['pullZone'] ) {
			return '';
		}
		return 'https://' . $c['pullZone'] . '/' . self::encode_path( $remote_path );
	}

	/**
	 * Where a given filename will land, de-duplicated against what is already
	 * in the zone so an upload never silently overwrites a file another video
	 * is playing. Bunny's PUT is a blind overwrite with no if-none-match, so
	 * the check has to happen here.
	 *
	 * @param string $filename Sanitized filename.
	 * @return string Path inside the zone, e.g. `trueplayer/lesson-1-2.mp4`.
	 */
	public static function unique_path( string $filename ): string {
		$c      = self::config();
		$folder = '' !== $c['folder'] ? $c['folder'] . '/' : '';
		$ext    = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );
		$base   = pathinfo( $filename, PATHINFO_FILENAME );

		$existing = self::listing( $c['folder'] );
		if ( is_wp_error( $existing ) ) {
			// The listing is what tells us a name is free. Without it, assume
			// nothing and make the name unique by construction — Bunny's PUT is
			// a blind overwrite, so guessing wrong would replace a file another
			// video is currently playing.
			return $folder . $base . '-' . gmdate( 'YmdHis' ) . '.' . $ext;
		}
		$taken = [];
		foreach ( $existing as $item ) {
			$taken[ strtolower( (string) ( $item['name'] ?? '' ) ) ] = true;
		}

		$candidate = $base . '.' . $ext;
		$n         = 1;
		while ( isset( $taken[ strtolower( $candidate ) ] ) ) {
			$n++;
			$candidate = $base . '-' . $n . '.' . $ext;
		}
		return $folder . $candidate;
	}

	/**
	 * Upload a local file to the zone.
	 *
	 * The body is streamed from disk with cURL rather than `wp_remote_request`
	 * because WP_Http has no streaming request body — it takes `body` as a
	 * string, so a 2 GB lesson video would have to be read into memory in one
	 * piece to be sent. The `wp_remote_request` fallback below is kept for
	 * hosts without cURL, and is size-capped for exactly that reason.
	 *
	 * @param string $local_file  Absolute path to the assembled upload.
	 * @param string $remote_path Path inside the zone.
	 * @return string|\WP_Error The public playback URL.
	 */
	public static function put( string $local_file, string $remote_path ) {
		if ( ! self::is_configured() ) {
			return new \WP_Error(
				'tp_bunny_unconfigured',
				__( 'Bunny.net Storage is not set up. Add your zone, key and pull zone under Settings → Sources & CDN.', 'trueplayer' ),
				[ 'status' => 400 ]
			);
		}
		if ( ! is_readable( $local_file ) ) {
			return new \WP_Error( 'tp_bunny_no_file', __( 'The upload could not be read back for sending.', 'trueplayer' ), [ 'status' => 500 ] );
		}

		$c        = self::config();
		$size     = (int) filesize( $local_file );
		$endpoint = self::endpoint( $remote_path );

		if ( function_exists( 'curl_init' ) ) {
			$result = self::put_streamed( $endpoint, $c['accessKey'], $local_file, $size );
		} else {
			// No cURL: the whole body has to be materialized, so refuse what
			// would blow the memory limit rather than fataling mid-upload.
			$budget = (int) ( wp_convert_hr_to_bytes( ini_get( 'memory_limit' ) ) / 4 );
			if ( $budget > 0 && $size > $budget ) {
				return new \WP_Error(
					'tp_bunny_too_large',
					__( 'This file is too large to send from a server without cURL. Ask your host to enable the cURL extension.', 'trueplayer' ),
					[ 'status' => 500 ]
				);
			}
			$response = wp_safe_remote_request(
				$endpoint,
				[
					'method'  => 'PUT',
					'timeout' => 300,
					'headers' => [
						'AccessKey'    => $c['accessKey'],
						'Content-Type' => 'application/octet-stream',
					],
					'body'    => file_get_contents( $local_file ), // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local temp file we just wrote, size-capped above.
				]
			);
			$result = is_wp_error( $response )
				? $response
				: (int) wp_remote_retrieve_response_code( $response );
		}

		if ( is_wp_error( $result ) ) {
			return $result;
		}
		if ( $result < 200 || $result > 299 ) {
			return new \WP_Error(
				'tp_bunny_rejected',
				sprintf(
					/* translators: %d: HTTP status code returned by Bunny.net. */
					__( 'Bunny.net rejected the upload (HTTP %d). Check the storage zone name, region and key.', 'trueplayer' ),
					$result
				),
				[ 'status' => 502 ]
			);
		}

		return self::public_url( $remote_path );
	}

	/**
	 * PUT a file handle straight to the endpoint. Returns the HTTP status, or
	 * a WP_Error if the transfer itself failed.
	 *
	 * @return int|\WP_Error
	 */
	private static function put_streamed( string $endpoint, string $key, string $local_file, int $size ) {
		// phpcs:disable WordPress.WP.AlternativeFunctions -- see put(): WP_Http cannot stream a request body.
		$handle = fopen( $local_file, 'rb' );
		if ( ! $handle ) {
			return new \WP_Error( 'tp_bunny_no_file', __( 'The upload could not be opened for sending.', 'trueplayer' ), [ 'status' => 500 ] );
		}

		$ch = curl_init( $endpoint );
		curl_setopt_array(
			$ch,
			[
				CURLOPT_UPLOAD         => true,
				CURLOPT_INFILE         => $handle,
				CURLOPT_INFILESIZE     => $size,
				CURLOPT_RETURNTRANSFER => true,
				CURLOPT_HTTPHEADER     => [ 'AccessKey: ' . $key, 'Content-Type: application/octet-stream' ],
				CURLOPT_CONNECTTIMEOUT => 15,
				// No total timeout: the ceiling is the file size, and cutting a
				// large upload off part-way leaves a truncated object in the zone.
				CURLOPT_TIMEOUT        => 0,
				CURLOPT_LOW_SPEED_LIMIT => 1,
				CURLOPT_LOW_SPEED_TIME  => 120,
			]
		);
		$ok     = curl_exec( $ch );
		$status = (int) curl_getinfo( $ch, CURLINFO_RESPONSE_CODE );
		$error  = curl_error( $ch );
		curl_close( $ch );
		fclose( $handle );
		// phpcs:enable WordPress.WP.AlternativeFunctions

		if ( false === $ok ) {
			return new \WP_Error(
				'tp_bunny_transfer',
				sprintf(
					/* translators: %s: transport error message. */
					__( 'The upload could not reach Bunny.net: %s', 'trueplayer' ),
					$error ? $error : __( 'connection failed', 'trueplayer' )
				),
				[ 'status' => 502 ]
			);
		}
		return $status;
	}

	/**
	 * Files already sitting in a folder of the zone, newest first, so an author
	 * can point a video at something they uploaded earlier instead of sending
	 * it twice. Directories are dropped — this picks a file to play, not a tree
	 * to browse.
	 *
	 * @param string $dir Folder inside the zone ('' for the root).
	 * @return array|\WP_Error
	 */
	public static function listing( string $dir = '' ) {
		$c = self::config();
		if ( '' === $c['zone'] || '' === $c['accessKey'] ) {
			return new \WP_Error( 'tp_bunny_unconfigured', __( 'Bunny.net Storage is not set up.', 'trueplayer' ), [ 'status' => 400 ] );
		}

		$dir  = self::clean_folder( $dir );
		$host = self::REGIONS[ $c['region'] ] ?? self::REGIONS[''];
		$url  = 'https://' . $host . '/' . rawurlencode( $c['zone'] ) . '/' . ( '' !== $dir ? self::encode_path( $dir ) . '/' : '' );

		$response = wp_safe_remote_get(
			$url,
			[
				'timeout' => 15,
				'headers' => [ 'AccessKey' => $c['accessKey'], 'Accept' => 'application/json' ],
			]
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$status = (int) wp_remote_retrieve_response_code( $response );
		if ( 401 === $status || 403 === $status ) {
			return new \WP_Error( 'tp_bunny_auth', __( 'Bunny.net refused the storage key. Check it under Settings → Sources & CDN.', 'trueplayer' ), [ 'status' => 502 ] );
		}
		if ( 404 === $status ) {
			return []; // The folder doesn't exist yet — nothing uploaded so far.
		}
		if ( $status < 200 || $status > 299 ) {
			return new \WP_Error(
				'tp_bunny_listing',
				sprintf(
					/* translators: %d: HTTP status code returned by Bunny.net. */
					__( 'Bunny.net could not list the zone (HTTP %d).', 'trueplayer' ),
					$status
				),
				[ 'status' => 502 ]
			);
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $body ) ) {
			return [];
		}

		$files = [];
		foreach ( $body as $item ) {
			if ( ! is_array( $item ) || ! empty( $item['IsDirectory'] ) ) {
				continue;
			}
			$name = (string) ( $item['ObjectName'] ?? '' );
			$ext  = strtolower( pathinfo( $name, PATHINFO_EXTENSION ) );
			if ( '' === $name || ( ! in_array( $ext, self::ALLOWED_EXTENSIONS, true ) && 'm3u8' !== $ext ) ) {
				continue;
			}
			$path    = ( '' !== $dir ? $dir . '/' : '' ) . $name;
			$files[] = [
				'name'    => $name,
				'path'    => $path,
				'size'    => (int) ( $item['Length'] ?? 0 ),
				'changed' => (string) ( $item['LastChanged'] ?? '' ),
				'url'     => self::public_url( $path ),
			];
		}

		usort( $files, static fn( $a, $b ) => strcmp( $b['changed'], $a['changed'] ) );
		return $files;
	}

	/** A filename we are willing to store, or '' if this one isn't one. */
	public static function safe_filename( string $name ): string {
		$name = sanitize_file_name( wp_basename( $name ) );
		$ext  = strtolower( pathinfo( $name, PATHINFO_EXTENSION ) );
		if ( '' === $name || ! in_array( $ext, self::ALLOWED_EXTENSIONS, true ) ) {
			return '';
		}
		// sanitize_file_name leaves the extension cased as it arrived; normalize
		// it so `Lesson.MP4` and `lesson.mp4` can't both exist in the zone.
		return pathinfo( $name, PATHINFO_FILENAME ) . '.' . $ext;
	}

	/** Strip scheme, trailing slash and any path from a hostname setting. */
	private static function host_only( string $value ): string {
		$value = trim( $value );
		if ( '' === $value ) {
			return '';
		}
		$value = preg_replace( '#^https?://#i', '', $value );
		$value = explode( '/', $value )[0];
		return rtrim( (string) $value, '/' );
	}

	/** A folder path with no leading/trailing slashes and no traversal. */
	private static function clean_folder( string $folder ): string {
		$parts = array_filter(
			explode( '/', str_replace( '\\', '/', $folder ) ),
			static fn( $p ) => '' !== $p && '.' !== $p && '..' !== $p
		);
		return implode( '/', array_map( 'sanitize_file_name', $parts ) );
	}

	/** URL-encode each path segment while keeping the slashes between them. */
	private static function encode_path( string $path ): string {
		return implode( '/', array_map( 'rawurlencode', explode( '/', trim( $path, '/' ) ) ) );
	}
}
