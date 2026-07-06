<?php

namespace TruePlayer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Internal event bus — the single seam every server-side milestone flows
 * through. Watch-verification and quiz-grading call Events::emit(); the
 * webhook dispatcher, pro analytics, and Gem bridges subscribe via the
 * `trueplayer/event/{name}` action.
 *
 * Known events: view.started, progress.milestone, view.completed,
 * checkpoint.passed, checkpoint.failed, quiz.passed, quiz.failed,
 * video.locked, video.unlocked.
 */
class Events {

	const KNOWN = [
		'view.started',
		'progress.milestone',
		'view.completed',
		'checkpoint.passed',
		'checkpoint.failed',
		'quiz.passed',
		'quiz.failed',
		'video.locked',
		'video.unlocked',
		'subscriber.added',
	];

	public static function init() {
		// Nothing to hook at boot — this is a passive dispatcher. Kept as an
		// init target so the bootstrap wiring stays uniform with other modules.
	}

	/**
	 * Fire an event. $payload is the normalized data structure documented in
	 * the webhook payload spec (event, video_id, subject, etc.).
	 *
	 * @param string $name    One of self::KNOWN.
	 * @param array  $payload Event payload.
	 */
	public static function emit( $name, array $payload = [] ) {
		$payload = array_merge(
			[
				'event'     => $name,
				'timestamp' => Helper::now_iso(),
				'site'      => wp_parse_url( home_url(), PHP_URL_HOST ),
			],
			$payload
		);

		/**
		 * Generic hook (all events) + specific hook (per event name).
		 */
		do_action( 'trueplayer/event', $name, $payload );
		do_action( "trueplayer/event/{$name}", $payload );
	}
}
