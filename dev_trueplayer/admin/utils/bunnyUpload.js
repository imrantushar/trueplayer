import { rest } from '@Utils/rest';
import { __ } from '@Utils/translation';

/**
 * Send a file to the site's Bunny.net Storage zone, through the server.
 *
 * The file is sliced and posted a chunk at a time rather than in one request,
 * because a video routinely exceeds `upload_max_filesize` / `post_max_size` and
 * an author can do nothing about either. Chunks are small enough that every
 * host accepts them, and acknowledging each one is what gives the progress bar
 * something real to report — `fetch` exposes no upload progress of its own.
 *
 * Chunks go up strictly in order. The server checks each offset against what it
 * already holds, so a retry can only ever repeat the chunk it lost, never land
 * in the middle of the file.
 */

/** A chunk is retried this many times before the upload is called off. */
const MAX_RETRIES = 3;

/** Extensions the server will accept, mirrored for the file picker's filter. */
export const ACCEPTED = '.mp4,.m4v,.mov,.webm,.ogv,.mp3,.m4a,.oga,.ogg,.wav,.flac';

const wait = ( ms ) => new Promise( ( resolve ) => setTimeout( resolve, ms ) );

/**
 * @param {File}     file                The file to send.
 * @param {Object}   options             Upload options.
 * @param {Function} options.onProgress  Called with 0–100 as chunks land.
 * @param {Object}   options.token       `{ cancelled: boolean }` — flip it to stop.
 * @return {Promise<{url: string, name: string, size: number, reachable: boolean, warning: string}>}
 *   The stored file. `reachable` is the server's check that the pull zone
 *   actually serves it back — false comes with a `warning` saying why.
 */
export async function uploadToBunny( file, { onProgress = () => {}, token = { cancelled: false } } = {} ) {
	const opened = await rest.post( 'bunny/upload/start', { name: file.name, size: file.size } );
	const session = opened.session;
	const chunkSize = opened.chunkSize || 4 * 1024 * 1024;

	// An upload abandoned mid-flight leaves a partial file on the server. It is
	// swept eventually, but telling the server now is what frees the disk (and
	// the session) immediately.
	const giveUp = async () => {
		try {
			await rest.post( 'bunny/upload/abort', { session } );
		} catch ( e ) {
			// Nothing useful to do — the sweep will get it.
		}
	};

	let offset = 0;
	try {
		while ( offset < file.size ) {
			if ( token.cancelled ) {
				await giveUp();
				throw new Error( __( 'Upload cancelled.' ) );
			}

			const slice = file.slice( offset, Math.min( offset + chunkSize, file.size ) );
			let sent = null;
			for ( let attempt = 0; attempt <= MAX_RETRIES; attempt++ ) {
				try {
					sent = await rest.upload( `bunny/upload/chunk?session=${ session }&offset=${ offset }`, slice );
					break;
				} catch ( e ) {
					// A 409 means the server and the browser disagree about how
					// much has landed — a chunk that timed out but was written
					// anyway, say. Its `expected` is authoritative, so resume
					// from there instead of retrying a chunk already stored.
					if ( 409 === e.status && e.detail && typeof e.detail.data?.expected === 'number' ) {
						offset = e.detail.data.expected;
						sent = { received: offset };
						break;
					}
					// A rejection the server means (bad type, too large, expired)
					// will not come good on a retry.
					if ( e.status && e.status < 500 && 409 !== e.status ) {
						throw e;
					}
					if ( attempt === MAX_RETRIES ) {
						throw e;
					}
					await wait( 500 * ( attempt + 1 ) );
				}
			}

			offset = typeof sent?.received === 'number' ? sent.received : offset + slice.size;
			onProgress( Math.min( 99, Math.round( ( offset / file.size ) * 100 ) ) );
		}
	} catch ( e ) {
		if ( ! token.cancelled ) {
			await giveUp();
		}
		throw e;
	}

	// The send to Bunny happens here, and on a large file it is not instant —
	// the bar sits at 99% until the zone confirms, which is honest: the file is
	// not usable until this returns.
	const stored = await rest.post( 'bunny/upload/finish', { session } );
	onProgress( 100 );
	return stored;
}
