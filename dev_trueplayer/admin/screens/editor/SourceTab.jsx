import { Card, Field, Input, Select, Toggle } from '../../components/UI';
import MediaPicker from '../../components/MediaPicker';
import { isPro } from '../../pro';

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

export default function SourceTab( { config, patch } ) {
	const source = config.source || { type: 'self' };
	const set = ( partial ) => patch( { source: { ...source, ...partial } } );

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
				<Field label="Video file" hint="Pick an uploaded video from the media library.">
					<MediaPicker value={ source.src || '' } onChange={ ( url ) => set( { src: url } ) } accept="video" label="Upload a video" />
				</Field>
			) }

			{ source.type === 'bunny' && (
				<>
					<Field label="Pull-zone hostname" hint="Your Bunny Stream CDN hostname, e.g. vz-abc123.b-cdn.net">
						<Input value={ source.pullZone || '' } onChange={ ( e ) => set( { pullZone: e.target.value.replace( /^https?:\/\//, '' ).replace( /\/$/, '' ) } ) } placeholder="vz-abc123.b-cdn.net" />
					</Field>
					<Field label="Video ID" hint="The Bunny library video GUID. We build the HLS URL and play it with your custom controls.">
						<Input value={ source.videoId || '' } onChange={ ( e ) => set( { videoId: e.target.value.trim() } ) } placeholder="e.g. 8f3b…-video-guid" />
					</Field>
				</>
			) }

			{ source.type === 'mux' && (
				<Field label="Mux playback ID" hint="From your Mux asset. Or paste a full signed .m3u8 URL below.">
					<Input value={ source.playbackId || '' } onChange={ ( e ) => set( { playbackId: e.target.value.trim() } ) } placeholder="e.g. a4nOgmxGWg6gULfcBbAa00…" />
				</Field>
			) }

			{ source.type === 'bunnyStorage' && (
				<Field label="File URL" hint="A direct mp4/webm or .m3u8 URL from your Bunny Storage pull zone.">
					<Input value={ source.src || '' } onChange={ ( e ) => set( { src: e.target.value.trim() } ) } placeholder="https://your-zone.b-cdn.net/path/video.mp4" />
				</Field>
			) }

			{ [ 'hls', 'youtube', 'vimeo', 'url', 'mux' ].includes( source.type ) && ! ( source.type === 'mux' && ! source.src ) && (
				<Field label={ source.type === 'youtube' || source.type === 'vimeo' ? 'Video URL or ID' : ( source.type === 'mux' ? 'Signed playlist URL (optional)' : 'Media URL' ) }>
					<Input value={ source.src || '' } onChange={ ( e ) => set( { src: e.target.value } ) } placeholder={ source.type === 'youtube' ? 'https://youtube.com/watch?v=…' : 'https://…' } />
				</Field>
			) }

			<Field label="Poster image" hint="Shown before playback (optional).">
				<MediaPicker value={ source.poster || '' } onChange={ ( url ) => set( { poster: url } ) } accept="image" label="Upload an image" />
			</Field>

			<Toggle
				checked={ source.mediaType === 'audio' }
				onChange={ ( v ) => set( { mediaType: v ? 'audio' : 'video' } ) }
				label="Audio-only (podcast) player"
			/>
		</Card>
	);
}
