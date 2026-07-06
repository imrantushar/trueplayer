<?php

namespace TruePlayer\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Watch-progress table — one row per (video, subject). The server-side source
 * of truth for "did this viewer actually watch it".
 *
 * Columns:
 *   - subject_type: 'user' | 'guest'
 *   - subject_id:   WP user id (as string) or the signed guest `tp_uid` token
 *   - watched_ranges: JSON merged [start,end] second-ranges (coverage)
 *   - watched_seconds / percent: derived server-side from watched_ranges
 *   - status: in_progress | completed | locked
 *   - attempts: quiz attempts consumed since the last unlock
 *
 * NOTE: no SQL `--` comments inside the CREATE TABLE — dbDelta's parser
 * silently fails on them.
 */
class CreateProgressTable {
	public static function up( $prefix, $charset_collate ) {

		$table = $prefix . TRUEPLAYER_DB_PREFIX . '_progress';

		$sql = "CREATE TABLE {$table} (
			id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
			video_id BIGINT UNSIGNED NOT NULL,
			subject_type VARCHAR(16) NOT NULL DEFAULT 'guest',
			subject_id VARCHAR(64) NOT NULL,
			watched_ranges JSON NULL,
			watched_seconds INT UNSIGNED NOT NULL DEFAULT 0,
			duration INT UNSIGNED NOT NULL DEFAULT 0,
			percent DECIMAL(5,2) NOT NULL DEFAULT 0,
			completed TINYINT(1) NOT NULL DEFAULT 0,
			last_position INT UNSIGNED NOT NULL DEFAULT 0,
			status VARCHAR(16) NOT NULL DEFAULT 'in_progress',
			attempts INT UNSIGNED NOT NULL DEFAULT 0,
			sessions INT UNSIGNED NOT NULL DEFAULT 0,
			completions INT UNSIGNED NOT NULL DEFAULT 0,
			heat JSON NULL,
			device VARCHAR(16) NULL,
			first_seen DATETIME NULL,
			last_seen DATETIME NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE KEY uq_subject_video (video_id, subject_type, subject_id),
			INDEX idx_video_status (video_id, status),
			INDEX idx_subject (subject_type, subject_id)
		) {$charset_collate};";

		dbDelta( $sql );
	}
}
