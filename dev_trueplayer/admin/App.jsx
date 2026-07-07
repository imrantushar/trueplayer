import { useState } from '@wordpress/element';
import Library from './screens/Library';
import Editor from './screens/Editor';
import Settings from './screens/Settings';
import Analytics from './screens/Analytics';
import Playlists from './screens/Playlists';
import Presets from './screens/Presets';
import Dashboard from './screens/Dashboard';
import { Icon } from './components/icons';
import { isPro } from './pro';

const NAV = [
	{ key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
	{ key: 'library', label: 'Videos', icon: 'video' },
	{ key: 'playlists', label: 'Playlists', icon: 'playlist' },
	{ key: 'presets', label: 'Presets', icon: 'presets' },
	{ key: 'settings', label: 'Settings', icon: 'settings' },
];

const PURCHASE = ( typeof window !== 'undefined' && window.TruePlayerGlobal && window.TruePlayerGlobal.purchase_url ) || 'https://kodezen.com/trueplayer';

export default function App() {
	const [ route, setRoute ] = useState( { name: 'dashboard' } );
	const go = ( name, params = {} ) => setRoute( { name, ...params } );
	const activeKey = [ 'editor', 'analytics' ].includes( route.name ) ? 'library' : route.name;

	return (
		<div className="tp-admin flex min-h-[calc(100vh-32px)] bg-gray-50 text-ink -ml-5 -mt-5">
			{ /* Sidebar */ }
			<aside className="w-56 shrink-0 bg-white border-r border-line flex flex-col">
				<div className="h-16 flex items-center gap-2.5 px-5 border-b border-line">
					<span className="inline-flex w-8 h-8 rounded-lg bg-brand-500 text-white items-center justify-center">
						<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
					</span>
					<span className="font-bold text-[15px] tracking-tight">TruePlayer</span>
				</div>
				<nav className="flex-1 p-3 space-y-1">
					{ NAV.map( ( n ) => (
						<button
							key={ n.key }
							onClick={ () => go( n.key ) }
							className={ `flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${ activeKey === n.key ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100' }` }
						>
							<Icon name={ n.icon } className="w-[18px] h-[18px]" />
							{ n.label }
						</button>
					) ) }
				</nav>
				{ ! isPro() && (
					<div className="m-3 p-4 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
						<div className="flex items-center gap-1.5 font-semibold text-sm"><Icon name="spark" className="w-4 h-4" /> TruePlayer Pro</div>
						<p className="text-xs text-white/80 mt-1 mb-3 leading-snug">Watch-verification, quizzes, deep analytics & content protection.</p>
						<a href={ PURCHASE } target="_blank" rel="noreferrer" className="block text-center text-xs font-semibold bg-white text-brand-700 rounded-md py-1.5 hover:bg-brand-50">Upgrade</a>
					</div>
				) }
			</aside>

			{ /* Content */ }
			<div className="flex-1 min-w-0">
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
		</div>
	);
}
