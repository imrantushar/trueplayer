import { useEffect, useState, useCallback, createPortal } from '@wordpress/element';
import { api } from '../api';
import { Button, Modal, Toast, Badge } from '../components/UI';
import { Icon } from '../components/icons';
import SourceTab from './editor/SourceTab';
import PlayerOptionsTab, { PLAYER_SUBS } from './editor/PlayerOptionsTab';
import AppearanceTab from './editor/AppearanceTab';
import OverlaysTab from './editor/OverlaysTab';
import LayersTab from './editor/LayersTab';
import EmbedTab from './editor/EmbedTab';
import PreviewPanel from './editor/PreviewPanel';
import { isAudioSource } from '@Utils/audio';
import { editorTabs, editorSubs } from '@Ext/admin';
import { hasVideoSource } from '../utils/videoSource';
import { __ } from '@Utils/translation';

// Interactions sub-sections; extensions can add their own.
const INTERACTIONS_SUBS = [
	[ 'overlays', __( 'Call to action' ) ],
	[ 'layers', __( 'Layers' ) ],
	...( editorSubs.interactions || [] ).map( ( x ) => [ x.key, x.label ] ),
];

const TABS = [
	{ key: 'source', label: __( 'Source' ), icon: 'film' },
	{ key: 'player', label: __( 'Player' ), icon: 'sliders', subs: PLAYER_SUBS },
	{ key: 'appearance', label: __( 'Chapters & branding' ), icon: 'bookmark' },
	{ key: 'interactions', label: __( 'Interactions' ), icon: 'puzzle', subs: INTERACTIONS_SUBS },
	...editorTabs.map( ( t ) => ( { key: t.key, label: t.label, icon: t.icon, subs: t.subs } ) ),
];

// Interactions = everything shown on/around the video. The sub-nav lives in
// the editor's left-nav accordion, so this renders the active one only.
function InteractionsTab( { config, patch, sub = 'overlays', onPreviewOverlay, previewingId, onPreviewLayer, previewingLayerId } ) {
	const extSub = ( editorSubs.interactions || [] ).find( ( x ) => x.key === sub );
	return (
		<div className="w-full min-w-0">
			{ sub === 'overlays' && <OverlaysTab config={ config } patch={ patch } onPreviewOverlay={ onPreviewOverlay } previewingId={ previewingId } /> }
			{ sub === 'layers' && <LayersTab config={ config } patch={ patch } onPreviewLayer={ onPreviewLayer } previewingLayerId={ previewingLayerId } /> }
			{ extSub && <extSub.Component config={ config } patch={ patch } /> }
		</div>
	);
}

// Step/sub-step keys valid for the URL (see nav.js's `?tab=&sub=` on the
// editor route). Kept next to TABS/*_SUBS so they can't drift apart.
const VALID_TABS = TABS.map( ( t ) => t.key );
const validSubOf = ( tabKey, subKey ) => {
	const def = TABS.find( ( t ) => t.key === tabKey );
	return !! ( def && def.subs && def.subs.some( ( [ key ] ) => key === subKey ) );
};

