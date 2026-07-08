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
 * Muted, looped inline preview while hovering the poster facade — Presto-style
 * "muted autoplay preview". Direct-file sources only (no iframe/hls machinery);
 * starts after a short intent delay and is torn down on pointer-leave.
 */
function attachHoverPreview( facade, config ) {
	const source = ( config && config.source ) || {};
	const behavior = ( config && config.customize && config.customize.behavior ) || {};
	const src = source.src || '';
	const previewable =
		behavior.hoverPreview &&
		[ 'self', 'url' ].includes( source.type ) &&
		source.mediaType !== 'audio' &&
		src && ! /\.m3u8($|\?)/i.test( src );
	if ( ! previewable ) {
		return;
	}

	let timer = null;
	let vid = null;
	const stop = () => {
		clearTimeout( timer );
		timer = null;
		if ( vid ) {
			vid.pause();
			vid.remove();
			vid = null;
		}
	};
	facade.addEventListener( 'pointerenter', () => {
		if ( facade.closest( '[data-tp-booted]' ) || timer || vid ) {
			return;
		}
		timer = setTimeout( () => {
			vid = document.createElement( 'video' );
			vid.className = 'tp-facade-poster tp-hover-preview';
			vid.src = src;
			vid.muted = true;
			vid.loop = true;
			vid.playsInline = true;
			vid.preload = 'auto';
			facade.insertBefore( vid, facade.querySelector( '.tp-facade-btn' ) );
			const p = vid.play();
			if ( p && typeof p.catch === 'function' ) {
				p.catch( () => {} );
			}
		}, 300 );
	} );
	facade.addEventListener( 'pointerleave', stop );
	// The click boot removes the facade wholesale; just clear our timer.
	facade.addEventListener( 'click', stop, { once: true } );
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
			attachHoverPreview( facade, data.config );
			return;
		}

		bootPlayer( node, data, videoId, autoplay );
	} );
}

/**
 * Discovers [data-trueplayer-popup] triggers and opens the player in a lightbox
 * on click. Nothing loads until then — the player is mounted into the modal and
 * torn down on close.
 */
export function mountPopups() {
	document.querySelectorAll( '[data-trueplayer-popup]' ).forEach( ( node ) => {
		if ( node.dataset.tpPopupBound ) {
			return;
		}
		node.dataset.tpPopupBound = '1';
		const el = node.querySelector( 'script.trueplayer-popup-config' );
		let data = {};
		try {
			data = el ? JSON.parse( el.textContent ) : {};
		} catch ( e ) {
			data = {};
		}
		const videoId = data.videoId || parseInt( node.dataset.videoId, 10 );
		if ( ! videoId ) {
			return;
		}
		const trigger = node.querySelector( '.trueplayer-popup-trigger' ) || node;
		trigger.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			openPopup( videoId, data.config || {} );
		} );
	} );
}

function openPopup( videoId, config ) {
	const backdrop = document.createElement( 'div' );
	backdrop.className = 'tp-popup-backdrop';
	backdrop.innerHTML =
		'<div class="tp-popup-dialog"><button class="tp-popup-close" aria-label="Close">×</button><div class="tp-popup-player"></div></div>';
	document.body.appendChild( backdrop );
	document.body.style.overflow = 'hidden';

	const root = createRoot( backdrop.querySelector( '.tp-popup-player' ) );
	root.render( <Player videoId={ videoId } config={ config } autoStart={ true } /> );

	const close = () => {
		root.unmount();
		backdrop.remove();
		document.body.style.overflow = '';
		document.removeEventListener( 'keydown', onKey );
	};
	const onKey = ( e ) => {
		if ( e.key === 'Escape' ) {
			close();
		}
	};
	backdrop.querySelector( '.tp-popup-close' ).addEventListener( 'click', close );
	backdrop.addEventListener( 'click', ( e ) => {
		if ( e.target === backdrop ) {
			close();
		}
	} );
	document.addEventListener( 'keydown', onKey );
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
