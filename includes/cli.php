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
				'title'  => __( 'Demo — Self-hosted MP4 (chapters)', 'trueplayer' ),
				'config' => [
					'source'   => [ 'type' => 'url', 'src' => '', 'poster' => '' ],
					'chapters' => [
						[ 'at' => 0, 'label' => __( 'Opening', 'trueplayer' ) ],
						[ 'at' => 15, 'label' => __( 'The reef', 'trueplayer' ) ],
						[ 'at' => 30, 'label' => __( 'Open water', 'trueplayer' ) ],
						[ 'at' => 45, 'label' => __( 'Closing', 'trueplayer' ) ],
					],
				],
			],
			[
				'title'  => __( 'Demo — YouTube', 'trueplayer' ),
				'config' => [ 'source' => [ 'type' => 'youtube', 'src' => '' ] ],
			],
			[
				'title'  => __( 'Demo — Vimeo', 'trueplayer' ),
				'config' => [ 'source' => [ 'type' => 'vimeo', 'src' => '' ] ],
			],
			[
				'title'  => __( 'Demo — HLS stream', 'trueplayer' ),
				'config' => [ 'source' => [ 'type' => 'hls', 'src' => '' ] ],
			],
			[
				'title'  => __( 'Demo — Audio / podcast', 'trueplayer' ),
				'config' => [ 'source' => [ 'type' => 'url', 'src' => '', 'mediaType' => 'audio' ] ],
			],
			[
				'title'  => __( 'Demo — Bunny.net (placeholder ids)', 'trueplayer' ),
				'config' => [ 'source' => [ 'type' => 'bunny', 'pullZone' => '', 'videoId' => '' ] ],
			],
			[
				'title'  => __( 'Demo — Showcase (skin, overlays, action bar, layers)', 'trueplayer' ),
				'config' => [
					'source'      => [ 'type' => 'url', 'src' => '', 'poster' => '' ],
					'description' => sprintf(
						/* translators: %s: the words "dynamic description" in bold. */
						__( 'A %s rendered under the player — links, resources, anything.', 'trueplayer' ),
						'<strong>' . __( 'dynamic description', 'trueplayer' ) . '</strong>'
					),
					'customize'   => [
						'appearance' => [ 'skin' => 'floating', 'aspectRatio' => '16:9', 'captionSize' => 120, 'captionOpacity' => 60 ],
						'behavior'   => [ 'hoverPreview' => true, 'autoplayMode' => 'off' ],
					],
					'branding'    => [ 'logo' => '', 'logoPosition' => 'bottom-left', 'logoOpacity' => 0.7, 'logoUrl' => '' ],
					'overlays'    => [
						[ 'id' => 'tx1', 'type' => 'text', 'start' => 2, 'end' => 8, 'position' => 'top-left', 'title' => __( 'Chapter 1', 'trueplayer' ), 'text' => __( 'The open ocean', 'trueplayer' ), 'bgOpacity' => 55 ],
						[ 'id' => 'cta1', 'trigger' => 'end', 'title' => __( 'Enjoyed it?', 'trueplayer' ), 'text' => __( 'See the full series.', 'trueplayer' ), 'buttonLabel' => __( 'Browse', 'trueplayer' ), 'buttonUrl' => '' ],
					],
					'actionBar'   => [ 'enabled' => true, 'text' => __( 'Limited offer — full course 30% off', 'trueplayer' ), 'buttonLabel' => __( 'Get it', 'trueplayer' ), 'buttonUrl' => '', 'position' => 'bottom' ],
					'layers'      => [
						[ 'id' => 'ly1', 'type' => 'hotspot', 'start' => 3, 'end' => 20, 'x' => 60, 'y' => 30, 'w' => 18, 'h' => 22, 'tooltip' => __( 'What is this?', 'trueplayer' ), 'url' => '' ],
						[ 'id' => 'ly2', 'type' => 'form', 'start' => 25, 'end' => 40, 'position' => 'bottom-center', 'title' => __( 'Get the bonus pack', 'trueplayer' ), 'buttonLabel' => __( 'Send it', 'trueplayer' ) ],
					],
					'protection'  => [ 'dynamicWatermark' => [ 'enabled' => true, 'fields' => [ 'email' ], 'opacity' => 0.35, 'drift' => true ] ],
					'instantPage' => true,
				],
			],
			[
				'title'  => __( 'Demo — Watch-verify + quiz (no-skip)', 'trueplayer' ),
				'config' => [
					'source'    => [ 'type' => 'url', 'src' => '' ],
					'customize' => [ 'behavior' => [ 'noSkip' => true ], 'appearance' => [ 'accent' => '#008dff' ] ],
					'gating'    => [
						'completionThreshold' => 80,
						'antiSkip'            => true,
						'maxAttempts'         => 2,
						'checkpoints'         => [
							[ 'id' => 'cp1', 'at' => 10, 'passPercent' => 100, 'title' => __( 'Quick check', 'trueplayer' ), 'questions' => [ [ 'id' => 'q1', 'type' => 'mcq', 'prompt' => __( 'What is in the video?', 'trueplayer' ), 'options' => [ [ 'id' => 'a', 'label' => __( 'Ocean', 'trueplayer' ) ], [ 'id' => 'b', 'label' => __( 'Desert', 'trueplayer' ) ] ], 'correct' => 'a' ] ] ],
						],
						'finalQuiz'           => [ 'passPercent' => 100, 'title' => __( 'Final', 'trueplayer' ), 'questions' => [ [ 'id' => 'f1', 'type' => 'boolean', 'prompt' => __( 'You watched the video', 'trueplayer' ), 'correct' => 'true' ] ] ],
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
			$ids[] = $this->make_video( sprintf(
				/* translators: %d: sequence number of the extra demo video. */
				__( 'Demo — Extra %d', 'trueplayer' ),
				$i
			), [ 'source' => [ 'type' => 'url', 'src' => '' ] ] );
		}

		\WP_CLI::success( sprintf(
			/* translators: %d: number of demo videos created. */
			__( 'Created %d demo videos.', 'trueplayer' ),
			count( $ids )
		) );

		if ( empty( $assoc['no-playlist'] ) ) {
			$pl = wp_insert_post( [ 'post_type' => Playlist::POST_TYPE, 'post_status' => 'publish', 'post_title' => __( 'Demo — Course playlist', 'trueplayer' ) ] );
			Helper::update_json_meta( $pl, '_trueplayer_playlist', [ 'title' => __( 'Demo course', 'trueplayer' ), 'layout' => 'sidebar', 'videos' => array_slice( $ids, 0, 5 ), 'autoplayNext' => true, 'showTitles' => true ] );
			update_post_meta( $pl, self::SEED_META, 1 );
			\WP_CLI::success( sprintf(
				/* translators: 1: playlist post ID, 2: playlist post ID used in the shortcode. */
				__( 'Created playlist #%1$d — shortcode: [trueplayer_playlist id="%2$d"]', 'trueplayer' ),
				$pl,
				$pl
			) );
		}

		\WP_CLI::log( sprintf(
			/* translators: %d: video post ID. */
			__( 'Sample embed: [trueplayer id="%d"]', 'trueplayer' ),
			$ids[0]
		) );
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
		\WP_CLI::success( sprintf(
			/* translators: %d: number of seeded items removed. */
			__( 'Removed %d seeded items.', 'trueplayer' ),
			$removed
		) );
	}

	private function make_video( $title, $config ) {
		$id = wp_insert_post( [ 'post_type' => TRUEPLAYER_VIDEO_POST_TYPE, 'post_status' => 'publish', 'post_title' => $title ] );
		Helper::update_json_meta( $id, '_trueplayer_config', $config );
		update_post_meta( $id, self::SEED_META, 1 );
		return $id;
	}
}
