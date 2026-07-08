/**
 * "Container" Picture-in-Picture — floats the entire stage element (the
 * video/iframe *and* our custom controls) into a real OS-level floating
 * window via the Document Picture-in-Picture API.
 *
 * This is what makes PiP possible at all for YouTube/Vimeo: the standard
 * per-<video> `element.requestPictureInPicture()` can't reach into a
 * cross-origin embed's iframe, so those providers have no native PiP target
 * to hand the browser. Document PiP sidesteps that entirely — it just moves
 * our own DOM node (iframe and all) into a new always-on-top window, the
 * same way a portal would.
 *
 * Chromium-only (Chrome/Edge 116+) for now; callers should fall back to a
 * provider's own native PiP (html5, and Vimeo's SDK method) where this isn't
 * supported, and hide the button entirely where neither is available.
 */
export const supportsContainerPiP = () =>
	typeof window !== 'undefined' && !! window.documentPictureInPicture;

/** Clone the host page's stylesheets into the PiP window so the portaled stage keeps its styling. */
export function cloneStylesInto( doc ) {
	[ ...document.styleSheets ].forEach( ( sheet ) => {
		try {
			if ( sheet.href ) {
				const link = document.createElement( 'link' );
				link.rel = 'stylesheet';
				link.href = sheet.href;
				doc.head.appendChild( link );
				return;
			}
			const rules = [ ...sheet.cssRules ].map( ( r ) => r.cssText ).join( '\n' );
			const style = document.createElement( 'style' );
			style.textContent = rules;
			doc.head.appendChild( style );
		} catch ( e ) {
			// Cross-origin sheet with no accessible cssRules and no href — skip it.
		}
	} );
}
