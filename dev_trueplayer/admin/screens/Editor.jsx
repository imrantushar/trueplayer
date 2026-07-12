import { useEffect, useState, useCallback, createPortal } from '@wordpress/element';
import { api } from '../api';
import { Button, Select, Modal, SubSidebar } from '../components/UI';
import SourceTab from './editor/SourceTab';
import PlayerOptionsTab from './editor/PlayerOptionsTab';
import AppearanceTab from './editor/AppearanceTab';
import OverlaysTab from './editor/OverlaysTab';
import LayersTab from './editor/LayersTab';
import TimedContentTab from './editor/TimedContentTab';
import ProtectionTab from './editor/ProtectionTab';
import GatingTab from './editor/GatingTab';
import SubscribeTab from './editor/SubscribeTab';
import EmbedTab from './editor/EmbedTab';
import PreviewPanel from './editor/PreviewPanel';
import UpsellPanel from '../components/UpsellPanel';
import { isPro } from '../pro';

const TABS = [
	{ key: 'source', label: 'Source', icon: '🎬' },
	{ key: 'player', label: 'Player', icon: '🎛️' },
	{ key: 'appearance', label: 'Chapters & branding', icon: '🔖' },
	{ key: 'interactions', label: 'Interactions', icon: '🧩' },
	{ key: 'access', label: 'Access & gating', icon: '🛡️', pro: true },
];

const PRO_TAB_INFO = {
	access: { title: 'Access & gating', features: [ 'Watch-verification (prove they watched, anti-skip)', 'Checkpoint & final quizzes, lock on failure', 'Private video with signed, expiring links' ] },
};

// Interactions = everything shown on/around the video. Overlays are free;
// layers / timed content / email capture are pro (gated inline).
function InteractionsTab( { config, patch, pro } ) {
	const [ sub, setSub ] = useState( 'overlays' );
	const gate = ( node, info ) => ( pro ? node : <UpsellPanel title={ info.title } features={ info.features } /> );
	return (
		<div className="flex gap-6 items-start">
			<SubSidebar
				value={ sub }
				onChange={ setSub }
				items={ [ [ 'overlays', 'Call to action' ], [ 'layers', 'Layers', ! pro ], [ 'timed', 'Timed content', ! pro ], [ 'subscribe', 'Email capture', ! pro ] ] }
			/>
			<div className="flex-1 min-w-0">
				{ sub === 'overlays' && <OverlaysTab config={ config } patch={ patch } /> }
				{ sub === 'layers' && gate( <LayersTab config={ config } patch={ patch } />, { title: 'Interactive layers', features: [ 'Clickable hotspots over the picture', 'Timed banners & shortcode embeds', 'Conditional display rules' ] } ) }
				{ sub === 'timed' && gate( <TimedContentTab config={ config } patch={ patch } />, { title: 'Timed content', features: [ 'A content region below the player that changes with the video', 'Time-synced forms, buttons & text' ] } ) }
				{ sub === 'subscribe' && gate( <SubscribeTab config={ config } patch={ patch } />, { title: 'Email capture', features: [ 'In-player opt-in gate', 'Send contacts to GemCRM & other CRMs' ] } ) }
			</div>
		</div>
	);
}

// Access & gating = who can watch + proving they watched. All pro (the Editor
// upsells the whole tab for free users).
function AccessTab( { config, patch } ) {
	const [ sub, setSub ] = useState( 'gating' );
	return (
		<div className="flex gap-6 items-start">
			<SubSidebar value={ sub } onChange={ setSub } items={ [ [ 'gating', 'Verification & quiz' ], [ 'protection', 'Protection' ] ] } />
			<div className="flex-1 min-w-0">
				{ sub === 'gating' && <GatingTab config={ config } patch={ patch } /> }
				{ sub === 'protection' && <ProtectionTab config={ config } patch={ patch } /> }
			</div>
		</div>
	);
}

