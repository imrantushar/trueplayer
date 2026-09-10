import { isAudioSource } from '@Utils/audio';

/**
 * Preset merging for the editor preview, mirroring the render-time PHP
 * (Helper::apply_preset) so choosing a preset changes the preview the same way
 * it will change the published page.
 *
 * The stored config keeps only `presetId` — the merge happens at render, so
 * the editor's own fields stay showing the author's raw overrides rather than
 * the resolved result. That is deliberate, but it left the preview rendering
 * the raw config too, where a preset had no visible effect at all.
 */

/** Whether a value is a plain object (a map), not an array or null. */
function isMap( v ) {
	return !! v && typeof v === 'object' && ! Array.isArray( v );
}

/**
 * Recursive merge where `over` wins. Arrays are replaced wholesale rather than
 * merged item-by-item — the same rule as PHP's `deep_merge`, which treats list
 * arrays as single values. Chapters or a speed list from a preset are replaced
 * by the video's own, never interleaved with them.
 *
 * @param {Object} base Lower-priority values.
 * @param {Object} over Higher-priority values.
 * @return {Object} Merged copy.
 */
export function deepMerge( base, over ) {
	const out = { ...base };
	Object.keys( over || {} ).forEach( ( k ) => {
		const v = over[ k ];
		out[ k ] = isMap( v ) && isMap( out[ k ] ) ? deepMerge( out[ k ], v ) : v;
	} );
	return out;
}

/**
 * Merge the referenced preset's customize + branding UNDER a video's own
 * settings, so per-video values keep winning.
 *
 * @param {Object} config  The video config being edited.
 * @param {Array}  presets Presets as the REST list returns them ({ id, config }).
 * @return {Object} Config with the preset applied; the same object when there
 *                  is no preset to apply.
 */
export function applyPreset( config = {}, presets = [], settings = null ) {
	const isAudio = isAudioSource( config.source || {} );
	let id = parseInt( config.presetId, 10 );

	// Fall back to the site-wide default, mirroring Helper::apply_preset. This
	// used to be missing here, so the editor preview silently disagreed with the
	// real page for every video relying on the site default — the preview showed
	// no preset while visitors got one.
	//
	// Audio reads its own setting and does NOT fall back to the video one: a
	// video preset's skin and aspect ratio mean nothing for a bar.
	if ( ! id ) {
		const general = ( settings && settings.general ) ||
			( typeof window !== 'undefined' && window.TruePlayerGlobal && window.TruePlayerGlobal.settings && window.TruePlayerGlobal.settings.general ) ||
			{};
		id = parseInt( isAudio ? general.defaultAudioPreset : general.defaultPreset, 10 );
	}
	if ( ! id ) {
		return config;
	}
	const preset = presets.find( ( p ) => parseInt( p.id, 10 ) === id );
	const from = preset && preset.config ? preset.config : null;
	if ( ! from ) {
		return config;
	}
	// An explicitly chosen preset is always honoured; only a mismatched
	// *default* is refused, since nobody picked it for this item.
	if ( ! config.presetId && ( 'audio' === preset.type ) !== isAudio ) {
		return config;
	}

	const out = { ...config };
	if ( isMap( from.customize ) ) {
		out.customize = deepMerge( from.customize, isMap( config.customize ) ? config.customize : {} );
	}
	if ( isMap( from.branding ) ) {
		// Shallow, like the PHP: branding is a flat record, and a preset's logo
		// shouldn't be half-merged into the video's.
		out.branding = { ...from.branding, ...( isMap( config.branding ) ? config.branding : {} ) };
	}
	return out;
}
