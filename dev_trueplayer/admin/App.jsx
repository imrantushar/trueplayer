import { useEffect, useState } from '@wordpress/element';
import Library from './screens/Library';
import Editor from './screens/Editor';
import Settings from './screens/Settings';
import Analytics from './screens/Analytics';
import Playlists from './screens/Playlists';
import Presets from './screens/Presets';
import Dashboard from './screens/Dashboard';
import { Icon } from './components/icons';
import Header from './components/Header';
import { isPro } from './pro';
import { parseRoute, routeUrl, PAGE_OF, currentPage } from './nav';

const NAV = [
	{ key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
	{ key: 'library', label: 'Videos', icon: 'video' },
	{ key: 'playlists', label: 'Playlists', icon: 'playlist' },
	{ key: 'presets', label: 'Presets', icon: 'presets' },
	{ key: 'settings', label: 'Settings', icon: 'settings' },
];

const TITLES = {
	dashboard: 'Dashboard',
	library: 'Videos',
	editor: 'Edit video',
	analytics: 'Analytics',
	playlists: 'Playlists',
	presets: 'Presets',
	settings: 'Settings',
};

const PURCHASE = ( typeof window !== 'undefined' && window.TruePlayerGlobal && window.TruePlayerGlobal.purchase_url ) || 'https://kodezen.com/trueplayer';

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

	const activeKey = [ 'editor', 'analytics' ].includes( route.name ) ? 'library' : route.name;

	return (
		<div className="tp-admin flex flex-col min-h-[calc(100vh-32px)] bg-gray-50 text-ink -ml-5 -mr-5">
			<Header title={ TITLES[ route.name ] } />

			<div className="flex flex-1 min-h-0">
				{ route.name === 'editor' ? (
					// The editor gets a contextual sidebar (its own steps) instead of
					// the main nav — see Editor's own <aside>.
					<Editor id={ route.id } onBack={ () => go( 'library' ) } />
				) : (
					<>
						{ /* Content */ }
						<main className="flex-1 min-w-0">
							<div className="max-w-5xl mx-auto px-8 py-8">
								{ route.name === 'dashboard' && <Dashboard onNavigate={ go } /> }
								{ route.name === 'library' && <Library onEdit={ ( id ) => go( 'editor', { id } ) } onViewers={ ( id ) => go( 'analytics', { id } ) } /> }
								{ route.name === 'analytics' && <Analytics id={ route.id } onBack={ () => go( 'library' ) } /> }
								{ route.name === 'playlists' && <Playlists /> }
								{ route.name === 'presets' && <Presets /> }
								{ route.name === 'settings' && <Settings /> }
							</div>
						</main>
					</>
				) }
			</div>
		</div>
	);
}