export default function Editor( { id, onBack } ) {
	const [ video, setVideo ] = useState( null );
	const [ tab, setTab ] = useState( 'source' );
	const [ dirty, setDirty ] = useState( false );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );
	const [ presets, setPresets ] = useState( [] );
	const [ toolbarSlot, setToolbarSlot ] = useState( null );
	const [ titleSlot, setTitleSlot ] = useState( null );
	const [ embedOpen, setEmbedOpen ] = useState( false );
	const [ duration, setDuration ] = useState( 0 );

	useEffect( () => {
		api.getVideo( id ).then( ( v ) => setVideo( v ) );
		api.listPresets().then( setPresets ).catch( () => {} );
		setToolbarSlot( document.getElementById( 'tp-topbar-slot' ) );
		setTitleSlot( document.getElementById( 'tp-topbar-title-slot' ) );
	}, [ id ] );

	const patchConfig = useCallback( ( partial ) => {
		setVideo( ( v ) => ( { ...v, config: { ...( v.config || {} ), ...partial } } ) );
		setDirty( true );
		setSaved( false );
	}, [] );

	const setTitle = ( title ) => {
		setVideo( ( v ) => ( { ...v, title } ) );
		setDirty( true );
	};

	const tabIndex = TABS.findIndex( ( t ) => t.key === tab );
	const isLastTab = tabIndex === TABS.length - 1;

	// Save (only hits the API when there are changes), then optionally advance to
	// the next step — a light wizard flow through the editor.
	const save = async ( continueNext = false ) => {
		if ( dirty ) {
			setSaving( true );
			try {
				const updated = await api.updateVideo( id, { title: video.title, config: video.config || {} } );
				setVideo( updated );
				setDirty( false );
				setSaved( true );
				setTimeout( () => setSaved( false ), 2000 );
			} finally {
				setSaving( false );
			}
		}
		if ( continueNext && tabIndex > -1 && tabIndex < TABS.length - 1 ) {
			setTab( TABS[ tabIndex + 1 ].key );
		}
	};

	if ( ! video ) {
		return <main className="flex-1 p-8 text-gray-400">Loading…</main>;
	}

	const config = video.config || {};
	const pro = isPro();
	const isProTab = !! TABS.find( ( t ) => t.key === tab )?.pro;

	return (
		<>
			{ /* Contextual sidebar: the video editor's own step menu */ }
			<aside className="w-56 shrink-0 bg-white border-r border-line flex flex-col">
				<div className="p-3 border-b border-line">
					<button onClick={ onBack } className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100">
						← Back to videos
					</button>
				</div>
				<nav className="flex-1 p-3 space-y-1 overflow-y-auto">
					{ TABS.map( ( t ) => (
						<button
							key={ t.key }
							onClick={ () => setTab( t.key ) }
							className={ `flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition ${
								tab === t.key ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
							}` }
						>
							<span className="text-base leading-none">{ t.icon }</span>
							<span className="flex-1">{ t.label }</span>
							{ t.pro && ! pro && <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 rounded px-1">PRO</span> }
						</button>
					) ) }
				</nav>
			</aside>

			{ /* Content */ }
			<main className="flex-1 min-w-0">
				<div className="max-w-6xl mx-auto px-8 py-8">
					{ /* Toolbar actions live in the topbar (portaled). */ }
					{ toolbarSlot && createPortal(
						<>
							{ presets.length > 0 && (
								<label className="flex items-center gap-2 text-[13px] text-gray-500">
									Preset
									<Select
										className="w-40 h-9"
										value={ config.presetId || '' }
										onChange={ ( e ) => patchConfig( { presetId: e.target.value ? parseInt( e.target.value, 10 ) : undefined } ) }
									>
										<option value="">None</option>
										{ presets.map( ( p ) => <option key={ p.id } value={ p.id }>{ p.title }</option> ) }
									</Select>
								</label>
							) }
							{ saved && <span className="text-sm text-green-600">Saved ✓</span> }
							{ dirty && ! saved && <span className="text-sm text-amber-600">Unsaved</span> }
							<Button variant="ghost" onClick={ () => setEmbedOpen( true ) }>Embed</Button>
							{ isLastTab ? (
								<Button onClick={ () => save( false ) } disabled={ saving || ! dirty }>{ saving ? 'Saving…' : 'Save' }</Button>
							) : (
								<>
									<Button variant="ghost" onClick={ () => save( false ) } disabled={ saving || ! dirty }>Save</Button>
									<Button onClick={ () => save( true ) } disabled={ saving }>{ saving ? 'Saving…' : 'Save & Continue' }</Button>
								</>
							) }
						</>,
						toolbarSlot
					) }

					{ /* Editable media title, portaled into the topbar. */ }
					{ titleSlot && createPortal(
						<input
							className="text-sm font-semibold text-ink bg-transparent outline-none border-b border-transparent focus:border-brand-500 w-56 max-w-[40vw]"
							value={ video.title }
							onChange={ ( e ) => setTitle( e.target.value ) }
							placeholder="Untitled media"
							aria-label="Media title"
						/>,
						titleSlot
					) }

					{ embedOpen && (
						<Modal title="Embed this media" onClose={ () => setEmbedOpen( false ) } className="max-w-lg">
							<EmbedTab video={ video } config={ config } patch={ patchConfig } />
						</Modal>
					) }

					<div className="mb-6">
						<h1 className="text-2xl font-bold text-gray-900">{ TABS.find( ( t ) => t.key === tab )?.label }</h1>
					</div>

					<div className="flex flex-col xl:flex-row gap-6 items-start">
						<div className="flex-1 min-w-0 w-full">
							{ isProTab && ! pro ? (
								<UpsellPanel title={ PRO_TAB_INFO[ tab ].title } features={ PRO_TAB_INFO[ tab ].features } />
							) : (
								<>
									{ tab === 'source' && <SourceTab config={ config } patch={ patchConfig } /> }
									{ tab === 'player' && <PlayerOptionsTab config={ config } patch={ patchConfig } /> }
									{ tab === 'appearance' && <AppearanceTab config={ config } patch={ patchConfig } duration={ duration } /> }
									{ tab === 'interactions' && <InteractionsTab config={ config } patch={ patchConfig } pro={ pro } /> }
									{ tab === 'access' && <AccessTab config={ config } patch={ patchConfig } /> }
								</>
							) }
						</div>

						<div className="w-full xl:w-[380px] shrink-0">
							<div className="xl:sticky xl:top-4">
								<PreviewPanel id={ id } config={ config } onDuration={ setDuration } />
							</div>
						</div>
					</div>
				</div>
			</main>
		</>
	);
}
