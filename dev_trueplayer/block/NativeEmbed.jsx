/**
 * YouTube and Vimeo inside the editor canvas, in their own player.
 *
 * The canvas is a `blob:` document, and YouTube refuses any embed that reaches
 * it without a Referer — which a blob document never sends — answering every
 * one with "Video player configuration error" (153), whatever parameters the
 * player is given. Embeds nested one level down, inside a sandboxed `srcdoc`
 * frame, are accepted; it is the same arrangement WordPress's own embed block
 * uses: an empty frame whose document is written in afterwards, with an explicit
 * referrer policy on the inner frame. (A `srcdoc` attribute is not the same
 * thing — YouTube still refuses it.) That frame cannot be driven from outside, so the TruePlayer skin and
 * controls are not drawn here — the published page, where this limit does not
 * exist, shows them.
 *
 * Self-hosted and direct media never come through here: those play in the real
 * player, in the canvas, exactly as published.
 */
import { useEffect, useRef } from '@wordpress/element';
import { __ } from '@Utils/translation';

const RATIOS = { '16:9': '16 / 9', '9:16': '9 / 16', '4:3': '4 / 3', '1:1': '1 / 1', '21:9': '21 / 9' };

/** The provider's own embed URL for a source, or '' when it can't be built. */
export function embedUrl( source ) {
	const src = ( source?.src || '' ).trim();
	if ( 'youtube' === source?.type ) {
		const m = src.match( /(?:v=|\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/ ) || src.match( /^([\w-]{11})$/ );
		return m ? `https://www.youtube.com/embed/${ m[ 1 ] }?feature=oembed&rel=0&playsinline=1` : '';
	}
	if ( 'vimeo' === source?.type ) {
		const m = src.match( /vimeo\.com\/(?:.*\/)?(\d+)(?:\/([\w]+))?/ ) || src.match( /^(\d+)$/ );
		if ( ! m ) {
			return '';
		}
		return `https://player.vimeo.com/video/${ m[ 1 ] }${ m[ 2 ] ? `?h=${ m[ 2 ] }` : '' }`;
	}
	return '';
}

/** Whether a source is one the canvas can't host through the real player. */
export const needsNativeEmbed = ( source ) => [ 'youtube', 'vimeo' ].includes( source?.type ) && '' !== embedUrl( source );

export default function NativeEmbed( { config, title } ) {
	const url = embedUrl( config?.source );
	const wanted = config?.customize?.appearance?.aspectRatio
		|| window.TruePlayerGlobal?.player_defaults?.appearance?.aspectRatio
		|| '16:9';
	const radius = config?.customize?.appearance?.roundness
		?? window.TruePlayerGlobal?.player_defaults?.appearance?.roundness
		?? 10;
	const frame = useRef( null );
	const safeTitle = ( title || '' ).replace( /[<>"&]/g, '' );

	// Written in after mount rather than set as `srcdoc`; see the note above.
	useEffect( () => {
		const doc = frame.current?.contentDocument;
		if ( ! doc || ! url ) {
			return;
		}
		doc.open();
		doc.write(
			'<!doctype html><style>html,body{margin:0;height:100%;overflow:hidden;background:#000}iframe{display:block;border:0;width:100%;height:100%}</style>' +
				`<iframe src="${ url }" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen title="${ safeTitle }"></iframe>`
		);
		doc.close();
	}, [ url, safeTitle ] );

	return (
		<>
			<iframe
				className="tp-block-native-embed"
				title={ title || __( 'Video preview' ) }
				sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
				ref={ frame }
				style={ {
					display: 'block',
					width: '100%',
					border: 0,
					background: '#000',
					aspectRatio: RATIOS[ wanted ] || '16 / 9',
					borderRadius: `${ Number( radius ) || 0 }px`,
				} }
			/>
			<p style={ { margin: '6px 0 0', fontSize: 12, color: '#757575' } }>
				{ __( 'Playing in the provider’s own player here. Visitors see your TruePlayer skin and controls.' ) }
			</p>
		</>
	);
}
