<?php

namespace TruePlayer\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Menu {

	public static function init() {
		$self = new self();
		add_action( 'admin_menu', [ $self, 'register_menu' ] );
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
			$slug                => __( 'Dashboard', 'trueplayer' ),
			$slug . '-videos'    => __( 'Media', 'trueplayer' ),
		];
		// The Interactive (H5P) section only appears when the engine is present.
		if ( \TruePlayer\H5P\Module::is_available() ) {
			$subs[ $slug . '-interactive' ] = __( 'Interactive', 'trueplayer' );
		}
		$subs[ $slug . '-presets' ]  = __( 'Presets', 'trueplayer' );
		$subs[ $slug . '-settings' ] = __( 'Settings', 'trueplayer' );
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
