import { useEffect, useState } from '@wordpress/element';
import { api } from '../api';
import { Button, Card, Input, Select, Field, Badge, Modal, Pagination, Thumb, sourceMeta } from '../components/UI';
import { Icon } from '../components/icons';
import { isPro } from '../pro';
import { PlaylistEditor } from './Playlists';

const VIDEO_TYPES = [
	{ value: 'self', label: 'Self-hosted (media library)' },
	{ value: 'youtube', label: 'YouTube' },
	{ value: 'vimeo', label: 'Vimeo' },
	{ value: 'url', label: 'External URL (mp4/webm)' },
	{ value: 'bunny', label: 'Bunny.net Stream', pro: true },
	{ value: 'mux', label: 'Mux', pro: true },
	{ value: 'hls', label: 'HLS stream (.m3u8)', pro: true },
];

const PER_PAGE = 10;

export default function Library( { onEdit, onViewers, initialTab = 'videos' } ) {
	const [ tab, setTab ] = useState( initialTab === 'playlists' ? 'playlists' : 'videos' );
	const [ videos, setVideos ] = useState( null );
	const [ playlists, setPlaylists ] = useState( null );
	const [ editingPlaylist, setEditingPlaylist ] = useState( null );
	const [ videoPage, setVideoPage ] = useState( 1 );
	const [ playlistPage, setPlaylistPage ] = useState( 1 );

	// Add modal (shared): kind = video | playlist.
	const [ modal, setModal ] = useState( null ); // null | 'video' | 'playlist'
	const [ title, setTitle ] = useState( '' );
	const [ type, setType ] = useState( 'self' );
	const [ busy, setBusy ] = useState( false );

	const loadVideos = () => api.listVideos().then( setVideos );
	const loadPlaylists = () => api.listPlaylists().then( setPlaylists );
	useEffect( () => { loadVideos(); loadPlaylists(); }, [] );

	const openModal = ( kind ) => { setTitle( '' ); setType( 'self' ); setModal( kind ); };

	const create = async () => {
		setBusy( true );
		try {
			if ( modal === 'video' ) {
				const v = await api.createVideo( title || 'Untitled video', { source: { type } } );
				setModal( null );
				await loadVideos();
				onEdit( v.id );
			} else {
				const p = await api.createPlaylist( title || 'Untitled playlist' );
				setModal( null );
				await loadPlaylists();
				setEditingPlaylist( p );
			}
		} finally {
			setBusy( false );
		}
	};

	const removeVideo = async ( id ) => {
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( 'Delete this video?' ) ) return;
		await api.deleteVideo( id );
		loadVideos();
	};
	const removePlaylist = async ( id ) => {
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( 'Delete this playlist?' ) ) return;
		await api.deletePlaylist( id );
		loadPlaylists();
	};

	const [ copied, setCopied ] = useState( null );
	const copy = ( id, sc ) => {
		if ( navigator.clipboard ) {
			navigator.clipboard.writeText( sc );
			setCopied( id );
			setTimeout( () => setCopied( ( c ) => ( c === id ? null : c ) ), 1500 );
		}
	};

	// Editing a playlist takes over the screen.
	if ( editingPlaylist ) {
		return (
			<PlaylistEditor
				playlist={ editingPlaylist }
				videos={ videos || [] }
				onBack={ () => { setEditingPlaylist( null ); loadPlaylists(); } }
				onSaved={ loadPlaylists }
			/>
		);
	}

	const byId = Object.fromEntries( ( videos || [] ).map( ( v ) => [ v.id, v ] ) );
	const addLabel = tab === 'videos' ? 'Add media' : 'Add playlist';

	// Client-side pagination (all items are already loaded for the pickers).
	const videoPages = videos ? Math.max( 1, Math.ceil( videos.length / PER_PAGE ) ) : 1;
	const vPage = Math.min( videoPage, videoPages );
	const pagedVideos = videos ? videos.slice( ( vPage - 1 ) * PER_PAGE, vPage * PER_PAGE ) : null;

	const playlistPages = playlists ? Math.max( 1, Math.ceil( playlists.length / PER_PAGE ) ) : 1;
	const pPage = Math.min( playlistPage, playlistPages );
	const pagedPlaylists = playlists ? playlists.slice( ( pPage - 1 ) * PER_PAGE, pPage * PER_PAGE ) : null;

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Media</h1>
					<p className="text-sm text-muted">Watch-verified video &amp; audio players and playlists.</p>
				</div>
				<Button onClick={ () => openModal( tab === 'videos' ? 'video' : 'playlist' ) }>
					<Icon name="plus" className="w-4 h-4" /> { addLabel }
				</Button>
			</div>

			{ /* Filter: videos vs playlists */ }
			<div className="inline-flex p-0.5 mb-6 rounded bg-gray-100">
				{ [ [ 'videos', 'Media' ], [ 'playlists', 'Playlists' ] ].map( ( [ key, label ] ) => (
					<button
						key={ key }
						onClick={ () => setTab( key ) }
						className={ `px-4 py-1.5 rounded text-sm font-medium transition-colors ${ tab === key ? 'bg-white text-brand-500 shadow-sm' : 'text-muted hover:text-ink' }` }
					>
						{ label }
					</button>
				) ) }
			</div>

			{ modal && (
				<Modal
					title={ modal === 'video' ? 'Add media' : 'Add playlist' }
					onClose={ () => setModal( null ) }
					footer={
						<>
							<Button variant="ghost" onClick={ () => setModal( null ) }>Cancel</Button>
							<Button onClick={ create } disabled={ busy }>{ busy ? 'Creating…' : 'Create & edit' }</Button>
						</>
					}
				>
					<Field label={ modal === 'video' ? 'Media title' : 'Playlist title' }>
						<Input autoFocus value={ title } onChange={ ( e ) => setTitle( e.target.value ) } onKeyDown={ ( e ) => e.key === 'Enter' && create() } placeholder={ modal === 'video' ? 'e.g. Lesson 1' : 'e.g. Onboarding course' } />
					</Field>
					{ modal === 'video' && (
						<Field label="Media type" hint={ isPro() ? 'Change the source details in the editor.' : 'Bunny / Mux / HLS need TruePlayer Pro.' }>
							<Select value={ type } onChange={ ( e ) => setType( e.target.value ) }>
								{ VIDEO_TYPES.map( ( t ) => (
									<option key={ t.value } value={ t.value } disabled={ t.pro && ! isPro() }>
										{ t.label }{ t.pro && ! isPro() ? ' (Pro)' : '' }
									</option>
								) ) }
							</Select>
						</Field>
					) }
				</Modal>
			) }

			{ tab === 'videos' && (
				<>
					<VideoList
						videos={ pagedVideos }
						copied={ copied }
						copy={ copy }
						onEdit={ onEdit }
						onViewers={ onViewers }
						onRemove={ removeVideo }
						onAdd={ () => openModal( 'video' ) }
					/>
					<Pagination page={ vPage } pages={ videoPages } onPage={ setVideoPage } />
				</>
			) }

			{ tab === 'playlists' && (
				<>
					<PlaylistList
						playlists={ pagedPlaylists }
						byId={ byId }
						onEdit={ setEditingPlaylist }
						onRemove={ removePlaylist }
						onAdd={ () => openModal( 'playlist' ) }
					/>
					<Pagination page={ pPage } pages={ playlistPages } onPage={ setPlaylistPage } />
				</>
			) }
		</div>
	);
}

