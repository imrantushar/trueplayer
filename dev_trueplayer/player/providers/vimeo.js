import { createEmitter } from './emitter';

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
	const player = new Vimeo( host, { id, controls: false, responsive: true, playsinline: true, autoplay: !! opts.autoStart } );

	let duration = 0;
	let current = 0;
	let paused = true;

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

	// Emit 'ready' asynchronously (player.ready() resolves over the network),
	// so the Player has subscribed by the time it fires. Awaiting it before we
	// return would emit into the void and leave the player stuck on the spinner.
	player.ready().then( async () => {
		duration = await player.getDuration().catch( () => 0 );
		emitter.emit( 'ready' );
		emitter.emit( 'durationchange' );
	} );

	return {
		kind: 'vimeo',
		element: host,
		capabilities: { pip: true, quality: false, rate: true, tracks: false },
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
		getQualities: () => [],
		setQuality: () => {},
		getTextTracks: () => [],
		setTextTrack: () => {},
		requestPiP: () => player.requestPictureInPicture(),
		destroy: () => {
			try {
				player.destroy();
			} catch ( e ) {}
			emitter.clear();
		},
	};
}
