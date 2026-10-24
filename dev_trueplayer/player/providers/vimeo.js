import { createEmitter } from './emitter';
import { __ } from '@Utils/translation';

/**
 * Vimeo provider via @vimeo/player (lazy-imported). Native controls hidden;
 * our custom control bar drives it.
 */
export async function createVimeoProvider( container, source, opts = {} ) {
	const Vimeo = ( await import( /* webpackChunkName: "vimeojs" */ '@vimeo/player' ) ).default;
	const emitter = createEmitter();
	const host = document.createElement( 'div' );
	host.className = 'tp-media';
	container.appendChild( host );

	const id = source.videoId || ( source.src || '' ).match( /vimeo\.com\/(\d+)/ )?.[ 1 ] || source.src;
	// `muted` was previously ignored here — this provider only ever read
	// opts.autoStart, so "Start muted" did nothing on a Vimeo video.
	// `loop` stays unset deliberately: Player.jsx loops from its own
	// `ended` handler so end-of-video gating still runs.
	const player = new Vimeo( host, {
		id,
		controls: false,
		responsive: true,
		playsinline: true,
		autoplay: !! opts.autoStart,
		muted: !! ( opts.behavior && opts.behavior.muted ),
	} );

	let duration = 0;
	let current = 0;
	let paused = true;
	let qualities = [];
	let activeQuality = '';

	player.on( 'timeupdate', ( d ) => {
		current = d.seconds;
		emitter.emit( 'timeupdate' );
	} );
	player.on( 'play', () => {
		paused = false;
		emitter.emit( 'play' );
		emitter.emit( 'playing' );
	} );
	player.on( 'pause', () => {
		paused = true;
		emitter.emit( 'pause' );
	} );
	player.on( 'ended', () => emitter.emit( 'ended' ) );
	player.on( 'bufferstart', () => emitter.emit( 'waiting' ) );
	// Vimeo changes quality on its own while `auto` is selected, so the active
	// value is read back from the player rather than assumed from the last
	// setQuality call. The SDK forwards any event name to the iframe rather
	// than validating against a list, so subscribing is safe even where Vimeo
	// never emits it (older embeds, Basic accounts) — `activeQuality` then
	// simply stays as resolved at ready. 'auto' is normalized away for the
	// reason given there.
	player.on( 'qualitychange', ( d ) => {
		const q = ( d && d.quality ) || '';
		activeQuality = 'auto' === q ? '' : q;
		emitter.emit( 'qualitychange', qualities );
	} );

	// Emit 'ready' asynchronously (player.ready() resolves over the network),
	// so the Player has subscribed by the time it fires. Awaiting it before we
	// return would emit into the void and leave the player stuck on the spinner.
	player.ready().then( async () => {
		duration = await player.getDuration().catch( () => 0 );
		emitter.emit( 'ready' );
		emitter.emit( 'durationchange' );

		/**
		 * Quality levels, if this video has any to offer.
		 *
		 * Deliberately swallowed on failure: getQualities() rejects outright on
		 * a Basic Vimeo account (quality selection is a paid feature) and on
		 * live streams. An empty list is the correct outcome there — no menu —
		 * and it must not surface as a playback error, because playback is
		 * fine.
		 *
		 * Vimeo already includes its own `auto` entry, so it is filtered out
		 * and re-added rather than left to appear twice under two labels.
		 */
		const list = await player.getQualities().catch( () => [] );
		const levels = ( list || [] ).filter( ( q ) => q && 'auto' !== q.id );
		if ( levels.length > 1 ) {
			qualities = [
				{ id: 'auto', label: __( 'Auto' ) },
				...levels.map( ( q ) => ( { id: q.id, label: q.label || q.id } ) ),
			];
		}
		// getQuality() reports the SELECTION, which under auto is the literal
		// string 'auto' rather than the height it resolved to. Normalized away
		// here so the menu never renders "Auto (Auto)" — an unresolved auto has
		// no active label, and the row just reads "Auto".
		const q = await player.getQuality().catch( () => '' );
		activeQuality = 'auto' === q ? '' : q;
		emitter.emit( 'qualitychange', qualities );
	} );

	return {
		kind: 'vimeo',
		element: host,
		// Whether a given embed actually supports it is only knowable async
		// (player.getPictureInPicture() round-trips to the iframe), so this is
		// a browser-level check; per-video support still governs whether
		// requestPiP() itself resolves.
		capabilities: {
			pip: !! document.pictureInPictureEnabled,
			// A getter: the list is filled asynchronously from player.ready(),
			// long after this object is returned.
			get quality() {
				return qualities.length > 0;
			},
			rate: true, tracks: false,
		},
		on: emitter.on,
		play: () => player.play(),
		pause: () => player.pause(),
		// `current` only otherwise moves on the 'timeupdate' event, which Vimeo
		// fires during playback but not reliably right after a seek made while
		// paused (dragging the scrubber without hitting play). Without this,
		// getCurrentTime() kept returning the pre-drag value, so the Scrubber's
		// "wait for playback to catch up" reconciliation never saw it catch up
		// and the thumb snapped back after its timeout — set it optimistically
		// so a paused seek is reflected immediately, then reconcile with the
		// real (resolved) position once the postMessage round-trip completes.
		seek: ( t ) => {
			current = t;
			emitter.emit( 'timeupdate' );
			return player.setCurrentTime( t ).then( ( seconds ) => {
				current = seconds;
				emitter.emit( 'timeupdate' );
			} ).catch( () => {} );
		},
		setVolume: ( v ) => player.setVolume( v ),
		setMuted: ( m ) => player.setMuted( m ),
		setRate: ( r ) => player.setPlaybackRate( r ),
		getCurrentTime: () => current,
		getDuration: () => duration,
		getBufferedEnd: () => current,
		isPaused: () => paused,
		isMuted: () => false,
		getVolume: () => 1,
		getRate: () => 1,
		getQualities: () => qualities,
		setQuality: ( id ) => player.setQuality( id ).catch( () => {} ),
		getActiveQuality: () => activeQuality,
		getTextTracks: () => [],
		setTextTrack: () => {},
		requestPiP: () => player.requestPictureInPicture(),
		exitPiP: () => player.exitPictureInPicture(),
		isPiPActive: () => player.getPictureInPicture().catch( () => false ),
		destroy: () => {
			try {
				player.destroy();
			} catch ( e ) {}
			emitter.clear();
		},
	};
}
