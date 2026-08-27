<?php

namespace TruePlayerInteractive;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires the vendored H5P core (global-namespace classes) to TruePlayer's
 * Framework glue and file storage, and hands out the H5PCore / validator /
 * storage instances the rest of the engine needs.
 *
 * H5P content + libraries live under an uploads subdirectory
 * (`uploads/trueplayer-h5p/`), completely separate from any other H5P install.
 *
 * Everything here is lazy and only reachable once Module::is_available() is
 * true (the runtime is vendored), so a runtime-less build never loads a byte
 * of this.
 */
class Core {

	/** @var \H5PCore */
	private static $core;

	/** @var Framework */
	private static $framework;

	private static $included = false;

	/** Uploads subdir (relative to wp_upload_dir basedir/baseurl). */
	const STORAGE_DIR = 'trueplayer-h5p';

	/**
	 * require_once the vendored core classes (global namespace, no autoload).
	 */
	public static function include_core(): void {
		if ( self::$included ) {
			return;
		}
		$dir = Module::runtime_dir() . '/h5p-php-library/';
		require_once $dir . 'h5p-development.class.php';
		require_once $dir . 'h5p-file-storage.interface.php';
		require_once $dir . 'h5p-default-storage.class.php';
		require_once $dir . 'h5p-event-base.class.php';
		require_once $dir . 'h5p-metadata.class.php';
		require_once $dir . 'h5p.classes.php';
		self::$included = true;
	}

	/**
	 * Absolute + URL storage locations, created on first use.
	 *
	 * @return array{path:string,url:string}
	 */
	public static function paths(): array {
		$uploads = wp_upload_dir();
		return [
			'path' => trailingslashit( $uploads['basedir'] ) . self::STORAGE_DIR,
			'url'  => trailingslashit( $uploads['baseurl'] ) . self::STORAGE_DIR,
		];
	}

	/**
	 * Ensure the storage tree exists (libraries/, content/, tmp/, exports/,
	 * cachedassets/). H5PDefaultStorage lazily creates most of these, but we
	 * seed the root + libraries so URLs resolve immediately.
	 */
	public static function ensure_dirs(): void {
		$base = self::paths()['path'];
		foreach ( [ '', '/libraries', '/content', '/cachedassets', '/temp', '/exports' ] as $sub ) {
			$dir = $base . $sub;
			if ( ! is_dir( $dir ) ) {
				wp_mkdir_p( $dir );
			}
		}
	}

	/**
	 * The Framework glue (H5PFrameworkInterface implementation).
	 */
	public static function framework(): Framework {
		if ( ! self::$framework ) {
			self::include_core();
			self::$framework = new Framework();
		}
		return self::$framework;
	}

	/**
	 * The shared H5PCore instance.
	 *
	 * @return \H5PCore
	 */
	public static function core() {
		if ( ! self::$core ) {
			self::include_core();
			self::ensure_dirs();
			$paths = self::paths();
			// Export (.h5p download) is off by default — the builder doesn't need
			// it, and enabling it rebuilds an export zip on every content save.
			$export = (bool) apply_filters( 'trueplayer/h5p/export_enabled', false );

			self::$core = new \H5PCore(
				self::framework(),
				$paths['path'],
				$paths['url'],
				self::language(),
				$export
			);
			self::$core->aggregateAssets = (bool) apply_filters( 'trueplayer/h5p/aggregate_assets', true );
		}
		return self::$core;
	}

	/**
	 * @return \H5PValidator
	 */
	public static function validator() {
		return new \H5PValidator( self::framework(), self::core() );
	}

	/**
	 * @return \H5PStorage
	 */
	public static function storage() {
		return new \H5PStorage( self::framework(), self::core() );
	}

	/**
	 * @return \H5PContentValidator
	 */
	public static function content_validator() {
		return new \H5PContentValidator( self::framework(), self::core() );
	}

	/**
	 * H5P language code derived from the site locale (e.g. `nb_NO` → `nb`).
	 *
	 * @return string
	 */
	public static function language(): string {
		$locale = function_exists( 'determine_locale' ) ? determine_locale() : get_locale();
		$code   = strtolower( substr( (string) $locale, 0, 2 ) );
		return $code ?: 'en';
	}
}
