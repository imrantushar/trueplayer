<?php

namespace TruePlayer\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\Database\PostType;
use TruePlayer\Helper;

/**
 * Migration importer — pulls an existing Presto Player or FluentPlayer library
 * into TruePlayer videos. An acquisition wedge: a site can switch without
 * re-adding every video.
 *
 * Each imported video records `_trueplayer_imported_from = "{source}:{orig_id}"`
 * so re-running an import is idempotent (already-imported originals are skipped).
 * Only the source essentials are mapped (type, src, poster, media type, tags);
 * TruePlayer's own defaults fill the rest.
 */
class ImportService {

	const IMPORT_META = '_trueplayer_imported_from';

	/** source key => origin CPT. */
	const SOURCES = [
		'presto'       => 'pp_video_block',
		'fluentplayer' => 'fluent_player_media',
	];

	/** What can be imported, and how much. */
	public static function scan(): array {
		$out = [];
		foreach ( self::SOURCES as $key => $post_type ) {
			$available = post_type_exists( $post_type );
			$total     = $available ? (int) ( wp_count_posts( $post_type )->publish ?? 0 ) : 0;
			$out[ $key ] = [
				'available' => $available,
				'total'     => $total,
				'imported'  => self::imported_count( $key ),
			];
		}
		return $out;
	}

	private static function imported_count( string $source ): int {
		global $wpdb;
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key=%s AND meta_value LIKE %s",
				self::IMPORT_META,
				$wpdb->esc_like( $source . ':' ) . '%'
			)
		);
	}

	/** Import up to $limit not-yet-imported videos from a source. */
	public static function import( string $source, int $limit = 50 ): array {
		if ( ! isset( self::SOURCES[ $source ] ) || ! post_type_exists( self::SOURCES[ $source ] ) ) {
			return [ 'ok' => false, 'error' => 'source_unavailable', 'imported' => 0, 'skipped' => 0, 'items' => [] ];
		}

		$posts = get_posts( [
			'post_type'      => self::SOURCES[ $source ],
			'post_status'    => [ 'publish', 'draft' ],
			'posts_per_page' => max( 1, min( 200, $limit ) ),
			'orderby'        => 'ID',
			'order'          => 'ASC',
		] );

		$imported = 0;
		$skipped  = 0;
		$items    = [];

		foreach ( $posts as $post ) {
			if ( self::already_imported( $source, $post->ID ) ) {
				$skipped++;
				continue;
			}
			$mapped = 'presto' === $source ? self::from_presto( $post ) : self::from_fluentplayer( $post );
			if ( ! $mapped ) {
				$skipped++;
				continue;
			}

			$new_id = wp_insert_post( [
				'post_type'   => TRUEPLAYER_VIDEO_POST_TYPE,
				'post_status' => 'publish',
				'post_title'  => $mapped['title'] ?: sprintf( 'Imported #%d', $post->ID ),
			] );
			if ( is_wp_error( $new_id ) ) {
				$skipped++;
				continue;
			}

			Helper::update_json_meta( $new_id, '_trueplayer_config', $mapped['config'] );
			update_post_meta( $new_id, self::IMPORT_META, $source . ':' . $post->ID );
			if ( ! empty( $mapped['tags'] ) ) {
				wp_set_object_terms( $new_id, $mapped['tags'], PostType::VIDEO_TAXONOMY, false );
			}

			$imported++;
			$items[] = [ 'from' => $post->ID, 'to' => $new_id, 'title' => $mapped['title'], 'type' => $mapped['config']['source']['type'] ?? '' ];
		}

		return [ 'ok' => true, 'imported' => $imported, 'skipped' => $skipped, 'items' => $items ];
	}

	private static function already_imported( string $source, int $orig_id ): bool {
		global $wpdb;
		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key=%s AND meta_value=%s LIMIT 1",
				self::IMPORT_META,
				$source . ':' . $orig_id
			)
		);
	}

	/* ---------------- adapters ---------------- */

	/** Presto Player: source lives in a `presto-player/*` block in post_content. */
	private static function from_presto( $post ): ?array {
		$blocks = parse_blocks( (string) $post->post_content );
		$block  = self::find_presto_block( $blocks );
		if ( ! $block ) {
			return null;
		}
		$attrs = (array) ( $block['attrs'] ?? [] );
		$name  = $block['blockName'];
		$src   = (string) ( $attrs['src'] ?? '' );

		$map = [
			'presto-player/self-hosted' => 'self',
			'presto-player/youtube'     => 'youtube',
			'presto-player/vimeo'       => 'vimeo',
			'presto-player/audio'       => 'self',
			'presto-player/bunny'       => 'url',
		];
		$type = $map[ $name ] ?? 'url';

		$source = [ 'type' => $type, 'src' => $src ];
		if ( ! empty( $attrs['poster'] ) ) {
			$source['poster'] = (string) $attrs['poster'];
		}
		if ( 'presto-player/audio' === $name ) {
			$source['mediaType'] = 'audio';
		}

		return [ 'title' => $post->post_title, 'config' => [ 'source' => $source ], 'tags' => [] ];
	}

	private static function find_presto_block( array $blocks ): ?array {
		foreach ( $blocks as $block ) {
			if ( ! empty( $block['blockName'] ) && 0 === strpos( $block['blockName'], 'presto-player/' )
				&& ! empty( $block['attrs'] ) ) {
				return $block;
			}
			if ( ! empty( $block['innerBlocks'] ) ) {
				$found = self::find_presto_block( $block['innerBlocks'] );
				if ( $found ) {
					return $found;
				}
			}
		}
		return null;
	}

	/** FluentPlayer: source lives in the `settings` post meta array. */
	private static function from_fluentplayer( $post ): ?array {
		$settings = get_post_meta( $post->ID, 'settings', true );
		$settings = maybe_unserialize( $settings );
		if ( ! is_array( $settings ) ) {
			return null;
		}

		$provider = strtolower( (string) ( $settings['provider'] ?? $settings['source_type'] ?? 'self' ) );
		$src       = (string) ( $settings['src'] ?? $settings['source_url'] ?? $settings['media_url'] ?? $settings['url'] ?? '' );

		$map = [
			'html5'        => 'self',
			'self'         => 'self',
			'self-hosted'  => 'self',
			'youtube'      => 'youtube',
			'vimeo'        => 'vimeo',
			'audio'        => 'self',
			'bunny'        => 'bunny',
			'bunny_stream' => 'bunny',
			'mux'          => 'mux',
			'hls'          => 'hls',
			'external'     => 'url',
			'url'          => 'url',
		];
		$type = $map[ $provider ] ?? 'url';

		$source = [ 'type' => $type, 'src' => $src ];
		$poster = (string) ( $settings['poster'] ?? $settings['thumbnail'] ?? $settings['featured_image'] ?? '' );
		if ( $poster ) {
			$source['poster'] = $poster;
		}
		if ( 'audio' === $provider || ( $settings['media_type'] ?? '' ) === 'audio' ) {
			$source['mediaType'] = 'audio';
		}

		$tags = [];
		if ( ! empty( $settings['tags'] ) && is_array( $settings['tags'] ) ) {
			$tags = array_values( array_filter( array_map( 'strval', $settings['tags'] ) ) );
		}

		return [ 'title' => $post->post_title, 'config' => [ 'source' => $source ], 'tags' => $tags ];
	}
}
