<?php

namespace TruePlayer\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Per-video daily rollup — one row per (video, day) for the views-over-time
 * trend and cumulative watch-time.
 *
 * NOTE: no SQL `--` comments inside the CREATE TABLE (dbDelta parser).
 */
class CreateDailyTable {
	public static function up( $prefix, $charset_collate ) {

		$table = $prefix . TRUEPLAYER_DB_PREFIX . '_daily';

		$sql = "CREATE TABLE {$table} (
			id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
			video_id BIGINT UNSIGNED NOT NULL,
			day DATE NOT NULL,
			views INT UNSIGNED NOT NULL DEFAULT 0,
			completions INT UNSIGNED NOT NULL DEFAULT 0,
			watch_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
			UNIQUE KEY uq_video_day (video_id, day),
			INDEX idx_video (video_id)
		) {$charset_collate};";

		dbDelta( $sql );
	}
}
