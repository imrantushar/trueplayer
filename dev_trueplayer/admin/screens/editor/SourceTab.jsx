import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { Card, Field, FieldGroup, Input, Select, SectionTitle, Toggle } from '../../components/UI';
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

export default function SourceTab( { config, patch, videoId } ) {
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

	const canGrab = canCaptureFrame( source ) && !! videoId;

	return (
		<Card className="p-6 max-w-2xl">
			<SectionTitle>Source Configuration</SectionTitle>

			<Field label="Source type" hint={ ! isPro() ? 'Bunny.net & HLS streaming require TruePlayer Pro.' : undefined }>
				<Select value={ source.type || 'self' } onChange={ ( e ) => set( { type: e.target.value } ) }>
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
						onRemove={ () => set( { src: '' } ) }
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
				<Field label="File URL" required hint="A direct mp4/webm or .m3u8 URL from your Bunny Storage pull zone.">
					<Input value={ source.src || '' } onChange={ ( e ) => set( { src: e.target.value.trim() } ) } placeholder="https://your-zone.b-cdn.net/path/video.mp4" />
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
					onRemove={ () => set( { poster: '', posterAuto: false } ) }
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
	);
}
