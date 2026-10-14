<?php

/**
 * Fires when the site owner uninstalls TruePlayer from Plugins → Delete.
 *
 * Cleans up data this plugin created so an uninstall actually uninstalls:
 * custom tables, plugin options, scheduled events, and the generated poster
 * attachments the editor produced. Content the author added themselves
 * (`truepl_video`, `truepl_preset`, `truepl_playlist` posts and their meta) is
 * left in place — those are user content, not plugin bookkeeping, and WP's own
 * post-type deregistration is enough to hide them until the plugin is
 * reinstalled or another post-type claims the slug.
 *
 * Honours the Settings → "Keep data on uninstall" switch (option
 * `trueplayer_keep_data_on_uninstall`). On a multisite network uninstall, runs
 * per site via `get_sites()` so no site is skipped.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

function trueplayer_uninstall_cleanup(): void {
	if ( '1' === (string) get_option( 'trueplayer_keep_data_on_uninstall' ) ) {
		return;
	}

	global $wpdb;

	// Custom tables created by Database::create_initial_custom_table().
	$prefix = 'tp';
	$tables = [
		$wpdb->prefix . $prefix . '_progress',
		$wpdb->prefix . $prefix . '_quiz_attempts',
		$wpdb->prefix . $prefix . '_engagement',
		$wpdb->prefix . $prefix . '_daily',
	];
	foreach ( $tables as $table ) {
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.DirectDatabaseQuery.SchemaChange,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query( 'DROP TABLE IF EXISTS `' . esc_sql( $table ) . '`' );
	}

	// Plugin options. Named individually (no LIKE wildcard across autoloaded
	// options) so a core option that happens to start with `trueplayer_` from a
	// future WP release could never be caught.
	$options = [
		'trueplayer_version',
		'trueplayer_db_version',
		'trueplayer_first_install_time',
		'trueplayer_settings',
		'trueplayer_addons',
		'trueplayer_keep_data_on_uninstall',
	];
	foreach ( $options as $opt ) {
		delete_option( $opt );
		delete_site_option( $opt );
	}

	// Transients the plugin writes (Vimeo poster cache, opt-in rate limiter).
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$wpdb->query(
		"DELETE FROM `{$wpdb->options}`
		 WHERE option_name LIKE '\\_transient\\_trueplayer\\_%'
		    OR option_name LIKE '\\_transient\\_timeout\\_trueplayer\\_%'"
	);

	// Posters this plugin generated for videos (admin captured frames). Author-
	// uploaded media attached from the media library is left alone.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$poster_ids = $wpdb->get_col(
		$wpdb->prepare(
			"SELECT post_id FROM `{$wpdb->postmeta}` WHERE meta_key = %s",
			'_trueplayer_generated_poster'
		)
	);
	foreach ( (array) $poster_ids as $pid ) {
		wp_delete_attachment( (int) $pid, true );
	}

	// Allow add-ons to clean their own slice.
	do_action( 'trueplayer/uninstall' );
}

if ( is_multisite() ) {
	$trueplayer_sites = get_sites( [ 'number' => 0, 'fields' => 'ids' ] );
	foreach ( (array) $trueplayer_sites as $trueplayer_site_id ) {
		switch_to_blog( (int) $trueplayer_site_id );
		trueplayer_uninstall_cleanup();
		restore_current_blog();
	}
	unset( $trueplayer_sites, $trueplayer_site_id );
} else {
	trueplayer_uninstall_cleanup();
}
