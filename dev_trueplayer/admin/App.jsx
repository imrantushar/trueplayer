import { useEffect, useRef, useState } from '@wordpress/element';
import Library from './screens/Library';
import Editor from './screens/Editor';
import Interactive from './screens/Interactive';
import Settings from './screens/Settings';
import Analytics from './screens/Analytics';
import Presets from './screens/Presets';
import Dashboard from './screens/Dashboard';
import Header from './components/Header';
import { Button, Modal } from './components/UI';
import { parseRoute, routeUrl, PAGE_OF } from './nav';

export default function App() {
	const [ route, setRoute ] = useState( () => parseRoute() );
	// Lifted from whichever screen is currently editing something (video Editor,
	// Settings, or Library/Presets' internal playlist/preset editors):
	// { title?, dirty, onBack?, onTitleChange? }. Drives the dynamic breadcrumb
	// crumb and the unsaved-changes guard below.
	const [ editState, setEditState ] = useState( null );
	const [ confirmNav, setConfirmNav ] = useState( null ); // pending navigation, blocked by unsaved changes
	const dirty = editState?.dirty ?? false;

	// WordPress applies the submenu's "current" highlight server-side, based on
	// the page actually requested — a pushState-only navigation (go(), including
	// native-menu clicks hijacked below) never touches it, so the sidebar can
	// keep pointing at a stale page while the app has already moved on. Keep it
	// in sync by hand whenever the route changes.
	const syncAdminMenuHighlight = ( name ) => {
		const menu = document.getElementById( 'adminmenu' );
		if ( ! menu ) {
			return;
		}
		const slug = PAGE_OF[ name ] || PAGE_OF.dashboard;
		menu.querySelectorAll( 'a.current' ).forEach( ( a ) => {
			a.classList.remove( 'current' );
			a.removeAttribute( 'aria-current' );
		} );
		menu.querySelectorAll( 'a[href*="page="]' ).forEach( ( a ) => {
			const m = ( a.getAttribute( 'href' ) || '' ).match( /[?&]page=([a-z0-9_-]+)/i );
			if ( m && m[ 1 ] === slug ) {
				a.classList.add( 'current' );
				a.setAttribute( 'aria-current', 'page' );
			}
		} );
	};

	useEffect( () => {
		const onPop = () => {
			const next = parseRoute();
			setRoute( next );
			syncAdminMenuHighlight( next.name );
		};
		window.addEventListener( 'popstate', onPop );
		return () => window.removeEventListener( 'popstate', onPop );
	}, [] );

	// Native prompt for hard navigation (browser back/refresh/close) — anything
	// that stays inside the app goes through requestNav()/go() below instead.
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

	// Every in-app navigation funnels through here so a dirty editing screen
	// always gets a chance to warn before it's lost.
	const requestNav = ( run ) => {
		if ( dirty ) {
			setConfirmNav( () => run );
		} else {
			run();
		}
	};

	// All of TruePlayer's WP admin pages (the top-level page and every submenu)
	// render the exact same PHP output (see includes/admin/menu.php — one
	// render_app callback for all of them), so every in-app navigation, same
	// section or not, is safely client-side — no reload needed.
	const go = ( name, params = {} ) => requestNav( () => {
		window.history.pushState( {}, '', routeUrl( name, params ) );
		setRoute( { name, ...params } );
		syncAdminMenuHighlight( name );
		window.scrollTo( 0, 0 );
	} );

	// WordPress's own left-hand admin menu links to our pages are plain <a href>
	// tags outside React, so clicking them is normally a real page load. Hijack
	// those clicks and route them through go() instead, so the native menu is
	// just as "no reload" (and just as dirty-guarded) as the in-app nav.
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
		const toMedia = { label: 'Media', onClick: () => go( 'library' ) };
		switch ( name ) {
			case 'dashboard': return [ { label: 'Dashboard' } ];
			case 'library': return editState
				? [ { label: 'Media', onClick: () => requestNav( editState.onBack ) }, { label: editState.title, editable: true, onChange: editState.onTitleChange } ]
				: [ { label: 'Media' } ];
			case 'playlists': return editState
				? [ { label: 'Media playlists', onClick: () => requestNav( editState.onBack ) }, { label: editState.title, editable: true, onChange: editState.onTitleChange } ]
				: [ { label: 'Media playlists' } ];
			case 'editor': return [ toMedia, { label: editState?.title || '', editable: true, onChange: editState?.onTitleChange } ];
			case 'analytics': return [ toMedia, { label: 'Analytics' } ];
			case 'interactive': return [ { label: 'Interactive' } ];
			case 'presets': return editState
				? [ { label: 'Presets', onClick: () => requestNav( editState.onBack ) }, { label: editState.title, editable: true, onChange: editState.onTitleChange } ]
				: [ { label: 'Presets' } ];
			case 'settings': return [ { label: 'Settings' } ];
			default: return [];
		}
	};

	// The only in-app sidebar is the video editor's step menu (opened from a
	// video's edit icon). Every other screen is full-width; top-level section
	// navigation lives in the WordPress admin submenu.
	return (
		<div className="tp-admin flex flex-col min-h-[calc(100vh-32px)] bg-body text-ink -ml-5">
			<Header crumbs={ crumbsFor( route.name ) } onHome={ () => go( 'dashboard' ) } />

			<div className="flex flex-1 min-h-0">
				{ route.name === 'editor' ? (
					// The editor renders its own contextual sidebar (its steps).
					<Editor id={ route.id } onEditState={ setEditState } />
				) : (
					<main className="flex-1 min-w-0">
						<div className="max-w-[1250px] mx-auto px-8 py-8">
							{ route.name === 'dashboard' && <Dashboard onNavigate={ go } /> }
							{ ( route.name === 'library' || route.name === 'playlists' ) && (
								<Library
									initialTab={ route.name === 'playlists' ? 'playlists' : 'videos' }
									onEdit={ ( id ) => go( 'editor', { id } ) }
									onViewers={ ( id ) => go( 'analytics', { id } ) }
									onEditState={ setEditState }
								/>
							) }
							{ route.name === 'analytics' && <Analytics id={ route.id } onBack={ () => go( 'library' ) } /> }
							{ route.name === 'interactive' && <Interactive /> }
							{ route.name === 'presets' && <Presets onEditState={ setEditState } /> }
							{ route.name === 'settings' && <Settings onEditState={ setEditState } /> }
						</div>
					</main>
				) }
			</div>

			{ confirmNav && (
				<Modal
					title="Unsaved changes"
					onClose={ () => setConfirmNav( null ) }
					footer={
						<>
							<Button variant="ghost" onClick={ () => setConfirmNav( null ) }>Keep editing</Button>
							<Button variant="danger" onClick={ () => { const run = confirmNav; setConfirmNav( null ); run(); } }>Discard changes</Button>
						</>
					}
				>
					You have unsaved changes. If you leave now, they’ll be lost.
				</Modal>
			) }
		</div>
	);
}
