/**
 * "Choose a saved video": the library as a list the author can pick from.
 *
 * Portalled through @wordpress/components' Modal for the same reasons as
 * VideoModal — the editor canvas is an iframe that would clip anything fixed.
 */
import { Modal, Spinner } from '@wordpress/components';
import { __ } from '@Utils/translation';
import { Styles } from './ui';
import { typeLabel } from './data';

export default function SavedModal( { videos, selected, onPick, onClose } ) {
	return (
		<Modal title={ __( 'Choose a saved video' ) } size="medium" className="tpb-frame" onRequestClose={ onClose }>
			<Styles />
			<div className="tpb" style={ { margin: '0 -8px' } }>
				{ null === videos && <Spinner /> }
				{ null !== videos && 0 === videos.length && (
					<p style={ { fontSize: 13, color: '#646C73', margin: '8px' } }>{ __( 'No saved videos yet.' ) }</p>
				) }
				{ ( videos || [] ).map( ( v ) => (
					<button key={ v.id } type="button" role="radio" aria-checked={ selected === v.id } className="tpb-saved" onClick={ () => onPick( v ) }>
						<span
							className="tpb-thumb"
							style={ {
								width: 88,
								height: 50,
								backgroundImage: v.poster ? `url(${ v.poster })` : undefined,
								backgroundSize: 'cover',
								backgroundPosition: 'center',
							} }
						/>
						<span style={ { flex: 1, minWidth: 0 } }>
							<span style={ { display: 'block', fontSize: 13, fontWeight: 500 } }>{ v.title }</span>
							<span style={ { display: 'block', fontSize: 12, color: '#646C73' } }>{ typeLabel( v.type ) }</span>
						</span>
						{ selected === v.id && <span className="tpb-tag">{ __( 'Selected' ) }</span> }
					</button>
				) ) }
			</div>
		</Modal>
	);
}
