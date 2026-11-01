import { useState } from '@wordpress/element';
import { layerTypes, useLayerRules } from '@Ext/player';
import EmailForm from './EmailForm';

/**
 * Layers — timed, positioned elements over the picture. The core type is the
 * Email form (lightweight email capture posting to the opt-in endpoint); other
 * types can be supplied through `@Ext/player`'s `layerTypes`.
 * Layers show while `start <= t < end` (no end = until the video finishes).
 */

function active( layer, t ) {
	const start = parseFloat( layer.start ) || 0;
	const end = layer.end ? parseFloat( layer.end ) : Infinity;
	return t >= start && t < end;
}

/**
 * The inline half of the Email form layer — a panel beside the picture that
 * does not interrupt playback. The blocking half of the same layer is rendered
 * by the player itself (see Optin.jsx), because only the player can pause.
 *
 * Both read the same layer object, so copy and destination cannot drift apart.
 */
/**
 * The inline half of the Email form layer: the same form as the gate, in a
 * panel beside the picture that does not interrupt playback.
 *
 * Only the wrapper lives here — see EmailForm. With no `onDone` the form keeps
 * its own thank-you in place, which is the one behaviour that genuinely differs
 * between the modes: nothing is waiting on it, so there is nothing to resume.
 */
function FormLayer( { layer, videoId, onSubmit } ) {
	const [ dismissed, setDismissed ] = useState( false );

	// A panel the viewer can't put away sits over the picture for the rest of
	// the video. `required` is what says whether they may.
	if ( dismissed ) {
		return null;
	}

	return (
		<EmailForm
			layer={ layer }
			videoId={ videoId }
			className={ `tp-layer tp-emailform-panel tp-pos-${ layer.position || 'middle-center' }` }
			preview={ ! onSubmit }
			onDismiss={ () => setDismissed( true ) }
		/>
	);
}


export default function Layers( { layers, current, videoId, onOptin, viewer, preview, forcedId = null, hiddenId = null } ) {
	const rules = useLayerRules( layers, { viewer, preview } );

	const due = ( layers || [] ).filter( ( l ) => {
		// The editor's eye overrides the window: an author asking to see a
		// layer has asked to see it.
		if ( hiddenId && l.id === hiddenId ) {
			return false;
		}
		if ( forcedId && l.id === forcedId ) {
			return true;
		}
		if ( 'form' !== l.type && ! layerTypes[ l.type ] ) {
			return false;
		}
		return active( l, current ) && rules.passes( l );
	} );

	rules.seen( due );

	if ( ! due.length ) {
		return null;
	}

	const handleOptin = async ( payload ) => {
		rules.submitted( payload );
		return onOptin ? onOptin( payload ) : undefined;
	};

	// An email form is a call to action, not decoration — it has to sit above the
	// big play button, which is painted at a higher z-index than the layer stack.
	// `.tp-layers` sets a z-index and so opens a stacking context, meaning no
	// child of it can rise past the button on its own; the container is what has
	// to lift.
	const blocking = due.some( ( l ) => 'form' === l.type );

	return (
		<div className={ `tp-layers${ blocking ? ' is-blocking' : '' }` }>
			{ due.map( ( l ) => {
				if ( 'form' === l.type ) {
					return <FormLayer key={ l.id } layer={ l } videoId={ videoId } onSubmit={ handleOptin } />;
				}
				const Type = layerTypes[ l.type ];
				return <Type key={ l.id } layer={ l } preview={ preview } />;
			} ) }
		</div>
	);
}
