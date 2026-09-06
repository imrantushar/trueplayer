import { Icon } from './icons';

/**
 * The pieces every "upload a video to a CDN" field needs, shared by the Bunny
 * and Gumlet source fields.
 *
 * Extracted rather than copied: the two fields differ in where the bytes go and
 * what comes back, not in how a warning looks or how a file input behaves, and
 * a second private copy of each is how the source-type lists in this app drifted
 * apart in the first place.
 */

/**
 * A problem worth stopping for that isn't a failure — the upload worked, the
 * playback URL is doubtful. Amber rather than red, and never in place of the
 * file: the author still has their upload, they just have something to fix.
 */
export function Warning( { text } ) {
	return (
		// The body is `text-ink`, not `text-warning`: #FDB022 on its own 12%
		// tint is about 1.9:1, which is fine for a one-word badge and
		// unreadable for a sentence. The amber carries in the icon and border.
		<div className="flex gap-2 mt-2 p-3 rounded border border-warning/40 bg-warning-light">
			<Icon name="help" className="w-4 h-4 shrink-0 text-warning mt-px" />
			<p className="text-xs text-ink leading-5 !m-0">{ text }</p>
		</div>
	);
}

/**
 * The file input itself, kept out of the layout. It is rendered rather than
 * created on demand so the same element can be reused for Replace, and it is
 * reset after every pick — choosing the same file twice in a row fires no
 * change event otherwise, which reads as the button being broken.
 */
export function FilePicker( { inputRef, onPick, accept } ) {
	return (
		<input
			ref={ inputRef }
			type="file"
			accept={ accept }
			className="hidden"
			onChange={ ( e ) => {
				const file = e.target.files?.[ 0 ];
				e.target.value = '';
				onPick( file );
			} }
		/>
	);
}

/** Byte count as something a person reads at a glance. */
export function formatBytes( bytes ) {
	if ( ! bytes ) {
		return '';
	}
	const units = [ 'B', 'KB', 'MB', 'GB' ];
	let n = bytes;
	let i = 0;
	while ( n >= 1024 && i < units.length - 1 ) {
		n /= 1024;
		i++;
	}
	return `${ n >= 10 || 0 === i ? Math.round( n ) : n.toFixed( 1 ) } ${ units[ i ] }`;
}