export default function Editor( { id, onEditState, tab: tabProp, sub: subProp, onTabChange } ) {
	const [ video, setVideo ] = useState( null );
	// Controlled from the URL when the app provides it (App.jsx's route) — a
	// reload then lands back on the same step instead of Source. Falls back to
	// plain local state when it doesn't (Presets.jsx embeds this editor for a
	// preset, with no URL of its own to ride in).
	const initialTab = VALID_TABS.includes( tabProp ) ? tabProp : 'source';
	const [ tabState, setTabState ] = useState( initialTab );
	const [ activeSub, setActiveSub ] = useState( () => {
		const base = { player: 'appearance', interactions: 'overlays' };
		editorTabs.forEach( ( t ) => {
			if ( t.subs && t.subs.length ) {
				base[ t.key ] = t.subs[ 0 ][ 0 ];
			}
		} );
		if ( validSubOf( initialTab, subProp ) ) {
			base[ initialTab ] = subProp;
		}
		return base;
	} );
	const [ navOpen, setNavOpen ] = useState( () => {
		const def = TABS.find( ( t ) => t.key === initialTab );
		return def && def.subs ? initialTab : null;
	} );
	const tab = tabState;
	// Every step change (with or without a sub-step) also tells the parent, so
	// it can push the URL — a plain no-op when there's no `onTabChange` (the
	// Presets-embedded case).
	const setTab = ( key, subKey ) => {
		setTabState( key );
		if ( onTabChange ) {
			onTabChange( key, subKey );
		}
	};
	const selectSub = ( key, subKey ) => { setTab( key, subKey ); setNavOpen( key ); setActiveSub( ( m ) => ( { ...m, [ key ]: subKey } ) ); };
	const [ dirty, setDirty ] = useState( false );
	const [ saving, setSaving ] = useState( false );
	const [ presets, setPresets ] = useState( [] );
	const [ toolbarSlot, setToolbarSlot ] = useState( null );
	const [ embedOpen, setEmbedOpen ] = useState( false );
	// The config as last saved, for anything that has to tell a saved setting
	// from an unsaved edit (an extension's embed options, say).
	const [ savedConfig, setSavedConfig ] = useState( {} );
	const [ duration, setDuration ] = useState( 0 );
	const [ toast, setToast ] = useState( null );
	// The overlay list's eye button: a cue the preview player acts on. Clicking
	// the same row again sends `overlayId: null`, which means "clear it"; the
	// token changes on every click so the player re-runs either way.
	const [ previewCue, setPreviewCue ] = useState( null );
	const previewOverlay = useCallback( ( overlayId ) => setPreviewCue( ( cur ) => ( {
		overlayId: cur && cur.overlayId === overlayId ? null : overlayId,
		token: Date.now(),
	} ) ), [] );
	// Layers share the cue rather than getting a second one: only one thing can
	// be held up in the preview at a time, so raising a layer must also take
	// down whatever overlay the other eye had up.
	const previewLayer = useCallback( ( layerId ) => setPreviewCue( ( cur ) => ( {
		layerId: cur && cur.layerId === layerId ? null : layerId,
		token: Date.now(),
	} ) ), [] );

	useEffect( () => {
		api.getVideo( id ).then( ( v ) => {
			setVideo( v );
			setSavedConfig( v.config || {} );
		} );
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

	// `partial` may be a function of the current config, for callers whose patch
	// lands after an await (the poster capture): a plain object would carry the
	// snapshot they closed over and undo anything edited in the meantime.
	const patchConfig = useCallback( ( partial ) => {
		setVideo( ( v ) => {
			const config = v.config || {};
			const next = typeof partial === 'function' ? partial( config ) : partial;
			return { ...v, config: { ...config, ...next } };
		} );
		setDirty( true );
	}, [] );

	const setTitle = ( title ) => {
		setVideo( ( v ) => ( { ...v, title } ) );
		setDirty( true );
	};

	// Report title/dirty state up to the app shell — it names the breadcrumb and
	// drives the unsaved-changes guard when leaving. The title is edited in the
	// Source step (see SourceTab), not in the crumb.
	useEffect( () => {
		onEditState && onEditState( { title: video?.title, dirty, onTitleChange: setTitle } );
	}, [ video?.title, dirty ] );
	useEffect( () => () => onEditState && onEditState( null ), [] );

	// Update always saves the whole video (title + config) regardless of which
	// step is active — every tab patches the same shared config object — and
	// never advances the step for you.
	const save = async () => {
		if ( ! hasVideoSource( video.config?.source || {} ) ) {
			setToast( {
				message: isAudioSource( video.config?.source || {} )
					? __( 'Add an audio file before saving.' )
					: __( 'Add a video before saving.' ),
				tone: 'danger',
			} );
			return;
		}
		if ( ! dirty ) {
			return;
		}
		setSaving( true );
		try {
			const updated = await api.updateVideo( id, { title: video.title, config: video.config || {} } );
			setVideo( updated );
			setSavedConfig( updated.config || {} );
			setDirty( false );
			setToast( { message: __( 'Saved' ), tone: 'success' } );
		} finally {
			setSaving( false );
		}
	};

	if ( ! video ) {
		return <main className="flex-1 p-8 text-gray-400">{ __( 'Loading…' ) }</main>;
	}

	const config = video.config || {};
	const extTab = editorTabs.find( ( t ) => t.key === tab );

	return (
		<>
			<div className="w-full mx-auto pl-[10px] pr-6 py-6">
				{ /* Toolbar actions live in the topbar (portaled). */ }
				{ toolbarSlot && createPortal(
					<>
						{ dirty && <Badge tone="amber">{ __( 'Unsaved' ) }</Badge> }
						<Button variant="ghost" onClick={ () => setEmbedOpen( true ) }>{ __( 'Embed' ) }</Button>
						<Button onClick={ save } disabled={ saving || ! dirty }>
							{ saving ? __( 'Saving…' ) : __( 'Update' ) }
						</Button>
					</>,
					toolbarSlot
				) }

				<Toast message={ toast?.message } tone={ toast?.tone } onDismiss={ () => setToast( null ) } />

				{ embedOpen && (
					<Modal title={ __( 'Embed this media' ) } onClose={ () => setEmbedOpen( false ) }>
						<EmbedTab
							video={ video }
							config={ config }
							patch={ patchConfig }
							savedConfig={ savedConfig }
							saving={ saving }
							onSave={ save }
						/>
					</Modal>
				) }

				{ /* 3-column workspace: step menu (20%) · active tab (50%) · live
					preview (30%) — fractional tracks 2fr/5fr/3fr so the gaps stay even.
					Stacks vertically below xl. Sticky lives on the two side columns
					directly so they hold position while the taller middle column scrolls;
					items-start keeps grid tracks from stretching, which is what gives the
					sticky children room to stick. */ }
				{ /* The preview column carries a scaled-down copy of the real player,
					 so its width is what decides whether the skin is legible — it gets
					 the extra track. The settings column keeps enough room for its
					 two-across field rows. */ }
				<div className="flex flex-col gap-4 xl:grid xl:grid-cols-[2fr_5fr_4fr] xl:items-start">
					{ /* Column 1 — the video editor's own step menu. */ }
					<aside className="w-full bg-white border border-line rounded-card xl:sticky xl:top-[104px]">
						<nav className="p-1.5 space-y-1">
							{ TABS.map( ( t ) => {
								const active = tab === t.key;
								const open = navOpen === t.key;
								// A tab with subs toggles its accordion (and navigates in);
								// a plain tab just navigates and collapses any open accordion.
								const onClickPrimary = () => {
									setTab( t.key, t.subs ? activeSub[ t.key ] : undefined );
									setNavOpen( t.subs ? ( open ? null : t.key ) : null );
								};
								return (
									<div key={ t.key }>
										<button
											onClick={ onClickPrimary }
											className={ `flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition ${
												active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
											}` }
										>
											<Icon name={ t.icon } className="w-[18px] h-[18px] shrink-0" />
											<span className="flex-1">{ t.label }</span>
											{ t.subs && (
												<svg className={ `w-3.5 h-3.5 shrink-0 transition-transform ${ open ? 'rotate-90' : '' }` } viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M9 6l6 6-6 6" /></svg>
											) }
											</button>

										{ /* Sub-sections live inline in the nav (accordion), so the
											content column shows only the active one. */ }
										{ t.subs && open && (
											<div className="mt-1 mb-1 ml-4 pl-3 border-l-2 border-brand-100 space-y-0.5">
												{ t.subs.map( ( [ subKey, subLabel ] ) => (
													<button
														key={ subKey }
														onClick={ () => selectSub( t.key, subKey ) }
														className={ `flex items-center justify-between gap-2 w-full px-3 py-1.5 rounded-md text-[13px] text-left transition ${
															active && activeSub[ t.key ] === subKey ? 'text-brand-700 font-semibold' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
														}` }
													>
														<span className="truncate">{ subLabel }</span>
													</button>
												) ) }
											</div>
										) }
									</div>
								);
							} ) }
						</nav>
					</aside>

					{ /* Column 2 — the active tab. */ }
					<div className="w-full min-w-0">
						{ tab === 'source' && <SourceTab config={ config } patch={ patchConfig } videoId={ id } title={ video?.title || '' } onTitleChange={ setTitle } /> }
						{ tab === 'player' && <PlayerOptionsTab config={ config } patch={ patchConfig } presets={ presets } sub={ activeSub.player } /> }
						{ tab === 'appearance' && <AppearanceTab config={ config } patch={ patchConfig } duration={ duration } /> }
						{ tab === 'interactions' && <InteractionsTab config={ config } patch={ patchConfig } sub={ activeSub.interactions } onPreviewOverlay={ previewOverlay } previewingId={ previewCue?.overlayId || null } onPreviewLayer={ previewLayer } previewingLayerId={ previewCue?.layerId || null } /> }
						{ extTab && <extTab.Component config={ config } patch={ patchConfig } sub={ activeSub[ tab ] } /> }
					</div>

					{ /* Column 3 — live preview, pinned so the author sees changes as
						they edit. */ }
					<div className="w-full min-w-0 xl:sticky xl:top-[104px]">
						<PreviewPanel id={ id } config={ config } title={ video?.title || '' } presets={ presets } onDuration={ setDuration } previewCue={ previewCue } />
					</div>
				</div>
			</div>
		</>
	);
}
