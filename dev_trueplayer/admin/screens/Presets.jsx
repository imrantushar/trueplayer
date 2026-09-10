import { useEffect, useState, useMemo, useRef, createPortal } from '@wordpress/element';
import { api } from '../api';
import { Card, Button, Input, Select, Field, Modal, OptionMenu } from '../components/UI';
import { Icon } from '../components/icons';
import { isPro } from '../pro';
import { templatesFor, templateConfig } from '../data/preset-templates';
import PlayerOptionsTab from './editor/PlayerOptionsTab';
import PreviewPanel from './editor/PreviewPanel';
import { isAudioSource } from '@Utils/audio';
import { __ } from '@Utils/translation';

/** A preset's type, defaulting to video for everything made before audio. */
const presetType = ( p ) => ( 'audio' === p?.type ? 'audio' : 'video' );

// Built-in samples so a preset can be previewed even before any media exists.
// An audio preset previewed against a video sample shows nothing it controls,
// so each type gets its own.
const SAMPLE_SOURCE = { type: 'url', src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', poster: '' };
const SAMPLE_AUDIO_SOURCE = { type: 'url', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', poster: '', mediaType: 'audio' };

function Editor( { preset, onBack, onSaved, onEditState } ) {
	// A preset has no `source`, so the type it styles cannot be inferred the way
	// the video editor infers it — it is carried explicitly.
	const presetType = 'audio' === preset.type ? 'audio' : 'video';
	const [ title, setTitle ] = useState( preset.title );
	const [ config, setConfig ] = useState( preset.config || {} );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );
	const [ dirty, setDirty ] = useState( false );
	const [ toolbarSlot, setToolbarSlot ] = useState( null );
	const mounted = useRef( false );

	useEffect( () => {
		setToolbarSlot( document.getElementById( 'tp-topbar-slot' ) );
	}, [] );

	// title/config are seeded once from `preset` — any change after mount is a
	// real edit.
	useEffect( () => {
		if ( ! mounted.current ) {
			mounted.current = true;
			return;
		}
		setDirty( true );
	}, [ title, config ] );

	// Report title/dirty/back state up to the app shell — it drives the
	// breadcrumb ("Presets > this preset", title editable right in the trail,
	// "Presets" clicking back to the list) and the unsaved-changes guard.
	useEffect( () => {
		onEditState && onEditState( { title, dirty, onBack, onTitleChange: setTitle } );
	}, [ title, dirty ] );
	useEffect( () => () => onEditState && onEditState( null ), [] );

	// Preview subject: preview the preset's styling on a real video's source.
	const [ videos, setVideos ] = useState( [] );
	const [ previewId, setPreviewId ] = useState( 0 );
	useEffect( () => {
		api.listVideos().then( ( list ) => {
			// Only offer media of the kind this preset actually styles.
			const withSrc = ( list || [] ).filter(
				( v ) => v.config?.source?.src && isAudioSource( v.config.source ) === ( 'audio' === presetType )
			);
			setVideos( withSrc );
			setPreviewId( withSrc[ 0 ]?.id || 0 );
		} );
	}, [ presetType ] );

	// PlayerOptionsTab edits config.customize / config.branding — the exact shape
	// a preset stores, so we reuse it directly.
	const patch = ( partial ) => { setConfig( ( c ) => ( { ...c, ...partial } ) ); setSaved( false ); };

	const save = async () => {
		setSaving( true );
		try {
			await api.updatePreset( preset.id, { title, config } );
			setDirty( false );
			setSaved( true );
			setTimeout( () => setSaved( false ), 2000 );
			onSaved();
		} finally {
			setSaving( false );
		}
	};

	// The preset's look (config) applied over a real source, for the live player.
	const previewVideo = videos.find( ( v ) => v.id === previewId );
	const previewConfig = useMemo(
		() => ( {
			...config,
			source: previewVideo?.config?.source || ( 'audio' === presetType ? SAMPLE_AUDIO_SOURCE : SAMPLE_SOURCE ),
			chapters: previewVideo?.config?.chapters || [],
		} ),
		[ config, previewVideo, presetType ]
	);

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
			<p className="text-sm text-muted mb-4">{ 'audio' === presetType
				? __( 'These styles & behaviours apply to any audio that uses this preset. Individual items can still override anything.' )
				: __( 'These styles & behaviours apply to any video that uses this preset. Individual videos can still override anything.' ) }</p>

			<div className="flex flex-col xl:flex-row items-start gap-6 mt-6">
				<div className="flex-1 min-w-0">
					<PlayerOptionsTab config={ config } patch={ patch } mediaType={ presetType } />
				</div>

				{ /* Sticky header (top-8) + its h-14 bar are ~88px; top-[104px] clears both with a small gap. */ }
				<div className="w-full xl:w-[400px] shrink-0 xl:sticky xl:top-[104px]">
					<Card className="p-4">
						{ videos.length > 0 && (
							<div className="flex items-center gap-2 mb-3">
								<span className="text-xs text-muted whitespace-nowrap">{ __( 'Preview with' ) }</span>
								<Select value={ previewId } onChange={ ( e ) => setPreviewId( parseInt( e.target.value, 10 ) ) } className="h-9 text-[13px]">
									{ videos.map( ( v ) => <option key={ v.id } value={ v.id }>{ v.title }</option> ) }
								</Select>
							</div>
						) }
						<PreviewPanel id={ previewId || 0 } config={ previewConfig } title={ previewVideo?.title || __( 'Sample track' ) } />
					</Card>
				</div>
			</div>
		</div>
	);
}

