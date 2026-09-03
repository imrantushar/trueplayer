import { useEffect, useRef, useState } from '@wordpress/element';
import Library from './screens/Library';
import Editor from './screens/Editor';
import Settings from './screens/Settings';
import Analytics from './screens/Analytics';
import Presets from './screens/Presets';
import Dashboard from './screens/Dashboard';
import Header from './components/Header';
import { Button, Modal } from './components/UI';
import { parseRoute, routeUrl, PAGE_OF } from './nav';
import { __ } from '@Utils/translation';

export default function App() {
	const [ route, setRoute ] = useState( () => parseRoute() );
	// Lifted from whichever screen is currently editing something (video Editor,
	// Settings, or Library/Presets' internal playlist/preset editors):
	// { title?, dirty, onBack?, onTitleChange? }. Drives the dynamic breadcrumb
	// crumb and the unsaved-changes guard below.
	const [ editState, setEditState ] = useState( null );
	const [ confirmNav, setConfirmNav ] = useState( null ); // pending navigation, blocked by unsaved changes
	// A "create X" click from outside the library (the dashboard) — navigate to
	// the matching filter, then hand the kind to Library so it opens the dialog.
	const [ createIntent, setCreateIntent ] = useState( null );
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
		// WP marks the submenu <li> as current, not the <a> — clear both, or the
		// server-rendered highlight stays behind on the page we actually loaded.
		menu.querySelectorAll( 'li.current, a.current' ).forEach( ( el ) => {
			el.classList.remove( 'current' );
			el.removeAttribute( 'aria-current' );
		} );
		menu.querySelectorAll( 'a[href*="page="]' ).forEach( ( a ) => {
			const m = ( a.getAttribute( 'href' ) || '' ).match( /[?&]page=([a-z0-9_-]+)/i );
			if ( m && m[ 1 ] === slug ) {
				a.classList.add( 'current' );
				a.setAttribute( 'aria-current', 'page' );
				if ( a.parentElement ) {
					a.parentElement.classList.add( 'current' );
				}
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
		// Some screens keep their own sub-editor in internal state rather than in
		// the route — Presets edits a preset inside the Presets screen, Library
		// edits a playlist inside Library. Navigating to the section such an
		// editor already lives in leaves `route` unchanged, so nothing remounts
		// and the author stays in the editor with the guard dismissed and the
		// edits they just chose to discard still on screen. Ask the screen to
		// close it, which is what "go to Presets" means from inside a preset.
		if ( name === route.name && editState?.onBack ) {
			editState.onBack();
		}
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

	const goCreate = ( kind ) => {
		go( 'library', { kind } );
		setCreateIntent( kind );
	};

	const crumbsFor = ( name ) => {
		// `go('library')` with no kind falls back to the All filter, so this crumb
		// said "Media" and landed on All. The editor and the analytics screen are
		// only ever reached from a media row — playlists and interactive items are
		// edited inside the Library screen itself and come back through
		// editState.onBack, which keeps its own filter — so the crumb names the
		// filter it actually returns to.
		const toMedia = { label: __( 'Media' ), onClick: () => go( 'library', { kind: 'media' } ) };
		switch ( name ) {
			case 'dashboard': return [ { label: __( 'Dashboard' ) } ];
			case 'library': return editState
				? [ { label: __( 'Media' ), onClick: () => requestNav( editState.onBack ) }, { label: editState.title, editable: true, onChange: editState.onTitleChange } ]
				: [ { label: __( 'Media' ) } ];
			// Not editable: the title is a field in the editor's Source step now,
			// so the crumb is purely where-you-are, like every other crumb.
			case 'editor': return [ toMedia, { label: editState?.title || '' } ];
			case 'analytics': return [ toMedia, { label: __( 'Analytics' ) } ];
			case 'presets': return editState
				? [ { label: __( 'Presets' ), onClick: () => requestNav( editState.onBack ) }, { label: editState.title, editable: true, onChange: editState.onTitleChange } ]
				: [ { label: __( 'Presets' ) } ];
			case 'settings': return [ { label: __( 'Settings' ) } ];
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
					// The editor renders its own contextual sidebar (its steps). The
					// active step/sub-step ride in the URL too — replaceState, not
					// push, same reasoning as Settings below — so a reload lands back
					// on the step the author was on instead of Source.
					<Editor
						id={ route.id }
						tab={ route.tab }
						sub={ route.sub }
						onTabChange={ ( tab, sub ) => {
							window.history.replaceState( {}, '', routeUrl( 'editor', { id: route.id, tab, sub } ) );
							setRoute( ( r ) => ( { ...r, tab, sub } ) );
						} }
						onEditState={ setEditState }
					/>
				) : (
					<main className="flex-1 min-w-0">
						<div className="max-w-[1250px] mx-auto px-8 py-8">
							{ route.name === 'dashboard' && <Dashboard onNavigate={ go } onCreate={ goCreate } /> }
							{ route.name === 'library' && (
								<Library
									kind={ route.kind || 'all' }
									onEdit={ ( id ) => go( 'editor', { id } ) }
									onViewers={ ( id ) => go( 'analytics', { id } ) }
									onEditState={ setEditState }
									onNavigate={ go }
									createIntent={ createIntent }
									onCreateHandled={ () => setCreateIntent( null ) }
								/>
							) }
							{ /* Back lands on the same filter the Media crumb does — analytics
							     is reached from a media row, so All would drop the filter. */ }
							{ route.name === 'analytics' && <Analytics id={ route.id } onBack={ () => go( 'library', { kind: 'media' } ) } /> }
							{ route.name === 'presets' && <Presets onEditState={ setEditState } /> }
							{ /* The settings section rides in the URL, so a reload keeps it —
							     replaceState, not push, so switching sections doesn't bury the
							     page the user arrived from under a stack of back-button steps. */ }
							{ route.name === 'settings' && (
								<Settings
									tab={ route.tab || 'general' }
									onTabChange={ ( tab ) => {
										window.history.replaceState( {}, '', routeUrl( 'settings', { tab } ) );
										setRoute( ( r ) => ( { ...r, tab } ) );
									} }
									onEditState={ setEditState }
								/>
							) }
						</div>
					</main>
				) }
			</div>

			{ confirmNav && (
				<Modal
					title={ __( 'Unsaved changes' ) }
					onClose={ () => setConfirmNav( null ) }
					footer={
						<>
							<Button variant="ghost" onClick={ () => setConfirmNav( null ) }>{ __( 'Keep editing' ) }</Button>
							<Button variant="danger" onClick={ () => { const run = confirmNav; setConfirmNav( null ); run(); } }>{ __( 'Discard changes' ) }</Button>
						</>
					}
				>
					{ __( 'You have unsaved changes. If you leave now, they’ll be lost.' ) }
				</Modal>
			) }
		</div>
	);
}
