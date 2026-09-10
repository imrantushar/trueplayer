import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import Player from './Player';
import { resolveCustomize } from './customize';
import { normalizeConfig } from '@Utils/audio';
import { __, __sprintf } from '@Utils/translation';

/**
 * Load-strategy resolution, mirrored from includes/shortcode.php's
 * Shortcode::render() — a playlist has no SSR facade pass, so the client
 * works this out from the video's own config payload instead.
 */
function resolveLoadStrategy( config ) {
	const behavior = ( config && config.customize && config.customize.behavior ) || {};
	const apMode = behavior.autoplayMode || '';
	const autoplay = apMode ? apMode !== 'off' : !! behavior.autoplay;
	let strategy = [ 'facade', 'eager', 'onvisible' ].includes( behavior.loadStrategy ) ? behavior.loadStrategy : 'facade';
	if ( autoplay ) {
		strategy = 'eager';
	}
	return { strategy, autoplay };
}

/**
 * The effective accent for a member video — built-in default, then the
 * site-wide default, then the video's own value (resolveCustomize handles the
 * layering, including the legacy `branding.accent`).
 */
function resolveAccent( config ) {
	return resolveCustomize( config || {} ).appearance.accent || '';
}

/** Static poster + play button — matches the standalone embed's facade
 *  markup/CSS (includes/shortcode.php's render_facade()) so `.tp-facade`
 *  styling applies as-is. */
function Facade( { config, onPlay } ) {
	const source = ( config && config.source ) || {};
	const isAudio = source.mediaType === 'audio';
	const poster = source.poster || '';
	const appearance = ( config && config.customize && config.customize.appearance ) || {};
	const accent = resolveAccent( config );
	const ratio = appearance.aspectRatio || '';

	const style = {};
	if ( accent ) {
		style[ '--tp-accent' ] = accent;
	}
	if ( ratio && ratio !== '16:9' && ! isAudio && /^\d+:\d+$/.test( ratio ) ) {
		style.aspectRatio = ratio.replace( ':', ' / ' );
	}

	return (
		<button type="button" className={ `tp-facade${ isAudio ? ' is-audio' : '' }` } style={ style } aria-label={ __( 'Play video' ) } onClick={ onPlay }>
			{ poster && <img className="tp-facade-poster" src={ poster } alt="" loading="lazy" decoding="async" /> }
			<span className="tp-facade-btn">
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
			</span>
		</button>
	);
}

/**
 * Renders a group of videos as a sidebar (main player + list) or a grid.
 * Clicking an item swaps the active video; autoplay-next advances on end.
 */
export default function Playlist( { data } ) {
	// Resolve each member's media type once, up front — the same job
	// mount.js's readConfig does for a standalone embed. Both the Facade and
	// the Player below read from these, so doing it here is what keeps them
	// agreeing about whether an item is audio.
	const items = useMemo(
		() => ( data.items || [] ).map( ( item ) => ( { ...item, config: normalizeConfig( item.config || {} ) } ) ),
		[ data.items ]
	);
	const first = items[ 0 ];
	const initial = first ? resolveLoadStrategy( first.config ) : { strategy: 'eager', autoplay: false };

	const [ active, setActive ] = useState( 0 );
	const [ autoStart, setAutoStart ] = useState( initial.autoplay );
	// Gates mounting the real <Player> (and the video element / provider it
	// creates on mount regardless of autoStart) the same way the standalone
	// embed's poster facade does — so a playlist sitting below the fold
	// doesn't pay the player-bundle + metadata-request cost on page load.
	const [ booted, setBooted ] = useState( initial.strategy === 'eager' );
	const containerRef = useRef( null );
	const item = items[ active ];

	useEffect( () => {
		if ( booted || initial.strategy !== 'onvisible' || ! ( 'IntersectionObserver' in window ) ) {
			return;
		}
		const node = containerRef.current;
		if ( ! node ) {
			return;
		}
		const io = new IntersectionObserver(
			( entries ) => {
				if ( entries.some( ( entry ) => entry.isIntersecting ) ) {
					io.disconnect();
					setBooted( true );
				}
			},
			{ rootMargin: '200px' }
		);
		io.observe( node );
		return () => io.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ booted ] );

	// Picking an item (or auto-advancing) should play it; the first render just
	// shows its poster so nothing loads until the viewer chooses to watch.
	const pick = ( i ) => {
		setActive( i );
		setAutoStart( true );
		setBooted( true );
	};
	// "Move to the next track" and "should we move on our own when this one
	// ends" were one function, which left no way to offer a Next button without
	// also enabling auto-advance. They are separate now; onEnded still consults
	// autoplayNext, so end-of-track behaviour is unchanged.
	const advance = () => {
		if ( active < items.length - 1 ) {
			pick( active + 1 );
		}
	};
	const goPrev = () => {
		if ( active > 0 ) {
			pick( active - 1 );
		}
	};
	const onTrackEnded = () => {
		if ( data.autoplayNext ) {
			advance();
		}
	};

	if ( ! item ) {
		return null;
	}

	// Grid shows poster thumbnails; the sidebar uses a compact icon so the list
	// stays slim (and titles get more room).
	const isGrid = data.layout === 'grid';

	const accent = resolveAccent( item.config );

	return (
		<div
			className={ `tp-pl tp-pl-${ data.layout }` }
			ref={ containerRef }
			style={ accent ? { '--tp-accent': accent } : undefined }
		>
			{ data.title && <div className="tp-pl-title">{ data.title }</div> }
			<div className="tp-pl-body">
				<div className="tp-pl-main">
					<div className="trueplayer-mount">
						{ booted ? (
							<Player
								key={ item.videoId }
								videoId={ item.videoId }
								config={ item.config }
								title={ item.title }
								autoStart={ autoStart }
								onEnded={ onTrackEnded }
								/* Null at the ends of the list — the player reads the
								   absence as "no such track" and hides the button. */
								onPrev={ active > 0 ? goPrev : null }
								onNext={ active < items.length - 1 ? advance : null }
							/>
						) : (
							<Facade config={ item.config } onPlay={ () => pick( active ) } />
						) }
					</div>
				</div>
				<div className="tp-pl-list">
					{ items.map( ( it, i ) => (
						<button key={ it.videoId } className={ `tp-pl-item ${ i === active ? 'is-active' : '' }` } onClick={ () => pick( i ) }>
							{ isGrid ? (
								<span className="tp-pl-thumb" style={ it.poster ? { backgroundImage: `url("${ it.poster }")` } : undefined }>
									{ ! it.poster && ( i + 1 ) }
								</span>
							) : (
								<span className="tp-pl-icon" aria-hidden="true">
									<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
								</span>
							) }
							{ data.showTitles && <span className="tp-pl-item-title">{ it.title || __sprintf( 'Video %d', i + 1 ) }</span> }
						</button>
					) ) }
				</div>
			</div>
		</div>
	);
}
