<?php

namespace TruePlayer\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\Helper;

/**
 * Gumlet Video — the transport behind both Gumlet source types.
 *
 * Gumlet does not split hosting and streaming the way Bunny does, so the two
 * source types here are not two products; they are two ways into the same one:
 *
 *   `gumlet`        — the author pastes an asset that already exists.
 *   `gumletStorage` — the author drags a file in and we create the asset.
 *
 * Both end up as a transcoded HLS asset on Gumlet, which is why they share
 * this service, one resolver in the player, and one signing path.
 *
 * Unlike Bunny Storage, uploading does NOT proxy through this server. Gumlet
 * mints a short-lived presigned URL scoped to exactly one object, so the
 * browser can PUT to it directly without ever seeing a credential — which is
 * what lets a multi-gigabyte upload bypass PHP's memory, `upload_max_filesize`
 * and execution-time limits entirely. The API key still never leaves this
 * server; it is only ever used to mint that URL and to read an asset back.
 *
 * Credentials live in Settings → Sources & CDN under `gumlet`.
 */
class GumletVideo {

	const API_BASE = 'https://api.gumlet.com/v1';

	/** Output formats Gumlet will transcode to. ABR is adaptive HLS. */
	const FORMATS = [ 'ABR', 'MP4' ];

	/**
	 * Where finished assets are served from, when the account uses Gumlet's
	 * default domain. Overridable per-site because a workspace on a custom
	 * playback domain serves from that instead — and because this template is
	 * the one piece of the integration inferred rather than read back from the
	 * API, so it needs an escape hatch that does not require a plugin edit.
	 *
	 * Only ever used for a pasted asset id. An uploaded asset stores the
	 * playback URL Gumlet itself reported, which is authoritative.
	 */
	const DEFAULT_PLAYBACK_HOST = 'video.gumlet.io';

	/** Gumlet's hosted player, used for the "open in Gumlet" affordance. */
	const EMBED_HOST = 'play.gumlet.io';

	/**
	 * Extensions accepted for upload.
	 *
	 * Deliberately wider than BunnyStorage's list: that one is limited to what
	 * a browser can play, because Bunny Storage serves the bytes back exactly
	 * as they arrived. Gumlet transcodes, so a mezzanine format the browser
	 * could never decode is a perfectly good input here.
	 */
	const ALLOWED_EXTENSIONS = [
		'mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'wmv', 'flv',
		'mpg', 'mpeg', 'm2ts', 'mts', 'mxf', 'ogv', '3gp',
		'mp3', 'm4a', 'oga', 'ogg', 'wav', 'flac',
	];

	/** Asset statuses that mean "this will play now". */
	const READY_STATES = [ 'ready', 'completed' ];

	/** Asset statuses that mean "this will never play". */
	const ERROR_STATES = [ 'errored', 'error', 'failed' ];

	/**
	 * The configured account, as a complete array with every key present.
	 *
	 * All normalization happens here because nothing else does any: the
	 * settings endpoint stores whatever JSON it is handed, whole and
	 * unvalidated (see API\SettingsController::update_settings), so this is the
	 * only place a mistyped format or a pasted-in scheme gets cleaned up.
	 */
	public static function config(): array {
		$g = Helper::get_settings_section( 'gumlet' );

		$format = isset( $g['format'] ) ? strtoupper( trim( (string) $g['format'] ) ) : '';

		return [
			// Grants full access to the workspace. Never leaves this server.
			'apiKey'            => isset( $g['apiKey'] ) ? trim( (string) $g['apiKey'] ) : '',
			// Which workspace a NEW asset is created in. Not needed to play one
			// that already exists, which is why can_upload() and is_configured()
			// are separate questions.
			'collectionId'      => isset( $g['collectionId'] ) ? trim( (string) $g['collectionId'] ) : '',
			'folder'            => isset( $g['folder'] ) ? self::clean_folder( (string) $g['folder'] ) : '',
			'format'            => in_array( $format, self::FORMATS, true ) ? $format : 'ABR',
			'playbackHost'      => self::host_only( isset( $g['playbackHost'] ) ? (string) $g['playbackHost'] : '' ),
			// The workspace's signed-URL secret. Only used to sign playback of
			// videos marked private (see PrivateVideo::sign_gumlet); it plays no
			// part in uploading, and never reaches the browser.
			'signSecret'        => isset( $g['signSecret'] ) ? trim( (string) $g['signSecret'] ) : '',
			'enableDrm'         => ! empty( $g['enableDrm'] ),
			'generateSubtitles' => ! empty( $g['generateSubtitles'] ),
		];
	}

