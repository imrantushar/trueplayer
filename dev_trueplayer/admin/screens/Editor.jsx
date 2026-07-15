import { useEffect, useState, useCallback, createPortal } from '@wordpress/element';
import { api } from '../api';
import { Button, Card, Select } from '../components/UI';
import SourceTab from './editor/SourceTab';
import PlayerOptionsTab from './editor/PlayerOptionsTab';
import AppearanceTab from './editor/AppearanceTab';
import OverlaysTab from './editor/OverlaysTab';
import LayersTab from './editor/LayersTab';
import TimedContentTab from './editor/TimedContentTab';
import ProtectionTab from './editor/ProtectionTab';
import GatingTab from './editor/GatingTab';
import SubscribeTab from './editor/SubscribeTab';
import WebhooksTab from './editor/WebhooksTab';
import EmbedTab from './editor/EmbedTab';
import PreviewPanel from './editor/PreviewPanel';
import UpsellPanel from '../components/UpsellPanel';
import { isPro } from '../pro';

const TABS = [
	{ key: 'source', label: 'Source', icon: '🎬' },
	{ key: 'player', label: 'Player options', icon: '🎛️' },
	{ key: 'appearance', label: 'Chapters & logo', icon: '🔖' },
	{ key: 'overlays', label: 'Call to action', icon: '📣' },
	{ key: 'layers', label: 'Layers', icon: '🧩', pro: true },
	{ key: 'timed', label: 'Timed content', icon: '⏱️', pro: true },
	{ key: 'protection', label: 'Protection', icon: '🛡️', pro: true },
	{ key: 'gating', label: 'Questions & gating', icon: '✅', pro: true },
	{ key: 'subscribe', label: 'Subscribe', icon: '✉️', pro: true },
	{ key: 'webhooks', label: 'Automation', icon: '🔗', pro: true },
	{ key: 'embed', label: 'Embed', icon: '📋' },
];

const PRO_TAB_INFO = {
	layers: { title: 'Interactive layers', features: [ 'Clickable hotspots over the picture', 'Timed banners & shortcode embeds', 'Inline email-capture forms' ] },
	timed: { title: 'Timed content', features: [ 'A content region below the player that changes with the video', 'Time-synced forms, buttons & text', 'Any shortcode, per time range' ] },
	protection: { title: 'Content protection', features: [ 'Private video with signed, expiring links', 'Bunny.net token authentication', 'Dynamic viewer-identity watermark' ] },
	gating: { title: 'Watch-verification & quiz gating', features: [ 'Prove viewers actually watched (anti-skip)', 'Checkpoint & final quizzes', 'Lock the video on failure until re-watch' ] },
	subscribe: { title: 'Subscribe / email capture', features: [ 'In-player opt-in gate', 'Send contacts to GemCRM & other CRMs' ] },
	webhooks: { title: 'Automation & webhooks', features: [ 'Signed webhooks on every event', 'Zapier / gemcrm / zaplane ready' ] },
};

export default function Editor( { id, onEditState } ) {
	const [ video, setVideo ] = useState( null );
	const [ tab, setTab ] = useState( 'source' );
	const [ dirty, setDirty ] = useState( false );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );
	const [ presets, setPresets ] = useState( [] );
	const [ toolbarSlot, setToolbarSlot ] = useState( null );

	useEffect( () => {
		api.getVideo( id ).then( ( v ) => setVideo( v ) );
		api.listPresets().then( setPresets ).catch( () => {} );
		setToolbarSlot( document.getElementById( 'tp-topbar-slot' ) );
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

	// Report title/dirty state up to the app shell — it drives the breadcrumb
	// (title next to "Videos") and the unsaved-changes guard when leaving.
	useEffect( () => {
		onEditState && onEditState( { title: video?.title, dirty, onTitleChange: setTitle } );
	}, [ video?.title, dirty ] );
	useEffect( () => () => onEditState && onEditState( null ), [] );

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
		<main className="flex-1 min-w-0">
			<div className="max-w-[1250px] mx-auto px-8 py-8">
				{ /* Toolbar actions live in the topbar (portaled). */ }
				{ toolbarSlot && createPortal(
					<>
						{ dirty && ! saved && <span className="text-sm text-amber-600">Unsaved</span> }
						{ presets.length > 0 && (
							<label className="flex items-center gap-2 text-[13px] text-gray-500">
								Preset
								<Select
									className="w-40"
									value={ config.presetId || '' }
									onChange={ ( e ) => patchConfig( { presetId: e.target.value ? parseInt( e.target.value, 10 ) : undefined } ) }
								>
									<option value="">None</option>
									{ presets.map( ( p ) => <option key={ p.id } value={ p.id }>{ p.title }</option> ) }
								</Select>
							</label>
						) }
						{ saved && <span className="text-sm text-green-600">Saved ✓</span> }
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

				<div className="flex flex-col md:flex-row gap-6 items-start">
					{ /* Contextual sidebar: the video editor's own step menu — same sticky pattern as the Settings sidebar. */ }
					<Card className="w-full md:w-56 shrink-0 md:sticky md:top-[104px] p-2 space-y-1">
						<nav className="space-y-1">
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
					</Card>

					<div className="flex-1 min-w-0 w-full">
						<div className="flex flex-col xl:flex-row gap-6 items-start">
							<div className="flex-1 min-w-0 w-full">
								{ isProTab && ! pro ? (
									<UpsellPanel title={ PRO_TAB_INFO[ tab ].title } features={ PRO_TAB_INFO[ tab ].features } />
								) : (
									<>
										{ tab === 'source' && <SourceTab config={ config } patch={ patchConfig } /> }
										{ tab === 'player' && <PlayerOptionsTab config={ config } patch={ patchConfig } /> }
										{ tab === 'appearance' && <AppearanceTab config={ config } patch={ patchConfig } /> }
										{ tab === 'overlays' && <OverlaysTab config={ config } patch={ patchConfig } /> }
										{ tab === 'layers' && <LayersTab config={ config } patch={ patchConfig } /> }
										{ tab === 'timed' && <TimedContentTab config={ config } patch={ patchConfig } /> }
										{ tab === 'protection' && <ProtectionTab config={ config } patch={ patchConfig } /> }
										{ tab === 'gating' && <GatingTab config={ config } patch={ patchConfig } /> }
										{ tab === 'subscribe' && <SubscribeTab config={ config } patch={ patchConfig } /> }
										{ tab === 'webhooks' && <WebhooksTab config={ config } patch={ patchConfig } /> }
										{ tab === 'embed' && <EmbedTab video={ video } config={ config } patch={ patchConfig } /> }
									</>
								) }
							</div>

							<div className="w-full xl:w-[380px] shrink-0 xl:sticky xl:top-[104px]">
								<PreviewPanel id={ id } config={ config } />
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
