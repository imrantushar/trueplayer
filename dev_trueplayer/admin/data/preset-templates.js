// Predefined player looks (FluentPlayer-style). Shared by the Presets builder
// (starting point for a new preset) and Settings → General (site-wide default
// player template). Each seeds config.customize.appearance.
// `description` is what the picker shows under each tile. Each line states the
// one thing that skin actually does differently in player/style.css — the
// tiles alone can only hint at it, and "Modern / Simple / Standard" tells an
// author nothing about which to choose.
import { __ } from '@Utils/translation';

export const PRESET_TEMPLATES = [
	{ key: 'default', label: __( 'Default' ), description: __( 'Gradient bar fading over the picture. The balanced baseline.' ), appearance: { skin: 'default', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 10 } },
	{ key: 'modern', label: __( 'Modern' ), description: __( 'Roomier bar, thicker scrubber and a larger play button.' ), appearance: { skin: 'modern', controlBarStyle: 'solid', playButtonStyle: 'soft', roundness: 14 } },
	{ key: 'simple', label: __( 'Simple' ), description: __( 'Flat solid bar, tight padding — quiet and unobtrusive.' ), appearance: { skin: 'simple', controlBarStyle: 'solid', playButtonStyle: 'square', roundness: 6 } },
	{ key: 'minimal', label: __( 'Minimal' ), description: __( 'Controls in a small pill. Time and volume are hidden.' ), appearance: { skin: 'minimal', controlBarStyle: 'minimal', playButtonStyle: 'square', roundness: 0 } },
	{ key: 'standard', label: __( 'Standard' ), description: __( 'Opaque deck with square edges — the classic player look.' ), appearance: { skin: 'standard', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 8 } },
	{ key: 'floating', label: __( 'Floating' ), pro: true, description: __( 'The bar detaches from the edge as a blurred, rounded panel.' ), appearance: { skin: 'floating', controlBarStyle: 'solid', playButtonStyle: 'soft', roundness: 16 } },
	{ key: 'ambient', label: __( 'Ambient' ), pro: true, description: __( 'A blurred glow of the poster spills out behind the player.' ), appearance: { skin: 'ambient', controlBarStyle: 'gradient', playButtonStyle: 'circle', roundness: 8 } },
];

/**
 * Audio starting points. A separate list because the video templates are built
 * on skins, and a skin is a treatment of a picture — there is no picture in an
 * audio bar. What varies here instead is the bar's shape (audioLayout) and the
 * controls a listener actually reaches for.
 *
 * `controls` seeds a preset's own defaults; a media item's own toggles still
 * win over them at render (preset merges UNDER the video).
 */
export const AUDIO_PRESET_TEMPLATES = [
	{
		// Key stays `bare` although the label reads "Minimal": the key is what a
		// site has already stored in `general.defaultAudioTemplate`, so renaming
		// it would silently deselect the tile on every install that chose this
		// one. The label is the only part an author ever sees.
		//
		// First, and the free default: the list is ordered free-then-pro (see
		// `pro` below), and the tile a free install lands on has to be one it can
		// actually use.
		key: 'bare',
		label: __( 'Minimal' ),
		description: __( 'Just a play button and a waveform. No art, time or volume.' ),
		appearance: { audioLayout: 'minimal', controlBarStyle: 'minimal', roundness: 8 },
		controls: { speed: false, rewind: false, forward: false, volume: false, mute: false, currentTime: false, duration: false },
	},
	{
		key: 'album',
		label: __( 'Album' ),
		description: __( 'Large square cover art above the title and controls.' ),
		appearance: { audioLayout: 'card', controlBarStyle: 'solid', roundness: 14 },
		controls: { speed: false, rewind: false, forward: false, prev: true, next: true },
	},
	{
		key: 'playlist',
		label: __( 'Playlist' ),
		description: __( 'For episodes inside a playlist: previous / next track, nothing competing for space.' ),
		appearance: { audioLayout: 'compact', controlBarStyle: 'solid', roundness: 10 },
		// The track list itself belongs to the playlist wrapper (tp_playlist —
		// see includes/playlist.php), not to any one item. What an item can do
		// is offer the transport that MOVES through that list, which is exactly
		// what prev/next are, and stay quiet otherwise: speed and chapters are
		// per-item concerns that clutter a bar being used as a queue.
		//
		// The player only renders prev/next when a playlist actually passes the
		// callbacks, so this template is inert — not broken — on an item that
		// never joins one.
		controls: { prev: true, next: true, speed: false, chapters: false, rewind: false, forward: false },
	},

	// ── Pro ───────────────────────────────────────────────────────────────
	// The two long-form templates. `pro` is read by both pickers (Settings and
	// the preset builder) to lock the tile and mark it, exactly as the video
	// list has always done for Floating and Ambient.
	//
	// Note what this gate is and is not. A premium *skin* is a capability —
	// `skin: floating` is one stored value naming CSS that only ships with Pro,
	// and Helper::enforce_pro_limits() resets it at render. These two are
	// bundles of ordinary free controls over a layout (`compact`) that the free
	// Playlist template also uses, so there is nothing for the render gate to
	// strip and deliberately no entry added to Pro::PREMIUM_SKINS. The gate is
	// the one-click bundle, not the result — a free user can still assemble the
	// same bar by hand. Making it enforceable would mean giving each of these a
	// layout of its own with its own CSS.
	{
		key: 'podcast',
		label: __( 'Podcast' ),
		pro: true,
		description: __( 'Roomier bar with large cover art, skip buttons and a speed control.' ),
		appearance: { audioLayout: 'podcast', controlBarStyle: 'solid', roundness: 10 },
		controls: { speed: true, rewind: true, forward: true, chapters: true },
	},
	{
		key: 'audiobook',
		label: __( 'Audiobook' ),
		pro: true,
		description: __( 'Long-form listening: 30-second skips, speed control and chapter navigation.' ),
		// Its own layout, not compact with switches flipped: the transport is
		// centred and enlarged because it is what a listener reaches for across
		// hours. That is also what makes the Pro gate real — there is a stored
		// value for Helper::enforce_pro_limits() to refuse.
		appearance: { audioLayout: 'audiobook', controlBarStyle: 'solid', roundness: 10 },
		// Volume off: a listener on headphones uses the device volume, and the
		// slider is the first thing worth trading for room on a long-form bar.
		controls: { speed: true, rewind: true, forward: true, chapters: true, volume: false, prev: false, next: false },
		// 30s rather than the 10s default — the audiobook convention, and the
		// reason the skip buttons are worth having at this length.
		skipSeconds: 30,
	},
];

