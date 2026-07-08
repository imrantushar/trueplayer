import { useState } from '@wordpress/element';

/**
 * Interactive layers (pro) — timed, positioned elements over the picture:
 *  - hotspot:  clickable region (percent coords) with an optional tooltip → URL
 *  - banner:   image + link
 *  - shortcode: server-rendered HTML (prepared by the shortcode pipeline)
 *  - form:     lightweight email capture posting to the opt-in endpoint
 * Layers show while `start <= t < end` (no end = until the video finishes).
 */

function active( layer, t ) {
	const start = parseFloat( layer.start ) || 0;
	const end = layer.end ? parseFloat( layer.end ) : Infinity;
	return t >= start && t < end;
}

function Hotspot( { layer } ) {
	const style = {
		left: `${ layer.x ?? 10 }%`,
		top: `${ layer.y ?? 10 }%`,
		width: `${ layer.w ?? 20 }%`,
		height: `${ layer.h ?? 20 }%`,
	};
	const body = (
		<>
			<span className="tp-hotspot-pulse" />
			{ layer.tooltip && <span className="tp-hotspot-tip">{ layer.tooltip }</span> }
		</>
	);
	return layer.url ? (
		<a className="tp-layer tp-hotspot" style={ style } href={ layer.url } target="_blank" rel="noreferrer noopener">{ body }</a>
	) : (
		<span className="tp-layer tp-hotspot" style={ style }>{ body }</span>
	);
}

function Banner( { layer } ) {
	if ( ! layer.image ) {
		return null;
	}
	const img = <img src={ layer.image } alt={ layer.alt || '' } />;
	return (
		<div className={ `tp-layer tp-banner tp-pos-${ layer.position || 'bottom-center' }` }>
			{ layer.url ? <a href={ layer.url } target="_blank" rel="noreferrer noopener">{ img }</a> : img }
		</div>
	);
}

function ShortcodeLayer( { layer } ) {
	if ( ! layer.html ) {
		return null;
	}
	return (
		<div
			className={ `tp-layer tp-shortcode-layer tp-pos-${ layer.position || 'middle-center' }` }
			// Rendered server-side from admin-authored shortcodes (same trust
			// model as post content).
			dangerouslySetInnerHTML={ { __html: layer.html } }
		/>
	);
}

function FormLayer( { layer, videoId, onSubmit } ) {
	const [ email, setEmail ] = useState( '' );
	const [ state, setState ] = useState( 'idle' ); // idle | busy | done | error
	if ( state === 'done' ) {
		return (
			<div className={ `tp-layer tp-form-layer tp-pos-${ layer.position || 'middle-center' }` }>
				<p className="tp-form-layer-thanks">{ layer.thanks || 'Thanks — you’re in!' }</p>
			</div>
		);
	}
	const submit = async ( e ) => {
		e.preventDefault();
		if ( ! /.+@.+\..+/.test( email ) ) {
			setState( 'error' );
			return;
		}
		setState( 'busy' );
		try {
			await onSubmit( { email, layerId: layer.id } );
			setState( 'done' );
		} catch ( err ) {
			setState( 'error' );
		}
	};
	return (
		<form className={ `tp-layer tp-form-layer tp-pos-${ layer.position || 'middle-center' }` } onSubmit={ submit }>
			{ layer.title && <strong className="tp-form-layer-title">{ layer.title }</strong> }
			<div className="tp-form-layer-row">
				<input
					type="email"
					value={ email }
					onChange={ ( e ) => setEmail( e.target.value ) }
					placeholder={ layer.placeholder || 'you@email.com' }
					aria-label="Email"
				/>
				<button type="submit" disabled={ state === 'busy' }>{ layer.buttonLabel || 'Subscribe' }</button>
			</div>
			{ state === 'error' && <span className="tp-form-layer-error">Please enter a valid email.</span> }
		</form>
	);
}

export default function Layers( { layers, current, videoId, onOptin } ) {
	const due = ( layers || [] ).filter( ( l ) => active( l, current ) );
	if ( ! due.length ) {
		return null;
	}
	return (
		<div className="tp-layers">
			{ due.map( ( l ) => {
				switch ( l.type ) {
					case 'hotspot':
						return <Hotspot key={ l.id } layer={ l } />;
					case 'banner':
						return <Banner key={ l.id } layer={ l } />;
					case 'shortcode':
						return <ShortcodeLayer key={ l.id } layer={ l } />;
					case 'form':
						return <FormLayer key={ l.id } layer={ l } videoId={ videoId } onSubmit={ onOptin } />;
					default:
						return null;
				}
			} ) }
		</div>
	);
}
