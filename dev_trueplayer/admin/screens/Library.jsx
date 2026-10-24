import { createInterpolateElement, useEffect, useMemo, useState } from '@wordpress/element';
import { __, __sprintf } from '@Utils/translation';
import { api } from '../api';
import { Button, Card, Badge, Modal, Pagination, Thumb, sourceMeta, OptionMenu, SplitButton, Toast } from '../components/UI';
import { Icon } from '../components/icons';
import { PlaylistEditor } from './Playlists';
import CreateModal from './CreateModal';
import { isAudioSource } from '@Utils/audio';
import { libraryKinds, rowActions, rowBadges } from '@Ext/admin';

/**
 * The library — one screen for every kind of thing TruePlayer can embed:
 * players (tp_video) and playlists (tp_playlist), plus any kind an extension
 * registers through `@Ext/admin`'s `libraryKinds`. Creating anything runs
 * through the one CreateModal.
 */

const PER_PAGE = 10;

// Filter chips. All five are the one library route with a different ?kind=.
//
// Video and Audio in place of a single "Media": they are two different players
// with their own presets, their own site-wide default and their own tab in the
// create dialog, and the library was the last screen that still pretended they
// were one bucket — so a site with a large video library had no way to reach
// its audio at all. `media` remains a valid kind for old links; it just has no
// chip of its own now that its two halves each have one.
const FILTERS = [
	{ kind: 'all', label: __( 'All' ) },
	{ kind: 'video', label: __( 'Video' ) },
	{ kind: 'audio', label: __( 'Audio' ) },
	{ kind: 'playlist', label: __( 'Playlists' ) },
	...libraryKinds.map( ( k ) => ( { kind: k.kind, label: k.label } ) ),
];

/** Kinds that draw from the media list. */
const MEDIA_KINDS = [ 'all', 'media', 'video', 'audio' ];

/**
 * Does this item belong under the current filter?
 *
 * `isAudioSource` is the same predicate the player, the editor and PHP all use,
 * so the chip agrees with what the item actually renders as — including the
 * legacy .mp3 that nobody ever ticked the audio box for.
 */
function matchesMediaKind( kind, video ) {
	if ( 'video' !== kind && 'audio' !== kind ) {
		return true;
	}
	return isAudioSource( video.config?.source || {} ) === ( 'audio' === kind );
}

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

