/**
 * Grab a still frame out of a video file, in the browser, so a self-hosted
 * upload gets a poster of its own.
 *
 * The work happens client-side because no WordPress host is guaranteed to
 * have ffmpeg — PHP can't decode a video, but the browser already can, so it
 * decodes one frame onto a canvas and hands the pixels back as a JPEG for the
 * media library (see api.generatePoster).
 *
 * Only file-backed sources can be read this way: provider embeds (YouTube,
 * Vimeo) hand back an iframe rather than pixels, and those already derive a
 * poster from the provider's own thumbnail — see utils/poster.js.
 */

// Types whose `src` is a media file a <video> element can decode. Adaptive
// manifests are excluded below: an .m3u8 needs a streaming library, not a src.
const FILE_TYPES = [ 'self', 'url', 'bunnyStorage' ];

// Frames are read at these fractions of the runtime, in order. Videos commonly
// open on black or a fade-in, so a flat first frame falls through to the next
// candidate rather than becoming the poster.
const SEEK_FRACTIONS = [ 0.1, 0.25, 0.5 ];

// The first candidate is capped so a long video still samples near the start,
// where the subject usually is, instead of ten minutes in.
const FIRST_SEEK_CAP = 3;

const LOAD_TIMEOUT = 20000;

/** Whether a frame can be read from this source at all. */
export function canCaptureFrame( source = {} ) {
	const src = String( source.src || '' );
	if ( ! src || ! FILE_TYPES.includes( source.type ) ) {
		return false;
	}
	return ! /\.m3u8($|\?)/i.test( src );
}

/**
 * Whether capturing is safe to start on its own, unprompted.
 *
 * Only a media-library pick qualifies. The other file types are typed into a
 * text field, so their `src` passes through every half-finished prefix on the
 * way to a real URL, and each of those would kick off a capture that fails.
 * Those, and files on a host that hasn't opted into CORS (media offloaded to a
 * CDN, say — a cross-origin frame taints the canvas), are left to the explicit
 * button, where an author is expecting the attempt and can read the error.
 */
export function canAutoCaptureFrame( source = {} ) {
	return 'self' === source.type && canCaptureFrame( source ) && ! isCrossOrigin( source.src );
}

function isCrossOrigin( url ) {
	try {
		return new URL( String( url ), window.location.href ).origin !== window.location.origin;
	} catch ( e ) {
		return false;
	}
}

/**
 * A canvas holding pixels from another origin is "tainted": reading it back
 * throws instead of returning the frame. That is the one failure worth naming
 * precisely, since the fix (upload the file, or set a poster by hand) is not
 * something the author would guess from a generic error.
 */
function readError( err ) {
	if ( err && 'SecurityError' === err.name ) {
		return new Error(
			'That video is served from another domain that doesn’t allow reading its frames. Upload the file to your media library, or choose a poster image yourself.'
		);
	}
	return err instanceof Error ? err : new Error( 'Could not read a frame from this video.' );
}

/** A <video> element loaded far enough to seek and draw, or a rejection. */
function loadVideo( url ) {
	return new Promise( ( resolve, reject ) => {
		const video = document.createElement( 'video' );
		video.muted = true;
		video.playsInline = true;
		video.preload = 'auto';
		// Only ask for CORS when the file really is cross-origin: requesting it
		// for a same-origin upload makes the browser demand headers the site
		// has no reason to send, and the load fails before a frame decodes.
		if ( isCrossOrigin( url ) ) {
			video.crossOrigin = 'anonymous';
		}

		const done = ( fn, arg ) => {
			clearTimeout( timer );
			video.removeEventListener( 'loadeddata', ok );
			video.removeEventListener( 'error', fail );
			fn( arg );
		};
		const ok = () => done( resolve, video );
		const fail = () => done( reject, new Error( 'This video file could not be loaded.' ) );
		const timer = setTimeout( () => done( reject, new Error( 'The video took too long to load.' ) ), LOAD_TIMEOUT );

		video.addEventListener( 'loadeddata', ok );
		video.addEventListener( 'error', fail );
		video.src = url;
		video.load();
	} );
}

