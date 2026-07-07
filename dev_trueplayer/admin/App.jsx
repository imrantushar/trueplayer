import { useEffect, useState } from '@wordpress/element';
import Library from './screens/Library';
import Editor from './screens/Editor';
import Settings from './screens/Settings';
import Analytics from './screens/Analytics';
import Playlists from './screens/Playlists';
import Presets from './screens/Presets';
import Dashboard from './screens/Dashboard';
import { parseRoute, routeUrl, PAGE_OF, currentPage } from './nav';

const TITLES = {
	dashboard: 'Dashboard',
	library: 'Videos',
	editor: 'Edit video',
	analytics: 'Analytics',
	playlists: 'Playlists',
	presets: 'Presets',
	settings: 'Settings',
};

export default function App() {
	const [ route, setRoute ] = useState( () => parseRoute() );

	// Back/forward buttons re-resolve from the URL.
	useEffect( () => {
		const onPop = () => setRoute( parseRoute() );
		window.addEventListener( 'popstate', onPop );
		return () => window.removeEventListener( 'popstate', onPop );
	}, [] );

	// Same section → client-side (pushState). Different section → real navigation
	// to that WP submenu page.
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

	return (
		<div className="tp-admin min-h-[calc(100vh-32px)] bg-gray-50 text-ink -ml-5 -mt-5 -mr-5">
			<header className="bg-white border-b border-line h-14 flex items-center px-6 gap-3">
				<span className="inline-flex w-8 h-8 rounded-lg bg-brand-500 text-white items-center justify-center shrink-0">
					<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
				</span>
				<span className="font-bold text-[15px] tracking-tight">TruePlayer</span>
				<span className="w-px h-5 bg-line mx-1" />
				<span className="text-sm font-medium text-gray-500">{ TITLES[ route.name ] || '' }</span>
			</header>

			<main className="max-w-6xl mx-auto px-8 py-8">
				{ route.name === 'dashboard' && <Dashboard onNavigate={ go } /> }
				{ route.name === 'library' && <Library onEdit={ ( id ) => go( 'editor', { id } ) } onViewers={ ( id ) => go( 'analytics', { id } ) } /> }
				{ route.name === 'editor' && <Editor id={ route.id } onBack={ () => go( 'library' ) } /> }
				{ route.name === 'analytics' && <Analytics id={ route.id } onBack={ () => go( 'library' ) } /> }
				{ route.name === 'playlists' && <Playlists /> }
				{ route.name === 'presets' && <Presets /> }
				{ route.name === 'settings' && <Settings /> }
			</main>
		</div>
	);
}
