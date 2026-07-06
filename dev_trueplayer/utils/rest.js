/**
 * Thin REST helper. Uses the localized TruePlayerGlobal for base URL + nonce so
 * logged-in requests authenticate (cookie + X-WP-Nonce) and guests still work.
 */
const G = () => window.TruePlayerGlobal || {};

function base() {
	const g = G();
	// rest_url already ends with a slash; namespace is like "trueplayer/v1/".
	return ( g.rest_url || '/wp-json/' ) + ( g.namespace || 'trueplayer/v1/' );
}

async function request( path, { method = 'GET', body } = {} ) {
	const g = G();
	const res = await fetch( base() + path, {
		method,
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': g.nonce || '',
		},
		credentials: 'same-origin',
		body: body ? JSON.stringify( body ) : undefined,
	} );
	if ( ! res.ok ) {
		let detail = {};
		try {
			detail = await res.json();
		} catch ( e ) {}
		const err = new Error( detail.message || `Request failed (${ res.status })` );
		err.status = res.status;
		err.detail = detail;
		throw err;
	}
	if ( res.status === 204 ) {
		return null;
	}
	return res.json();
}

export const rest = {
	get: ( path ) => request( path ),
	post: ( path, body ) => request( path, { method: 'POST', body } ),
	put: ( path, body ) => request( path, { method: 'PUT', body } ),
	del: ( path ) => request( path, { method: 'DELETE' } ),
	base,
};

/**
 * Best-effort beacon (used on unload/visibility change). Falls back to a
 * keepalive fetch when sendBeacon can't attach our nonce header.
 */
export function beacon( path, body ) {
	const g = G();
	try {
		return fetch( base() + path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': g.nonce || '' },
			credentials: 'same-origin',
			keepalive: true,
			body: JSON.stringify( body ),
		} );
	} catch ( e ) {
		return Promise.resolve();
	}
}
