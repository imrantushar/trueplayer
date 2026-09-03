<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Instant video pages (pro): /tp/{video-id} serves a clean standalone page —
 * title, player, description — for any video with `instantPage` enabled.
 * Presto-style "one click and the video has a shareable page".
 */
class InstantPage {

	const QUERY_VAR = 'tp_video';

	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'add_rewrite' ] );
		add_filter( 'query_vars', [ $self, 'add_query_var' ] );
		add_action( 'template_redirect', [ $self, 'maybe_render' ] );
	}

	public function add_rewrite() {
		add_rewrite_rule( '^tp/([0-9]+)/?$', 'index.php?' . self::QUERY_VAR . '=$matches[1]', 'top' );
	}

	public function add_query_var( $vars ) {
		$vars[] = self::QUERY_VAR;
		return $vars;
	}

	/**
	 * The address this page is actually served at.
	 *
	 * `home_url`, never `site_url`: the rewrite rule is registered against the
	 * site's front end, so an install with WordPress in its own directory
	 * serves /tp/{id}/ from the home address, not from wp/. And with plain
	 * permalinks there is no pretty route at all — `add_rewrite_rule` produces
	 * nothing usable — so the query var is the only address that resolves.
	 */
	public static function url( int $video_id ): string {
		if ( ! get_option( 'permalink_structure' ) ) {
			return add_query_arg( self::QUERY_VAR, $video_id, home_url( '/' ) );
		}
		return home_url( '/tp/' . $video_id . '/' );
	}

	public function maybe_render() {
		$video_id = (int) get_query_var( self::QUERY_VAR );
		if ( ! $video_id ) {
			return;
		}

		$post = get_post( $video_id );
		if ( ! $post || TRUEPLAYER_VIDEO_POST_TYPE !== $post->post_type || 'publish' !== $post->post_status ) {
			$this->not_found();
		}

		$config = Helper::get_video_config( $video_id );
		if ( ! Pro::active() || empty( $config['instantPage'] ) ) {
			$this->not_found();
		}

		// A minimal document of our own — no theme header/footer noise, just
		// wp_head/wp_footer so the player runtime (and SEO plugins) load.
		status_header( 200 );
		?><!DOCTYPE html>
		<html <?php language_attributes(); ?>>
		<head>
			<meta charset="<?php bloginfo( 'charset' ); ?>" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<title><?php echo esc_html( get_the_title( $video_id ) ); ?> — <?php bloginfo( 'name' ); ?></title>
			<?php wp_head(); ?>
			<style>
				body.tp-instant-page { margin: 0; background: #0f1117; color: #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
				.tp-instant-wrap { max-width: 960px; margin: 0 auto; padding: 40px 20px 60px; }
				.tp-instant-title { font-size: 26px; font-weight: 700; margin: 0 0 18px; color: #fff; }
				.tp-instant-wrap .tp-description { color: #cbd5e1; }
			</style>
		</head>
		<body class="tp-instant-page">
			<div class="tp-instant-wrap">
				<h1 class="tp-instant-title"><?php echo esc_html( get_the_title( $video_id ) ); ?></h1>
				<?php echo do_shortcode( '[trueplayer id="' . $video_id . '"]' ); // phpcs:ignore WordPress.Security.EscapeOutput -- shortcode output ?>
			</div>
			<?php wp_footer(); ?>
		</body>
		</html>
		<?php
		exit;
	}

	private function not_found() {
		global $wp_query;
		$wp_query->set_404();
		status_header( 404 );
		nocache_headers();
		include get_query_template( '404' );
		exit;
	}
}
