/** Minimal event emitter shared by all media providers. */
export function createEmitter() {
	const map = new Map();
	return {
		on( event, cb ) {
			if ( ! map.has( event ) ) {
				map.set( event, new Set() );
			}
			map.get( event ).add( cb );
			return () => map.get( event ).delete( cb );
		},
		emit( event, payload ) {
			( map.get( event ) || [] ).forEach( ( cb ) => {
				try {
					cb( payload );
				} catch ( e ) {
					// swallow — one bad listener shouldn't break playback
				}
			} );
		},
		clear() {
			map.clear();
		},
	};
}
