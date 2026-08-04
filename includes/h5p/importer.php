<?php

namespace TruePlayer\H5P;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Installs H5P libraries + content into TruePlayer's runtime.
 *
 * Two entry points:
 *   - import_file(): validate + store a local `.h5p` package (the standard H5P
 *     upload flow — validate with H5PValidator, persist with H5PStorage).
 *   - install_content_type(): one-click fetch of a content type (with all its
 *     dependency libraries) from the official H5P content-type hub API, then
 *     install just the libraries.
 *
 * Mirrors the reference plugin's upload sequence (rename into the core temp
 * path → isValidPackage → savePackage → read contentId).
 */
class Importer {

	const HUB_CONTENT_TYPE_API = 'https://api.h5p.org/v1/content-types/';

	/**
	 * Validate and store a `.h5p` package.
	 *
	 * @param string     $file_path    Absolute path to the .h5p file.
	 * @param array|null $content      Existing content to update, or null for new.
	 * @param bool       $skip_content Install libraries only (ignore bundled content).
	 * @return int|\WP_Error Content id (0 when $skip_content), or WP_Error.
	 */
	public static function import_file( string $file_path, $content = null, bool $skip_content = false ) {
		if ( ! is_readable( $file_path ) ) {
			return new \WP_Error( 'h5p_missing_file', __( 'H5P package not found.', 'trueplayer' ) );
		}

		$core      = Core::core();
		$validator = Core::validator();
		$framework = Core::framework();

		// Core validates by extension + extracts from its own temp path.
		$uploaded_path = $framework->getUploadedH5pPath();
		if ( ! @copy( $file_path, $uploaded_path ) ) {
			return new \WP_Error( 'h5p_copy_failed', __( 'Could not stage the H5P package for import.', 'trueplayer' ) );
		}

		if ( ! $validator->isValidPackage( $skip_content, false ) ) {
			@unlink( $uploaded_path );
			$errors = $framework->getMessages( 'error' );
			return new \WP_Error( 'h5p_invalid_package', __( 'The file is not a valid H5P package.', 'trueplayer' ), $errors );
		}

		if ( ! $skip_content ) {
			if ( ! is_array( $content ) ) {
				$content = [];
			}
			if ( empty( $content['metadata']['title'] ) ) {
				$main_title                   = $validator->h5pC->mainJsonData['title'] ?? '';
				$content['metadata']['title'] = $main_title !== '' ? $main_title : __( 'Imported content', 'trueplayer' );
			}
		}

		$storage = Core::storage();
		$storage->savePackage( $skip_content ? null : $content, null, $skip_content );
		@unlink( $uploaded_path );

		return (int) $storage->contentId;
	}

	/**
	 * Download a content type (and its dependencies) from the official H5P
	 * content-type hub and install its libraries.
	 *
	 * @param string $machine_name e.g. "H5P.MultiChoice".
	 * @param bool   $with_content Also import the sample content bundled in the package.
	 * @return int|\WP_Error Content id (0 when libraries-only), or WP_Error.
	 */
	public static function install_content_type( string $machine_name, bool $with_content = false ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';

		$url = self::HUB_CONTENT_TYPE_API . rawurlencode( $machine_name );
		$tmp = download_url( $url, 60 );
		if ( is_wp_error( $tmp ) ) {
			return $tmp;
		}

		$result = self::import_file( $tmp, null, ! $with_content );
		@unlink( $tmp );
		return $result;
	}
}
