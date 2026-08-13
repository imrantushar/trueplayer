/**
 * TruePlayer ↔ H5P xAPI bridge (plain JS, no build step).
 *
 * Listens to the H5P content's xAPI statements and forwards the root-level
 * completion/answer to TruePlayer's REST endpoint, which normalises it into the
 * same event bus the native player feeds (analytics, webhooks, CRM, LMS). Only
 * the top-level statement (no parent context) is reported, so sub-question
 * chatter is ignored.
 */
( function () {
	var cfg = window.TruePlayerH5PxAPI || {};
	if ( ! window.H5P || ! window.H5P.externalDispatcher || ! cfg.endpoint ) {
		return;
	}

	var sent = {};

	function post( payload ) {
		try {
			var body = JSON.stringify( payload );
			if ( navigator.sendBeacon ) {
				navigator.sendBeacon( cfg.endpoint, new Blob( [ body ], { type: 'application/json' } ) );
			} else {
				fetch( cfg.endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce || '' },
					credentials: 'same-origin',
					keepalive: true,
					body: body,
				} );
			}
		} catch ( e ) {}
	}

	H5P.externalDispatcher.on( 'xAPI', function ( event ) {
		var s = event && event.data && event.data.statement;
		if ( ! s || ! s.verb ) {
			return;
		}

		// Root statement only — sub-content carries a parent context.
		var parent =
			s.context &&
			s.context.contextActivities &&
			s.context.contextActivities.parent;
		if ( parent && parent.length ) {
			return;
		}

		var verbId = s.verb.id || '';
		var verb =
			s.verb.display && ( s.verb.display[ 'en-US' ] || s.verb.display.en );
		var isDone =
			verbId.indexOf( 'completed' ) !== -1 ||
			verbId.indexOf( 'answered' ) !== -1 ||
			verb === 'completed' ||
			verb === 'answered';
		if ( ! isDone ) {
			return;
		}

		var contentId = cfg.contentId;
		if ( sent[ contentId ] ) {
			return;
		}
		sent[ contentId ] = true;

		var result = s.result || {};
		var score = result.score || {};

		post( {
			video: cfg.video,
			content_id: contentId,
			nonce: cfg.nonce,
			verb: verb || verbId,
			raw: typeof score.raw === 'number' ? score.raw : null,
			max: typeof score.max === 'number' ? score.max : null,
			scaled: typeof score.scaled === 'number' ? score.scaled : null,
			success: typeof result.success === 'boolean' ? result.success : null,
			completion: result.completion === true,
		} );
	} );
} )();
