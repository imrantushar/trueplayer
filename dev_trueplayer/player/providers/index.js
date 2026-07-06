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
 * Provider factory. HTML5 (self-hosted/HLS/Bunny/audio/url) ships in the core
 * bundle; YouTube and Vimeo SDKs are code-split and only loaded when that
 * source type is actually used.
 */
export async function createProvider( container, source, opts = {} ) {
	if ( source.type === 'bunny' ) {
		return createHtml5Provider( container, resolveBunny( source ), opts );
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
