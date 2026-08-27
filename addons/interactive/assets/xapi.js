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

	/**
	 * Persist the answer state as soon as it changes, and again on the way out.
	 *
	 * H5P core already autosaves, but only on two triggers, and neither covers
	 * the obvious case of answering a question and reloading:
	 *   - a timer every `saveFreq` seconds (30 by default), and
	 *   - a save three seconds after an xAPI `completed` or `progressed` verb —
	 *     which question types don't emit; MultiChoice reports `answered`.
	 * Its own leaving-the-page fallback uses a synchronous XHR, which browsers
	 * now block during page dismissal, so it silently loses the state too.
	 *
	 * So: debounce a save off any interaction, and use sendBeacon on the way out
	 * (the one transport designed to survive dismissal). H5P.setUserData
	 * de-duplicates identical payloads itself, so the extra calls are cheap.
	 */
	( function attachStateSaving() {
		var I = window.H5PIntegration;
		// No signed-in user (or saving switched off) means H5P stores nothing —
		// there is no identity to resume a logged-out visitor against.
		if ( ! I || ! I.user || I.saveFreq === false || ! H5P.setUserData ) {
			return;
		}

		var DEBOUNCE_MS = 1200;
		var timer = null;

		function statefulInstances() {
			return ( H5P.instances || [] ).filter( function ( inst ) {
				return inst && typeof inst.getCurrentState === 'function';
			} );
		}

		function saveNow() {
			statefulInstances().forEach( function ( inst ) {
				var state;
				try {
					state = inst.getCurrentState();
				} catch ( e ) {
					return;
				}
				if ( state === undefined ) {
					return;
				}
				// `async` is left alone: H5P uses jQuery.ajax here, and the
				// dismissal case is covered by the beacon below instead.
				H5P.setUserData( inst.contentId, 'state', state, { deleteOnChange: true } );
			} );
		}

		function scheduleSave() {
			clearTimeout( timer );
			timer = setTimeout( saveNow, DEBOUNCE_MS );
		}

		H5P.externalDispatcher.on( 'xAPI', function ( event ) {
			var st = event && event.data && event.data.statement;
			var id = st && st.verb && st.verb.id ? st.verb.id : '';
			if ( id.indexOf( 'interacted' ) !== -1 || id.indexOf( 'answered' ) !== -1 ) {
				scheduleSave();
			}
		} );

		/**
		 * Leaving the page: flush whatever the debounce is still holding.
		 * `pagehide` fires where `beforeunload` does not (bfcache, mobile tab
		 * switches), and a beacon is not cancelled by the navigation.
		 */
		function flushOnExit() {
			clearTimeout( timer );
			if ( ! navigator.sendBeacon || ! I.ajax || ! I.ajax.contentUserData ) {
				saveNow();
				return;
			}
			statefulInstances().forEach( function ( inst ) {
				var state;
				try {
					state = inst.getCurrentState();
				} catch ( e ) {
					return;
				}
				if ( state === undefined ) {
					return;
				}
				var url = I.ajax.contentUserData
					.replace( ':contentId', inst.contentId )
					.replace( ':dataType', 'state' )
					.replace( ':subContentId', 0 );
				var body = new URLSearchParams( {
					data: JSON.stringify( state ),
					preload: '1',
					invalidate: '1',
					contentHash: 0,
				} );
				try {
					navigator.sendBeacon(
						url,
						new Blob( [ body.toString() ], { type: 'application/x-www-form-urlencoded' } )
					);
				} catch ( e ) {}
			} );
		}

		window.addEventListener( 'pagehide', flushOnExit );
		document.addEventListener( 'visibilitychange', function () {
			if ( document.visibilityState === 'hidden' ) {
				flushOnExit();
			}
		} );
	} )();

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