/** Move to `time` and resolve once a frame for it is actually decoded. */
function seek( video, time ) {
	return new Promise( ( resolve, reject ) => {
		// Already there — no `seeked` event is coming, so don't wait for one.
		if ( Math.abs( video.currentTime - time ) < 0.01 ) {
			resolve();
			return;
		}
		const done = ( fn, arg ) => {
			clearTimeout( timer );
			video.removeEventListener( 'seeked', ok );
			video.removeEventListener( 'error', fail );
			fn( arg );
		};
		const ok = () => done( resolve );
		const fail = () => done( reject, new Error( 'Could not seek this video.' ) );
		const timer = setTimeout( () => done( reject, new Error( 'The video took too long to seek.' ) ), LOAD_TIMEOUT );

		video.addEventListener( 'seeked', ok );
		video.addEventListener( 'error', fail );
		video.currentTime = time;
	} );
}

/** The current frame, drawn at up to `maxWidth` and keeping its aspect ratio. */
function drawFrame( video, maxWidth ) {
	const w = video.videoWidth;
	const h = video.videoHeight;
	if ( ! w || ! h ) {
		throw new Error( 'This file has no picture to capture — it may be audio only.' );
	}
	const scale = Math.min( 1, maxWidth / w );
	const canvas = document.createElement( 'canvas' );
	canvas.width = Math.round( w * scale );
	canvas.height = Math.round( h * scale );
	canvas.getContext( '2d' ).drawImage( video, 0, 0, canvas.width, canvas.height );
	return canvas;
}

/**
 * Whether a frame is essentially one flat colour — a black lead-in, a white
 * card, a solid fade. Measured on a tiny downscale so it costs nothing: the
 * spread of pixel luminance, where near-zero means "nothing is happening yet".
 */
function isFlat( canvas ) {
	const probe = document.createElement( 'canvas' );
	probe.width = 32;
	probe.height = 18;
	const ctx = probe.getContext( '2d' );
	ctx.drawImage( canvas, 0, 0, probe.width, probe.height );
	const { data } = ctx.getImageData( 0, 0, probe.width, probe.height );
	let sum = 0;
	let sumSq = 0;
	const n = data.length / 4;
	for ( let i = 0; i < data.length; i += 4 ) {
		const lum = 0.2126 * data[ i ] + 0.7152 * data[ i + 1 ] + 0.0722 * data[ i + 2 ];
		sum += lum;
		sumSq += lum * lum;
	}
	const mean = sum / n;
	return Math.sqrt( Math.max( sumSq / n - mean * mean, 0 ) ) < 6;
}

function toJpeg( canvas, quality ) {
	return new Promise( ( resolve, reject ) => {
		canvas.toBlob(
			( blob ) => ( blob ? resolve( blob ) : reject( new Error( 'Could not encode the captured frame.' ) ) ),
			'image/jpeg',
			quality
		);
	} );
}

/**
 * Capture a representative frame from a video file as a JPEG blob.
 *
 * @param {string} url                Video file URL.
 * @param {Object} [options]          Capture options.
 * @param {number} [options.maxWidth] Longest edge of the output, in pixels.
 * @param {number} [options.quality]  JPEG quality, 0–1.
 * @return {Promise<Blob>} The captured frame.
 */
export async function captureVideoFrame( url, { maxWidth = 1280, quality = 0.82 } = {} ) {
	const video = await loadVideo( url );
	try {
		const duration = Number.isFinite( video.duration ) && video.duration > 0 ? video.duration : 0;
		const last = Math.max( duration - 0.05, 0 );
		const times = SEEK_FRACTIONS
			.map( ( f, i ) => Math.min( i ? duration * f : Math.min( duration * f, FIRST_SEEK_CAP ), last ) )
			.filter( ( t, i, all ) => all.indexOf( t ) === i );

		let frame = null;
		for ( const time of times ) {
			await seek( video, time );
			const candidate = drawFrame( video, maxWidth );
			// Keep the first frame regardless, so a video that is flat all the
			// way through still produces a poster rather than an error.
			frame = frame || candidate;
			if ( ! isFlat( candidate ) ) {
				frame = candidate;
				break;
			}
		}
		return await toJpeg( frame, quality );
	} catch ( err ) {
		throw readError( err );
	} finally {
		video.removeAttribute( 'src' );
		video.load();
	}
}
