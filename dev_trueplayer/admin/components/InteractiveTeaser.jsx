import { Card, Button, Badge } from './UI';
import { Icon } from './icons';

/**
 * Shown in place of the Interactive library when the engine ships in this build
 * but the site hasn't switched it on.
 *
 * Most sites only ever embed video, so interactive content is an opt-in addon
 * and its tables are created by activation rather than by install. That makes
 * discoverability the problem this panel solves: without it the whole section
 * would simply be missing. The switch itself lives in one place —
 * Settings → Addons — so this hands off there rather than toggling inline.
 */
const FEATURES = [
	[ 'quiz', 'Multiple choice, true/false & fill in the blanks' ],
	[ 'cards', 'Flashcards, drag the words & mark the words' ],
	[ 'playlist', 'Accordions and other rich content blocks' ],
	[ 'webhook', 'Results feed the same analytics, webhooks & LMS pipeline as video' ],
];

export default function InteractiveTeaser( { onEnable } ) {
	return (
		<Card className="p-8 max-w-2xl mx-auto text-center">
			<span className="inline-flex w-12 h-12 rounded-card bg-brand-100 text-brand-500 items-center justify-center mb-4">
				<Icon name="spark" className="w-6 h-6" />
			</span>
			<div className="flex items-center justify-center gap-2 mb-1">
				<h3 className="text-lg font-semibold text-ink">Interactive content</h3>
				<Badge tone="gray">Not enabled</Badge>
			</div>
			<p className="text-sm text-muted mb-5">
				Build quizzes, flashcards and other interactive activities alongside your
				videos, and embed them anywhere with a shortcode.
			</p>

			<ul className="text-sm text-gray-600 text-left inline-block mb-6 space-y-2">
				{ FEATURES.map( ( [ icon, label ] ) => (
					<li key={ label } className="flex items-start gap-2.5">
						<Icon name={ icon } className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
						<span>{ label }</span>
					</li>
				) ) }
			</ul>

			<div>
				<Button onClick={ onEnable }>Enable in Settings → Addons</Button>
			</div>
			<p className="text-xs text-muted mt-4 mb-0">
				Enabling adds the interactive engine’s tables to your database. Turning it
				back off later leaves anything you’ve built untouched.
			</p>
		</Card>
	);
}