	/**
	 * Whether Gumlet is connected at all — enough to resolve and play an asset
	 * the author pastes in.
	 */
	public static function is_configured(): bool {
		return '' !== self::config()['apiKey'];
	}

	/**
	 * Whether new assets can be created. Stricter than is_configured(): an
	 * upload has to be told which workspace to land in, a playback does not.
	 * Kept apart so a site that only ever pastes existing assets is never asked
	 * for a collection id it has no use for.
	 */
	public static function can_upload(): bool {
		$c = self::config();
		return '' !== $c['apiKey'] && '' !== $c['collectionId'];
	}

	/**
	 * What the editor needs to know before offering the upload UI.
	 *
	 * Never includes the API key or the sign secret. `signing` is a boolean —
	 * "a secret is saved" — because that is the only thing the browser has any
	 * reason to know about it, and the difference between reporting that and
	 * reporting the secret is the whole point of this method existing.
	 */
	public static function status(): array {
		$c = self::config();
		return [
			'configured'   => self::is_configured(),
			'canUpload'    => self::can_upload(),
			'collectionId' => $c['collectionId'],
			'folder'       => $c['folder'],
			'format'       => $c['format'],
			'signing'      => '' !== $c['signSecret'],
			'maxBytes'     => self::max_upload_bytes(),
			'extensions'   => self::ALLOWED_EXTENSIONS,
		];
	}

	/**
	 * Largest file this install offers to upload. The browser PUTs straight to
	 * Gumlet, so PHP's own limits never come into it and the ceiling is about
	 * the visitor's patience rather than any ini setting.
	 */
	public static function max_upload_bytes(): int {
		return (int) apply_filters( 'trueplayer/gumlet/max_upload_bytes', 5 * GB_IN_BYTES );
	}

	/**
	 * Create an asset and get back the URL to PUT the file to.
	 *
	 * @param string $filename Sanitized filename, used as the asset's title.
	 * @param array  $args     Optional overrides for the created asset.
	 * @return array|\WP_Error { assetId, uploadUrl, status, playbackUrl, format }
	 */
	public static function create_direct_upload( string $filename, array $args = [] ) {
		$c = self::config();
		if ( ! self::can_upload() ) {
			return new \WP_Error(
				'tp_gumlet_unconfigured',
				__( 'Gumlet is not connected yet. Add your API key and collection ID under Settings → Sources & CDN.', 'trueplayer' ),
				[ 'status' => 400 ]
			);
		}

		$body = array_merge(
			[
				'collection_id' => $c['collectionId'],
				'format'        => $c['format'],
				'title'         => $filename,
			],
			$args
		);
		if ( '' !== $c['folder'] ) {
			$body['folder'] = $c['folder'];
		}
		if ( $c['enableDrm'] ) {
			$body['enable_drm'] = true;
		}
		if ( $c['generateSubtitles'] ) {
			$body['generate_subtitles'] = [ 'enabled' => true ];
		}

		$asset = self::request( 'POST', '/video/assets/upload', $body );
		if ( is_wp_error( $asset ) ) {
			return $asset;
		}

		$upload_url = (string) ( $asset['upload_url'] ?? '' );
		$asset_id   = (string) ( $asset['asset_id'] ?? '' );
		if ( '' === $upload_url || '' === $asset_id ) {
			return new \WP_Error(
				'tp_gumlet_no_upload_url',
				__( 'Gumlet accepted the request but returned no upload URL.', 'trueplayer' ),
				[ 'status' => 502 ]
			);
		}

		return [
			'assetId'     => $asset_id,
			'uploadUrl'   => $upload_url,
			'status'      => (string) ( $asset['status'] ?? 'created' ),
			'playbackUrl' => (string) ( $asset['output']['playback_url'] ?? '' ),
			'format'      => (string) ( $asset['output']['format'] ?? $c['format'] ),
		];
	}

