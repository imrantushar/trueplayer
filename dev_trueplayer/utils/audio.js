/**
 * Is this source audio, and what do we do when nobody said?
 *
 * `config.source.mediaType` is the author's answer, written by the Source tab's
 * audio-only toggle and by the Audio tab in the create dialog. But plenty of
 * audio never passes through either: items imported from Presto Player, URLs
 * pasted into the external-URL field, and everything created before audio was a
 * first-class type. Those arrive with no `mediaType` at all and would render in
 * the video player — a black 16:9 box playing an mp3.
 *
 * So the extension list below is a *safety net*, not the mechanism: it only
 * speaks when the author hasn't. See isAudioSource() for the exact order.
 *
 * SCOPE — this net works for direct-file sources only. Managed and streaming
 * sources (Bunny Stream, Mux, HLS, and Gumlet's ABR output) resolve to an
 * extension-less `.m3u8` manifest, and an audio-only manifest is indis-
 * tinguishable from a video one by URL. Never guess from `.m3u8`. Those must be
 * marked explicitly — which is what the Audio tab is for.
 *
 * Mirrored in PHP by TruePlayer\Media (includes/media.php); the render path and
 * the SSR facade need the same answer this does. Keep the two in step.
 *
 * Lives under @Utils rather than @Admin because the player bundle needs it and
 * the player must not import from the admin app — same reason as source-types.js.
 */

/**
 * Extensions that mean "this is audio". Deliberately conservative: every entry
 * is unambiguously an audio container in the wild.
 *
 * `.ogg` is treated as audio because that is overwhelmingly what it carries
 * (Vorbis/Opus) and it matches WordPress' own handling; Ogg *video* is `.ogv`,
 * which is absent here on purpose.
 */
export const AUDIO_EXTENSIONS = [ 'mp3', 'm4a', 'wav', 'ogg', 'oga', 'flac', 'opus', 'aac', 'weba' ];

/**
 * Whether a URL's path ends in a known audio extension.
 *
 * Query strings and fragments are stripped first — a signed URL carries its
 * token after `?`, and testing the raw string would miss every private file.
 *
 * @param {string} url
 * @return {boolean}
 */
export function isAudioExtension( url ) {
	if ( ! url || typeof url !== 'string' ) {
		return false;
	}
	const path = url.split( /[?#]/ )[ 0 ];
	const dot = path.lastIndexOf( '.' );
	if ( dot === -1 || dot === path.length - 1 ) {
		return false;
	}
	return AUDIO_EXTENSIONS.includes( path.slice( dot + 1 ).toLowerCase() );
}

/**
 * The predicate. Everything that needs to know "is this audio?" calls this one
 * function, so the rule lives in exactly one place.
 *
 * Three states, in order:
 *
 *   1. mediaType === 'audio'  → yes. An explicit answer always wins.
 *   2. mediaType === 'video'  → no.  Also explicit, and it must be honoured:
 *      the Source tab writes the literal string 'video' when the audio-only
 *      toggle is switched OFF, so an author who deliberately un-ticked it on an
 *      .mp3 (a video container that happens to have an audio extension, or just
 *      a preference) has to be able to make that stick. Without this branch the
 *      safety net would be inescapable.
 *   3. mediaType absent       → fall through to the extension net.
 *
 * State 3 is precisely the legacy population: an item that never touched the
 * toggle has no key at all, so the net catches what it should and nothing else.
 *
 * @param {Object} source A `config.source` object.
 * @return {boolean}
 */
export function isAudioSource( source ) {
	if ( ! source || typeof source !== 'object' ) {
		return false;
	}
	if ( source.mediaType === 'audio' ) {
		return true;
	}
	if ( source.mediaType === 'video' ) {
		return false;
	}
	// `fileName` is the original upload name, which survives when the playback
	// URL does not describe the file — Gumlet records it, and Bunny Storage
	// records it since audio support landed.
	return isAudioExtension( source.src ) || isAudioExtension( source.fileName );
}

/**
 * A source with `mediaType` resolved to a definite value.
 *
 * Returns the original object untouched when it already says what it is, so
 * callers can use the result as a render-time value without every config in the
 * system growing a new key it did not have before.
 *
 * @param {Object} source
 * @return {Object}
 */
export function normalizeSource( source ) {
	if ( ! source || typeof source !== 'object' ) {
		return source;
	}
	if ( source.mediaType === 'audio' || source.mediaType === 'video' ) {
		return source;
	}
	return isAudioSource( source ) ? { ...source, mediaType: 'audio' } : source;
}

/**
 * The same, for a whole config.
 *
 * This is a READ-TIME normalization. It must never be written back: storing it
 * on load would mark every legacy item dirty the moment its editor opens and
 * silently rewrite content the author never touched. The editor instead *offers*
 * the change (see SourceTab), and it is stored only when the author saves.
 *
 * @param {Object} config
 * @return {Object}
 */
export function normalizeConfig( config ) {
	if ( ! config || typeof config !== 'object' || ! config.source ) {
		return config;
	}
	const source = normalizeSource( config.source );
	return source === config.source ? config : { ...config, source };
}
