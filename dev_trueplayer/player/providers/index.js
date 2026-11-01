import { createHtml5Provider } from './html5';
import { extProviders } from '@Ext/player';

/**
 * Provider factory. HTML5 (self-hosted/HLS/audio/url) ships in the core
 * bundle; YouTube and Vimeo SDKs are code-split and only loaded when that
 * source type is actually used. Other source types can be supplied through
 * `@Ext/player`'s `extProviders`.
 */
export async function createProvider( container, source, opts = {} ) {
	if ( extProviders[ source.type ] ) {
		return extProviders[ source.type ]( container, source, opts, createHtml5Provider );
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
