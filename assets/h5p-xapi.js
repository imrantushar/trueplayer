/**
 * TruePlayer ↔ H5P xAPI bridge (plain JS, no build step).
 *
 * Listens to the H5P content's xAPI statements and forwards the root-level
 * completion/answer to TruePlayer's REST endpoint, which normalises it into the
 * same event bus the native player feeds (analytics, webhooks, CRM, LMS). Only
 * the top-level statement (no parent context) is reported, so sub-question
 * chatter is ignored.
 *
 * A page can hold several interactive items, so the item a statement belongs to
 * is read from the statement itself (H5P stamps the local content id into the
 * object extensions) and resolved against the content-id => video-id map — never
 * from a single ambient value.
 *
 * @global H5P  Provided by the H5P runtime; guarded on before use.
 */
/* global H5P */
( function () {
	var cfg = window.TruePlayerH5PxAPI || {};
	if ( ! window.H5P || ! window.H5P.externalDispatcher || ! cfg.endpoint ) {
		return;
	}

	var CONTENT_ID_EXT = 'http://h5p.org/x-api/h5p-local-content-id';
	var SUB_CONTENT_EXT = 'http://h5p.org/x-api/h5p-subContentId';
	var items = cfg.items || {};
	var sent = {};

	// sendBeacon can't set headers, and a REST request without X-WP-Nonce is
	// treated as logged-out — the auth cookie is ignored, so the nonce in the
	// body can never validate and the result is dropped along with the user it
	// belonged to. _wpnonce on the query string is the mechanism that works for
	// both transports.
	var endpoint =
		cfg.endpoint +
		( cfg.endpoint.indexOf( '?' ) === -1 ? '?' : '&' ) +
		'_wpnonce=' +
		encodeURIComponent( cfg.nonce || '' );

	function post( payload ) {
		try {
			var body = JSON.stringify( payload );
			if ( navigator.sendBeacon ) {
				navigator.sendBeacon( endpoint, new Blob( [ body ], { type: 'application/json' } ) );
			} else {
				fetch( endpoint, {
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

		var ext =
			( s.object && s.object.definition && s.object.definition.extensions ) || {};
		// Belt-and-braces: a sub-content statement that somehow lost its parent
		// context still isn't the item's own result.
		if ( ext[ SUB_CONTENT_EXT ] ) {
			return;
		}

		var contentId = parseInt( ext[ CONTENT_ID_EXT ], 10 );
		if ( ! contentId || ! Object.prototype.hasOwnProperty.call( items, contentId ) ) {
			return;
		}

		if ( sent[ contentId ] ) {
			return;
		}
		sent[ contentId ] = true;

		var result = s.result || {};
		var score = result.score || {};

		post( {
			video: items[ contentId ],
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
