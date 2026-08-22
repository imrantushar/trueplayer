import { useEffect, useMemo, useState } from '@wordpress/element';
import { Button, Modal, Field, Input } from '../components/UI';
import { Icon } from '../components/icons';
import { isPro } from '../pro';
import { api } from '../api';

/**
 * The library's single creation surface. Whatever the caller starts on — a
 * player, a playlist, or an interactive item — it's the same dialog with the
 * same shape, so the split button can drop the user straight into any kind.
 *
 * The interactive branch also owns the H5P hub install step: a content type
 * that isn't local yet swaps the footer's Create for Install, and flips back
 * once the library lands.
 */

const MEDIA_TYPES = [
	{ value: 'self', label: 'Self-hosted', hint: 'From your media library' },
	{ value: 'youtube', label: 'YouTube', hint: 'Paste a video link' },
	{ value: 'vimeo', label: 'Vimeo', hint: 'Paste a video link' },
	{ value: 'url', label: 'External URL', hint: 'A direct mp4 / webm file' },
	{ value: 'bunny', label: 'Bunny.net Stream', hint: 'Signed, private delivery', pro: true },
	{ value: 'mux', label: 'Mux', hint: 'Adaptive streaming', pro: true },
	{ value: 'hls', label: 'HLS stream', hint: 'An .m3u8 playlist', pro: true },
];

// H5P category → picker group label + tile icon.
const CATEGORIES = [
	[ 'question', 'Questions', 'help' ],
	[ 'quiz', 'Quizzes', 'quiz' ],
	[ 'study', 'Study aids', 'cards' ],
	[ 'content', 'Content', 'playlist' ],
	[ 'other', 'Also installed', 'spark' ],
];

const iconFor = ( category ) => ( CATEGORIES.find( ( c ) => c[ 0 ] === category ) || [ , , 'spark' ] )[ 2 ];

const KIND_LABEL = {
	media: 'Media',
	playlist: 'Playlist',
	interactive: 'Interactive',
};

const PLACEHOLDER = {
	media: 'e.g. Lesson 1',
	playlist: 'e.g. Onboarding course',
	interactive: 'e.g. Module 1 knowledge check',
};

