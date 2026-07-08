/**
 * Central customization defaults + resolver. The admin writes a `customize`
 * object into the video config; here we deep-merge it over defaults so the
 * player and controls can read a complete, safe shape.
 */
export const CUSTOMIZE_DEFAULTS = {
	controls: {
		play: true,
		rewind: true,
		forward: true,
		progress: true,
		currentTime: true,
		duration: true,
		mute: true,
		volume: true,
		captions: true,
		settings: true, // gear menu (speed/quality/captions)
		speed: true,
		pip: true,
		fullscreen: true,
		download: false,
	},
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
		noSkip: false, // block seeking past the furthest point watched (rewind ok)
		hoverPreview: false, // muted inline preview when hovering the poster facade (direct-file sources)
	},
	appearance: {
		skin: 'default', // default | modern | simple | minimal | standard | floating (pro) | ambient (pro)
		accent: '#4f46e5',
		hoverColor: '',
		bigPlay: true,
		playButtonStyle: 'circle', // circle | square | soft
		roundness: 10, // stage border radius, px
		controlBarStyle: 'gradient', // gradient | solid | minimal
		aspectRatio: '16:9', // 16:9 | 9:16 | 4:3 | 1:1 | 21:9 | auto
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

/**
 * Resolve the effective customization by layering, lowest → highest priority:
 *   built-in defaults  →  site-wide defaults (TruePlayerGlobal.player_defaults)
 *   →  per-video config.customize
 *
 * So an admin sets global defaults once and any single video can override.
 */
export function resolveCustomize( config = {} ) {
	const global = ( typeof window !== 'undefined' && window.TruePlayerGlobal && window.TruePlayerGlobal.player_defaults ) || {};
	const c = config.customize || {};
	// Back-compat: older configs stored the accent under `branding`.
	const brandingAccent = config.branding && config.branding.accent;

	return {
		controls: mergeSection( CUSTOMIZE_DEFAULTS.controls, global.controls, c.controls ),
		behavior: mergeSection( CUSTOMIZE_DEFAULTS.behavior, global.behavior, c.behavior ),
		appearance: mergeSection(
			{ ...CUSTOMIZE_DEFAULTS.appearance, accent: brandingAccent || CUSTOMIZE_DEFAULTS.appearance.accent },
			global.appearance,
			c.appearance
		),
		speeds: ( Array.isArray( c.speeds ) && c.speeds.length && c.speeds ) ||
			( Array.isArray( global.speeds ) && global.speeds.length && global.speeds ) ||
			CUSTOMIZE_DEFAULTS.speeds,
		skipSeconds: c.skipSeconds || global.skipSeconds || CUSTOMIZE_DEFAULTS.skipSeconds,
	};
}
