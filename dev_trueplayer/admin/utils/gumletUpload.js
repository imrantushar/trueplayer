import { rest } from '@Utils/rest';
import { __ } from '@Utils/translation';

/**
 * Send a file to Gumlet from the editor.
 *
 * The bytes never touch this server. WordPress mints a one-time upload URL
 * scoped to a single object and the browser PUTs straight to Gumlet, which is
 * what lets a multi-gigabyte lesson upload without running into
 * `upload_max_filesize`, `post_max_size`, PHP's memory limit or a request
 * timeout — the four things the Bunny upload has to chunk around.
 *
 * The PUT is an XMLHttpRequest rather than fetch for two reasons: fetch reports
 * no upload progress (there is no request-side equivalent of a readable body
 * stream in any shipping browser), and it cannot be aborted mid-flight without
 * an AbortController plumbed through every layer. XHR gives both directly.
 *
 * Deliberately NOT `rest.upload()` — that helper attaches this site's REST
 * nonce and `credentials: 'same-origin'`, neither of which may be sent to a
 * third-party host.
 */

/** Extensions the field offers. Mirrors GumletVideo::ALLOWED_EXTENSIONS. */
export const ACCEPTED =
	'.mp4,.m4v,.mov,.webm,.mkv,.avi,.wmv,.flv,.mpg,.mpeg,.m2ts,.mts,.mxf,.ogv,.3gp,.mp3,.m4a,.oga,.ogg,.wav,.flac';

/** How long to keep asking Gumlet whether it has finished transcoding. */
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

const wait = ( ms ) => new Promise( ( resolve ) => setTimeout( resolve, ms ) );

/**
 * Poll intervals, in ms, by how long we have been waiting. A freshly finished
 * upload is often ready within seconds, so the first checks are quick; a long
 * transcode does not need to be asked about every two seconds for a quarter of
 * an hour.
 */
function pollDelay( elapsedMs ) {
	if ( elapsedMs < 30000 ) {
		return 2000;
	}
	return elapsedMs < 120000 ? 5000 : 15000;
}

/**
 * PUT the file to Gumlet, reporting progress as it goes.
 *
 * @param {string} url   The presigned upload URL.
 * @param {File}   file  The file to send.
 * @param {Object} token Shared `{ cancelled }` flag; flipping it aborts.
 * @param {Function} onProgress Called with 0–99.
 */
function putToGumlet( url, file, token, onProgress ) {
	return new Promise( ( resolve, reject ) => {
		const xhr = new XMLHttpRequest();
		xhr.open( 'PUT', url, true );
		// Gumlet's presigned URL is signed for the object, not for a content
		// type, so send what the browser detected and let it fall back to a
		// generic stream when it detected nothing.
		xhr.setRequestHeader( 'Content-Type', file.type || 'application/octet-stream' );

		xhr.upload.onprogress = ( e ) => {
			if ( e.lengthComputable ) {
				// Held at 99 until the asset is confirmed: the bytes arriving is
				// not the same as the video being playable, and a bar that sits
				// at 100% through a two-minute transcode reads as a hang.
				onProgress( Math.min( 99, Math.round( ( e.loaded / e.total ) * 100 ) ) );
			}
		};

		xhr.onload = () =>
			xhr.status >= 200 && xhr.status < 300
				? resolve()
				: reject( new Error( __( 'Gumlet rejected the upload.' ) ) );
		xhr.onerror = () =>
			// A cross-origin PUT that never reaches the server looks exactly like
			// this, so name the likely cause rather than saying "network error".
			reject( new Error( __( 'Could not reach Gumlet. Check your connection and that uploads are allowed from this site.' ) ) );
		xhr.onabort = () => reject( new Error( __( 'Upload cancelled.' ) ) );

		// The only cancellation channel — the caller flips token.cancelled and
		// we abort the transfer in flight rather than waiting for it to finish.
		token.xhr = xhr;
		if ( token.cancelled ) {
			xhr.abort();
			return;
		}
		xhr.send( file );
	} );
}

/**
 * Upload one file and wait for Gumlet to make it playable.
 *
 * Resolves even if transcoding has not finished. The asset id is the durable
 * identity and the server resolves a playback URL at render time, so holding
 * the editor hostage to a queue nobody can see would be the worse trade —
 * `ready` says which happened so the field can word it honestly.
 *
 * @param {File}     file
 * @param {Object}   options
 * @param {Function} options.onProgress Percentage, 0–100.
 * @param {Function} options.onStage    'uploading' | 'processing'.
 * @param {Object}   options.token      Shared `{ cancelled }` flag.
 * @return {Promise<Object>} The source fields to store.
 */
export async function uploadToGumlet( file, { onProgress = () => {}, onStage = () => {}, token = {} } = {} ) {
	const started = await rest.post( 'gumlet/upload/start', { name: file.name, size: file.size } );
	const { session } = started;

	const giveUp = async () => {
		try {
			await rest.post( 'gumlet/upload/abort', { session } );
		} catch ( e ) {
			// The session expires on its own; a failed abort is not worth
			// surfacing on top of whatever already went wrong.
		}
	};

	onStage( 'uploading' );
	try {
		await putToGumlet( started.uploadUrl, file, token, onProgress );
	} catch ( e ) {
		await giveUp();
		throw e;
	}

	if ( token.cancelled ) {
		await giveUp();
		throw new Error( __( 'Upload cancelled.' ) );
	}

	// The bytes are in. Everything from here is Gumlet transcoding, which the
	// author may walk away from.
	onStage( 'processing' );
	onProgress( 100 );

	const deadline = Date.now() + POLL_TIMEOUT_MS;
	let state = null;
	while ( Date.now() < deadline ) {
		if ( token.cancelled ) {
			await giveUp();
			throw new Error( __( 'Upload cancelled.' ) );
		}
		try {
			state = await rest.get( `gumlet/upload/status?session=${ encodeURIComponent( session ) }` );
		} catch ( e ) {
			// A dropped status check is not a failed upload — the file is
			// already at Gumlet. Keep asking until the deadline.
			state = null;
		}
		if ( state && state.error ) {
			await giveUp();
			throw new Error( state.error );
		}
		if ( state && state.ready ) {
			break;
		}
		await wait( pollDelay( POLL_TIMEOUT_MS - ( deadline - Date.now() ) ) );
	}

	// finish() returns the stored source whether or not it is ready, so a
	// timeout here still yields a usable video rather than a lost upload.
	return rest.post( 'gumlet/upload/finish', { session } );
}