	/** The raw asset record from Gumlet. */
	public static function asset( string $asset_id ) {
		$asset_id = self::parse_asset_id( $asset_id );
		if ( '' === $asset_id ) {
			return new \WP_Error( 'tp_gumlet_bad_asset', __( 'That does not look like a Gumlet asset.', 'trueplayer' ), [ 'status' => 400 ] );
		}
		return self::request( 'GET', '/video/assets/' . rawurlencode( $asset_id ) );
	}

	/**
	 * An asset boiled down to what the editor and the render pipeline act on.
	 *
	 * The single place Gumlet's asset JSON is interpreted, so the vocabulary
	 * for "is it done yet" is settled once rather than re-guessed at every call
	 * site.
	 *
	 * @return array{status:string, ready:bool, percent:int|null, playbackUrl:string,
	 *               duration:int, thumbnail:string, error:string}
	 */
	public static function asset_state( string $asset_id ): array {
		$blank = [
			'status'      => 'unknown',
			'ready'       => false,
			'percent'     => null,
			'playbackUrl' => '',
			'duration'    => 0,
			'thumbnail'   => '',
			'error'       => '',
		];

		$asset = self::asset( $asset_id );
		if ( is_wp_error( $asset ) ) {
			return array_merge( $blank, [ 'status' => 'error', 'error' => $asset->get_error_message() ] );
		}

		$status = strtolower( (string) ( $asset['status'] ?? '' ) );
		// `thumbnail_url`, and it is a list. Gumlet returns several stills per
		// asset; the first is the one its own dashboard shows.
		$thumbs = $asset['output']['thumbnail_url'] ?? ( $asset['thumbnail_url'] ?? [] );

		return [
			'status'       => $status,
			'ready'        => in_array( $status, self::READY_STATES, true ),
			'percent'      => isset( $asset['progress'] ) ? (int) $asset['progress'] : null,
			// Gumlet's own answer, always preferred over our URL template.
			'playbackUrl'  => (string) ( $asset['output']['playback_url'] ?? '' ),
			// The asset's own collection, which is what the playback URL is
			// built from. Read from the asset rather than from this site's
			// settings, so a video from another workspace still resolves.
			'collectionId' => (string) ( $asset['collection_id'] ?? ( $asset['source_id'] ?? '' ) ),
			'duration'     => (int) ( $asset['output']['duration'] ?? ( $asset['duration'] ?? ( $asset['input']['duration'] ?? 0 ) ) ),
			'thumbnail'    => is_array( $thumbs ) ? (string) ( $thumbs[0] ?? '' ) : (string) $thumbs,
			'error'        => in_array( $status, self::ERROR_STATES, true )
				? (string) ( $asset['error'] ?? __( 'Gumlet could not process this video.', 'trueplayer' ) )
				: '',
		];
	}

