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
	presets: SLUG + '-presets',
	settings: SLUG + '-settings',
};

/** Legacy page slugs, still registered in WP, that are now library filters. */
const LEGACY_KIND = {
	[ SLUG + '-playlists' ]: 'playlist',
	[ SLUG + '-interactive' ]: 'interactive',
};

const KINDS = [ 'all', 'media', 'playlist', 'interactive' ];

/** Settings sections, in the order the screen lists them (see Settings.jsx). */
export const SETTINGS_TABS = [
	'general', 'branding', 'sources',
	'enforcement', 'compliance', 'analytics',
	'integrations', 'webhooks', 'logs',
	'license',
];

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
		// One library screen; ?kind= picks the filter.
		const kind = q.get( 'kind' ) || 'all';
		return { name: 'library', kind: KINDS.includes( kind ) ? kind : 'all' };
	}
	// Old per-section URLs land on the library, filtered to what they used to be.
	if ( LEGACY_KIND[ page ] ) {
		return { name: 'library', kind: LEGACY_KIND[ page ] };
	}
	if ( page === SLUG + '-presets' ) {
		return { name: 'presets' };
	}
	if ( page === SLUG + '-settings' ) {
		// The section is part of the address, so a reload (or a shared link)
		// lands where you were instead of bouncing back to General.
		const tab = q.get( 'tab' ) || '';
		return { name: 'settings', tab: SETTINGS_TABS.includes( tab ) ? tab : 'general' };
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
	if ( name === 'library' && params.kind && 'all' !== params.kind ) {
		q.set( 'kind', params.kind );
	}
	if ( name === 'settings' && params.tab && 'general' !== params.tab ) {
		q.set( 'tab', params.tab );
	}
	return 'admin.php?' + q.toString();
}
