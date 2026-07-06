<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the dynamic `trueplayer/player` block. Render is delegated to the
 * shortcode so there is a single embed code path (and answer-key stripping,
 * gate wiring, etc. all live in one place).
 */
class Block {

	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'register' ] );
		add_action( 'enqueue_block_editor_assets', [ $self, 'editor_assets' ] );
	}

	public function register() {
		register_block_type(
			'trueplayer/player',
			[
				'api_version'     => 2,
				'attributes'      => [
					'videoId' => [ 'type' => 'number', 'default' => 0 ],
				],
				'render_callback' => [ $this, 'render' ],
			]
		);
	}

	public function render( $attributes ) {
		$id = isset( $attributes['videoId'] ) ? (int) $attributes['videoId'] : 0;
		if ( ! $id ) {
			return '';
		}
		return do_shortcode( sprintf( '[trueplayer id="%d"]', $id ) );
	}

	public function editor_assets() {
		$deps = TRUEPLAYER_ASSETS_DIR_PATH . sprintf( 'build/block.%s.asset.php', TRUEPLAYER_VERSION );
		$asset = file_exists( $deps ) ? include $deps : [ 'dependencies' => [], 'version' => TRUEPLAYER_VERSION ];

		wp_enqueue_script(
			'trueplayer-block',
			TRUEPLAYER_ASSETS_URI . sprintf( 'build/block.%s.js', TRUEPLAYER_VERSION ),
			$asset['dependencies'],
			$asset['version'],
			true
		);
	}
}
