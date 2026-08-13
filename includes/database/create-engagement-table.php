<?php

namespace TruePlayer\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Per-video engagement aggregate — one row per (video, bucket). The video
 * timeline is split into a fixed 100 buckets (percent of duration) so graphs
 * are duration-independent and storage is bounded.
 *
 *   - plays:   total play hits for this bucket across all viewers, INCLUDING
 *              repeats → drives the replay heatmap (hot spots = re-watched).
 *   - reached: distinct viewers who first covered this bucket → drives the
 *              retention curve (drop-off).
 *
 * NOTE: no SQL `--` comments inside the CREATE TABLE (dbDelta parser).
 */
class CreateEngagementTable {
	public static function up( $prefix, $charset_collate ) {

		$table = $prefix . TRUEPLAYER_DB_PREFIX . '_engagement';

		$sql = "CREATE TABLE {$table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			video_id BIGINT UNSIGNED NOT NULL,
			bucket SMALLINT UNSIGNED NOT NULL,
			plays INT UNSIGNED NOT NULL DEFAULT 0,
			reached INT UNSIGNED NOT NULL DEFAULT 0,
			PRIMARY KEY  (id),
			UNIQUE KEY uq_video_bucket (video_id, bucket),
			INDEX idx_video (video_id)
		) {$charset_collate};";

		dbDelta( $sql );
	}
}
