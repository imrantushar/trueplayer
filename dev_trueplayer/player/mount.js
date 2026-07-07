import { createRoot } from 'react-dom/client';
import Player from './Player';
import Playlist from './Playlist';

// Domains to warm (DNS + TLS) so an embed starts fast once clicked.
const WARM_HOSTS = {
	youtube: [
		'https://www.youtube.com',
		'https://www.youtube-nocookie.com',
		'https://i.ytimg.com',
		'https://s.ytimg.com',
		'https://googleads.g.doubleclick.net',
	],
	vimeo: [ 'https://player.vimeo.com', 'https://i.vimeocdn.com', 'https://f.vimeocdn.com' ],
};

function preconnect( href ) {
	if ( document.querySelector( `link[rel="preconnect"][href="${ href }"]` ) ) {
		return;
	}
	const link = document.createElement( 'link' );
	link.rel = 'preconnect';
	link.href = href;
	link.crossOrigin = '';
	document.head.appendChild( link );
}

/**
 * Warm the network for an embed the moment the visitor shows intent (hover /
 * focus / touch), so the click-to-play chain isn't waiting on DNS, TLS, or the
 * YouTube IFrame API script. Called once per node.
 */
function warm( type ) {
	( WARM_HOSTS[ type ] || [] ).forEach( preconnect );
	if ( type === 'youtube' && ! document.querySelector( 'script[src*="youtube.com/iframe_api"]' ) ) {
		const tag = document.createElement( 'script' );
		tag.src = 'https://www.youtube.com/iframe_api';
		document.head.appendChild( tag );
	}
}

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
	createRoot( root ).render( <Player videoId={ videoId } config={ data.config || {} } title={ data.title || '' } autoStart={ autoStart } /> );
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
			const type = data.config && data.config.source && data.config.source.type;
			let warmed = false;
			const doWarm = () => {
				if ( ! warmed ) {
					warmed = true;
					warm( type );
				}
			};
			[ 'pointerenter', 'touchstart', 'focusin' ].forEach( ( ev ) =>
				facade.addEventListener( ev, doWarm, { once: true, passive: true } )
			);
			const boot = ( e ) => {
				if ( e ) {
					e.preventDefault();
				}
				doWarm();
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
