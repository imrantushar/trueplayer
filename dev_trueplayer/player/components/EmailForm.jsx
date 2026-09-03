import { useState } from '@wordpress/element';
import { rest } from '@Utils/rest';
import { __ } from '@Utils/translation';
import { formStyleVars } from '../formStyle';

/**
 * The Email form layer's form — the whole of it, for both of its modes.
 *
 * There used to be two: a card for the blocking gate and a panel for the inline
 * one, each with its own markup, its own class names and its own copy of the
 * submit logic. They were never meant to differ, but every fix had to be made
 * twice and kept missing one side — the headline colour worked in one and not
 * the other, the hover state existed on one field and not its twin, the skip
 * link tested `required` two different ways. One form now, and the mode only
 * decides what it is wrapped in.
 *
 * @param {Object}   props
 * @param {Object}   props.layer     The Email form layer.
 * @param {number}   props.videoId   Video the submission belongs to.
 * @param {string}   props.className Container classes from the calling mode.
 * @param {boolean}  props.preview   Editor preview — never actually subscribes.
 * @param {Function} props.onDone    Called after a successful submission. When
 *                                   given, the caller owns what happens next
 *                                   (the gate closes and playback resumes);
 *                                   without it the form shows its thank-you.
 * @param {Function} props.onDismiss Called when the viewer declines. Only
 *                                   reachable when `required` is false.
 */
export default function EmailForm( { layer, videoId, className = '', preview = false, onDone, onDismiss } ) {
	const [ email, setEmail ] = useState( '' );
	const [ name, setName ] = useState( '' );
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );
	const [ done, setDone ] = useState( false );

	const classes = `tp-emailform ${ className }`.trim();

	if ( done ) {
		return (
			<div className={ classes } style={ formStyleVars( layer ) }>
				<p className="tp-emailform-thanks">{ layer.thanks || __( 'Thanks — you’re in!' ) }</p>
			</div>
		);
	}

	const submit = async ( e ) => {
		if ( e ) {
			e.preventDefault();
		}
		// Same check both modes used to make separately, and the looser of the
		// two: a missing @ is a typo worth catching before a round trip.
		if ( ! /.+@.+\..+/.test( email ) ) {
			setError( __( 'Please enter a valid email address.' ) );
			return;
		}
		setBusy( true );
		setError( '' );
		try {
			if ( ! preview ) {
				await rest.post( 'optin', { video: videoId, email, name, layer: layer.id || '' } );
			}
			if ( onDone ) {
				onDone();
			} else {
				setDone( true );
			}
		} catch ( err ) {
			setError( err.message || __( 'Something went wrong.' ) );
		} finally {
			setBusy( false );
		}
	};

	return (
		<form className={ classes } style={ formStyleVars( layer ) } onSubmit={ submit }>
			{ layer.title && <p className="tp-emailform-title">{ layer.title }</p> }
			{ layer.description && <p className="tp-emailform-desc">{ layer.description }</p> }

			{ layer.collectName && (
				<input
					className="tp-emailform-input"
					type="text"
					value={ name }
					onChange={ ( ev ) => setName( ev.target.value ) }
					placeholder={ __( 'Your name' ) }
					aria-label={ __( 'Name' ) }
				/>
			) }

			{ /* Field and button on one line, as the reference design has it. */ }
			<div className="tp-emailform-row">
				<input
					className="tp-emailform-input"
					type="email"
					value={ email }
					onChange={ ( ev ) => setEmail( ev.target.value ) }
					placeholder={ layer.placeholder || __( 'you@email.com' ) }
					aria-label={ __( 'Email' ) }
				/>
				<button className="tp-emailform-submit" type="submit" disabled={ busy }>
					{ busy ? __( 'Subscribing…' ) : ( layer.buttonLabel || __( 'Subscribe' ) ) }
				</button>
			</div>

			{ error && <p className="tp-emailform-error">{ error }</p> }

			{ /* Strictly `false`, matching the editor's own `required !== false`
			     default — an unset value must mean required in both, or a config
			     written by hand behaves one way in the editor and another here. */ }
			{ false === layer.required && (
				<button className="tp-emailform-skip" type="button" onClick={ onDismiss }>
					{ layer.skipLabel || __( 'No thanks' ) }
				</button>
			) }
		</form>
	);
}
