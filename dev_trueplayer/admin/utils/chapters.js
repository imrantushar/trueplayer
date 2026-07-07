/** Chapter parsing/formatting helpers for the editor. */

/** "1:30" | "01:02:03" | "90" → seconds (integer). null if unparseable. */
export function clockToSec( str ) {
	const s = String( str ).trim();
	if ( ! s ) {
		return null;
	}
	const parts = s.split( ':' ).map( ( p ) => Number( p ) );
	if ( parts.some( ( n ) => ! isFinite( n ) ) ) {
		return null;
	}
	return Math.round( parts.reduce( ( acc, n ) => acc * 60 + n, 0 ) );
}

/** seconds → "m:ss" or "h:mm:ss". */
export function secToClock( sec ) {
	sec = Math.max( 0, Math.floor( sec || 0 ) );
	const h = Math.floor( sec / 3600 );
	const m = Math.floor( ( sec % 3600 ) / 60 );
	const s = sec % 60;
	const pad = ( n ) => String( n ).padStart( 2, '0' );
	return h > 0 ? `${ h }:${ pad( m ) }:${ pad( s ) }` : `${ m }:${ pad( s ) }`;
}

/** "00:01:30.500" | "01:30,500" → seconds (float). */
function vttTimeToSec( str ) {
	const clean = String( str ).trim().replace( ',', '.' );
	const [ hms, ms ] = clean.split( '.' );
	const sec = clockToSec( hms );
	if ( sec === null ) {
		return null;
	}
	return ms ? sec + Number( `0.${ ms }` ) : sec;
}

/** Parse a WebVTT / SRT-ish blob into chapters (cue start → chapter, text → label). */
function parseVtt( text ) {
	const out = [];
	const blocks = text.replace( /^﻿/, '' ).split( /\r?\n\r?\n/ );
	blocks.forEach( ( b ) => {
		const lines = b.split( /\r?\n/ ).map( ( l ) => l.trim() ).filter( Boolean );
		const tl = lines.findIndex( ( l ) => l.includes( '-->' ) );
		if ( tl === -1 ) {
			return;
		}
		const start = lines[ tl ].split( '-->' )[ 0 ].trim().split( /\s+/ )[ 0 ];
		const at = vttTimeToSec( start );
		const label = lines.slice( tl + 1 ).join( ' ' ).replace( /<[^>]+>/g, '' ).trim();
		if ( at !== null && label ) {
			out.push( { at: Math.round( at ), label } );
		}
	} );
	return out;
}

/** Parse YouTube-description-style lines: "0:00 Intro", "[1:30] Topic", "2:05 - Wrap". */
function parseLines( text ) {
	const out = [];
	text.split( /\r?\n/ ).forEach( ( line ) => {
		const m = line.match( /^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*[-–—:.)]?\s*(.+?)\s*$/ );
		if ( m ) {
			const at = clockToSec( m[ 1 ] );
			if ( at !== null && m[ 2 ] ) {
				out.push( { at, label: m[ 2 ] } );
			}
		}
	} );
	return out;
}

/**
 * Parse pasted text (or a fetched caption file) into a sorted, de-duplicated
 * chapter list. Auto-detects WebVTT vs. a plain timestamp list.
 */
export function parseChapters( text ) {
	const raw = String( text || '' );
	const parsed = /WEBVTT/i.test( raw ) || raw.includes( '-->' ) ? parseVtt( raw ) : parseLines( raw );
	const seen = new Set();
	return parsed
		.sort( ( a, b ) => a.at - b.at )
		.filter( ( c ) => {
			if ( seen.has( c.at ) ) {
				return false;
			}
			seen.add( c.at );
			return true;
		} );
}
