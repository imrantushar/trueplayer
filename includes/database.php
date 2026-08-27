<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Database {

	public static function init() {
		$self = new self();
		self::maybe_upgrade();
		$self->dispatch_hook();
	}

	public function dispatch_hook() {
		Database\PostType::init();
		Database\MetaManager::init();
	}

	public static function create_initial_custom_table() {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$prefix          = $wpdb->prefix;
		$charset_collate = $wpdb->get_charset_collate();
		Database\CreateProgressTable::up( $prefix, $charset_collate );
		Database\CreateQuizAttemptsTable::up( $prefix, $charset_collate );
		Database\CreateEngagementTable::up( $prefix, $charset_collate );
		Database\CreateDailyTable::up( $prefix, $charset_collate );

		/**
		 * Addons own their own tables and sync them here, so core carries no
		 * knowledge of schema it doesn't use. An addon that is switched off
		 * simply doesn't respond, which is what keeps its tables off installs
		 * that never wanted the feature.
		 *
		 * @param string $prefix          Table prefix.
		 * @param string $charset_collate Charset/collation clause.
		 */
		do_action( 'trueplayer/database/sync_schema', $prefix, $charset_collate );
	}

	/**
	 * Idempotent schema sync. Runs on boot when the stored schema version is
	 * behind TRUEPLAYER_DB_VERSION, so column/table additions land on existing
	 * installs without needing a re-activation. dbDelta only applies diffs.
	 */
	public static function maybe_upgrade() {
		if ( get_option( 'trueplayer_db_version' ) === TRUEPLAYER_DB_VERSION ) {
			return;
		}
		// Runs on every request until it succeeds, so it must fail soft: a missing
		// schema class (e.g. a half-shipped feature mid-update) must never fatal
		// `plugins_loaded` and white-screen the whole site. Log and retry on a
		// later load once the code is complete; the version is only bumped on a
		// clean run, and dbDelta makes every table create idempotent.
		try {
			self::create_initial_custom_table();
		} catch ( \Throwable $e ) {
			error_log( 'TruePlayer: schema upgrade deferred — ' . $e->getMessage() );
			return;
		}
		// New rewrite rules (instant video pages) need a one-time flush.
		Helper::request_rewrite_flush();
		update_option( 'trueplayer_db_version', TRUEPLAYER_DB_VERSION );
	}
}
