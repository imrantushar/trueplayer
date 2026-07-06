import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, SelectControl, Placeholder } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

registerBlockType( 'trueplayer/player', {
	title: __( 'TruePlayer', 'trueplayer' ),
	icon: 'format-video',
	category: 'embed',
	attributes: { videoId: { type: 'number', default: 0 } },

	edit( { attributes, setAttributes } ) {
		const { videoId } = attributes;
		const [ videos, setVideos ] = useState( [] );
		const blockProps = useBlockProps();

		useEffect( () => {
			apiFetch( { path: '/trueplayer/v1/videos' } )
				.then( ( list ) => setVideos( list || [] ) )
				.catch( () => setVideos( [] ) );
		}, [] );

		const options = [ { label: __( '— Select a video —', 'trueplayer' ), value: 0 } ].concat(
			videos.map( ( v ) => ( { label: v.title, value: v.id } ) )
		);
		const selected = videos.find( ( v ) => v.id === videoId );

		return (
			<div { ...blockProps }>
				<InspectorControls>
					<PanelBody title={ __( 'TruePlayer', 'trueplayer' ) }>
						<SelectControl
							label={ __( 'Video', 'trueplayer' ) }
							value={ videoId }
							options={ options }
							onChange={ ( val ) => setAttributes( { videoId: parseInt( val, 10 ) } ) }
						/>
					</PanelBody>
				</InspectorControls>
				<Placeholder icon="format-video" label="TruePlayer" instructions={ __( 'Watch-verified, quiz-gated video.', 'trueplayer' ) }>
					{ selected ? (
						<strong>{ selected.title }</strong>
					) : (
						<SelectControl value={ videoId } options={ options } onChange={ ( val ) => setAttributes( { videoId: parseInt( val, 10 ) } ) } />
					) }
				</Placeholder>
			</div>
		);
	},

	save() {
		return null; // dynamic — rendered server-side via the shortcode
	},
} );
