import { useState, useEffect, useRef } from '@wordpress/element';
import { passesConditions } from '../rules';
import EmailForm from './EmailForm';

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

function ShortcodeLayer( { layer, preview } ) {
	const hostRef = useRef( null );

	// Injected by hand rather than with dangerouslySetInnerHTML because a
	// <script> inserted through innerHTML never executes (HTML spec) — a
	// shortcode that boots itself inline would paint its markup and then sit
	// there dead. Re-creating each script as a real element runs it.
	useEffect( () => {
		const host = hostRef.current;
		if ( ! host || ! layer.html ) {
			return;
		}
		host.innerHTML = layer.html;
		host.querySelectorAll( 'script' ).forEach( ( old ) => {
			const run = document.createElement( 'script' );
			Array.from( old.attributes ).forEach( ( a ) => run.setAttribute( a.name, a.value ) );
			run.text = old.textContent || '';
			old.parentNode.replaceChild( run, old );
		} );
		// A layer enters the DOM when the playhead reaches it — long after the
		// page-load pass that most plugins initialize on. This is the seam for
		// them: listen, then scan `detail.node`. Nothing generic can rescue a
		// third-party script that only ever scans once at DOMContentLoaded.
		document.dispatchEvent( new CustomEvent( 'trueplayer:layer-rendered', {
			detail: { layerId: layer.id, node: host },
		} ) );
	}, [ layer.html, layer.id ] );

	// No html means PHP has not rendered this shortcode: the editor preview
	// builds its config client-side, so shortcode layers were simply invisible
	// there and looked broken. Show what will run instead of nothing.
	if ( ! layer.html ) {
		return preview && layer.shortcode ? (
			<div className={ `tp-layer tp-shortcode-layer is-placeholder tp-pos-${ layer.position || 'middle-center' }` }>
				<code>{ layer.shortcode }</code>
				<span>Runs on the page, not in this preview.</span>
			</div>
		) : null;
	}

	return (
		<div
			ref={ hostRef }
			// Server-rendered from admin-authored shortcodes (same trust model
			// as post content).
			className={ `tp-layer tp-shortcode-layer tp-pos-${ layer.position || 'middle-center' }` }
		/>
	);
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
	// Per-viewer facts for conditional rules (loggedIn / CRM / etc.). Fetched
	// once; falls back to the localized login flag so URL/login rules still work.
	const [ facts, setFacts ] = useState(
		viewer || { loggedIn: !! ( window.TruePlayerGlobal && window.TruePlayerGlobal.is_login ), isCrmContact: false, crmTags: [], crmLists: [] }
	);
	// Layer interaction state (seen / completed / email submitted) for rules.
	const stateRef = useRef( { seen: {}, completed: {}, emailSubmitted: false } );
	const hasConditions = ( layers || [] ).some( ( l ) => l.conditions && l.conditions.rules && l.conditions.rules.length );

	useEffect( () => {
		if ( viewer || preview || ! hasConditions ) {
			return;
		}
		const g = window.TruePlayerGlobal || {};
		fetch( `${ g.rest_url }${ g.namespace }rules/context`, { headers: { 'X-WP-Nonce': g.nonce } } )
			.then( ( r ) => ( r.ok ? r.json() : null ) )
			.then( ( data ) => data && setFacts( ( f ) => ({ ...f, ...data }) ) )
			.catch( () => {} );
	}, [ hasConditions, viewer, preview ] );

	const ctx = { viewer: facts, url: new URLSearchParams( window.location.search ), layerState: stateRef.current };

	const due = ( layers || [] ).filter( ( l ) => {
		// The editor's eye overrides both the window and the rules: an author
		// asking to see a layer has asked to see it, whether or not this viewer
		// would qualify or the playhead happens to be inside its window.
		if ( hiddenId && l.id === hiddenId ) {
			return false;
		}
		if ( forcedId && l.id === forcedId ) {
			return true;
		}
		if ( ! active( l, current ) ) {
			return false;
		}
		return passesConditions( l.conditions, ctx );
	} );

	// Record that these layers have been seen (for layer_seen rules on others).
	due.forEach( ( l ) => {
		stateRef.current.seen[ l.id ] = true;
	} );

	if ( ! due.length ) {
		return null;
	}

	const handleOptin = async ( payload ) => {
		stateRef.current.emailSubmitted = true;
		if ( payload && payload.layerId ) {
			stateRef.current.completed[ payload.layerId ] = true;
		}
		return onOptin ? onOptin( payload ) : undefined;
	};

	// An email form is a call to action, not decoration — it has to sit above the
	// big play button, which is painted at a higher z-index than the layer stack.
	// `.tp-layers` sets a z-index and so opens a stacking context, meaning no
	// child of it can rise past the button on its own; the container is what has
	// to lift. Only for a form, so hotspots and banners keep sitting behind the
	// player's own furniture as before.
	const blocking = due.some( ( l ) => 'form' === l.type );

	return (
		<div className={ `tp-layers${ blocking ? ' is-blocking' : '' }` }>
			{ due.map( ( l ) => {
				switch ( l.type ) {
					case 'hotspot':
						return <Hotspot key={ l.id } layer={ l } />;
					case 'banner':
						return <Banner key={ l.id } layer={ l } />;
					case 'shortcode':
						return <ShortcodeLayer key={ l.id } layer={ l } preview={ preview } />;
					case 'form':
						return <FormLayer key={ l.id } layer={ l } videoId={ videoId } onSubmit={ handleOptin } />;
					default:
						return null;
				}
			} ) }
		</div>
	);
}
