import { createInterpolateElement, useEffect, useMemo, useState } from '@wordpress/element';
import { __, __sprintf } from '@Utils/translation';
import { api } from '../api';
import { Button, Card, Badge, Modal, Pagination, Thumb, sourceMeta, OptionMenu, SplitButton, Toast } from '../components/UI';
import { Icon } from '../components/icons';
import { PlaylistEditor } from './Playlists';
import H5pEditor from './H5pEditor';
import CreateModal from './CreateModal';
import InteractiveTeaser from '../components/InteractiveTeaser';
import { h5pEnabled, h5pInstalled } from '../h5p';

/**
 * The library — one screen for every kind of thing TruePlayer can embed:
 * players (tp_video), playlists (tp_playlist), and interactive items (tp_video
 * on the H5P engine). The WP submenu still has three entries, but each is a
 * deep link into this screen with its filter preselected (see nav.js), and
 * creating anything runs through the one CreateModal.
 */

const PER_PAGE = 10;

// `h5pEnabled` gates anything that reads or writes interactive content;
// `h5pInstalled` only says the engine could be switched on, which is what the
// Interactive tab needs in order to offer the teaser instead of vanishing.
const h5pAvailable = h5pEnabled;

// Filter chips. All four are the one library route with a different ?kind=.
const FILTERS = [
	{ kind: 'all', label: __( 'All' ) },
	{ kind: 'media', label: __( 'Media' ) },
	{ kind: 'playlist', label: __( 'Playlists' ) },
	{ kind: 'interactive', label: __( 'Interactive' ) },
];

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

export default function Library( { kind = 'all', onEdit, onViewers, onEditState, onNavigate, createIntent = null, onCreateHandled } ) {
	const [ videos, setVideos ] = useState( null );
	const [ playlists, setPlaylists ] = useState( null );
	const [ interactive, setInteractive ] = useState( h5pAvailable() ? null : [] );

	const [ editingPlaylist, setEditingPlaylist ] = useState( null );
	const [ editingH5p, setEditingH5p ] = useState( null ); // { video } | { machineName, title }

	const [ create, setCreate ] = useState( null ); // null | initial kind
	const [ confirming, setConfirming ] = useState( null ); // row pending delete
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ page, setPage ] = useState( 1 );
	const [ copied, setCopied ] = useState( null );

	const loadVideos = () => api.listVideos().then( setVideos );
	const loadPlaylists = () => api.listPlaylists().then( setPlaylists );
	const loadInteractive = () => ( h5pAvailable() ? api.h5pItems().then( setInteractive ) : Promise.resolve() );
	const loadAll = () => Promise.all( [ loadVideos(), loadPlaylists(), loadInteractive() ] );

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
		if ( 'all' === kind || 'media' === kind ) {
			( videos || [] ).forEach( ( v ) => out.push( { kind: 'media', key: `v${ v.id }`, id: v.id, title: v.title, shortcode: v.shortcode, modified: v.modified, item: v } ) );
		}
		if ( 'all' === kind || 'playlist' === kind ) {
			( playlists || [] ).forEach( ( p ) => out.push( { kind: 'playlist', key: `p${ p.id }`, id: p.id, title: p.title, shortcode: p.shortcode, modified: p.modified, item: p } ) );
		}
		if ( 'all' === kind || 'interactive' === kind ) {
			( interactive || [] ).forEach( ( i ) => out.push( { kind: 'interactive', key: `h${ i.video }`, id: i.video, title: i.title, shortcode: i.shortcode, modified: i.modified, item: i } ) );
		}
		return out.sort( ( a, b ) => String( b.modified || '' ).localeCompare( String( a.modified || '' ) ) );
	}, [ kind, videos, playlists, interactive ] );

	// Still loading if any source this filter needs hasn't landed yet.
	const loading = ( ( 'all' === kind || 'media' === kind ) && null === videos )
		|| ( ( 'all' === kind || 'playlist' === kind ) && null === playlists )
		|| ( ( 'all' === kind || 'interactive' === kind ) && null === interactive );

	const pages = Math.max( 1, Math.ceil( rows.length / PER_PAGE ) );
	const current = Math.min( page, pages );
	const paged = rows.slice( ( current - 1 ) * PER_PAGE, current * PER_PAGE );

	const goToFilter = ( f ) => {
		if ( onNavigate ) {
			onNavigate( 'library', { kind: f.kind } );
		}
	};

	const submitCreate = async ( { kind: newKind, title, mediaType, machineName } ) => {
		try {
			if ( 'media' === newKind ) {
				const v = await api.createVideo( title || __( 'Untitled video' ), { source: { type: mediaType } } );
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
				setEditingH5p( { machineName, title } );
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
			// Interactive items are tp_video posts, so they delete like players.
			await ( 'playlist' === row.kind ? api.deletePlaylist( row.id ) : api.deleteVideo( row.id ) );
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
			setEditingH5p( { video: row.id } );
		}
	};

	// Editing a playlist or an interactive item takes over the screen; players
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
	if ( editingH5p ) {
		return (
			<H5pEditor
				video={ editingH5p.video || null }
				machineName={ editingH5p.machineName || '' }
				title={ editingH5p.title || '' }
				onBack={ () => { setEditingH5p( null ); loadInteractive(); } }
			/>
		);
	}

	const byId = Object.fromEntries( ( videos || [] ).map( ( v ) => [ v.id, v ] ) );
	// The tab stays visible while the engine is merely installed, so the feature
	// is discoverable; creating is gated on it actually being enabled.
	const filters = FILTERS.filter( ( f ) => 'interactive' !== f.kind || h5pInstalled() );
	const createKinds = [ 'media', 'playlist', ...( h5pEnabled() ? [ 'interactive' ] : [] ) ];
	const teasing = 'interactive' === kind && h5pInstalled() && ! h5pEnabled();

	// The split button's default is the kind you're looking at — so the filter
	// you deep-linked to is also the thing you create in one click. On the
	// teaser there is nothing to create yet, so it falls back to media.
	const defaultKind = ( 'all' === kind || ! createKinds.includes( kind ) ) ? 'media' : kind;
	const menuKinds = createKinds.filter( ( k ) => k !== defaultKind );
	const KIND_MENU = {
		media: { label: __( 'Media' ), hint: __( 'A video or audio player' ) },
		playlist: { label: __( 'Playlist' ), hint: __( 'Group players into one embed' ) },
		interactive: { label: __( 'Interactive' ), hint: __( 'A quiz, flashcards, and more' ) },
	};

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">{ __( 'Media' ) }</h1>
					<p className="text-sm text-muted">{ __( 'Watch-verified players, playlists, and interactive content.' ) }</p>
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

			{ teasing ? (
				<InteractiveTeaser onEnable={ () => onNavigate( 'settings', { tab: 'addons' } ) } />
			) : (
				<>
					<RowList
						rows={ loading ? null : paged }
						kind={ kind }
						byId={ byId }
						copied={ copied }
						onCopy={ copy }
						onEdit={ editRow }
						onViewers={ onViewers }
						onRemove={ setConfirming }
						onAdd={ () => setCreate( defaultKind ) }
					/>
					{ ! loading && <Pagination page={ current } pages={ pages } onPage={ setPage } /> }
				</>
			) }

			{ create && (
				<CreateModal
					initialKind={ create }
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
	all: { icon: 'video', title: __( 'Nothing here yet' ), body: __( 'Create a player, a playlist, or an interactive item — they all embed with a shortcode.' ) },
	media: { icon: 'video', title: __( 'No media yet' ), body: __( 'Create your first watch-verified player.' ) },
	playlist: { icon: 'playlist', title: __( 'No playlists yet' ), body: __( 'Group players into a grid or sidebar playlist.' ) },
	interactive: { icon: 'spark', title: __( 'No interactive content yet' ), body: __( 'Build a quiz, flashcard deck, or drag-the-words exercise and embed it anywhere.' ) },
};

function RowList( { rows, kind, byId, copied, onCopy, onEdit, onViewers, onRemove, onAdd } ) {
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
						// Analytics is per-player; playlists have no viewer record of
						// their own and interactive results land on the H5P item.
						...( 'playlist' === row.kind ? [] : [ { label: __( 'Analytics' ), icon: 'analytics', onClick: () => onViewers( row.id ) } ] ),
						{ label: __( 'Delete' ), icon: 'trash', danger: true, onClick: () => onRemove( row ) },
					] } />
				</Card>
			) ) }
		</div>
	);
}

