/**
 * Google Analytics push (Settings → Integrations). Off unless enabled. Uses the
 * site's existing GA4 gtag / GTM dataLayer when present; if a measurement ID is
 * configured and no gtag exists, TruePlayer loads its own GA4 tag once.
 */
function ensureGtag( id ) {
	if ( window.gtag || ! id ) {
		return;
	}
	const s = document.createElement( 'script' );
	s.async = true;
	s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent( id );
	document.head.appendChild( s );
	window.dataLayer = window.dataLayer || [];
	window.gtag = function () {
		window.dataLayer.push( arguments );
	};
	window.gtag( 'js', new Date() );
	window.gtag( 'config', id );
}

export function gaEvent( name, params ) {
	const g = window.TruePlayerGlobal || {};
	if ( ! g.ga_enabled ) {
		return;
	}
	try {
		ensureGtag( g.ga_measurement_id );
		const payload = g.ga_measurement_id ? { ...params, send_to: g.ga_measurement_id } : params;
		if ( typeof window.gtag === 'function' ) {
			window.gtag( 'event', name, payload );
		} else if ( Array.isArray( window.dataLayer ) ) {
			window.dataLayer.push( { event: name, ...payload } );
		}
	} catch ( e ) {
		// ignore
	}
}
