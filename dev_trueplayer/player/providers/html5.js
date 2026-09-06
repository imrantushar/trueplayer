import { createEmitter } from './emitter';
import { __, __sprintf } from '@Utils/translation';

/**
 * HTML5 <video>/<audio> provider. Plays self-hosted files and HLS — natively on
 * Safari, otherwise via a lazily-imported hls.js. Exposes quality levels for
 * HLS and native <track> captions.
 */
export async function createHtml5Provider( container, source, opts = {} ) {
	const emitter = createEmitter();
	const isAudio = source.mediaType === 'audio';
	const el = document.createElement( isAudio ? 'audio' : 'video' );
	el.className = 'tp-media';
	el.playsInline = true;
	const behavior = opts.behavior || {};
	el.preload = behavior.preload || 'metadata';
	// Looping is deliberately NOT the native `loop` attribute: a looping
	// media element never fires `ended`, and `ended` is the single trigger
	// for the final quiz, the end-screen overlay, the end email gate,
	// reset-on-end and playlist auto-advance. Player.jsx restarts playback
	// itself once those have had their turn (see onEnded).
	if ( behavior.muted || ( behavior.autoplay && ! behavior.autoplaySound ) ) {
		el.muted = true; // autoplay only works muted (unless sound mode, which retries muted on rejection)
	}
	if ( behavior.autoplay ) {
		el.autoplay = true;
	}
	if ( source.poster ) {
		el.poster = source.poster;
	}
	// Only set crossOrigin when explicitly requested (or when cross-origin
	// subtitle tracks need it). Setting it unconditionally makes the browser
	// REQUIRE CORS headers, which breaks playback of ordinary external videos
	// (YouTube-CDN, S3, most hosts) that don't send them.
	const needsCors =
		source.crossOrigin ||
		( source.subtitles || [] ).some( ( t ) => t.src && /^https?:\/\//i.test( t.src ) && ! t.src.startsWith( window.location.origin ) );
	if ( needsCors ) {
		el.crossOrigin = typeof source.crossOrigin === 'string' ? source.crossOrigin : 'anonymous';
	}
	container.appendChild( el );

	let hls = null;
	let qualities = [];
	const src = source.src || '';
	const isHls = source.type === 'hls' || /\.m3u8($|\?)/i.test( src );

	// A source with no URL cannot be played, and must not be handed to the
	// media element as one: assigning an empty `src` makes the browser resolve
	// it against the page and fail, which surfaces as a bare "Playback error"
	// that says nothing about the real problem. A Gumlet video saved while it
	// was still encoding arrives here exactly like this.
	if ( ! src ) {
		setTimeout(
			() => emitter.emit( 'error', { message: __( 'This video has no playable source yet. If it was just uploaded, it may still be encoding.' ) } ),
			0
		);
	} else if ( isHls ) {
		/**
		 * hls.js first, native HLS only as the fallback.
		 *
		 * This used to ask `canPlayType('application/vnd.apple.mpegurl')` and use
		 * hls.js only when the answer was empty — but that answer cannot be
		 * trusted. Chrome and Chromium builds return "maybe" for the HLS MIME
		 * type while being entirely unable to play a manifest, so the check
		 * skipped hls.js and handed a raw .m3u8 to the media element, which fails
		 * with MEDIA_ERR_SRC_NOT_SUPPORTED once someone presses play. The poster
		 * paints, so it looks like a working video right up until it isn't.
		 *
		 * `Hls.isSupported()` is a real capability test (it checks for Media
		 * Source Extensions), so it is what decides. Native is then reached only
		 * where MSE genuinely is not available — iOS Safari — which is exactly
		 * the browser whose native HLS is worth preferring anyway.
		 */
		const Hls = ( await import( /* webpackChunkName: "hlsjs" */ 'hls.js' ) ).default;
		if ( Hls.isSupported() ) {
			hls = new Hls( { enableWorker: true } );
			hls.loadSource( src );
			hls.attachMedia( el );
			hls.on( Hls.Events.MANIFEST_PARSED, () => {
				qualities = ( hls.levels || [] ).map( ( lvl, i ) => ( {
					id: String( i ),
					label: lvl.height ? __sprintf( '%dp', lvl.height ) : __sprintf( 'Level %d', i ),
				} ) );
				qualities.unshift( { id: 'auto', label: __( 'Auto' ) } );
				emitter.emit( 'qualitychange', qualities );
			} );
			// Without this, an HLS failure is invisible: hls.js reports its own
			// errors on this event and never touches the media element, so the
			// only thing the player could ever show was whatever unrelated state
			// the <video> happened to be in. Non-fatal errors are recovered from
			// internally and deliberately not surfaced — hls.js retries them.
			hls.on( Hls.Events.ERROR, ( _evt, data ) => {
				if ( ! data || ! data.fatal ) {
					return;
				}
				const detail = data.response && data.response.code ? ` (${ data.response.code })` : '';
				emitter.emit( 'error', {
					message: __sprintf( 'This video could not be loaded: %s', ( data.details || data.type ) + detail ),
				} );
			} );
		} else if ( el.canPlayType( 'application/vnd.apple.mpegurl' ) ) {
			// No MSE, but the browser plays HLS itself — iOS Safari.
			el.src = src;
		} else {
			// Neither route exists. Say so, rather than assigning a manifest the
			// element will reject a moment later with a decode error that reads
			// like the video is broken.
			setTimeout(
				() => emitter.emit( 'error', { message: __( 'This browser cannot play streaming (HLS) video.' ) } ),
				0
			);
		}
	} else {
		el.src = src;
	}

	// Subtitles.
	( source.subtitles || [] ).forEach( ( t, i ) => {
		const track = document.createElement( 'track' );
		track.kind = 'subtitles';
		track.label = t.label || __sprintf( 'Track %d', i + 1 );
		track.srclang = t.srclang || 'en';
		track.src = t.src;
		if ( t.default ) {
			track.default = true;
		}
		el.appendChild( track );
	} );

	// Wire native events → emitter.
	const fwd = ( native, mapped ) => el.addEventListener( native, () => emitter.emit( mapped || native ) );
	fwd( 'loadedmetadata', 'ready' );
	fwd( 'durationchange' );
	fwd( 'timeupdate' );
	fwd( 'play' );
	fwd( 'pause' );
	fwd( 'ended' );
	fwd( 'waiting' );
	fwd( 'playing' );
	fwd( 'ratechange' );
	fwd( 'volumechange' );
	/**
	 * Media-element failures, translated.
	 *
	 * `el.error` is a MediaError whose `message` is empty in most browsers, so
	 * forwarding it raw left the player showing a bare "Playback error" for
	 * four quite different problems. The code is the only reliable part, so it
	 * is what gets read.
	 */
	el.addEventListener( 'error', () => {
		const err = el.error;
		const byCode = {
			1: __( 'Playback was interrupted.' ),
			2: __( 'The video could not be downloaded — check the connection or the file’s URL.' ),
			3: __( 'This video could not be decoded. Its format may not be supported by this browser.' ),
			4: __( 'This video’s format or URL is not supported by this browser.' ),
		};
		emitter.emit( 'error', {
			code: err && err.code,
			// A browser that does fill in `message` usually has the most
			// specific answer, so it wins when present.
			message: ( err && err.message ) || ( err && byCode[ err.code ] ) || __( 'Playback error.' ),
		} );
	} );

	return {
		kind: 'html5',
		element: el,
		sourceUrl: src,
		capabilities: {
			// `'requestPictureInPicture' in el` alone isn't enough — Firefox and
			// permissions-policy-restricted frames (some embed contexts) expose
			// the method but reject every call, which made the button look
			// broken. `document.pictureInPictureEnabled` reflects whether it can
			// actually succeed.
			pip: ! isAudio && !! document.pictureInPictureEnabled && ! el.disablePictureInPicture,
			quality: qualities.length > 0, rate: true, tracks: true, download: true, fullscreen: ! isAudio,
		},
		on: emitter.on,
		play: () => el.play(),
		pause: () => el.pause(),
		seek: ( t ) => {
			el.currentTime = t;
		},
		setVolume: ( v ) => {
			el.volume = v;
		},
		setMuted: ( m ) => {
			el.muted = m;
		},
		setRate: ( r ) => {
			el.playbackRate = r;
		},
		getCurrentTime: () => el.currentTime || 0,
		getDuration: () => ( isFinite( el.duration ) ? el.duration : 0 ),
		getBufferedEnd: () => {
			try {
				return el.buffered.length ? el.buffered.end( el.buffered.length - 1 ) : 0;
			} catch ( e ) {
				return 0;
			}
		},
		isPaused: () => el.paused,
		isMuted: () => el.muted,
		getVolume: () => el.volume,
		getRate: () => el.playbackRate,
		getQualities: () => qualities,
		setQuality: ( id ) => {
			if ( hls ) {
				hls.currentLevel = id === 'auto' ? -1 : parseInt( id, 10 );
			}
		},
		getTextTracks: () => {
			// `default` lives on the <track> element, not on the TextTrack the
			// browser derives from it; the two lists are in the same order.
			const els = Array.from( el.querySelectorAll( 'track' ) );
			return Array.from( el.textTracks || [] ).map( ( t, i ) => ( {
				id: String( i ),
				// A track saved without a label would otherwise be a blank row in
				// the menu, with nothing to tell it from its neighbours.
				label: t.label || t.language || __sprintf( 'Track %d', i + 1 ),
				isDefault: !! ( els[ i ] && els[ i ].default ),
			} ) );
		},
		/**
		 * Which track is on screen right now, or 'off'.
		 *
		 * The browser starts a `default` track showing on its own, without anyone
		 * calling setTextTrack — so the UI has to read the element rather than
		 * assume its own initial state, or it reports captions off while they are
		 * being rendered.
		 */
		getActiveTextTrack: () => {
			const i = Array.from( el.textTracks || [] ).findIndex( ( t ) => 'showing' === t.mode );
			return -1 === i ? 'off' : String( i );
		},
		setTextTrack: ( id ) => {
			Array.from( el.textTracks || [] ).forEach( ( t, i ) => {
				t.mode = String( i ) === String( id ) ? 'showing' : 'hidden';
			} );
		},
		// Cues for the interactive transcript. Force the track to load (mode
		// 'hidden' parses cues without rendering them) and flatten to plain data.
		getCues: () => {
			const tracks = Array.from( el.textTracks || [] );
			const t = tracks.find( ( x ) => x.cues && x.cues.length ) ||
				tracks.find( ( x ) => x.mode !== 'disabled' ) || tracks[ 0 ];
			if ( ! t ) {
				return [];
			}
			if ( t.mode === 'disabled' ) {
				t.mode = 'hidden'; // triggers async cue parsing
			}
			return Array.from( t.cues || [] ).map( ( c ) => ( {
				start: c.startTime,
				end: c.endTime,
				text: ( c.text || '' ).replace( /<[^>]+>/g, '' ),
			} ) );
		},
		requestPiP: () => ( el.requestPictureInPicture ? el.requestPictureInPicture() : Promise.reject() ),
		exitPiP: () => ( document.pictureInPictureElement ? document.exitPictureInPicture() : Promise.resolve() ),
		isPiPActive: () => document.pictureInPictureElement === el,
		destroy: () => {
			if ( hls ) {
				hls.destroy();
			}
			el.remove();
			emitter.clear();
		},
	};
}
