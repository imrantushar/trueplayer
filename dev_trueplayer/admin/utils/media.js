/**
 * Open the WordPress media library and return the chosen attachment URL.
 * Shared by the source (video/poster) and appearance (logo) pickers.
 *
 * @param {string}   type WP media type filter, e.g. 'image' or 'video'.
 * @param {Function} cb   Called with the selected attachment URL.
 */
export function pickMedia( type, cb ) {
	if ( ! window.wp || ! window.wp.media ) {
		return;
	}
	const frame = window.wp.media( {
		title: 'Select media',
		library: { type },
		multiple: false,
	} );
	frame.on( 'select', () => {
		const a = frame.state().get( 'selection' ).first().toJSON();
		cb( a.url );
	} );
	frame.open();
}
