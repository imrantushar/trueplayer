import { Button } from './UI';
import { pickMedia } from '../utils/media';
import { __ } from '@Utils/translation';

/**
 * The chosen media file, shown as a described row rather than a bare filename.
 *
 * A filename alone asks the author to take on trust that the right thing is
 * attached; the row names the format and where the file came from, and gives
 * Replace and Remove a panel of their own so it is obvious which field they
 * belong to.
 *
 * The tile is a file mark, not a thumbnail: the poster field directly below
 * shows the picture, and repeating it here would read as two posters.
 */

/** Where a source's file lives, in the author's terms. */
const ORIGIN = {
	self: __( 'Media Library' ),
	url: __( 'External URL' ),
	bunnyStorage: __( 'Bunny Storage' ),
};

/** The file's name, from a media-library URL or a typed one. */
function filenameOf( src ) {
	try {
		return decodeURIComponent( new URL( src, window.location.href ).pathname.split( '/' ).pop() || src );
	} catch ( e ) {
		return src;
	}
}

/** Uppercase container format — the part of the name that says what will play. */
function formatOf( name ) {
	const ext = ( name.split( '?' )[ 0 ].split( '.' ).pop() || '' ).toLowerCase();
	return ext && ext.length <= 4 && /^[a-z0-9]+$/.test( ext ) ? ext.toUpperCase() : '';
}

export default function MediaFileCard( { source, onPick, onRemove, audio = false } ) {
	const src = source.src || '';
	const choose = () => pickMedia( audio ? 'audio' : 'video', ( url ) => onPick( url ) );

	if ( ! src ) {
		return (
			<button
				type="button"
				onClick={ choose }
				className="w-full flex flex-col items-center gap-1 border border-dashed border-line rounded-card px-4 py-7 text-center hover:border-brand-400 hover:bg-brand-50/40 transition-colors group"
			>
				<span className="text-gray-400 group-hover:text-brand-500 transition-colors">
					<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M12 16V4m0 0L8 8m4-4l4 4" />
						<path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
					</svg>
				</span>
				<span className="text-sm font-medium text-ink group-hover:text-brand-600 transition-colors">
					{ audio ? __( 'Choose an audio file' ) : __( 'Choose a video' ) }
				</span>
				<span className="text-xs text-muted">
					{ audio ? __( 'MP3, M4A, OGG or WAV from your media library.' ) : __( 'MP4, WebM or MOV from your media library.' ) }
				</span>
			</button>
		);
	}

	const name = filenameOf( src );
	const detail = [ formatOf( name ), ORIGIN[ source.type ] || '' ].filter( Boolean ).join( ' • ' );

	return (
		<div className="flex items-center gap-3.5 rounded-card border border-line bg-subtle p-3">
			<span className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg bg-brand-100 text-brand-500">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					{ audio ? (
						<>
							<path d="M9 18V5l10-2v13" />
							<circle cx="6" cy="18" r="3" />
							<circle cx="16" cy="16" r="3" />
						</>
					) : (
						<>
							<rect x="2" y="6" width="13" height="12" rx="2" />
							<path d="M15 11l6-3.5v9L15 13z" />
						</>
					) }
				</svg>
			</span>

			<div className="min-w-0 flex-1">
				<p className="text-sm font-semibold text-ink truncate" title={ name }>{ name }</p>
				{ detail && <p className="text-xs text-muted mt-0.5 truncate">{ detail }</p> }
			</div>

			<div className="flex items-center gap-1.5 shrink-0">
				<Button variant="ghost" size="sm" onClick={ choose }>{ __( 'Replace' ) }</Button>
				<Button variant="dangerClear" size="sm" onClick={ onRemove }>{ __( 'Remove' ) }</Button>
			</div>
		</div>
	);
}
