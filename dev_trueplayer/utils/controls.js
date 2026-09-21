/**
 * The one description of a player control.
 *
 * This used to be two lists that had to agree by hand: CONTROL_LABELS in the
 * editor's Player → Controls grid (which decided what an author could toggle)
 * and CUSTOMIZE_DEFAULTS.controls in the player (which decided what shipped on
 * by default). A key present in one and missing from the other is not a
 * theoretical drift — Controls.jsx's show() treats an *undefined* key as ON, so
 * a control that reached the player without a declared default would appear on
 * every existing item the moment its button was written.
 *
 * Declaring a control here is now the whole job: the admin grid, the player's
 * defaults and the player's show() fallback all read this array.
 *
 * Array ORDER is meaningful — it is the order of the toggles in the editor and
 * the intended order of the buttons in the bar.
 *
 * Lives under @Utils rather than @Admin because the player bundle needs it and
 * the player must not import from the admin app — same reason as source-types.js.
 *
 * NOTE FOR PHP: there is deliberately no server-side allowlist of control keys.
 * Configs are stored verbatim (VideosController::create/update), which is what
 * lets a new key ship without a PHP change. Adding an allowlist later would
 * silently drop every key that is newer than it.
 */
import { __ } from './translation';

/**
 * @property {string}   key      The `customize.controls` key.
 * @property {string}   label    Author-facing label in the editor grid.
 * @property {string}   media    'video' | 'audio' | 'both' — which media types
 *                               may offer this toggle. Scoping is a UI concern
 *                               only; the player still gates on real provider
 *                               capability, so a stale stored value is inert.
 * @property {boolean}  default  Ships enabled? Seeds CUSTOMIZE_DEFAULTS.controls.
 * @property {?string}  requires Capability token the player also checks
 *                               ('download' | 'pip' | 'fullscreen' | 'tracks' |
 *                               'info' | 'playlist' | 'rate' | 'quality'),
 *                               or null.
 * @property {string[]} notFor   Source types where the control is inert.
 */
export const CONTROLS = [
	{ key: 'play', label: __( 'Play / pause' ), media: 'both', default: true, requires: null, notFor: [] },
	{ key: 'prev', label: __( 'Previous track (playlists)' ), media: 'both', default: true, requires: 'playlist', notFor: [] },
	{ key: 'next', label: __( 'Next track (playlists)' ), media: 'both', default: true, requires: 'playlist', notFor: [] },
	{ key: 'rewind', label: __( 'Rewind' ), media: 'both', default: true, requires: null, notFor: [] },
	{ key: 'forward', label: __( 'Fast-forward' ), media: 'both', default: true, requires: null, notFor: [] },
	{ key: 'progress', label: __( 'Progress bar' ), media: 'both', default: true, requires: null, notFor: [] },
	{ key: 'currentTime', label: __( 'Current time' ), media: 'both', default: true, requires: null, notFor: [] },
	{ key: 'duration', label: __( 'Duration' ), media: 'both', default: true, requires: null, notFor: [] },
	{ key: 'mute', label: __( 'Mute' ), media: 'both', default: true, requires: null, notFor: [] },
	{ key: 'volume', label: __( 'Volume slider' ), media: 'both', default: true, requires: null, notFor: [] },
	// Off by default: playback speed has always lived in the gear menu, and
	// turning this on for every existing player would add a button nobody asked
	// for. Audio presets are expected to switch it on.
	{ key: 'speed', label: __( 'Playback speed button' ), media: 'both', default: false, requires: 'rate', notFor: [] },
	// Off by default for the same reason as speed: quality has always lived in
	// the gear menu, and switching this on for every existing player would add
	// a button nobody asked for. `notFor` lists the sources that are a single
	// progressive file — one file has no ladder to choose from, so the toggle
	// would be offered and then do nothing. `url` is NOT excluded: it accepts
	// an .m3u8, and whether a given one has levels is only knowable at play.
	{ key: 'quality', label: __( 'Quality button' ), media: 'video', default: false, requires: 'quality', notFor: [ 'self', 'bunnyStorage', 'gumletStorage' ] },
	{ key: 'captions', label: __( 'Captions' ), media: 'both', default: true, requires: 'tracks', notFor: [] },
	// TRUE by default, and it must stay that way: the chapters/transcript button
	// is currently rendered unconditionally whenever there is something to show,
	// so defaulting this to false would silently remove a working button from
	// every existing item.
	{ key: 'chapters', label: __( 'Chapters & transcript' ), media: 'both', default: true, requires: 'info', notFor: [] },
	{ key: 'settings', label: __( 'Settings (gear, incl. playback speed)' ), media: 'both', default: true, requires: null, notFor: [] },
	{ key: 'pip', label: __( 'Picture-in-picture' ), media: 'video', default: true, requires: 'pip', notFor: [ 'youtube' ] },
	{ key: 'fullscreen', label: __( 'Fullscreen' ), media: 'video', default: true, requires: 'fullscreen', notFor: [] },
	{ key: 'download', label: __( 'Download button' ), media: 'both', default: false, requires: 'download', notFor: [ 'youtube', 'vimeo' ] },
];

/**
 * {key: default} — the object CUSTOMIZE_DEFAULTS.controls is built from, and the
 * fallback Controls.jsx's show() consults before its own implicit `true`.
 */
export const CONTROL_DEFAULTS = CONTROLS.reduce(
	( map, c ) => ( { ...map, [ c.key ]: c.default } ),
	{}
);

/** Every control a given media type may offer, in declared order. */
export function controlsFor( mediaType ) {
	const want = mediaType === 'audio' ? 'audio' : 'video';
	return CONTROLS.filter( ( c ) => c.media === 'both' || c.media === want );
}

/**
 * The controls the editor should offer for this item.
 *
 * `hasPlaylist` is opt-out, not opt-in: a media item can be added to a playlist
 * long after it is configured, so the editor cannot know — and hiding the
 * prev/next toggles there would make a playlist's buttons unconfigurable. The
 * player renders them only when a playlist actually passes the callbacks, so
 * offering the toggle costs nothing. Pass `false` where a playlist genuinely
 * cannot exist.
 *
 * @param {Object}  opts
 * @param {string}  opts.mediaType   'audio' | 'video'
 * @param {string}  opts.sourceType  `config.source.type`
 * @param {boolean} opts.hasPlaylist Default true.
 * @return {Object[]}
 */
export function availableControls( { mediaType, sourceType = '', hasPlaylist = true } = {} ) {
	return controlsFor( mediaType ).filter( ( c ) => {
		if ( c.notFor.includes( sourceType ) ) {
			return false;
		}
		if ( c.requires === 'playlist' && ! hasPlaylist ) {
			return false;
		}
		return true;
	} );
}
