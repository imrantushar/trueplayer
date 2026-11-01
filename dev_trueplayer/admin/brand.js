/**
 * The product's name and mark as this install shows them.
 *
 * A `trueplayer/brand_name` / `trueplayer/brand_logo` filter can replace both; PHP resolves them once
 * (Helper::brand_name / Helper::brand_logo) so the WordPress menu, the page
 * titles and this React admin can't drift apart.
 *
 * @return {{name: string, logo: string}} Brand name and logo URL ('' = default mark).
 */
export function brand() {
	const b = ( window.TruePlayerGlobal && window.TruePlayerGlobal.brand ) || {};
	return {
		name: b.name || 'TruePlayer',
		logo: b.logo || '',
	};
}