function RowThumb( { row, byId } ) {
	if ( 'interactive' === row.kind ) {
		return (
			<span className="w-24 aspect-video shrink-0 rounded bg-brand-50 text-brand-500 flex items-center justify-center">
				<Icon name="spark" className="w-5 h-5" />
			</span>
		);
	}
	if ( 'playlist' === row.kind ) {
		const first = ( row.item.config?.videos || [] ).map( ( id ) => byId[ id ] ).find( Boolean );
		const src = first?.config?.source || {};
		return <Thumb source={ src } type={ 'audio' === src.mediaType ? 'audio' : src.type } />;
	}
	const src = row.item.config?.source || {};
	return <Thumb source={ src } type={ 'audio' === src.mediaType ? 'audio' : src.type } />;
}

function RowBadges( { row } ) {
	if ( 'interactive' === row.kind ) {
		return (
			<>
				<Badge tone="brand">{ row.item.type || __( 'Interactive' ) }</Badge>
				{ 'draft' === row.item.status && <Badge tone="amber">draft</Badge> }
			</>
		);
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
	const g = row.item.config?.gating || {};
	const hasQuiz = ( g.checkpoints?.length || 0 ) > 0 || !! g.finalQuiz;
	const chapters = row.item.config?.chapters?.length || 0;
	const meta = sourceMeta( src );
	return (
		<>
			<Badge tone={ meta.tone }>{ meta.label }</Badge>
			{ hasQuiz && <Badge tone="amber">quiz-gated</Badge> }
			{ chapters > 0 && <Badge>{ chapters } chapter{ 1 === chapters ? '' : 's' }</Badge> }
		</>
	);
}
