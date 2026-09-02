import { useEffect, useState } from '@wordpress/element';
import { h5pEnabled } from '../h5p';
import { api } from '../api';
import { Card, Button, Thumb, Badge, sourceMeta } from '../components/UI';
import { Icon } from '../components/icons';
import { isPro } from '../pro';

const PURCHASE = ( typeof window !== 'undefined' && window.TruePlayerGlobal && window.TruePlayerGlobal.purchase_url ) || 'https://true-player.net/';

function Stat( { icon, label, value, tone = 'brand' } ) {
	const tones = {
		brand: 'bg-brand-50 text-brand-600',
		green: 'bg-green-100 text-green-600',
		amber: 'bg-amber-100 text-amber-600',
		gray: 'bg-gray-100 text-gray-500',
	};
	return (
		<Card className="p-5 flex items-center gap-4">
			<span className={ `w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ tones[ tone ] }` }><Icon name={ icon } className="w-5 h-5" /></span>
			<div className="min-w-0">
				<div className="text-2xl font-bold text-ink leading-none">{ value }</div>
				<div className="text-[13px] text-gray-500 mt-1 truncate">{ label }</div>
			</div>
		</Card>
	);
}

function QuickLink( { icon, label, onClick } ) {
	return (
		<button onClick={ onClick } className="flex items-center gap-3 w-full text-left rounded-lg p-2.5 hover:bg-gray-50 text-sm font-medium text-gray-700">
			<span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center"><Icon name={ icon } className="w-4 h-4" /></span>
			{ label }
		</button>
	);
}

// Interactive content is an opt-in addon; until it is enabled there is nothing
// to list or create, so the dashboard leaves it out entirely. Discovery lives
// on the library's Interactive tab, which shows an activation teaser instead.
const h5pAvailable = h5pEnabled;

export default function Dashboard( { onNavigate, onCreate } ) {
	const [ videos, setVideos ] = useState( null );
	const [ playlists, setPlaylists ] = useState( [] );
	const [ interactive, setInteractive ] = useState( [] );

	useEffect( () => {
		api.listVideos().then( setVideos ).catch( () => setVideos( [] ) );
		api.listPlaylists().then( setPlaylists ).catch( () => {} );
		if ( h5pAvailable() ) {
			api.h5pItems().then( setInteractive ).catch( () => {} );
		}
	}, [] );

	const vids = videos || [];
	const quizzed = vids.filter( ( v ) => {
		const g = v.config?.gating || {};
		return ( g.checkpoints?.length || 0 ) > 0 || !! g.finalQuiz;
	} ).length;
	const withChapters = vids.filter( ( v ) => ( v.config?.chapters?.length || 0 ) > 0 ).length;
	const recent = vids.slice( 0, 5 );

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-bold text-ink">Dashboard</h1>
					<p className="text-sm text-gray-500">Your watch-verified media library at a glance.</p>
				</div>
				<div className="flex gap-2">
					<Button variant="ghost" onClick={ () => onCreate( 'playlist' ) }>New playlist</Button>
					<Button onClick={ () => onCreate( 'media' ) }><Icon name="plus" className="w-4 h-4" /> New media</Button>
				</div>
			</div>

			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<Stat icon="video" label="Videos" value={ videos === null ? '—' : vids.length } tone="brand" />
				<Stat icon="playlist" label="Playlists" value={ playlists.length } tone="gray" />
				{ h5pAvailable()
					? <Stat icon="spark" label="Interactive" value={ interactive.length } tone="green" />
					: <Stat icon="check" label="Quiz-gated" value={ quizzed } tone="green" /> }
				<Stat icon="book" label="With chapters" value={ withChapters } tone="amber" />
			</div>

			<div className="grid lg:grid-cols-3 gap-6 items-start">
				<Card className="lg:col-span-2 p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="font-semibold text-ink">Recent media</h3>
						<button className="text-sm text-brand-600 font-medium hover:text-brand-700" onClick={ () => onNavigate( 'library' ) }>View all →</button>
					</div>
					{ videos === null && <p className="text-gray-400 text-sm">Loading…</p> }
					{ videos && recent.length === 0 && (
						<div className="text-center py-10 border border-dashed border-line rounded-lg">
							<div className="mx-auto mb-3 w-11 h-11 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center"><Icon name="video" className="w-5 h-5" /></div>
							<p className="text-sm text-gray-500 mb-3">No media yet — add your first one.</p>
							<Button className='mt-6' onClick={ () => onCreate( 'media' ) }>Create media</Button>
						</div>
					) }
					<div className="space-y-2">
						{ recent.map( ( v ) => {
							const src = v.config?.source || {};
							const meta = sourceMeta( src );
							return (
								<button key={ v.id } onClick={ () => onNavigate( 'editor', { id: v.id } ) } className="flex items-center gap-3 w-full text-left rounded-lg p-2 hover:bg-gray-50">
									<Thumb source={ src } type={ src.mediaType === 'audio' ? 'audio' : src.type } />
									<span className="flex-1 min-w-0">
										<span className="block font-medium text-sm text-ink truncate">{ v.title }</span>
										<span className="inline-flex mt-1"><Badge tone={ meta.tone }>{ meta.label }</Badge></span>
									</span>
								</button>
							);
						} ) }
					</div>
				</Card>

				<div className="space-y-6">
					<Card className="p-6">
						<h3 className="font-semibold text-ink mb-3">Quick start</h3>
						<div className="space-y-1">
							<QuickLink icon="video" label="Add a video" onClick={ () => onCreate( 'media' ) } />
							<QuickLink icon="playlist" label="Build a playlist" onClick={ () => onCreate( 'playlist' ) } />
							{ h5pAvailable() && <QuickLink icon="spark" label="Create interactive content" onClick={ () => onCreate( 'interactive' ) } /> }
							<QuickLink icon="settings" label="Player defaults" onClick={ () => onNavigate( 'settings' ) } />
						</div>
					</Card>
					{ ! isPro() && (
						<Card className="p-6 border-brand-100 bg-gradient-to-br from-brand-50 to-white">
							<div className="flex items-center gap-1.5 font-semibold text-ink"><Icon name="spark" className="w-4 h-4 text-brand-500" /> Unlock Pro</div>
							{ /* `!mb-` because admin/style.css zeroes UA spacing with `.tp-admin p
							     { margin: 0 }`, which outranks a plain `.mb-*` utility on both
							     specificity and source order — a bare `mb-2.5` here does nothing
							     at all. Same escape hatch the other screens use. */ }
							<p className="text-[13px] text-gray-600 mt-1.5 !mb-2.5 leading-snug">Prove students watched, gate with quizzes, and see deep analytics.</p>
							{ /* `hover:`/`focus:text-white` are load-bearing: WP admin styles every
							     anchor (`a:hover` → #135e96, `a:focus` → #043959), and those beat a
							     bare `.text-white`, so this button's label turned blue on the blue
							     fill the moment you pointed at it. */ }
							<a href={ PURCHASE } target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-white hover:text-white focus:text-white bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2">See Pro features</a>
						</Card>
					) }
				</div>
			</div>
		</div>
	);
}
