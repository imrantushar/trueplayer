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
			'dashicons-format-video',
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

	public function render_app() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : TRUEPLAYER_PLUGIN_SLUG;
		printf( '<div id="trueplayer-app" class="trueplayer-app" data-page="%s"></div>', esc_attr( $page ) );
	}
}
