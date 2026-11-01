/** Pro-state helpers, read from the localized global. */
export function isPro() {
	return !! ( window.TruePlayerGlobal && window.TruePlayerGlobal.is_pro_active );
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
// The audio half. Mirrors TruePlayer\Pro::PREMIUM_AUDIO_LAYOUTS, which is the
// enforcing copy — Helper::enforce_pro_limits() resets one of these to
// `compact` at render on a free install. This list only decides what the
// editor offers; keep the two in step.
export const PRO_AUDIO_LAYOUTS = [ 'podcast', 'audiobook' ];
// The seek bar's equivalent. Mirrors TruePlayer\Pro::PREMIUM_SEEK_BARS, which
// is the enforcing copy — Helper::enforce_pro_limits() resets one of these to
// `default` at render on a free install. Keep the two in step.
export const PRO_SEEK_BARS = [ 'rapid-engage' ];
// Re-exported so existing importers keep working; the list itself lives with
// the rest of each type's metadata (see @Utils/source-types).
export { PRO_SOURCES } from '@Utils/source-types';
