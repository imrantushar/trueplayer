import { useState } from '@wordpress/element';
import Library from './screens/Library';
import Editor from './screens/Editor';
import Settings from './screens/Settings';
import Analytics from './screens/Analytics';
import Playlists from './screens/Playlists';

const NAV = [
	{ key: 'library', label: 'Videos' },
	{ key: 'playlists', label: 'Playlists' },
	{ key: 'settings', label: 'Settings' },
];

export default function App() {
	const [ route, setRoute ] = useState( { name: 'library' } );

	const go = ( name, params = {} ) => setRoute( { name, ...params } );

	return (
		<div className="tp-admin min-h-screen bg-gray-50 -ml-5 -mt-5 pt-0">
			<header className="bg-white border-b border-line">
				<div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
					<div className="flex items-center gap-2 font-bold text-gray-900">
						<span className="inline-flex w-7 h-7 rounded bg-brand-500 text-white items-center justify-center text-sm">▶</span>
						TruePlayer
					</div>
					<nav className="flex gap-1">
						{ NAV.map( ( n ) => (
							<button
								key={ n.key }
								onClick={ () => go( n.key ) }
								className={ `px-3 py-1.5 rounded-md text-sm font-medium ${
									route.name === n.key || ( n.key === 'library' && [ 'editor', 'analytics' ].includes( route.name ) )
										? 'bg-brand-50 text-brand-700'
										: 'text-gray-600 hover:bg-gray-100'
								}` }
							>
								{ n.label }
							</button>
						) ) }
					</nav>
				</div>
			</header>

			<main className="max-w-7xl mx-auto px-6 py-8">
				{ route.name === 'library' && <Library onEdit={ ( id ) => go( 'editor', { id } ) } onViewers={ ( id ) => go( 'analytics', { id } ) } /> }
				{ route.name === 'editor' && <Editor id={ route.id } onBack={ () => go( 'library' ) } /> }
				{ route.name === 'analytics' && <Analytics id={ route.id } onBack={ () => go( 'library' ) } /> }
				{ route.name === 'playlists' && <Playlists /> }
				{ route.name === 'settings' && <Settings /> }
			</main>
		</div>
	);
}
