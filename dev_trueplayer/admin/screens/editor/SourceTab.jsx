import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { Card, Field, Input, Select, Toggle, Button } from '../../components/UI';
import MediaPicker from '../../components/MediaPicker';
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
				<Field label="Video file" required hint="Pick an uploaded video from the media library. A thumbnail is grabbed from it automatically.">
					<MediaPicker value={ source.src || '' } onChange={ ( url ) => set( { src: url } ) } accept="video" label="Upload a video" />
				</Field>
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

			{ /* The capture controls sit outside the Field: it renders a <label>,
			     and a button nested in one folds its text into the picker's
			     accessible name. */ }
			<Field label="Poster image" hint="Shown before playback (optional)." className={ canGrab ? 'mb-2.5' : undefined }>
				<MediaPicker value={ source.poster || '' } onChange={ ( url ) => set( { poster: url, posterAuto: false } ) } accept="image" label="Upload an image" />
			</Field>
			{ canGrab && (
				<div className="mb-5">
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="sm" disabled={ capture.busy } onClick={ () => grabPoster( source.src ) }>
							{ capture.busy ? 'Grabbing a frame…' : `${ source.poster ? 'Regenerate' : 'Generate' } from video` }
						</Button>
						{ ! capture.busy && ! capture.error && source.posterAuto && (
							<span className="text-xs text-muted">Grabbed from the video.</span>
						) }
					</div>
					{ capture.error && <span className="block text-xs text-danger mt-2">{ capture.error }</span> }
				</div>
			) }

			<Toggle
				checked={ source.mediaType === 'audio' }
				onChange={ ( v ) => set( { mediaType: v ? 'audio' : 'video' } ) }
				label="Audio-only (podcast) player"
			/>
		</Card>
	);
}
