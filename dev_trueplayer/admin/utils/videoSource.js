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
 */
export function sourceKey( source = {} ) {
	switch ( source.type ) {
		case 'bunny':
			return `bunny:${ source.pullZone || '' }:${ source.videoId || '' }`;
		case 'mux':
			return `mux:${ source.playbackId || '' }:${ source.src || '' }`;
		default:
			return `${ source.type || '' }:${ source.src || '' }`;
	}
}
