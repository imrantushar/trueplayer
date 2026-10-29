/**
 * Edit the media behind a block, without leaving the post.
 *
 * Two callers share the one dialog because the fields are the same: a source
 * type and one URL.
 *  - An inline block (`inline`) writes the result straight back to its own
 *    attributes through `onApply` — nothing is saved to the library.
 *  - A library video (`video`) is retargeted over REST and handed back through
 *    `onSaved`, with a name so it reads well in the library.
 *
 * Built from @wordpress/components rather than reusing the admin's own create
 * dialog (admin/screens/CreateModal.jsx), for three reasons that all bite in
 * the editor: its `Modal` is a plain `position: fixed` div, which the editor's
 * iframed canvas would clip; every one of its styles is Tailwind, which is
 * enqueued only on TruePlayer's admin pages; and importing that stylesheet
 * into this entry would make webpack merge the CSS entries and stop emitting
 * one of them. `Modal` here portals to the top document, so none of that
 * applies.
 */
import { useState } from '@wordpress/element';
import { Modal, Notice } from '@wordpress/components';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { __, sprintf } from '@Utils/translation';
import { RadioCards, Styles, Label, Help } from './ui';
import { updateVideo } from './data';

/** The design's source list. HLS is stored as a plain URL: the player spots `.m3u8` by itself. */
const TYPES = [
	{ value: 'self', label: __( 'Self-hosted' ), hint: __( 'Upload to this site' ), field: __( 'Media URL' ), ph: 'https://' },
	{ value: 'youtube', label: __( 'YouTube' ), hint: __( 'Paste a YouTube link.' ), field: __( 'YouTube URL or video ID' ), ph: 'https://youtube.com/watch?v=' },
	{ value: 'vimeo', label: __( 'Vimeo' ), hint: __( 'Paste a Vimeo link.' ), field: __( 'Vimeo URL or video ID' ), ph: 'https://vimeo.com/' },
	{ value: 'url', label: __( 'External URL (mp4/webm)' ), hint: __( 'A media file hosted anywhere.' ), field: __( 'Media URL' ), ph: 'https://example.com/video.mp4' },
	{ value: 'hls', label: __( 'HLS stream (.m3u8)' ), hint: __( 'Any adaptive HLS manifest.' ), field: __( 'Media URL' ), ph: 'https://example.com/stream.m3u8' },
];

const isHls = ( src ) => /\.m3u8($|\?)/i.test( src || '' );

export default function VideoModal( { video = null, inline = null, mediaType = '', onClose, onSaved, onApply } ) {
	const editing = !! video;
	const source = video?.config?.source || inline || {};
	// A saved video can only take the types the server accepts.
	const types = editing ? TYPES.filter( ( t ) => 'hls' !== t.value ) : TYPES;

	const startType = 'url' === source.type && isHls( source.src ) && ! editing ? 'hls' : source.type;

	const [ title, setTitle ] = useState( video?.title || '' );
	const [ type, setType ] = useState( types.some( ( t ) => t.value === startType ) ? startType : 'self' );
	const [ src, setSrc ] = useState( source.src || '' );
	const [ media, setMedia ] = useState( null ); // The chosen attachment, for `self`.
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );

	const chosen = types.find( ( t ) => t.value === type ) || types[ 0 ];
	const ready = '' !== src.trim();

	const changeType = ( next ) => {
		setType( next );
		setError( '' );
		// A YouTube link is not an mp4 URL, so don't carry one across.
		if ( 'self' === next || 'self' === type || 'youtube' === next || 'vimeo' === next || 'youtube' === type || 'vimeo' === type ) {
			setSrc( '' );
			setMedia( null );
		}
	};

	const pick = ( attachment ) => {
		setSrc( attachment.url || '' );
		setMedia( attachment );
		if ( '' === title.trim() && attachment.title ) {
			setTitle( attachment.title );
		}
	};

	const submit = async () => {
		if ( ! ready || busy ) {
			return;
		}
		const value = src.trim();
		if ( ! editing && ! /^https?:\/\//i.test( value ) ) {
			setError( __( 'Paste a full link starting with https://' ) );
			return;
		}
		if ( ! editing ) {
			onApply( {
				src: value,
				sourceType: 'hls' === type ? 'url' : type,
				mediaId: 'self' === type ? media?.id || 0 : 0,
			} );
			return;
		}
		setBusy( true );
		setError( '' );
		const payload = { title: title.trim(), type, src: value };
		try {
			// The component unmounts on success, so nothing resets `busy` —
			// leaving it set is what keeps a double submit from saving twice.
			onSaved( await updateVideo( video.id, payload ) );
		} catch ( e ) {
			setError( e.message || __( 'That video could not be saved.' ) );
			setBusy( false );
		}
	};

	const kind = 'audio' === ( mediaType || source.mediaType ) ? __( 'audio' ) : __( 'video' );

	return (
		<Modal
			title={ sprintf( /* translators: %s: video or audio. */ __( 'Edit %s media' ), kind ) }
			size="medium"
			className="tpb-frame"
			onRequestClose={ busy ? () => {} : onClose }
		>
			<Styles />
			<div className="tpb tpb-modal">
				{ error && (
					<Notice status="error" onRemove={ () => setError( '' ) }>
						{ error }
					</Notice>
				) }

				<Label className="tpb-modal__cap">{ __( 'Source' ) }</Label>
				<RadioCards dense gap={ 4 } value={ type } options={ types } onChange={ changeType } label={ __( 'Source' ) } />

				<Label gap>{ chosen.field }</Label>
				<div style={ { display: 'flex', gap: 8 } }>
					<input
						className="tpb-input tpb-input--lg"
						aria-label={ chosen.field }
						style={ { flex: 1, minWidth: 0 } }
						value={ src }
						placeholder={ chosen.ph }
						onChange={ ( e ) => {
							setSrc( e.target.value );
							setError( '' );
						} }
						onKeyDown={ ( e ) => 'Enter' === e.key && submit() }
					/>
					{ 'self' === type && (
						<MediaUploadCheck>
							<MediaUpload
								title={ __( 'Choose a video' ) }
								allowedTypes={ [ 'video', 'audio' ] }
								value={ media?.id }
								// Open on the library, not the upload tab — most files are
								// already there (matches admin/utils/media.js).
								mode="browse"
								onSelect={ pick }
								render={ ( { open } ) => (
									<button type="button" className="tpb-btn tpb-btn--lg" onClick={ open }>
										{ __( 'Choose a file' ) }
									</button>
								) }
							/>
						</MediaUploadCheck>
					) }
				</div>

				{ editing && (
					<>
						<Label gap>{ __( 'Name' ) }</Label>
						<input className="tpb-input" value={ title } placeholder={ __( 'e.g. Lesson 1' ) } onChange={ ( e ) => setTitle( e.target.value ) } />
						<Help>{ __( 'Shown in your library. You can rename it later.' ) }</Help>
					</>
				) }

				<div className="tpb-modal__foot" style={ { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, padding: '14px 0', borderTop: '1px solid #E0E4E8', position: 'sticky', bottom: 0, background: '#fff' } }>
					<button type="button" className="tpb-btn tpb-btn--lg tpb-btn--primary" onClick={ submit } disabled={ ! ready || busy }>
						{ busy ? __( 'Saving…' ) : __( 'Save' ) }
					</button>
				</div>
			</div>
		</Modal>
	);
}
