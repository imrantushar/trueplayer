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
 * Variation switching and alignment are WordPress's own toolbar controls
 * (block.json declares both). Everything else — the empty state, the Replace
 * menu and the sidebar sections — is drawn from the block design with the
 * small kit in ui.jsx. The player's own stylesheet is enqueued into the canvas
 * iframe by PHP (Block::canvas_assets) and deliberately never imported here —
 * see that method for why.
 */
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import {
	useBlockProps,
	InspectorControls,
	BlockControls,
	MediaUpload,
	MediaUploadCheck,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { Dropdown, MenuGroup, MenuItem, Notice, Placeholder, Spinner, ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { __, _n, sprintf } from '@Utils/translation';
import Player from '@Player/Player';
import NativeEmbed, { needsNativeEmbed } from './NativeEmbed';
import VideoModal from './VideoModal';
import SavedModal from './SavedModal';
import { TruePlayerIcon } from './icon';
import { Check, Help, Label, Pills, RadioCards, Section, Segmented, Styles, Toggle } from './ui';
import {
	brand,
	canCreate,
	detectSourceType,
	editUrl,
	fetchBlockPreview,
	fetchVideos,
	presets,
	previewAttributes,
	typeLabel,
} from './data';

const ASPECTS = [
	[ '', __( 'Site default' ) ],
	[ '16:9', '16:9' ],
	[ '9:16', '9:16' ],
	[ '4:3', '4:3' ],
	[ '1:1', '1:1' ],
	[ '21:9', '21:9' ],
	[ 'auto', __( 'Match the video' ) ],
];

const SKINS = [
	[ '', __( 'Site default' ) ],
	[ 'default', __( 'Default' ) ],
	[ 'modern', __( 'Modern' ) ],
	[ 'simple', __( 'Simple' ) ],
	[ 'minimal', __( 'Minimal' ) ],
	[ 'standard', __( 'Standard' ) ],
];

/** How each skin draws its control bar in the little swatch: inset, height, radius, background. */
const SKIN_BAR = {
	default: { l: 0, b: 0, h: 14, r: 0, bg: 'linear-gradient(transparent,rgba(0,0,0,.7))' },
	modern: { l: 4, b: 4, h: 10, r: 5, bg: 'rgba(255,255,255,.55)' },
	simple: { l: 0, b: 0, h: 8, r: 0, bg: 'rgba(255,255,255,.55)' },
	minimal: { l: 0, b: 0, h: 2, r: 0, bg: '#fff' },
	standard: { l: 0, b: 0, h: 10, r: 0, bg: '#fff' },
};

const AUTOPLAY = [
	[ '', __( 'Default' ) ],
	[ 'off', __( 'Off' ) ],
	[ 'muted', __( 'Muted' ) ],
	[ 'sound', __( 'With sound' ) ],
];

const AUTOPLAY_HINT = {
	'': __( 'Uses the site-wide setting.' ),
	off: __( 'The viewer presses play.' ),
	muted: __( 'Starts automatically with the sound off. Works in every browser.' ),
	sound: __( 'Browsers often block autoplay with sound until the viewer has interacted with the page.' ),
};

const PRELOAD = [
	[ '', __( 'Default' ) ],
	[ 'metadata', __( 'Metadata' ) ],
	[ 'auto', __( 'Whole file' ) ],
	[ 'none', __( 'Nothing' ) ],
];

const LOAD = [
	{ value: '', label: __( 'Site default' ) },
	{ value: 'facade', label: __( 'Click to load (fastest page)' ) },
	{ value: 'onvisible', label: __( 'Load when scrolled into view' ) },
	{ value: 'eager', label: __( 'Load immediately' ) },
];

const ACCENTS = [
	[ __( 'Indigo' ), '#4f46e5' ],
	[ __( 'Blue' ), '#2563eb' ],
	[ __( 'Green' ), '#16a34a' ],
	[ __( 'Orange' ), '#ea580c' ],
	[ __( 'Black' ), '#111827' ],
];

const CAPTION_LANGS = [
	[ 'en', __( 'English' ) ],
	[ 'es', __( 'Spanish' ) ],
	[ 'fr', __( 'French' ) ],
	[ 'de', __( 'German' ) ],
	[ 'bn', __( 'Bengali' ) ],
];

/** What the empty card says and asks for, per the kind of block it is. */
const WANT = {
	video: {
		desc: __( 'A fast video and audio player. Upload a file or paste a YouTube, Vimeo or media link.' ),
		label: __( 'Or paste a link' ),
		ph: __( 'YouTube, Vimeo or media URL' ),
	},
	audio: {
		desc: __( 'Upload an audio file, drop one here, or paste a link.' ),
		label: __( 'Or paste a link' ),
		ph: 'https://example.com/episode.mp3',
	},
	youtube: { desc: __( 'Paste a YouTube link.' ), label: __( 'Link' ), ph: 'https://youtube.com/watch?v=' },
	vimeo: { desc: __( 'Paste a Vimeo link.' ), label: __( 'Link' ), ph: 'https://vimeo.com/' },
};

/** Waits for a value to stop changing, so typing doesn't fire a request per key. */
function useDebounced( value, ms = 350 ) {
	const [ v, setV ] = useState( value );
	useEffect( () => {
		const t = setTimeout( () => setV( value ), ms );
		return () => clearTimeout( t );
	}, [ value, ms ] );
	return v;
}

/** The same line shape the server parses (Block::parse_chapters); only counts, never saves. */
function countChapters( text ) {
	let found = 0;
	let skipped = 0;
	( text || '' ).split( /\r?\n/ ).forEach( ( line ) => {
		if ( ! line.trim() ) {
			return;
		}
		if ( /^\s*\[?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]?\s*[-–—:]?\s*(.+?)\s*$/.test( line ) ) {
			found++;
		} else {
			skipped++;
		}
	} );
	return { found, skipped };
}

const fileLabel = ( src ) => {
	try {
		return decodeURIComponent( ( src || '' ).split( '?' )[ 0 ].split( '/' ).pop() ) || src;
	} catch ( e ) {
		return src;
	}
};

export default function Edit( { attributes, setAttributes, isSelected } ) {
	const { videoId, src, sourceType } = attributes;
	const inline = ! videoId && !! src;
	const blockProps = useBlockProps();
	const mediaUpload = useSelect( ( select ) => select( blockEditorStore ).getSettings().mediaUpload, [] );
	const fileInput = useRef( null );

	const [ videos, setVideos ] = useState( null ); // null until asked for.
	const [ savedOpen, setSavedOpen ] = useState( false );
	const [ editing, setEditing ] = useState( false );
	const [ draftUrl, setDraftUrl ] = useState( '' );
	const [ linkErr, setLinkErr ] = useState( '' );
	const [ uploading, setUploading ] = useState( false );

	// The render-ready payload for the preview, from either mode.
	const [ item, setItem ] = useState( null );
	const [ itemError, setItemError ] = useState( '' );
	const [ bump, setBump ] = useState( 0 );

	// Until the preview arrives a saved video's media type is unknown.
	const audio = 'audio' === attributes.mediaType || 'audio' === item?.config?.source?.mediaType;

	// The library is only fetched when it is needed — an attribute-only block
	// never asks for it.
	useEffect( () => {
		if ( ! savedOpen && ! videoId ) {
			return undefined;
		}
		let live = true;
		fetchVideos()
			.then( ( list ) => live && setVideos( Array.isArray( list ) ? list : [] ) )
			.catch( () => live && setVideos( [] ) );
		return () => {
			live = false;
		};
	}, [ savedOpen, videoId ] );

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

	const providerOnly = [ 'youtube', 'vimeo' ].includes( sourceType ) && ! src;
	const want = audio ? 'audio' : providerOnly ? sourceType : 'video';
	const providerName = 'youtube' === sourceType ? 'YouTube' : 'Vimeo';

	const applyLink = () => {
		const url = draftUrl.trim();
		if ( ! url ) {
			setLinkErr( __( 'Choose a file or paste a link first.' ) );
			return;
		}
		if ( ! /^https?:\/\//i.test( url ) ) {
			setLinkErr( __( 'Paste a full link starting with https://' ) );
			return;
		}
		const detected = detectSourceType( url );
		if ( providerOnly && detected !== sourceType ) {
			setLinkErr( sprintf( /* translators: %s: YouTube or Vimeo. */ __( 'That is not a %s link.' ), providerName ) );
			return;
		}
		set( {
			videoId: 0,
			src: url,
			sourceType: detected,
			mediaId: 0,
			// A link to an audio file says what it is, the way a picked file does.
			mediaType: /\.(mp3|m4a|wav|ogg|aac)($|\?)/i.test( url ) ? 'audio' : attributes.mediaType,
		} );
		setDraftUrl( '' );
		setLinkErr( '' );
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

	const clearSource = () => {
		set( { videoId: 0, src: '', sourceType: '', mediaId: 0, poster: '', captionUrl: '' } );
		setLinkErr( '' );
	};

	const chooseSaved = ( video ) => {
		set( { videoId: video.id, src: '', sourceType: '', mediaId: 0, title: '', poster: '', captionUrl: '' } );
		setSavedOpen( false );
	};

	// Upload straight from the block: the editor's own uploader, so permissions,
	// size limits and the media library entry all behave as they do everywhere.
	const startUpload = () => fileInput.current?.click();

	const onFilePicked = ( e ) => {
		const files = Array.from( e.target.files || [] ).slice( 0, 1 );
		e.target.value = '';
		if ( ! files.length || ! mediaUpload ) {
			return;
		}
		setUploading( true );
		setLinkErr( '' );
		mediaUpload( {
			allowedTypes: audio ? [ 'audio' ] : [ 'video', 'audio' ],
			filesList: files,
			onFileChange: ( [ media ] ) => {
				// The first call carries a temporary blob; wait for the saved file.
				if ( media && media.id && ! ( media.url || '' ).startsWith( 'blob:' ) ) {
					applyFile( media );
					setUploading( false );
				}
			},
			onError: ( message ) => {
				setUploading( false );
				setLinkErr( typeof message === 'string' ? message : message?.message || __( 'That file could not be uploaded.' ) );
			},
		} );
	};

	const libraryMissing = !! videoId && null !== videos && ! videos.some( ( v ) => v.id === videoId ) && !! itemError;
	const hasSource = !! videoId || !! src;
	const ready = hasSource && ! libraryMissing;
	const showEmpty = ! ready || uploading;

	const canEditSaved = !! videoId && canCreate() && !! item;
	const canEdit = inline || canEditSaved;

	const savedVideo = ( videos || [] ).find( ( v ) => v.id === videoId );
	const displayName = inline ? attributes.title || fileLabel( src ) : item?.title || savedVideo?.title || '';
	const srcType = inline ? sourceType : item?.config?.source?.type;

	const savedUpdated = ( video ) => {
		setVideos( ( list ) => [ video, ...( list || [] ).filter( ( v ) => v.id !== video.id ) ] );
		set( { videoId: video.id } );
		setEditing( false );
		setBump( ( b ) => b + 1 );
	};

	const presetOptions = presets().filter( ( p ) => ( 'audio' === p.type ) === audio );
	const chapters = countChapters( attributes.chapters );
	const accent = attributes.accent;
	const canPreload = ! [ 'youtube', 'vimeo' ].includes( srcType );
	const canCaptions = inline && 'self' === sourceType && ! audio;
	const openInTP = !! item && !! editUrl( item.id ) ? editUrl( item.id ) : '';

	const toggle = ( key, label, hint ) => (
		<Toggle key={ key } label={ label } hint={ hint } checked={ attributes[ key ] } onChange={ ( v ) => set( { [ key ]: v } ) } />
	);

	const linkRow = (
		<>
			<span className="tpb-label" style={ { fontWeight: 500, color: '#344054' } }>{ WANT[ want ].label }</span>
			<div style={ { display: 'flex', gap: 8, maxWidth: 520 } }>
				<input
					className={ `tpb-input tpb-input--lg${ linkErr ? ' tpb-input--err' : '' }` }
					aria-label={ WANT[ want ].label }
					value={ draftUrl }
					placeholder={ WANT[ want ].ph }
					onChange={ ( e ) => {
						setDraftUrl( e.target.value );
						setLinkErr( '' );
					} }
					onKeyDown={ ( e ) => 'Enter' === e.key && applyLink() }
				/>
				<button type="button" className="tpb-btn tpb-btn--lg" onClick={ applyLink }>
					{ __( 'Use link' ) }
				</button>
			</div>
			{ !! linkErr && <div className="tpb-err" role="alert">{ linkErr }</div> }
		</>
	);

	const posterThumb = (
		<span
			className="tpb-thumb"
			style={ {
				width: 72,
				height: 44,
				backgroundImage: attributes.poster ? `url(${ attributes.poster })` : undefined,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
			} }
		/>
	);

	return (
		<div { ...blockProps }>
			<input
				ref={ fileInput }
				type="file"
				hidden
				accept={ audio ? 'audio/*' : 'video/*,audio/*' }
				onChange={ onFilePicked }
			/>

			{ ready && (
				<BlockControls>
					<ToolbarGroup>
						<Dropdown
							popoverProps={ { placement: 'bottom-start' } }
							renderToggle={ ( { isOpen, onToggle } ) => (
								<ToolbarButton onClick={ onToggle } aria-expanded={ isOpen } icon={ null }>
									{ __( 'Replace' ) }
									<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={ { marginLeft: 4 } }>
										<path d="M7.4 8.6L12 13.2l4.6-4.6L18 10l-6 6-6-6z" />
									</svg>
								</ToolbarButton>
							) }
							renderContent={ ( { onClose } ) => (
								<MenuGroup>
									<MenuItem onClick={ () => { onClose(); startUpload(); } }>{ __( 'Upload a file' ) }</MenuItem>
									<MenuItem onClick={ () => { onClose(); setSavedOpen( true ); } }>{ __( 'Choose a saved video' ) }</MenuItem>
									<MenuItem isDestructive onClick={ () => { onClose(); clearSource(); } }>{ __( 'Remove' ) }</MenuItem>
								</MenuGroup>
							) }
						/>
						{ canEdit && <ToolbarButton onClick={ () => setEditing( true ) }>{ __( 'Edit' ) }</ToolbarButton> }
					</ToolbarGroup>
				</BlockControls>
			) }

			<InspectorControls>
				<Styles />
				<div className="tpb">
					{ ! ready && (
						<div style={ { padding: '32px 24px', textAlign: 'center' } }>
							<div style={ { fontSize: 15, fontWeight: 500, marginBottom: 4 } }>{ __( 'No source yet' ) }</div>
							<div style={ { fontSize: 12, color: '#646C73', lineHeight: 1.5 } }>
								{ __( 'Choose a file or paste a link in the block to see playback and appearance options.' ) }
							</div>
						</div>
					) }

					{ ready && (
						<>
							<Section title={ __( 'Source' ) } initialOpen>
								<div className="tpb-media">
									<span className="tpb-thumb" style={ { width: 64, height: 40 } }>
										<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
											<path d={ audio ? 'M12 3v10.55A4 4 0 1014 17V7h4V3h-6z' : 'M8 5v14l11-7z' } />
										</svg>
									</span>
									<span style={ { minWidth: 0, flex: 1 } }>
										<span style={ { display: 'block', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>{ displayName }</span>
										<span style={ { display: 'block', fontSize: 12, color: '#646C73' } }>
											{ inline ? typeLabel( sourceType ) : sprintf( /* translators: %s: source type, e.g. YouTube. */ __( 'Saved video · %s' ), typeLabel( srcType ) ) }
										</span>
									</span>
								</div>

								{ inline && (
									<>
										<div className="tpb-mono" style={ { marginTop: 6, fontSize: 11, color: '#646C73', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>{ src }</div>
										<div style={ { display: 'flex', gap: 8, marginTop: 10 } }>
											<MediaUploadCheck>
												<MediaUpload
													allowedTypes={ audio ? [ 'audio' ] : [ 'video', 'audio' ] }
													value={ attributes.mediaId || undefined }
													onSelect={ applyFile }
													render={ ( { open } ) => (
														<button type="button" className="tpb-btn" style={ { flex: 1 } } onClick={ open }>{ __( 'Replace' ) }</button>
													) }
												/>
											</MediaUploadCheck>
											<button type="button" className="tpb-btn" style={ { flex: 1 } } onClick={ () => setEditing( true ) }>{ __( 'Edit' ) }</button>
										</div>
									</>
								) }

								{ ! inline && (
									<>
										<Help>{ __( 'This block shows a video from your library. Settings below apply on this page only.' ) }</Help>
										<div style={ { display: 'flex', gap: 8, marginTop: 10 } }>
											<button type="button" className="tpb-btn" style={ { flex: '1 1 0' } } onClick={ () => setSavedOpen( true ) }>{ __( 'Choose something else' ) }</button>
											{ !! openInTP && (
												<a className="tpb-btn" style={ { flex: '1 1 0', textDecoration: 'none' } } href={ openInTP } target="_blank" rel="noreferrer">
													{ sprintf( /* translators: %s: product name, e.g. TruePlayer. */ __( 'Open in %s' ), brand() ) }
												</a>
											) }
										</div>
									</>
								) }

								{ inline && (
									<>
										<Label gap>{ __( 'Title' ) }</Label>
										<input
											className="tpb-input"
											aria-label={ __( 'Title' ) }
											value={ attributes.title }
											placeholder={ fileLabel( src ) }
											onChange={ ( e ) => set( { title: e.target.value } ) }
										/>
										<Help>{ __( 'Used as the accessible name and for search engines.' ) }</Help>

										{ ! audio && (
											<>
												<Label gap>{ __( 'Poster' ) }</Label>
												<MediaUploadCheck>
													<MediaUpload
														allowedTypes={ [ 'image' ] }
														onSelect={ ( m ) => set( { poster: m.url || '' } ) }
														render={ ( { open } ) =>
															attributes.poster ? (
																<div style={ { display: 'flex', flexWrap: 'wrap', gap: '8px 10px', alignItems: 'center' } }>
																	{ posterThumb }
																	<button type="button" className="tpb-btn" onClick={ open }>{ __( 'Change poster' ) }</button>
																	<button type="button" className="tpb-btn tpb-btn--danger" onClick={ () => set( { poster: '' } ) }>{ __( 'Remove' ) }</button>
																</div>
															) : (
																<button type="button" className="tpb-btn tpb-btn--dashed" onClick={ open }>{ __( 'Set poster image' ) }</button>
															)
														}
													/>
												</MediaUploadCheck>
											</>
										) }
									</>
								) }
							</Section>

							<Section title={ __( 'Playback' ) } initialOpen>
								<Label>{ __( 'Autoplay' ) }</Label>
								<Segmented label={ __( 'Autoplay' ) } value={ attributes.autoplayMode } options={ AUTOPLAY } onChange={ ( v ) => set( { autoplayMode: v } ) } />
								<Help>{ AUTOPLAY_HINT[ attributes.autoplayMode ] }</Help>
								<div style={ { marginTop: 8 } }>
									{ toggle( 'muted', __( 'Start muted' ) ) }
									{ toggle( 'loop', __( 'Loop' ) ) }
									{ toggle( 'controls', __( 'Show playback controls' ), __( 'Off keeps only the play button.' ) ) }
									{ toggle( 'resume', __( 'Resume where the viewer left off' ) ) }
									{ toggle( 'download', __( 'Allow download' ) ) }
									{ toggle( 'sticky', __( 'Float when scrolled out of view' ) ) }
								</div>
							</Section>

							<Section title={ __( 'Look' ) } initialOpen>
								{ inline && presetOptions.length > 0 && (
									<>
										<Label>{ __( 'Saved preset' ) }</Label>
										<select
											className="tpb-input"
											aria-label={ __( 'Saved preset' ) }
											value={ attributes.presetId }
											onChange={ ( e ) => set( { presetId: parseInt( e.target.value, 10 ) || 0 } ) }
										>
											<option value={ 0 }>{ __( 'None' ) }</option>
											{ presetOptions.map( ( p ) => (
												<option key={ p.id } value={ p.id }>{ p.title }</option>
											) ) }
										</select>
										{ !! attributes.presetId && <Help>{ __( 'Your own settings below still win over the preset.' ) }</Help> }
									</>
								) }

								{ ! audio && (
									<>
										<Label gap>{ __( 'Skin' ) }</Label>
										<div role="radiogroup" aria-label={ __( 'Skin' ) } style={ { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 } }>
											{ SKINS.map( ( [ value, label ] ) => {
												const bar = SKIN_BAR[ value || 'default' ];
												return (
													<button key={ value } type="button" role="radio" aria-checked={ attributes.skin === value } className="tpb-skin" onClick={ () => set( { skin: value } ) }>
														<span style={ { display: 'block', height: 34, borderRadius: 4, background: '#1B2330', position: 'relative', overflow: 'hidden' } }>
															<span style={ { position: 'absolute', left: bar.l, right: bar.l, bottom: bar.b, height: bar.h, borderRadius: bar.r, background: bar.bg } } />
														</span>
														<span style={ { display: 'block', fontSize: 12, fontWeight: 500, marginTop: 6 } }>{ label }</span>
													</button>
												);
											} ) }
										</div>

										<Label gap>{ __( 'Aspect ratio' ) }</Label>
										<Pills label={ __( 'Aspect ratio' ) } value={ attributes.aspectRatio } options={ ASPECTS } onChange={ ( v ) => set( { aspectRatio: v } ) } />
									</>
								) }

								<Label gap>{ __( 'Accent colour' ) }</Label>
								<div role="radiogroup" aria-label={ __( 'Accent colour' ) } style={ { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' } }>
									<button
										type="button"
										role="radio"
										aria-checked={ ! accent }
										aria-label={ __( 'Site default' ) }
										title={ __( 'Site default' ) }
										className="tpb-sw"
										style={ { background: 'repeating-linear-gradient(135deg,#E0E4E8 0 4px,#fff 4px 8px)' } }
										onClick={ () => set( { accent: '' } ) }
									>
										{ ! accent && <Check color="#141A24" /> }
									</button>
									{ ACCENTS.map( ( [ name, color ] ) => (
										<button
											key={ color }
											type="button"
											role="radio"
											aria-checked={ accent === color }
											aria-label={ name }
											title={ name }
											className="tpb-sw"
											style={ { background: color } }
											onClick={ () => set( { accent: color } ) }
										>
											{ accent === color && <Check /> }
										</button>
									) ) }
									<label className="tpb-sw tpb-sw--custom" title={ __( 'Custom colour' ) }>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
											<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
										</svg>
										<input type="color" aria-label={ __( 'Custom colour' ) } value={ /^#[0-9a-f]{6}$/i.test( accent ) ? accent : '#4f46e5' } onChange={ ( e ) => set( { accent: e.target.value } ) } />
									</label>
								</div>
								<Help>
									{ accent
										? `${ ( ACCENTS.find( ( a ) => a[ 1 ] === accent ) || [ __( 'Custom' ) ] )[ 0 ] } · ${ accent }`
										: __( 'Site default' ) }
								</Help>
							</Section>

							<Section title={ __( 'Chapters & description' ) } badge={ chapters.found || '' }>
								<Label>{ __( 'Chapters' ) }</Label>
								<textarea
									className="tpb-input tpb-mono"
									aria-label={ __( 'Chapters' ) }
									rows={ 5 }
									placeholder="0:00 Intro"
									value={ attributes.chapters }
									onChange={ ( e ) => set( { chapters: e.target.value } ) }
								/>
								<Help>{ __( 'One per line, e.g. 0:00 Intro. Paste them straight from a YouTube description.' ) }</Help>
								{ chapters.found > 0 && (
									<div style={ { fontSize: 12, color: '#166534', marginTop: 6, fontWeight: 500 } }>
										{ sprintf( /* translators: %d: number of chapters. */ __( '%d chapters detected' ), chapters.found ) }
										{ chapters.skipped > 0 && ` · ${ sprintf( /* translators: %d: number of lines. */ _n( '%d line skipped', '%d lines skipped', chapters.skipped ), chapters.skipped ) }` }
									</div>
								) }
								<Label gap>{ __( 'Description under the player' ) }</Label>
								<textarea
									className="tpb-input"
									aria-label={ __( 'Description under the player' ) }
									rows={ 3 }
									value={ attributes.description }
									onChange={ ( e ) => set( { description: e.target.value } ) }
								/>
								<Help>{ __( 'Basic HTML allowed.' ) }</Help>
							</Section>

							{ canCaptions && (
								<Section title={ __( 'Captions' ) }>
									<Label>{ __( 'WebVTT file URL' ) }</Label>
									<input
										className="tpb-input"
										aria-label={ __( 'WebVTT file URL' ) }
										placeholder="https://"
										value={ attributes.captionUrl }
										onChange={ ( e ) => set( { captionUrl: e.target.value } ) }
									/>
									<MediaUploadCheck>
										<MediaUpload
											onSelect={ ( m ) => set( { captionUrl: m.url || '' } ) }
											render={ ( { open } ) => (
												<button type="button" className="tpb-btn" style={ { marginTop: 8 } } onClick={ open }>{ __( 'Choose .vtt file' ) }</button>
											) }
										/>
									</MediaUploadCheck>
									<div style={ { display: 'flex', gap: 8, marginTop: 16 } }>
										<div style={ { flex: 1 } }>
											<Label>{ __( 'Label' ) }</Label>
											<input
												className="tpb-input"
												aria-label={ __( 'Label' ) }
												placeholder="English"
												value={ attributes.captionLabel }
												onChange={ ( e ) => set( { captionLabel: e.target.value } ) }
											/>
										</div>
										<div style={ { flex: 1 } }>
											<Label>{ __( 'Language' ) }</Label>
											<select
												className="tpb-input"
												aria-label={ __( 'Language' ) }
												value={ attributes.captionLang || 'en' }
												onChange={ ( e ) => set( { captionLang: e.target.value } ) }
											>
												{ CAPTION_LANGS.map( ( [ code, name ] ) => (
													<option key={ code } value={ code }>{ name }</option>
												) ) }
											</select>
										</div>
									</div>
								</Section>
							) }

							<Section title={ __( 'Performance' ) }>
								<Label>{ __( 'When to load the player' ) }</Label>
								<RadioCards label={ __( 'When to load the player' ) } value={ attributes.loadStrategy } options={ LOAD } onChange={ ( v ) => set( { loadStrategy: v } ) } />
								{ canPreload && (
									<>
										<Label gap>{ __( 'Preload' ) }</Label>
										<Segmented label={ __( 'Preload' ) } value={ attributes.preload } options={ PRELOAD } onChange={ ( v ) => set( { preload: v } ) } />
									</>
								) }
							</Section>

							<div style={ { padding: 16, fontSize: 12, color: '#646C73', lineHeight: 1.5 } }>
								{ __( 'Chapters, call-to-action overlays, email capture and quizzes live in the full editor. Save this as a video there to use them.' ) }
							</div>
						</>
					) }
				</div>
			</InspectorControls>

			{ /* The real player, full width. */ }
			{ ready && ! uploading && !! item && (
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
			{ ready && ! uploading && ! item && (
				<Placeholder icon="format-video" label={ brand() }>
					{ itemError ? (
						<Notice status="error" isDismissible={ false }>
							{ itemError }
						</Notice>
					) : (
						<Spinner />
					) }
					{ !! itemError && (
						<button type="button" className="tpb-btn" onClick={ clearSource }>
							{ __( 'Choose something else' ) }
						</button>
					) }
				</Placeholder>
			) }

			{ /* Nothing chosen yet, an upload in flight, or the saved video is gone. */ }
			{ showEmpty && (
				<div className="tpb">
					<Styles />
					{ libraryMissing && (
						<Notice status="warning" isDismissible={ false }>
							{ __( 'That video is no longer in your library. Choose another one.' ) }
						</Notice>
					) }
					<div className="tpb-empty">
						<div style={ { display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, marginBottom: 6 } }>
							<TruePlayerIcon size={ 22 } />
							{ brand() }
						</div>
						<div style={ { fontSize: 13, color: '#434A51', marginBottom: 20 } }>{ WANT[ want ].desc }</div>

						{ uploading ? (
							<>
								<div style={ { marginBottom: 8, fontSize: 13, color: '#434A51' } }>{ __( 'Uploading…' ) }</div>
								<div className="tpb-bar" role="progressbar" aria-label={ __( 'Uploading…' ) } />
							</>
						) : (
							<>
								{ ( 'video' === want || 'audio' === want ) && (
									<div style={ { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 } }>
										<button type="button" className="tpb-btn tpb-btn--lg tpb-btn--primary" onClick={ startUpload }>
											<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.5 15v3.5H5.7V15H4v3.5A1.7 1.7 0 005.7 20h12.8a1.7 1.7 0 001.7-1.5V15zM12 4L7.5 8.5l1.2 1.2 2.4-2.4V16h1.8V7.3l2.4 2.4 1.2-1.2z" /></svg>
											{ __( 'Upload' ) }
										</button>
										<MediaUploadCheck>
											<MediaUpload
												allowedTypes={ audio ? [ 'audio' ] : [ 'video', 'audio' ] }
												onSelect={ applyFile }
												render={ ( { open } ) => (
													<button type="button" className="tpb-btn tpb-btn--lg" onClick={ open }>{ __( 'Choose a file' ) }</button>
												) }
											/>
										</MediaUploadCheck>
										<button type="button" className="tpb-btn tpb-btn--lg" onClick={ () => setSavedOpen( true ) }>{ __( 'Use a saved video instead' ) }</button>
									</div>
								) }
								{ linkRow }
							</>
						) }
					</div>
				</div>
			) }

			{ savedOpen && <SavedModal videos={ videos } selected={ videoId } onPick={ chooseSaved } onClose={ () => setSavedOpen( false ) } /> }

			{ editing && inline && (
				<VideoModal
					inline={ { type: sourceType, src, mediaType: attributes.mediaType } }
					mediaType={ attributes.mediaType }
					onClose={ () => setEditing( false ) }
					onApply={ ( patch ) => {
						set( patch );
						setEditing( false );
					} }
				/>
			) }
			{ editing && ! inline && !! videoId && (
				<VideoModal video={ item } onClose={ () => setEditing( false ) } onSaved={ savedUpdated } />
			) }
		</div>
	);
}
