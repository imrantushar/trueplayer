import { useEffect, useState } from '@wordpress/element';
import { api } from '../api';
import { Card, Button, Input, Select, Toggle, Badge, Field, Thumb, sourceMeta } from '../components/UI';

function Editor( { playlist, videos, onBack, onSaved } ) {
	const [ title, setTitle ] = useState( playlist.title );
	const [ config, setConfig ] = useState( { layout: 'sidebar', videos: [], autoplayNext: true, showTitles: true, ...( playlist.config || {} ) } );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );

	const set = ( partial ) => setConfig( ( c ) => ( { ...c, ...partial } ) );
	const selected = config.videos || [];
	const byId = Object.fromEntries( videos.map( ( v ) => [ v.id, v ] ) );
	const available = videos.filter( ( v ) => ! selected.includes( v.id ) );

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

	const save = async () => {
		setSaving( true );
		try {
			await api.updatePlaylist( playlist.id, { title, config } );
			setSaved( true );
			setTimeout( () => setSaved( false ), 2000 );
			onSaved();
		} finally {
			setSaving( false );
		}
	};

	return (
		<div>
			<div className="flex items-center gap-3 mb-6">
				<Button variant="ghost" onClick={ onBack }>← Back</Button>
				<input className="flex-1 text-2xl font-bold text-ink bg-transparent outline-none border-b border-transparent focus:border-line" value={ title } onChange={ ( e ) => setTitle( e.target.value ) } />
				{ saved && <span className="text-sm text-green-600">Saved ✓</span> }
				<Button onClick={ save } disabled={ saving }>{ saving ? 'Saving…' : 'Save' }</Button>
			</div>

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
					<p className="text-sm text-gray-500 mb-3">{ selected.length } selected · drag order with the arrows.</p>
					<div className="space-y-2 mb-4">
						{ selected.map( ( id, i ) => (
							<div key={ id } className="flex items-center gap-2 border border-line rounded-md p-2">
								<span className="text-xs text-gray-400 w-5">{ i + 1 }</span>
								<span className="flex-1 text-sm truncate">{ byId[ id ]?.title || `#${ id }` }</span>
								<button className="text-gray-400 hover:text-ink px-1" onClick={ () => move( i, -1 ) }>↑</button>
								<button className="text-gray-400 hover:text-ink px-1" onClick={ () => move( i, 1 ) }>↓</button>
								<Button variant="danger" size="sm" onClick={ () => remove( id ) }>×</Button>
							</div>
						) ) }
						{ selected.length === 0 && <p className="text-sm text-gray-400">No videos yet — add from below.</p> }
					</div>
					<p className="text-[13px] font-medium text-ink mb-2">Add a video</p>
					<div className="space-y-1 max-h-64 overflow-y-auto">
						{ available.map( ( v ) => {
							const meta = sourceMeta( v.config?.source || {} );
							return (
								<button key={ v.id } className="flex items-center gap-2 w-full text-left border border-line rounded-md p-2 hover:bg-gray-50" onClick={ () => add( v.id ) }>
									<span className="text-brand-600">＋</span>
									<span className="flex-1 text-sm truncate">{ v.title }</span>
									<Badge tone={ meta.tone }>{ meta.label }</Badge>
								</button>
							);
						} ) }
						{ available.length === 0 && <p className="text-sm text-gray-400">All videos added.</p> }
					</div>
				</Card>
			</div>
		</div>
	);
}

export default function Playlists() {
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
		return <Editor playlist={ editing } videos={ videos } onBack={ () => { setEditing( null ); load(); } } onSaved={ load } />;
	}

	const byId = Object.fromEntries( videos.map( ( v ) => [ v.id, v ] ) );

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-ink">Playlists</h1>
				<p className="text-sm text-gray-500">Group videos into a grid or sidebar playlist.</p>
			</div>

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
		</div>
	);
}