export default function Library( { kind = 'all', onEdit, onEditState, onNavigate, createIntent = null, onCreateHandled } ) {
	const [ videos, setVideos ] = useState( null );
	const [ playlists, setPlaylists ] = useState( null );
	// Items of each extension kind, keyed by kind (null = still loading).
	const [ extItems, setExtItems ] = useState( () => Object.fromEntries( libraryKinds.map( ( k ) => [ k.kind, null ] ) ) );

	const [ editingPlaylist, setEditingPlaylist ] = useState( null );
	const [ editingExt, setEditingExt ] = useState( null ); // { kind, row } | { kind, create }

	const [ create, setCreate ] = useState( null ); // null | initial kind
	const [ confirming, setConfirming ] = useState( null ); // row pending delete
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ page, setPage ] = useState( 1 );
	const [ copied, setCopied ] = useState( null );

	const loadVideos = () => api.listVideos().then( setVideos );
	const loadPlaylists = () => api.listPlaylists().then( setPlaylists );
	const loadExt = ( k ) => k.load()
		.then( ( items ) => setExtItems( ( m ) => ( { ...m, [ k.kind ]: items || [] } ) ) )
		.catch( () => setExtItems( ( m ) => ( { ...m, [ k.kind ]: [] } ) ) );
	const loadAll = () => Promise.all( [ loadVideos(), loadPlaylists(), ...libraryKinds.map( loadExt ) ] );

	useEffect( () => { loadAll(); }, [] );
	useEffect( () => { setPage( 1 ); }, [ kind ] );

	// A create request that arrived with the navigation (dashboard buttons).
	useEffect( () => {
		if ( createIntent ) {
			setCreate( createIntent );
			onCreateHandled?.();
		}
	}, [ createIntent, onCreateHandled ] );

	// One row shape for all three kinds, so the list, the copy handler and the
	// delete flow don't have to branch per source.
	const rows = useMemo( () => {
		const out = [];
		if ( MEDIA_KINDS.includes( kind ) ) {
			( videos || [] )
				.filter( ( v ) => matchesMediaKind( kind, v ) )
				// The row's own kind stays 'media': it is what the edit, copy and
				// delete handlers branch on, and those do not care which player
				// this one turns out to be.
				.forEach( ( v ) => out.push( { kind: 'media', key: `v${ v.id }`, id: v.id, title: v.title, shortcode: v.shortcode, modified: v.modified, item: v } ) );
		}
		if ( 'all' === kind || 'playlist' === kind ) {
			( playlists || [] ).forEach( ( p ) => out.push( { kind: 'playlist', key: `p${ p.id }`, id: p.id, title: p.title, shortcode: p.shortcode, modified: p.modified, item: p } ) );
		}
		libraryKinds.forEach( ( k ) => {
			if ( 'all' === kind || k.kind === kind ) {
				( extItems[ k.kind ] || [] ).forEach( ( i ) => out.push( { ...k.toRow( i ), kind: k.kind, item: i } ) );
			}
		} );
		return out.sort( ( a, b ) => String( b.modified || '' ).localeCompare( String( a.modified || '' ) ) );
	}, [ kind, videos, playlists, extItems ] );

	// Still loading if any source this filter needs hasn't landed yet.
	const loading = ( MEDIA_KINDS.includes( kind ) && null === videos )
		|| ( ( 'all' === kind || 'playlist' === kind ) && null === playlists )
		|| libraryKinds.some( ( k ) => ( 'all' === kind || k.kind === kind ) && null === extItems[ k.kind ] );

	const pages = Math.max( 1, Math.ceil( rows.length / PER_PAGE ) );
	const current = Math.min( page, pages );
	const paged = rows.slice( ( current - 1 ) * PER_PAGE, current * PER_PAGE );

	const goToFilter = ( f ) => {
		if ( onNavigate ) {
			onNavigate( 'library', { kind: f.kind } );
		}
	};

	const submitCreate = async ( { kind: newKind, title, sourceType, mediaKind, ...extra } ) => {
		try {
			if ( 'media' === newKind ) {
				// `mediaType` is written only for audio. Stamping 'video' would be
				// an explicit opt-out of the extension safety net (see
				// @Utils/audio), which is not what picking the Video tab means —
				// that is just the default, and a .mp3 pasted in later should
				// still be recognised.
				const source = { type: sourceType };
				if ( 'audio' === mediaKind ) {
					source.mediaType = 'audio';
				}
				const v = await api.createVideo( title || ( 'audio' === mediaKind ? __( 'Untitled audio' ) : __( 'Untitled video' ) ), { source } );
				setCreate( null );
				await loadVideos();
				onEdit( v.id );
			} else if ( 'playlist' === newKind ) {
				const p = await api.createPlaylist( title || __( 'Untitled playlist' ) );
				setCreate( null );
				await loadPlaylists();
				setEditingPlaylist( p );
			} else {
				setCreate( null );
				setEditingExt( { kind: newKind, create: { title, ...extra } } );
			}
		} catch ( e ) {
			setError( e.message || __( 'Could not create that.' ) );
		}
	};

	const remove = async () => {
		const row = confirming;
		if ( ! row ) {
			return;
		}
		setBusy( true );
		try {
			const ext = libraryKinds.find( ( k ) => k.kind === row.kind );
			await ( 'playlist' === row.kind ? api.deletePlaylist( row.id ) : ( ext && ext.remove ? ext.remove( row ) : api.deleteVideo( row.id ) ) );
			setConfirming( null );
			await loadAll();
		} catch ( e ) {
			setError( e.message || __( 'Delete failed.' ) );
		} finally {
			setBusy( false );
		}
	};

	const copy = ( row ) => {
		if ( ! row.shortcode ) {
			return;
		}
		const markCopied = () => {
			setCopied( row.key );
			setTimeout( () => setCopied( ( c ) => ( c === row.key ? null : c ) ), 1500 );
		};
		if ( navigator.clipboard && window.isSecureContext ) {
			navigator.clipboard.writeText( row.shortcode ).then( markCopied ).catch( () => {
				if ( legacyCopy( row.shortcode ) ) {
					markCopied();
				}
			} );
		} else if ( legacyCopy( row.shortcode ) ) {
			markCopied();
		}
	};

	const editRow = ( row ) => {
		if ( 'media' === row.kind ) {
			onEdit( row.id );
		} else if ( 'playlist' === row.kind ) {
			setEditingPlaylist( row.item );
		} else {
			setEditingExt( { kind: row.kind, row } );
		}
	};

	// Editing a playlist (or an extension item) takes over the screen; players
	// get their own route (the step-sidebar Editor).
	if ( editingPlaylist ) {
		return (
			<PlaylistEditor
				playlist={ editingPlaylist }
				videos={ videos || [] }
				onBack={ () => { setEditingPlaylist( null ); loadPlaylists(); } }
				onSaved={ loadPlaylists }
				onEditState={ onEditState }
			/>
		);
	}
	if ( editingExt ) {
		const ext = libraryKinds.find( ( k ) => k.kind === editingExt.kind );
		if ( ext ) {
			return (
				<ext.Editor
					row={ editingExt.row || null }
					create={ editingExt.create || null }
					onBack={ () => { setEditingExt( null ); loadExt( ext ); } }
				/>
			);
		}
	}

	const byId = Object.fromEntries( ( videos || [] ).map( ( v ) => [ v.id, v ] ) );
	const filters = FILTERS;
	const createKinds = [ 'media', 'playlist', ...libraryKinds.map( ( k ) => k.kind ) ];

	// The split button's default is the kind you're looking at — so the filter
	// you deep-linked to is also the thing you create in one click.
	const defaultKind = ( 'all' === kind || ! createKinds.includes( kind ) ) ? 'media' : kind;
	const menuKinds = createKinds.filter( ( k ) => k !== defaultKind );
	const KIND_MENU = {
		media: { label: __( 'Media' ), hint: __( 'A video or audio player' ) },
		playlist: { label: __( 'Playlist' ), hint: __( 'Group players into one embed' ) },
		...Object.fromEntries( libraryKinds.map( ( k ) => [ k.kind, k.menu ] ) ),
	};

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">{ __( 'Media' ) }</h1>
					<p className="text-sm text-muted">{ __( 'Players and playlists, ready to embed anywhere.' ) }</p>
				</div>
				<SplitButton
					onClick={ () => setCreate( defaultKind ) }
					items={ menuKinds.map( ( k ) => ( { ...KIND_MENU[ k ], onClick: () => setCreate( k ) } ) ) }
				>
					<Icon name="plus" className="w-4 h-4" /> Add { KIND_MENU[ defaultKind ].label.toLowerCase() }
				</SplitButton>
			</div>

			<div className="inline-flex p-0.5 mb-6 rounded bg-gray-100">
				{ filters.map( ( f ) => (
					<button
						key={ f.kind }
						onClick={ () => goToFilter( f ) }
						className={ `px-4 py-1.5 rounded text-sm font-medium transition-colors ${ kind === f.kind ? 'bg-white text-brand-500 shadow-sm' : 'text-muted hover:text-ink' }` }
					>
						{ f.label }
					</button>
				) ) }
			</div>

			<RowList
				rows={ loading ? null : paged }
				kind={ kind }
				byId={ byId }
				copied={ copied }
				onCopy={ copy }
				onEdit={ editRow }
				onNavigate={ onNavigate }
				onRemove={ setConfirming }
				onAdd={ () => setCreate( defaultKind ) }
			/>
			{ ! loading && <Pagination page={ current } pages={ pages } onPage={ setPage } /> }

			{ create && (
				<CreateModal
					initialKind={ create }
					// Creating while filtered to Audio means creating audio. Without
					// this the dialog opened on Video every time, so the one action
					// the empty Audio state offers produced the wrong kind of item.
					initialMediaKind={ 'audio' === kind ? 'audio' : 'video' }
					kinds={ createKinds }
					onClose={ () => setCreate( null ) }
					onSubmit={ submitCreate }
					onError={ setError }
				/>
			) }

			{ confirming && (
				<Modal
					title={ __( 'Delete' ) }
					onClose={ () => setConfirming( null ) }
					footer={
						<>
							<Button variant="ghost" onClick={ () => setConfirming( null ) }>{ __( 'Cancel' ) }</Button>
							<Button variant="danger" onClick={ remove } disabled={ busy }>{ busy ? __( 'Deleting…' ) : __( 'Delete' ) }</Button>
						</>
					}
				>
					<p className="text-sm text-ink">
						{ createInterpolateElement(
							__sprintf(
								'Delete <b>%1$s</b>? Any page still using <c>%2$s</c> will stop showing it.',
								confirming.title,
								confirming.shortcode
							),
							{ b: <strong />, c: <code className="mx-1 text-xs text-muted" /> }
						) }
					</p>
				</Modal>
			) }

			{ error && <Toast message={ error } onDismiss={ () => setError( null ) } /> }
		</div>
	);
}

