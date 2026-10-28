/**
 * The block's editor UI: the real player, at the size it will publish at.
 *
 * A block is self-contained: its source and its handful of options are block
 * attributes, saved with the post, so nothing has to be set up on a settings
 * screen first. A video from the library (`videoId`) still works and is
 * treated as a second, optional mode.
 *
 * The canvas renders the same frontend player component the published page
 * does, fed by the same PHP config pipeline (`block/preview` for attributes,
 * `videos/{id}/preview` for a library video), so what an author arranges their
 * post around is what a visitor gets.
 *
 * The chrome around it is all @wordpress/components, so it inherits the
 * editor's styles. The player's own stylesheet is enqueued into the canvas
 * iframe by PHP (Block::canvas_assets) and deliberately never imported here —
 * see that method for why.
 */
import { useCallback, useEffect, useState } from '@wordpress/element';
import { useBlockProps, InspectorControls, BlockControls, MediaPlaceholder, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import {
	Button,
	ColorPalette,
	Flex,
	FlexItem,
	Notice,
	PanelBody,
	Placeholder,
	SelectControl,
	Spinner,
	TextControl,
	TextareaControl,
	ToggleControl,
	ToolbarButton,
	ToolbarGroup,
} from '@wordpress/components';
import { __, sprintf } from '@Utils/translation';
import Player from '@Player/Player';
import NativeEmbed, { needsNativeEmbed } from './NativeEmbed';
import VideoModal from './VideoModal';
import {
	brand,
	canCreate,
	detectSourceType,
	editUrl,
	fetchBlockPreview,
	fetchVideos,
	presets,
	previewAttributes,
} from './data';

const ASPECTS = [
	{ label: __( 'Site default' ), value: '' },
	{ label: '16:9', value: '16:9' },
	{ label: '9:16', value: '9:16' },
	{ label: '4:3', value: '4:3' },
	{ label: '1:1', value: '1:1' },
	{ label: '21:9', value: '21:9' },
	{ label: __( 'Match the video' ), value: 'auto' },
];

const SKINS = [
	{ label: __( 'Site default' ), value: '' },
	{ label: __( 'Default' ), value: 'default' },
	{ label: __( 'Modern' ), value: 'modern' },
	{ label: __( 'Simple' ), value: 'simple' },
	{ label: __( 'Minimal' ), value: 'minimal' },
	{ label: __( 'Standard' ), value: 'standard' },
];

const AUTOPLAY = [
	{ label: __( 'Site default' ), value: '' },
	{ label: __( 'Off' ), value: 'off' },
	{ label: __( 'Muted' ), value: 'muted' },
	{ label: __( 'With sound (may be blocked)' ), value: 'sound' },
];

const PRELOAD = [
	{ label: __( 'Site default' ), value: '' },
	{ label: __( 'Metadata only' ), value: 'metadata' },
	{ label: __( 'Whole file' ), value: 'auto' },
	{ label: __( 'Nothing' ), value: 'none' },
];

const LOAD = [
	{ label: __( 'Site default' ), value: '' },
	{ label: __( 'Click to load (fastest page)' ), value: 'facade' },
	{ label: __( 'Load when scrolled into view' ), value: 'onvisible' },
	{ label: __( 'Load immediately' ), value: 'eager' },
];

/** Waits for a value to stop changing, so typing doesn't fire a request per key. */
function useDebounced( value, ms = 350 ) {
	const [ v, setV ] = useState( value );
	useEffect( () => {
		const t = setTimeout( () => setV( value ), ms );
		return () => clearTimeout( t );
	}, [ value, ms ] );
	return v;
}

export default function Edit( { attributes, setAttributes, isSelected } ) {
	const { videoId, src, sourceType } = attributes;
	const inline = ! videoId && !! src;
	const blockProps = useBlockProps();

	const [ videos, setVideos ] = useState( null ); // null until asked for.
	const [ showLibrary, setShowLibrary ] = useState( false );
	const [ editing, setEditing ] = useState( false );
	const [ draftUrl, setDraftUrl ] = useState( '' );

	// The render-ready payload for the preview, from either mode.
	const [ item, setItem ] = useState( null );
	const [ itemError, setItemError ] = useState( '' );
	const [ bump, setBump ] = useState( 0 );

	// Until the preview arrives a saved video's media type is unknown.
	const audio = 'audio' === attributes.mediaType || 'audio' === item?.config?.source?.mediaType;

	// The library is only fetched when it is needed — an attribute-only block
	// never asks for it.
	useEffect( () => {
		if ( ! showLibrary && ! videoId ) {
			return undefined;
		}
		let live = true;
		fetchVideos()
			.then( ( list ) => live && setVideos( Array.isArray( list ) ? list : [] ) )
			.catch( () => live && setVideos( [] ) );
		return () => {
			live = false;
		};
	}, [ showLibrary, videoId ] );

	// Everything the preview depends on, as one comparable string.
	const previewKey = useDebounced( JSON.stringify( previewAttributes( attributes ) ) );

	useEffect( () => {
		if ( ! videoId && ! src ) {
			setItem( null );
			setItemError( '' );
			return undefined;
		}
		let live = true;
		setItemError( '' );
		const request = fetchBlockPreview( JSON.parse( previewKey ) );
		request
			.then( ( payload ) => live && setItem( payload ) )
			.catch( ( e ) => {
				if ( live ) {
					setItem( null );
					setItemError( e.message || __( 'That media could not be loaded.' ) );
				}
			} );
		return () => {
			live = false;
		};
	}, [ videoId, bump, previewKey ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const set = useCallback( ( patch ) => setAttributes( patch ), [ setAttributes ] );

	const applyLink = ( value ) => {
		const url = value.trim();
		if ( url ) {
			set( { videoId: 0, src: url, sourceType: detectSourceType( url ), mediaId: 0 } );
			setDraftUrl( '' );
		}
	};

	const applyFile = ( media ) =>
		set( {
			videoId: 0,
			src: media.url || '',
			sourceType: 'self',
			// An audio file picked in a generic block says what it is.
			mediaType: 'audio' === media.type ? 'audio' : attributes.mediaType,
			mediaId: media.id || 0,
			title: attributes.title || media.title || '',
		} );

	const clearSource = () =>
		set( { videoId: 0, src: '', sourceType: '', mediaId: 0, poster: '', captionUrl: '' } );

	const libraryMissing = !! videoId && null !== videos && ! videos.some( ( v ) => v.id === videoId ) && !! itemError;
	const hasSource = !! videoId || !! src;

	const presetOptions = [ { label: __( 'None' ), value: 0 } ].concat(
		presets()
			.filter( ( p ) => ( 'audio' === p.type ) === audio )
			.map( ( p ) => ( { label: p.title, value: p.id } ) )
	);

	const libraryOptions = [ { label: __( '— Select a video —' ), value: 0 } ].concat(
		( videos || [] ).map( ( v ) => ( { label: v.title, value: v.id } ) )
	);

	const savedLibrary = ( video ) => {
		setVideos( ( list ) => [ video, ...( list || [] ).filter( ( v ) => v.id !== video.id ) ] );
		set( { videoId: video.id } );
		setEditing( false );
		setBump( ( b ) => b + 1 );
	};

	const providerOnly = [ 'youtube', 'vimeo' ].includes( sourceType ) && ! src;
	const providerName = 'youtube' === sourceType ? 'YouTube' : 'Vimeo';

	const linkField = (
		<Flex justify="flex-start" gap={ 3 } align="flex-end" wrap style={ { width: '100%', marginTop: 8 } }>
			<FlexItem isBlock style={ { minWidth: 240 } }>
				<TextControl
					__nextHasNoMarginBottom
					label={ providerOnly ? sprintf( /* translators: %s: YouTube or Vimeo. */ __( '%s link' ), providerName ) : __( 'Or paste a link' ) }
					placeholder={ providerOnly ? '' : 'https://youtu.be/…  ·  vimeo.com/…  ·  https://…/file.mp4' }
					value={ draftUrl }
					onChange={ setDraftUrl }
					onKeyDown={ ( e ) => 'Enter' === e.key && applyLink( draftUrl ) }
				/>
			</FlexItem>
			<Button variant="secondary" disabled={ ! draftUrl.trim() } onClick={ () => applyLink( draftUrl ) }>
				{ __( 'Use link' ) }
			</Button>
		</Flex>
	);

	// Chosen by variation or transform before any source exists.
	const sourcePicker = providerOnly ? (
		linkField
	) : (
		<MediaPlaceholder
			icon={ audio ? 'format-audio' : 'format-video' }
			labels={ {
				title: brand(),
				instructions: audio
					? __( 'Upload an audio file, drop one here, or paste a link.' )
					: __( 'Upload a video or audio file, drop one here, or paste a YouTube, Vimeo or media link.' ),
			} }
			allowedTypes={ audio ? [ 'audio' ] : [ 'video', 'audio' ] }
			accept={ audio ? 'audio/*' : 'video/*,audio/*' }
			onSelect={ applyFile }
			onSelectURL={ applyLink }
			disableURLInput
		>
			{ linkField }
		</MediaPlaceholder>
	);

	return (
		<div { ...blockProps }>
			{ hasSource && (
				<BlockControls>
					<ToolbarGroup>
						<ToolbarButton onClick={ clearSource }>{ __( 'Replace' ) }</ToolbarButton>
						{ !! videoId && canCreate() && !! item && (
							<ToolbarButton onClick={ () => setEditing( true ) }>{ __( 'Edit' ) }</ToolbarButton>
						) }
					</ToolbarGroup>
				</BlockControls>
			) }

			<InspectorControls>
				{ !! videoId && (
					<PanelBody title={ brand() }>
						{ !! videoId && (
							<>
								<SelectControl
									__nextHasNoMarginBottom
									label={ __( 'Saved video' ) }
									value={ videoId }
									options={ libraryOptions }
									onChange={ ( v ) => set( { videoId: parseInt( v, 10 ) || 0 } ) }
								/>
								{ canCreate() && !! item && (
									<Button variant="secondary" style={ { marginTop: 12 } } onClick={ () => setEditing( true ) }>
										{ __( 'Edit' ) }
									</Button>
								) }
								{ !! item && !! editUrl( item.id ) && (
									<p style={ { marginTop: 12, marginBottom: 0, fontSize: 12, color: '#757575' } }>
										<a href={ editUrl( item.id ) } target="_blank" rel="noreferrer">
											{ sprintf(
												/* translators: %s: product name, e.g. TruePlayer. */
												__( 'Open in %s' ),
												brand()
											) }
										</a>
										{ ' — ' }
										{ __( 'chapters, appearance and more.' ) }
									</p>
								) }
							</>
						) }
					</PanelBody>
				) }

				{ hasSource && (
					<>
						{ inline && (
						<PanelBody title={ __( 'Source' ) } initialOpen>
							<TextControl
								__nextHasNoMarginBottom
								label={ sprintf(
									/* translators: %s: source type, e.g. YouTube. */
									__( 'Link (%s)' ),
									{ self: __( 'Your file' ), youtube: 'YouTube', vimeo: 'Vimeo', url: __( 'Media URL' ) }[ sourceType ] || sourceType
								) }
								value={ src }
								onChange={ ( v ) => set( { src: v, sourceType: detectSourceType( v ), mediaId: 0 } ) }
							/>
							<TextControl
								__nextHasNoMarginBottom
								style={ { marginTop: 12 } }
								label={ __( 'Title' ) }
								help={ __( 'Used as the accessible name and for search engines.' ) }
								value={ attributes.title }
								onChange={ ( v ) => set( { title: v } ) }
							/>
							<MediaUploadCheck>
								<div style={ { marginTop: 12 } }>
									<MediaUpload
										allowedTypes={ [ 'image' ] }
										onSelect={ ( m ) => set( { poster: m.url || '' } ) }
										render={ ( { open } ) => (
											<Flex justify="flex-start" gap={ 2 }>
												<Button variant="secondary" onClick={ open }>
													{ attributes.poster ? __( 'Change poster' ) : __( 'Set poster image' ) }
												</Button>
												{ !! attributes.poster && (
													<Button variant="tertiary" isDestructive onClick={ () => set( { poster: '' } ) }>
														{ __( 'Remove' ) }
													</Button>
												) }
											</Flex>
										) }
									/>
								</div>
							</MediaUploadCheck>
						</PanelBody>
						) }

						<PanelBody title={ __( 'Playback' ) } initialOpen={ false }>
							<SelectControl
								__nextHasNoMarginBottom
								label={ __( 'Autoplay' ) }
								value={ attributes.autoplayMode }
								options={ AUTOPLAY }
								onChange={ ( v ) => set( { autoplayMode: v } ) }
							/>
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Start muted' ) }
								checked={ attributes.muted }
								onChange={ ( v ) => set( { muted: v } ) }
							/>
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Loop' ) }
								checked={ attributes.loop }
								onChange={ ( v ) => set( { loop: v } ) }
							/>
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Show playback controls' ) }
								checked={ attributes.controls }
								onChange={ ( v ) => set( { controls: v } ) }
							/>
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Resume where the viewer left off' ) }
								checked={ attributes.resume }
								onChange={ ( v ) => set( { resume: v } ) }
							/>
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Allow download' ) }
								checked={ attributes.download }
								onChange={ ( v ) => set( { download: v } ) }
							/>
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Float when scrolled out of view' ) }
								checked={ attributes.sticky }
								onChange={ ( v ) => set( { sticky: v } ) }
							/>
						</PanelBody>

						<PanelBody title={ __( 'Look' ) } initialOpen={ false }>
							{ inline && presetOptions.length > 1 && (
								<SelectControl
									__nextHasNoMarginBottom
									label={ __( 'Saved preset' ) }
									help={ __( 'Your own settings below still win over the preset.' ) }
									value={ attributes.presetId }
									options={ presetOptions }
									onChange={ ( v ) => set( { presetId: parseInt( v, 10 ) || 0 } ) }
								/>
							) }
							{ ! audio && (
								<>
									<SelectControl
										__nextHasNoMarginBottom
										label={ __( 'Skin' ) }
										value={ attributes.skin }
										options={ SKINS }
										onChange={ ( v ) => set( { skin: v } ) }
									/>
									<SelectControl
										__nextHasNoMarginBottom
										label={ __( 'Aspect ratio' ) }
										value={ attributes.aspectRatio }
										options={ ASPECTS }
										onChange={ ( v ) => set( { aspectRatio: v } ) }
									/>
								</>
							) }
							<p style={ { margin: '12px 0 4px' } }>{ __( 'Accent colour' ) }</p>
							<ColorPalette
								colors={ [
									{ name: 'Indigo', color: '#4f46e5' },
									{ name: 'Blue', color: '#2563eb' },
									{ name: 'Green', color: '#16a34a' },
									{ name: 'Orange', color: '#ea580c' },
									{ name: 'Red', color: '#dc2626' },
									{ name: 'Black', color: '#111827' },
								] }
								value={ attributes.accent || undefined }
								onChange={ ( v ) => set( { accent: v || '' } ) }
								clearable
							/>
						</PanelBody>

						<PanelBody title={ __( 'Chapters & description' ) } initialOpen={ false }>
							<TextareaControl
								__nextHasNoMarginBottom
								label={ __( 'Chapters' ) }
								help={ __( 'One per line, e.g. 0:00 Intro. Paste them straight from a YouTube description.' ) }
								rows={ 5 }
								value={ attributes.chapters }
								onChange={ ( v ) => set( { chapters: v } ) }
							/>
							<TextareaControl
								__nextHasNoMarginBottom
								style={ { marginTop: 12 } }
								label={ __( 'Description under the player' ) }
								help={ __( 'Basic HTML allowed.' ) }
								rows={ 4 }
								value={ attributes.description }
								onChange={ ( v ) => set( { description: v } ) }
							/>
						</PanelBody>

						{ inline && 'self' === sourceType && (
							<PanelBody title={ __( 'Captions' ) } initialOpen={ false }>
								<TextControl
									__nextHasNoMarginBottom
									label={ __( 'WebVTT file URL' ) }
									value={ attributes.captionUrl }
									onChange={ ( v ) => set( { captionUrl: v } ) }
								/>
								<MediaUploadCheck>
									<MediaUpload
										onSelect={ ( m ) => set( { captionUrl: m.url || '' } ) }
										render={ ( { open } ) => (
											<Button variant="secondary" style={ { margin: '8px 0 12px' } } onClick={ open }>
												{ __( 'Choose .vtt file' ) }
											</Button>
										) }
									/>
								</MediaUploadCheck>
								{ !! attributes.captionUrl && (
									<Flex gap={ 2 }>
										<FlexItem isBlock>
											<TextControl
												__nextHasNoMarginBottom
												label={ __( 'Label' ) }
												placeholder="English"
												value={ attributes.captionLabel }
												onChange={ ( v ) => set( { captionLabel: v } ) }
											/>
										</FlexItem>
										<FlexItem isBlock>
											<TextControl
												__nextHasNoMarginBottom
												label={ __( 'Language' ) }
												placeholder="en"
												value={ attributes.captionLang }
												onChange={ ( v ) => set( { captionLang: v } ) }
											/>
										</FlexItem>
									</Flex>
								) }
							</PanelBody>
						) }

						<PanelBody title={ __( 'Performance' ) } initialOpen={ false }>
							<SelectControl
								__nextHasNoMarginBottom
								label={ __( 'When to load the player' ) }
								value={ attributes.loadStrategy }
								options={ LOAD }
								onChange={ ( v ) => set( { loadStrategy: v } ) }
							/>
							<SelectControl
								__nextHasNoMarginBottom
								label={ __( 'Preload' ) }
								value={ attributes.preload }
								options={ PRELOAD }
								onChange={ ( v ) => set( { preload: v } ) }
							/>
						</PanelBody>
					</>
				) }

				{ inline && (
					<PanelBody title={ __( 'More options' ) } initialOpen={ false }>
						<p style={ { margin: 0, fontSize: 12, color: '#757575' } }>
							{ __( 'Chapters, call-to-action overlays, email capture and quizzes live in the full editor. Save this as a video there to use them.' ) }
						</p>
					</PanelBody>
				) }
			</InspectorControls>

			{ /* The real player, full width. */ }
			{ hasSource && !! item && (
				<div style={ { position: 'relative' } }>
					{ needsNativeEmbed( item.config?.source ) ? (
						// YouTube and Vimeo cannot be driven inside the editor's blob
						// canvas, so they play in their own player here. See NativeEmbed.
						<NativeEmbed config={ item.config } title={ item.title } />
					) : (
						<div className="trueplayer-mount">
							<Player
								key={ `${ item.id }:${ bump }:${ JSON.stringify( item.config ) }` }
								videoId={ item.id }
								title={ item.title }
								config={ item.config }
								preview
							/>
						</div>
					) }
					{ /* Until the block is selected, a click should select it
					     rather than land on the player's own controls. */ }
					{ ! isSelected && (
						<div
							className="tp-block-preview-shield"
							style={ { position: 'absolute', inset: 0, zIndex: 10 } }
							aria-hidden="true"
						/>
					) }
				</div>
			) }

			{ /* Chosen, but the config hasn't arrived — or couldn't. */ }
			{ hasSource && ! item && ! libraryMissing && (
				<Placeholder icon="format-video" label={ brand() }>
					{ itemError ? (
						<Notice status="error" isDismissible={ false }>
							{ itemError }
						</Notice>
					) : (
						<Spinner />
					) }
					{ !! itemError && (
						<Button variant="secondary" onClick={ clearSource }>
							{ __( 'Choose something else' ) }
						</Button>
					) }
				</Placeholder>
			) }

			{ /* Nothing chosen yet, or the saved video is gone. */ }
			{ ( ! hasSource || libraryMissing ) && (
				<>
					{ libraryMissing && (
						<Notice status="warning" isDismissible={ false }>
							{ __( 'That video is no longer in your library. Choose another one.' ) }
						</Notice>
					) }

					{ sourcePicker }

					<div style={ { marginTop: 8 } }>
						{ ! showLibrary && (
							<Button variant="link" onClick={ () => setShowLibrary( true ) }>
								{ __( 'Use a saved video instead' ) }
							</Button>
						) }
						{ showLibrary && null !== videos && (
							<div style={ { maxWidth: 360 } }>
								<SelectControl
									__nextHasNoMarginBottom
									label={ __( 'Saved video' ) }
									value={ videoId }
									options={ libraryOptions }
									onChange={ ( v ) => set( { videoId: parseInt( v, 10 ) || 0, src: '' } ) }
								/>
								{ 0 === videos.length && (
									<p style={ { fontSize: 12, color: '#757575' } }>{ __( 'No saved videos yet.' ) }</p>
								) }
							</div>
						) }
						{ showLibrary && null === videos && <Spinner /> }
					</div>
				</>
			) }

			{ editing && !! videoId && (
				<VideoModal video={ item } onClose={ () => setEditing( false ) } onSaved={ savedLibrary } />
			) }
		</div>
	);
}
