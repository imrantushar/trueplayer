import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { formatTime } from '@Utils/format';
import { __, __sprintf } from '@Utils/translation';

/**
 * YouTube-style "In this video" drawer: Chapters + Transcript tabs that slide
 * in over the right of the player. Clicking a row jumps the video; the row for
 * the current position stays highlighted and auto-scrolls into view.
 *
 * Transcript cues load asynchronously (the browser parses the WebVTT track only
 * once it's enabled), so we poll getCues a few times after opening.
 */
export default function InfoPanel( { chapters = [], getCues, current, seekable, onSeek, onClose } ) {
	const hasChapters = chapters.length > 0;
	const [ cues, setCues ] = useState( () => ( getCues ? getCues() : [] ) );
	const hasTranscript = cues.length > 0;
	const [ tab, setTab ] = useState( hasChapters ? 'chapters' : 'transcript' );

	// Poll for cues after mount — WebVTT parsing is async.
	useEffect( () => {
		if ( ! getCues || cues.length ) {
			return undefined;
		}
		let tries = 0;
		let id;
		const load = () => {
			const c = getCues();
			if ( c.length ) {
				setCues( c );
			} else if ( tries++ < 12 ) {
				id = setTimeout( load, 300 );
			}
		};
		id = setTimeout( load, 200 );
		return () => clearTimeout( id );
	}, [ getCues, cues.length ] );

	// If chapters are absent, default the tab to transcript once it arrives.
	useEffect( () => {
		if ( ! hasChapters && hasTranscript ) {
			setTab( 'transcript' );
		}
	}, [ hasChapters, hasTranscript ] );

	const sortedChapters = useMemo(
		() => chapters.map( ( c, i ) => ( { ...c, _i: i } ) ).sort( ( a, b ) => a.at - b.at ),
		[ chapters ]
	);
	const activeChapter = useMemo( () => {
		let idx = -1;
		sortedChapters.forEach( ( c, i ) => {
			if ( current >= c.at - 0.25 ) {
				idx = i;
			}
		} );
		return idx;
	}, [ sortedChapters, current ] );
	const activeCue = useMemo( () => {
		let idx = -1;
		for ( let i = 0; i < cues.length; i++ ) {
			if ( current >= cues[ i ].start - 0.15 ) {
				idx = i;
			} else {
				break;
			}
		}
		return idx;
	}, [ cues, current ] );

	const listRef = useRef( null );
	const activeRef = useRef( null );
	useEffect( () => {
		if ( activeRef.current ) {
			activeRef.current.scrollIntoView( { block: 'nearest' } );
		}
	}, [ activeChapter, activeCue, tab ] );

	const jump = ( at ) => {
		if ( seekable !== undefined && at > seekable + 0.5 ) {
			return; // no-skip: can't jump past what's been watched
		}
		onSeek( at );
	};
	const blocked = ( at ) => seekable !== undefined && at > seekable + 0.5;

	return (
		<div className="tp-info" role="dialog" aria-label={ __( 'Chapters and transcript' ) }>
			<div className="tp-info-head">
				<div className="tp-info-tabs">
					{ hasChapters && (
						<button className={ `tp-info-tab ${ tab === 'chapters' ? 'is-active' : '' }` } onClick={ () => setTab( 'chapters' ) }>
							{ __( 'Chapters' ) }
						</button>
					) }
					{ hasTranscript && (
						<button className={ `tp-info-tab ${ tab === 'transcript' ? 'is-active' : '' }` } onClick={ () => setTab( 'transcript' ) }>
							{ __( 'Transcript' ) }
						</button>
					) }
				</div>
				<button className="tp-info-close" aria-label={ __( 'Close' ) } onClick={ onClose }>×</button>
			</div>

			<div className="tp-info-body" ref={ listRef }>
				{ tab === 'chapters' && sortedChapters.map( ( c, i ) => (
					<button
						key={ c._i }
						ref={ i === activeChapter ? activeRef : null }
						className={ `tp-info-row ${ i === activeChapter ? 'is-active' : '' } ${ blocked( c.at ) ? 'is-locked' : '' }` }
						onClick={ () => jump( c.at ) }
					>
						<span className="tp-info-time">{ formatTime( c.at ) }</span>
						<span className="tp-info-label">{ c.label || __sprintf( 'Chapter %d', i + 1 ) }</span>
					</button>
				) ) }

				{ tab === 'transcript' && ( hasTranscript ? cues.map( ( c, i ) => (
					<button
						key={ i }
						ref={ i === activeCue ? activeRef : null }
						className={ `tp-info-row tp-info-cue ${ i === activeCue ? 'is-active' : '' } ${ blocked( c.start ) ? 'is-locked' : '' }` }
						onClick={ () => jump( c.start ) }
					>
						<span className="tp-info-time">{ formatTime( c.start ) }</span>
						<span className="tp-info-label">{ c.text }</span>
					</button>
				) ) : (
					<p className="tp-info-empty">{ __( 'No transcript available for this video.' ) }</p>
				) ) }
			</div>
		</div>
	);
}
