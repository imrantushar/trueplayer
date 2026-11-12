import { createEmitter } from './emitter';
import { __ } from '@Utils/translation';

/** Where the vendored `@tpc/player` module lives (see Cloud::expose_player_url()), or '' if the cloud addon isn't active. */
function playerUrl() {
	return ( window.TruePlayerGlobal || {} ).cloudPlayerUrl || '';
}

/** Mints a playback token for this TruePlayer video through TruePlayer's own gate (see Rest::trueplayer_token() in the cloud addon). */
async function fetchToken( videoId ) {
	const g = window.TruePlayerGlobal || {};
	const res = await fetch( `${ g.rest_url || '/wp-json/' }tpc/v1/trueplayer-token`, {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': g.nonce || '' },
		body: JSON.stringify( { video: videoId } ),
	} );
	const data = await res.json().catch( () => ( {} ) );
	if ( ! res.ok ) {
		throw new Error( data.message || __( 'Could not start this video.' ) );
	}
	return data; // { token, expires_at, src }
}

/**
 * TruePlayer Cloud provider. Wraps the vendored `@tpc/player`'s own
 * `createPlayer()` (a separate project's build output, dynamically
 * imported — not a webpack dependency, the same way the standalone
 * connector plugin vendors and loads it) behind the interface
 * `createHtml5Provider` returns: `on`, `play`, `pause`, `seek`,
 * `getCurrentTime`, `getDuration`, `destroy`.
 *
 * The cloud player manages its own `<video>` element internally
 * (`player.element`), so native media events are forwarded exactly the way
 * `html5.js` forwards its own — this provider is glue, not a second
 * playback engine.
 *
 * Not wired yet: setVolume/setMuted/setRate/quality/caption switching — the
 * cloud player supports some of these natively, but this provider doesn't
 * expose them to Player.jsx, so those controls are inert for a cloud
 * source. A real gap, left for a follow-up rather than guessed at here.
 */
export async function createCloudProvider( container, source, opts = {} ) {
	const emitter = createEmitter();
	const fail = ( message ) => {
		// Matches how html5.js reports a source that can't play at all —
		// async, so a caller that does `provider.on('error', …)` right after
		// this resolves still catches it.
		setTimeout( () => emitter.emit( 'error', { message } ) );
		return {
			kind: 'cloud',
			element: null,
			sourceUrl: '',
			capabilities: {},
			on: emitter.on,
			play: () => {},
			pause: () => {},
			seek: () => {},
			getCurrentTime: () => 0,
			getDuration: () => 0,
			destroy: () => {},
		};
	};

	const url = playerUrl();
	if ( ! url ) {
		return fail( __( 'TruePlayer Cloud is not available.' ) );
	}

	let token;
	try {
		token = await fetchToken( opts.videoId );
	} catch ( e ) {
		return fail( e.message );
	}

	// webpackIgnore: this is the other project's own build output, served from
	// this site (not a package in this bundle's node_modules) — webpack has
	// nothing to resolve here, and trying would just fail the build.
	const { createPlayer } = await import( /* webpackIgnore: true */ url );

	const behavior = opts.behavior || {};
	let destroyed = false;
	const player = createPlayer( container, {
		src: token.src,
		token: token.token,
		autoplay: !! behavior.autoplay,
		muted: !! ( behavior.muted || ( behavior.autoplay && ! behavior.autoplaySound ) ),
		onError: ( err ) => emitter.emit( 'error', { code: err.code, message: err.message } ),
		refreshToken: async () => {
			const next = await fetchToken( opts.videoId );
			return next.token;
		},
	} );

	const el = player.element;
	const fwd = ( native, mapped ) => el.addEventListener( native, () => {
		if ( ! destroyed ) {
			emitter.emit( mapped || native );
		}
	} );
	fwd( 'loadedmetadata', 'ready' );
	fwd( 'durationchange' );
	fwd( 'timeupdate' );
	fwd( 'play' );
	fwd( 'pause' );
	fwd( 'ended' );
	fwd( 'waiting' );
	fwd( 'playing' );

	return {
		kind: 'cloud',
		element: el,
		sourceUrl: token.src,
		capabilities: { pip: false, quality: false, rate: false, tracks: false, download: false, fullscreen: true },
		on: emitter.on,
		play: () => player.play(),
		pause: () => player.pause(),
		seek: ( t ) => player.seek( t ),
		getCurrentTime: () => el.currentTime || 0,
		getDuration: () => ( isFinite( el.duration ) ? el.duration : 0 ),
		destroy: () => {
			destroyed = true;
			player.destroy();
		},
	};
}
