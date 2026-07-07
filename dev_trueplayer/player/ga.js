/**
 * Best-effort analytics push to the site's Google Analytics (GA4 gtag or GTM
 * dataLayer) if present. No-ops when neither exists — never our own network.
 */
export function gaEvent( name, params ) {
	try {
		if ( typeof window.gtag === 'function' ) {
			window.gtag( 'event', name, params );
		} else if ( Array.isArray( window.dataLayer ) ) {
			window.dataLayer.push( { event: name, ...params } );
		}
	} catch ( e ) {
		// ignore
	}
}
