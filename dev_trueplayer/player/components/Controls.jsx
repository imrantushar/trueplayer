import { useState } from '@wordpress/element';
import { formatTime } from '@Utils/format';

const Icon = ( { d } ) => (
	<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
		<path d={ d } />
	</svg>
);
const P = {
	play: 'M8 5v14l11-7z',
	pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
	volume: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4z',
	mute: 'M3 9v6h4l5 5V4L7 9H3zm13 3l3 3 1.4-1.4L17.4 12l1.9-1.9L18 8.7 16 10.6 14 8.7 12.6 10l1.9 2-1.9 2 1.4 1.3 2-1.9z',
	full: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
	pip: 'M19 7h-8v6h8V7zm-2 4h-4V9h4v2zm4-8H3a2 2 0 00-2 2v14a2 2 0 002 2h18a2 2 0 002-2V5a2 2 0 00-2-2zm0 16H3V5h18v14z',
	gear: 'M19.4 13a7.8 7.8 0 000-2l2.1-1.6-2-3.4-2.5 1a7.6 7.6 0 00-1.7-1l-.4-2.6h-4l-.4 2.6a7.6 7.6 0 00-1.7 1l-2.5-1-2 3.4L4.6 11a7.8 7.8 0 000 2l-2.1 1.6 2 3.4 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.4L19.4 13zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z',
	rewind: 'M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z',
	forward: 'M13 6v12l8.5-6L13 6zM4 18l8.5-6L4 6v12z',
	download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
	list: 'M3 5h13v2H3V5zm0 6h13v2H3v-2zm0 6h9v2H3v-2zm15.5-6L22 13l-3.5 2v-4z',
};

function buildSegments( chapters, duration ) {
	if ( ! duration ) {
		return [];
	}
	const cs = ( chapters || [] )
		.filter( ( c ) => c.at >= 0 && c.at < duration )
		.sort( ( a, b ) => a.at - b.at );
	if ( ! cs.length ) {
		return [];
	}
	const segs = [];
	if ( cs[ 0 ].at > 0.5 ) {
		segs.push( { start: 0, end: cs[ 0 ].at, label: '' } );
	}
	cs.forEach( ( c, i ) => segs.push( { start: c.at, end: cs[ i + 1 ] ? cs[ i + 1 ].at : duration, label: c.label } ) );
	return segs;
}

function Scrubber( { current, duration, buffered, chapters, seekable, onSeek } ) {
	const [ hover, setHover ] = useState( null );
	const pct = duration ? ( current / duration ) * 100 : 0;
	const bpct = duration ? ( buffered / duration ) * 100 : 0;
	const spct = duration && seekable < duration ? ( seekable / duration ) * 100 : 100;

	const handle = ( e ) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const ratio = Math.min( 1, Math.max( 0, ( e.clientX - rect.left ) / rect.width ) );
		let t = ratio * duration;
		if ( seekable < duration ) {
			t = Math.min( t, seekable );
		}
		onSeek( t );
	};

	const segs = buildSegments( chapters, duration );
	const fill = ( value, start, end ) => {
		const span = end - start;
		return span > 0 ? Math.min( 100, Math.max( 0, ( ( value - start ) / span ) * 100 ) ) : 0;
	};

	return (
		<div className="tp-scrubber" onClick={ handle } role="slider" aria-valuenow={ Math.floor( current ) } aria-valuemax={ Math.floor( duration ) } tabIndex={ 0 }>
			{ hover && <div className="tp-chapter-tip" style={ { left: `${ hover.left }%` } }>{ hover.label }</div> }
			{ segs.length > 1 ? (
				<div className="tp-scrubber-segs">
					{ segs.map( ( s, i ) => {
						const left = ( s.start / duration ) * 100;
						const width = ( ( s.end - s.start ) / duration ) * 100;
						return (
							<div
								key={ i }
								className="tp-seg"
								style={ { left: `${ left }%`, width: `calc(${ width }% - 3px)` } }
								onMouseEnter={ () => s.label && setHover( { label: s.label, left: left + width / 2 } ) }
								onMouseLeave={ () => setHover( null ) }
							>
								<div className="tp-seg-buffered" style={ { width: `${ fill( buffered, s.start, s.end ) }%` } } />
								<div className="tp-seg-played" style={ { width: `${ fill( current, s.start, s.end ) }%` } } />
							</div>
						);
					} ) }
					{ seekable < duration && <div className="tp-scrubber-lockline" style={ { left: `${ spct }%` } } /> }
					<div className="tp-scrubber-thumb" style={ { left: `${ pct }%` } } />
				</div>
			) : (
				<div className="tp-scrubber-track">
					<div className="tp-scrubber-buffered" style={ { width: `${ bpct }%` } } />
					{ seekable < duration && <div className="tp-scrubber-lockline" style={ { left: `${ spct }%` } } /> }
					<div className="tp-scrubber-played" style={ { width: `${ pct }%` } } />
					<div className="tp-scrubber-thumb" style={ { left: `${ pct }%` } } />
				</div>
			) }
		</div>
	);
}

export function currentChapter( chapters, current, duration ) {
	const segs = buildSegments( chapters, duration );
	const seg = segs.find( ( s ) => current >= s.start && current < s.end );
	return seg && seg.label ? seg.label : '';
}