export default function CreateModal( { initialKind = 'media', kinds = [ 'media', 'playlist' ], onClose, onSubmit, onError } ) {
	const [ kind, setKind ] = useState( initialKind );
	const [ title, setTitle ] = useState( '' );
	const [ mediaType, setMediaType ] = useState( 'self' );
	const [ busy, setBusy ] = useState( '' ); // '' | 'install' | 'create'

	// Interactive-only state.
	const [ types, setTypes ] = useState( null );
	const [ picked, setPicked ] = useState( '' );
	const [ query, setQuery ] = useState( '' );

	// Content types are only needed once the interactive branch is opened.
	useEffect( () => {
		if ( 'interactive' !== kind || types ) {
			return;
		}
		api.h5pContentTypes().then( setTypes ).catch( ( e ) => onError?.( e.message || 'Failed to load content types.' ) );
	}, [ kind, types, onError ] );

	const selected = useMemo(
		() => ( types?.featured || [] ).find( ( t ) => t.machineName === picked ) || null,
		[ types, picked ]
	);

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
		try {
			await api.h5pInstallType( selected.machineName );
			setTypes( await api.h5pContentTypes() );
		} catch ( e ) {
			onError?.( e.message || 'Install failed.' );
		} finally {
			setBusy( '' );
		}
	};

	const needsInstall = 'interactive' === kind && selected && ! selected.installed;
	const canCreate = 'interactive' === kind ? !! selected?.installed : true;

	const submit = async () => {
		if ( ! canCreate ) {
			return;
		}
		setBusy( 'create' );
		try {
			await onSubmit( { kind, title: title.trim(), mediaType, machineName: selected?.machineName || '' } );
		} finally {
			setBusy( '' );
		}
	};

	// Enter submits the simple kinds; the interactive branch needs a type first.
	const onKeyDown = ( e ) => {
		if ( 'Enter' === e.key && canCreate && ! busy ) {
			submit();
		}
	};

	return (
		<Modal
			title={ `Create ${ KIND_LABEL[ kind ].toLowerCase() }` }
			className={ 'interactive' === kind ? 'max-w-3xl' : 'max-w-lg' }
			onClose={ onClose }
			footer={
				<>
					<div className="mr-auto text-[13px] text-muted">
						{ 'interactive' === kind && ! selected && 'Pick a content type to continue.' }
						{ needsInstall && `${ selected.title } isn’t installed yet — it downloads once from the H5P Hub.` }
						{ 'interactive' === kind && selected?.installed && `${ selected.title } is ready to use.` }
					</div>
					<Button variant="ghost" onClick={ onClose }>Cancel</Button>
					{ needsInstall ? (
						<Button onClick={ install } disabled={ 'install' === busy }>{ 'install' === busy ? 'Installing…' : 'Install' }</Button>
					) : (
						<Button onClick={ submit } disabled={ ! canCreate || !! busy }>{ 'create' === busy ? 'Creating…' : 'Create' }</Button>
					) }
				</>
			}
		>
			{ kinds.length > 1 && (
				<div className="inline-flex p-0.5 mb-5 rounded bg-gray-100">
					{ kinds.map( ( k ) => (
						<button
							key={ k }
							type="button"
							onClick={ () => setKind( k ) }
							className={ `px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${ kind === k ? 'bg-white text-brand-500 shadow-sm' : 'text-muted hover:text-ink' }` }
						>
							{ KIND_LABEL[ k ] }
						</button>
					) ) }
				</div>
			) }

			<Field label="Name" hint="Shown in your library. You can rename it later.">
				<Input autoFocus value={ title } onChange={ ( e ) => setTitle( e.target.value ) } onKeyDown={ onKeyDown } placeholder={ PLACEHOLDER[ kind ] } />
			</Field>

			{ 'media' === kind && (
				<div className="mb-1">
					<span className="block text-[13px] font-medium text-ink mb-1.5">Media type</span>
					<div role="radiogroup" aria-label="Media type" className="grid sm:grid-cols-2 gap-2">
						{ MEDIA_TYPES.map( ( t ) => {
							const locked = t.pro && ! isPro();
							return (
								<RadioOption
									key={ t.value }
									option={ t }
									locked={ locked }
									active={ mediaType === t.value }
									onPick={ () => ! locked && setMediaType( t.value ) }
								/>
							);
						} ) }
					</div>
					<span className="block text-xs text-gray-400 mt-2">
						{ isPro() ? 'Change the source details in the editor.' : 'Bunny / Mux / HLS need TruePlayer Pro.' }
					</span>
				</div>
			) }

			{ 'interactive' === kind && (
				<>
					<div className="flex items-center justify-between mt-5 mb-2">
						<span className="text-[13px] font-medium text-label">Content type</span>
						<div className="relative w-56">
							<Icon name="search" className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-placeholder" />
							<Input value={ query } onChange={ ( e ) => setQuery( e.target.value ) } placeholder="Search types" className="!pl-8" />
						</div>
					</div>

					<div className="-mx-1 px-1 pb-1">
						{ ! types && <div className="py-10 text-center text-muted text-sm">Loading content types…</div> }
						{ types && 0 === groups.length && <div className="py-10 text-center text-muted text-sm">No content type matches “{ query }”.</div> }
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
				</>
			) }
		</Modal>
	);
}

/** One media source, as a radio option. */
function RadioOption( { option, active, locked, onPick } ) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={ active }
			disabled={ locked }
			onClick={ onPick }
			className={ `w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded border transition-colors ${
				locked
					? 'border-line bg-gray-50 opacity-60 cursor-not-allowed'
					: active
						? 'border-brand-500 bg-brand-50'
						: 'border-line bg-white hover:border-brand-200 hover:bg-gray-50'
			}` }
		>
			<span
				className={ `mt-0.5 w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${
					active ? 'border-brand-500' : 'border-gray-300'
				}` }
			>
				{ active && <span className="w-2 h-2 rounded-full bg-brand-500" /> }
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-center gap-1.5">
					<span className="text-[13px] font-medium text-ink truncate">{ option.label }</span>
					{ locked && <span className="text-[9px] font-semibold text-brand-500 shrink-0">PRO</span> }
				</span>
				{ option.hint && <span className="block text-xs text-muted mt-0.5 leading-4">{ option.hint }</span> }
			</span>
		</button>
	);
}

/** One selectable H5P content type. */
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