/** Templates for one media type. */
export function templatesFor( type ) {
	return 'audio' === type ? AUDIO_PRESET_TEMPLATES : PRESET_TEMPLATES;
}

/**
 * Every key any template of this type is allowed to own.
 *
 * Applying a template has to CLEAR these before writing its own values, or a
 * settings blob accumulates residue from every template ever clicked: pick
 * Minimal, then Playlist, and what is saved is Playlist's layout still wearing
 * Minimal's switched-off volume and time readouts — under a tile that says
 * "Playlist". A template names a complete look, so choosing one has to mean
 * "this", not "this on top of the last one".
 *
 * Derived from the lists rather than written out, so a template that starts
 * setting a new key is cleaned up by that fact alone. Anything outside the
 * union is not a template's to touch and survives: the brand accent, the
 * default aspect ratio, the custom CSS.
 *
 * @param {string} type 'video' | 'audio'.
 * @return {{appearance: string[], controls: string[], skipSeconds: boolean}}
 */
export function templateKeys( type = 'video' ) {
	const appearance = new Set();
	const controls = new Set();
	let skipSeconds = false;
	templatesFor( type ).forEach( ( t ) => {
		Object.keys( t.appearance || {} ).forEach( ( k ) => appearance.add( k ) );
		Object.keys( t.controls || {} ).forEach( ( k ) => controls.add( k ) );
		skipSeconds = skipSeconds || undefined !== t.skipSeconds;
	} );
	return { appearance: [ ...appearance ], controls: [ ...controls ], skipSeconds };
}

/**
 * The settings blob that results from choosing `template`, given the current
 * one. Shared by nothing else today, but it is the rule the picker has to obey
 * and it is worth being able to test without a React tree.
 *
 * @param {Object} blob     The current `customize` / `customizeAudio` object.
 * @param {Object} template The chosen template.
 * @param {string} type     'video' | 'audio'.
 * @return {Object} A new blob.
 */
export function applyTemplateToBlob( blob, template, type = 'video' ) {
	const owned = templateKeys( type );
	const strip = ( obj, keys ) => {
		const out = { ...( obj || {} ) };
		keys.forEach( ( k ) => delete out[ k ] );
		return out;
	};

	const out = { ...( blob || {} ) };
	out.appearance = { ...strip( out.appearance, owned.appearance ), ...template.appearance };
	// Video templates own no controls, so they leave the section alone rather
	// than stamping an empty object over it.
	if ( owned.controls.length ) {
		out.controls = { ...strip( out.controls, owned.controls ), ...( template.controls || {} ) };
	}
	if ( owned.skipSeconds ) {
		// A template that does not name a skip length means the built-in 10s —
		// not whatever the last template that did name one left behind.
		if ( template.skipSeconds ) {
			out.skipSeconds = template.skipSeconds;
		} else {
			delete out.skipSeconds;
		}
	}
	return out;
}

// The config object a template seeds (for creating a preset from it).
export function templateConfig( key, type = 'video' ) {
	const t = templatesFor( type ).find( ( x ) => x.key === key );
	if ( ! t ) {
		return {};
	}
	const customize = { appearance: { ...t.appearance } };
	if ( t.controls ) {
		customize.controls = { ...t.controls };
	}
	// `skipSeconds` sits beside appearance/controls rather than inside them —
	// it is its own top-level key in the customize shape (see
	// CUSTOMIZE_DEFAULTS), so a template that sets it has to seed it there too
	// or the skip buttons it just switched on would still jump the default 10s.
	if ( t.skipSeconds ) {
		customize.skipSeconds = t.skipSeconds;
	}
	return { customize };
}

export const ASPECT_RATIOS = [
	{ value: '16:9', label: __( '16:9 (widescreen)' ) },
	{ value: '9:16', label: __( '9:16 (vertical)' ) },
	{ value: '4:3', label: __( '4:3 (classic)' ) },
	{ value: '1:1', label: __( '1:1 (square)' ) },
	{ value: '21:9', label: __( '21:9 (cinematic)' ) },
	{ value: 'auto', label: __( 'Auto (native)' ) },
];
