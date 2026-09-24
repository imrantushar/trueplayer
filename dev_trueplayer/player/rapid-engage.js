/**
 * The Rapid Engage Bar — a simulated scrubber that runs ahead of real playback
 * at the start, so a long video reads as a short one for the first few seconds
 * where viewers decide whether to stay.
 *
 * The bar is the ONLY thing that lies. `currentTime` is untouched, the coverage
 * tracker still sees real positions, and analytics are unaffected — this maps
 * real progress to a drawn position and nothing else.
 *
 * It is a deliberate deception of the viewer, so it is off by default, never
 * set site-wide by us, and the editor states plainly what it does. Because a
 * viewer who can scrub, or read a clock, spots the mismatch instantly, turning
 * it on also forces the timeline locked and the time readout hidden — see
 * `rapidActive` in Player.jsx, which is the single place that decision is made.
 */
import { __ } from '@Utils/translation';

/**
 * Curve exponents by intensity. `displayed = real^(1/k)`:
 *
 * Taking a 10-minute video at the 2-minute mark (20% really done):
 *
 *   k = 1     the ordinary linear bar — shows 20%
 *   k = 1.8   (speed 3, the default) shows 41%
 *   k = 2.5   (speed 5, the most we allow) shows 53%
 *
 * Note that even speed 1 (k = 1.3) reads 29% there: the gentlest setting is
 * still a visible lie, because a bar that only just beats the clock is not
 * worth the seeking it costs. Speed 1 is the subtle end of the effect, not an
 * off switch — `seekBarStyle: 'default'` is the off switch.
 *
 * Both ends are pinned — f(0) = 0 and f(1) = 1 — so the bar still starts empty
 * and still fills exactly as the video ends. Running ahead early is paid back
 * by running slow late, which is the "gradually slows down toward the actual
 * playback speed" half of the effect.
 *
 * Capped at 2.5 on purpose. Past roughly there the bar visibly lurches off the
 * start line and the illusion reads as a bug instead of a short video.
 */
const K_BY_SPEED = { 1: 1.3, 2: 1.55, 3: 1.8, 4: 2.1, 5: 2.5 };

export const RAPID_DEFAULT_SPEED = 3;

/**
 * The speed scale, named rather than numbered in the editor. The numbers are
 * what gets stored and what K_BY_SPEED keys off; the words are what an author
 * can actually choose between, since "2" and "3" say nothing about what the
 * bar will do.
 */
export const RAPID_SPEEDS = [
	{ value: 1, label: __( '1 — Subtle' ) },
	{ value: 2, label: __( '2 — Light' ) },
	{ value: 3, label: __( '3 — Balanced' ) },
	{ value: 4, label: __( '4 — Strong' ) },
	{ value: 5, label: __( '5 — Aggressive' ) },
];

/**
 * Is this a phone/tablet viewer, for the purpose of picking a speed?
 *
 * A DEVICE question, not a size one, which is why this asks about the pointer
 * rather than the viewport alone: a 400px-wide player sitting in a narrow
 * column on a desktop page is still a desktop viewer with a mouse, and giving
 * it the mobile curve because of its own width would be reading the wrong
 * thing entirely. The width test is only a fallback for browsers that do not
 * answer the pointer query.
 *
 * Separate speeds exist at all because the tolerance differs: a phone viewer
 * decides faster and sees a shorter bar, so the setting that feels brisk on a
 * desktop often reads as a glitch on a phone (and vice versa).
 */
export function isMobileViewer() {
	if ( typeof window === 'undefined' || ! window.matchMedia ) {
		return false;
	}
	const coarse = window.matchMedia( '(hover: none) and (pointer: coarse)' );
	return coarse.media !== 'not all' ? coarse.matches : window.innerWidth <= 768;
}

/** The speed to draw with, honouring the "use desktop speed" tie. */
export function resolveRapidSpeed( appearance = {}, isMobile = false ) {
	const desktop = appearance.rapidSpeed || RAPID_DEFAULT_SPEED;
	if ( ! isMobile || false !== appearance.rapidSpeedMobileSync ) {
		return desktop;
	}
	return appearance.rapidSpeedMobile || desktop;
}

/** Real progress ratio (0-1) → the ratio to draw. */
export function rapidRatio( ratio, speed = RAPID_DEFAULT_SPEED ) {
	const k = K_BY_SPEED[ speed ] || K_BY_SPEED[ RAPID_DEFAULT_SPEED ];
	const clamped = Math.max( 0, Math.min( 1, ratio || 0 ) );
	return Math.pow( clamped, 1 / k );
}

/**
 * Whether the bar can run at all, checked at RUNTIME rather than by source type.
 *
 * A live stream has no duration to map against — html5.js returns 0 for a
 * non-finite `el.duration` — and a bar with nothing to divide by would sit
 * frozen at zero for the whole broadcast. But liveness is not a property of
 * `source.type`: `hls`, `mux`, `bunny` and `gumlet` all serve VOD and live from
 * the same type, so an allowlist would wrongly strip the feature from every
 * VOD asset on those providers. Ask the duration instead, and fall back to the
 * ordinary scrubber when it cannot answer.
 */
export function rapidEligible( appearance = {}, duration = 0, isAudio = false ) {
	return 'rapid-engage' === appearance.seekBarStyle &&
		! isAudio &&
		duration > 0 &&
		isFinite( duration );
}
