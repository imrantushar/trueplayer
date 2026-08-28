/**
 * The block's editor UI: the real player, at the size it will publish at.
 *
 * The canvas renders the same frontend player component the published page
 * does, fed by the same config pipeline (`videos/{id}/preview` runs the
 * shortcode's own `resolved_config`), so what an author arranges their post
 * around is what a visitor gets — not an approximation of it.
 *
 * The chrome around it is all @wordpress/components, so it inherits the
 * editor's styles. The player's own stylesheet is enqueued into the canvas
 * iframe by PHP (Block::canvas_assets) and deliberately never imported here —
 * see that method for why.
 */
import { useCallback, useEffect, useState } from '@wordpress/element';
import { useBlockProps, InspectorControls, BlockControls } from '@wordpress/block-editor';
import {
	Button,
	Flex,
	FlexItem,
	Notice,
	PanelBody,
	Placeholder,
	SelectControl,
	Spinner,
	ToolbarButton,
	ToolbarGroup,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import Player from '@Player/Player';
import VideoModal from './VideoModal';
import { brand, canCreate, editUrl, fetchPreview, fetchVideos } from './data';

export default function Edit( { attributes, setAttributes, isSelected } ) {
	const { videoId } = attributes;
	const blockProps = useBlockProps();

	const [ videos, setVideos ] = useState( null ); // null while loading.
	const [ loadError, setLoadError ] = useState( '' );
	const [ editing, setEditing ] = useState( null ); // null | 'create' | 'edit'

	// The selected video's render-ready payload, for the preview.
	const [ item, setItem ] = useState( null );
	const [ itemError, setItemError ] = useState( '' );

	useEffect( () => {
		let live = true;
		fetchVideos()
			.then( ( list ) => {
				if ( live ) {
					setVideos( Array.isArray( list ) ? list : [] );
				}
			} )
			.catch( ( e ) => {
				if ( live ) {
					setVideos( [] );
					setLoadError( e.message || __( 'The video library could not be loaded.', 'trueplayer' ) );
				}
			} );
		return () => {
			live = false;
		};
	}, [] );

	// `bump` lets a save re-request the config for the same id.
	const [ bump, setBump ] = useState( 0 );

	useEffect( () => {
		if ( ! videoId ) {
			setItem( null );
			setItemError( '' );
			return undefined;
		}
		let live = true;
		setItem( null );
		setItemError( '' );
		fetchPreview( videoId )
			.then( ( payload ) => {
				if ( live ) {
					setItem( payload );
				}
			} )
			.catch( ( e ) => {
				if ( live ) {
					setItemError( e.message || __( 'That video could not be loaded.', 'trueplayer' ) );
				}
			} );
		return () => {
			live = false;
		};
	}, [ videoId, bump ] );

	const select = useCallback(
		( value ) => setAttributes( { videoId: parseInt( value, 10 ) || 0 } ),
		[ setAttributes ]
	);

	const saved = useCallback(
		( video ) => {
			setVideos( ( list ) => {
				const rest = ( list || [] ).filter( ( v ) => v.id !== video.id );
				// Newest first, matching the order the server returns.
				return [ video, ...rest ];
			} );
			setAttributes( { videoId: video.id } );
			setEditing( null );
			// An edit keeps the same id, so the preview has to be asked again.
			setBump( ( b ) => b + 1 );
		},
		[ setAttributes ]
	);

	const listed = ( videos || [] ).find( ( v ) => v.id === videoId ) || null;
	const loading = null === videos;
	// A video that was deleted from the library after this block was placed.
	const missing = ! loading && !! videoId && ! listed && !! itemError;

	const options = [
		{ label: __( '— Select a video —', 'trueplayer' ), value: 0 },
	].concat( ( videos || [] ).map( ( v ) => ( { label: v.title, value: v.id } ) ) );

	const picker = (
		<SelectControl
			__nextHasNoMarginBottom
			label={ __( 'Video', 'trueplayer' ) }
			value={ videoId }
			options={ options }
			onChange={ select }
		/>
	);

	const createButton = canCreate() && (
		<Button variant={ videoId ? 'secondary' : 'primary' } onClick={ () => setEditing( 'create' ) }>
			{ __( 'Create new', 'trueplayer' ) }
		</Button>
	);

	return (
		<div { ...blockProps }>
			{ !! videoId && (
				<BlockControls>
					<ToolbarGroup>
						<ToolbarButton onClick={ () => select( 0 ) }>
							{ __( 'Replace', 'trueplayer' ) }
						</ToolbarButton>
						{ canCreate() && !! item && (
							<ToolbarButton onClick={ () => setEditing( 'edit' ) }>
								{ __( 'Edit', 'trueplayer' ) }
							</ToolbarButton>
						) }
					</ToolbarGroup>
				</BlockControls>
			) }

			<InspectorControls>
				<PanelBody title={ brand() }>
					{ picker }
					<Flex justify="flex-start" gap={ 2 } style={ { marginTop: '12px' } }>
						{ createButton && <FlexItem>{ createButton }</FlexItem> }
						{ canCreate() && !! item && (
							<FlexItem>
								<Button variant="secondary" onClick={ () => setEditing( 'edit' ) }>
									{ __( 'Edit', 'trueplayer' ) }
								</Button>
							</FlexItem>
						) }
					</Flex>
					{ !! item && !! editUrl( item.id ) && (
						<p style={ { marginTop: '12px', marginBottom: 0, fontSize: '12px', color: '#757575' } }>
							<a href={ editUrl( item.id ) } target="_blank" rel="noreferrer">
								{ sprintf(
									/* translators: %s: product name, e.g. TruePlayer. */
									__( 'Open in %s', 'trueplayer' ),
									brand()
								) }
							</a>
							{ ' — ' }
							{ __( 'gating, chapters, appearance and more.', 'trueplayer' ) }
						</p>
					) }
				</PanelBody>
			</InspectorControls>

			{ /* Chosen: the real player, full width. */ }
			{ !! videoId && !! item && (
				<div style={ { position: 'relative' } }>
					<div className="trueplayer-mount">
						<Player
							key={ `${ item.id }:${ bump }` }
							videoId={ item.id }
							title={ item.title }
							config={ item.config }
							preview
						/>
					</div>
					{ /* Until the block is selected, a click should select it
					     rather than land on the player's own controls. Once it
					     is selected the overlay lifts and the preview plays. */ }
					{ ! isSelected && (
						<div
							className="tp-block-preview-shield"
							style={ { position: 'absolute', inset: 0, zIndex: 10 } }
							aria-hidden="true"
						/>
					) }
				</div>
			) }

			{ /* Chosen, but the config hasn't arrived yet. */ }
			{ !! videoId && ! item && ! missing && (
				<Placeholder icon="format-video" label={ brand() }>
					{ itemError ? (
						<Notice status="error" isDismissible={ false }>
							{ itemError }
						</Notice>
					) : (
						<Spinner />
					) }
				</Placeholder>
			) }

			{ /* Nothing chosen yet, or what was chosen is gone. */ }
			{ ( ! videoId || missing ) && (
				<Placeholder
					icon="format-video"
					label={ brand() }
					instructions={ __( 'Show a video from your library, or add a new one.', 'trueplayer' ) }
				>
					{ loading && <Spinner /> }

					{ ! loading && loadError && (
						<Notice status="error" isDismissible={ false }>
							{ loadError }
						</Notice>
					) }

					{ missing && (
						<Notice status="warning" isDismissible={ false }>
							{ __( 'That video is no longer in your library. Choose another one.', 'trueplayer' ) }
						</Notice>
					) }

					{ ! loading && (
						<Flex justify="flex-start" gap={ 3 } align="flex-end" style={ { width: '100%' } }>
							<FlexItem isBlock>{ picker }</FlexItem>
							{ createButton && <FlexItem>{ createButton }</FlexItem> }
						</Flex>
					) }

					{ ! loading && 0 === ( videos || [] ).length && ! canCreate() && ! loadError && (
						<Notice status="info" isDismissible={ false }>
							{ __( 'There are no videos yet. An administrator can add one.', 'trueplayer' ) }
						</Notice>
					) }
				</Placeholder>
			) }

			{ editing && (
				<VideoModal
					video={ 'edit' === editing ? item : null }
					onClose={ () => setEditing( null ) }
					onSaved={ saved }
				/>
			) }
		</div>
	);
}
