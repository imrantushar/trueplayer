import EmailForm from './EmailForm';

/**
 * The blocking half of the Email form layer: the same form as the inline mode,
 * centred on a card over a dimmed video.
 *
 * Only the wrapper lives here. The form itself — its fields, its copy, its
 * submission, its styling tokens — is EmailForm, shared with the inline panel
 * so the two modes cannot drift apart.
 */
export default function Optin( { videoId, optin, onDone, onSkip, preview = false } ) {
	return (
		<div className="tp-overlay tp-optin">
			<EmailForm
				layer={ optin }
				videoId={ videoId }
				className="tp-emailform-card"
				preview={ preview }
				// The gate owns what happens after a submission — it has to close
				// and let playback resume, rather than sit there saying thanks.
				onDone={ onDone }
				onDismiss={ onSkip }
			/>
		</div>
	);
}
