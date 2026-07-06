import { useState } from '@wordpress/element';
import { rest } from '@Utils/rest';

/**
 * In-player subscribe / email-capture gate. On submit it posts to the server,
 * which routes the subscription to the configured integration (GemCRM, …).
 * When `required` is false the viewer can skip.
 */
export default function Optin( { videoId, optin, onDone, onSkip, preview = false } ) {
	const [ email, setEmail ] = useState( '' );
	const [ name, setName ] = useState( '' );
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );

	const submit = async () => {
		if ( ! email ) {
			setError( 'Please enter your email.' );
			return;
		}
		setBusy( true );
		setError( '' );
		try {
			if ( preview ) {
				onDone(); // preview: don't actually subscribe
				return;
			}
			await rest.post( 'optin', { video: videoId, email, name } );
			onDone();
		} catch ( e ) {
			setError( e.message || 'Something went wrong.' );
		} finally {
			setBusy( false );
		}
	};

	return (
		<div className="tp-overlay tp-optin">
			<div className="tp-optin-card">
				<h3 className="tp-optin-title">{ optin.headline || 'Subscribe to keep watching' }</h3>
				{ optin.description && <p className="tp-optin-desc">{ optin.description }</p> }
				{ optin.collectName && (
					<input className="tp-optin-input" type="text" placeholder="Your name" value={ name } onChange={ ( e ) => setName( e.target.value ) } />
				) }
				<input className="tp-optin-input" type="email" placeholder="you@example.com" value={ email } onChange={ ( e ) => setEmail( e.target.value ) } onKeyDown={ ( e ) => e.key === 'Enter' && submit() } />
				{ error && <p className="tp-optin-error">{ error }</p> }
				<button className="tp-quiz-submit" disabled={ busy } onClick={ submit }>
					{ busy ? 'Subscribing…' : ( optin.buttonText || 'Subscribe & continue' ) }
				</button>
				{ ! optin.required && (
					<button className="tp-optin-skip" onClick={ onSkip }>No thanks, continue</button>
				) }
			</div>
		</div>
	);
}
