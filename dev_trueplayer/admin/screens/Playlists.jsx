import { useEffect, useState, createPortal } from '@wordpress/element';
import { api } from '../api';
import { Card, Button, Input, Select, Toggle, Badge, Field, Thumb, sourceMeta } from '../components/UI';

function Editor( { playlist, videos, onBack, onSaved, onEditState } ) {
	const [ title, setTitle ] = useState( playlist.title );
	const [ config, setConfig ] = useState( { layout: 'sidebar', videos: [], autoplayNext: true, showTitles: true, ...( playlist.config || {} ) } );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );
	const [ dirty, setDirty ] = useState( false );
	const [ toolbarSlot, setToolbarSlot ] = useState( null );

	const [ adding, setAdding ] = useState( false );
	const [ query, setQuery ] = useState( '' );
	const [ dragIndex, setDragIndex ] = useState( null );
	const [ overIndex, setOverIndex ] = useState( null );

	useEffect( () => {
		setToolbarSlot( document.getElementById( 'tp-topbar-slot' ) );
	}, [] );

	const setTitleDirty = ( v ) => { setTitle( v ); setDirty( true ); };

	// Report title/dirty/back state up to the app shell — it drives the breadcrumb
	// (title next to "Playlists") and the unsaved-changes guard when leaving.
	useEffect( () => {
		onEditState && onEditState( { title, dirty, onBack, onTitleChange: setTitleDirty } );
	}, [ title, dirty ] );
	useEffect( () => () => onEditState && onEditState( null ), [] );

	const set = ( partial ) => { setConfig( ( c ) => ( { ...c, ...partial } ) ); setDirty( true ); };
	const selected = config.videos || [];
	const byId = Object.fromEntries( videos.map( ( v ) => [ v.id, v ] ) );
	// Videos not already in the playlist, filtered by the search box.
	const available = videos.filter( ( v ) => ! selected.includes( v.id ) );
	const results = available.filter( ( v ) => ( v.title || '' ).toLowerCase().includes( query.trim().toLowerCase() ) );

	const add = ( id ) => set( { videos: [ ...selected, id ] } );
	const remove = ( id ) => set( { videos: selected.filter( ( x ) => x !== id ) } );
	const move = ( i, dir ) => {
		const next = [ ...selected ];
		const j = i + dir;
		if ( j < 0 || j >= next.length ) {
			return;
		}
		[ next[ i ], next[ j ] ] = [ next[ j ], next[ i ] ];
		set( { videos: next } );
	};
	const reorder = ( from, to ) => {
		if ( from === null || to === null || from === to ) {
			return;
		}
		const next = [ ...selected ];
		const [ moved ] = next.splice( from, 1 );
		next.splice( to, 0, moved );
		set( { videos: next } );
	};

	const save = async () => {
		setSaving( true );
		try {
			await api.updatePlaylist( playlist.id, { title, config } );
			setDirty( false );
			setSaved( true );
			setTimeout( () => setSaved( false ), 2000 );
			onSaved();
		} finally {
			setSaving( false );
		}
	};

	return (
		<div>
			{ /* Save lives in the topbar (portaled) — same pattern as the video editor. */ }
			{ toolbarSlot && createPortal(
				<>
					{ saved && <span className="text-sm text-green-600">Saved ✓</span> }
					<Button onClick={ save } disabled={ saving || ! dirty }>{ saving ? 'Saving…' : 'Save' }</Button>
				</>,
				toolbarSlot
			) }

			<div className="grid md:grid-cols-2 gap-6">
				<Card className="p-6">
					<h3 className="font-semibold text-ink mb-4">Playlist settings</h3>
					<Field label="Layout">
						<Select value={ config.layout } onChange={ ( e ) => set( { layout: e.target.value } ) }>
							<option value="sidebar">Sidebar (player + list)</option>
							<option value="grid">Grid (cards)</option>
						</Select>
					</Field>
					<Toggle checked={ config.autoplayNext } onChange={ ( v ) => set( { autoplayNext: v } ) } label="Autoplay the next video" />
					<Toggle checked={ config.showTitles } onChange={ ( v ) => set( { showTitles: v } ) } label="Show video titles" />
					<div className="mt-4 pt-4 border-t border-line">
						<p className="text-[13px] font-medium text-ink mb-1">Embed</p>
						<code className="text-xs bg-gray-100 rounded px-2 py-1">{ playlist.shortcode }</code>
					</div>
				</Card>

				<Card className="p-6">
					<h3 className="font-semibold text-ink mb-1">Videos in this playlist</h3>
					<p className="text-sm text-gray-500 mb-3">{ selected.length } selected · drag to reorder.</p>
					<div className="space-y-2 mb-4">
						{ selected.map( ( id, i ) => {
							const meta = sourceMeta( byId[ id ]?.config?.source || {} );
							return (
								<div
									key={ id }
									draggable
									onDragStart={ () => setDragIndex( i ) }
									onDragOver={ ( e ) => { e.preventDefault(); if ( overIndex !== i ) setOverIndex( i ); } }
									onDrop={ () => { reorder( dragIndex, i ); setDragIndex( null ); setOverIndex( null ); } }
									onDragEnd={ () => { setDragIndex( null ); setOverIndex( null ); } }
									className={ `flex items-center gap-2 border rounded-md p-2 bg-white transition ${ overIndex === i && dragIndex !== i ? 'border-brand-400 ring-2 ring-brand-100' : 'border-line' } ${ dragIndex === i ? 'opacity-50' : '' }` }
								>
									<span className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none px-0.5" title="Drag to reorder" aria-hidden="true">⠿</span>
									<span className="text-xs text-gray-400 w-4 text-center">{ i + 1 }</span>
									<span className="flex-1 text-sm truncate">{ byId[ id ]?.title || `#${ id }` }</span>
									<Badge tone={ meta.tone }>{ meta.label }</Badge>
									<div className="flex">
										<button className="text-gray-300 hover:text-ink px-1" title="Move up" onClick={ () => move( i, -1 ) }>↑</button>
										<button className="text-gray-300 hover:text-ink px-1" title="Move down" onClick={ () => move( i, 1 ) }>↓</button>
									</div>
									<Button variant="danger" size="sm" onClick={ () => remove( id ) }>×</Button>
								</div>
							);
						} ) }
						{ selected.length === 0 && <p className="text-sm text-gray-400">No videos yet — add one below.</p> }
					</div>

					{ ! adding ? (
						<Button variant="subtle" onClick={ () => { setAdding( true ); setQuery( '' ); } }>+ Add video</Button>
					) : (
						<div className="border border-line rounded-md p-2">
							<Input autoFocus placeholder="Search videos to add…" value={ query } onChange={ ( e ) => setQuery( e.target.value ) } />
							<div className="space-y-1 max-h-56 overflow-y-auto mt-2">
								{ results.map( ( v ) => {
									const meta = sourceMeta( v.config?.source || {} );
									return (
										<button key={ v.id } className="flex items-center gap-2 w-full text-left rounded-md p-2 hover:bg-gray-50" onClick={ () => { add( v.id ); setQuery( '' ); } }>
											<span className="text-brand-600">＋</span>
											<span className="flex-1 text-sm truncate">{ v.title }</span>
											<Badge tone={ meta.tone }>{ meta.label }</Badge>
										</button>
									);
								} ) }
								{ results.length === 0 && (
									<p className="text-sm text-gray-400 px-2 py-3">{ available.length === 0 ? 'All videos are already in this playlist.' : 'No videos match your search.' }</p>
								) }
							</div>
							<div className="flex justify-end mt-2 pt-2 border-t border-line">
								<Button variant="ghost" size="sm" onClick={ () => { setAdding( false ); setQuery( '' ); } }>Done</Button>
							</div>
						</div>
					) }
				</Card>
			</div>
		</div>
	);
}

