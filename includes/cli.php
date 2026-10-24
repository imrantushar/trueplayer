<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WP-CLI helpers for quick testing.
 *
 *   wp trueplayer seed            # create one demo video per source type + a playlist
 *   wp trueplayer seed --count=3  # extra plain demo videos on top
 *   wp trueplayer clean           # remove everything this seeder created
 */
class CLI {

	const SEED_META = '_tp_seeded';

	/**
	 * The demo videos — one per supported source type, with variety.
	 *
	 * Source URLs are left empty on purpose: the seeder is for exercising the
	 * editor UI, and bundling third-party media URLs would hard-wire remote
	 * dependencies into every seeded install. The administrator picks a real
	 * source from the editor after seeding.
	 */
	private function samples() {
		return [
			[
				'title'  => 'Demo — Self-hosted MP4 (chapters)',
				'config' => [
					'source'   => [ 'type' => 'url', 'src' => '', 'poster' => '' ],
					'chapters' => [
						[ 'at' => 0, 'label' => 'Opening' ],
						[ 'at' => 15, 'label' => 'The reef' ],
						[ 'at' => 30, 'label' => 'Open water' ],
						[ 'at' => 45, 'label' => 'Closing' ],
					],
				],
			],
			[
				'title'  => 'Demo — YouTube',
				'config' => [ 'source' => [ 'type' => 'youtube', 'src' => '' ] ],
			],
			[
				'title'  => 'Demo — Vimeo',
				'config' => [ 'source' => [ 'type' => 'vimeo', 'src' => '' ] ],
			],
			[
				'title'  => 'Demo — HLS stream',
				'config' => [ 'source' => [ 'type' => 'hls', 'src' => '' ] ],
			],
			[
				'title'  => 'Demo — Audio / podcast',
				'config' => [ 'source' => [ 'type' => 'url', 'src' => '', 'mediaType' => 'audio' ] ],
			],
			[
				'title'  => 'Demo — Bunny.net (placeholder ids)',
				'config' => [ 'source' => [ 'type' => 'bunny', 'pullZone' => '', 'videoId' => '' ] ],
			],
			[
				'title'  => 'Demo — Showcase (skin, overlays, action bar, layers)',
				'config' => [
					'source'      => [ 'type' => 'url', 'src' => '', 'poster' => '' ],
					'description' => 'A <strong>dynamic description</strong> rendered under the player — links, resources, anything.',
					'customize'   => [
						'appearance' => [ 'skin' => 'floating', 'aspectRatio' => '16:9', 'captionSize' => 120, 'captionOpacity' => 60 ],
						'behavior'   => [ 'hoverPreview' => true, 'autoplayMode' => 'off' ],
					],
					'branding'    => [ 'logo' => '', 'logoPosition' => 'bottom-left', 'logoOpacity' => 0.7, 'logoUrl' => '' ],
					'overlays'    => [
						[ 'id' => 'tx1', 'type' => 'text', 'start' => 2, 'end' => 8, 'position' => 'top-left', 'title' => 'Chapter 1', 'text' => 'The open ocean', 'bgOpacity' => 55 ],
						[ 'id' => 'cta1', 'trigger' => 'end', 'title' => 'Enjoyed it?', 'text' => 'See the full series.', 'buttonLabel' => 'Browse', 'buttonUrl' => '' ],
					],
					'actionBar'   => [ 'enabled' => true, 'text' => 'Limited offer — full course 30% off', 'buttonLabel' => 'Get it', 'buttonUrl' => '', 'position' => 'bottom' ],
					'layers'      => [
						[ 'id' => 'ly1', 'type' => 'hotspot', 'start' => 3, 'end' => 20, 'x' => 60, 'y' => 30, 'w' => 18, 'h' => 22, 'tooltip' => 'What is this?', 'url' => '' ],
						[ 'id' => 'ly2', 'type' => 'form', 'start' => 25, 'end' => 40, 'position' => 'bottom-center', 'title' => 'Get the bonus pack', 'buttonLabel' => 'Send it' ],
					],
					'protection'  => [ 'dynamicWatermark' => [ 'enabled' => true, 'fields' => [ 'email' ], 'opacity' => 0.35, 'drift' => true ] ],
					'instantPage' => true,
				],
			],
			[
				'title'  => 'Demo — Watch-verify + quiz (no-skip)',
				'config' => [
					'source'    => [ 'type' => 'url', 'src' => '' ],
					'customize' => [ 'behavior' => [ 'noSkip' => true ], 'appearance' => [ 'accent' => '#008dff' ] ],
					'gating'    => [
						'completionThreshold' => 80,
						'antiSkip'            => true,
						'maxAttempts'         => 2,
						'checkpoints'         => [
							[ 'id' => 'cp1', 'at' => 10, 'passPercent' => 100, 'title' => 'Quick check', 'questions' => [ [ 'id' => 'q1', 'type' => 'mcq', 'prompt' => 'What is in the video?', 'options' => [ [ 'id' => 'a', 'label' => 'Ocean' ], [ 'id' => 'b', 'label' => 'Desert' ] ], 'correct' => 'a' ] ] ],
						],
						'finalQuiz'           => [ 'passPercent' => 100, 'title' => 'Final', 'questions' => [ [ 'id' => 'f1', 'type' => 'boolean', 'prompt' => 'You watched the video', 'correct' => 'true' ] ] ],
					],
				],
			],
		];
	}

