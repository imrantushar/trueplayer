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
		add_menu_page(
			__( 'TruePlayer', 'trueplayer' ),
			__( 'TruePlayer', 'trueplayer' ),
			'manage_options',
			TRUEPLAYER_PLUGIN_SLUG,
			[ $this, 'render_app' ],
			'dashicons-format-video',
			30
		);
	}

	public function render_app() {
		echo '<div id="trueplayer-app" class="trueplayer-app"></div>';
	}
}
