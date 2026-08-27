<?php

namespace TruePlayer\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Menu {

	/**
	 * Playlists and interactive content used to be their own submenu pages.
	 * They're filters of the Media screen now; the old slugs redirect there.
	 */
	const LEGACY_PAGES = [
		'-playlists'   => 'playlist',
		'-interactive' => 'interactive',
	];

	public static function init() {
		$self = new self();
		add_action( 'admin_menu', [ $self, 'register_menu' ] );
		add_action( 'admin_head', [ $self, 'brand_icon_style' ] );
		// Must run before WP's own access check, which wp_die()s on a page slug
		// that no longer exists — that check lives at the end of the same file
		// that fires admin_menu, and admin_init is later still.
		add_action( 'admin_menu', [ $self, 'redirect_legacy_pages' ], 5 );
	}

	/**
	 * Send the retired section URLs to the library, filtered to what they used
	 * to show, so anything still linking to them keeps working.
	 */
	public function redirect_legacy_pages(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
		if ( '' === $page ) {
			return;
		}

		$slug = TRUEPLAYER_PLUGIN_SLUG;
		foreach ( self::LEGACY_PAGES as $suffix => $kind ) {
			if ( $slug . $suffix !== $page ) {
				continue;
			}
			wp_safe_redirect(
				admin_url( add_query_arg(
					[ 'page' => $slug . '-videos', 'kind' => $kind ],
					'admin.php'
				) )
			);
			exit;
		}
	}

	public function register_menu() {
		$brand = \TruePlayer\Helper::brand_name();
		add_menu_page(
			$brand,
			$brand,
			'manage_options',
			TRUEPLAYER_PLUGIN_SLUG,
			[ $this, 'render_app' ],
			self::menu_icon(),
			30
		);

		// Child menu (StoreEngine-style): each section is its own page slug so it
		// gets a real URL and appears in the WP admin submenu. All boot the same SPA.
		$slug = TRUEPLAYER_PLUGIN_SLUG;
		$subs = [
			$slug             => __( 'Dashboard', 'trueplayer' ),
			$slug . '-videos' => __( 'Media', 'trueplayer' ),
			$slug . '-presets'  => __( 'Presets', 'trueplayer' ),
			$slug . '-settings' => __( 'Settings', 'trueplayer' ),
		];
		foreach ( $subs as $page_slug => $label ) {
			add_submenu_page( $slug, $label . ' – ' . $brand, $label, 'manage_options', $page_slug, [ $this, 'render_app' ] );
		}
	}

	/**
	 * The menu mark: the owner's own logo when white-label supplies one,
	 * otherwise WordPress's video dashicon. add_menu_page takes a URL here as
	 * happily as a dashicon name, so a custom logo needs no extra plumbing.
	 */
	private static function menu_icon(): string {
		$logo = \TruePlayer\Helper::brand_logo();
		return $logo ? esc_url_raw( $logo ) : 'dashicons-format-video';
	}

	/**
	 * Keep a white-label logo the size of a menu icon.
	 *
	 * `add_menu_page()` renders whatever URL it is given as a plain <img>, and
	 * WordPress constrains it to nothing — its own icons are 20px sprites, so a
	 * real logo (or, worse, a photo someone picked from the media library)
	 * painted at full natural size straight across the screen. WordPress sizes
	 * dashicons but has no rule for image icons, so this supplies one.
	 *
	 * Only printed when a custom logo is actually in use; the default dashicon
	 * needs nothing.
	 */
	public function brand_icon_style(): void {
		if ( ! \TruePlayer\Helper::brand_logo() ) {
			return;
		}
		printf(
			'<style id="trueplayer-brand-icon">#adminmenu .toplevel_page_%1$s .wp-menu-image img{width:20px;height:20px;max-width:20px;object-fit:contain;}</style>',
			esc_attr( TRUEPLAYER_PLUGIN_SLUG )
		);
	}

	public function render_app() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : TRUEPLAYER_PLUGIN_SLUG;
		printf( '<div id="trueplayer-app" class="trueplayer-app" data-page="%s"></div>', esc_attr( $page ) );
	}
}
