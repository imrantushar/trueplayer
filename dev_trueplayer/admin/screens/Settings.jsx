import { createInterpolateElement, useEffect, useState, useRef, createPortal } from '@wordpress/element';
import { api } from '../api';
import { Card, CollapsibleCard, Button, Badge, Field, Input, Select, Textarea, Toggle } from '../components/UI';
import { Icon } from '../components/icons';
import { ExtSlot, settingsTabs } from '@Ext/admin';
import AddonsPanel from './settings/AddonsPanel';
import MediaPicker from '../components/MediaPicker';
import { templatesFor, applyTemplateToBlob, ASPECT_RATIOS } from '../data/preset-templates';
import { __, __sprintf } from '@Utils/translation';

// The stand-in for the author's own video. Light on purpose: these tiles are
// previews of a control bar, and every bar the plugin draws is dark, so a dark
// tile hid the very thing being compared. On a light poster the gradient wash,
// the solid deck and the floating panel separate at a glance — and a grid of
// light tiles sits in a light admin instead of punching six black holes in it.
// Deliberately neutral grey rather than a blue-grey: the accent play button,
// the scrubber fill and the selected ring are all brand blue, and a blue-tinted
// poster underneath them flattened the one colour that has to mean "chosen".
const TILE_POSTER = 'linear-gradient(157deg,#f1f2f4 0%,#dfe1e6 55%,#d3d6dc 100%)';

// Visually hidden, still announced. See the tooltip below for why it cannot
// just be unmounted or `display: none`.
const SR_ONLY = {
	position: 'absolute',
	width: 1,
	height: 1,
	padding: 0,
	margin: -1,
	overflow: 'hidden',
	clip: 'rect(0,0,0,0)',
	whiteSpace: 'nowrap',
	border: 0,
};

// The popover sits over the top of the next row of tiles — every tooltip in a
// grid does — so it has to carry enough lift to read as something floating in
// front rather than a panel that replaced what was there. Inline for the same
// reason SR_ONLY is: arbitrary shadow utilities do not survive this build.
const TOOLTIP_LIFT = { boxShadow: '0 8px 24px rgba(16,24,40,0.30)' };

/** Circled "i" — the affordance that says a description is one hover away. */
function InfoDot() {
	return (
		<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" className="shrink-0 text-placeholder">
			<circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
			<circle cx="8" cy="5" r="0.95" fill="currentColor" />
			<path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
		</svg>
	);
}

/**
 * The chrome every template tile shares: the frame, the selected state, the
 * label and the description.
 *
 * Split out because the video and audio tiles draw completely different
 * pictures inside it (a skin over a poster vs the shape of a bar) but have to
 * agree on everything around it — they appear in the same grid, one tab apart,
 * and a selection mark that moved or changed colour between them would read as
 * two different controls.
 *
 * Selection is a brand ring plus a corner tick rather than a coloured caption:
 * the tick sits ON the thing that is chosen, so "which one is on" is answered
 * without reading, which is the whole job of a picker.
 *
 * The description moved out of a paragraph under every tile and into a popover
 * on this one. It still has to exist — "Modern / Simple / Standard" tells an
 * author nothing about which to pick — but as standing text it tripled the
 * height of the grid and buried the pictures it was describing. It is wired
 * through `aria-describedby`, so focusing the tile both reveals and announces
 * it; the popover is not a hover-only secret.
 */
