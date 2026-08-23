/** Lock / big-play / message overlays for the player. */

export function LockScreen( { requireRewatch, onRewatch } ) {
	return (
		<div className="tp-overlay tp-lock">
			<div className="tp-lock-card">
				<div className="tp-lock-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
						<rect x="5" y="11" width="14" height="9" rx="2" />
						<path d="M8 11V8a4 4 0 018 0v3" />
					</svg>
				</div>
				<h3>Video locked</h3>
				<p>
					{ requireRewatch
						? 'You used all your attempts. Re-watch the full video to earn another try.'
						: 'This video is locked.' }
				</p>
				{ requireRewatch && (
					<button className="tp-quiz-submit" onClick={ onRewatch }>
						Re-watch to unlock
					</button>
				) }
			</div>
		</div>
	);
}

export function BigPlay( { onPlay } ) {
	return (
		<button className="tp-bigplay" aria-label="Play" onClick={ onPlay }>
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
	return <div className="tp-spinner" aria-label="Loading" />;
}