export default function Presets( { onEditState } ) {
	const [ presets, setPresets ] = useState( null );
	const [ title, setTitle ] = useState( '' );
	// Which half of the list is showing, and which kind the create modal builds.
	const [ tab, setTab ] = useState( 'video' );
	const [ newType, setNewType ] = useState( 'video' );
	const [ template, setTemplate ] = useState( 'default' );
	const [ adding, setAdding ] = useState( false );
	const [ busy, setBusy ] = useState( false );
	const [ editing, setEditing ] = useState( null );

	const load = () => api.listPresets().then( setPresets );
	useEffect( () => { load(); }, [] );

	// One fetch, split here — the tab counts need both halves at once, and 200
	// presets with their configs is a single cheap request either way.
	const shown = ( presets || [] ).filter( ( p ) => presetType( p ) === tab );

	const create = async () => {
		setBusy( true );
		try {
			const label = templatesFor( newType ).find( ( t ) => t.key === template )?.label || __( 'Untitled preset' );
			const p = await api.createPreset(
				title || label,
				template === 'blank' ? {} : templateConfig( template, newType ),
				newType
			);
			setTitle( '' );
			setAdding( false );
			await load();
			setEditing( p );
		} finally {
			setBusy( false );
		}
	};
	const remove = async ( id ) => {
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( __( 'Delete this preset? Videos using it fall back to defaults.' ) ) ) {
			return;
		}
		await api.deletePreset( id );
		load();
	};

	if ( editing ) {
		return <Editor preset={ editing } onBack={ () => { setEditing( null ); load(); } } onSaved={ load } onEditState={ onEditState } />;
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-ink">{ __( 'Player presets' ) }</h1>
					<p className="text-sm text-muted">{ __( 'Reusable styles & behaviour — brand once, use everywhere.' ) }</p>
				</div>
				<Button onClick={ () => { setTitle( '' ); setNewType( tab ); setTemplate( 'audio' === tab ? 'podcast' : 'default' ); setAdding( true ); } }><Icon name="plus" className="w-4 h-4" /> { __( 'Add preset' ) }</Button>
			</div>

			{ adding && (
				<Modal
					title={ __( 'Create preset' ) }
					onClose={ () => setAdding( false ) }
					footer={
						<>
							<Button variant="ghost" onClick={ () => setAdding( false ) }>{ __( 'Cancel' ) }</Button>
							<Button onClick={ create } disabled={ busy }>{ busy ? __( 'Creating…' ) : __( 'Create preset' ) }</Button>
						</>
					}
				>
					{ /* The type is fixed at creation — it decides which player the
					     preset styles, and changing it later would restyle every item
					     already using it. Hence a choice here, not a setting inside. */ }
					<Field label={ __( 'Player type' ) } hint={ __( 'Video and audio presets configure different players.' ) }>
						<div className="tp-type-tabs" role="tablist">
							{ [ [ 'video', __( 'Video' ) ], [ 'audio', __( 'Audio' ) ] ].map( ( [ value, label ] ) => (
								<button
									key={ value }
									type="button"
									role="tab"
									aria-selected={ newType === value }
									className={ `tp-type-tab ${ newType === value ? 'is-active' : '' }` }
									onClick={ () => {
										setNewType( value );
										// Template keys don't overlap between the two lists.
										setTemplate( 'audio' === value ? 'podcast' : 'default' );
									} }
								>{ label }</button>
							) ) }
						</div>
					</Field>
					<Field label={ __( 'Preset name' ) }>
						<Input autoFocus value={ title } onChange={ ( e ) => setTitle( e.target.value ) } onKeyDown={ ( e ) => e.key === 'Enter' && create() } placeholder={ 'audio' === newType ? __( 'e.g. Podcast — dark' ) : __( 'e.g. Brand — dark' ) } />
					</Field>
					<Field label={ __( 'Start from' ) } hint={ __( 'A predefined look to begin with — you can change everything after.' ) }>
						<Select value={ template } onChange={ ( e ) => setTemplate( e.target.value ) }>
							<option value="blank">{ __( 'Blank (defaults)' ) }</option>
							{ templatesFor( newType ).map( ( t ) => (
								<option key={ t.key } value={ t.key } disabled={ t.pro && ! isPro() }>
									{ t.label }{ t.pro && ! isPro() ? __( ' — needs Pro' ) : '' }
								</option>
							) ) }
						</Select>
					</Field>
				</Modal>
			) }

			{ presets !== null && (
				<div className="tp-type-tabs mb-5" role="tablist">
					{ [ [ 'video', __( 'Video' ) ], [ 'audio', __( 'Audio' ) ] ].map( ( [ value, label ] ) => (
						<button
							key={ value }
							type="button"
							role="tab"
							aria-selected={ tab === value }
							className={ `tp-type-tab ${ tab === value ? 'is-active' : '' }` }
							onClick={ () => setTab( value ) }
						>
							{ label }
							<span className="tp-type-tab-count">{ presets.filter( ( p ) => presetType( p ) === value ).length }</span>
						</button>
					) ) }
				</div>
			) }

			{ presets === null && <p className="text-gray-400">{ __( 'Loading…' ) }</p> }
			{ presets && shown.length === 0 && (
				<Card className="p-12 text-center border-dashed">
					<div className="mx-auto mb-3 w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center"><Icon name="presets" className="w-6 h-6" /></div>
					<p className="font-semibold text-gray-900">{ 'audio' === tab ? __( 'No audio presets yet' ) : __( 'No video presets yet' ) }</p>
					<p className="text-sm text-gray-500">{ 'audio' === tab
						? __( 'Create one to reuse a consistent audio player style across episodes.' )
						: __( 'Create one to reuse a consistent player style across videos.' ) }</p>
				</Card>
			) }

			<div className="space-y-3">
				{ shown.map( ( p ) => {
					const accent = p.config?.customize?.appearance?.accent || '#006BFF';
					return (
						<Card key={ p.id } className="p-4 flex items-center gap-4 hover:border-brand-200 transition-colors">
							<span className="w-10 h-10 rounded-lg border border-line shrink-0" style={ { background: accent } } />
							<div className="flex-1 min-w-0">
								<div className="font-semibold text-ink truncate">{ p.title }</div>
								<div className="text-xs text-gray-500">{ 'audio' === presetType( p ) ? __( 'Audio preset' ) : __( 'Video preset' ) }</div>
							</div>
							<OptionMenu items={ [
								{ label: __( 'Edit' ), icon: 'edit', onClick: () => setEditing( p ) },
								{ label: __( 'Delete' ), icon: 'trash', danger: true, onClick: () => remove( p.id ) },
							] } />
						</Card>
					);
				} ) }
			</div>
		</div>
	);
}
