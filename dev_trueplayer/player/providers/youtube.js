import { createEmitter } from './emitter';

/** Load the YT IFrame API once. */
let ytReady = null;
function loadYT() {
	if ( ytReady ) {
		return ytReady;
	}
	ytReady = new Promise( ( resolve ) => {
		if ( window.YT && window.YT.Player ) {
			resolve( window.YT );
			return;
		}
		const prev = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			if ( prev ) {
				prev();
			}
			resolve( window.YT );
		};
		// The script may already be in flight (warmed on facade hover). Only
		// inject once so the ready callback fires exactly one time.
		if ( ! document.querySelector( 'script[src*="youtube.com/iframe_api"]' ) ) {
			const tag = document.createElement( 'script' );
			tag.src = 'https://www.youtube.com/iframe_api';
			document.head.appendChild( tag );
		}
	} );
	return ytReady;
}

/**
 * The 11-character video id out of any URL YouTube hands out.
 *
 * `shorts/` and `live/` were missing, so those URLs fell through to the
 * `source.src` fallback and the whole URL was passed as a video id — which the
 * IFrame API answers by failing to load anything. The admin's own poster
 * derivation (admin/utils/poster.js) already covered both, so a Shorts link
 * would show its thumbnail and then refuse to play.
 */
function parseId( source ) {
	if ( source.videoId ) {
		return source.videoId;
	}
	const m = ( source.src || '' ).match( /(?:v=|\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/ );
	return m ? m[ 1 ] : source.src;
}

/**
 * What actually went wrong, in words an author can act on.
 *
 * 101 and 150 are the common one and the important one to name: the video
 * plays perfectly on youtube.com, and its owner has simply disallowed
 * embedding — no amount of checking the URL will fix it.
 */
const ERRORS = {
	2: 'That YouTube link doesn’t contain a valid video ID.',
	5: 'YouTube couldn’t play this video in the browser.',
	100: 'That YouTube video was removed, or is private.',
	101: 'The owner of that YouTube video doesn’t allow it to be embedded.',
	150: 'The owner of that YouTube video doesn’t allow it to be embedded.',
};

/**
 * YouTube provider with our own controls overlaid (controls=0, modestbranding).
 * A poll loop synthesizes timeupdate since the IFrame API has no such event.
 */
export async function createYouTubeProvider( container, source, opts = {} ) {
	const YT = await loadYT();
	const emitter = createEmitter();
	const host = document.createElement( 'div' );
	host.className = 'tp-media';
	container.appendChild( host );

	let poll = null;
	let duration = 0;

	// The YT.Player constructor returns synchronously; `onReady` fires later.
	// Build and return the provider now, and emit our own 'ready' from the
	// handler — waiting on onReady before returning would emit 'ready' before
	// the Player has subscribed to it, leaving it stuck on the spinner.
	const player = new YT.Player( host, {
		videoId: parseId( source ),
		// Privacy-enhanced mode (Settings → Sources & CDN): serve from
		// youtube-nocookie.com so no cookies are set until playback.
		host: ( window.TruePlayerGlobal && window.TruePlayerGlobal.youtube_nocookie ) ? 'https://www.youtube-nocookie.com' : undefined,
		playerVars: {
			controls: 0,
			modestbranding: 1,
			rel: 0,
			playsinline: 1,
			fs: 0,
			disablekb: 1,
			iv_load_policy: 3,
			// Booted from a click → begin playing as soon as the player is ready.
			autoplay: opts.autoStart ? 1 : 0,
			// "Start muted" reached html5 only; this provider ignored
			// opts.behavior entirely, so the toggle silently did nothing on a
			// YouTube video. `loop` is NOT set here on purpose — Player.jsx
			// loops from its own `ended` handler so end-of-video gating keeps
			// working, and YT's native loop would suppress that event.
			mute: ( opts.behavior && opts.behavior.muted ) ? 1 : 0,
			origin: window.location.origin,
		},
		events: {
			onReady: () => {
				duration = player.getDuration() || 0;
				emitter.emit( 'ready' );
				emitter.emit( 'durationchange' );
			},
			// Nothing listened for this before, so a video that could never play
			// — the embed-disabled case above all — left the player sitting on its
			// poster at 0:00 with a play button that did nothing and said nothing.
			onError: ( e ) => {
				emitter.emit( 'error', {
					code: e && e.data,
					message: ( ERRORS[ e && e.data ] ) || 'This YouTube video could not be played.',
				} );
			},
			onStateChange: ( e ) => {
				// YouTube reports no duration until the video is actually cued, so
				// the value read at ready is usually 0. Re-read it as the state
				// moves and announce it the first time it is real, or the scrubber
				// and the time readout stay stuck on 0:00.
				const known = player.getDuration() || 0;
				if ( known && known !== duration ) {
					duration = known;
					emitter.emit( 'durationchange' );
				}
				if ( e.data === YT.PlayerState.PLAYING ) {
					emitter.emit( 'play' );
					emitter.emit( 'playing' );
					if ( ! poll ) {
						poll = setInterval( () => emitter.emit( 'timeupdate' ), 250 );
					}
				} else if ( e.data === YT.PlayerState.PAUSED ) {
					emitter.emit( 'pause' );
				} else if ( e.data === YT.PlayerState.ENDED ) {
					emitter.emit( 'ended' );
				} else if ( e.data === YT.PlayerState.BUFFERING ) {
					emitter.emit( 'waiting' );
				}
			},
		},
	} );

	return {
		kind: 'youtube',
		element: host,
		capabilities: { pip: false, quality: false, rate: true, tracks: false },
		on: emitter.on,
		play: () => player.playVideo(),
		pause: () => player.pauseVideo(),
		seek: ( t ) => player.seekTo( t, true ),
		setVolume: ( v ) => player.setVolume( v * 100 ),
		setMuted: ( m ) => ( m ? player.mute() : player.unMute() ),
		setRate: ( r ) => player.setPlaybackRate( r ),
		getCurrentTime: () => player.getCurrentTime() || 0,
		getDuration: () => player.getDuration() || duration || 0,
		getBufferedEnd: () => ( player.getVideoLoadedFraction() || 0 ) * ( player.getDuration() || 0 ),
		isPaused: () => player.getPlayerState() !== YT.PlayerState.PLAYING,
		isMuted: () => player.isMuted(),
		getVolume: () => ( player.getVolume() || 0 ) / 100,
		getRate: () => player.getPlaybackRate() || 1,
		getQualities: () => [],
		setQuality: () => {},
		getTextTracks: () => [],
		setTextTrack: () => {},
		requestPiP: () => Promise.reject(),
		destroy: () => {
			if ( poll ) {
				clearInterval( poll );
			}
			try {
				player.destroy();
			} catch ( e ) {}
			emitter.clear();
		},
	};
}
