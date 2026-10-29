/**
 * Moving media into and out of the TruePlayer block.
 *
 * The block is only worth adopting if an author's existing posts can come
 * with them, so every core media block converts in, and back out, and a pasted
 * link becomes a player without a trip through the inserter.
 */
import { createBlock } from '@wordpress/blocks';
import { applyFilters } from '@wordpress/hooks';
import { detectSourceType } from './data';

const NAME = 'trueplayer/player';

const AUDIO_EXT = /\.(?:mp3|m4a|wav|ogg|oga|aac|flac)$/i;
const MEDIA_URL = /^https?:\/\/\S+\.(?:mp4|m4v|webm|ogv|mov|mp3|m4a|wav|ogg|oga|aac|flac)(?:[?#]\S*)?$/i;
const PROVIDER_URL = /^https?:\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be|vimeo\.com)\/\S+$/i;

const pathOf = ( url ) => ( url || '' ).split( /[?#]/ )[ 0 ];

/** The attributes for a pasted or converted link. */
const fromLink = ( url ) => {
	const src = ( url || '' ).trim();
	return {
		src,
		sourceType: detectSourceType( src ),
		mediaType: AUDIO_EXT.test( pathOf( src ) ) ? 'audio' : '',
	};
};

/**
 * Pasting a bare link is converted by default. A site that would rather keep
 * core's own embed for YouTube/Vimeo links turns that off with
 *   addFilter( 'trueplayer.block.pasteConvertProviders', 'my/ns', () => false );
 */
const pasteProviders = () => false !== applyFilters( 'trueplayer.block.pasteConvertProviders', true );

const isLinkParagraph = ( node ) => {
	if ( 'P' !== node.nodeName ) {
		return false;
	}
	const text = ( node.textContent || '' ).trim();
	if ( MEDIA_URL.test( text ) ) {
		return true;
	}
	return pasteProviders() && PROVIDER_URL.test( text );
};

const transforms = {
	from: [
		{
			type: 'block',
			blocks: [ 'core/video' ],
			transform: ( { src, poster, autoplay, loop, muted, id } ) =>
				createBlock( NAME, {
					...fromLink( src ),
					mediaType: 'video',
					// A library file is `self` even though its URL is http(s).
					sourceType: id ? 'self' : detectSourceType( src ),
					mediaId: id || 0,
					poster: poster || '',
					autoplayMode: autoplay ? 'muted' : '',
					muted: !! muted,
					loop: !! loop,
				} ),
		},
		{
			type: 'block',
			blocks: [ 'core/audio' ],
			transform: ( { src, autoplay, loop, id } ) =>
				createBlock( NAME, {
					...fromLink( src ),
					mediaType: 'audio',
					sourceType: id ? 'self' : 'url',
					mediaId: id || 0,
					autoplayMode: autoplay ? 'muted' : '',
					loop: !! loop,
				} ),
		},
		{
			type: 'block',
			blocks: [ 'core/embed' ],
			isMatch: ( { providerNameSlug } ) => [ 'youtube', 'vimeo' ].includes( providerNameSlug ),
			transform: ( { url, providerNameSlug } ) =>
				createBlock( NAME, { src: url || '', sourceType: providerNameSlug } ),
		},
		{
			type: 'shortcode',
			tag: 'trueplayer',
			attributes: {
				videoId: {
					type: 'number',
					shortcode: ( { named: { id = 0 } } ) => parseInt( id, 10 ) || 0,
				},
			},
		},
		{
			// Lower number than core's embed paste handler, so this wins for the
			// links it claims.
			type: 'raw',
			priority: 5,
			isMatch: isLinkParagraph,
			transform: ( node ) => createBlock( NAME, fromLink( node.textContent ) ),
		},
	],
	to: [
		{
			type: 'block',
			blocks: [ 'core/video' ],
			isMatch: ( { src, sourceType, mediaType } ) =>
				!! src && [ 'self', 'url' ].includes( sourceType ) && 'audio' !== mediaType,
			transform: ( { src, poster, autoplayMode, loop, muted, mediaId } ) =>
				createBlock( 'core/video', {
					src,
					poster,
					id: mediaId || undefined,
					autoplay: !! autoplayMode && 'off' !== autoplayMode,
					loop: !! loop,
					muted: !! muted,
				} ),
		},
		{
			type: 'block',
			blocks: [ 'core/audio' ],
			isMatch: ( { src, sourceType, mediaType } ) =>
				!! src && [ 'self', 'url' ].includes( sourceType ) && 'audio' === mediaType,
			transform: ( { src, autoplayMode, loop, mediaId } ) =>
				createBlock( 'core/audio', {
					src,
					id: mediaId || undefined,
					autoplay: !! autoplayMode && 'off' !== autoplayMode,
					loop: !! loop,
				} ),
		},
		{
			type: 'block',
			blocks: [ 'core/embed' ],
			isMatch: ( { src, sourceType } ) => !! src && [ 'youtube', 'vimeo' ].includes( sourceType ),
			transform: ( { src, sourceType } ) =>
				createBlock( 'core/embed', { url: src, providerNameSlug: sourceType, type: 'video' } ),
		},
	],
};

export default transforms;