export default function Playlists( { onEditState } ) {
	const [ playlists, setPlaylists ] = useState( null );
	const [ videos, setVideos ] = useState( [] );
	const [ title, setTitle ] = useState( '' );
	const [ editing, setEditing ] = useState( null );

	const load = () => api.listPlaylists().then( setPlaylists );
	useEffect( () => { load(); api.listVideos().then( setVideos ); }, [] );

	const create = async () => {
		const p = await api.createPlaylist( title || 'Untitled playlist' );
		setTitle( '' );
		await load();
		setEditing( p );
	};
	const remove = async ( id ) => {
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( 'Delete this playlist?' ) ) {
			return;
		}
		await api.deletePlaylist( id );
		load();
	};

	if ( editing ) {
		return <Editor playlist={ editing } videos={ videos } onBack={ () => { setEditing( null ); load(); } } onSaved={ load } onEditState={ onEditState } />;
	}

	const byId = Object.fromEntries( videos.map( ( v ) => [ v.id, v ] ) );

	return (
		<>
			<h1 className="text-2xl font-bold text-ink">Playlists</h1>

			<Card className="p-4 mb-6 flex gap-3 items-center">
				<Input placeholder="New playlist title…" value={ title } onChange={ ( e ) => setTitle( e.target.value ) } onKeyDown={ ( e ) => e.key === 'Enter' && create() } />
				<Button onClick={ create }>+ Create playlist</Button>
			</Card>

			{ playlists === null && <p className="text-gray-400">Loading…</p> }
			{ playlists && playlists.length === 0 && (
				<Card className="p-12 text-center border-dashed">
					<div className="mx-auto mb-3 w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center">
						<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M4 6h11v2H4V6zm0 5h11v2H4v-2zm0 5h7v2H4v-2zm13-5l5 3-5 3v-6z" /></svg>
					</div>
					<p className="font-semibold text-gray-900">No playlists yet</p>
					<p className="text-sm text-gray-500">Group videos into a course sequence or a grid above.</p>
				</Card>
			) }

			<div className="space-y-3">
				{ ( playlists || [] ).map( ( p ) => {
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
									<code className="text-xs text-gray-500">{ p.shortcode }</code>
								</div>
							</div>
							<Button variant="ghost" onClick={ () => setEditing( p ) }>Edit</Button>
							<Button variant="danger" onClick={ () => remove( p.id ) }>Delete</Button>
						</Card>
					);
				} ) }
			</div>
		</>
	);
}
