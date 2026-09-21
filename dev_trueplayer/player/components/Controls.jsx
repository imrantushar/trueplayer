import { useState, useMemo, useRef, useEffect } from '@wordpress/element';
import { formatTime } from '@Utils/format';
import { CONTROL_DEFAULTS } from '@Utils/controls';
import { __, __sprintf } from '@Utils/translation';

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
	// Track skip — a bar against a triangle, distinct from rewind/forward's
	// double chevrons so "previous track" doesn't read as "seek back".
	prev: 'M6 6h2v12H6zm3.5 6l8.5 6V6l-8.5 6z',
	next: 'M16 6h2v12h-2zm-2.5 6L5 6v12l8.5-6z',
	download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
	list: 'M3 5h13v2H3V5zm0 6h13v2H3v-2zm0 6h9v2H3v-2zm15.5-6L22 13l-3.5 2v-4z',
	cc: 'M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8.2 6.2H9.3v-.4H7.8v4.4h1.5v-.5h1.5v.8c0 .6-.5 1.1-1.1 1.1H7.4c-.6 0-1.1-.5-1.1-1.1V9.5c0-.6.5-1.1 1.1-1.1h2.3c.6 0 1.1.5 1.1 1.1v.7zm6.9 0h-1.5v-.4h-1.5v4.4h1.5v-.5h1.5v.8c0 .6-.5 1.1-1.1 1.1h-2.3c-.6 0-1.1-.5-1.1-1.1V9.5c0-.6.5-1.1 1.1-1.1h2.3c.6 0 1.1.5 1.1 1.1v.7z',
	// Points down when the group is closed; CSS rotates it 180° when open.
	chevron: 'M7.4 8.6L12 13.2l4.6-4.6L18 10l-6 6-6-6z',
};

/** The next rate in the cycle, wrapping back to the first. */
function nextRate( rates, current ) {
	const i = rates.indexOf( current );
	return rates[ ( i + 1 ) % rates.length ] ?? rates[ 0 ];
}

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

// Deterministic pseudo-waveform bar heights (0.2–1) seeded by the track, so an
// audio player looks like a waveform without decoding the file. Same seed →
// same shape every render.
function waveBars( seed, n ) {
	let s = ( seed || 1 ) >>> 0 || 1;
	const out = [];
	for ( let i = 0; i < n; i++ ) {
		s = ( s * 1103515245 + 12345 ) & 0x7fffffff;
		out.push( 0.2 + ( s % 1000 ) / 1000 * 0.8 );
	}
	return out;
}

