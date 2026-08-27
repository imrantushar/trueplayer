import { useLayoutEffect, useRef, useState } from '@wordpress/element';
import Player from '@Player/Player';
import { Card } from '../../components/UI';
import { hasVideoSource, sourceKey } from '../../utils/videoSource';
import { withDerivedPoster } from '../../utils/poster';
// NOTE: the player CSS (style-frontend.css) is enqueued on admin pages by PHP.
// Do NOT import it here — sharing that CSS module across the frontend + admin
// entries makes webpack merge it into style-backend.css and stop emitting
// style-frontend.css, which would leave the real frontend player unstyled.

/**
 * Persistent live preview pinned beside the settings. Renders the REAL
 * frontend player in `preview` mode with the current unsaved config.
 *
 * The player is keyed on the SOURCE only, so changing the video remounts it,
 * while appearance/controls/chapters edits update live via re-render (Player
 * recomputes its customization from props each render) — no video reload while
 * you tweak styles.
 *
 * It renders at a fixed reference width and is scaled down to fit the panel,
 * rather than being laid out at the panel's own width. The player sizes its
 * control bar with container queries, so a ~380px preview column was showing
 * the compact bar (smaller buttons, smaller type) while the same video on a
 * page got the full-size one — the preview disagreed with what it was
 * previewing. Scaling keeps every proportion identical to the frontend.
 */

/**
 * The width the preview pretends to be: a typical single-column content width,
 * comfortably above the player's 480px compact breakpoint.
 */
const REFERENCE_WIDTH = 760;
export default function PreviewPanel( { id, config, onDuration, previewCue = null } ) {
	const [ bump, setBump ] = useState( 0 );
	const hasSource = hasVideoSource( config.source || {} );
	const key = `${ sourceKey( config.source || {} ) }:${ bump }`;

	const frameRef = useRef( null );
	const innerRef = useRef( null );
	const [ scale, setScale ] = useState( 1 );
	const [ height, setHeight ] = useState( 0 );

	// Track the panel's width (it moves with the browser and the editor layout)
	// and the scaled player's height, so the frame reserves exactly the room the
	// miniature needs — a transform doesn't affect layout size on its own.
	useLayoutEffect( () => {
		const frame = frameRef.current;
		if ( ! frame || ! hasSource ) {
			return;
		}
		const measure = () => {
			const w = frame.clientWidth;
			if ( ! w ) {
				return;
			}
			const next = Math.min( 1, w / REFERENCE_WIDTH );
			setScale( next );
			if ( innerRef.current ) {
				setHeight( innerRef.current.offsetHeight * next );
			}
		};
		measure();
		const ro = new ResizeObserver( measure );
		ro.observe( frame );
		if ( innerRef.current ) {
			// The player's own height changes with the aspect ratio and with
			// chapters/description appearing, so watch it too.
			ro.observe( innerRef.current );
		}
		return () => ro.disconnect();
	}, [ hasSource, key ] );

	return (
		<Card className="p-4">
			<div className="flex items-center justify-between mb-2">
				<span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Live preview</span>
				<button
					className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-gray-100 transition-colors"
					onClick={ () => setBump( ( b ) => b + 1 ) }
				>
					<span aria-hidden="true">↻</span> Reload
				</button>
			</div>

			{ ! hasSource ? (
				<div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-gray-400 bg-white">
					Add a video under <strong>Source</strong> to preview it.
				</div>
			) : (
				<div ref={ frameRef } style={ { height: height || undefined } } className="overflow-hidden">
					{ /* `maxWidth: none` matters: .trueplayer-mount is width:100%;max-width:100%,
					     which would clamp the reference width back to the panel's own and put
					     the container queries right back where they started. */ }
					<div
						ref={ innerRef }
						className="trueplayer-mount"
						style={ { width: REFERENCE_WIDTH, maxWidth: 'none', transform: `scale(${ scale })`, transformOrigin: 'top left' } }
					>
						{ /* Preview the provider's own thumbnail when no poster is set,
						     matching what PHP derives for the real embed. */ }
						<Player key={ key } videoId={ id } config={ withDerivedPoster( config ) } preview onDuration={ onDuration } previewCue={ previewCue } />
					</div>
				</div>
			) }

		</Card>
	);
}
