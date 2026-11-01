/**
 * The one description of what a video source type is and what it can do.
 *
 * This used to be five separate literals — the editor's picker, the create
 * dialog's tiles, the library's badge map, the Pro list, and the player's own
 * gate — each listing the types it happened to care about. They drifted, and
 * the drift was not theoretical: `bunnyStorage` was missing from the badge map
 * (so the library printed a raw "bunnyStorage"), from the player's Pro gate
 * (so a premium source played on a free install), and from the editor's
 * privatable list (so a working signing feature was unreachable in the UI).
 *
 * Adding a type here is now the whole job. It lives under @Utils rather than
 * @Admin because the player bundle needs it too, and the player must not
 * import from the admin app.
 *
 * Keep in step with TruePlayer\Pro::PREMIUM_SOURCES in includes/pro.php —
 * that is the enforcing copy; this one drives the UI and the client-side
 * courtesy check.
 */
import { isAudioSource } from './audio';
import { __ } from './translation';

/**
 * @property {string}  value        Stored in `config.source.type`.
 * @property {string}  label        Shown in the editor picker and create dialog.
 * @property {string}  hint         One-line description for the create dialog tiles.
 * @property {string}  badge        Short label for the library's source badge.
 * @property {string}  tone         Badge tone (see Badge in components/UI.jsx).
 * @property {boolean} pro          Requires TruePlayer Pro.
 * @property {boolean} embed        Rendered as a third-party iframe, not a media element.
 * @property {boolean} file         `src` is a media file a <video> can decode directly.
 * @property {boolean} privatable   Can be served through signed, expiring links.
 * @property {boolean} audio        Can be marked audio-only.
 * @property {boolean} quickCreate  Offered by the block editor's quick-create dialog.
 */
export const SOURCE_TYPES = [
	{
		value: 'self',
		label: __( 'Self-hosted (media library)' ),
		hint: __( 'A file already in this site’s media library.' ),
		badge: __( 'Self-hosted' ), tone: 'gray',
		pro: false, embed: false, file: true, privatable: true, audio: true, quickCreate: true,
	},
	{
		value: 'youtube',
		label: __( 'YouTube' ),
		hint: __( 'Paste a YouTube link.' ),
		badge: 'YouTube', tone: 'red',
		pro: false, embed: true, file: false, privatable: false, audio: false, quickCreate: true,
	},
	{
		value: 'vimeo',
		label: __( 'Vimeo' ),
		hint: __( 'Paste a Vimeo link.' ),
		badge: 'Vimeo', tone: 'brand',
		pro: false, embed: true, file: false, privatable: false, audio: false, quickCreate: true,
	},
	{
		value: 'url',
		label: __( 'External URL (mp4/webm)' ),
		hint: __( 'A media file hosted anywhere.' ),
		badge: 'MP4', tone: 'brand',
		pro: false, embed: false, file: true, privatable: true, audio: true, quickCreate: true,
	},
	{
		value: 'bunny',
		label: __( 'Bunny.net Stream' ),
		hint: __( 'A video in a Bunny.net video library.' ),
		badge: 'Bunny', tone: 'green',
		pro: true, embed: false, file: false, privatable: true, audio: false, quickCreate: false,
	},
	{
		value: 'bunnyStorage',
		label: __( 'Bunny.net Storage (file)' ),
		hint: __( 'Upload straight to your Bunny.net storage zone.' ),
		badge: __( 'Bunny Storage' ), tone: 'green',
		pro: true, embed: false, file: true, privatable: true, audio: true, quickCreate: false,
	},
	{
		value: 'gumlet',
		label: __( 'Gumlet Stream' ),
		hint: __( 'A video that already exists in your Gumlet workspace.' ),
		badge: 'Gumlet', tone: 'amber',
		pro: true, embed: false, file: false, privatable: true, audio: false, quickCreate: false,
	},
	{
		value: 'gumletStorage',
		label: __( 'Gumlet (upload a file)' ),
		hint: __( 'Upload a file and let Gumlet transcode it for streaming.' ),
		badge: __( 'Gumlet Upload' ), tone: 'amber',
		pro: true, embed: false, file: true, privatable: true, audio: true, quickCreate: false,
	},
	{
		value: 'mux',
		label: __( 'Mux' ),
		hint: __( 'A Mux playback ID.' ),
		badge: 'Mux', tone: 'brand',
		pro: true, embed: false, file: false, privatable: false, audio: false, quickCreate: false,
	},
	{
		value: 'hls',
		label: __( 'HLS stream (.m3u8)' ),
		hint: __( 'Any adaptive HLS manifest.' ),
		badge: 'HLS', tone: 'amber',
		pro: true, embed: false, file: false, privatable: false, audio: false, quickCreate: false,
	},
];

const byValue = SOURCE_TYPES.reduce( ( map, t ) => ( { ...map, [ t.value ]: t } ), {} );

/** The descriptor for a type, or undefined for one we don't know. */
export function sourceType( value ) {
	return byValue[ value ];
}

const valuesWhere = ( flag ) => SOURCE_TYPES.filter( ( t ) => t[ flag ] ).map( ( t ) => t.value );

/** Types that need Pro. Mirrors TruePlayer\Pro::PREMIUM_SOURCES. */
export const PRO_SOURCES = valuesWhere( 'pro' );
/** Types rendered as a third-party iframe rather than a media element. */
export const EMBED_SOURCES = valuesWhere( 'embed' );
/** Types whose `src` is a media file a <video> element can decode. */
export const FILE_SOURCES = valuesWhere( 'file' );
/** Types that can be served through signed, expiring links. */
export const PRIVATABLE_SOURCES = valuesWhere( 'privatable' );
/** Types that can be marked audio-only. */
export const AUDIO_SOURCES = valuesWhere( 'audio' );

export const isProSource = ( type ) => PRO_SOURCES.includes( type );
export const isEmbedSource = ( type ) => EMBED_SOURCES.includes( type );

/**
 * Display metadata for a video's source badge in the library.
 *
 * Audio wins over the type: what matters at a glance in a list is that this
 * one has no picture, not which CDN it came from.
 */
export function sourceMeta( source = {} ) {
	if ( isAudioSource( source ) ) {
		return { label: __( 'Audio' ), tone: 'gray' };
	}
	const t = byValue[ source.type ];
	return t ? { label: t.badge, tone: t.tone } : { label: source.type || __( 'no source' ), tone: 'gray' };
}
