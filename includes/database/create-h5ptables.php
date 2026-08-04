<?php

namespace TruePlayer\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * H5P engine schema — the tables H5PCore drives through our Framework glue.
 *
 * These are the standard H5P tables (ported faithfully from the official H5P
 * WordPress plugin, GPL-3.0) but namespaced with our own `tp_h5p_` prefix so
 * they never collide with a separately-installed H5P plugin. H5PCore never
 * touches them directly — all SQL lives in TruePlayer\H5P\Framework — so the
 * prefix is purely ours to choose.
 *
 * Content rows live here (keyed by H5P content id); each `tp_video` item on the
 * H5P engine stores its content id in `_trueplayer_h5p_content_id` post meta.
 *
 * NOTE: no SQL `--` comments inside CREATE TABLE (dbDelta parser); keep the two
 * spaces after `PRIMARY KEY` that dbDelta expects.
 */
class CreateH5PTables {

	public static function up( $prefix, $charset_collate ) {
		$p = $prefix . 'tp_h5p_';

		dbDelta( "CREATE TABLE {$p}contents (
			id INT UNSIGNED NOT NULL AUTO_INCREMENT,
			created_at TIMESTAMP NOT NULL DEFAULT 0,
			updated_at TIMESTAMP NOT NULL DEFAULT 0,
			user_id INT UNSIGNED NOT NULL,
			title VARCHAR(255) NOT NULL,
			library_id INT UNSIGNED NOT NULL,
			parameters LONGTEXT NOT NULL,
			filtered LONGTEXT NOT NULL,
			slug VARCHAR(127) NOT NULL,
			embed_type VARCHAR(127) NOT NULL,
			disable INT UNSIGNED NOT NULL DEFAULT 0,
			content_type VARCHAR(127) NULL,
			authors LONGTEXT NULL,
			source VARCHAR(2083) NULL,
			year_from INT UNSIGNED NULL,
			year_to INT UNSIGNED NULL,
			license VARCHAR(32) NULL,
			license_version VARCHAR(10) NULL,
			license_extras LONGTEXT NULL,
			author_comments LONGTEXT NULL,
			changes LONGTEXT NULL,
			default_language VARCHAR(32) NULL,
			a11y_title VARCHAR(255) NULL,
			PRIMARY KEY  (id)
		) {$charset_collate};" );

		dbDelta( "CREATE TABLE {$p}contents_libraries (
			content_id INT UNSIGNED NOT NULL,
			library_id INT UNSIGNED NOT NULL,
			dependency_type VARCHAR(31) NOT NULL,
			weight SMALLINT UNSIGNED NOT NULL DEFAULT 0,
			drop_css TINYINT UNSIGNED NOT NULL,
			PRIMARY KEY  (content_id,library_id,dependency_type)
		) {$charset_collate};" );

		dbDelta( "CREATE TABLE {$p}contents_user_data (
			content_id INT UNSIGNED NOT NULL,
			user_id INT UNSIGNED NOT NULL,
			sub_content_id INT UNSIGNED NOT NULL,
			data_id VARCHAR(127) NOT NULL,
			data LONGTEXT NOT NULL,
			preload TINYINT UNSIGNED NOT NULL DEFAULT 0,
			invalidate TINYINT UNSIGNED NOT NULL DEFAULT 0,
			updated_at TIMESTAMP NOT NULL DEFAULT 0,
			PRIMARY KEY  (content_id,user_id,sub_content_id,data_id)
		) {$charset_collate};" );

		dbDelta( "CREATE TABLE {$p}results (
			id INT UNSIGNED NOT NULL AUTO_INCREMENT,
			content_id INT UNSIGNED NOT NULL,
			user_id INT UNSIGNED NOT NULL,
			score INT UNSIGNED NOT NULL,
			max_score INT UNSIGNED NOT NULL,
			opened INT UNSIGNED NOT NULL,
			finished INT UNSIGNED NOT NULL,
			time INT UNSIGNED NOT NULL,
			PRIMARY KEY  (id),
			KEY content_user (content_id,user_id)
		) {$charset_collate};" );

		dbDelta( "CREATE TABLE {$p}libraries (
			id INT UNSIGNED NOT NULL AUTO_INCREMENT,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL,
			name VARCHAR(127) NOT NULL,
			title VARCHAR(255) NOT NULL,
			major_version INT UNSIGNED NOT NULL,
			minor_version INT UNSIGNED NOT NULL,
			patch_version INT UNSIGNED NOT NULL,
			runnable INT UNSIGNED NOT NULL,
			restricted INT UNSIGNED NOT NULL DEFAULT 0,
			fullscreen INT UNSIGNED NOT NULL,
			embed_types VARCHAR(255) NOT NULL,
			preloaded_js TEXT NULL,
			preloaded_css TEXT NULL,
			drop_library_css TEXT NULL,
			semantics TEXT NOT NULL,
			tutorial_url VARCHAR(1023) NOT NULL,
			has_icon INT UNSIGNED NOT NULL DEFAULT 0,
			metadata_settings TEXT NULL,
			add_to TEXT DEFAULT NULL,
			PRIMARY KEY  (id),
			KEY name_version (name,major_version,minor_version,patch_version),
			KEY runnable (runnable)
		) {$charset_collate};" );

		dbDelta( "CREATE TABLE {$p}libraries_libraries (
			library_id INT UNSIGNED NOT NULL,
			required_library_id INT UNSIGNED NOT NULL,
			dependency_type VARCHAR(31) NOT NULL,
			PRIMARY KEY  (library_id,required_library_id)
		) {$charset_collate};" );

		dbDelta( "CREATE TABLE {$p}libraries_languages (
			library_id INT UNSIGNED NOT NULL,
			language_code VARCHAR(31) NOT NULL,
			translation TEXT NOT NULL,
			PRIMARY KEY  (library_id,language_code)
		) {$charset_collate};" );

		dbDelta( "CREATE TABLE {$p}libraries_cachedassets (
			library_id INT UNSIGNED NOT NULL,
			hash VARCHAR(64) NOT NULL,
			PRIMARY KEY  (library_id,hash)
		) {$charset_collate};" );

		dbDelta( "CREATE TABLE {$p}events (
			id INT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id INT UNSIGNED NOT NULL,
			created_at INT UNSIGNED NOT NULL,
			type VARCHAR(63) NOT NULL,
			sub_type VARCHAR(63) NOT NULL,
			content_id INT UNSIGNED NOT NULL,
			content_title VARCHAR(255) NOT NULL,
			library_name VARCHAR(127) NOT NULL,
			library_version VARCHAR(31) NOT NULL,
			PRIMARY KEY  (id)
		) {$charset_collate};" );

		dbDelta( "CREATE TABLE {$p}counters (
			type VARCHAR(63) NOT NULL,
			library_name VARCHAR(127) NOT NULL,
			library_version VARCHAR(31) NOT NULL,
			num INT UNSIGNED NOT NULL,
			PRIMARY KEY  (type,library_name,library_version)
		) {$charset_collate};" );

		dbDelta( "CREATE TABLE {$p}tmpfiles (
			id INT UNSIGNED NOT NULL AUTO_INCREMENT,
			path VARCHAR(255) NOT NULL,
			created_at INT UNSIGNED NOT NULL,
			PRIMARY KEY  (id),
			KEY created_at (created_at)
		) {$charset_collate};" );
	}
}
