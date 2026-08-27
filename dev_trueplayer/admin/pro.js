/** Pro-state helpers, read from the localized global. */
export function isPro() {
	return !! ( window.TruePlayerGlobal && window.TruePlayerGlobal.is_pro_active );
}

/**
 * Whether the pro plugin is present, regardless of licensing. `isPro()` is the
 * capability gate (installed AND licensed); this one answers "do they already
 * own it", which is what decides between "buy" and "activate".
 */
export function isProInstalled() {
	return !! ( window.TruePlayerGlobal && window.TruePlayerGlobal.is_pro_installed );
}

/**
 * Whether a license key is actually activated — deliberately separate from
 * isPro(). The pro gate falls back to "allowed" before a store product is
 * configured, so it cannot be used to tell an admin their license is valid.
 *
 * @return {'active'|'inactive'|'unconfigured'} License state.
 */
export function licenseStatus() {
	const s = window.TruePlayerGlobal && window.TruePlayerGlobal.license_status;
	return [ 'active', 'inactive', 'unconfigured' ].includes( s ) ? s : 'unconfigured';
}

/** Where the key is managed, or '' when this build has no license server. */
export function licensePageUrl() {
	return ( window.TruePlayerGlobal && window.TruePlayerGlobal.license_url ) || '';
}

export function proFlag( name ) {
	const f = ( window.TruePlayerGlobal && window.TruePlayerGlobal.feature_flags ) || {};
	return !! f[ name ];
}

export const PRO_SKINS = [ 'floating', 'ambient' ];
export const PRO_SOURCES = [ 'bunny', 'mux', 'hls' ];
