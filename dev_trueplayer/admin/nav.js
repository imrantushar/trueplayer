/**
 * StoreEngine-style query-param routing. Each section is its own WP submenu
 * page (?page=trueplayer-videos …); sub-views use ?action=edit&id=N. Switching
 * sections is a real navigation; sub-views within a section use pushState.
 */
import { settingsTabs, extRoutes, libraryKinds } from '@Ext/admin';

const SLUG = 'trueplayer';

export const PAGE_OF = {
	dashboard: SLUG,
	library: SLUG + '-videos',
	editor: SLUG + '-videos',
	presets: SLUG + '-presets',
	settings: SLUG + '-settings',
	// Extension screens live under the media page as ?action={name}&id=N.
	...Object.fromEntries( extRoutes.map( ( r ) => [ r.name, SLUG + '-videos' ] ) ),
};

/** Legacy page slugs, still registered in WP, that are now library filters. */
const LEGACY_KIND = {
	[ SLUG + '-playlists' ]: 'playlist',
};

// `media` is kept although no chip offers it any more: it is what every link
// and bookmark made before Video/Audio were split still carries, and it still
// means exactly what it did — both kinds of player.
const KINDS = [ 'all', 'media', 'video', 'audio', 'playlist', ...libraryKinds.map( ( k ) => k.kind ) ];

/** Settings sections (see Settings.jsx); extension tabs add their own keys. */
export const SETTINGS_TABS = [
	'general', 'branding', 'sources', 'integrations', 'addons',
	...settingsTabs.map( ( t ) => t.key ),
];

/** Resolve the active screen + params from the URL. */
export function parseRoute() {
	const q = new URLSearchParams( window.location.search );
	const page = q.get( 'page' ) || SLUG;
	const action = q.get( 'action' ) || '';
	const id = q.get( 'id' ) ? parseInt( q.get( 'id' ), 10 ) : null;

	if ( page === SLUG + '-videos' ) {
		if ( action === 'edit' && id ) {
			// The step + sub-step ride in the URL too, so a reload (or a shared
			// link) keeps the author where they were instead of bouncing back to
			// Source — same reasoning as the Settings tab below. Editor.jsx owns
			// the actual set of valid keys (TABS / each tab's subs) and falls back
			// to its own defaults for anything it doesn't recognize, so nothing
			// here needs to duplicate that list.
			const tab = q.get( 'tab' ) || '';
			const sub = q.get( 'sub' ) || '';
			return { name: 'editor', id, tab, sub };
		}
		if ( id && extRoutes.some( ( r ) => r.name === action ) ) {
			return { name: action, id };
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
		if ( params.tab ) {
			q.set( 'tab', params.tab );
		}
		if ( params.sub ) {
			q.set( 'sub', params.sub );
		}
	}
	if ( extRoutes.some( ( r ) => r.name === name ) ) {
		q.set( 'action', name );
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