function Menu( { provider, rate, setRate, quality, setQuality, track, setTrack, speeds, showSpeed } ) {
	const [ open, setOpen ] = useState( false );
	const rates = speeds && speeds.length ? speeds : [ 0.5, 0.75, 1, 1.25, 1.5, 2 ];
	const qualities = provider?.getQualities?.() || [];
	const tracks = provider?.getTextTracks?.() || [];

	return (
		<div className="tp-menu-wrap">
			<button className="tp-btn" aria-label="Settings" onClick={ () => setOpen( ! open ) }>
				<Icon d={ P.gear } />
			</button>
			{ open && (
				<div className="tp-menu">
					{ showSpeed && (
						<>
							<div className="tp-menu-section">Speed</div>
							{ rates.map( ( r ) => (
								<button key={ r } className={ `tp-menu-item ${ r === rate ? 'is-active' : '' }` } onClick={ () => { setRate( r ); setOpen( false ); } }>
									{ r === 1 ? 'Normal' : `${ r }×` }
								</button>
							) ) }
						</>
					) }
					{ qualities.length > 0 && (
						<>
							<div className="tp-menu-section">Quality</div>
							{ qualities.map( ( q ) => (
								<button key={ q.id } className={ `tp-menu-item ${ q.id === quality ? 'is-active' : '' }` } onClick={ () => { setQuality( q.id ); setOpen( false ); } }>
									{ q.label }
								</button>
							) ) }
						</>
					) }
					{ tracks.length > 0 && (
						<>
							<div className="tp-menu-section">Subtitles</div>
							<button className={ `tp-menu-item ${ track === 'off' ? 'is-active' : '' }` } onClick={ () => { setTrack( 'off' ); setOpen( false ); } }>Off</button>
							{ tracks.map( ( t ) => (
								<button key={ t.id } className={ `tp-menu-item ${ t.id === track ? 'is-active' : '' }` } onClick={ () => { setTrack( t.id ); setOpen( false ); } }>
									{ t.label }
								</button>
							) ) }
						</>
					) }
				</div>
			) }
		</div>
	);
}

export default function Controls( props ) {
	const {
		playing, current, duration, buffered, muted, volume, rate, quality, track, seekable,
		chapters, provider, capabilities, controls = {}, speeds, skipSeconds = 10,
		onPlayPause, onSeek, onVolume, onMute, onRate, onQuality, onTrack, onPiP, onFullscreen, onSkip, onDownload,
		onInfo, hasInfo, infoOpen,
	} = props;

	const show = ( key, fallback = true ) => ( controls[ key ] === undefined ? fallback : controls[ key ] );
	const chapterNow = currentChapter( chapters, current, duration );
	const settingsHasContent =
		( show( 'speed' ) ) ||
		( provider?.getQualities?.().length > 0 ) ||
		( provider?.getTextTracks?.().length > 0 );

	return (
		<div className="tp-controls">
			{ show( 'progress' ) && (
				<Scrubber current={ current } duration={ duration } buffered={ buffered } chapters={ chapters } seekable={ seekable } onSeek={ onSeek } />
			) }
			<div className="tp-controls-row">
				{ show( 'play' ) && (
					<button className="tp-btn" aria-label={ playing ? 'Pause' : 'Play' } onClick={ onPlayPause }>
						<Icon d={ playing ? P.pause : P.play } />
					</button>
				) }
				{ show( 'rewind' ) && (
					<button className="tp-btn" aria-label="Rewind" onClick={ () => onSkip( -skipSeconds ) }>
						<Icon d={ P.rewind } />
					</button>
				) }
				{ show( 'forward' ) && (
					<button className="tp-btn" aria-label="Fast forward" onClick={ () => onSkip( skipSeconds ) }>
						<Icon d={ P.forward } />
					</button>
				) }
				{ show( 'mute' ) && (
					<button className="tp-btn" aria-label={ muted ? 'Unmute' : 'Mute' } onClick={ onMute }>
						<Icon d={ muted || volume === 0 ? P.mute : P.volume } />
					</button>
				) }
				{ show( 'volume' ) && (
					<input className="tp-volume" type="range" min="0" max="1" step="0.05" value={ muted ? 0 : volume } onChange={ ( e ) => onVolume( parseFloat( e.target.value ) ) } aria-label="Volume" />
				) }
				{ ( show( 'currentTime' ) || show( 'duration' ) ) && (
					<span className="tp-time">
						{ show( 'currentTime' ) && formatTime( current ) }
						{ show( 'currentTime' ) && show( 'duration' ) && ' / ' }
						{ show( 'duration' ) && formatTime( duration ) }
					</span>
				) }
				{ chapterNow && <span className="tp-chapter-now" title={ chapterNow }>· { chapterNow }</span> }
				<div className="tp-spacer" />
				{ show( 'download' ) && capabilities?.download && (
					<button className="tp-btn" aria-label="Download" onClick={ onDownload }>
						<Icon d={ P.download } />
					</button>
				) }
				{ hasInfo && (
					<button className={ `tp-btn ${ infoOpen ? 'is-active' : '' }` } aria-label="Chapters &amp; transcript" aria-pressed={ infoOpen } onClick={ onInfo }>
						<Icon d={ P.list } />
					</button>
				) }
				{ show( 'settings' ) && settingsHasContent && (
					<Menu provider={ provider } rate={ rate } setRate={ onRate } quality={ quality } setQuality={ onQuality } track={ track } setTrack={ onTrack } speeds={ speeds } showSpeed={ show( 'speed' ) } />
				) }
				{ show( 'pip' ) && capabilities?.pip && (
					<button className="tp-btn" aria-label="Picture in picture" onClick={ onPiP }>
						<Icon d={ P.pip } />
					</button>
				) }
				{ show( 'fullscreen' ) && capabilities?.fullscreen !== false && (
					<button className="tp-btn" aria-label="Fullscreen" onClick={ onFullscreen }>
						<Icon d={ P.full } />
					</button>
				) }
			</div>
		</div>
	);
}
