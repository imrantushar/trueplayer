import { createRoot } from 'react-dom/client';
import Player from './Player';
import Playlist from './Playlist';

/**
 * Read + parse the inline JSON config a mount node carries.
 */
function readConfig( node ) {
	const configEl = node.querySelector( 'script.trueplayer-config' );
	try {
		return configEl ? JSON.parse( configEl.textContent ) : {};
	} catch ( e ) {
		return {};
	}
}

/**
 * Boot the real React player into a node, replacing any poster facade. When
 * `autoStart` is set the player begins playing as soon as its provider is ready.
 */
function bootPlayer( node, data, videoId, autoStart ) {
	if ( node.dataset.tpBooted ) {
		return;
	}
	node.dataset.tpBooted = '1';
	const facade = node.querySelector( '.tp-facade' );
	if ( facade ) {
		facade.remove();
	}
	const root = document.createElement( 'div' );
	root.className = 'tp-root';
	node.appendChild( root );
	createRoot( root ).render( <Player videoId={ videoId } config={ data.config || {} } autoStart={ autoStart } /> );
}

/**
 * Discovers [data-trueplayer] mount nodes. To keep pages fast, a node that
 * rendered a poster facade stays inert — no video element, no YouTube/Vimeo
 * iframe, no hls.js, no gate request — until the visitor clicks to play. Nodes
 * with autoplay (or no facade) boot immediately.
 */
export function mountPlayers() {
	document.querySelectorAll( '[data-trueplayer]' ).forEach( ( node ) => {
		if ( node.dataset.tpBooted ) {
			return;
		}
		const data = readConfig( node );
		const videoId = data.videoId || parseInt( node.dataset.videoId, 10 );
		if ( ! videoId ) {
			return;
		}

		const facade = node.querySelector( '.tp-facade' );
		const autoplay = node.dataset.tpAutoplay === '1';

		if ( facade && ! autoplay ) {
			const boot = ( e ) => {
				if ( e ) {
					e.preventDefault();
				}
				bootPlayer( node, data, videoId, true );
			};
			facade.addEventListener( 'click', boot, { once: true } );
			return;
		}

		bootPlayer( node, data, videoId, autoplay );
	} );
}

/** Discovers [data-trueplayer-playlist] nodes and boots a Playlist per node. */
export function mountPlaylists() {
	document.querySelectorAll( '[data-trueplayer-playlist]' ).forEach( ( node ) => {
		if ( node.dataset.tpBooted ) {
			return;
		}
		node.dataset.tpBooted = '1';
		const configEl = node.querySelector( 'script.trueplayer-playlist-config' );
		let data = {};
		try {
			data = configEl ? JSON.parse( configEl.textContent ) : {};
		} catch ( e ) {
			data = {};
		}
		if ( ! ( data.items && data.items.length ) ) {
			return;
		}
		const root = document.createElement( 'div' );
		node.appendChild( root );
		createRoot( root ).render( <Playlist data={ data } /> );
	} );
}
