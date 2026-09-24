/**
 * Central customization defaults + resolver. The admin writes a `customize`
 * object into the video config; here we deep-merge it over defaults so the
 * player and controls can read a complete, safe shape.
 */
import { CONTROL_DEFAULTS } from '@Utils/controls';

export const CUSTOMIZE_DEFAULTS = {
	// Built from the control registry rather than hand-listed, so a control
	// cannot exist in the editor's toggle grid without a declared default here.
	// That mattered: Controls.jsx's show() reads an undefined key as ON, so a
	// control missing from this object would switch itself on for every
	// existing item the moment its button was written.
	controls: CONTROL_DEFAULTS,
	behavior: {
		autoplay: false,
		autoplayMode: '', // '' (derive from autoplay) | off | muted | sound
		muted: false,
		loop: false,
		resetOnEnd: false,
		savePosition: true,
		hideControls: true, // auto-hide when idle during playback
		sticky: false, // float on scroll-out
		stickyPosition: 'bottom-right',
		preload: 'metadata', // auto | metadata | none
		loadStrategy: 'facade', // facade (click-to-load) | eager (boot on load) | onvisible (boot in view)
		noSkip: false, // block seeking past the furthest point watched (rewind ok)
		disableSeek: false, // lock the scrubber entirely — no click or drag, forward or back
		hoverPreview: false, // muted inline preview when hovering the poster facade (direct-file sources)
	},
	appearance: {
		skin: 'default', // default | modern | simple | minimal | standard | floating (pro) | ambient (pro)
		// Audio only — the shape of the audio bar. `compact` is what audio has
		// always rendered as, so every existing item keeps its current look.
		// Flat, like the caption keys below and for the same reason: the section
		// merge is shallow, so a nested object would be overridden wholesale.
		audioLayout: 'compact', // compact | card | minimal
		accent: '#4f46e5',
		hoverColor: '',
		bigPlay: true,
		playButtonStyle: 'circle', // circle | square | soft
		playButtonSize: 0, // center play-button diameter in px; 0 = skin default
		roundness: 10, // stage border radius, px
		controlBarStyle: 'gradient', // gradient | solid | minimal
		aspectRatio: '16:9', // 16:9 | 9:16 | 4:3 | 1:1 | 21:9 | auto
		// Video only — how the scrubber draws itself. `rapid-engage` replaces the
		// real progress bar with a simulated one that runs ahead at the start so
		// the video reads as shorter than it is, easing back to real speed by the
		// end. It is a treatment of the timeline, not a behaviour, so it lives
		// here and is filtered out of the site-wide layer for audio (see
		// VIDEO_ONLY_APPEARANCE) — an audio bar has no picture to make feel short.
		seekBarStyle: 'default', // default | waveform | rapid-engage
		// 1-5, how far ahead `rapid-engage` runs. Ignored by the other styles.
		// Two of them because the tolerance genuinely differs by device — see
		// isMobileViewer() in rapid-engage.js. `rapidSpeedMobileSync` defaults
		// to true so the mobile value stays invisible until someone asks for it:
		// one speed is the common case, and a second number that silently did
		// something different on half the traffic would be a trap.
		rapidSpeed: 3,
		rapidSpeedMobile: 3,
		rapidSpeedMobileSync: true,
		// Caption rendering (html5-backed providers). Flat keys — the section
		// merge is shallow, so nested objects would override wholesale.
		captionSize: 100, // % of the player's base cue size
		captionColor: '#ffffff',
		captionBackground: '#000000',
		captionOpacity: 75, // background opacity, %
	},
	speeds: [ 0.5, 0.75, 1, 1.25, 1.5, 2 ],
	skipSeconds: 10,
};

/**
 * Appearance keys that only mean something for one media type.
 *
 * The SITE-WIDE layer is filtered through these, so a global video skin can
 * never reach an audio bar (and an audio layout can never reach a video). That
 * layer is the only one nobody chose per item: an admin picking "Ambient"
 * because most of the library is video has not asked for a poster glow on
 * their podcast episodes.
 *
 * Preset and per-item values are deliberately NOT filtered. Those were chosen
 * for that one item, and the preset layer already has its own media-type rule
 * (Helper::apply_preset / applyPreset refuse a mismatched *default* while
 * honouring an explicit pick).
 *
 * Listed here rather than inferred, and kept beside CUSTOMIZE_DEFAULTS so a key
 * cannot be added to the defaults above without a decision about which player
 * it belongs to. Anything absent from both lists is shared on purpose —
 * `accent`, `hoverColor`, `roundness` and `controlBarStyle` are brand-level,
 * set once and applied to both.
 */
