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

/**
 * Full URL for an endpoint path.
 *
 * Paths carry their own query string (`viewers?video=12`), and on a site
 * running plain permalinks the REST root already has one of its own —
 * `index.php?rest_route=/`. Concatenating the two would leave a second `?`,
 * which WordPress reads as part of the route name and answers with a 404, so
 * the path's query is joined with whichever separator the root needs.
 *
 * @param {string} path Endpoint path, relative to the plugin namespace.
 * @return {string} Absolute URL.
 */
function url( path ) {
	const root = base();
	const query = path.indexOf( '?' );
	if ( query === -1 || ! root.includes( '?' ) ) {
		return root + path;
	}
	return root + path.slice( 0, query ) + '&' + path.slice( query + 1 );
}

async function request( path, { method = 'GET', body } = {} ) {
	const g = G();
	const res = await fetch( url( path ), {
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

/**
 * POST raw bytes rather than JSON — for binary we build in the browser, such
 * as a video frame captured onto a canvas. Base64 in a JSON body would inflate
 * an image by a third for no gain, so the blob goes up as-is and its type
 * rides in the Content-Type header, which is what the endpoint reads.
 *
 * @param {string} path Endpoint path, relative to the plugin namespace.
 * @param {Blob}   blob The bytes to send.
 * @return {Promise<Object>} The decoded JSON response.
 */
async function upload( path, blob ) {
	const g = G();
	const res = await fetch( url( path ), {
		method: 'POST',
		headers: {
			'Content-Type': blob.type || 'application/octet-stream',
			'X-WP-Nonce': g.nonce || '',
		},
		credentials: 'same-origin',
		body: blob,
	} );
	const json = await res.json().catch( () => null );
	if ( ! res.ok ) {
		const err = new Error( ( json && json.message ) || `Upload failed (${ res.status })` );
		err.status = res.status;
		throw err;
	}
	return json;
}

export const rest = {
	get: ( path ) => request( path ),
	post: ( path, body ) => request( path, { method: 'POST', body } ),
	put: ( path, body ) => request( path, { method: 'PUT', body } ),
	del: ( path ) => request( path, { method: 'DELETE' } ),
	upload,
	base,
	url,
};

/**
 * Best-effort beacon (used on unload/visibility change). Falls back to a
 * keepalive fetch when sendBeacon can't attach our nonce header.
 */
export function beacon( path, body ) {
	const g = G();
	try {
		return fetch( url( path ), {
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
