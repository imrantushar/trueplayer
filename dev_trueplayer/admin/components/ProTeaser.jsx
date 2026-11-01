import { Card } from './UI';
import { Icon } from './icons';
import { __ } from '@Utils/translation';

export const PURCHASE = ( typeof window !== 'undefined' && window.TruePlayerGlobal && window.TruePlayerGlobal.purchase_url ) || 'https://true-player.net/';

// What each Pro screen does. Copy only: the features themselves ship in the
// TruePlayer Pro add-on, which replaces these screens when it is active.
const TEASERS = {
	gating: {
		icon: 'shield',
		title: __( 'Verification & quiz' ),
		body: __( 'Make sure viewers actually watch. Require a minimum watch percentage, add quiz checkpoints along the timeline and finish with a graded final quiz.' ),
		points: [
			__( 'Watch-time verification with a completion threshold' ),
			__( 'Quiz checkpoints and a graded final quiz' ),
			__( 'Block seeking ahead until a section is watched' ),
		],
	},
	protection: {
		icon: 'lock',
		title: __( 'Protection' ),
		body: __( 'Keep your videos private and discourage re-sharing.' ),
		points: [
			__( 'Private video playback for logged-in viewers or roles' ),
			__( 'Viewer watermark overlay' ),
			__( 'Domain and embed restrictions' ),
		],
	},
	timed: {
		icon: 'clock',
		title: __( 'Timed content' ),
		body: __( 'Show messages, buttons and offers at exact moments of the video.' ),
		points: [
			__( 'Timed cards that appear and hide on a schedule' ),
			__( 'Rules to show content to the right viewers' ),
			__( 'Pause the video until the viewer responds' ),
		],
	},
	analytics: {
		icon: 'analytics',
		title: __( 'Analytics' ),
		body: __( 'See who watched, how far they got and where they dropped off, for every player.' ),
		points: [
			__( 'Views, unique viewers and completion rate' ),
			__( 'Per-video retention and engagement charts' ),
			__( 'Quiz scores and verified completions' ),
		],
	},
	enforcement: {
		icon: 'shield',
		title: __( 'Enforcement' ),
		body: __( 'Site-wide rules for how strictly watch verification is applied.' ),
		points: [
			__( 'Default completion thresholds for every player' ),
			__( 'Server-side checks, not just in the browser' ),
		],
	},
	compliance: {
		icon: 'lock',
		title: __( 'Compliance & privacy' ),
		body: __( 'Collect viewer data responsibly.' ),
		points: [
			__( 'Consent handling before analytics run' ),
			__( 'Data retention and anonymization controls' ),
		],
	},
	'analytics-settings': {
		icon: 'analytics',
		title: __( 'Analytics' ),
		body: __( 'Choose what viewing data is recorded and where it is sent.' ),
		points: [
			__( 'Track plays, progress and completions' ),
			__( 'Send events to Google Analytics' ),
		],
	},
	webhooks: {
		icon: 'webhook',
		title: __( 'Global webhooks' ),
		body: __( 'Send viewer events to Zapier, Make, your CRM or any URL.' ),
		points: [
			__( 'Signed webhooks for plays, completions and quiz results' ),
			__( 'One global endpoint for every player' ),
		],
	},
	logs: {
		icon: 'clock',
		title: __( 'Webhook logs' ),
		body: __( 'Inspect every delivery, see failures and retry them.' ),
		points: [
			__( 'Request and response details for each delivery' ),
			__( 'Resend failed deliveries in one click' ),
		],
	},
};

/**
 * The stand-in for a Pro screen while Pro is not active. Informational only:
 * no controls, no saved state.
 */
export function ProTeaser( { id } ) {
	const t = TEASERS[ id ];
	if ( ! t ) {
		return null;
	}
	return (
		<Card className="p-8 max-w-2xl border-brand-100 bg-gradient-to-br from-brand-50 to-white">
			<span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600">
				<Icon name="spark" className="w-3.5 h-3.5" /> { __( 'TruePlayer Pro' ) }
			</span>
			<div className="flex items-center gap-2.5 mt-3">
				<span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Icon name={ t.icon } className="w-5 h-5" /></span>
				<h2 className="text-xl font-bold text-ink !m-0">{ t.title }</h2>
			</div>
			<p className="text-sm text-gray-600 !mt-3 !mb-4 leading-relaxed">{ t.body }</p>
			<ul className="text-sm text-gray-700 !mb-6 space-y-1.5 list-none !pl-0">
				{ t.points.map( ( point ) => (
					<li key={ point } className="flex items-start gap-2">
						<Icon name="checkmark" className="w-4 h-4 mt-0.5 text-brand-500 shrink-0" />
						<span>{ point }</span>
					</li>
				) ) }
			</ul>
			{ /* hover/focus colors: WP admin restyles every anchor, which would turn the label blue on the blue fill. */ }
			<a href={ PURCHASE } target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-white hover:text-white focus:text-white bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2">{ __( 'Upgrade to Pro' ) }</a>
		</Card>
	);
}

/** Builds a screen component for the extension seam: `Component: teaserOf( 'gating' )`. */
export const teaserOf = ( id ) => function Teaser() {
	return <ProTeaser id={ id } />;
};
