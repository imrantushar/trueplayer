/**
 * What the block editor knows about TruePlayer, and the two REST calls it
 * makes.
 *
 * Deliberately not `admin/api.js`: that reads its REST root and nonce off
 * `TruePlayerGlobal`, which is localized only on TruePlayer's own admin pages.
 * In the editor it would be undefined, leaving the root to fall back to
 * `/wp-json/` — wrong on a site running plain permalinks — with no nonce at
 * all. `@wordpress/api-fetch` already resolves both correctly here.
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@Utils/translation';

const G = () => window.TruePlayerBlock || {};

/** The product name, or the site owner's own when white-label is on. */
export const brand = () => G().brand || 'TruePlayer';

/** Mirrors the quick-create REST permission callback — never assume it. */
export const canCreate = () => !! G().canCreate;

/** Where this video is configured in full, or '' for users who can't go there. */
export const editUrl = ( id ) => ( G().editUrl ? G().editUrl + id : '' );

/** The library screen, or '' for users who can't reach the admin app. */
export const libraryUrl = () => G().libraryUrl || '';

/**
 * How each source type is written, for the four the dialog offers and the
 * premium ones it doesn't — the picker shows whatever is already in the
 * library, so a video set up as Bunny or Mux still has to read properly.
 */
const TYPE_LABELS = {
	self: __( 'Self-hosted' ),
	youtube: __( 'YouTube' ),
	vimeo: __( 'Vimeo' ),
	url: __( 'External URL' ),
	hls: __( 'HLS stream' ),
	mux: __( 'Mux' ),
	bunny: __( 'Bunny.net Stream' ),
	bunnyStorage: __( 'Bunny.net Storage' ),
};

/** A source type as a person reads it, falling back to the raw key. */
export const typeLabel = ( value ) => TYPE_LABELS[ value ] || value;

/**
 * The sources the create dialog can finish on its own.
 *
 * Each is a type plus one URL, so the author lands back in their post with a
 * player that already plays. Bunny, Mux and HLS need fields of their own, so
 * they are set up in the full editor rather than half-offered here — the
 * dialog says so instead of listing them as dead options. The server enforces
 * the same list (VideosController::QUICK_SOURCE_TYPES).
 */
export const SOURCE_TYPES = [
	{
		value: 'self',
	},
	{
		value: 'youtube',
		field: __( 'YouTube URL or video ID' ),
		placeholder: 'https://www.youtube.com/watch?v=…',
	},
	{
		value: 'vimeo',
		field: __( 'Vimeo URL or video ID' ),
		placeholder: 'https://vimeo.com/…',
	},
	{
		value: 'url',
		field: __( 'Media URL' ),
		placeholder: 'https://example.com/video.mp4',
	},
].map( ( t ) => ( { ...t, label: typeLabel( t.value ) } ) );

export const sourceType = ( value ) =>
	SOURCE_TYPES.find( ( t ) => t.value === value ) || SOURCE_TYPES[ 0 ];

/** Every video in the library, as the picker needs it: id, title, type, poster. */
export const fetchVideos = () => apiFetch( { path: '/trueplayer/v1/videos/options' } );

/** Create one, and get it back in the same shape `fetchVideos` returns. */
export const createVideo = ( { title, type, src } ) =>
	apiFetch( {
		path: '/trueplayer/v1/videos/quick',
		method: 'POST',
		data: { title, type, src },
	} );

/** Retarget an existing one. Same narrow contract as `createVideo`. */
export const updateVideo = ( id, { title, type, src } ) =>
	apiFetch( {
		path: `/trueplayer/v1/videos/${ id }/quick`,
		method: 'POST',
		data: { title, type, src },
	} );

/**
 * A video's render-ready config, for the in-canvas preview.
 *
 * The server runs the same pipeline the shortcode does, so what the preview
 * plays is what the published page plays — presets applied, free-tier limits
 * clamped, quiz answer keys stripped.
 */
export const fetchPreview = ( id ) => apiFetch( { path: `/trueplayer/v1/videos/${ id }/preview` } );
