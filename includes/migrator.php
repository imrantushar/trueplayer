<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One-time data repairs that have to run on an existing install, not just a
 * fresh activation (Installer only fires on activate).
 *
 * Each step records its own option so it runs once and can be reasoned about
 * in isolation; the option is the record, not a global schema number, so
 * adding a step never re-runs the earlier ones.
 */
class Migrator {

	/**
	 * What the old Questions & gating tab hardcoded and wrote into every video
	 * it touched. Only a gating block matching this *exactly* is treated as
	 * "the editor stamped it", never as an author's choice.
	 */
	/**
	 * Addon slug for interactive content. A literal on purpose: this migration
	 * must run whether or not that addon's code is present.
	 */
	const INTERACTIVE_ADDON = 'interactive';

	const STAMPED_GATING = [
		'completionThreshold' => 90,
		'antiSkip'            => true,
		'maxAttempts'         => 3,
		'requireLoginForGate' => false,
	];

	public static function init(): void {
		add_action( 'admin_init', [ __CLASS__, 'run' ] );
	}

	public static function run(): void {
		self::unstamp_inherited_gating();
		self::adopt_existing_interactive_content();
	}

	/**
	 * Keep interactive content working on sites that already use it.
	 *
	 * The H5P engine became an opt-in addon that defaults to off, so a site
	 * upgrading into that change would otherwise have its existing quizzes stop
	 * rendering and disappear from the library. If the engine has been used
	 * here, the addon was effectively already on — record that, once.
	 */
	private static function adopt_existing_interactive_content(): void {
		$done = 'trueplayer_migrated_interactive_addon';
		if ( get_option( $done ) ) {
			return;
		}
		update_option( $done, Helper::now_iso(), false );

		if ( Helper::get_addon_active_status( self::INTERACTIVE_ADDON ) ) {
			return;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'tp_h5p_contents';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name built above; schema introspection.
		$exists = (bool) $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		if ( ! $exists ) {
			return;
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name built above.
		$rows = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );
		if ( $rows < 1 ) {
			return;
		}

		$saved = (array) json_decode( (string) get_option( TRUEPLAYER_ADDONS_SETTINGS, '{}' ), true );
		$saved[ self::INTERACTIVE_ADDON ] = true;
		update_option( TRUEPLAYER_ADDONS_SETTINGS, wp_json_encode( $saved ) );
		$GLOBALS['trueplayer_addons'] = (object) $saved;
	}

	/**
	 * Let videos inherit the site-wide enforcement policy again.
	 *
	 * The gating tab used to seed hardcoded defaults and save the whole object,
	 * so opening it once wrote `requireLoginForGate: false` (and friends) into
	 * the video — which then permanently shadowed Settings → Enforcement, with
	 * nothing in the UI to say so. The tab now persists only real overrides
	 * (GatingTab), but videos saved before that still carry the stamp.
	 *
	 * Conservative on purpose: a video is only unstamped when all four policy
	 * keys match the old defaults exactly. Change any one of them and the
	 * author clearly chose these values, so the whole block is left alone.
	 */
	private static function unstamp_inherited_gating(): void {
		$done = 'trueplayer_migrated_gating_inherit';
		if ( get_option( $done ) ) {
			return;
		}
		update_option( $done, Helper::now_iso(), false );

		$ids = get_posts( [
			'post_type'      => TRUEPLAYER_VIDEO_POST_TYPE,
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'meta_key'       => '_trueplayer_config', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
		] );

		foreach ( $ids as $id ) {
			$raw    = get_post_meta( $id, '_trueplayer_config', true );
			$config = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : null;
			if ( ! is_array( $config ) || ! is_array( $config['gating'] ?? null ) ) {
				continue;
			}

			$gating = $config['gating'];
			foreach ( self::STAMPED_GATING as $key => $stamped ) {
				if ( ! array_key_exists( $key, $gating ) || $gating[ $key ] !== $stamped ) {
					continue 2; // An author-chosen value — leave this video untouched.
				}
			}

			foreach ( array_keys( self::STAMPED_GATING ) as $key ) {
				unset( $gating[ $key ] );
			}
			$config['gating'] = $gating;
			update_post_meta( $id, '_trueplayer_config', wp_json_encode( $config ) );
		}
	}
}
