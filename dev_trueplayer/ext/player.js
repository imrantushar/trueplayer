/**
 * Player extension seam — inert defaults. See ./README.md.
 */

/** Extra source types: { [type]: async ( container, source, opts, createHtml5Provider ) => provider }. */
export const extProviders = {};

/** Extra layer types: { [type]: Component( { layer, preview } ) }. */
export const layerTypes = {};

const NO_RULES = {
	passes: () => true,
	seen: () => {},
	submitted: () => {},
};

/** Per-layer display rules. Every layer passes by default. */
export function useLayerRules() {
	return NO_RULES;
}

/** Optional scrubber fill mapping; null keeps the ordinary bar. */
export function useScrubMap() {
	return null;
}

/** Optional wrapper around the player stage. */
export function wrapStage( node ) {
	return node;
}

const NOOP = () => {};

const NONE = {
	load: () => Promise.resolve( { canPlay: true, resumeAt: 0 } ),
	attach: NOOP,
	onTime: NOOP,
	onCue: NOOP,
	onPause: NOOP,
	onSeek: NOOP,
	onLoop: NOOP,
	onEnded: () => Promise.resolve( false ),
	dispose: NOOP,
	blocking: false,
	completed: false,
	seekLimit: null,
	stage: null,
	overlay: null,
	below: null,
};

/** Per-player extension. The core player needs none of it. */
export function usePlayerExt() {
	return NONE;
}
