import { useState } from '@wordpress/element';
import { Button, Modal, Field, Input } from '../components/UI';
import { Icon } from '../components/icons';
import { SOURCE_TYPES } from '@Utils/source-types';
import { defaultLook } from '../utils/default-look';
import { libraryKinds } from '@Ext/admin';
import { __, __sprintf } from '@Utils/translation';

/**
 * The library's single creation surface. Whatever the caller starts on — a
 * player, a playlist, or an extension kind — it's the same dialog with the
 * same shape, so the split button can drop the user straight into any kind.
 * An extension kind supplies its own body and footer through `useCreate`.
 */

// The tiles come from the shared list so a new source type appears here without
// anyone remembering this file exists — which is how `bunnyStorage` ended up in
// three of the five places that used to keep their own copy.
const MEDIA_TYPES = SOURCE_TYPES;

const KIND_LABEL = {
	media: __( 'Media' ),
	playlist: __( 'Playlist' ),
	...Object.fromEntries( libraryKinds.map( ( k ) => [ k.kind, k.label ] ) ),
};

// Written out per kind rather than lower-casing KIND_LABEL into a template:
// case rules and word order differ by language, so the whole heading has to be
// one translatable string.
const KIND_HEADING = {
	media: __( 'Create media' ),
	playlist: __( 'Create playlist' ),
	...Object.fromEntries( libraryKinds.map( ( k ) => [ k.kind, k.heading ] ) ),
};

export default function CreateModal( { initialKind = 'media', initialMediaKind = 'video', kinds = [ 'media', 'playlist' ], onClose, onSubmit, onError } ) {
	const [ kind, setKind ] = useState( initialKind );
	const [ title, setTitle ] = useState( '' );
	// 'self' carries both kinds (SOURCE_TYPES), so it is a valid starting point
	// whichever tab opens first.
	const [ sourceType, setSourceType ] = useState( 'self' );
	// Video vs audio — the thing `source.mediaType` actually means. Distinct
	// from `sourceType` above (self / bunny / youtube …), which is the delivery
	// method. Conflating the two is what this file used to do.
	// Seeded by the caller so the library's Audio filter opens this on Audio —
	// the dialog is reached from a screen that already knows which it wants.
	const [ mediaKind, setMediaKind ] = useState( initialMediaKind );
	const [ busy, setBusy ] = useState( '' ); // '' | 'create'

	// Only sources that can carry audio when the Audio tab is showing. This is
	// AUDIO_SOURCES' second consumer — it had exactly one before.
	const sourceTiles = 'audio' === mediaKind ? MEDIA_TYPES.filter( ( t ) => t.audio ) : MEDIA_TYPES;

	// Every extension kind's create state, called unconditionally (hooks).
	const extCreate = Object.fromEntries( libraryKinds.map( ( k ) => [ k.kind, k.useCreate( { active: kind === k.kind, onError } ) ] ) );
	const ext = extCreate[ kind ] || null;
	const canCreate = ext ? ext.canCreate : true;

	const submit = async () => {
		if ( ! canCreate ) {
			return;
		}
		setBusy( 'create' );
		try {
			await onSubmit( { kind, title: title.trim(), sourceType, mediaKind, ...( ext ? ext.values : {} ) } );
		} finally {
			setBusy( '' );
		}
	};

	// Enter submits once the kind has what it needs.
	const onKeyDown = ( e ) => {
		if ( 'Enter' === e.key && canCreate && ! busy ) {
			submit();
		}
	};

	return (
		<Modal
			title={ KIND_HEADING[ kind ] }
			onClose={ onClose }
			footer={
				<>
					<div className="mr-auto text-[13px] text-muted">
						{ ext && ext.note }
					</div>
					<Button variant="ghost" onClick={ onClose }>{ __( 'Cancel' ) }</Button>
					{ ext && ext.action ? (
						ext.action
					) : (
						<Button onClick={ submit } disabled={ ! canCreate || !! busy }>{ 'create' === busy ? __( 'Creating…' ) : __( 'Create' ) }</Button>
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

			<Field label={ __( 'Name' ) } hint={ __( 'Shown in your library. You can rename it later.' ) }>
				<Input autoFocus value={ title } onChange={ ( e ) => setTitle( e.target.value ) } onKeyDown={ onKeyDown } placeholder={ __( 'Title' ) } />
			</Field>

			{ 'media' === kind && (
				<div className="mb-1">
					{ /* Which player this becomes. Chosen here rather than left to a
					     toggle buried in the editor, so an audio item is audio from
					     the moment it exists. */ }
					<span className="block text-[13px] font-medium text-ink mb-1.5">{ __( 'What are you adding?' ) }</span>
					<div className="tp-type-tabs mb-4" role="tablist">
						{ [ [ 'video', __( 'Video' ) ], [ 'audio', __( 'Audio' ) ] ].map( ( [ value, label ] ) => (
							<button
								key={ value }
								type="button"
								role="tab"
								aria-selected={ mediaKind === value }
								className={ `tp-type-tab ${ mediaKind === value ? 'is-active' : '' }` }
								onClick={ () => {
									setMediaKind( value );
									// The chosen source may not support the new kind
									// (YouTube can't be audio-only) — fall back to the
									// first that can.
									const allowed = 'audio' === value ? SOURCE_TYPES.filter( ( t ) => t.audio ) : SOURCE_TYPES;
									if ( ! allowed.some( ( t ) => t.value === sourceType ) ) {
										setSourceType( allowed[ 0 ].value );
									}
								} }
							>{ label }</button>
						) ) }
					</div>
					{ /* Which site-wide look this item will come out wearing. The
					     setting has always applied at this moment; it was just
					     never said, so the first sight of it was the finished
					     player — and an author who wanted something else had no
					     reason to suspect a site default existed at all. Named
					     per type, because the two are answered separately. */ }
					{ ( () => {
						const look = defaultLook( mediaKind );
						return (
							<p className="flex items-start gap-1.5 text-xs text-muted mb-4 -mt-2">
								<Icon name="sliders" className="w-3.5 h-3.5 shrink-0 mt-px" />
								<span>
									{ look.preset
										? __sprintf( 'It will use %s until you give it a look of its own.', look.label )
										: __sprintf( 'It will use the %s look until you give it one of its own.', look.label ) }
								</span>
							</p>
						);
					} )() }
					<span className="block text-[13px] font-medium text-ink mb-1.5">{ __( 'Source' ) }</span>
					<div role="radiogroup" aria-label={ __( 'Source' ) } className="grid sm:grid-cols-2 gap-2">
						{ sourceTiles.map( ( t ) => (
							<RadioOption
								key={ t.value }
								option={ t }
								active={ sourceType === t.value }
								onPick={ () => setSourceType( t.value ) }
							/>
						) ) }
					</div>
					<span className="block text-xs text-gray-400 mt-2">
						{ __( 'Change the source details in the editor.' ) }
					</span>
				</div>
			) }

			{ ext && ext.body }
		</Modal>
	);
}

/** One media source, as a radio option. */
function RadioOption( { option, active, onPick } ) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={ active }
			onClick={ onPick }
			className={ `w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded border transition-colors ${
				active
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
				</span>
				{ option.hint && <span className="block text-xs text-muted mt-0.5 leading-4">{ option.hint }</span> }
			</span>
		</button>
	);
}
