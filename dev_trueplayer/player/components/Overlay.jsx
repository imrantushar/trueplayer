import { __ } from '@Utils/translation';

/**
 * Marketing overlay — a call-to-action card shown at a timestamp, on pause, or
 * as an end screen. Optional image, heading, text, and a button; end screens
 * also offer a replay.
 */
export default function Overlay( { overlay, onClose, onReplay } ) {
	const dismissible = overlay.dismissible !== false;
	return (
		<div className="tp-overlay tp-cta">
			<div className="tp-cta-card">
				{ dismissible && (
					<button className="tp-cta-close" aria-label={ __( 'Close' ) } onClick={ onClose }>×</button>
				) }
				{ overlay.image && <img className="tp-cta-img" src={ overlay.image } alt="" /> }
				{ overlay.title && <h3 className="tp-cta-title">{ overlay.title }</h3> }
				{ overlay.text && <p className="tp-cta-text">{ overlay.text }</p> }
				<div className="tp-cta-actions">
					{ onReplay && (
						<button className="tp-cta-btn tp-cta-secondary" onClick={ onReplay }>{ __( '↺ Replay' ) }</button>
					) }
					{ overlay.buttonLabel && (
						<a className="tp-cta-btn" href={ overlay.buttonUrl || '#' } target="_blank" rel="noreferrer noopener">
							{ overlay.buttonLabel }
						</a>
					) }
				</div>
			</div>
		</div>
	);
}
