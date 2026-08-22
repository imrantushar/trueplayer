import { useEffect, useMemo, useState } from '@wordpress/element';
import { Card, Button, Badge, Toast, Modal, Field, Input, OptionMenu } from '../components/UI';
import { Icon } from '../components/icons';
import H5pEditor from './H5pEditor';
import { api } from '../api';

/**
 * The "Interactive" section — TruePlayer's H5P engine hub.
 *
 * Lists existing interactive items; creating one runs through a picker modal
 * (choose a content type → install it from the H5P hub if it isn't local yet →
 * create), which then opens the semantics-driven builder (H5pEditor). H5P items
 * are ordinary tp_video posts, so they embed with the same [trueplayer id="N"]
 * shortcode as native videos.
 */

// Category → picker group label + tile icon.
const CATEGORIES = [
	[ 'question', 'Questions', 'help' ],
	[ 'quiz', 'Quizzes', 'quiz' ],
	[ 'study', 'Study aids', 'cards' ],
	[ 'content', 'Content', 'playlist' ],
	[ 'other', 'Also installed', 'spark' ],
];

const iconFor = ( category ) => ( CATEGORIES.find( ( c ) => c[ 0 ] === category ) || [ , , 'spark' ] )[ 2 ];

export default function Interactive() {
	const [ view, setView ] = useState( { name: 'list' } ); // {name:'list'} | {name:'edit', video?, machineName?, title?}
	const [ types, setTypes ] = useState( null );
	const [ items, setItems ] = useState( null );
	const [ error, setError ] = useState( null );

	// Create modal.
	const [ modal, setModal ] = useState( false );
	const [ picked, setPicked ] = useState( '' );
	const [ title, setTitle ] = useState( '' );
	const [ query, setQuery ] = useState( '' );
	const [ busy, setBusy ] = useState( '' ); // '' | 'install' | 'create'

	const [ copied, setCopied ] = useState( null );
	const [ confirming, setConfirming ] = useState( null ); // item pending delete

	const load = async () => {
		try {
			const [ t, i ] = await Promise.all( [ api.h5pContentTypes(), api.h5pItems() ] );
			setTypes( t );
			setItems( i );
		} catch ( e ) {
			setError( e.message || 'Failed to load.' );
		}
	};

	useEffect( () => { load(); }, [] );

	const openModal = () => {
		setPicked( '' );
		setTitle( '' );
		setQuery( '' );
		setModal( true );
	};

	const selected = useMemo(
		() => ( types?.featured || [] ).find( ( t ) => t.machineName === picked ) || null,
		[ types, picked ]
	);

	// Picker tiles, filtered by the search box and grouped by category.
	const groups = useMemo( () => {
		const q = query.trim().toLowerCase();
		const list = ( types?.featured || [] ).filter( ( t ) => ! q
			|| t.title.toLowerCase().includes( q )
			|| t.machineName.toLowerCase().includes( q )
			|| ( t.description || '' ).toLowerCase().includes( q )
		);
		return CATEGORIES
			.map( ( [ key, label ] ) => [ label, list.filter( ( t ) => t.category === key ) ] )
			.filter( ( [ , ts ] ) => ts.length > 0 );
	}, [ types, query ] );

	const install = async () => {
		if ( ! selected ) {
			return;
		}
		setBusy( 'install' );
		setError( null );
		try {
			await api.h5pInstallType( selected.machineName );
			await load();
		} catch ( e ) {
			setError( e.message || 'Install failed.' );
		} finally {
			setBusy( '' );
		}
	};

	const create = () => {
		if ( ! selected?.installed ) {
			return;
		}
		setModal( false );
		setView( { name: 'edit', machineName: selected.machineName, title: title.trim() } );
	};

	const remove = async () => {
		const item = confirming;
		if ( ! item ) {
			return;
		}
		setBusy( 'delete' );
		try {
			await api.deleteVideo( item.video );
			setConfirming( null );
			await load();
		} catch ( e ) {
			setError( e.message || 'Delete failed.' );
		} finally {
			setBusy( '' );
		}
	};

	const copy = ( item ) => {
		const done = () => {
			setCopied( item.video );
			setTimeout( () => setCopied( ( c ) => ( c === item.video ? null : c ) ), 1500 );
		};
		if ( navigator.clipboard && window.isSecureContext ) {
			navigator.clipboard.writeText( item.shortcode ).then( done ).catch( () => {} );
		}
	};

	if ( view.name === 'edit' ) {
		return (
			<H5pEditor
				video={ view.video || null }
				machineName={ view.machineName || '' }
				title={ view.title || '' }
				onBack={ () => { setView( { name: 'list' } ); load(); } }
			/>
		);
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Interactive</h1>
					<p className="text-sm text-muted">Quizzes, flashcards, and more — built here, rendered by the H5P engine.</p>
				</div>
				<Button onClick={ openModal }><Icon name="plus" className="w-4 h-4" /> Create interactive</Button>
			</div>

			<ItemList items={ items } copied={ copied } onCopy={ copy } onEdit={ ( v ) => setView( { name: 'edit', video: v } ) } onRemove={ setConfirming } onAdd={ openModal } />

			{ modal && (
				<Modal
					title="Create interactive content"
					className="max-w-3xl"
					onClose={ () => setModal( false ) }
					footer={
						<>
							<div className="mr-auto text-[13px] text-muted">
								{ ! selected && 'Pick a content type to continue.' }
								{ selected && ! selected.installed && `${ selected.title } isn’t installed yet — it downloads once from the H5P Hub.` }
								{ selected && selected.installed && `${ selected.title } is ready to use.` }
							</div>
							<Button variant="ghost" onClick={ () => setModal( false ) }>Cancel</Button>
							{ selected && ! selected.installed ? (
								<Button onClick={ install } disabled={ busy === 'install' }>
									{ busy === 'install' ? 'Installing…' : 'Install' }
								</Button>
							) : (
								<Button onClick={ create } disabled={ ! selected }>Create</Button>
							) }
						</>
					}
				>
					<Field label="Name" hint="Shown in your library. You can rename it later.">
						<Input value={ title } onChange={ ( e ) => setTitle( e.target.value ) } placeholder="e.g. Module 1 knowledge check" />
					</Field>

					<div className="flex items-center justify-between mt-5 mb-2">
						<span className="text-[13px] font-medium text-label">Content type</span>
						<div className="relative w-56">
							<Icon name="search" className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-placeholder" />
							<Input value={ query } onChange={ ( e ) => setQuery( e.target.value ) } placeholder="Search types" className="!pl-8" />
						</div>
					</div>

					<div className="max-h-[46vh] overflow-y-auto -mx-1 px-1 pb-1">
						{ ! types && <div className="py-10 text-center text-muted text-sm">Loading content types…</div> }
						{ types && groups.length === 0 && <div className="py-10 text-center text-muted text-sm">No content type matches “{ query }”.</div> }
						{ groups.map( ( [ label, list ] ) => (
							<div key={ label } className="mb-4 last:mb-0">
								<div className="text-[11px] font-semibold uppercase tracking-wide text-placeholder mb-2">{ label }</div>
								<div className="grid sm:grid-cols-2 gap-2">
									{ list.map( ( t ) => (
										<TypeTile key={ t.machineName } type={ t } active={ picked === t.machineName } onPick={ () => setPicked( t.machineName ) } />
									) ) }
								</div>
							</div>
						) ) }
					</div>
				</Modal>
			) }

			{ confirming && (
				<Modal
					title="Delete interactive item"
					onClose={ () => setConfirming( null ) }
					footer={
						<>
							<Button variant="ghost" onClick={ () => setConfirming( null ) }>Cancel</Button>
							<Button variant="danger" onClick={ remove } disabled={ busy === 'delete' }>
								{ busy === 'delete' ? 'Deleting…' : 'Delete' }
							</Button>
						</>
					}
				>
					<p className="text-sm text-ink">
						Delete <strong>{ confirming.title }</strong>? Any page still using
						<code className="mx-1 text-xs text-muted">{ confirming.shortcode }</code>
						will stop showing it.
					</p>
				</Modal>
			) }

			{ error && <Toast message={ error } onDismiss={ () => setError( null ) } /> }
		</div>
	);
}

