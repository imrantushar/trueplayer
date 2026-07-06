import { beacon, rest } from '@Utils/rest';

/**
 * Client-side coverage tracker. Marks whole-seconds only while playback is
 * genuinely advancing (guards against seek jumps and rate cheating), and
 * heartbeats deltas to the server, which remains the source of truth.
 */
export class CoverageTracker {
	constructor( { videoId, getDuration, onState, preview = false } ) {
		this.videoId = videoId;
		this.getDuration = getDuration;
		this.onState = onState || ( () => {} );
		this.preview = preview;

		this.watched = new Set(); // all seconds ever marked
		this.unsent = new Set(); // seconds not yet flushed
		this.playTally = {}; // bucket -> seconds played THIS interval (incl repeats)
		this.sessionStarted = false; // has this play-session been counted yet
		this.lastTime = 0;
		this.lastFlush = Date.now();
		this.frontier = 0; // max marked second — used for anti-skip
		this.timer = null;
	}

	/** Called on every timeupdate while playing. */
	mark( currentTime ) {
		const sec = Math.floor( currentTime );
		const delta = currentTime - this.lastTime;
		// Only count forward, real-time-ish advances (<= ~1.5s per tick at 1x
		// with 4x rate headroom). Big jumps (seeks/skips) are ignored.
		if ( delta >= 0 && delta <= 6 ) {
			if ( ! this.watched.has( sec ) ) {
				this.watched.add( sec );
				this.unsent.add( sec );
			}
			if ( sec > this.frontier ) {
				this.frontier = sec;
			}
			// Replay tally: count every played second per 100-bucket, INCLUDING
			// repeats, so re-watched segments show up hotter than watch-once ones.
			const dur = this.getDuration() || 0;
			if ( dur > 0 ) {
				const bucket = Math.min( 99, Math.floor( ( sec / dur ) * 100 ) );
				this.playTally[ bucket ] = ( this.playTally[ bucket ] || 0 ) + 1;
			}
		}
		this.lastTime = currentTime;
	}

	/** Player calls this when a fresh play-session starts (initial play / replay). */
	newSession() {
		this.sessionStarted = false;
	}

	/** After a legitimate seek, resync the reference time. */
	resync( currentTime ) {
		this.lastTime = currentTime;
	}

	start( mediaGetter ) {
		this.mediaGetter = mediaGetter;
		// In preview mode we still track coverage locally (frontier/anti-skip)
		// but never hit the network.
		if ( ! this.preview ) {
			this.timer = setInterval( () => this.flush(), 10000 );
		}
	}

	toRanges( set ) {
		const arr = Array.from( set ).sort( ( a, b ) => a - b );
		const ranges = [];
		let s = null;
		let p = null;
		arr.forEach( ( n ) => {
			if ( s === null ) {
				s = n;
				p = n;
			} else if ( n === p + 1 ) {
				p = n;
			} else {
				ranges.push( [ s, p + 1 ] );
				s = n;
				p = n;
			}
		} );
		if ( s !== null ) {
			ranges.push( [ s, p + 1 ] );
		}
		return ranges;
	}

	async flush( final = false ) {
		if ( this.preview ) {
			this.unsent.clear();
			return;
		}
		const hasActivity = this.unsent.size > 0 || Object.keys( this.playTally ).length > 0;
		if ( ! hasActivity && ! final ) {
			return;
		}
		const ranges = this.toRanges( this.unsent );
		const plays = this.playTally;
		const now = Date.now();
		const realElapsed = Math.round( ( now - this.lastFlush ) / 1000 );
		this.lastFlush = now;
		const mediaTime = this.mediaGetter ? Math.floor( this.mediaGetter() ) : 0;
		const duration = Math.floor( this.getDuration() || 0 );

		// First heartbeat with real playback counts as a new view/session.
		const sessionStart = ! this.sessionStarted && Object.keys( plays ).length > 0;
		if ( sessionStart ) {
			this.sessionStarted = true;
		}

		this.unsent.clear();
		this.playTally = {};

		const body = { video: this.videoId, ranges, plays, sessionStart, duration, mediaTime, realElapsed };

		try {
			if ( final && navigator.sendBeacon ) {
				await beacon( 'progress', body );
			} else {
				const state = await rest.post( 'progress', body );
				this.onState( state );
			}
		} catch ( e ) {
			// Re-queue on failure so coverage + tally aren't lost.
			ranges.forEach( ( [ a, b ] ) => {
				for ( let i = a; i < b; i++ ) {
					this.unsent.add( i );
				}
			} );
			Object.keys( plays ).forEach( ( b ) => {
				this.playTally[ b ] = ( this.playTally[ b ] || 0 ) + plays[ b ];
			} );
			if ( sessionStart ) {
				this.sessionStarted = false;
			}
		}
	}

	stop() {
		if ( this.timer ) {
			clearInterval( this.timer );
			this.timer = null;
		}
	}
}
