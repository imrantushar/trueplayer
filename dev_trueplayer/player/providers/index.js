import { createHtml5Provider } from './html5';

/**
 * Bunny.net Stream → HLS. We play the raw playlist with our own controls +
 * watch-tracking rather than Bunny's iframe. Bunny CDN sends CORS headers, so
 * hls.js can fetch the manifest/segments.
 */
function resolveBunny( source ) {
	if ( source.src ) {
		return { ...source, type: 'hls' }; // a full .m3u8 URL was provided
	}
	const zone = ( source.pullZone || '' ).replace( /^https?:\/\//, '' ).replace( /\/$/, '' );
	return { ...source, type: 'hls', src: `https://${ zone }/${ source.videoId }/playlist.m3u8` };
}

/**
 * Mux → HLS. Mux serves an HLS playlist at stream.mux.com/{PLAYBACK_ID}.m3u8;
 * a full .m3u8 (e.g. a signed URL) can be supplied directly instead.
 */
function resolveMux( source ) {
	if ( source.src ) {
		return { ...source, type: 'hls' };
	}
	const id = ( source.playbackId || source.videoId || '' ).trim();
	return { ...source, type: 'hls', src: `https://stream.mux.com/${ id }.m3u8` };
}

/**
 * A source that is simply a URL, where only the URL says how to play it: an
 * .m3u8 goes through hls.js, anything else is a plain progressive file.
 *
 * Covers Bunny Storage (a file on a pull zone) and both Gumlet types, whose
 * playback URL the server has already resolved from the asset id — ABR assets
 * arrive as a manifest, MP4-format ones as a file, and neither needs this
 * layer to know which.
 */
function resolveFileOrManifest( source ) {
	const src = ( source.src || '' ).trim();
	return { ...source, type: /\.m3u8(\?|$)/i.test( src ) ? 'hls' : 'url', src };
}

/**
 * Provider factory. HTML5 (self-hosted/HLS/Bunny/audio/url) ships in the core
 * bundle; YouTube and Vimeo SDKs are code-split and only loaded when that
 * source type is actually used.
 */
export async function createProvider( container, source, opts = {} ) {
	if ( source.type === 'bunny' ) {
		return createHtml5Provider( container, resolveBunny( source ), opts );
	}
	if ( source.type === 'mux' ) {
		return createHtml5Provider( container, resolveMux( source ), opts );
	}
	if ( [ 'bunnyStorage', 'gumlet', 'gumletStorage' ].includes( source.type ) ) {
		return createHtml5Provider( container, resolveFileOrManifest( source ), opts );
	}
	switch ( source.type ) {
		case 'youtube': {
			const { createYouTubeProvider } = await import( /* webpackChunkName: "yt" */ './youtube' );
			return createYouTubeProvider( container, source, opts );
		}
		case 'vimeo': {
			const { createVimeoProvider } = await import( /* webpackChunkName: "vimeo" */ './vimeo' );
			return createVimeoProvider( container, source, opts );
		}
		case 'self':
		case 'url':
		case 'hls':
		case 'audio':
		default:
			return createHtml5Provider( container, source, opts );
	}
}
