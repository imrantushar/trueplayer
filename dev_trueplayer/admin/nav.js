/**
 * StoreEngine-style query-param routing. Each section is its own WP submenu
 * page (?page=trueplayer-videos …); sub-views use ?action=edit&id=N. Switching
 * sections is a real navigation; sub-views within a section use pushState.
 */
const SLUG = 'trueplayer';

export const PAGE_OF = {
	dashboard: SLUG,
	library: SLUG + '-videos',
	editor: SLUG + '-videos',
	analytics: SLUG + '-videos',
	playlists: SLUG + '-playlists',
	interactive: SLUG + '-interactive',
	presets: SLUG + '-presets',
	settings: SLUG + '-settings',
};

/** Resolve the active screen + params from the URL. */
export function parseRoute() {
	const q = new URLSearchParams( window.location.search );
	const page = q.get( 'page' ) || SLUG;
	const action = q.get( 'action' ) || '';
	const id = q.get( 'id' ) ? parseInt( q.get( 'id' ), 10 ) : null;

	if ( page === SLUG + '-videos' ) {
		if ( action === 'edit' && id ) {
			return { name: 'editor', id };
		}
		if ( action === 'analytics' && id ) {
			return { name: 'analytics', id };
		}
		// The library screen lists every kind; ?kind=media narrows it to players
		// without giving that filter its own submenu page.
		return { name: 'library', kind: q.get( 'kind' ) === 'media' ? 'media' : 'all' };
	}
	// Playlists / Interactive are the same screen, deep-linked to their filter —
	// each keeps its own page slug so the WP submenu highlight still works.
	if ( page === SLUG + '-playlists' ) {
		return { name: 'playlists', kind: 'playlist' };
	}
	if ( page === SLUG + '-interactive' ) {
		return { name: 'interactive', kind: 'interactive' };
	}
	if ( page === SLUG + '-presets' ) {
		return { name: 'presets' };
	}
	if ( page === SLUG + '-settings' ) {
		return { name: 'settings' };
	}
	return { name: 'dashboard' };
}

/**
 * The library filter a route implies. Playlists / Interactive are fixed by
 * their page slug; the Media page carries its filter in ?kind= (default all).
 * Needed because navigation can arrive without params — the WP submenu links
 * are hijacked by name alone.
 */
export function kindForRoute( name, kind ) {
	if ( 'playlists' === name ) {
		return 'playlist';
	}
	if ( 'interactive' === name ) {
		return 'interactive';
	}
	return kind || 'all';
}

/** Build the admin URL for a screen. */
export function routeUrl( name, params = {} ) {
	const page = PAGE_OF[ name ] || SLUG;
	const q = new URLSearchParams( { page } );
	if ( name === 'editor' ) {
		q.set( 'action', 'edit' );
	}
	if ( name === 'analytics' ) {
		q.set( 'action', 'analytics' );
	}
	if ( params.id ) {
		q.set( 'id', params.id );
	}
	if ( name === 'library' && params.kind && 'all' !== params.kind ) {
		q.set( 'kind', params.kind );
	}
	return 'admin.php?' + q.toString();
}
