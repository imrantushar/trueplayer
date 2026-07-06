/** Pro-state helpers, read from the localized global. */
export function isPro() {
	return !! ( window.TruePlayerGlobal && window.TruePlayerGlobal.is_pro_active );
}

export function proFlag( name ) {
	const f = ( window.TruePlayerGlobal && window.TruePlayerGlobal.feature_flags ) || {};
	return !! f[ name ];
}

export const PRO_SKINS = [ 'floating', 'ambient' ];
export const PRO_SOURCES = [ 'bunny', 'mux', 'hls' ];
