/**
 * The Email form layer's Style tab, expressed as CSS custom properties.
 *
 * Both halves of the layer — the blocking gate and the inline panel — read the
 * same `layer.style` object through this, so a colour set once applies whichever
 * mode the author switches to. Every property is omitted when unset rather than
 * written as an empty string, which is what lets the stylesheet's own fallback
 * (`var( --tp-of-bg, #fff )`) stand: a layer that has never been styled must
 * render exactly as it did before the tab existed.
 */

/** Colour keys → the custom property the stylesheet reads. */
const VARS = {
	bg: '--tp-of-bg',
	title: '--tp-of-title',
	muted: '--tp-of-muted',
	buttonBg: '--tp-of-btn-bg',
	buttonText: '--tp-of-btn-text',
};

/**
 * Length keys, written as plain numbers by the editor and emitted with a unit.
 * Kept apart from the colours because `0` is a legitimate value here — a
 * square corner, a borderless field — and must survive the "is it set?" test
 * that an empty colour has to fail.
 */
const LENGTHS = {
	buttonRadius: '--tp-of-btn-radius',
};

/**
 * @param {Object} layer An Email form layer.
 * @return {Object} Inline style object; empty when nothing has been set.
 */
export function formStyleVars( layer = {} ) {
	const style = layer.style || {};
	const out = {};
	Object.keys( VARS ).forEach( ( key ) => {
		const value = style[ key ];
		if ( 'string' === typeof value && '' !== value.trim() ) {
			out[ VARS[ key ] ] = value.trim();
		}
	} );
	Object.keys( LENGTHS ).forEach( ( key ) => {
		const value = style[ key ];
		if ( '' === value || null == value ) {
			return; // unset — leave the stylesheet's own value alone
		}
		const n = parseFloat( value );
		if ( Number.isFinite( n ) && n >= 0 ) {
			out[ LENGTHS[ key ] ] = `${ n }px`;
		}
	} );
	return out;
}