function RowActions( { children } ) {
	return <div className="flex items-center gap-1">{ children }</div>;
}
function IconBtn( { name, title, onClick, danger } ) {
	return (
		<button onClick={ onClick } title={ title } aria-label={ title } className={ `p-2 rounded text-muted hover:bg-gray-100 ${ danger ? 'hover:text-danger hover:bg-danger-light' : 'hover:text-brand-500' }` }>
			<Icon name={ name } className="w-[18px] h-[18px]" />
		</button>
	);
}

function VideoList( { videos, copied, copy, onEdit, onViewers, onRemove, onAdd } ) {
	if ( videos === null ) {
		return (
			<div className="space-y-3">
				{ [ 0, 1, 2 ].map( ( i ) => (
					<Card key={ i } className="p-4 flex items-center gap-4">
						<div className="w-24 aspect-video rounded bg-gray-100 animate-pulse shrink-0" />
						<div className="flex-1 space-y-2"><div className="h-4 w-1/3 bg-gray-100 rounded animate-pulse" /><div className="h-3 w-1/4 bg-gray-100 rounded animate-pulse" /></div>
					</Card>
				) ) }
			</div>
		);
	}
	if ( videos.length === 0 ) {
		return (
			<Card className="p-12 text-center border-dashed">
				<div className="mx-auto mb-3 w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center"><Icon name="video" className="w-6 h-6" /></div>
				<p className="font-semibold text-gray-900">No media yet</p>
				<p className="text-sm text-muted mb-4">Create your first watch-verified player.</p>
				<Button onClick={ onAdd }><Icon name="plus" className="w-4 h-4" /> Add media</Button>
			</Card>
		);
	}
	return (
		<div className="space-y-3">
			{ videos.map( ( v ) => {
				const src = v.config?.source || {};
				const g = v.config?.gating || {};
				const hasQuiz = ( g.checkpoints?.length || 0 ) > 0 || !! g.finalQuiz;
				const chapters = v.config?.chapters?.length || 0;
				const meta = sourceMeta( src );
				return (
					<Card key={ v.id } className="p-3 flex items-center gap-4 hover:border-brand-200 transition-colors">
						<Thumb poster={ src.poster } type={ src.mediaType === 'audio' ? 'audio' : src.type } />
						<div className="flex-1 min-w-0">
							<div className="font-semibold text-gray-900 truncate">{ v.title }</div>
							<div className="flex items-center flex-wrap gap-2 mt-1.5">
								<Badge tone={ meta.tone }>{ meta.label }</Badge>
								{ hasQuiz && <Badge tone="amber">quiz-gated</Badge> }
								{ chapters > 0 && <Badge>{ chapters } chapter{ chapters === 1 ? '' : 's' }</Badge> }
								<code className="text-xs text-muted cursor-pointer hover:text-brand-500" onClick={ () => copy( v.id, v.shortcode ) } title="Copy shortcode">
									{ copied === v.id ? 'Copied ✓' : v.shortcode }
								</code>
							</div>
						</div>
						<RowActions>
							<IconBtn name="analytics" title="Analytics" onClick={ () => onViewers( v.id ) } />
							<IconBtn name="edit" title="Edit video" onClick={ () => onEdit( v.id ) } />
							<IconBtn name="trash" title="Delete" danger onClick={ () => onRemove( v.id ) } />
						</RowActions>
					</Card>
				);
			} ) }
		</div>
	);
}

