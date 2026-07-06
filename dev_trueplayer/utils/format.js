/** Format seconds → m:ss or h:mm:ss. */
export function formatTime( sec ) {
	if ( ! isFinite( sec ) || sec < 0 ) {
		sec = 0;
	}
	sec = Math.floor( sec );
	const h = Math.floor( sec / 3600 );
	const m = Math.floor( ( sec % 3600 ) / 60 );
	const s = sec % 60;
	const pad = ( n ) => String( n ).padStart( 2, '0' );
	return h > 0 ? `${ h }:${ pad( m ) }:${ pad( s ) }` : `${ m }:${ pad( s ) }`;
}
