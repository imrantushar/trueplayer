<?php

namespace TruePlayer\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use TruePlayer\Helper;

/**
 * Data-retention purge (compliance / privacy). When enabled in Settings →
 * Compliance & privacy, a daily cron deletes watch-progress + quiz-attempt
 * rows older than the configured age. Off by default; a very small floor
 * (7 days) guards against accidental wipe-everything values.
 */
class Retention {

	const HOOK = 'trueplayer/retention/purge';
	const MIN_DAYS = 7;

	public static function init(): void {
		add_action( self::HOOK, [ __CLASS__, 'purge' ] );
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::HOOK );
		}
	}

	public static function purge(): void {
		$c = Helper::get_settings_section( 'compliance' );
		if ( empty( $c['retentionEnabled'] ) ) {
			return;
		}
		$days = isset( $c['retentionDays'] ) ? (int) $c['retentionDays'] : 0;
		if ( $days < self::MIN_DAYS ) {
			return; // treat too-small / unset values as "off" rather than nuke everything.
		}

		global $wpdb;
		$cutoff   = gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS );
		$progress = $wpdb->prefix . TRUEPLAYER_DB_PREFIX . '_progress';
		$attempts = $wpdb->prefix . TRUEPLAYER_DB_PREFIX . '_quiz_attempts';

		// Progress: age by last activity (fall back to updated_at).
		// Table names are our own `$wpdb->prefix . TRUEPLAYER_DB_PREFIX`-derived constants.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$progress} WHERE COALESCE(last_seen, updated_at) < %s", $cutoff ) );
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$attempts} WHERE created_at < %s", $cutoff ) );
		// phpcs:enable

		do_action( 'trueplayer/retention/purged', $days, $cutoff );
	}

	/** Clear the schedule on deactivation. */
	public static function unschedule(): void {
		$ts = wp_next_scheduled( self::HOOK );
		if ( $ts ) {
			wp_unschedule_event( $ts, self::HOOK );
		}
	}
}