function TemplateTile({ template, selected, disabled, onSelect, children }) {
	const descId = `tp-tpl-${ template.key }-desc`;
	// Hover/focus tracked in state rather than through `group-hover:` /
	// `group-focus-within:` utilities: this build's Tailwind emits neither, so
	// the tooltip silently never appeared. State is also the honest tool here —
	// the popover has to answer to focus as well as hover, and one flag covers
	// both without depending on which variants happen to be enabled.
	const [ peek, setPeek ] = useState( false );
	const open = peek && !! template.description;

	return (
		<div
			className="relative"
			onMouseEnter={() => setPeek(true)}
			onMouseLeave={() => setPeek(false)}
		>
			<button
				type="button"
				disabled={disabled}
				aria-pressed={selected}
				aria-describedby={template.description ? descId : undefined}
				onFocus={() => setPeek(true)}
				onBlur={() => setPeek(false)}
				onClick={() => !disabled && onSelect(template)}
				className={`w-full text-left rounded-card transition ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
			>
				<div
					className={`relative aspect-video overflow-hidden rounded-card border-2 border-solid transition-colors ${
						selected
							? 'border-brand-500'
							: ( peek && ! disabled ? 'border-brand-300' : 'border-line' )
					}`}
					style={{ background: TILE_POSTER }}
				>
					{children}

					{selected && (
						<span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center shadow-sm">
							<Icon name="check" className="w-3.5 h-3.5 text-white" />
						</span>
					)}
				</div>

				<span className="flex items-center gap-1.5 mt-2">
					<span className={`text-sm font-medium truncate ${selected ? 'text-brand-500' : 'text-ink'}`}>{template.label}</span>
					{template.description && <InfoDot />}
				</span>
			</button>

			{template.description && (
				<span
					id={descId}
					role="tooltip"
					// Closed means visually hidden, NOT `display: none` and not
					// unmounted: `aria-describedby` has to resolve to a node that is
					// still in the accessibility tree, and `display: none` takes it
					// out of that tree as surely as removing it would. So a sighted
					// user gets the popover on hover or focus, and a screen-reader
					// user gets the same sentence read with the tile either way.
					// Inline rather than `sr-only` because this build's Tailwind is
					// already proven to drop utilities this file is the only user of.
					style={ open ? TOOLTIP_LIFT : SR_ONLY }
					className={ open
						? 'pointer-events-none absolute left-0 right-0 top-full z-20 mt-1 rounded px-2 py-1.5 bg-ink text-white text-[11px] leading-snug'
						: '' }
				>
					{template.description}
				</span>
			)}
		</div>
	);
}

/**
 * A mini player preview rendered in the template's own style.
 *
 * Every tile used to draw the same picture — one accent play button over one
 * progress bar — so the six looks were indistinguishable and the names carried
 * the whole explanation. Each trait below mirrors a real rule in
 * player/style.css, so the tile shows the difference and the popover states it.
 */
function TemplateCard({ template, selected, disabled, accent, onSelect }) {
	const a = template.appearance;
	const skin = a.skin;
	const playRadius = { circle: '9999px', soft: '7px', square: '2px' }[a.playButtonStyle] || '9999px';
	// Big-play sizes track the skin's own overrides (modern 84px, simple 64px).
	const playSize = skin === 'modern' ? 34 : skin === 'simple' ? 24 : 29;
	// Modern thickens the scrubber; standard squares off every one of its parts.
	const trackH = skin === 'modern' ? 5 : 3;
	const trackRadius = skin === 'standard' ? 0 : 9999;
	// How the bar meets the picture: a wash, a solid deck, a pill, or a panel
	// that lifts off the edge entirely.
	const floating = skin === 'floating';
	const minimal = skin === 'minimal';
	const barBg = floating || minimal
		? 'transparent'
		: skin === 'standard'
			? 'rgba(12,14,18,0.96)'
			: skin === 'simple'
				? 'rgba(0,0,0,0.6)'
				: 'linear-gradient(transparent, rgba(10,12,20,0.9))';

	return (
		<TemplateTile template={template} selected={selected} disabled={disabled} onSelect={onSelect}>
			<>
				{/* Ambient's whole point is light escaping the frame; at tile size
				    that reads as a soft accent bloom behind the picture. */}
				{skin === 'ambient' && (
					<span
						className="absolute inset-0"
						style={{ background: `radial-gradient(120% 90% at 50% 55%, ${accent}66, transparent 70%)`, filter: 'blur(6px)' }}
					/>
				)}

				<span className="absolute inset-0 flex items-center justify-center">
					<span className="flex items-center justify-center" style={{ width: playSize, height: playSize, background: accent, borderRadius: playRadius }}>
						<svg viewBox="0 0 24 24" width={Math.round(playSize * 0.42)} height={Math.round(playSize * 0.42)} fill="#fff"><path d="M8 5v14l11-7z" /></svg>
					</span>
				</span>

				<span
					className="absolute flex flex-col justify-end"
					style={ floating
						? { left: 8, right: 8, bottom: 8, borderRadius: 9, background: 'rgba(15,17,26,0.82)', boxShadow: '0 4px 14px rgba(0,0,0,0.45)', padding: '5px 7px' }
						: { left: 0, right: 0, bottom: 0, background: barBg, padding: minimal ? '0 22px 9px' : '10px 7px 6px' } }
				>
					{/* Minimal parks its controls in a rounded pill and drops the
					    time and volume readouts entirely. */}
					<span style={ minimal ? { display: 'block', background: 'rgba(13,17,26,0.82)', borderRadius: 999, padding: '5px 8px' } : undefined }>
						<span className="block relative" style={{ height: trackH, borderRadius: trackRadius, background: 'rgba(255,255,255,0.3)' }}>
							<span className="absolute left-0 top-0" style={{ width: '45%', height: trackH, borderRadius: trackRadius, background: accent }} />
						</span>
						{!minimal && (
							<span className="flex items-center gap-1 mt-1.5">
								<span className="block rounded-sm bg-white/70" style={{ width: 5, height: 5 }} />
								<span className="block rounded-sm bg-white/40" style={{ width: 14, height: 3 }} />
								<span className="flex-1" />
								<span className="block rounded-sm bg-white/40" style={{ width: 5, height: 5 }} />
							</span>
						)}
					</span>
				</span>

			</>
		</TemplateTile>
	);
}

/**
 * The audio counterpart of TemplateCard.
 *
 * A separate component rather than a branch inside that one: the video tile is
 * a 16:9 picture with a bar laid over it, and every trait it draws (skin, big
 * play button, poster bloom) is a treatment of that picture. An audio template
 * varies something else entirely — the SHAPE of the bar (audioLayout) — so the
 * two share no drawing code, only the selected/disabled chrome.
 *
 * Each branch mirrors a real rule in the audio-layouts block at the end of
 * player/style.css, so the tile shows what the listener will actually get.
 */
function AudioTemplateCard({ template, selected, disabled, accent, onSelect }) {
	const a = template.appearance;
	const layout = a.audioLayout || 'compact';
	const radius = Math.max(4, a.roundness ?? 8);
	// A template only lists what it changes, so an absent key means "leave the
	// default" — which for every control drawn here is ON. Hence `!== false`
	// at the call sites rather than a plain truthiness test.
	const c = template.controls || {};
	const skip = template.skipSeconds;
	// Previous / next TRACK — a bar with a triangle, distinct from the circled
	// seek-skip glyph below, exactly as the two read in the real control bar.
	const trackGlyph = (dir) => (
		<span key={`t${dir}`} className="flex items-center shrink-0" style={{ gap: 1, flexDirection: dir === 'back' ? 'row' : 'row-reverse' }}>
			<span className="block" style={{ width: 1.5, height: 7, background: 'rgba(255,255,255,0.65)' }} />
			<span
				style={{
					width: 0, height: 0,
					borderTop: '3.5px solid transparent',
					borderBottom: '3.5px solid transparent',
					[dir === 'back' ? 'borderRight' : 'borderLeft']: '5px solid rgba(255,255,255,0.65)',
				}}
			/>
		</span>
	);
	const skipGlyph = (dir) => (
		<span
			key={dir}
			className="flex items-center justify-center rounded-full"
			style={{ width: 8, height: 8, border: '1px solid rgba(255,255,255,0.45)' }}
		>
			<span
				style={{
					width: 0, height: 0,
					borderTop: '2px solid transparent',
					borderBottom: '2px solid transparent',
					[dir === 'back' ? 'borderRight' : 'borderLeft']: '3px solid rgba(255,255,255,0.65)',
				}}
			/>
		</span>
	);
	const art = (size, iconSize) => (
		<span
			className="flex items-center justify-center shrink-0"
			style={{ width: size, height: size, borderRadius: size > 40 ? 8 : 5, background: 'rgba(255,255,255,0.08)' }}
		>
			<svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill={accent}><path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" /></svg>
		</span>
	);
	const playBtn = (size) => (
		<span className="flex items-center justify-center shrink-0" style={{ width: size, height: size, borderRadius: '9999px', background: accent }}>
			<svg viewBox="0 0 24 24" width={Math.round(size * 0.46)} height={Math.round(size * 0.46)} fill="#fff"><path d="M8 5v14l11-7z" /></svg>
		</span>
	);
	const track = (played = '45%') => (
		<span className="block relative w-full" style={{ height: 3, borderRadius: 9999, background: 'rgba(255,255,255,0.3)' }}>
			<span className="absolute left-0 top-0" style={{ width: played, height: 3, borderRadius: 9999, background: accent }} />
		</span>
	);
	// `minimal` shows a waveform in place of the plain scrubber — the one
	// scrubberStyle override the player makes for audio (see Player.jsx).
	// Enough bars, thin enough, to read as a waveform. Sixteen fat ones stretched
	// across the tile read as a barcode instead — and "waveform, not a scrubber"
	// is the entire thing this template is showing.
	const WAVE = [ 5, 9, 14, 7, 11, 4, 13, 8, 6, 12, 5, 10, 7, 3, 9, 6, 11, 4, 13, 7, 9, 5, 12, 8, 6, 10, 4, 7 ];
	const waveform = (
		<span className="flex items-center w-full" style={{ height: 14, gap: 1 }}>
			{WAVE.map((h, i) => (
				<span
					key={i}
					className="block flex-1"
					style={{ height: h, borderRadius: 1, background: i < 12 ? accent : 'rgba(255,255,255,0.28)' }}
				/>
			))}
		</span>
	);

	return (
		<TemplateTile template={template} selected={selected} disabled={disabled} onSelect={onSelect}>
			{/* The bar is inset on the light tile rather than filling it, because
			    that is what an audio player actually is on a page: a dark bar
			    with the page showing around it. Filling the tile turned the
			    player's own rounding — the one appearance key these templates
			    differ on besides layout — into an invisible property. */}
			<span
				className="absolute inset-2 flex flex-col justify-center overflow-hidden"
				style={{ borderRadius: radius, background: '#14171f', padding: layout === 'card' ? 8 : 10 }}
			>
				{/* Everything that is not card or minimal draws the bar form: that
				    is compact and any layout built on it — the differences do not
				    survive at tile size anyway. The branch is written as
				    "not the other two" rather than a list of names so a layout
				    added later renders instead of leaving a blank tile. */}
				{'card' !== layout && 'minimal' !== layout && (
					<span className="flex items-center gap-2.5">
						{art(34, 17)}
						<span className="flex-1 min-w-0">
							<span className="block rounded-sm bg-white/70 mb-1.5" style={{ width: '55%', height: 4 }} />
							{track()}
							{/* Driven by the template's own controls, because two
							    templates can share `compact` — Podcast and Audiobook
							    both do — and tiles that drew the same picture would
							    make them indistinguishable in the picker. */}
							<span className="flex items-center gap-1.5 mt-1.5">
								{/* Track skips bracket the play button, as they do in
								    the real bar; the seek skips sit after it. */}
								{c.prev && trackGlyph('back')}
								{playBtn(14)}
								{c.next && trackGlyph('fwd')}
								{c.rewind !== false && skipGlyph('back')}
								{c.forward !== false && skipGlyph('fwd')}
								<span className="flex-1" />
								{c.speed && (
									<span
										className="text-[7px] font-bold leading-none px-1 py-[2px] rounded text-white/80"
										style={{ background: 'rgba(255,255,255,0.16)' }}
									>
										{ skip ? `${ skip }s` : '1×' }
									</span>
								)}
								{c.volume !== false && <span className="block rounded-sm bg-white/30" style={{ width: 12, height: 3 }} />}
							</span>
						</span>
					</span>
				)}

				{layout === 'card' && (
					<span className="flex flex-col items-center gap-2">
						{art(46, 22)}
						<span className="w-full">
							<span className="block rounded-sm bg-white/70 mb-1.5 mx-auto" style={{ width: '48%', height: 4 }} />
							{track('38%')}
							<span className="flex items-center justify-center gap-2 mt-2">
								{c.prev ? trackGlyph('back') : <span className="block rounded-sm bg-white/40" style={{ width: 6, height: 6 }} />}
								{playBtn(16)}
								{c.next ? trackGlyph('fwd') : <span className="block rounded-sm bg-white/40" style={{ width: 6, height: 6 }} />}
							</span>
						</span>
					</span>
				)}

				{layout === 'minimal' && (
					<span className="flex items-center gap-2.5">
						{playBtn(20)}
						{waveform}
					</span>
				)}
			</span>
		</TemplateTile>
	);
}

/**
 * How each media type presents itself in the "Default player look" card.
 *
 * The card is one control answering one question twice, and the only thing
 * that said which time you were looking at was a two-word toggle in the top
 * corner — so an author could tune the audio bar for a while under the
 * impression they were tuning video, and nothing on screen argued. Colour is
 * carrying that now: the heading names the type, an icon repeats it, and the
 * whole tile surface changes hue. Any one of the three is enough to answer
 * "which player is this?" from across the desk.
 *
 * Inline values rather than Tailwind classes because they are read from a
 * lookup at render; a class name built by string concatenation would be purged
 * from the build.
 */
const TYPE_LOOK = {
	video: {
		icon: 'video',
		heading: __( 'Default video look' ),
		blurb: __( 'Applied to every video that has not chosen a look of its own. Any single item still overrides it.' ),
		surface: '#f7f9fc',
		line: '#e3e9f2',
		tint: '#e0edff',
		ink: '#0b5cd5',
	},
	audio: {
		icon: 'music',
		heading: __( 'Default audio look' ),
		blurb: __( 'Applied to every audio item that has not chosen a look of its own. Set separately from video — a skin and an aspect ratio are treatments of a picture, and an audio bar has none.' ),
		surface: '#fbf7ff',
		line: '#ece0f8',
		tint: '#efe2ff',
		ink: '#7c3aed',
	},
};

const BASE_NAV_GROUPS = [
	{
		key: 'player', label: __( 'Player' ), items: [
			{ key: 'general', label: __( 'General' ), icon: 'settings' },
			{ key: 'branding', label: __( 'Branding' ), icon: 'tag' },
			{ key: 'sources', label: __( 'Sources & CDN' ), icon: 'cloud' },
		]
	},
	{ key: 'data', label: __( 'Trust & data' ), items: [] },
	{
		key: 'connect', label: __( 'Connect' ), items: [
			{ key: 'integrations', label: __( 'Integrations' ), icon: 'plug' },
		]
	},
	{
		key: 'account', label: __( 'Account' ), items: [
			{ key: 'addons', label: __( 'Addons' ), icon: 'puzzle' },
		]
	},
];

// Extension tabs join the group they name; empty groups are not shown.
const NAV_GROUPS = BASE_NAV_GROUPS.map( ( g ) => ( {
	...g,
	items: [ ...g.items, ...settingsTabs.filter( ( t ) => ( t.group || 'account' ) === g.key ) ],
} ) ).filter( ( g ) => g.items.length > 0 );

/**
 * Push the values that were just saved back into TruePlayerGlobal.
 *
 * PHP localizes those once per page load (Assets::get_common_scripts_data), but
 * the admin is a pushState SPA — Settings, the library and the video editor all
 * live inside a single load. Without this, choosing a default player template,
 * saving, and then creating a video hands that editor the snapshot from *before*
 * the save: its Skin dropdown (and its live preview) keep showing the previous
 * template until a hard reload.
 *
 * Mirrors what PHP sends, key for key: `player_defaults` is `settings.customize`
 * (Assets::player_defaults), `player_defaults_audio` is `settings.customizeAudio`
 * (Assets::player_defaults_audio), `settings.general` is the two default preset
 * ids (Assets::default_preset_ids) and `enforcement` is the enforcement section,
 * whose gaps both Helper::enforcement_defaults and sitePolicy() fill themselves.
 *
 * Every key PHP localizes that this screen can change has to be refreshed here.
 * Both of the audio/preset keys below were missing, and each had the same
 * symptom from a different direction: pick an audio look (or a default preset),
 * save, create an item — and that editor resolved against the pre-save snapshot,
 * so the one screen where the choice should first show up was the one screen
 * that ignored it until a full page reload.
 *
 * @param {Object} saved The settings object the save endpoint echoed back.
 */
function syncGlobalDefaults(saved) {
	const g = window.TruePlayerGlobal;
	if (!g || !saved) {
		return;
	}
	const section = (key) => (saved[key] && typeof saved[key] === 'object' ? saved[key] : {});
	g.player_defaults = section('customize');
	g.player_defaults_audio = section('customizeAudio');
	// The same narrow shape PHP publishes — these four keys, nothing else from
	// `general`. The template markers are here because the create dialog NAMES
	// the look a new item will inherit (utils/default-look), so a stale marker
	// would have it confidently announce the template you just replaced.
	const general = section('general');
	g.settings = {
		...(g.settings || {}),
		general: {
			defaultPreset: parseInt(general.defaultPreset, 10) || 0,
			defaultAudioPreset: parseInt(general.defaultAudioPreset, 10) || 0,
			defaultTemplate: general.defaultTemplate || '',
			defaultAudioTemplate: general.defaultAudioTemplate || '',
		},
	};
	g.enforcement = { ...(g.enforcement || {}), ...(saved.enforcement || {}) };
}

/** The address wp_mail falls back to, shown as the field's placeholder. */
function TruePlayerGlobalAdminEmail() {
	const g = window.TruePlayerGlobal || {};
	return g.admin_email || 'admin@example.com';
}

export default function Settings({ tab = 'general', onTabChange, onEditState }) {
	const [settings, setSettings] = useState(null);
	// For the default-preset pickers below. Failure is non-fatal — the rest of
	// the settings screen has nothing to do with presets.
	const [presets, setPresets] = useState([]);
	// Which player the "Default player look" card is configuring. Local UI state
	// only — nothing about it is saved, since both types' settings are written
	// whichever tab is open.
	const [lookType, setLookType] = useState('video');
	useEffect(() => { api.listPresets().then((l) => setPresets(l || [])).catch(() => {}); }, []);
	const setTab = (next) => onTabChange && onTabChange(next);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [toolbarSlot, setToolbarSlot] = useState(null);
	const loadedOnce = useRef(false);

	useEffect(() => {
		api.getSettings().then((s) => setSettings(s || {}));
		setToolbarSlot(document.getElementById('tp-topbar-slot'));
	}, []);

	// setSettings is called from ~30 individual field onChange handlers — rather
	// than touch every call site, mark dirty whenever `settings` changes after
	// the initial load (the first change is that load itself, not an edit).
	useEffect(() => {
		if (!settings) {
			return;
		}
		if (!loadedOnce.current) {
			loadedOnce.current = true;
			return;
		}
		setDirty(true);
	}, [settings]);

	// Report dirty state up to the app shell so it can warn before navigating
	// away (Settings has no breadcrumb title/back of its own, unlike the entity
	// editors, so only `dirty` is lifted here).
	useEffect(() => { onEditState && onEditState({ dirty }); }, [dirty]);
	useEffect(() => () => onEditState && onEditState(null), []);

	const save = async () => {
		setSaving(true);
		try {
			const res = await api.saveSettings(settings);
			syncGlobalDefaults((res && res.settings) || settings);
			setDirty(false);
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} finally {
			setSaving(false);
		}
	};

	if (!settings) {
		return <p className="text-gray-400">{ __( 'Loading…' ) }</p>;
	}

	return (
		<>
			{ /* Save lives in the topbar (portaled) — same pattern as the video editor. */}
			{toolbarSlot && createPortal(
				<>
					{saved && <span className="inline-flex items-center gap-1 text-sm text-green-600"><Icon name="checkmark" className="w-4 h-4" /> { __( 'Saved' ) }</span>}
					<Button onClick={save} disabled={saving || !dirty}>{saving ? __( 'Saving…' ) : __( 'Save' )}</Button>
				</>,
				toolbarSlot
			)}

			<div className="mb-6">
				<h1 className="text-2xl font-bold text-gray-900">{ __( 'Settings' ) }</h1>
				<p className="text-sm text-gray-500">{ __( 'Site-wide defaults. Any single video can override these in its own editor.' ) }</p>
			</div>

			<div className="flex gap-6 items-start">
				{ /* Sticky must be on this element directly (not a nested <nav> inside a
					shrink-wrapped <aside>) — a nested sticky child has no room to stick,
					since its containing block is the short wrapper, not the tall row. */ }
				<nav className="w-60 shrink-0 sticky top-[104px] bg-white border border-line rounded-card p-2">
					{NAV_GROUPS.map((group, gi) => (
						<div key={group.label} className={gi > 0 ? 'mt-1' : ''}>
							<div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.label}</div>
							<div className='flex flex-col gap-2'>
								{group.items.map((t) => (
									<button
										key={t.key}
										onClick={() => setTab(t.key)}
										className={`flex items-center gap-2.5 w-full px-3 py-2 rounded text-sm font-medium text-left transition-colors ${tab === t.key ? 'bg-brand-100 text-brand-500' : 'text-label hover:bg-gray-100'
											}`}
									>
										<Icon name={t.icon} className="w-[17px] h-[17px] shrink-0" />
										<span className="truncate">{t.label}</span>
									</button>
								))}
							</div>
						</div>
					))}
				</nav>
				<div className="flex-1 min-w-0">

					{tab === 'general' && (
						<div className="space-y-6">
							<p className="text-sm text-muted !m-0">
								{ __( 'These are optional site-wide defaults. The TruePlayer block works without them — set anything it needs from the block sidebar in the editor.' ) }
							</p>
							{(() => {
								// One card per media type rather than two parallel ones.
								// A template and a default preset answer the same
								// question — "what should this player look like?" — and
								// the preset wins, so showing them as separate sections
								// let an author pick a template that silently did
								// nothing. Here the losing control says so.
								const isAudioTab = 'audio' === lookType;
								// Where this type's site-wide appearance lives. Audio has
								// its own blob because the two players share almost no
								// appearance vocabulary — see VIDEO_ONLY_APPEARANCE in
								// player/customize.js, which is what keeps them apart at
								// render.
								const blobKey = isAudioTab ? 'customizeAudio' : 'customize';
								const markerKey = isAudioTab ? 'defaultAudioTemplate' : 'defaultTemplate';
								const presetKey = isAudioTab ? 'defaultAudioPreset' : 'defaultPreset';
								// The tile that reads as chosen before anything is stored.
								// Mirrored in utils/default-look.js, which names the same
								// fallback in the create dialog.
								const fallbackTemplate = isAudioTab ? 'bare' : 'default';
								const activePreset = settings.general?.[presetKey] || '';
								const typePresets = presets.filter((p) => ('audio' === p.type) === isAudioTab);
								// The accent is shared across both players, so the tiles
								// always preview it from the one place it is set.
								const accent = settings.customize?.appearance?.accent || '#006BFF';
								const look = TYPE_LOOK[lookType];

								return (
									<Card className="p-6">
										<div className="flex flex-wrap items-start justify-between gap-3 mb-1">
											<h3 className="font-semibold text-gray-900 !mb-0 flex items-center gap-2">
												<span
													className="w-6 h-6 rounded flex items-center justify-center shrink-0"
													style={{ background: look.tint, color: look.ink }}
												>
													<Icon name={look.icon} className="w-3.5 h-3.5" />
												</span>
												{look.heading}
											</h3>
											<div className="tp-type-tabs" role="tablist">
												{[['video', __( 'Video' )], ['audio', __( 'Audio' )]].map(([value, label]) => (
													<button
														key={value}
														type="button"
														role="tab"
														aria-selected={lookType === value}
														className={`tp-type-tab ${lookType === value ? 'is-active' : ''}`}
														onClick={() => setLookType(value)}
													>
														<Icon name={TYPE_LOOK[value].icon} className="w-3.5 h-3.5" />
														{label}
													</button>
												))}
											</div>
										</div>
										<p className="text-sm text-muted mb-4">{look.blurb}</p>

										{ /* The tinted panel is the type indicator that survives
										     scrolling: the heading can be off-screen by the time
										     you reach the bottom row of tiles, the hue cannot. */ }
										<div
											className="mt-4 p-5 rounded-card border border-solid"
											style={{ background: look.surface, borderColor: look.line }}
										>
											{!!activePreset && (
												<div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4 text-sm">
													<Icon name="help" className="w-4 h-4 text-muted shrink-0" />
													<span className="text-muted">{ __( 'A default preset is in control, so these starting points are not applied.' ) }</span>
													<button
														type="button"
														className="text-brand-500 font-medium underline bg-transparent border-0 p-0 cursor-pointer"
														onClick={() => setSettings((s) => ({ ...s, general: { ...(s.general || {}), [presetKey]: undefined } }))}
													>
														{ __( 'Use a starting point instead' ) }
													</button>
												</div>
											)}

											{[
												[ null, templatesFor(lookType) ],
											].filter(([ , list ]) => list.length > 0).map(([ groupLabel, list ]) => (
											<div key={groupLabel || 'free'} className={groupLabel ? 'mt-5' : ''}>
											{groupLabel && (
												<div className="flex items-center gap-2 mb-3">
													<span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{groupLabel}</span>
													<span className="flex-1 h-px" style={{ background: look.line }} />
												</div>
											)}
											<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
												{list.map((t) => {
													const selected = (settings.general?.[markerKey] || fallbackTemplate) === t.key;
													// Really disabled, not just dimmed: a
													// pointer-events-none tile stays in the tab
													// order, so a keyboard user would land on a
													// control that silently does nothing.
													const locked = !!activePreset;
													// The marker is what makes the right tile
													// read as chosen; nothing consumes it at
													// render, where the appearance keys below
													// do the actual work.
													// Replaces the keys a template owns rather
													// than merging over them — see
													// applyTemplateToBlob. The merge version left
													// this site saved as "Playlist" while actually
													// rendering Playlist's layout with Minimal's
													// hidden volume and Audiobook's 30-second skip,
													// because each click only ever added.
													//
													// Audio templates are defined partly by which
													// controls they expose and how far they skip, so
													// both travel with the appearance — otherwise
													// "Podcast" would promise skip buttons it never
													// switched on.
													const onSelect = (tpl) => setSettings((s) => ({
														...s,
														general: { ...(s.general || {}), [markerKey]: tpl.key },
														[blobKey]: applyTemplateToBlob(s[blobKey], tpl, lookType),
													}));
													return isAudioTab
														? <AudioTemplateCard key={t.key} template={t} accent={accent} selected={selected} disabled={locked} onSelect={onSelect} />
														: <TemplateCard key={t.key} template={t} accent={accent} selected={selected} disabled={locked} onSelect={onSelect} />;
												})}
											</div>
											</div>
											))}

											<div className="mt-5 pt-5 border-t border-solid" style={{ borderColor: look.line }}>
												<Field
													label={ __( '…or use a saved preset' ) }
													hint={ typePresets.length
														? __( 'A preset overrides the starting points above for every item that has not chosen one of its own.' )
														: __( 'No presets of this type yet — create one under Presets to reuse a look across items.' ) }
													className='!mb-0'
												>
													<Select
														value={activePreset}
														onChange={(e) => setSettings((s) => ({ ...s, general: { ...(s.general || {}), [presetKey]: e.target.value ? parseInt(e.target.value, 10) : undefined } }))}
													>
														<option value="">{ __( 'None' ) }</option>
														{typePresets.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
													</Select>
												</Field>
											</div>
										</div>

										{ /* What this actually does to a new item, stated rather than left
										     to be discovered. Nothing is copied into an item at creation —
										     it is resolved at playback (resolveCustomize, and
										     Helper::apply_preset for the preset branch). That is why
										     editing this later still moves every item that never overrode
										     it, and why one that did override it does not snap back. */ }
										<p className="text-xs text-muted mt-3 leading-relaxed">
											{ __( 'New items are not given a copy of this — they read it at playback. So changing it later still updates every item that has not set a look of its own, and never disturbs one that has.' ) }
										</p>
									</Card>
								);
							})()}

							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Default video aspect ratio' ) }</h3>
								<p className="text-sm text-muted mb-4">{ __( 'The frame shape new videos use unless overridden per video. Audio has no frame, so this never reaches an audio item.' ) }</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Field label={ __( 'Aspect ratio' ) } className='!mb-0'>
										<Select value={settings.customize?.appearance?.aspectRatio || '16:9'} onChange={(e) => setSettings((s) => ({ ...s, customize: { ...(s.customize || {}), appearance: { ...(s.customize?.appearance || {}), aspectRatio: e.target.value } } }))}>
											{ASPECT_RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
										</Select>
									</Field>
								</div>
							</Card>

						</div>
					)}

					

					

					

					{tab === 'sources' && (
						<div className="space-y-6">
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'YouTube' ) }</h3>
								<p className="text-sm text-muted mb-4">{ __( 'Privacy-enhanced mode plays via youtube-nocookie.com — no cookies until a visitor presses play.' ) }</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Toggle checked={!!settings.sources?.youtubeNoCookie} onChange={(v) => setSettings((s) => ({ ...s, sources: { ...(s.sources || {}), youtubeNoCookie: v } }))} label={ __( 'Enable privacy-enhanced mode (no-cookie)' ) } />
								</div>
							</Card>

							<ExtSlot name="settings.sources" settings={settings} setSettings={setSettings} />
						</div>
					)}

					{tab === 'integrations' && (
						<div className="space-y-6">
							{ /* First: this is the destination email capture falls back to
							     when no CRM is connected. */ }
							<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Email notification' ) }</h3>
								<p className="text-sm text-muted mb-4">{ __( "Where captured addresses are sent when a video's email form has no CRM provider selected." ) }</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Field label={ __( 'Send notifications to' ) } hint={ __( "Leave empty to use this site's admin email address." ) }>
										<Input
											type="email"
											value={settings.integrations?.wp_mail?.to || ''}
											onChange={(e) => setSettings((s) => ({ ...s, integrations: { ...(s.integrations || {}), wp_mail: { ...(s.integrations?.wp_mail || {}), to: e.target.value } } }))}
											placeholder={TruePlayerGlobalAdminEmail()}
										/>
									</Field>
								</div>
							</Card>

						<Card className="p-6">
								<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Google Analytics' ) }</h3>
								<p className="text-sm text-muted mb-4">{ __( 'Send player events (video_start, video_complete) to GA4. Uses your existing site tag, or loads one from a measurement ID.' ) }</p>
								<div className='mt-4 pt-5 border-t border-solid border-line'>
									<Toggle
										checked={!!settings.integrations?.ga?.enabled}
										onChange={(v) => setSettings((s) => ({ ...s, integrations: { ...(s.integrations || {}), ga: { ...(s.integrations?.ga || {}), enabled: v } } }))}
										label={ __( 'Send player events to Google Analytics' ) }
									/>
									{settings.integrations?.ga?.enabled ? (
										<div className="mt-6">
											<Field label={ __( 'Measurement ID' ) } hint={ __( "Optional — leave blank to use the site's existing GA tag." ) } className="!mb-0">
												<Input value={settings.integrations?.ga?.measurementId || ''} onChange={(e) => setSettings((s) => ({ ...s, integrations: { ...(s.integrations || {}), ga: { ...(s.integrations?.ga || {}), measurementId: e.target.value.trim() } } }))} placeholder="G-XXXXXXXXXX" />
											</Field>
										</div>
									) : null}
								</div>
							</Card>

						<ExtSlot name="settings.integrations" settings={settings} setSettings={setSettings} />
						</div>
					)}

					{tab === 'branding' && (
						(() => {
							const app = settings.customize?.appearance || {};
							const setApp = (partial) => setSettings((s) => ({ ...s, customize: { ...(s.customize || {}), appearance: { ...(s.customize?.appearance || {}), ...partial } } }));
							const brand = settings.branding || {};
							const setBrand = (partial) => setSettings((s) => ({ ...s, branding: { ...(s.branding || {}), ...partial } }));
							return (
								<div className="space-y-6">
									<Card className="p-6">
										<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Brand colors' ) }</h3>
										<p className="text-sm text-muted mb-4">{ __( 'The default accent for the scrubber, buttons & highlights. Any video or preset can override it.' ) }</p>
										<div className="grid grid-cols-2 gap-4 mt-4 pt-5 border-t border-solid border-line">
											<Field label={ __( 'Accent color' ) }>
												<div className="flex gap-2 items-center">
													<input type="color" value={app.accent || '#006BFF'} onChange={(e) => setApp({ accent: e.target.value })} className="h-10 w-12 rounded border border-line" />
													<Input value={app.accent || ''} onChange={(e) => setApp({ accent: e.target.value })} placeholder="#006BFF" />
												</div>
											</Field>
											<Field label={ __( 'Button hover color' ) } hint={ __( 'Optional.' ) }>
												<div className="flex gap-2 items-center">
													<input type="color" value={app.hoverColor || '#ffffff'} onChange={(e) => setApp({ hoverColor: e.target.value })} className="h-10 w-12 rounded border border-line" />
													<Input value={app.hoverColor || ''} onChange={(e) => setApp({ hoverColor: e.target.value })} placeholder={ __( '(none)' ) } />
												</div>
											</Field>
										</div>
									</Card>

									<Card className="p-6">
										<h3 className="font-semibold text-gray-900 !mb-1">{ __( 'Player logo' ) }</h3>
										<p className="text-sm text-muted">{ __( 'A watermark logo shown on every player by default.' ) }</p>
										<div className='mt-4 pt-5 border-t border-solid border-line'>
											{ /* Upload-only: a pasted URL was never the point of a logo
											     field, and MediaPicker shows what you actually picked. */ }
											<Field label={ __( 'Logo image' ) } className='!mb-0'>
												<MediaPicker value={brand.logo || ''} onChange={(url) => setBrand({ logo: url })} accept="image" label={ __( 'Upload a logo' ) } />
											</Field>
											{brand.logo && (
												<div className="grid grid-cols-2 gap-4">
													<Field label={ __( 'Position' ) }>
														<Select value={brand.logoPosition || 'top-right'} onChange={(e) => setBrand({ logoPosition: e.target.value })}>
															<option value="top-left">{ __( 'Top left' ) }</option>
															<option value="top-right">{ __( 'Top right' ) }</option>
															<option value="bottom-left">{ __( 'Bottom left' ) }</option>
															<option value="bottom-right">{ __( 'Bottom right' ) }</option>
														</Select>
													</Field>
													<Field label={ __sprintf( 'Opacity (%d%%)', Math.round( ( brand.logoOpacity ?? 0.9 ) * 100 ) ) }>
														<input type="range" min="10" max="100" step="5" value={Math.round((brand.logoOpacity ?? 0.9) * 100)} onChange={(e) => setBrand({ logoOpacity: parseInt(e.target.value, 10) / 100 })} className="w-full" />
													</Field>
													<div className="col-span-2">
														<Field label={ __( 'Click-through link' ) } hint={ __( 'Optional — makes the logo clickable.' ) }>
															<Input value={brand.logoUrl || ''} onChange={(e) => setBrand({ logoUrl: e.target.value })} placeholder="https://your-site.com" />
														</Field>
													</div>
												</div>
											)}
										</div>
									</Card>

									<ExtSlot name="settings.branding" settings={settings} setSettings={setSettings} />
								</div>
							);
						})()
					)}

					

					

					{tab === 'addons' && <AddonsPanel />}

					{settingsTabs.filter( ( t ) => t.key === tab ).map( ( t ) => (
						<t.Component key={ t.key } settings={ settings } setSettings={ setSettings } />
					) )}

					
				</div>
			</div>
		</>
	);
}
