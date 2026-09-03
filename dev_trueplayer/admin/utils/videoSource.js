/**
 * A video isn't playable without a source — what "set" means differs per type
 * (bunny needs pullZone+videoId, mux needs a playbackId or a full src url).
 */
export function hasVideoSource( source = {} ) {
	switch ( source.type ) {
		case 'bunny':
			return !! ( source.pullZone && source.videoId );
		case 'mux':
			return !! ( source.playbackId || source.src );
		default:
			return !! source.src;
	}
}

/**
 * Stable identity string for whichever fields actually determine what plays —
 * `src` alone misses bunny (pullZone+videoId) and can miss mux (playbackId).
 * Used to force a remount (via React `key`) when the source materially
 * changes, since the player's own provider-creation effect only re-runs on
 * `videoId`, not on source edits (see player/Player.jsx).
 *
 * `mediaType` counts as materially changing it: the HTML5 provider builds an
 * <audio> element or a <video> one from that field alone (player/providers/
 * html5.js), and it is decided when the element is created. Leaving it out
 * meant switching a video to audio-only restyled the stage into an audio bar
 * while the <video> already on it kept playing its picture straight through.
 */
export function sourceKey( source = {} ) {
	const media = source.mediaType === 'audio' ? 'audio' : 'video';
	switch ( source.type ) {
		case 'bunny':
			return `bunny:${ media }:${ source.pullZone || '' }:${ source.videoId || '' }`;
		case 'mux':
			return `mux:${ media }:${ source.playbackId || '' }:${ source.src || '' }`;
		default:
			return `${ source.type || '' }:${ media }:${ source.src || '' }`;
	}
}