export const VIDEO_ONLY_APPEARANCE = [
	'skin',
	'aspectRatio',
	'seekBarStyle',
	'rapidSpeed',
	'rapidSpeedMobile',
	'rapidSpeedMobileSync',
	'playButtonStyle',
	'playButtonSize',
	'bigPlay',
	'captionSize',
	'captionColor',
	'captionBackground',
	'captionOpacity',
];
export const AUDIO_ONLY_APPEARANCE = [ 'audioLayout' ];

/**
 * Effective autoplay mode: 'off' | 'muted' | 'sound'. `autoplayMode` wins;
 * older configs only have the boolean `autoplay` (which always meant muted).
 */
export function autoplayMode( behavior = {} ) {
	if ( behavior.autoplayMode ) {
		return behavior.autoplayMode;
	}
	return behavior.autoplay ? 'muted' : 'off';
}

function mergeSection( base, ...overrides ) {
	return overrides.reduce(
		( acc, o ) => ( { ...acc, ...( o && typeof o === 'object' ? o : {} ) } ),
		{ ...base }
	);
}

/** A copy of `appearance` without the listed keys. */
function without( appearance, keys ) {
	if ( ! appearance || typeof appearance !== 'object' ) {
		return {};
	}
	const out = { ...appearance };
	keys.forEach( ( k ) => delete out[ k ] );
	return out;
}

/**
 * Resolve the effective customization by layering, lowest → highest priority:
 *   built-in defaults  →  site-wide defaults (TruePlayerGlobal.player_defaults)
 *   →  per-video config.customize
 *
 * So an admin sets global defaults once and any single video can override.
 *
 * The site-wide APPEARANCE layer is media-type aware, in two steps:
 *
 *   1. the shared keys from `player_defaults` — accent, hoverColor, roundness,
 *      controlBarStyle — which are brand-level and apply to both players, so a
 *      site accent is still set once;
 *   2. the type's own blob on top: `player_defaults` for video,
 *      `player_defaults_audio` (Settings → General → Audio) for audio, each
 *      stripped of the other type's keys.
 *
 * That is what stops a global video skin reaching an audio bar while letting an
 * audio template still set the bar's shape and roundness. Everything else
 * (controls, behavior, speeds, skipSeconds) comes from the one `player_defaults`
 * blob unchanged — none of it is a treatment of a picture.
 *
 * For video the two steps collapse back to plain `global.appearance`, so an
 * install with no audio blob renders exactly as it did before.
 */
export function resolveCustomize( config = {} ) {
	const g = ( typeof window !== 'undefined' && window.TruePlayerGlobal ) || {};
	const global = g.player_defaults || {};
	const c = config.customize || {};
	// `mediaType` is resolved before the config reaches here — by normalizeConfig
	// at the mount entry point on the front end, and by Media::normalize_config
	// server-side — so this is a read, never a guess.
	const isAudio = 'audio' === ( config.source && config.source.mediaType );
	const shared = without( global.appearance, [ ...VIDEO_ONLY_APPEARANCE, ...AUDIO_ONLY_APPEARANCE ] );
	const typed = isAudio
		? without( ( g.player_defaults_audio || {} ).appearance, VIDEO_ONLY_APPEARANCE )
		: without( global.appearance, AUDIO_ONLY_APPEARANCE );
	// Back-compat: older configs stored the accent under `branding`.
	const brandingAccent = config.branding && config.branding.accent;

	return {
		// The audio blob may carry controls of its own: its templates are defined
		// partly BY which controls a listener reaches for (Podcast turns on speed
		// and skip, Bare turns nearly everything off), so an audio default that
		// only moved appearance would half-apply the template it names. Layered
		// over the shared set rather than replacing it, and empty on any install
		// that has never set an audio default.
		controls: mergeSection(
			CUSTOMIZE_DEFAULTS.controls,
			global.controls,
			isAudio ? ( g.player_defaults_audio || {} ).controls : null,
			c.controls
		),
		behavior: mergeSection( CUSTOMIZE_DEFAULTS.behavior, global.behavior, c.behavior ),
		appearance: mergeSection(
			{ ...CUSTOMIZE_DEFAULTS.appearance, accent: brandingAccent || CUSTOMIZE_DEFAULTS.appearance.accent },
			shared,
			typed,
			c.appearance
		),
		speeds: ( Array.isArray( c.speeds ) && c.speeds.length && c.speeds ) ||
			( Array.isArray( global.speeds ) && global.speeds.length && global.speeds ) ||
			CUSTOMIZE_DEFAULTS.speeds,
		// The audio blob gets a say here too: an audio default named for its skip
		// length ("Audiobook", 30s) has to be able to set it site-wide, not only
		// when it is applied as a saved preset.
		skipSeconds: c.skipSeconds ||
			( isAudio ? ( g.player_defaults_audio || {} ).skipSeconds : 0 ) ||
			global.skipSeconds ||
			CUSTOMIZE_DEFAULTS.skipSeconds,
	};
}
