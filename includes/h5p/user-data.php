<?php

namespace TruePlayer\H5P;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Save & resume for interactive content.
 *
 * H5P content types that implement `getCurrentState()` autosave their state
 * through `H5PIntegration.ajax.contentUserData`, and report a finished attempt
 * through `ajax.setFinished`. Both URLs were advertised to the runtime but had
 * no handler behind them, and `saveFreq`/`postUserStatistics` were off — so a
 * learner who left half way through a quiz always came back to a blank one.
 *
 * State is per user: H5P refuses to save at all unless `H5PIntegration.user`
 * is set, which is the behaviour we want — there's no reliable identity to
 * resume against for a logged-out visitor.
 */
class UserData {

	const NONCE = 'trueplayer_h5p_user_data';

	/** Default autosave interval, in seconds. */
	const SAVE_FREQ = 30;

	public static function init(): void {
		add_action( 'wp_ajax_trueplayer_h5p_content_user_data', [ __CLASS__, 'content_user_data' ] );
		add_action( 'wp_ajax_trueplayer_h5p_set_finished', [ __CLASS__, 'set_finished' ] );
	}

	/** Fully-qualified user-data table. */
	private static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'tp_h5p_contents_user_data';
	}

	/**
	 * How often content types should autosave, in seconds. `false` disables
	 * saving entirely (which is what H5P expects for "off").
	 *
	 * @return int|false
	 */
	public static function save_freq() {
		$freq = apply_filters( 'trueplayer/h5p/save_freq', self::SAVE_FREQ );
		if ( false === $freq ) {
			return false;
		}
		$freq = (int) $freq;
		return $freq > 0 ? $freq : false;
	}

	/**
	 * The `user` object H5PIntegration needs before it will save anything.
	 *
	 * @return array|null
	 */
	public static function current_user(): ?array {
		$user = wp_get_current_user();
		if ( ! $user || ! $user->exists() ) {
			return null;
		}
		return [
			'name' => $user->display_name,
			'mail' => $user->user_email,
			'id'   => (int) $user->ID,
		];
	}

	/**
	 * Saved state for a piece of content, shaped the way H5P.getUserData reads
	 * it: [ subContentId => [ dataId => json string ] ]. Only rows flagged
	 * `preload` are inlined; the rest are fetched on demand.
	 */
	public static function preloaded( int $content_id, int $user_id ): array {
		if ( ! $user_id ) {
			return [ 0 => [] ];
		}

		global $wpdb;
		$table = self::table();
		$rows  = $wpdb->get_results( $wpdb->prepare(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is a literal built above.
			"SELECT sub_content_id, data_id, data FROM {$table} WHERE content_id = %d AND user_id = %d AND preload = 1",
			$content_id,
			$user_id
		) );

		$out = [ 0 => [] ];
		foreach ( (array) $rows as $row ) {
			$out[ (int) $row->sub_content_id ][ $row->data_id ] = $row->data;
		}
		return $out;
	}

	/**
	 * GET returns a stored value, POST writes or clears one.
	 *
	 * H5P sends the identifiers on the query string (the URL template it was
	 * handed) and the payload as form fields.
	 */
	public static function content_user_data(): void {
		if ( ! self::verify() ) {
			wp_send_json( [ 'success' => false, 'message' => __( 'Invalid request.', 'trueplayer' ) ] );
		}

		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- verified in self::verify().
		$content_id = isset( $_GET['content_id'] ) ? absint( $_GET['content_id'] ) : 0;
		$data_id    = isset( $_GET['data_type'] ) ? sanitize_text_field( wp_unslash( $_GET['data_type'] ) ) : '';
		$sub_id     = isset( $_GET['sub_content_id'] ) ? absint( $_GET['sub_content_id'] ) : 0;
		// phpcs:enable WordPress.Security.NonceVerification.Recommended

		$user_id = get_current_user_id();
		if ( ! $content_id || '' === $data_id || ! $user_id ) {
			wp_send_json( [ 'success' => false, 'message' => __( 'Nothing to store.', 'trueplayer' ) ] );
		}

		global $wpdb;
		$table = self::table();

		if ( 'POST' !== strtoupper( (string) ( $_SERVER['REQUEST_METHOD'] ?? 'GET' ) ) ) {
			$data = $wpdb->get_var( $wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is a literal built above.
				"SELECT data FROM {$table} WHERE content_id = %d AND user_id = %d AND sub_content_id = %d AND data_id = %s",
				$content_id,
				$user_id,
				$sub_id,
				$data_id
			) );
			wp_send_json( [ 'success' => true, 'data' => null === $data ? false : $data ] );
		}

		// phpcs:disable WordPress.Security.NonceVerification.Missing -- verified in self::verify().
		// H5P sends the literal 0 to mean "drop this". Anything else is opaque
		// JSON produced by the content type, so it's stored as-is rather than
		// sanitised into something the runtime can no longer parse.
		$raw = isset( $_POST['data'] ) ? wp_unslash( $_POST['data'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$preload    = ! empty( $_POST['preload'] ) ? 1 : 0;
		$invalidate = ! empty( $_POST['invalidate'] ) ? 1 : 0;
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		$where = [
			'content_id'     => $content_id,
			'user_id'        => $user_id,
			'sub_content_id' => $sub_id,
			'data_id'        => $data_id,
		];

		if ( '0' === (string) $raw ) {
			$wpdb->delete( $table, $where, [ '%d', '%d', '%d', '%s' ] ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			wp_send_json( [ 'success' => true ] );
		}

		if ( ! is_string( $raw ) ) {
			wp_send_json( [ 'success' => false, 'message' => __( 'Unexpected payload.', 'trueplayer' ) ] );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->replace(
			$table,
			$where + [
				'data'       => $raw,
				'preload'    => $preload,
				'invalidate' => $invalidate,
				'updated_at' => current_time( 'mysql', true ),
			],
			[ '%d', '%d', '%d', '%s', '%s', '%d', '%d', '%s' ]
		);

		wp_send_json( [ 'success' => true ] );
	}

	/**
	 * A finished attempt, reported by content types that fire `finish`.
	 *
	 * The xAPI bridge already records scored results; this covers the older
	 * `finish` event and keeps `opened`/`finished` timings, so it upserts on the
	 * same row rather than stacking a duplicate.
	 */
	public static function set_finished(): void {
		if ( ! self::verify() ) {
			wp_send_json( [ 'success' => false, 'message' => __( 'Invalid request.', 'trueplayer' ) ] );
		}

		// phpcs:disable WordPress.Security.NonceVerification.Missing -- verified in self::verify().
		$content_id = isset( $_POST['contentId'] ) ? absint( $_POST['contentId'] ) : 0;
		$score      = isset( $_POST['score'] ) ? (int) $_POST['score'] : null;
		$max        = isset( $_POST['maxScore'] ) ? (int) $_POST['maxScore'] : null;
		$opened     = isset( $_POST['opened'] ) ? absint( $_POST['opened'] ) : 0;
		$finished   = isset( $_POST['finished'] ) ? absint( $_POST['finished'] ) : 0;
		$time       = isset( $_POST['time'] ) ? absint( $_POST['time'] ) : 0;
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		$user_id = get_current_user_id();
		if ( ! $content_id || ! $user_id || null === $score || null === $max ) {
			wp_send_json( [ 'success' => false, 'message' => __( 'Nothing to record.', 'trueplayer' ) ] );
		}

		global $wpdb;
		$table = $wpdb->prefix . 'tp_h5p_results';

		$existing = $wpdb->get_var( $wpdb->prepare(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is a literal built above.
			"SELECT id FROM {$table} WHERE content_id = %d AND user_id = %d",
			$content_id,
			$user_id
		) );

		$row = [
			'content_id' => $content_id,
			'user_id'    => $user_id,
			'score'      => max( 0, $score ),
			'max_score'  => max( 0, $max ),
			'opened'     => $opened,
			'finished'   => $finished ?: time(),
			'time'       => $time,
		];

		if ( $existing ) {
			$wpdb->update( $table, $row, [ 'id' => (int) $existing ] ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		} else {
			$wpdb->insert( $table, $row ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		}

		wp_send_json( [ 'success' => true ] );
	}

	/** Signed-in user with a valid nonce. */
	private static function verify(): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}
		$nonce = isset( $_REQUEST['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['_wpnonce'] ) ) : '';
		return (bool) wp_verify_nonce( $nonce, self::NONCE );
	}
}
