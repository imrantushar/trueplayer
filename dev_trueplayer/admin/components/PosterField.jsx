import { Button, Thumb } from './UI';
import { Icon } from './icons';
import { pickMedia } from '../utils/media';

/**
 * The poster image, with every way of setting one in a single panel.
 *
 * Previously the picker, the "Regenerate from video" button and the line
 * saying where the current image came from were three separate blocks, so the
 * two things an author chooses between — pick an image, or take a frame from
 * the video — never appeared together, and the status line read as a caption
 * for the button under it rather than a description of the poster.
 */
export default function PosterField( { source, audio = false, canGrab, capture, onPick, onRemove, onGrab } ) {
	const poster = source.poster || '';
	const busy = capture.busy;
	const noun = audio ? 'cover art' : 'poster';

	const choose = () => pickMedia( 'image', ( url ) => onPick( url ) );

	const grabLabel = busy
		? 'Grabbing a frame…'
		: `${ poster ? 'Regenerate' : 'Generate' } from video`;

	return (
		<div>
			<div className="flex items-center gap-3.5 rounded-card border border-line bg-subtle p-3">
				{ poster ? (
					<div className="relative shrink-0">
						<Thumb poster={ poster } type={ audio ? 'audio' : 'video' } />
						{ busy && (
							<span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
								<span className="w-4 h-4 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
							</span>
						) }
					</div>
				) : (
					<button
						type="button"
						onClick={ choose }
						aria-label={ `Choose ${ noun }` }
						className="shrink-0 w-24 aspect-video rounded-lg border border-dashed border-line bg-white flex items-center justify-center text-gray-400 hover:border-brand-400 hover:text-brand-500 transition-colors"
					>
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
							<path d="M12 6v12M6 12h12" />
						</svg>
					</button>
				) }

				{ /* Choosing an image and taking one from the video are alternatives,
				     so they sit in one stack; Remove only exists once there is
				     something to remove. */ }
				<div className="flex flex-col items-start gap-2 min-w-0">
					<div className="flex items-center gap-1.5">
						<Button variant="ghost" size="sm" onClick={ choose } disabled={ busy }>
							{ poster ? 'Replace' : 'Choose image' }
						</Button>
						{ poster && (
							<Button variant="dangerClear" size="sm" onClick={ onRemove } disabled={ busy }>
								Remove
							</Button>
						) }
					</div>
					{ canGrab && (
						<Button variant="ghost" size="sm" onClick={ onGrab } disabled={ busy }>
							<Icon name="refresh" className={ `w-3.5 h-3.5 ${ busy ? 'animate-spin' : '' }` } />
							{ grabLabel }
						</Button>
					) }
				</div>
			</div>

			{ /* Which case you are in, so "Regenerate" is an informed choice: a
			     frame we grabbed is safe to replace, an uploaded one is the
			     author's own work. */ }
			{ ! busy && ! capture.error && poster && source.posterAuto && (
				<p className="text-xs text-muted pt-2">Grabbed from the video.</p>
			) }
			{ capture.error && <p className="text-xs text-danger pt-2">{ capture.error }</p> }
		</div>
	);
}