/** One selectable content type in the create picker. */
function TypeTile( { type, active, onPick } ) {
	return (
		<button
			type="button"
			onClick={ onPick }
			className={ `w-full text-left flex gap-3 p-3 rounded-card border transition-colors ${
				active ? 'border-brand-500 bg-brand-50' : 'border-line bg-white hover:border-brand-200 hover:bg-gray-50'
			}` }
		>
			<span className={ `w-9 h-9 shrink-0 rounded flex items-center justify-center ${ active ? 'bg-brand-500 text-white' : 'bg-gray-100 text-muted' }` }>
				<Icon name={ iconFor( type.category ) } className="w-[18px] h-[18px]" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-center gap-2">
					<span className="text-[13px] font-semibold text-ink truncate">{ type.title }</span>
					{ active && <Icon name="check" className="w-4 h-4 text-brand-500 shrink-0 ml-auto" /> }
				</span>
				<span className="block text-xs text-muted mt-0.5 leading-4">{ type.description || type.machineName }</span>
				{ ! type.installed && (
					<span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
						<span className="w-1.5 h-1.5 rounded-full bg-warning" /> Not installed
					</span>
				) }
			</span>
		</button>
	);
}

function ItemList( { items, copied, onCopy, onEdit, onRemove, onAdd } ) {
	if ( items === null ) {
		return (
			<div className="space-y-3">
				{ [ 0, 1, 2 ].map( ( i ) => (
					<Card key={ i } className="p-4 flex items-center gap-4">
						<div className="w-10 h-10 rounded bg-gray-100 animate-pulse shrink-0" />
						<div className="flex-1 space-y-2"><div className="h-4 w-1/3 bg-gray-100 rounded animate-pulse" /><div className="h-3 w-1/4 bg-gray-100 rounded animate-pulse" /></div>
					</Card>
				) ) }
			</div>
		);
	}

	if ( items.length === 0 ) {
		return (
			<Card className="p-12 text-center border-dashed">
				<div className="mx-auto mb-3 w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center"><Icon name="spark" className="w-6 h-6" /></div>
				<p className="font-semibold text-gray-900">No interactive content yet</p>
				<p className="text-sm text-muted !mb-6">Build a quiz, flashcard deck, or drag-the-words exercise and embed it anywhere.</p>
				<Button onClick={ onAdd }><Icon name="plus" className="w-4 h-4" /> Create interactive</Button>
			</Card>
		);
	}

	return (
		<div className="space-y-3">
			{ items.map( ( it ) => (
				<Card key={ it.video } className="p-3 flex items-center gap-4 hover:border-brand-200 transition-colors">
					<span className="w-10 h-10 shrink-0 rounded bg-brand-50 text-brand-500 flex items-center justify-center">
						<Icon name="spark" className="w-5 h-5" />
					</span>
					<div className="flex-1 min-w-0">
						<div className="font-semibold text-gray-900 truncate">{ it.title }</div>
						<div className="flex items-center flex-wrap gap-2 mt-1.5">
							{ it.type && <Badge tone="brand">{ it.type }</Badge> }
							{ it.status === 'draft' && <Badge tone="amber">draft</Badge> }
							<code className="text-xs text-muted cursor-pointer hover:text-brand-500" onClick={ () => onCopy( it ) } title="Copy shortcode">
								{ copied === it.video ? 'Copied ✓' : it.shortcode }
							</code>
						</div>
					</div>
					<button
						type="button"
						onClick={ () => onEdit( it.video ) }
						aria-label="Edit"
						title="Edit"
						className="w-8 h-8 inline-flex items-center justify-center text-muted hover:text-ink hover:bg-gray-100 transition-colors shrink-0 border border-line rounded"
					>
						<Icon name="edit" className="w-[18px] h-[18px]" />
					</button>
					<OptionMenu items={ [
						{ label: 'Delete', icon: 'trash', danger: true, onClick: () => onRemove( it ) },
					] } />
				</Card>
			) ) }
		</div>
	);
}
