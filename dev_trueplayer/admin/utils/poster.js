/**
 * Provider thumbnail derivation for the admin, mirroring the render-time
 * PHP (Helper::derive_poster) so a video with no author-set poster still
 * shows a real image in the Library, Dashboard and editor preview.
 *
 * YouTube publishes several sizes and 404s the HD ones on non-HD uploads, so
 * this returns the full chain, widest first, for the caller to walk on error.
 * `maxresdefault`/`hq720` are true 16:9 at 1280x720; `hqdefault` is 480x360
 * with letterbox bars baked in, which is why it is last.
 */

const YT_ID = /(?:v=|\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/;

export function youtubeId( url = '' ) {
	const m = String( url ).match( YT_ID );
	return m ? m[ 1 ] : '';
}

/**
 * Ordered poster candidates for a source, widest first. Empty when the author
 * set their own poster (that one wins) or the provider publishes none.
 *
 * @param {Object} source Video source config (`type`, `src`, `poster`).
 * @return {string[]} Candidate URLs, best first.
 */
export function posterCandidates( source = {} ) {
	if ( source.poster ) {
		return [ source.poster ];
	}
	if ( source.type === 'youtube' ) {
		const id = youtubeId( source.src );
		if ( id ) {
			const base = `https://i.ytimg.com/vi/${ id }/`;
			return [ 'maxresdefault', 'hq720', 'sddefault', 'hqdefault' ].map( ( n ) => `${ base }${ n }.jpg` );
		}
	}
	return [];
}

/**
 * Fill `source.poster` from the provider when the author left it empty, so the
 * editor preview paints what the frontend will (PHP does the same at render
 * time via Helper::with_derived_poster). Never mutates the edited config —
 * a derived poster must not be saved back as an author choice.
 *
 * @param {Object} config Video config.
 * @return {Object} Config with a derived poster when one was missing.
 */
export function withDerivedPoster( config = {} ) {
	const source = config.source || {};
	if ( source.poster ) {
		return config;
	}
	const [ first, ...rest ] = posterCandidates( source );
	if ( ! first ) {
		return config;
	}
	return {
		...config,
		source: { ...source, poster: first, posterFallbacks: rest, posterDerived: true },
	};
}
