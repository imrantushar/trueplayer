import { rest } from '@Utils/rest';
import { __ } from '@Utils/translation';

export const api = {
	listVideos: () => rest.get( 'videos' ),
	getVideo: ( id ) => rest.get( `videos/${ id }` ),
	createVideo: ( title, config = {} ) => rest.post( 'videos', { title, config } ),
	updateVideo: ( id, data ) => rest.put( `videos/${ id }`, data ),
	deleteVideo: ( id ) => rest.del( `videos/${ id }` ),

	/**
	 * Store a frame captured from a self-hosted video as that video's poster.
	 *
	 * The pixels come from the browser (see admin/utils/frameCapture.js) — the
	 * server can't decode video — and come back as a media-library attachment
	 * URL, so the poster behaves like any other image the author picked.
	 *
	 * `src` names the file the frame came from, so the poster can be named
	 * after it — the capture runs before the editor is saved, so the server's
	 * copy of the config still points at whatever file was there before.
	 *
	 * @param {number} id   Video id.
	 * @param {Blob}   blob The captured frame.
	 * @param {string} src  The video file the frame was captured from.
	 * @return {Promise<{id: number, url: string}>} The stored attachment.
	 */
	savePoster: ( id, blob, src ) => rest.upload( `videos/${ id }/poster?src=${ encodeURIComponent( src ) }`, blob ),

	/**
	 * Delete the frames captured for a video that no saved config uses — called
	 * when the author removes the video file, so a poster generated for a file
	 * that is now gone doesn't linger in the media library. The poster the saved
	 * config still points at is kept until the removal itself is saved.
	 *
	 * @param {number} id Video id.
	 */
	discardPosters: ( id ) => rest.del( `videos/${ id }/poster` ),
	getSettings: () => rest.get( 'settings' ),
	saveSettings: ( data ) => rest.post( 'settings', data ),
	// No type filter here on purpose: the Presets screen shows both kinds as
	// tabs and needs the counts, so it fetches once and splits client-side.
	listPresets: () => rest.get( 'presets' ),
	getPreset: ( id ) => rest.get( `presets/${ id }` ),
	createPreset: ( title, config = {}, type = 'video' ) => rest.post( 'presets', { title, config, type } ),
	updatePreset: ( id, data ) => rest.put( `presets/${ id }`, data ),
	deletePreset: ( id ) => rest.del( `presets/${ id }` ),
	listPlaylists: () => rest.get( 'playlists' ),
	getPlaylist: ( id ) => rest.get( `playlists/${ id }` ),
	createPlaylist: ( title ) => rest.post( 'playlists', { title, config: { layout: 'sidebar', videos: [] } } ),
	updatePlaylist: ( id, data ) => rest.put( `playlists/${ id }`, data ),
	deletePlaylist: ( id ) => rest.del( `playlists/${ id }` ),

	/**
	 * Switch an addon on or off.
	 *
	 * Addons predate the REST controllers and live on admin-ajax with their own
	 * `trueplayer_nonce` (see includes/addons.php), so this one call doesn't go
	 * through `rest`. Activation runs the addon's own setup — for interactive
	 * content that means creating its tables — so the caller should reload
	 * rather than assume the UI can just re-render.
	 *
	 * @param {string}  slug   Addon slug, e.g. 'interactive'.
	 * @param {boolean} status Desired state.
	 */
	setAddonStatus: async ( slug, status ) => {
		const g = window.TruePlayerGlobal || {};
		const body = new URLSearchParams( {
			action: 'trueplayer/addons/save_addon_status',
			security: g.trueplayer_nonce || '',
			addon_slug: slug,
			status: status ? '1' : '0',
		} );
		const res = await fetch( g.ajax_url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			credentials: 'same-origin',
			body,
		} );
		const json = await res.json().catch( () => null );
		if ( ! json || ! json.success ) {
			throw new Error( ( json && json.data && json.data.message ) || __( 'Could not change the addon status.' ) );
		}
		return json.data;
	},
};

function nonce() {
	return ( window.TruePlayerGlobal || {} ).nonce || '';
}
