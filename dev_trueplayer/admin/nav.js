/**
 * StoreEngine-style query-param routing. Each section is its own WP submenu page
 * (?page=trueplayer-videos …); sub-views use ?action=edit&id=N. All five submenu
 * pages render the same PHP-side markup/assets (see includes/admin/menu.php), so
 * every transition — same section or not — is client-side via react-router-dom.
 */
const SLUG = 'trueplayer';

export const PAGE_OF = {
	dashboard: SLUG,
	library: SLUG + '-videos',
	editor: SLUG + '-videos',
	analytics: SLUG + '-videos',
	playlists: SLUG + '-playlists',
	presets: SLUG + '-presets',
	settings: SLUG + '-settings',
};

/** Resolve the active screen + params from a location search string (defaults to the current URL). */
export function parseRoute( search = window.location.search ) {
	const q = new URLSearchParams( search );
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
		return { name: 'library' };
	}
	if ( page === SLUG + '-playlists' ) {
		return { name: 'playlists' };
	}
	if ( page === SLUG + '-presets' ) {
		return { name: 'presets' };
	}
	if ( page === SLUG + '-settings' ) {
		return { name: 'settings' };
	}
	return { name: 'dashboard' };
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
	return 'admin.php?' + q.toString();
}