	/**
	 * ## OPTIONS
	 * [--count=<n>]  : Extra plain demo videos in addition to the per-type set.
	 * [--no-playlist] : Skip creating the demo playlist.
	 */
	public function seed( $args, $assoc ) {
		$ids = [];
		foreach ( $this->samples() as $s ) {
			$ids[] = $this->make_video( $s['title'], $s['config'] );
		}

		$extra = isset( $assoc['count'] ) ? max( 0, (int) $assoc['count'] ) : 0;
		for ( $i = 1; $i <= $extra; $i++ ) {
			$ids[] = $this->make_video( "Demo — Extra {$i}", [ 'source' => [ 'type' => 'url', 'src' => '' ] ] );
		}

		\WP_CLI::success( sprintf( 'Created %d demo videos.', count( $ids ) ) );

		if ( empty( $assoc['no-playlist'] ) ) {
			$pl = wp_insert_post( [ 'post_type' => Playlist::POST_TYPE, 'post_status' => 'publish', 'post_title' => 'Demo — Course playlist' ] );
			Helper::update_json_meta( $pl, '_trueplayer_playlist', [ 'title' => 'Demo course', 'layout' => 'sidebar', 'videos' => array_slice( $ids, 0, 5 ), 'autoplayNext' => true, 'showTitles' => true ] );
			update_post_meta( $pl, self::SEED_META, 1 );
			\WP_CLI::success( sprintf( 'Created playlist #%d — shortcode: [trueplayer_playlist id="%d"]', $pl, $pl ) );
		}

		\WP_CLI::log( 'Sample embed: [trueplayer id="' . $ids[0] . '"]' );
	}

	/** Remove everything the seeder created. */
	public function clean() {
		$removed = 0;
		foreach ( [ TRUEPLAYER_VIDEO_POST_TYPE, Playlist::POST_TYPE ] as $pt ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- WP-CLI seeder cleanup; the meta_key narrows the delete to posts this command itself created.
			$posts = get_posts( [ 'post_type' => $pt, 'post_status' => 'any', 'posts_per_page' => -1, 'meta_key' => self::SEED_META, 'fields' => 'ids' ] );
			foreach ( $posts as $id ) {
				wp_delete_post( $id, true );
				$removed++;
			}
		}
		\WP_CLI::success( sprintf( 'Removed %d seeded items.', $removed ) );
	}

	private function make_video( $title, $config ) {
		$id = wp_insert_post( [ 'post_type' => TRUEPLAYER_VIDEO_POST_TYPE, 'post_status' => 'publish', 'post_title' => $title ] );
		Helper::update_json_meta( $id, '_trueplayer_config', $config );
		update_post_meta( $id, self::SEED_META, 1 );
		return $id;
	}
}
