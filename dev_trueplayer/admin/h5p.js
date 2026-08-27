/**
 * Interactive-content (H5P engine) availability, as the admin sees it.
 *
 * Two separate questions, and the Library needs both:
 *   installed — the runtime ships in this build, so the addon *can* be enabled
 *   enabled   — the site has switched the addon on, so content can be built
 *
 * Installed-but-not-enabled is the state the activation teaser exists for:
 * hiding the section entirely would leave no way to discover the feature.
 */
export function h5pInstalled() {
	return !! ( window.TruePlayerGlobal && window.TruePlayerGlobal.h5p_installed );
}

export function h5pEnabled() {
	return !! ( window.TruePlayerGlobal && window.TruePlayerGlobal.h5p_available );
}

/** Addon slug in the `trueplayer_addons` registry (see H5P\Module::ADDON_SLUG). */
export const INTERACTIVE_ADDON = 'interactive';
