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
		self::create_initial_custom_table();
		update_option( 'trueplayer_db_version', TRUEPLAYER_DB_VERSION );
	}
}
