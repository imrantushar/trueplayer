/**
 * Timed content region (pro) — rendered below the player. Shows the content of
 * whichever segment covers the current time. Segment content is pre-rendered
 * server-side (shortcodes resolved) into `html`; in admin preview it falls back
 * to the raw authored `content`.
 */
function activeItem( items, t ) {
	return ( items || [] ).find( ( it ) => {
		const start = parseFloat( it.start ) || 0;
		const end = it.end ? parseFloat( it.end ) : Infinity;
		return t >= start && t < end;
	} );
}

export default function TimedContent( { config, current } ) {
	const timed = config && config.timedContent;
	if ( ! timed || ! timed.enabled || ! timed.items || ! timed.items.length ) {
		return null;
	}
	const item = activeItem( timed.items, current );
	if ( ! item ) {
		return null;
	}
	const html = item.html != null ? item.html : item.content || '';
	if ( ! html ) {
		return null;
	}
	return (
		<div className="tp-timed-content" dangerouslySetInnerHTML={ { __html: html } } />
	);
}
