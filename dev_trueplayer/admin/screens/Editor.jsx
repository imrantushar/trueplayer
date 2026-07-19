import { useEffect, useState, useCallback, createPortal } from '@wordpress/element';
import { api } from '../api';
import { Button, Modal, SubSidebar, Toast, Badge } from '../components/UI';
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
import { hasVideoSource } from '../utils/videoSource';

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
		<div className="flex flex-col md:flex-row gap-6 items-start">
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
		<div className="flex flex-col md:flex-row gap-6 items-start">
			<SubSidebar value={ sub } onChange={ setSub } items={ [ [ 'gating', 'Verification & quiz' ], [ 'protection', 'Protection' ] ] } />
			<div className="flex-1 min-w-0">
				{ sub === 'gating' && <GatingTab config={ config } patch={ patch } /> }
				{ sub === 'protection' && <ProtectionTab config={ config } patch={ patch } /> }
			</div>
		</div>
	);
}

export default function Editor( { id, onEditState } ) {
	const [ video, setVideo ] = useState( null );
	const [ tab, setTab ] = useState( 'source' );
	const [ dirty, setDirty ] = useState( false );
	const [ saving, setSaving ] = useState( false );
	const [ presets, setPresets ] = useState( [] );
	const [ toolbarSlot, setToolbarSlot ] = useState( null );
	const [ embedOpen, setEmbedOpen ] = useState( false );
	const [ duration, setDuration ] = useState( 0 );
	const [ toast, setToast ] = useState( null );

	useEffect( () => {
		api.getVideo( id ).then( ( v ) => setVideo( v ) );
		api.listPresets().then( setPresets ).catch( () => {} );
		setToolbarSlot( document.getElementById( 'tp-topbar-slot' ) );
	}, [ id ] );

	useEffect( () => {
		if ( ! toast ) {
			return undefined;
		}
		const t = setTimeout( () => setToast( null ), 3000 );
		return () => clearTimeout( t );
	}, [ toast ] );

	const patchConfig = useCallback( ( partial ) => {
		setVideo( ( v ) => ( { ...v, config: { ...( v.config || {} ), ...partial } } ) );
		setDirty( true );
	}, [] );

	const setTitle = ( title ) => {
		setVideo( ( v ) => ( { ...v, title } ) );
		setDirty( true );
	};

	// Report title/dirty state up to the app shell — it drives the breadcrumb
	// (the title is edited right in the crumb trail) and the unsaved-changes
	// guard when leaving.
	useEffect( () => {
		onEditState && onEditState( { title: video?.title, dirty, onTitleChange: setTitle } );
	}, [ video?.title, dirty ] );
	useEffect( () => () => onEditState && onEditState( null ), [] );

	// Update always saves the whole video (title + config) regardless of which
	// step is active — every tab patches the same shared config object — and
	// never advances the step for you.
	const save = async () => {
		if ( ! hasVideoSource( video.config?.source || {} ) ) {
			setToast( { message: 'Add a video before saving.', tone: 'danger' } );
			return;
		}
		if ( ! dirty ) {
			return;
		}
		setSaving( true );
		try {
			const updated = await api.updateVideo( id, { title: video.title, config: video.config || {} } );
			setVideo( updated );
			setDirty( false );
			setToast( { message: 'Saved ✓', tone: 'success' } );
		} finally {
			setSaving( false );
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
			<div className="w-full mx-auto px-8 py-8">
				{ /* Toolbar actions live in the topbar (portaled). */ }
				{ toolbarSlot && createPortal(
					<>
						{ dirty && <Badge tone="amber">Unsaved</Badge> }
						<Button variant="ghost" onClick={ () => setEmbedOpen( true ) }>Embed</Button>
						<Button onClick={ save } disabled={ saving || ! dirty }>
							{ saving ? 'Saving…' : 'Update' }
						</Button>
					</>,
					toolbarSlot
				) }

				<Toast message={ toast?.message } tone={ toast?.tone } onDismiss={ () => setToast( null ) } />

				{ embedOpen && (
					<Modal title="Embed this media" onClose={ () => setEmbedOpen( false ) } className="max-w-lg">
						<EmbedTab video={ video } config={ config } patch={ patchConfig } />
					</Modal>
				) }

				<div className="flex flex-col md:flex-row gap-6 items-start">
					{ /* Contextual sidebar: the video editor's own step menu. Sticky is applied
						directly to this element (not a nested <nav>) — it must be the flex row's
						direct child for position:sticky to have room to stick against the row's
						full height, matched by the tall content column next to it. */ }
					<aside className="w-full md:w-60 shrink-0 bg-white border-r border-line md:sticky md:top-[104px]">
						<nav className="p-3 space-y-1">
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

					<div className="flex-1 min-w-0 w-full">
						<div className="mb-6">
							<h1 className="text-2xl font-bold text-gray-900">{ TABS.find( ( t ) => t.key === tab )?.label }</h1>
						</div>

						<div className="flex flex-col min-[1440px]:flex-row gap-6 items-start mt-6">
							{ /* Tabs with their own sub-nav (Player/Interactions/Access) need more
								room than max-w-2xl (that's eaten into by the sub-nav's own width),
								but still a bounded width — the preview (flex-1 below) gets whatever's
								left, which is where the extra space is actually useful. */ }
							<div className={ `w-full min-w-0 ${ [ 'player', 'interactions', 'access' ].includes( tab ) ? 'min-[1440px]:max-w-3xl min-[1440px]:shrink-0' : 'max-w-2xl' }` }>
								{ isProTab && ! pro ? (
									<UpsellPanel title={ PRO_TAB_INFO[ tab ].title } features={ PRO_TAB_INFO[ tab ].features } />
								) : (
									<>
										{ tab === 'source' && <SourceTab config={ config } patch={ patchConfig } /> }
										{ tab === 'player' && <PlayerOptionsTab config={ config } patch={ patchConfig } presets={ presets } /> }
										{ tab === 'appearance' && <AppearanceTab config={ config } patch={ patchConfig } duration={ duration } /> }
										{ tab === 'interactions' && <InteractionsTab config={ config } patch={ patchConfig } pro={ pro } /> }
										{ tab === 'access' && <AccessTab config={ config } patch={ patchConfig } /> }
									</>
								) }
							</div>

							{ /* Below 1440px the preview drops under the content and takes the
								full row width; at 1440px+ it takes whatever's left beside the
								(now bounded) content column, instead of a small fixed width. */ }
							<div className="w-full min-[1440px]:flex-1 min-[1440px]:min-w-[420px] min-[1440px]:sticky min-[1440px]:top-[104px]">
								<PreviewPanel id={ id } config={ config } onDuration={ setDuration } />
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
