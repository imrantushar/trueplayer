import { createRoot } from 'react-dom/client';
import Player from './Player';

/**
 * Discovers [data-trueplayer] mount nodes and boots one React player per node,
 * reading the inline JSON config the shortcode/block rendered.
 */
export function mountPlayers() {
	const nodes = document.querySelectorAll( '[data-trueplayer]' );
	nodes.forEach( ( node ) => {
		if ( node.dataset.tpBooted ) {
			return;
		}
		node.dataset.tpBooted = '1';

		const configEl = node.querySelector( 'script.trueplayer-config' );
		let data = {};
		try {
			data = configEl ? JSON.parse( configEl.textContent ) : {};
		} catch ( e ) {
			data = {};
		}

		const videoId = data.videoId || parseInt( node.dataset.videoId, 10 );
		if ( ! videoId ) {
			return;
		}

		const root = document.createElement( 'div' );
		root.className = 'tp-root';
		node.appendChild( root );
		createRoot( root ).render( <Player videoId={ videoId } config={ data.config || {} } /> );
	} );
}
