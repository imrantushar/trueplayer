import { useEffect, useState } from '@wordpress/element';
import Library from './screens/Library';
import Editor from './screens/Editor';
import Settings from './screens/Settings';
import Analytics from './screens/Analytics';
import Presets from './screens/Presets';
import Dashboard from './screens/Dashboard';
import Header from './components/Header';
import { parseRoute, routeUrl, PAGE_OF, currentPage } from './nav';

const TITLES = {
	dashboard: 'Dashboard',
	library: 'Media',
	editor: 'Edit media',
	analytics: 'Analytics',
	playlists: 'Media playlists',
	presets: 'Presets',
	settings: 'Settings',
};

export default function App() {
	const [ route, setRoute ] = useState( () => parseRoute() );

	useEffect( () => {
		const onPop = () => setRoute( parseRoute() );
		window.addEventListener( 'popstate', onPop );
		return () => window.removeEventListener( 'popstate', onPop );
	}, [] );

	// Same section → client-side (pushState); different section → the WP page.
	const go = ( name, params = {} ) => {
		const url = routeUrl( name, params );
		if ( PAGE_OF[ name ] === currentPage() ) {
			window.history.pushState( {}, '', url );
			setRoute( { name, ...params } );
			window.scrollTo( 0, 0 );
		} else {
			window.location.href = url;
		}
	};

	// The only in-app sidebar is the video editor's step menu (opened from a
	// video's edit icon). Every other screen is full-width; top-level section
	// navigation lives in the WordPress admin submenu.
	return (
		<div className="tp-admin flex flex-col min-h-[calc(100vh-32px)] bg-body text-ink -ml-5 -mr-5">
			<Header title={ route.name === 'editor' ? '' : TITLES[ route.name ] } />

			<div className="flex flex-1 min-h-0">
				{ route.name === 'editor' ? (
					// The editor renders its own contextual sidebar (its steps).
					<Editor id={ route.id } onBack={ () => go( 'library' ) } />
				) : (
					<main className="flex-1 min-w-0">
						<div className="max-w-6xl mx-auto px-8 py-8">
							{ route.name === 'dashboard' && <Dashboard onNavigate={ go } /> }
							{ ( route.name === 'library' || route.name === 'playlists' ) && <Library initialTab={ route.name === 'playlists' ? 'playlists' : 'videos' } onEdit={ ( id ) => go( 'editor', { id } ) } onViewers={ ( id ) => go( 'analytics', { id } ) } /> }
							{ route.name === 'analytics' && <Analytics id={ route.id } onBack={ () => go( 'library' ) } /> }
							{ route.name === 'presets' && <Presets /> }
							{ route.name === 'settings' && <Settings /> }
						</div>
					</main>
				) }
			</div>
		</div>
	);
}
