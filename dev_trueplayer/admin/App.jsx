import { useEffect, useRef, useState } from '@wordpress/element';
import { useNavigate, useLocation } from 'react-router-dom';
import Library from './screens/Library';
import Editor from './screens/Editor';
import Settings from './screens/Settings';
import Analytics from './screens/Analytics';
import Playlists from './screens/Playlists';
import Presets from './screens/Presets';
import Dashboard from './screens/Dashboard';
import { Icon } from './components/icons';
import Header from './components/Header';
import { ConfirmModal } from './components/UI';
import { isPro } from './pro';
import { parseRoute, routeUrl, PAGE_OF } from './nav';

const NAV = [
	{ key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
	{ key: 'library', label: 'Videos', icon: 'video' },
	{ key: 'playlists', label: 'Playlists', icon: 'playlist' },
	{ key: 'presets', label: 'Presets', icon: 'presets' },
	{ key: 'settings', label: 'Settings', icon: 'settings' },
];

const PURCHASE = ( typeof window !== 'undefined' && window.TruePlayerGlobal && window.TruePlayerGlobal.purchase_url ) || 'https://kodezen.com/trueplayer';

export default function App() {
	const navigate = useNavigate();
	const location = useLocation();
	const route = parseRoute( location.search );

	// The currently-mounted editing screen (video Editor, Settings, or a
	// Playlists/Presets sub-editor) reports { title, dirty, onBack, onTitleChange }
	// here so the breadcrumb and the unsaved-changes guard can reach it without
	// prop-drilling through every screen in between.
	const [ editState, setEditState ] = useState( null );
	const [ confirmNav, setConfirmNav ] = useState( null ); // pending navigation, blocked by unsaved changes
	const dirty = editState?.dirty ?? false;

	// Native prompt for hard navigation (browser back/refresh/close) — everything
	// that stays inside the app goes through requestNav()/go() below instead, which
	// never reloads the page.
	useEffect( () => {
		const onBeforeUnload = ( e ) => {
			if ( dirty ) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener( 'beforeunload', onBeforeUnload );
		return () => window.removeEventListener( 'beforeunload', onBeforeUnload );
	}, [ dirty ] );

	// Every in-app navigation (routes and "back to list" alike) funnels through here
	// so a dirty editing screen always gets a chance to warn before it's lost.
	const requestNav = ( run ) => {
		if ( dirty ) {
			setConfirmNav( () => run );
		} else {
			run();
		}
	};
	const go = ( name, params = {} ) => requestNav( () => navigate( routeUrl( name, params ) ) );

	// WordPress's own left-hand admin menu links to our pages are plain <a href>
	// tags outside React, so clicking them is normally a real page load. Hijack
	// those clicks and route them through go() instead, so the native menu is
	// just as "no reload" as the in-app breadcrumb/nav.
	const goRef = useRef( go );
	goRef.current = go;
	useEffect( () => {
		const menu = document.getElementById( 'adminmenu' );
		if ( ! menu ) {
			return;
		}
		const onMenuClick = ( e ) => {
			const a = e.target.closest( 'a' );
			const href = a && a.getAttribute( 'href' );
			const m = href && href.match( /[?&]page=([a-z0-9_-]+)/i );
			if ( ! m ) {
				return; // not one of our pages — let WP navigate normally
			}
			const name = Object.keys( PAGE_OF ).find( ( key ) => PAGE_OF[ key ] === m[ 1 ] );
			if ( ! name ) {
				return;
			}
			e.preventDefault();
			goRef.current( name );
		};
		menu.addEventListener( 'click', onMenuClick );
		return () => menu.removeEventListener( 'click', onMenuClick );
	}, [] );

	const crumbsFor = ( name ) => {
		const toVideos = { label: 'Videos', href: routeUrl( 'library' ), onClick: () => go( 'library' ) };
		switch ( name ) {
			case 'dashboard': return [ { label: 'Dashboard' } ];
			case 'library': return [ { label: 'Videos' } ];
			case 'editor': return [ toVideos, { label: editState?.title || 'Edit video', editable: !! editState, onChange: editState?.onTitleChange } ];
			case 'analytics': return [ toVideos, { label: 'Analytics' } ];
			case 'playlists': return editState
				? [ { label: 'Playlists', href: routeUrl( 'playlists' ), onClick: () => requestNav( editState.onBack ) }, { label: editState.title, editable: true, onChange: editState.onTitleChange } ]
				: [ { label: 'Playlists' } ];
			case 'presets': return editState
				? [ { label: 'Presets', href: routeUrl( 'presets' ), onClick: () => requestNav( editState.onBack ) }, { label: editState.title, editable: true, onChange: editState.onTitleChange } ]
				: [ { label: 'Presets' } ];
			case 'settings': return [ { label: 'Settings' } ];
			default: return [];
		}
	};

	return (
		<div className="tp-admin flex flex-col min-h-[calc(100vh-32px)] bg-gray-50 text-ink -ml-5 -mr-5">
			<Header
				homeHref={ routeUrl( 'dashboard' ) }
				onHomeClick={ () => go( 'dashboard' ) }
				crumbs={ crumbsFor( route.name ) }
			/>

			<div className="flex flex-1 min-h-0">
				{ route.name === 'editor' ? (
					<Editor id={ route.id } onEditState={ setEditState } />
				) : (
					<main className="flex-1 min-w-0">
						<div className="max-w-5xl mx-auto px-8 py-8">
							{ route.name === 'dashboard' && <Dashboard onNavigate={ go } /> }
							{ route.name === 'library' && <Library onEdit={ ( id ) => go( 'editor', { id } ) } onViewers={ ( id ) => go( 'analytics', { id } ) } /> }
							{ route.name === 'analytics' && <Analytics id={ route.id } onBack={ () => go( 'library' ) } /> }
							{ route.name === 'playlists' && <Playlists onEditState={ setEditState } /> }
							{ route.name === 'presets' && <Presets onEditState={ setEditState } /> }
							{ route.name === 'settings' && <Settings onEditState={ setEditState } /> }
						</div>
					</main>
				) }
			</div>

			{ confirmNav && (
				<ConfirmModal
					title="Unsaved changes"
					onCancel={ () => setConfirmNav( null ) }
					onConfirm={ () => { const run = confirmNav; setConfirmNav( null ); run(); } }
				>
					You have unsaved changes. If you leave now, they’ll be lost.
				</ConfirmModal>
			) }
		</div>
	);
}
