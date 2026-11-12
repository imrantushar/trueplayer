import { useState, useEffect, useRef, createPortal } from '@wordpress/element';
import { api } from '../api';
import { Icon } from '../components/icons';
import { Card, Button, Input, Select, Toggle, Badge, Field, sourceMeta } from '../components/UI';
import { BsTrash } from 'react-icons/bs';
import { __, __sprintf, _nSprintf } from '@Utils/translation';

const uid = () => Math.random().toString( 36 ).slice( 2, 9 );

// navigator.clipboard.writeText needs a secure context; fall back to the
// classic textarea + execCommand trick (e.g. plain-http local dev sites).
function legacyCopy( text ) {
	const ta = document.createElement( 'textarea' );
	ta.value = text;
	ta.style.position = 'fixed';
	ta.style.opacity = '0';
	document.body.appendChild( ta );
	ta.select();
	let ok = false;
	try {
		ok = document.execCommand( 'copy' );
	} catch ( e ) {
		ok = false;
	}
	document.body.removeChild( ta );
	return ok;
}

// The playlist editor, reused by the combined Videos screen (Library).
export function PlaylistEditor( { playlist, videos, onBack, onSaved, onEditState } ) {
	const [ title, setTitle ] = useState( playlist.title );
	const [ config, setConfig ] = useState( { layout: 'sidebar', videos: [], autoplayNext: true, showTitles: true, ...( playlist.config || {} ) } );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );
	const [ dirty, setDirty ] = useState( false );
	const [ toolbarSlot, setToolbarSlot ] = useState( null );
	const mounted = useRef( false );

	const [ adding, setAdding ] = useState( false );
	const [ query, setQuery ] = useState( '' );
	const [ dragIndex, setDragIndex ] = useState( null );
	const [ overIndex, setOverIndex ] = useState( null );
	const [ copied, setCopied ] = useState( false );

	const copyShortcode = () => {
		const sc = playlist.shortcode;
		if ( ! sc ) {
			return;
		}
		const markCopied = () => {
			setCopied( true );
			setTimeout( () => setCopied( false ), 1500 );
		};
		if ( navigator.clipboard && window.isSecureContext ) {
			navigator.clipboard.writeText( sc ).then( markCopied ).catch( () => {
				if ( legacyCopy( sc ) ) {
					markCopied();
				}
			} );
		} else if ( legacyCopy( sc ) ) {
			markCopied();
		}
	};

	useEffect( () => {
		setToolbarSlot( document.getElementById( 'tp-topbar-slot' ) );
	}, [] );

	// title/config are seeded once from `playlist` — any change after mount is
	// a real edit.
	useEffect( () => {
		if ( ! mounted.current ) {
			mounted.current = true;
			return;
		}
		setDirty( true );
	}, [ title, config ] );

	// Report title/dirty/back state up to the app shell — it drives the
	// breadcrumb ("Media playlists > this playlist", title editable right in
	// the trail, parent crumb clicking back) and the unsaved-changes guard.
	useEffect( () => {
		onEditState && onEditState( { title, dirty, onBack, onTitleChange: setTitle } );
	}, [ title, dirty ] );
	useEffect( () => () => onEditState && onEditState( null ), [] );

	const set = ( partial ) => setConfig( ( c ) => ( { ...c, ...partial } ) );
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

	/**
	 * Sections — an optional grouping of this playlist's own `videos`, read by
	 * the drip addon's `by_section` mode (DripService::section_index()) and
	 * its `dripIntervalDays`. A video belongs to at most one section; anything
	 * in `selected` but not listed in any section's `videoIds` counts as
	 * unsectioned (section 0 on the backend — unlocks immediately on
	 * enrollment, same as no sections at all).
	 */
	const sections = config.sections || [];
	const setSections = ( next ) => set( { sections: next } );
	const sectioned = new Set( sections.flatMap( ( s ) => s.videoIds || [] ) );
	const unsectioned = selected.filter( ( id ) => ! sectioned.has( id ) );

	const addSection = () => setSections( [ ...sections, { id: uid(), title: __sprintf( 'Section %d', sections.length + 1 ), videoIds: [] } ] );
	const removeSection = ( i ) => setSections( sections.filter( ( _, idx ) => idx !== i ) );
	const renameSection = ( i, value ) => setSections( sections.map( ( s, idx ) => ( idx === i ? { ...s, title: value } : s ) ) );
	// A video moves into this section (and out of whichever one it was in,
	// since it can only be in one) rather than being added to several.
	const addVideoToSection = ( i, videoId ) => setSections(
		sections.map( ( s, idx ) => ( {
			...s,
			videoIds: idx === i ? [ ...s.videoIds, videoId ] : s.videoIds.filter( ( id ) => id !== videoId ),
		} ) )
	);
	const removeVideoFromSection = ( i, videoId ) => setSections(
		sections.map( ( s, idx ) => ( idx === i ? { ...s, videoIds: s.videoIds.filter( ( id ) => id !== videoId ) } : s ) )
	);

	/**
	 * Assignments attached to this course — stored on the assignment's own
	 * config (`playlistId`/`position`), not inside this playlist's own
	 * `config.videos`: an assignment is a different CPT, and
	 * `Playlist::video_payload()` only ever resolves real `tp_video` posts.
	 * Each change here saves immediately through the assignments API, not
	 * through this screen's own Save button.
	 */
	const [ assignments, setAssignments ] = useState( null );
	const loadAssignments = () => api.listAssignments().then( setAssignments ).catch( () => setAssignments( [] ) );
	useEffect( () => { loadAssignments(); }, [] );

	const attached = ( assignments || [] )
		.filter( ( a ) => ( a.config?.playlistId || 0 ) === playlist.id )
		.sort( ( a, b ) => ( a.config?.position || 0 ) - ( b.config?.position || 0 ) );
	const attachable = ( assignments || [] ).filter( ( a ) => ( a.config?.playlistId || 0 ) !== playlist.id );

	const attachAssignment = async ( assignmentId ) => {
		const a = ( assignments || [] ).find( ( x ) => x.id === assignmentId );
		if ( ! a ) {
			return;
		}
		await api.updateAssignment( assignmentId, { config: { ...a.config, playlistId: playlist.id, position: attached.length } } );
		loadAssignments();
	};
	const detachAssignment = async ( assignmentId ) => {
		const a = ( assignments || [] ).find( ( x ) => x.id === assignmentId );
		if ( ! a ) {
			return;
		}
		await api.updateAssignment( assignmentId, { config: { ...a.config, playlistId: 0, position: 0 } } );
		loadAssignments();
	};
	const moveAssignment = async ( i, dir ) => {
		const j = i + dir;
		if ( j < 0 || j >= attached.length ) {
			return;
		}
		await Promise.all( [
			api.updateAssignment( attached[ i ].id, { config: { ...attached[ i ].config, position: attached[ j ].config?.position || 0 } } ),
			api.updateAssignment( attached[ j ].id, { config: { ...attached[ j ].config, position: attached[ i ].config?.position || 0 } } ),
		] );
		loadAssignments();
	};

	return (
		<div>
			{ /* Save lives in the topbar (portaled) — same pattern as the video editor. */ }
			{ toolbarSlot && createPortal(
				<>
					{ saved && <span className="inline-flex items-center gap-1 text-sm text-green-600"><Icon name="checkmark" className="w-4 h-4" /> { __( 'Saved' ) }</span> }
					<Button onClick={ save } disabled={ saving || ! dirty }>{ saving ? __( 'Saving…' ) : __( 'Save' ) }</Button>
				</>,
				toolbarSlot
			) }
			<div className="grid md:grid-cols-2 gap-6">
				<Card className="p-6">
					<h3 className="font-semibold text-ink !mb-5 !pb-4 border-b border-solid border-line">{ __( 'Playlist settings' ) }</h3>
					<Field label={ __( 'Layout' ) }>
						<Select value={ config.layout } onChange={ ( e ) => set( { layout: e.target.value } ) }>
							<option value="sidebar">{ __( 'Sidebar (player + list)' ) }</option>
							<option value="grid">{ __( 'Grid (cards)' ) }</option>
						</Select>
					</Field>
					<Toggle checked={ config.autoplayNext } onChange={ ( v ) => set( { autoplayNext: v } ) } label={ __( 'Autoplay the next video' ) } className="mb-6" />
					<Toggle checked={ config.showTitles } onChange={ ( v ) => set( { showTitles: v } ) } label={ __( 'Show video titles' ) } />
					<div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-4">
						<p className="text-[13px] font-medium text-ink mb-1">{ __( 'Embed' ) }</p>
						<code className="text-xs bg-gray-100 rounded px-2 py-1 cursor-pointer hover:text-brand-500" onClick={ copyShortcode } title={ __( 'Copy shortcode' ) }>
							{ copied ? <span className="inline-flex items-center gap-1"><Icon name="checkmark" className="w-3.5 h-3.5" /> { __( 'Copied' ) }</span> : playlist.shortcode }
						</code>
					</div>
				</Card>

				<Card className="p-6">
					<h3 className="font-semibold text-ink !mb-5 !pb-4 border-b border-solid border-line">{ __( 'Media in this playlist' ) }</h3>
					<p className="text-sm text-gray-500 mb-3">{ _nSprintf( '%d selected · drag to reorder.', '%d selected · drag to reorder.', selected.length ) }</p>
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
									<span className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none px-0.5" title={ __( 'Drag to reorder' ) } aria-hidden="true">⠿</span>
									<span className="text-xs text-gray-400 w-4 text-center">{ i + 1 }</span>
									<span className="flex-1 text-sm truncate">{ byId[ id ]?.title || __sprintf( '#%d', id ) }</span>
									<Badge tone={ meta.tone }>{ meta.label }</Badge>
									<div className="flex">
										<button className="text-gray-300 hover:text-ink px-1" title={ __( 'Move up' ) } onClick={ () => move( i, -1 ) }>↑</button>
										<button className="text-gray-300 hover:text-ink px-1" title={ __( 'Move down' ) } onClick={ () => move( i, 1 ) }>↓</button>
									</div>
									<Button variant="danger" size="sm" onClick={ () => remove( id ) }><BsTrash /></Button>
								</div>
							);
						} ) }
						{ selected.length === 0 && <p className="text-sm text-gray-400">{ __( 'No media yet — add one below.' ) }</p> }
					</div>

					{ ! adding ? (
						<Button variant="subtle" onClick={ () => { setAdding( true ); setQuery( '' ); } }>{ __( '+ Add media' ) }</Button>
					) : (
						<div className="border border-line rounded-md p-2">
							<Input autoFocus placeholder={ __( 'Search media to add…' ) } value={ query } onChange={ ( e ) => setQuery( e.target.value ) } />
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
									<p className="text-sm text-gray-400 px-2 py-3">{ available.length === 0 ? __( 'All media is already in this playlist.' ) : __( 'No media matches your search.' ) }</p>
								) }
							</div>
							<div className="flex justify-end mt-2 pt-2 border-t border-line">
								<Button variant="ghost" size="sm" onClick={ () => { setAdding( false ); setQuery( '' ); } }>{ __( 'Done' ) }</Button>
							</div>
						</div>
					) }
				</Card>
			</div>

			<Card className="p-6">
				<h3 className="font-semibold text-ink !mb-5 !pb-4 border-b border-solid border-line">{ __( 'Sections' ) }</h3>
				<p className="text-sm text-gray-500 mb-4">
					{ __( "Group this playlist's videos into sections. Used by the drip addon's \u201cby section\u201d release mode \u2014 each section opens this many days after the one before it." ) }
				</p>
				<Field label={ __( 'Days between sections' ) } className="mb-5 max-w-[220px]">
					<Input type="number" min="0" value={ config.dripIntervalDays ?? 7 } onChange={ ( e ) => set( { dripIntervalDays: parseInt( e.target.value, 10 ) || 0 } ) } />
				</Field>

				<div className="space-y-3 mb-4">
					{ sections.map( ( s, i ) => (
						<div key={ s.id } className="border border-line rounded-md p-3">
							<div className="flex items-center gap-2 mb-2">
								<Input className="flex-1" value={ s.title } onChange={ ( e ) => renameSection( i, e.target.value ) } placeholder={ __sprintf( 'Section %d', i + 1 ) } />
								<Button variant="danger" size="sm" onClick={ () => removeSection( i ) }><BsTrash /></Button>
							</div>
							<div className="space-y-1 mb-2">
								{ ( s.videoIds || [] ).map( ( id ) => (
									<div key={ id } className="flex items-center gap-2 text-sm bg-gray-50 rounded px-2 py-1">
										<span className="flex-1 truncate">{ byId[ id ]?.title || __sprintf( '#%d', id ) }</span>
										<button className="text-gray-400 hover:text-danger" title={ __( 'Remove from section' ) } onClick={ () => removeVideoFromSection( i, id ) }>\u00d7</button>
									</div>
								) ) }
								{ 0 === ( s.videoIds || [] ).length && <p className="text-xs text-gray-400">{ __( 'No videos in this section yet.' ) }</p> }
							</div>
							{ unsectioned.length > 0 && (
								<Select value="" onChange={ ( e ) => e.target.value && addVideoToSection( i, parseInt( e.target.value, 10 ) ) }>
									<option value="">{ __( '+ Add a video to this section\u2026' ) }</option>
									{ unsectioned.map( ( id ) => <option key={ id } value={ id }>{ byId[ id ]?.title || __sprintf( '#%d', id ) }</option> ) }
								</Select>
							) }
						</div>
					) ) }
				</div>
				<Button variant="subtle" onClick={ addSection }>{ __( '+ Add section' ) }</Button>

				{ selected.length > 0 && (
					<div className="mt-4 pt-4 border-t border-line">
						<p className="text-xs text-gray-500 mb-2">
							{ unsectioned.length === selected.length
								? __( 'No sections yet \u2014 every video unlocks together on enrollment.' )
								: __sprintf( '%d video(s) not in any section \u2014 they unlock on enrollment, same as section 1.', unsectioned.length ) }
						</p>
					</div>
				) }
			</Card>

			<Card className="p-6">
				<h3 className="font-semibold text-ink !mb-5 !pb-4 border-b border-solid border-line">{ __( 'Assignments in this course' ) }</h3>
				<p className="text-sm text-gray-500 mb-4">{ __( "Attach an assignment created on the Assignments screen. Changes here save immediately \u2014 not with this screen's Save button." ) }</p>

				{ null === assignments && <p className="text-sm text-gray-400">{ __( 'Loading\u2026' ) }</p> }

				<div className="space-y-2 mb-4">
					{ attached.map( ( a, i ) => (
						<div key={ a.id } className="flex items-center gap-2 border border-line rounded-md p-2 bg-white">
							<span className="text-xs text-gray-400 w-4 text-center">{ i + 1 }</span>
							<span className="flex-1 text-sm truncate">{ a.title }</span>
							<Badge tone="brand">{ __( 'Assignment' ) }</Badge>
							<div className="flex">
								<button className="text-gray-300 hover:text-ink px-1" title={ __( 'Move up' ) } onClick={ () => moveAssignment( i, -1 ) }>\u2191</button>
								<button className="text-gray-300 hover:text-ink px-1" title={ __( 'Move down' ) } onClick={ () => moveAssignment( i, 1 ) }>\u2193</button>
							</div>
							<Button variant="danger" size="sm" onClick={ () => detachAssignment( a.id ) }><BsTrash /></Button>
						</div>
					) ) }
					{ assignments && 0 === attached.length && <p className="text-sm text-gray-400">{ __( 'No assignments attached yet.' ) }</p> }
				</div>

				{ attachable.length > 0 && (
					<Select value="" onChange={ ( e ) => e.target.value && attachAssignment( parseInt( e.target.value, 10 ) ) }>
						<option value="">{ __( '+ Attach an assignment\u2026' ) }</option>
						{ attachable.map( ( a ) => (
							<option key={ a.id } value={ a.id }>
								{ a.title }{ ( a.config?.playlistId || 0 ) > 0 ? __( ' (attached elsewhere)' ) : '' }
							</option>
						) ) }
					</Select>
				) }
			</Card>
		</div>
	);
}

// The playlist list + create now live inside the combined Videos screen
// (Library). This module exports only PlaylistEditor.
