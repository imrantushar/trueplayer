<?php

namespace TruePlayer\H5P;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds the `H5PIntegration` JavaScript settings object and enqueues the H5P
 * core runtime + per-content library assets, so H5P's own `h5p.js` can boot
 * any `.h5p-content` mount on the page.
 *
 * Uses the "div" embed type (assets loaded inline on the page) — the default
 * for the field-based content types the builder targets first.
 *
 * Adapted from the reference plugin's add_core_assets / get_content_settings /
 * add_assets, trimmed to what a self-hosted render needs.
 */
class Assets {

	/** @var array|null The single H5PIntegration settings object for the request. */
	private static $settings = null;

	/**
	 * Stylesheet URLs to emit in the footer. A shortcode renders inside
	 * the_content — after wp_head — so styles enqueued through WP would never
	 * print. We collect their URLs and echo plain <link> tags in wp_footer
	 * instead (a brief FOUC is acceptable for interactive content).
	 *
	 * @var string[]
	 */
	private static $style_urls = [];

	/** Base URL of the vendored H5P core library. */
	public static function core_base_url(): string {
		return TRUEPLAYER_PLUGIN_ROOT_URI . 'includes/h5p/runtime/h5p-php-library/';
	}

	/**
	 * Initialise H5PIntegration + enqueue the H5P core scripts/styles. Idempotent.
	 */
	public static function add_core_assets(): void {
		if ( self::$settings !== null ) {
			return;
		}

		$core      = Core::core();
		$framework = Core::framework();
		$base      = self::core_base_url();
		$ver       = defined( 'TRUEPLAYER_VERSION' ) ? TRUEPLAYER_VERSION : '1.0';

		self::$settings = [
			'baseUrl'            => site_url(),
			'url'                => Core::paths()['url'],
			'postUserStatistics' => false,
			'ajax'               => [
				'setFinished'     => admin_url( 'admin-ajax.php?action=trueplayer_h5p_set_finished' ),
				'contentUserData' => admin_url( 'admin-ajax.php?action=trueplayer_h5p_content_user_data&content_id=:contentId&data_type=:dataType&sub_content_id=:subContentId' ),
			],
			'saveFreq'           => false,
			'siteUrl'            => site_url(),
			'l10n'               => [ 'H5P' => $core->getLocalization() ],
			'hubIsEnabled'       => false,
			'reportingIsEnabled' => false,
			'libraryConfig'      => $framework->getLibraryConfig(),
			'pluginCacheBuster'  => '?v=' . $ver,
			'libraryUrl'         => $base . 'js',
			'core'               => [ 'styles' => [], 'scripts' => [] ],
			'loadedJs'           => [],
			'loadedCss'          => [],
			'contents'           => [],
		];

		foreach ( \H5PCore::$styles as $style ) {
			$url                                = $base . $style . '?ver=' . $ver;
			self::$settings['core']['styles'][] = $url;
			self::$style_urls[]                 = $url;
		}
		foreach ( \H5PCore::$scripts as $script ) {
			$url                             = $base . $script;
			self::$settings['core']['scripts'][] = $url;
			wp_enqueue_script( 'trueplayer-h5p-core-' . sanitize_key( $script ), $url, [], $ver, true );
		}

		// Print H5PIntegration in the footer, before the enqueued scripts run.
		add_action( 'wp_footer', [ __CLASS__, 'print_settings' ], 10 );
	}

	/**
	 * Register a content instance and return its mount markup.
	 *
	 * @param array $content A content array from H5PCore::loadContent().
	 * @return string
	 */
	public static function add_content( array $content, int $video_id = 0 ): string {
		self::add_core_assets();
		$core = Core::core();
		$cid  = 'cid-' . $content['id'];

		// xAPI → TruePlayer events bridge (loads after h5p.js).
		$xapi_ver = defined( 'TRUEPLAYER_VERSION' ) ? TRUEPLAYER_VERSION : '1.0';
		wp_enqueue_script( 'trueplayer-h5p-xapi', TRUEPLAYER_ASSETS_URI . 'h5p-xapi.js', [], $xapi_ver, true );
		wp_localize_script( 'trueplayer-h5p-xapi', 'TruePlayerH5PxAPI', [
			'endpoint'  => rest_url( TRUEPLAYER_PLUGIN_SLUG . '/v1/h5p/xapi' ),
			'nonce'     => wp_create_nonce( 'wp_rest' ),
			'video'     => $video_id,
			'contentId' => (int) $content['id'],
		] );

		if ( ! isset( self::$settings['contents'][ $cid ] ) ) {
			self::$settings['contents'][ $cid ] = self::content_settings( $content );

			$dependencies = $core->loadContentDependencies( $content['id'], 'preloaded' );
			$files        = $core->getDependenciesFiles( $dependencies );

			// Core scripts are already enqueued (add_core_assets ran first), so
			// enqueue order keeps H5P core ahead of these library scripts.
			foreach ( $core->getAssetsUrls( $files['scripts'] ) as $url ) {
				wp_enqueue_script( 'trueplayer-h5p-lib-' . md5( $url ), $url, [], null, true );
			}
			foreach ( $core->getAssetsUrls( $files['styles'] ) as $url ) {
				self::$style_urls[] = $url;
			}
		}

		return sprintf( '<div class="h5p-content" data-content-id="%d"></div>', (int) $content['id'] );
	}

	/**
	 * Per-content H5PIntegration settings.
	 *
	 * @param array $content
	 * @return array
	 */
	private static function content_settings( array $content ): array {
		$core = Core::core();
		$safe = $core->filterParameters( $content );

		return [
			'library'         => \H5PCore::libraryToString( $content['library'] ),
			'jsonContent'     => $safe,
			'fullScreen'      => $content['library']['fullscreen'],
			'exportUrl'       => '',
			'embedCode'       => '',
			'resizeCode'      => '',
			'url'             => site_url(),
			'title'           => $content['title'] ?? '',
			'displayOptions'  => $core->getDisplayOptionsForView( $content['disable'], (int) ( $content['user_id'] ?? 0 ) ),
			'metadata'        => $content['metadata'] ?? [],
			'contentUserData' => [ 0 => [ 'state' => '{}' ] ],
		];
	}

	/**
	 * Emit the H5PIntegration global (once).
	 */
	public static function print_settings(): void {
		static $printed = false;
		if ( $printed || self::$settings === null ) {
			return;
		}
		$printed = true;

		// Emit the H5P styles that missed wp_head (enqueued during the_content).
		foreach ( array_unique( self::$style_urls ) as $url ) {
			echo '<link rel="stylesheet" href="' . esc_url( $url ) . '" />' . "\n";
		}

		$json = wp_json_encode( self::$settings );
		if ( $json !== false ) {
			echo '<script>window.H5PIntegration = ' . $json . ';</script>';
		}
	}
}
