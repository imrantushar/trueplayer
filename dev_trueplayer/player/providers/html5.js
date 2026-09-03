import { createEmitter } from './emitter';

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

	if ( isHls && ! el.canPlayType( 'application/vnd.apple.mpegurl' ) ) {
		const Hls = ( await import( /* webpackChunkName: "hlsjs" */ 'hls.js' ) ).default;
		if ( Hls.isSupported() ) {
			hls = new Hls( { enableWorker: true } );
			hls.loadSource( src );
			hls.attachMedia( el );
			hls.on( Hls.Events.MANIFEST_PARSED, () => {
				qualities = ( hls.levels || [] ).map( ( lvl, i ) => ( {
					id: String( i ),
					label: lvl.height ? `${ lvl.height }p` : `Level ${ i }`,
				} ) );
				qualities.unshift( { id: 'auto', label: 'Auto' } );
				emitter.emit( 'qualitychange', qualities );
			} );
		} else {
			el.src = src; // last-ditch
		}
	} else {
		el.src = src;
	}

	// Subtitles.
	( source.subtitles || [] ).forEach( ( t, i ) => {
		const track = document.createElement( 'track' );
		track.kind = 'subtitles';
		track.label = t.label || `Track ${ i + 1 }`;
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
	el.addEventListener( 'error', () => emitter.emit( 'error', el.error ) );

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
				label: t.label || t.language || `Track ${ i + 1 }`,
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
