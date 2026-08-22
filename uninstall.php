<?php
/**
 * Removes everything TruePlayer created — but only when the site owner asked
 * for it (Settings → General → "When you delete TruePlayer").
 *
 * Deleting a plugin is not the same as wanting your content gone: the default
 * is to leave the data in place so a reinstall picks up where it left off.
 * Nothing here runs on deactivation, only on delete.
 *
 * Pro keeps its own data; this file is the free plugin's own footprint.
 *
 * @package TruePlayer
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Plugin constants aren't defined during uninstall — the plugin file is never
// loaded — so every name this file touches is spelled out.
const TRUEPLAYER_UNINSTALL_SETTINGS = 'trueplayer_settings';
const TRUEPLAYER_UNINSTALL_STORAGE  = 'trueplayer-h5p';

/** Post types whose entries are TruePlayer's own content. */
function trueplayer_uninstall_post_types(): array {
	return [ 'tp_video', 'tp_playlist', 'tp_preset' ];
}

/** Tables this plugin creates, without the site prefix. */
function trueplayer_uninstall_tables(): array {
	return [
		'tp_daily',
		'tp_engagement',
		'tp_progress',
		'tp_quiz_attempts',
		'tp_webhook_log',
		// H5P engine.
		'tp_h5p_contents',
		'tp_h5p_contents_libraries',
		'tp_h5p_contents_user_data',
		'tp_h5p_counters',
		'tp_h5p_events',
		'tp_h5p_libraries',
		'tp_h5p_libraries_cachedassets',
		'tp_h5p_libraries_languages',
		'tp_h5p_libraries_libraries',
		'tp_h5p_results',
		'tp_h5p_tmpfiles',
	];
}

/** Options this plugin writes. */
function trueplayer_uninstall_options(): array {
	return [
		TRUEPLAYER_UNINSTALL_SETTINGS,
		'trueplayer_addons',
		'trueplayer_db_version',
		'trueplayer_first_install_time',
		'trueplayer_flush_rewrite',
		'trueplayer_version',
		'trueplayer_webhook_log_db',
	];
}

/**
 * Did the site owner opt in? Read straight from the option — the settings
 * class isn't available here.
 */
function trueplayer_uninstall_requested(): bool {
	$raw      = get_option( TRUEPLAYER_UNINSTALL_SETTINGS, '' );
	$settings = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : $raw;
	return is_array( $settings ) && ! empty( $settings['deleteDataOnUninstall'] );
}

/**
 * Delete a directory and its contents, refusing to step outside the uploads
 * tree it's supposed to live in.
 */
function trueplayer_uninstall_rmdir( string $dir, string $root ): void {
	$dir  = (string) realpath( $dir );
	$root = (string) realpath( $root );
	if ( '' === $dir || '' === $root || 0 !== strpos( $dir, $root ) || ! is_dir( $dir ) ) {
		return;
	}

	$items = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ),
		RecursiveIteratorIterator::CHILD_FIRST
	);
	foreach ( $items as $item ) {
		if ( $item->isDir() ) {
			@rmdir( $item->getPathname() ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		} else {
			@unlink( $item->getPathname() ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		}
	}
	@rmdir( $dir ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
}

/** Wipe one site's TruePlayer footprint. */
function trueplayer_uninstall_site(): void {
	global $wpdb;

	// Content first, so post meta and term relationships go with it.
	foreach ( trueplayer_uninstall_post_types() as $post_type ) {
		$ids = get_posts(
			[
				'post_type'      => $post_type,
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'no_found_rows'  => true,
			]
		);
		foreach ( $ids as $id ) {
			wp_delete_post( (int) $id, true );
		}
	}

	// Tags only this plugin's videos used.
	$terms = get_terms(
		[
			'taxonomy'   => 'tp_video_tag',
			'hide_empty' => false,
			'fields'     => 'ids',
		]
	);
	if ( ! is_wp_error( $terms ) ) {
		foreach ( $terms as $term_id ) {
			wp_delete_term( (int) $term_id, 'tp_video_tag' );
		}
	}

	foreach ( trueplayer_uninstall_tables() as $table ) {
		// Table names can't be parameterised; they're this file's own literals.
		$wpdb->query( "DROP TABLE IF EXISTS `{$wpdb->prefix}{$table}`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.SchemaChange
	}

	foreach ( trueplayer_uninstall_options() as $option ) {
		delete_option( $option );
	}

	// Scheduled maintenance (the retention purge).
	wp_clear_scheduled_hook( 'trueplayer/retention/purge' );

	// The H5P library + content tree lives under uploads.
	$uploads = wp_upload_dir();
	if ( empty( $uploads['error'] ) && ! empty( $uploads['basedir'] ) ) {
		trueplayer_uninstall_rmdir(
			trailingslashit( $uploads['basedir'] ) . TRUEPLAYER_UNINSTALL_STORAGE,
			$uploads['basedir']
		);
	}
}

if ( is_multisite() ) {
	// Each site carries its own tables, uploads and opt-in choice — the main
	// site's answer must not decide for the rest of the network.
	foreach ( get_sites( [ 'fields' => 'ids', 'number' => 0 ] ) as $site_id ) {
		switch_to_blog( (int) $site_id );
		if ( trueplayer_uninstall_requested() ) {
			trueplayer_uninstall_site();
		}
		restore_current_blog();
	}
} elseif ( trueplayer_uninstall_requested() ) {
	trueplayer_uninstall_site();
}