	/**
	 * Existing assets in the workspace, for the editor's "pick one I already
	 * uploaded" browser.
	 *
	 * @return array|\WP_Error List of { assetId, title, status, ready, duration, thumbnail }.
	 */
	public static function list_assets( int $limit = 100 ) {
		$c = self::config();
		if ( '' === $c['collectionId'] ) {
			return new \WP_Error(
				'tp_gumlet_unconfigured',
				__( 'Add your Gumlet collection ID to browse existing videos.', 'trueplayer' ),
				[ 'status' => 400 ]
			);
		}

		$response = self::request(
			'GET',
			add_query_arg(
				[ 'collection_id' => $c['collectionId'], 'limit' => max( 1, min( 500, $limit ) ) ],
				'/video/assets'
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		// Gumlet has returned both a bare list and a wrapped one across API
		// revisions; accept either rather than break on the shape.
		$rows = $response['data'] ?? ( $response['assets'] ?? $response );
		if ( ! is_array( $rows ) ) {
			return [];
		}

		$out = [];
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) || empty( $row['asset_id'] ) ) {
				continue;
			}
			$status = strtolower( (string) ( $row['status'] ?? '' ) );
			$thumbs = $row['output']['thumbnail'] ?? ( $row['thumbnail'] ?? [] );
			$out[]  = [
				'assetId'   => (string) $row['asset_id'],
				'title'     => (string) ( $row['title'] ?? ( $row['description'] ?? $row['asset_id'] ) ),
				'status'    => $status,
				'ready'     => in_array( $status, self::READY_STATES, true ),
				'duration'  => (int) ( $row['output']['duration'] ?? ( $row['duration'] ?? 0 ) ),
				'thumbnail' => is_array( $thumbs ) ? (string) ( $thumbs[0] ?? '' ) : (string) $thumbs,
				'src'       => (string) ( $row['output']['playback_url'] ?? '' ),
			];
		}
		return $out;
	}

	/**
	 * Delete an asset. Used only to clean up after a cancelled upload, so the
	 * outcome is reported but never acted on — an asset Gumlet declines to
	 * remove is untidy, not broken.
	 */
	public static function delete_asset( string $asset_id ): bool {
		$asset_id = self::parse_asset_id( $asset_id );
		if ( '' === $asset_id ) {
			return false;
		}
		return ! is_wp_error( self::request( 'DELETE', '/video/assets/' . rawurlencode( $asset_id ) ) );
	}

	/**
	 * The playback URL for an asset id.
	 *
	 * This is the one URL in the integration we construct rather than read back
	 * from the API, so it is the one thing that can be wrong without anything
	 * else being wrong. It is confined to this method and made overridable both
	 * by setting (`playbackHost`) and by filter, so correcting it never means
	 * touching a stored config: every pasted asset is resolved through here at
	 * render time, so a fix applies retroactively.
	 *
	 * Uploaded assets never rely on it — they store the URL Gumlet reported.
	 */
	public static function playback_url( string $asset_id, string $collection_id = '', string $ext = 'm3u8' ): string {
		$asset_id = self::parse_asset_id( $asset_id );
		if ( '' === $asset_id ) {
			return '';
		}
		$c = self::config();
		// The collection is part of the path, not decoration: a URL without it
		// 404s. Prefer the asset's own collection (it may live in a workspace
		// other than this site's default) and fall back to the configured one.
		$collection = '' !== $collection_id ? $collection_id : $c['collectionId'];
		if ( '' === $collection ) {
			return ''; // Nothing correct can be built; say so rather than guess.
		}
		$host = '' !== $c['playbackHost'] ? $c['playbackHost'] : self::DEFAULT_PLAYBACK_HOST;
		$url  = sprintf( 'https://%s/%s/%s/main.%s', $host, rawurlencode( $collection ), rawurlencode( $asset_id ), $ext );

		/**
		 * Correct the playback URL template without editing the plugin.
		 *
		 * @param string $url        The constructed URL.
		 * @param string $asset_id   Gumlet asset id.
		 * @param string $collection Gumlet collection (workspace) id.
		 * @param string $ext        Requested extension (m3u8, mpd, mp4).
		 */
		return (string) apply_filters( 'trueplayer/gumlet/playback_url', $url, $asset_id, $collection, $ext );
	}

	/**
	 * The workspaces this API key can see.
	 *
	 * Gumlet's API calls this a `collection_id`, its dashboard calls it a
	 * workspace, and nowhere in that dashboard is the id actually shown — so
	 * asking an author to paste one is asking for something they cannot find.
	 * We have the key, so we look it up for them.
	 *
	 * @return array|\WP_Error List of { id, name }.
	 */
	public static function collections() {
		$response = self::request( 'GET', '/video/sources' );
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$rows = $response['all_sources'] ?? ( $response['sources'] ?? $response );
		if ( ! is_array( $rows ) ) {
			return [];
		}
		$out = [];
		foreach ( $rows as $row ) {
			if ( is_array( $row ) && ! empty( $row['id'] ) ) {
				$out[] = [
					'id'   => (string) $row['id'],
					'name' => (string) ( $row['name'] ?? $row['id'] ),
				];
			}
		}
		return $out;
	}

	/** Gumlet's own hosted player for an asset. */
	public static function embed_url( string $asset_id ): string {
		$asset_id = self::parse_asset_id( $asset_id );
		return '' === $asset_id ? '' : 'https://' . self::EMBED_HOST . '/embed/' . rawurlencode( $asset_id );
	}

	/**
	 * Pull an asset id out of whatever the author had on their clipboard.
	 *
	 * Accepts a bare id, an embed URL, or a playback URL — because the Gumlet
	 * dashboard offers all three in different places, and which one someone
	 * copies is not a decision worth making them think about.
	 */
	public static function parse_asset_id( string $input ): string {
		$input = trim( $input );
		if ( '' === $input ) {
			return '';
		}

		// A bare id — hex-ish and of a plausible length.
		if ( 1 === preg_match( '/^[A-Za-z0-9_-]{8,64}$/', $input ) && false === strpos( $input, '.' ) ) {
			return $input;
		}

		$path = (string) wp_parse_url( $input, PHP_URL_PATH );
		if ( '' === $path ) {
			return '';
		}

		// play.gumlet.io/embed/{id}
		if ( preg_match( '#/embed/([A-Za-z0-9_-]{8,64})#', $path, $m ) ) {
			return $m[1];
		}

		// A playback URL: the id is the last path segment that isn't the file.
		$parts = array_values( array_filter( explode( '/', $path ) ) );
		if ( ! $parts ) {
			return '';
		}
		$last = array_pop( $parts );
		// `.../{id}/main.m3u8` — the id is the segment before the filename.
		if ( false !== strpos( $last, '.' ) ) {
			$last = $parts ? array_pop( $parts ) : '';
		}
		return 1 === preg_match( '/^[A-Za-z0-9_-]{8,64}$/', (string) $last ) ? (string) $last : '';
	}

	/** A filename we are willing to send, or '' if this one isn't one. */
	public static function safe_filename( string $name ): string {
		$name = sanitize_file_name( wp_basename( $name ) );
		$ext  = strtolower( pathinfo( $name, PATHINFO_EXTENSION ) );
		if ( '' === $name || ! in_array( $ext, self::ALLOWED_EXTENSIONS, true ) ) {
			return '';
		}
		return pathinfo( $name, PATHINFO_FILENAME ) . '.' . $ext;
	}

	/**
	 * One authenticated call to the Gumlet API.
	 *
	 * The only place the API key is read for an outbound request. Gumlet's own
	 * error message is carried through rather than flattened to a status code,
	 * because "collection not found" and "invalid key" are the two mistakes
	 * people actually make here and a bare 401 tells them neither.
	 *
	 * @return array|\WP_Error Decoded response body.
	 */
	private static function request( string $method, string $path, array $body = [] ) {
		$key = self::config()['apiKey'];
		if ( '' === $key ) {
			return new \WP_Error(
				'tp_gumlet_unconfigured',
				__( 'No Gumlet API key is saved.', 'trueplayer' ),
				[ 'status' => 400 ]
			);
		}

		$args = [
			'method'  => $method,
			'timeout' => 20,
			'headers' => [
				'Authorization' => 'Bearer ' . $key,
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
			],
		];
		if ( $body ) {
			$args['body'] = wp_json_encode( $body );
		}

		$response = wp_safe_remote_request( self::API_BASE . $path, $args );
		if ( is_wp_error( $response ) ) {
			return new \WP_Error( 'tp_gumlet_unreachable', $response->get_error_message(), [ 'status' => 502 ] );
		}

		$code    = (int) wp_remote_retrieve_response_code( $response );
		$decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		$decoded = is_array( $decoded ) ? $decoded : [];

		if ( $code < 200 || $code >= 300 ) {
			$message = (string) ( $decoded['error']['message'] ?? ( $decoded['message'] ?? '' ) );
			return new \WP_Error(
				'tp_gumlet_api',
				'' !== $message
					? $message
					/* translators: %d: HTTP status code returned by Gumlet. */
					: sprintf( __( 'Gumlet rejected the request (%d).', 'trueplayer' ), $code ),
				[ 'status' => 502, 'gumlet_status' => $code ]
			);
		}

		return $decoded;
	}

	/** Strip scheme, trailing slash and any path from a hostname setting. */
	private static function host_only( string $value ): string {
		$value = trim( $value );
		if ( '' === $value ) {
			return '';
		}
		$value = preg_replace( '#^https?://#i', '', $value );
		$value = explode( '/', (string) $value )[0];
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
}
