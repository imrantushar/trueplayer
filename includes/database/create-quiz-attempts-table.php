<?php

namespace TruePlayer\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Quiz-attempt log — one row per graded submission (checkpoint or final).
 *
 *   - gate_id: 'checkpoint:<id>' | 'final'
 *   - answers: JSON of the submitted answers (server keeps them for audit;
 *     correct answers are never sent to the client)
 *   - score:   percent 0–100
 *   - passed:  server verdict
 *
 * NOTE: no SQL `--` comments inside the CREATE TABLE (dbDelta parser).
 */
class CreateQuizAttemptsTable {
	public static function up( $prefix, $charset_collate ) {

		$table = $prefix . TRUEPLAYER_DB_PREFIX . '_quiz_attempts';

		$sql = "CREATE TABLE {$table} (
			id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
			video_id BIGINT UNSIGNED NOT NULL,
			gate_id VARCHAR(64) NOT NULL DEFAULT 'final',
			subject_type VARCHAR(16) NOT NULL DEFAULT 'guest',
			subject_id VARCHAR(64) NOT NULL,
			answers JSON NULL,
			score DECIMAL(5,2) NOT NULL DEFAULT 0,
			passed TINYINT(1) NOT NULL DEFAULT 0,
			attempt_no INT UNSIGNED NOT NULL DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_subject_video (video_id, subject_type, subject_id),
			INDEX idx_video_gate (video_id, gate_id)
		) {$charset_collate};";

		dbDelta( $sql );
	}
}