function PlaylistList( { playlists, byId, onEdit, onRemove, onAdd } ) {
	if ( playlists === null ) {
		return <p className="text-gray-400">Loading…</p>;
	}
	if ( playlists.length === 0 ) {
		return (
			<Card className="p-12 text-center border-dashed">
				<div className="mx-auto mb-3 w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center"><Icon name="playlist" className="w-6 h-6" /></div>
				<p className="font-semibold text-gray-900">No playlists yet</p>
				<p className="text-sm text-muted mb-4">Group videos into a grid or sidebar playlist.</p>
				<Button onClick={ onAdd }><Icon name="plus" className="w-4 h-4" /> Add playlist</Button>
			</Card>
		);
	}
	return (
		<div className="space-y-3">
			{ playlists.map( ( p ) => {
				const ids = p.config?.videos || [];
				const first = ids.map( ( id ) => byId[ id ] ).find( Boolean );
				const src = first?.config?.source || {};
				return (
					<Card key={ p.id } className="p-3 flex items-center gap-4 hover:border-brand-200 transition-colors">
						<Thumb poster={ src.poster } type={ src.mediaType === 'audio' ? 'audio' : src.type } />
						<div className="flex-1 min-w-0">
							<div className="font-semibold text-ink truncate">{ p.title }</div>
							<div className="flex items-center flex-wrap gap-2 mt-1.5">
								<Badge tone="brand">{ p.config?.layout || 'sidebar' }</Badge>
								<Badge>{ ids.length } video{ ids.length === 1 ? '' : 's' }</Badge>
								{ p.config?.autoplayNext && <Badge tone="green">autoplay</Badge> }
								<code className="text-xs text-muted">{ p.shortcode }</code>
							</div>
						</div>
						<RowActions>
							<IconBtn name="edit" title="Edit playlist" onClick={ () => onEdit( p ) } />
							<IconBtn name="trash" title="Delete" danger onClick={ () => onRemove( p.id ) } />
						</RowActions>
					</Card>
				);
			} ) }
		</div>
	);
}