function Scrubber( { current, duration, buffered, chapters, seekable, onSeek, waveform, waveSeed, disabled, prefer } ) {
	const [ hover, setHover ] = useState( null );
	// While dragging, the thumb/fill follow the pointer immediately instead of
	// waiting on the provider's (occasionally laggy) timeupdate — this is what
	// makes the scrubber feel grab-able instead of only click-to-seek. The
	// preview stays up after release too, until `current` actually catches up
	// to it — otherwise the thumb flashes back to the old spot while the seek
	// is still in flight (visible on network sources / unbuffered ranges).
	const [ drag, setDrag ] = useState( null ); // ratio 0..1, or null when not previewing
	const draggingRef = useRef( false ); // true only while the pointer is actually down
	const trackRef = useRef( null );
	const bars = useMemo( () => ( waveform ? waveBars( waveSeed, 56 ) : [] ), [ waveform, waveSeed ] );

	// Clamp once, in ratio space, so the preview we render and the position we
	// actually seek to always agree (a mismatch here is what left the preview
	// stuck when noSkip capped the seek short of the dragged ratio).
	const clampRatio = ( ratio ) => ( duration && seekable < duration ? Math.min( ratio, seekable / duration ) : ratio );

	const moveTo = ( clientX ) => {
		const rect = trackRef.current.getBoundingClientRect();
		const raw = rect.width ? Math.min( 1, Math.max( 0, ( clientX - rect.left ) / rect.width ) ) : 0;
		const ratio = clampRatio( raw );
		setDrag( ratio );
		onSeek( ratio * duration );
	};

	// Track the pointer on `window` for the duration of the drag rather than
	// relying on setPointerCapture's target reassignment — that can behave
	// inconsistently depending on what else is on the page (overlays, the
	// admin preview panel, etc.), which was leaving the thumb stuck in place.
	const onWindowMove = ( e ) => {
		if ( ! draggingRef.current ) {
			return;
		}
		moveTo( e.clientX );
	};
	const onWindowUp = () => {
		draggingRef.current = false;
		window.removeEventListener( 'pointermove', onWindowMove );
		window.removeEventListener( 'pointerup', onWindowUp );
		window.removeEventListener( 'pointercancel', onWindowUp );
	};

	const onPointerDown = ( e ) => {
		if ( disabled || ! duration ) {
			return;
		}
		draggingRef.current = true;
		moveTo( e.clientX );
		window.addEventListener( 'pointermove', onWindowMove );
		window.addEventListener( 'pointerup', onWindowUp );
		window.addEventListener( 'pointercancel', onWindowUp );
	};

	useEffect( () => onWindowUp, [] ); // eslint-disable-line react-hooks/exhaustive-deps -- unmount safety net only

	// Clear the preview once playback has genuinely reached it (or after a
	// timeout fallback, so a stalled/failed seek can't strand the thumb).
	useEffect( () => {
		if ( drag === null || draggingRef.current ) {
			return undefined;
		}
		if ( Math.abs( current - drag * duration ) < 0.35 ) {
			setDrag( null );
			return undefined;
		}
		const t = setTimeout( () => setDrag( null ), 1200 );
		return () => clearTimeout( t );
	}, [ current, drag, duration ] );

	const effectiveCurrent = drag !== null ? drag * duration : current;
	const pct = duration ? ( effectiveCurrent / duration ) * 100 : 0;
	const bpct = duration ? ( buffered / duration ) * 100 : 0;
	const spct = duration && seekable < duration ? ( seekable / duration ) * 100 : 100;

	// Chapters and the waveform are two renderings of the same track and only
	// one can win. Chapters used to take it unconditionally, which quietly
	// removed the waveform from any audio item that had them — invisible until
	// you noticed the bar had changed shape. `prefer` makes the choice explicit:
	// the minimal audio layout keeps its waveform (there, the waveform IS the
	// control), everything else still prefers chapter segments.
	const segs = prefer === 'waveform' ? [] : buildSegments( chapters, duration );
	const fill = ( value, start, end ) => {
		const span = end - start;
		return span > 0 ? Math.min( 100, Math.max( 0, ( ( value - start ) / span ) * 100 ) ) : 0;
	};

	return (
		<div
			ref={ trackRef }
			className={ `tp-scrubber${ disabled ? ' is-disabled' : '' }` }
			onPointerDown={ onPointerDown }
			role="slider"
			aria-valuenow={ Math.floor( current ) }
			aria-valuemax={ Math.floor( duration ) }
			aria-disabled={ disabled || undefined }
			tabIndex={ disabled ? -1 : 0 }
		>
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
								<div className="tp-seg-played" style={ { width: `${ fill( effectiveCurrent, s.start, s.end ) }%` } } />
							</div>
						);
					} ) }
					{ seekable < duration && <div className="tp-scrubber-lockline" style={ { left: `${ spct }%` } } /> }
					<div className="tp-scrubber-thumb" style={ { left: `${ pct }%` } } />
				</div>
			) : waveform ? (
				<div className="tp-wave">
					{ bars.map( ( h, i ) => (
						<span
							key={ i }
							className={ `tp-wave-bar ${ ( i + 0.5 ) / bars.length <= ( duration ? effectiveCurrent / duration : 0 ) ? 'is-played' : '' }` }
							style={ { height: `${ Math.round( h * 100 ) }%` } }
						/>
					) ) }
					{ seekable < duration && <div className="tp-scrubber-lockline" style={ { left: `${ spct }%` } } /> }
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

/**
 * Close a popup when a pointer lands outside it.
 *
 * Shared by the gear menu and the quality button's own popup. The trigger's own
 * click still toggles normally, since that click lands inside `wrapRef` too.
 *
 * @param {boolean}  open    Whether the popup is showing.
 * @param {Function} setOpen State setter for that.
 * @param {Object}   wrapRef Ref on the element that wraps trigger + popup.
 */
function useCloseOnOutside( open, setOpen, wrapRef ) {
	useEffect( () => {
		if ( ! open ) {
			return;
		}
		const onOutside = ( e ) => {
			if ( wrapRef.current && ! wrapRef.current.contains( e.target ) ) {
				setOpen( false );
			}
		};
		document.addEventListener( 'pointerdown', onOutside );
		return () => document.removeEventListener( 'pointerdown', onOutside );
	}, [ open ] );
}

/**
 * The one-tap quality control: the current level, as a button in the bar.
 *
 * Its own popup rather than a jump into the gear menu — a quality ladder is too
 * long to cycle through the way the speed button cycles rates, and reaching
 * into the gear menu's open state from out here would couple two popups that
 * are otherwise independent. Off by default; the gear menu still lists every
 * level either way.
 */
function QualityMenu( { qualities, quality, activeQuality, setQuality } ) {
	const [ open, setOpen ] = useState( false );
	const wrapRef = useRef( null );
	useCloseOnOutside( open, setOpen, wrapRef );

	const activeLabel = qualities.find( ( q ) => q.id === activeQuality )?.label || '';
	const selected = qualities.find( ( q ) => q.id === quality );
	// Under 'auto' the button names what is actually playing, not "Auto" — the
	// point of putting it in the bar is to see the answer without opening
	// anything.
	const buttonLabel = ( 'auto' === quality ? activeLabel : selected?.label ) || __( 'Auto' );

	return (
		<div className="tp-menu-wrap" ref={ wrapRef }>
			<button
				className={ `tp-btn tp-speed ${ 'auto' !== quality ? 'is-active' : '' }` }
				aria-label={ __( 'Quality' ) }
				aria-expanded={ open }
				onClick={ () => setOpen( ! open ) }
			>
				{ buttonLabel }
			</button>
			{ open && (
				<div className="tp-menu">
					<div className="tp-menu-section">{ __( 'Quality' ) }</div>
					{ qualities.map( ( q ) => (
						<button key={ q.id } className={ `tp-menu-item ${ q.id === quality ? 'is-active' : '' }` } onClick={ () => { setQuality( q.id ); setOpen( false ); } }>
							{ 'auto' === q.id && activeLabel
								? __sprintf( '%1$s (%2$s)', q.label, activeLabel )
								: q.label }
						</button>
					) ) }
				</div>
			) }
		</div>
	);
}

/**
 * One collapsible group in the gear menu.
 *
 * The header carries the group's CURRENT value, so a collapsed group still
 * answers what it is set to — without that, closing a group hides the very
 * thing the viewer opened the menu to check.
 *
 * The options stay mounted-on-demand (`open &&`) rather than hidden with CSS:
 * a closed group's buttons must not be reachable by Tab.
 *
 * @param {Object}   props
 * @param {string}   props.label    Group heading.
 * @param {string}   props.value    Current selection, shown on the header.
 * @param {boolean}  props.open     Whether the group is expanded.
 * @param {Function} props.onToggle Fired when the header is clicked.
 * @param {Object}   props.children The option rows.
 */
function MenuGroup( { label, value, open, onToggle, children } ) {
	return (
		<div className="tp-menu-group">
			<button
				type="button"
				className="tp-menu-toggle"
				aria-expanded={ open }
				onClick={ onToggle }
			>
				<span>{ label }</span>
				{ !! value && <span className="tp-menu-toggle-value">{ value }</span> }
				<svg className="tp-menu-chevron" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d={ P.chevron } />
				</svg>
			</button>
			{ open && children }
		</div>
	);
}

function Menu( { provider, rate, setRate, quality, activeQuality, setQuality, track, setTrack, speeds, qualities: qualityList } ) {
	const [ open, setOpen ] = useState( false );
	const wrapRef = useRef( null );
	const rates = speeds && speeds.length ? speeds : [ 0.5, 0.75, 1, 1.25, 1.5, 2 ];
	// Player owns the list (it arrives asynchronously and has to re-render the
	// menu when it does); the provider is only a fallback for the very first
	// render, before the qualitychange event has been seen.
	const qualities = qualityList && qualityList.length ? qualityList : ( provider?.getQualities?.() || [] );
	const tracks = provider?.getTextTracks?.() || [];
	// What `Auto` actually settled on, so the row reads "Auto (720p)" the way
	// every other player labels it, instead of hiding the answer.
	const activeLabel = qualities.find( ( q ) => q.id === activeQuality )?.label || '';

	/**
	 * Which groups are expanded, keyed by name.
	 *
	 * Independent toggles rather than an accordion: the panel is a fixed size
	 * and scrolls, so opening one group has no reason to close another, and a
	 * viewer comparing speed against quality would otherwise be fighting it.
	 * All start collapsed — the whole point of the group headers is that the
	 * menu opens as a short list of what can be changed.
	 */
	const [ groups, setGroups ] = useState( {} );
	const toggleGroup = ( name ) => setGroups( ( g ) => ( { ...g, [ name ]: ! g[ name ] } ) );

	// Reset to all-collapsed each time the menu is dismissed, so it always
	// opens in the same state rather than however it was left.
	useEffect( () => {
		if ( ! open ) {
			setGroups( {} );
		}
	}, [ open ] );

	const qualityLabel = ( () => {
		const sel = qualities.find( ( q ) => q.id === quality );
		if ( ! sel ) {
			return '';
		}
		return 'auto' === sel.id && activeLabel
			? __sprintf( '%1$s (%2$s)', sel.label, activeLabel )
			: sel.label;
	} )();
	const trackLabel = 'off' === track
		? __( 'Off' )
		: ( tracks.find( ( t ) => t.id === track )?.label || __( 'Off' ) );

	useCloseOnOutside( open, setOpen, wrapRef );

	return (
		<div className="tp-menu-wrap" ref={ wrapRef }>
			<button className="tp-btn" aria-label={ __( 'Settings' ) } onClick={ () => setOpen( ! open ) }>
				<Icon d={ P.gear } />
			</button>
			{ open && (
				<div className="tp-menu is-settings">
					{ /* Quality first: it is what a viewer on a struggling
					     connection opens this menu for, and burying it under the
					     speed list puts it below the fold on a short player.
					     Picking an option no longer closes the whole menu — the
					     group is a place to make several changes in. */ }
					{ qualities.length > 0 && (
						<MenuGroup
							label={ __( 'Quality' ) }
							value={ qualityLabel }
							open={ !! groups.quality }
							onToggle={ () => toggleGroup( 'quality' ) }
						>
							{ qualities.map( ( q ) => (
								<button key={ q.id } className={ `tp-menu-item ${ q.id === quality ? 'is-active' : '' }` } onClick={ () => setQuality( q.id ) }>
									{ 'auto' === q.id && activeLabel
										? __sprintf( '%1$s (%2$s)', q.label, activeLabel )
										: q.label }
								</button>
							) ) }
						</MenuGroup>
					) }
					<MenuGroup
						label={ __( 'Speed' ) }
						value={ 1 === rate ? __( 'Normal' ) : __sprintf( '%s×', rate ) }
						open={ !! groups.speed }
						onToggle={ () => toggleGroup( 'speed' ) }
					>
						{ rates.map( ( r ) => (
							<button key={ r } className={ `tp-menu-item ${ r === rate ? 'is-active' : '' }` } onClick={ () => setRate( r ) }>
								{ r === 1 ? __( 'Normal' ) : __sprintf( '%s×', r ) }
							</button>
						) ) }
					</MenuGroup>
					{ /* Subtitles gets the same treatment, not because it was
					     asked for but because a flat list under two collapsed
					     headers reads as a rendering fault. */ }
					{ tracks.length > 0 && (
						<MenuGroup
							label={ __( 'Subtitles' ) }
							value={ trackLabel }
							open={ !! groups.subtitles }
							onToggle={ () => toggleGroup( 'subtitles' ) }
						>
							<button className={ `tp-menu-item ${ track === 'off' ? 'is-active' : '' }` } onClick={ () => setTrack( 'off' ) }>{ __( 'Off' ) }</button>
							{ tracks.map( ( t ) => (
								<button key={ t.id } className={ `tp-menu-item ${ t.id === track ? 'is-active' : '' }` } onClick={ () => setTrack( t.id ) }>
									{ t.label }
								</button>
							) ) }
						</MenuGroup>
					) }
				</div>
			) }
		</div>
	);
}

export default function Controls( props ) {
	const {
		playing, current, duration, buffered, muted, volume, rate, quality, activeQuality, track, seekable,
		chapters, provider, capabilities, controls = {}, speeds, qualities = [], skipSeconds = 10, scrubDisabled, hidePiP,
		onPlayPause, onSeek, onVolume, onMute, onRate, onQuality, onTrack, onPiP, onFullscreen, onSkip, onDownload,
		onInfo, hasInfo, infoOpen, audio, title, waveSeed, onPrev, onNext, scrubberStyle,
	} = props;

	// Same list the gear menu offers, so the one-tap button and the menu can
	// never disagree about which rates exist.
	const rates = speeds && speeds.length ? speeds : [ 0.5, 0.75, 1, 1.25, 1.5, 2 ];

	// A key the caller resolved wins. Otherwise fall back to the registry's
	// declared default, and only then to `true`.
	//
	// The registry step is what makes a newly added control safe: `controls`
	// normally arrives already resolved (Player passes cz.controls, which is
	// built on CUSTOMIZE_DEFAULTS), but not every caller does that — and
	// without the middle step a control declared off, like `speed`, would
	// render for anyone whose stored config predates it.
	const show = ( key, fallback = true ) => {
		if ( controls[ key ] !== undefined ) {
			return controls[ key ];
		}
		return CONTROL_DEFAULTS[ key ] !== undefined ? CONTROL_DEFAULTS[ key ] : fallback;
	};

	// Read once for the caption button; the Menu reads its own copy for the
	// language list. Embeds report none, so the button never appears for them.
	const textTracks = provider?.getTextTracks?.() || [];
	// Turning captions on picks the track the author marked default, falling
	// back to the first — never 'off', which would make the button a no-op.
	const defaultTrackId = ( textTracks.find( ( t ) => t.isDefault ) || textTracks[ 0 ] || {} ).id ?? '0';
	const chapterNow = currentChapter( chapters, current, duration );

	return (
		<div className="tp-controls">
			{ audio && title && <div className="tp-audio-title" title={ title }>{ title }</div> }
			{ show( 'progress' ) && (
				<Scrubber current={ current } duration={ duration } buffered={ buffered } chapters={ chapters } seekable={ seekable } onSeek={ onSeek } waveform={ audio } waveSeed={ waveSeed } disabled={ scrubDisabled } prefer={ scrubberStyle } />
			) }
			<div className="tp-controls-row">
				{ /* Track navigation. The callback's presence is the availability
				     signal — a playlist passes one only when there is somewhere to
				     go, and a standalone player passes neither — so no media-type
				     or playlist check is needed here. */ }
				{ show( 'prev' ) && onPrev && (
					<button className="tp-btn" aria-label={ __( 'Previous track' ) } onClick={ onPrev }>
						<Icon d={ P.prev } />
					</button>
				) }
				{ show( 'play' ) && (
					<button className="tp-btn" aria-label={ playing ? __( 'Pause' ) : __( 'Play' ) } onClick={ onPlayPause }>
						<Icon d={ playing ? P.pause : P.play } />
					</button>
				) }
				{ /* Hidden, not merely inert, when the timeline is locked: a button
				     that visibly does nothing reads as a broken player. */ }
				{ show( 'rewind' ) && ! scrubDisabled && (
					<button className="tp-btn" aria-label={ __( 'Rewind' ) } onClick={ () => onSkip( -skipSeconds ) }>
						<Icon d={ P.rewind } />
					</button>
				) }
				{ show( 'forward' ) && ! scrubDisabled && (
					<button className="tp-btn" aria-label={ __( 'Fast forward' ) } onClick={ () => onSkip( skipSeconds ) }>
						<Icon d={ P.forward } />
					</button>
				) }
				{ show( 'next' ) && onNext && (
					<button className="tp-btn" aria-label={ __( 'Next track' ) } onClick={ onNext }>
						<Icon d={ P.next } />
					</button>
				) }
				{ show( 'mute' ) && (
					<button className="tp-btn" aria-label={ muted ? __( 'Unmute' ) : __( 'Mute' ) } onClick={ onMute }>
						<Icon d={ muted || volume === 0 ? P.mute : P.volume } />
					</button>
				) }
				{ show( 'volume' ) && (
					<input className="tp-volume" type="range" min="0" max="1" step="0.05" value={ muted ? 0 : volume } onChange={ ( e ) => onVolume( parseFloat( e.target.value ) ) } aria-label={ __( 'Volume' ) } />
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
				{ /* Playback speed as a one-tap control rather than three levels
				     into the gear menu — the thing podcast listeners reach for
				     most. Off by default; the gear menu still lists every rate. */ }
				{ show( 'speed' ) && capabilities?.rate !== false && (
					<button
						className={ `tp-btn tp-speed ${ rate !== 1 ? 'is-active' : '' }` }
						aria-label={ __( 'Playback speed' ) }
						onClick={ () => onRate( nextRate( rates, rate ) ) }
					>
						{ __sprintf( '%s\u00d7', rate ) }
					</button>
				) }
				{ show( 'quality' ) && capabilities?.quality && qualities.length > 0 && (
					<QualityMenu qualities={ qualities } quality={ quality } activeQuality={ activeQuality } setQuality={ onQuality } />
				) }
				{ show( 'download' ) && capabilities?.download && (
					<button className="tp-btn" aria-label={ __( 'Download' ) } onClick={ onDownload }>
						<Icon d={ P.download } />
					</button>
				) }
				{ show( 'chapters' ) && hasInfo && (
					<button className={ `tp-btn ${ infoOpen ? 'is-active' : '' }` } aria-label={ __( 'Chapters & transcript' ) } aria-pressed={ infoOpen } onClick={ onInfo }>
						<Icon d={ P.list } />
					</button>
				) }
				{ /* Captions are a one-tap control, not a setting: a viewer who needs
				     them needs them now, and burying the only way to switch them on
				     three levels into the gear menu is why `controls.captions` — a
				     toggle the editor has always offered — appeared to do nothing.
				     The menu still lists every track for picking a language. */ }
				{ show( 'captions' ) && textTracks.length > 0 && (
					<button
						className={ `tp-btn ${ track !== 'off' ? 'is-active' : '' }` }
						aria-label={ __( 'Subtitles' ) }
						aria-pressed={ track !== 'off' }
						onClick={ () => onTrack( track === 'off' ? defaultTrackId : 'off' ) }
					>
						<Icon d={ P.cc } />
					</button>
				) }
				{ show( 'settings' ) && (
					<Menu provider={ provider } rate={ rate } setRate={ onRate } quality={ quality } activeQuality={ activeQuality } setQuality={ onQuality } track={ track } setTrack={ onTrack } speeds={ speeds } qualities={ qualities } />
				) }
				{ show( 'pip' ) && capabilities?.pip && ! hidePiP && (
					<button className="tp-btn" aria-label={ __( 'Picture in picture' ) } onClick={ onPiP }>
						<Icon d={ P.pip } />
					</button>
				) }
				{ show( 'fullscreen' ) && capabilities?.fullscreen !== false && (
					<button className="tp-btn" aria-label={ __( 'Fullscreen' ) } onClick={ onFullscreen }>
						<Icon d={ P.full } />
					</button>
				) }
			</div>
		</div>
	);
}
