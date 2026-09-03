/**
 * Add or retarget a TruePlayer video without leaving the post.
 *
 * One dialog for both, because the fields are the same either way: a name and
 * one source. Passing a `video` puts it in edit mode, seeded from that video's
 * saved source.
 *
 * Built from @wordpress/components rather than reusing the admin's own create
 * dialog (admin/screens/CreateModal.jsx), for three reasons that all bite in
 * the editor: its `Modal` is a plain `position: fixed` div, which the editor's
 * iframed canvas would clip; every one of its styles is Tailwind, which is
 * enqueued only on TruePlayer's admin pages; and importing that stylesheet
 * into this entry would make webpack merge the CSS entries and stop emitting
 * one of them. `Modal` here portals to the top document, so none of that
 * applies.
 *
 * It also asks for one thing the admin dialog doesn't: the source. In the
 * library, creating is step one of two — you are dropped straight into the
 * editor to say what the video actually is. There is nowhere to drop an author
 * mid-post, so a video created here is finished when it is created.
 */
import { useState } from '@wordpress/element';
import {
	Button,
	Flex,
	FlexItem,
	Modal,
	Notice,
	RadioControl,
	TextControl,
} from '@wordpress/components';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { __, sprintf } from '@Utils/translation';
import {
	SOURCE_TYPES,
	brand,
	createVideo,
	editUrl,
	libraryUrl,
	sourceType,
	updateVideo,
} from './data';

export default function VideoModal( { video = null, onClose, onSaved } ) {
	const editing = !! video;
	const source = video?.config?.source || {};

	const [ title, setTitle ] = useState( video?.title || '' );
	const [ type, setType ] = useState( SOURCE_TYPES.some( ( t ) => t.value === source.type ) ? source.type : 'self' );
	const [ src, setSrc ] = useState( source.src || '' );
	const [ media, setMedia ] = useState( null ); // The chosen attachment, for `self`.
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );

	const chosen = sourceType( type );
	const ready = '' !== src.trim();

	const changeType = ( next ) => {
		setType( next );
		// The field means something different for each type, so carrying a
		// value across would offer a YouTube link as an mp4 URL.
		setSrc( '' );
		setMedia( null );
		setError( '' );
	};

	const pick = ( attachment ) => {
		setSrc( attachment.url || '' );
		setMedia( attachment );
		// Name the video after the file, unless there is already a name.
		if ( '' === title.trim() && attachment.title ) {
			setTitle( attachment.title );
		}
	};

	const submit = async () => {
		if ( ! ready || busy ) {
			return;
		}
		setBusy( true );
		setError( '' );
		const payload = { title: title.trim(), type, src: src.trim() };
		try {
			// The component unmounts on success, so nothing resets `busy` —
			// leaving it set is what keeps a double submit from saving twice.
			onSaved( editing ? await updateVideo( video.id, payload ) : await createVideo( payload ) );
		} catch ( e ) {
			setError(
				e.message ||
					( editing
						? __( 'That video could not be saved.' )
						: __( 'That video could not be created.' ) )
			);
			setBusy( false );
		}
	};

	// The filename shown beside the picker. On a video that was set up
	// elsewhere there is no attachment object yet, only the saved URL.
	const fileName = media?.filename || ( src ? src.split( '/' ).pop() : '' );
	const deepLink = editing ? editUrl( video.id ) : libraryUrl();

	return (
		<Modal
			title={
				editing
					? sprintf(
							/* translators: %s: product name, e.g. TruePlayer. */
							__( 'Edit %s media' ),
							brand()
					  )
					: sprintf(
							/* translators: %s: product name, e.g. TruePlayer. */
							__( 'Add %s media' ),
							brand()
					  )
			}
			size="medium"
			onRequestClose={ busy ? () => {} : onClose }
		>
			<Flex direction="column" gap={ 4 } align="stretch">
				{ error && (
					<FlexItem>
						<Notice status="error" onRemove={ () => setError( '' ) }>
							{ error }
						</Notice>
					</FlexItem>
				) }

				<FlexItem>
					<TextControl
						__nextHasNoMarginBottom
						autoFocus
						label={ __( 'Name' ) }
						help={ __( 'Shown in your library. You can rename it later.' ) }
						value={ title }
						onChange={ setTitle }
						placeholder={ __( 'e.g. Lesson 1' ) }
					/>
				</FlexItem>

				<FlexItem>
					<RadioControl
						label={ __( 'Source' ) }
						selected={ type }
						options={ SOURCE_TYPES.map( ( t ) => ( { label: t.label, value: t.value } ) ) }
						onChange={ changeType }
					/>
				</FlexItem>

				<FlexItem>
					{ 'self' === type ? (
						<MediaUploadCheck
							fallback={
								<Notice status="warning" isDismissible={ false }>
									{ __( 'You do not have permission to upload files.' ) }
								</Notice>
							}
						>
							<Flex justify="flex-start" gap={ 3 }>
								<FlexItem>
									<MediaUpload
										title={ __( 'Choose a video' ) }
										allowedTypes={ [ 'video', 'audio' ] }
										value={ media?.id }
										// Open on the library, not the upload tab.
										// Most files are already there, and it
										// matches the picker in TruePlayer's own
										// editor (admin/utils/media.js).
										mode="browse"
										onSelect={ pick }
										render={ ( { open } ) => (
											<Button variant="secondary" onClick={ open }>
												{ src
													? __( 'Replace file' )
													: __( 'Choose a file' ) }
											</Button>
										) }
									/>
								</FlexItem>
								{ fileName && (
									<FlexItem isBlock>
										<span
											style={ {
												display: 'block',
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
											} }
											title={ fileName }
										>
											{ fileName }
										</span>
									</FlexItem>
								) }
							</Flex>
						</MediaUploadCheck>
					) : (
						<TextControl
							__nextHasNoMarginBottom
							label={ chosen.field }
							value={ src }
							onChange={ setSrc }
							placeholder={ chosen.placeholder }
						/>
					) }
				</FlexItem>

				<FlexItem>
					<p style={ { margin: 0, fontSize: '12px', color: '#757575' } }>
						{ __(
							'Bunny.net, Mux and HLS sources — and gating, chapters and appearance — are set up in the full editor.' ) }
						{ deepLink && ' ' }
						{ deepLink && (
							<a href={ deepLink } target="_blank" rel="noreferrer">
								{ sprintf(
									/* translators: %s: product name, e.g. TruePlayer. */
									__( 'Open %s' ),
									brand()
								) }
							</a>
						) }
					</p>
				</FlexItem>

				<FlexItem>
					<Flex justify="flex-end" gap={ 2 }>
						<FlexItem>
							<Button variant="tertiary" onClick={ onClose } disabled={ busy }>
								{ __( 'Cancel' ) }
							</Button>
						</FlexItem>
						<FlexItem>
							<Button
								variant="primary"
								onClick={ submit }
								isBusy={ busy }
								disabled={ ! ready || busy }
							>
								{ editing
									? ( busy ? __( 'Saving…' ) : __( 'Save' ) )
									: ( busy ? __( 'Creating…' ) : __( 'Create' ) ) }
							</Button>
						</FlexItem>
					</Flex>
				</FlexItem>
			</Flex>
		</Modal>
	);
}
