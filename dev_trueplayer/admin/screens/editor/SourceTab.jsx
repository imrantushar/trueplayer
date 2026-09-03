import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { Card, Field, FieldGroup, Input, Select, SectionTitle, Toggle } from '../../components/UI';
import BunnyStorageField from '../../components/BunnyStorageField';
import MediaFileCard from '../../components/MediaFileCard';
import PosterField from '../../components/PosterField';
import { isPro } from '../../pro';
import { api } from '../../api';
import { canAutoCaptureFrame, canCaptureFrame, captureVideoFrame } from '../../utils/frameCapture';

const TYPES = [
	{ value: 'self', label: 'Self-hosted (media library)' },
	{ value: 'youtube', label: 'YouTube' },
	{ value: 'vimeo', label: 'Vimeo' },
	{ value: 'url', label: 'External URL (mp4/webm)' },
	{ value: 'bunny', label: 'Bunny.net Stream', pro: true },
	{ value: 'bunnyStorage', label: 'Bunny.net Storage (file)', pro: true },
	{ value: 'mux', label: 'Mux', pro: true },
	{ value: 'hls', label: 'HLS stream (.m3u8)', pro: true },
];

/**
 * The fields that say *where the media is*, as opposed to how it is presented.
 * They belong to one kind of source: a media-library URL is meaningless in
 * YouTube's field, and a Bunny pull zone is meaningless everywhere else. Set
 * together when the type changes, so no field keeps another type's value.
 */
const SOURCE_FIELDS = [ 'src', 'pullZone', 'videoId', 'playbackId' ];

/** Just the source-locating fields of a source, with absent ones as ''. */
function locatorOf( source = {} ) {
	return SOURCE_FIELDS.reduce( ( out, key ) => {
		out[ key ] = source[ key ] || '';
		return out;
	}, {} );
}

