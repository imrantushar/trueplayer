<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\API\VideosController;

/**
 * Registers the dynamic `trueplayer/player` block. Render is delegated to the
 * shortcode so there is a single embed code path (and answer-key stripping,
 * gate wiring, etc. all live in one place).
 */
class Block {

	const SCRIPT_HANDLE = 'trueplayer-block';
	const GLOBAL_OBJECT = 'TruePlayerBlock';

	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'register' ] );
		add_action( 'enqueue_block_editor_assets', [ $self, 'editor_assets' ] );
		add_action( 'enqueue_block_assets', [ $self, 'canvas_assets' ] );
	}

	public function register() {
		register_block_type(
			'trueplayer/player',
			[
				// v3 declares the block safe to render inside the editor's
				// iframed canvas, which WordPress now always uses. Nothing in
				// the edit UI reaches for the top document except the create
				// dialog, and that portals out on purpose.
				'api_version'     => 3,
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
			self::SCRIPT_HANDLE,
			TRUEPLAYER_ASSETS_URI . sprintf( 'build/block.%s.js', TRUEPLAYER_VERSION ),
			$asset['dependencies'],
			$asset['version'],
			true
		);

		wp_localize_script( self::SCRIPT_HANDLE, self::GLOBAL_OBJECT, $this->editor_data() );
		// The in-canvas preview renders the real frontend player, which reads
		// its site-wide defaults and pro state from this object exactly as it
		// does on a published page. Without it the preview would quietly fall
		// back to the built-in defaults and stop matching what visitors see.
		wp_localize_script( self::SCRIPT_HANDLE, Assets::GLOBAL_OBJECT, ( new Assets() )->get_frontend_scripts_data() );
		wp_set_script_translations( self::SCRIPT_HANDLE, 'trueplayer', TRUEPLAYER_ROOT_DIR_PATH . 'languages/' );
	}

	/**
	 * The player's stylesheet, inside the editor canvas.
	 *
	 * `enqueue_block_assets` is the hook whose styles WordPress injects into the
	 * iframed canvas — `enqueue_block_editor_assets` only reaches the document
	 * around it, where nothing of ours renders. The stylesheet is the frontend
	 * one, unmodified, because the preview is the frontend player.
	 *
	 * It is NOT imported by the block's JS: sharing a CSS module across two
	 * webpack entries makes the `style` cacheGroup merge them and stop emitting
	 * one of the stylesheets, which is how the real frontend player once ended
	 * up unstyled in production.
	 */
	public function canvas_assets(): void {
		// This hook also fires on the front end, where the shortcode already
		// enqueues the stylesheet on demand — only pages with a player pay for
		// it there, and that should stay true.
		if ( ! is_admin() ) {
			return;
		}
		$file = TRUEPLAYER_ASSETS_DIR_PATH . 'build/style-frontend.css';
		wp_enqueue_style(
			'trueplayer-block-canvas',
			TRUEPLAYER_ASSETS_URI . 'build/style-frontend.css',
			[],
			file_exists( $file ) ? filemtime( $file ) : TRUEPLAYER_VERSION
		);
	}

	/**
	 * What the block editor is told about TruePlayer.
	 *
	 * Deliberately not the admin app's payload (see Assets::get_backend_scripts_data):
	 * this is the block's own chrome — who it is talking to and where the full
	 * editor lives — and nothing more. The player's runtime state rides
	 * separately under TruePlayerGlobal, and the block's own REST calls
	 * authenticate through @wordpress/api-fetch.
	 */
	private function editor_data(): array {
		// `manage_options`, matching the admin menu — an author can create a
		// video from the block but has nowhere to open it, so they are not
		// offered a link into a screen they cannot load.
		$can_manage = current_user_can( 'manage_options' );

		return apply_filters(
			'trueplayer/block/editor_data',
			[
				'brand'      => Helper::brand_name(),
				// Mirrors the REST permission callback rather than restating
				// it, so the dialog can never be offered to someone the
				// endpoint would refuse.
				'canCreate'  => VideosController::can_quick_create(),
				'isPro'      => Pro::active(),
				'libraryUrl' => $can_manage ? admin_url( 'admin.php?page=trueplayer-videos' ) : '',
				'editUrl'    => $can_manage ? admin_url( 'admin.php?page=trueplayer-videos&action=edit&id=' ) : '',
			]
		);
	}
}
