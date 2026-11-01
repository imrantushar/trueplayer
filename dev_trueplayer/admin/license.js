import { __sprintf } from '@Utils/translation';

/**
 * StoreEngine licensing SDK bridge for the admin.
 *
 * The SDK's payload is localized onto `TruePlayerGlobal.SeSdk` by the *pro*
 * plugin (TruePlayerPro\StoreLicense). Free boots the same SDK for opt-in
 * insights only — no license, no REST routes — and deliberately does not
 * publish a payload, so the absence of `rest_url` is what tells this screen
 * there is nothing to activate.
 *
 * Read through `getSdk()` at render time rather than capturing it at module
 * load: the Settings tab list is built once, long before any of this matters.
 */

/** Raw SDK payload, or an empty object when the SDK never booted. */
export function getSdk() {
	return ( window.TruePlayerGlobal && window.TruePlayerGlobal.SeSdk ) || {};
}

/**
 * Whether the `storeengine-sdk/v1` license routes are actually reachable —
 * i.e. TruePlayer Pro is active AND a store product is configured (without one
 * the SDK stays dormant and never registers its REST API). Everything that can
 * activate, deactivate or re-check a key has to stay hidden without this.
 */
export function hasLicenseApi() {
	const sdk = getSdk();
	return !! sdk.rest_url && ! sdk.is_free;
}

/** Shape the screen renders before the first status call returns. */
export const DEFAULT_LICENSE = {
	license: '',
	status: 'inactive',
	remaining: 0,
	activations: 0,
	limit: 1,
	unlimited: 0,
	expires: 0,
	updated_at: '',
};

/**
 * Call an SDK route. `sdk.rest_url` is absolute and already namespaced to this
 * product, so this deliberately bypasses TruePlayer's own REST helper (which
 * would prefix `trueplayer/v1/`). The nonce is the same `wp_rest` one.
 */
async function call( endpoint, { method = 'GET', body, params } = {} ) {
	const sdk = getSdk();
	let url = sdk.rest_url + endpoint;
	if ( params ) {
		url += '?' + new URLSearchParams( params ).toString();
	}
	const res = await fetch( url, {
		method,
		headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': sdk.nonce || '' },
		credentials: 'same-origin',
		body: body ? JSON.stringify( body ) : undefined,
	} );
	let data = null;
	try {
		data = await res.json();
	} catch ( e ) {
		data = null;
	}
	if ( ! res.ok ) {
		// The store's own reason ("expired", "activation limit reached") is the
		// only thing that makes a failure actionable — a bare status code sends
		// people to support. WP_Error serialises as { code, message, data }, and
		// the code is what lets the caller branch: `license-activation-limit-reached`
		// arrives as a 409 whose data carries the customer's other active sites.
		const err = new Error( ( data && data.message ) || __sprintf( 'Request failed (%d)', res.status ) );
		err.status = res.status;
		err.code = ( data && data.code ) || '';
		err.data = ( data && data.data ) || {};
		throw err;
	}
	return data;
}

/** Machine-readable code the store returns when every seat is taken. */
export const LIMIT_REACHED = 'license-activation-limit-reached';

export const licenseApi = {
	status: ( force = true ) => call( 'license/status', { params: { force: force ? 1 : 0 } } ),
	/**
	 * @param {string}   key    The license key.
	 * @param {number[]} frees  Activation ids to release first, when the customer
	 *                          has chosen which of their sites to give up.
	 */
	activate: ( key, frees = [] ) => call( 'license/activate', {
		method: 'POST',
		body: frees.length ? { license: key, deactivate_activations: frees } : { license: key },
	} ),
	deactivate: () => call( 'license/deactivate', { method: 'POST', body: {} } ),
};

/**
 * Tag an outbound store link so the license server can attribute the click and
 * pre-fill checkout with this install's environment. Mirrors the parameters the
 * SDK's own PHP form sends.
 */
export function buildStoreUrl( base ) {
	const sdk = getSdk();
	try {
		const url = new URL( base );
		url.searchParams.set( 'utm_source', 'storeengine-sdk' );
		url.searchParams.set( 'utm_medium', 'license-form' );
		url.searchParams.set( 'utm_campaign', 'license-activation-upsell' );
		url.searchParams.set( 'utm_content', 'purchase-link' );
		url.searchParams.set( 'utm_term', 'trueplayer-pro' );
		url.searchParams.set( 'locale', sdk.locale || '' );
		url.searchParams.set( 'wordpress', sdk.wordpress || '' );
		url.searchParams.set( 'sdk_version', sdk.version || '' );
		url.searchParams.set( 'instance', sdk.device_id || '' );
		return url.toString();
	} catch ( e ) {
		return base;
	}
}

export const STORE_DASHBOARD_URL = 'https://store.kodezen.com/dashboard/license-keys/';
export const PURCHASE_URL = 'https://store.kodezen.com/product/trueplayer-pro/';

/**
 * A UTC timestamp from the SDK, rendered in the reader's own zone.
 *
 * The SDK formats these as `Y-m-d H:i:s` with no zone marker, so the `Z` has to
 * be added or the browser reads them as local and shifts every value.
 *
 * `mode: 'date'` drops the clock entirely — an expiry is a day, and rendering
 * its UTC midnight in local time turns "14 March" into "13 March, 6:00 PM" for
 * anyone west of Greenwich.
 */
export function formatUtc( value, mode = 'datetime' ) {
	if ( ! value ) {
		return '';
	}
	const iso = String( value ).replace( ' ', 'T' );
	const date = new Date( /[Z+]/.test( iso ) ? iso : iso + 'Z' );
	if ( isNaN( date.getTime() ) ) {
		return String( value );
	}
	const dateParts = { year: 'numeric', month: 'short', day: '2-digit' };
	if ( 'date' === mode ) {
		return date.toLocaleDateString( undefined, { ...dateParts, timeZone: 'UTC' } );
	}
	return date.toLocaleString( undefined, { ...dateParts, hour: '2-digit', minute: '2-digit' } );
}
