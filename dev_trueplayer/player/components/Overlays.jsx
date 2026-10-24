/** Big-play / message overlays for the player. */
import { __ } from '@Utils/translation';

export function BigPlay( { onPlay } ) {
	return (
		<button className="tp-bigplay" aria-label={ __( 'Play' ) } onClick={ onPlay }>
			<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
				<path d="M8 5v14l11-7z" />
			</svg>
		</button>
	);
}

export function Message( { children } ) {
	return (
		<div className="tp-overlay tp-message">
			<div className="tp-lock-card">{ children }</div>
		</div>
	);
}

export function Spinner() {
	return <div className="tp-spinner" aria-label={ __( 'Loading' ) } />;
}