export default function SourceTab( { config, patch, videoId, title = '', onTitleChange } ) {
	const source = config.source || { type: 'self' };
	const set = ( partial ) => patch( { source: { ...source, ...partial } } );
	const audio = source.mediaType === 'audio';
	// Audio-only describes a file the browser plays without a picture, so it is
	// only meaningful for the file-backed types — a YouTube or Vimeo source is an
	// iframe either way. Still shown when it is already on, so a setting made
	// before a source change never gets stranded somewhere it can't be undone.
	const canBeAudio = [ 'self', 'url', 'bunnyStorage' ].includes( source.type ) || audio;

	const [ capture, setCapture ] = useState( { busy: false, error: '' } );
	// The src the auto-capture below has already dealt with, so it fires once
	// per newly chosen file rather than on every keystroke or re-render.
	const captured = useRef( null );
	// What each source type held, so switching away and back returns the author
	// to what they had rather than to an empty field. Filled as types are left,
	// which means the type the video was loaded on is stashed the first time it
	// is switched away from — so coming back restores the saved source.
	const stashed = useRef( {} );

	/**
	 * Read a frame out of the video and store it as the poster.
	 *
	 * `set` is deliberately not used: this runs asynchronously, so it would
	 * write back a `source` snapshot taken before the capture started and undo
	 * whatever the author edited meanwhile. Patching from the live config keeps
	 * only the poster fields.
	 */
	const grabPoster = useCallback( async ( src ) => {
		setCapture( { busy: true, error: '' } );
		try {
			const frame = await captureVideoFrame( src );
			const { url } = await api.savePoster( videoId, frame, src );
			patch( ( current ) => ( { source: { ...( current.source || {} ), poster: url, posterAuto: true } } ) );
			setCapture( { busy: false, error: '' } );
		} catch ( e ) {
			setCapture( { busy: false, error: e.message || 'Could not create a thumbnail from this video.' } );
		}
	}, [ patch, videoId ] );

	// A newly picked video gets a thumbnail on its own. An author's own poster
	// is never overwritten — but one we generated is, since it belongs to the
	// file that was just replaced.
	useEffect( () => {
		const src = source.src || '';
		// The first pass only records what was already saved: merely opening a
		// video mustn't upload anything. Choosing a file is what triggers a
		// capture — an existing video without a poster has the button below.
		if ( null === captured.current ) {
			captured.current = src;
			return;
		}
		if ( ! src || captured.current === src || ! videoId ) {
			return;
		}
		if ( source.poster && ! source.posterAuto ) {
			captured.current = src; // Author's own poster outlives the file it was set for.
			return;
		}
		if ( ! canAutoCaptureFrame( source ) ) {
			return;
		}
		captured.current = src;
		grabPoster( src );
	}, [ source, videoId, grabPoster ] );

	/**
	 * Whether the poster on screen is one we produced — a frame captured from
	 * the file, or a thumbnail derived from the provider — rather than one the
	 * author picked. Ours describes a particular piece of media and dies with
	 * it; theirs is their own work and outlives it. Same rule the server applies
	 * when a source is retargeted (VideosController::quick_update).
	 */
	const ourPoster = () => !! ( source.posterAuto || source.posterDerived );

	/**
	 * Clear the poster we generated, in the config and in the media library, and
	 * hand back the config patch for the caller to merge with its own change.
	 *
	 * The cleanup call is fire-and-forget: it must not block the edit the author
	 * already made. The server keeps whichever poster the *saved* config still
	 * points at, so backing out of an unsaved change can't leave the published
	 * page with a missing thumbnail.
	 */
	const clearOurPoster = () => {
		if ( videoId ) {
			api.discardPosters( videoId ).catch( () => {} );
		}
		return { poster: '', posterAuto: false, posterDerived: false, posterFallbacks: undefined };
	};

	/** Drop the file — and with it the poster that came from it. */
	const removeFile = () => {
		// Re-picking the very same file has to capture again, and the auto-capture
		// guard keys on the last src it handled.
		captured.current = '';
		set( { src: '', ...( ourPoster() ? clearOurPoster() : {} ) } );
	};

	/**
	 * Switch the kind of source — carrying nothing of the old one over.
	 *
	 * The locating fields are swapped, not kept: the uploaded file's URL used to
	 * stay behind in YouTube's field, where it reads as a value the author
	 * entered and fails to load as one. A poster made for the old source goes
	 * too — a frame captured from an upload says nothing about the YouTube video
	 * replacing it, and while it sits there it also blocks the provider
	 * thumbnail that should take over (posters are only derived when empty).
	 */
	const changeType = ( type ) => {
		if ( type === source.type ) {
			return;
		}
		captured.current = '';
		stashed.current[ source.type || 'self' ] = locatorOf( source );
		const restored = stashed.current[ type ] || locatorOf( {} );
		set( { type, ...restored, ...( ourPoster() ? clearOurPoster() : {} ) } );
	};

	const canGrab = canCaptureFrame( source ) && !! videoId;

	return (
		<div className="w-full max-w-2xl space-y-6">
		<Card className="p-6">
			<SectionTitle>Source Configuration</SectionTitle>

			{ /* The title leads, rather than being typed into the breadcrumb it
			     used to live in: a crumb is a place indicator, so an editable one
			     is invisible as a form field — nothing marks it required, it can't
			     carry a hint, and an author who never hovers it never learns the
			     name is theirs to set. */ }
			{ onTitleChange && (
				<Field label="Title" required hint="Names this media in your library, and labels it in the player.">
					<Input
						value={ title }
						onChange={ ( e ) => onTitleChange( e.target.value ) }
						placeholder="Untitled"
					/>
				</Field>
			) }

			<Field label="Source type" hint={ ! isPro() ? 'Bunny.net & HLS streaming require TruePlayer Pro.' : undefined }>
				<Select value={ source.type || 'self' } onChange={ ( e ) => changeType( e.target.value ) }>
					{ TYPES.map( ( t ) => (
						<option key={ t.value } value={ t.value } disabled={ t.pro && ! isPro() }>
							{ t.label }{ t.pro && ! isPro() ? ' (Pro)' : '' }
						</option>
					) ) }
				</Select>
			</Field>

			{ source.type === 'self' && (
				<FieldGroup
					label={ audio ? 'Audio file' : 'Video file' }
					required
					hint={ audio
						? 'Pick an uploaded audio file from the media library.'
						: 'Pick an uploaded video from the media library. A thumbnail is grabbed from it automatically.' }
				>
					<MediaFileCard
						source={ source }
						audio={ audio }
						onPick={ ( url ) => set( { src: url } ) }
						onRemove={ removeFile }
					/>
				</FieldGroup>
			) }

			{ source.type === 'bunny' && (
				<>
					<Field label="Pull-zone hostname" required hint="Your Bunny Stream CDN hostname, e.g. vz-abc123.b-cdn.net">
						<Input value={ source.pullZone || '' } onChange={ ( e ) => set( { pullZone: e.target.value.replace( /^https?:\/\//, '' ).replace( /\/$/, '' ) } ) } placeholder="vz-abc123.b-cdn.net" />
					</Field>
					<Field label="Video ID" required hint="The Bunny library video GUID. We build the HLS URL and play it with your custom controls.">
						<Input value={ source.videoId || '' } onChange={ ( e ) => set( { videoId: e.target.value.trim() } ) } placeholder="e.g. 8f3b…-video-guid" />
					</Field>
				</>
			) }

			{ source.type === 'mux' && (
				<Field label="Mux playback ID" required hint="From your Mux asset. Or paste a full signed .m3u8 URL below.">
					<Input value={ source.playbackId || '' } onChange={ ( e ) => set( { playbackId: e.target.value.trim() } ) } placeholder="e.g. a4nOgmxGWg6gULfcBbAa00…" />
				</Field>
			) }

			{ source.type === 'bunnyStorage' && (
				<Field label="Video file" required hint="Upload straight to your storage zone, reuse a file already in it, or paste a URL.">
					<BunnyStorageField value={ source.src || '' } onChange={ ( src ) => set( { src } ) } />
				</Field>
			) }

			{ [ 'hls', 'youtube', 'vimeo', 'url', 'mux' ].includes( source.type ) && ! ( source.type === 'mux' && ! source.src ) && (
				<Field
					label={ source.type === 'youtube' || source.type === 'vimeo' ? 'Video URL or ID' : ( source.type === 'mux' ? 'Signed playlist URL (optional)' : 'Media URL' ) }
					required={ source.type !== 'mux' }
				>
					<Input value={ source.src || '' } onChange={ ( e ) => set( { src: e.target.value } ) } placeholder={ source.type === 'youtube' ? 'https://youtube.com/watch?v=…' : 'https://…' } />
				</Field>
			) }

			<FieldGroup label={ audio ? 'Cover art' : 'Poster image' }>
				<PosterField
					source={ source }
					audio={ audio }
					canGrab={ canGrab }
					capture={ capture }
					onPick={ ( url ) => set( { poster: url, posterAuto: false } ) }
					onRemove={ () => set( { poster: '', posterAuto: false, posterDerived: false, posterFallbacks: undefined } ) }
					onGrab={ () => grabPoster( source.src ) }
				/>
			</FieldGroup>

			{ canBeAudio && (
				<div className="flex items-center justify-between gap-4 pt-5 border-t border-line">
					<div className="min-w-0">
						<p className="text-[13px] font-medium text-ink">Audio-only (podcast) player</p>
						<p className="text-xs text-muted mt-0.5">Hide video screen and switch to audio player mode.</p>
					</div>
					<Toggle
						checked={ audio }
						onChange={ ( v ) => set( { mediaType: v ? 'audio' : 'video' } ) }
						className="shrink-0"
					/>
				</div>
			) }
		</Card>
		</div>
	);
}