const EMPTY = {
	all: { icon: 'video', title: __( 'Nothing here yet' ), body: __( 'Create a player or a playlist — they all embed with a shortcode.' ) },
	media: { icon: 'video', title: __( 'No media yet' ), body: __( 'Create your first watch-verified player.' ) },
	video: { icon: 'video', title: __( 'No video yet' ), body: __( 'Create your first watch-verified video player.' ) },
	// `music` rather than `video`: the empty state is the one place the chip
	// cannot tell you which half of the library you are looking at, since there
	// is nothing on screen to look at.
	audio: { icon: 'music', title: __( 'No audio yet' ), body: __( 'Create a podcast episode, an album track or an audiobook chapter.' ) },
	playlist: { icon: 'playlist', title: __( 'No playlists yet' ), body: __( 'Group players into a grid or sidebar playlist.' ) },
	...Object.fromEntries( libraryKinds.map( ( k ) => [ k.kind, k.empty ] ) ),
};

function RowList( { rows, kind, byId, copied, onCopy, onEdit, onNavigate, onRemove, onAdd } ) {
	if ( null === rows ) {
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

	if ( 0 === rows.length ) {
		const empty = EMPTY[ kind ] || EMPTY.all;
		return (
			<Card className="p-12 text-center border-dashed">
				<div className="mx-auto mb-3 w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center"><Icon name={ empty.icon } className="w-6 h-6" /></div>
				<p className="font-semibold text-gray-900">{ empty.title }</p>
				<p className="text-sm text-muted !mb-6">{ empty.body }</p>
				<Button onClick={ onAdd }><Icon name="plus" className="w-4 h-4" /> { __( 'Create' ) }</Button>
			</Card>
		);
	}

	return (
		<div className="space-y-3">
			{ rows.map( ( row ) => (
				<Card key={ row.key } className="p-3 flex items-center gap-4 hover:border-brand-200 transition-colors">
					<RowThumb row={ row } byId={ byId } />
					<div className="flex-1 min-w-0">
						<div className="font-semibold text-gray-900 truncate">{ row.title }</div>
						<div className="flex items-center flex-wrap gap-2 mt-1.5">
							<RowBadges row={ row } />
							<code className="text-xs text-muted cursor-pointer hover:text-brand-500" onClick={ () => onCopy( row ) } title={ __( 'Copy shortcode' ) }>
								{ copied === row.key ? <span className="inline-flex items-center gap-1"><Icon name="checkmark" className="w-3.5 h-3.5" /> { __( 'Copied' ) }</span> : row.shortcode }
							</code>
						</div>
					</div>
					<button
						type="button"
						onClick={ () => onEdit( row ) }
						aria-label={ __( 'Edit' ) }
						title={ __( 'Edit' ) }
						className="w-8 h-8 inline-flex items-center justify-center text-muted hover:text-ink hover:bg-gray-100 transition-colors shrink-0 border border-line rounded"
					>
						<Icon name="edit" className="w-[18px] h-[18px]" />
					</button>
					<OptionMenu items={ [
						...rowActions( row, { navigate: onNavigate } ),
						{ label: __( 'Delete' ), icon: 'trash', danger: true, onClick: () => onRemove( row ) },
					] } />
				</Card>
			) ) }
		</div>
	);
}

function RowThumb( { row, byId } ) {
	const ext = libraryKinds.find( ( k ) => k.kind === row.kind );
	if ( ext ) {
		return <ext.Thumb row={ row } />;
	}
	if ( 'playlist' === row.kind ) {
		const first = ( row.item.config?.videos || [] ).map( ( id ) => byId[ id ] ).find( Boolean );
		const src = first?.config?.source || {};
		return <Thumb source={ src } type={ isAudioSource( src ) ? 'audio' : src.type } />;
	}
	const src = row.item.config?.source || {};
	return <Thumb source={ src } type={ isAudioSource( src ) ? 'audio' : src.type } />;
}

function RowBadges( { row } ) {
	const ext = libraryKinds.find( ( k ) => k.kind === row.kind );
	if ( ext ) {
		return <ext.Badges row={ row } />;
	}
	if ( 'playlist' === row.kind ) {
		const ids = row.item.config?.videos || [];
		return (
			<>
				<Badge tone="brand">{ row.item.config?.layout || 'sidebar' }</Badge>
				<Badge>{ ids.length } video{ 1 === ids.length ? '' : 's' }</Badge>
				{ row.item.config?.autoplayNext && <Badge tone="green">autoplay</Badge> }
			</>
		);
	}
	const src = row.item.config?.source || {};
	const chapters = row.item.config?.chapters?.length || 0;
	const meta = sourceMeta( src );
	return (
		<>
			<Badge tone={ meta.tone }>{ meta.label }</Badge>
			{ rowBadges( row ) }
			{ chapters > 0 && <Badge>{ chapters } chapter{ 1 === chapters ? '' : 's' }</Badge> }
		</>
	);
}
