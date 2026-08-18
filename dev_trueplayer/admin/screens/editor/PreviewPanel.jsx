import { useState } from '@wordpress/element';
import Player from '@Player/Player';
import { Card } from '../../components/UI';
import { hasVideoSource, sourceKey } from '../../utils/videoSource';
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
 */
export default function PreviewPanel( { id, config, onDuration } ) {
	const [ bump, setBump ] = useState( 0 );
	const hasSource = hasVideoSource( config.source || {} );
	const key = `${ sourceKey( config.source || {} ) }:${ bump }`;

	return (
		<Card className="p-4">
			<div className="flex items-center justify-between mb-2">
				<span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Live preview</span>
				<button className="text-xs text-gray-500 hover:text-gray-800" onClick={ () => setBump( ( b ) => b + 1 ) }>↻ Reload</button>
			</div>

			{ ! hasSource ? (
				<div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-gray-400 bg-white">
					Add a video under <strong>Source</strong> to preview it.
				</div>
			) : (
				<div className="trueplayer-mount">
					<Player key={ key } videoId={ id } config={ config } preview onDuration={ onDuration } />
				</div>
			) }

			<p className="text-xs text-gray-400 mt-2 leading-relaxed">
				Watch-tracking & locking are off in preview.
			</p>
		</Card>
	);
}
