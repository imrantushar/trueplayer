import { useEffect, useRef, useState, useCallback } from '@wordpress/element';
import { createProvider } from './providers';
import { CoverageTracker } from './coverage';
import { resolveCustomize } from './customize';
import { rest } from '@Utils/rest';
import Controls from './components/Controls';
import InfoPanel from './components/InfoPanel';
import Quiz from './components/Quiz';
import Optin from './components/Optin';
import Overlay from './components/Overlay';
import { LockScreen, BigPlay, Message, Spinner } from './components/Overlays';

const DEFAULT_GATING = { completionThreshold: 90, antiSkip: true, checkpoints: [], finalQuiz: null };

export default function Player( { videoId, config, title = '', preview = false, onEnded: onEndedProp, autoStart = false } ) {
	const stageRef = useRef( null );
	const containerRef = useRef( null );
	const providerRef = useRef( null );
	const coverageRef = useRef( null );
	const passedCheckpoints = useRef( new Set() );
	const furthestRef = useRef( 0 ); // furthest naturally-watched second (for no-skip)

	const gating = { ...DEFAULT_GATING, ...( config.gating || {} ) };
	const source = config.source || {};
	const branding = config.branding || {};
	const optin = config.optin || {};
	const optinDoneRef = useRef( false );
	const overlays = Array.isArray( config.overlays ) ? config.overlays : [];
	const firedOverlays = useRef( new Set() );
	const overlayActiveRef = useRef( false );

	// "Player free, intelligence pro": watch-verification, quiz-gating and
	// opt-in only run with a pro license. In admin preview we simulate them so
	// the merchant can see how they'll behave.
	const proActive = !! ( typeof window !== 'undefined' && window.TruePlayerGlobal && window.TruePlayerGlobal.is_pro_active );
	const gatingOn = proActive || preview;

	const cz = resolveCustomize( config );
	const appearance = cz.appearance;
	const behavior = cz.behavior;

	// "In this video" drawer: chapters (any provider) + transcript (from the
	// caption track on the html5-backed providers; embeds have no cue access).
	const chapterList = config.chapters || [];
	const isEmbedProvider = source.type === 'youtube' || source.type === 'vimeo';
	const hasInfo = chapterList.length > 0 || ( ! isEmbedProvider && ( source.subtitles || [] ).length > 0 );

	const [ ready, setReady ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ started, setStarted ] = useState( false );
	const [ ui, setUi ] = useState( {
		playing: false, current: 0, duration: 0, buffered: 0,
		muted: !! ( behavior.muted || behavior.autoplay ), volume: 1, rate: 1, quality: 'auto', track: 'off',
	} );
	const [ gate, setGate ] = useState( null );
	const [ activeQuiz, setActiveQuiz ] = useState( null );
	const [ locked, setLocked ] = useState( false );
	const [ frontier, setFrontier ] = useState( 0 );
	const [ idle, setIdle ] = useState( false );
	const [ sticky, setSticky ] = useState( false );
	const [ activeOptin, setActiveOptin ] = useState( false );
	const [ activeOverlay, setActiveOverlay ] = useState( null );
	const [ infoOpen, setInfoOpen ] = useState( false );

	const getCues = useCallback( () => ( providerRef.current?.getCues ? providerRef.current.getCues() : [] ), [] );

	const sync = useCallback( () => {
		const p = providerRef.current;
		if ( ! p ) {
			return;
		}
		setUi( ( s ) => ( {
			...s,
			playing: ! p.isPaused(),
			current: p.getCurrentTime(),
			duration: p.getDuration(),
			buffered: p.getBufferedEnd(),
			muted: p.isMuted(),
			volume: p.getVolume(),
			rate: p.getRate(),
		} ) );
	}, [] );

	useEffect( () => {
		let disposed = false;

		( async () => {
			// Premium sources are pro-only.
			if ( [ 'bunny', 'mux', 'hls' ].includes( source.type ) && ! gatingOn ) {
				setError( 'This video source requires TruePlayer Pro.' );
				return;
			}

			let gateState = null;
			if ( preview || ! proActive ) {
				// Free / preview: no server gate — always playable, no tracking.
				gateState = { canPlay: true, status: 'in_progress', completed: false, resumeAt: 0 };
			} else {
				try {
					gateState = await rest.get( `gate?video=${ videoId }` );
				} catch ( e ) {
					gateState = { canPlay: true };
				}
			}
			if ( disposed ) {
				return;
			}
			setGate( gateState );
			if ( gateState.canPlay === false ) {
				const messages = {
					login_required: 'Please log in to watch this video.',
					enroll_required: 'Enroll in this course to watch.',
					purchase_required: 'Purchase this course to watch.',
				};
				setError( gateState.message || messages[ gateState.reason ] || 'This video is not available.' );
				return;
			}
			if ( gateState.locked ) {
				setLocked( true );
			}

			let provider;
			try {
				provider = await createProvider( containerRef.current, source, { behavior, autoStart } );
			} catch ( e ) {
				setError( 'Unable to load the player.' );
				return;
			}
			if ( disposed ) {
				provider.destroy();
				return;
			}
			providerRef.current = provider;

			// Watch-verification tracking runs only with pro (or in preview).
			let tracker = null;
			if ( gatingOn ) {
				tracker = new CoverageTracker( {
					videoId,
					preview,
					getDuration: () => provider.getDuration(),
					onState: ( st ) => {
						if ( st && typeof st.percent === 'number' ) {
							setGate( ( g ) => ( { ...( g || {} ), ...st } ) );
							if ( st.status === 'in_progress' && locked ) {
								setLocked( false );
							}
						}
					},
				} );
				tracker.start( () => provider.getCurrentTime() );
				coverageRef.current = tracker;
			}

			// Resume position: server value wins, else localStorage (savePosition).
			let resumeAt = gateState.resumeAt || 0;
			if ( ! resumeAt && behavior.savePosition ) {
				const saved = parseInt( window.localStorage.getItem( `tp_pos_${ videoId }` ) || '0', 10 );
				if ( saved > 0 ) {
					resumeAt = saved;
				}
			}
			if ( resumeAt ) {
				if ( tracker ) {
					tracker.frontier = resumeAt;
				}
				furthestRef.current = resumeAt;
				setFrontier( resumeAt );
			}

			optinDoneRef.current = gatingOn ? !! window.localStorage.getItem( `tp_optin_${ videoId }` ) : true;

			provider.on( 'ready', () => {
				setReady( true );
				if ( resumeAt && resumeAt < provider.getDuration() - 2 ) {
					provider.seek( resumeAt );
				}
				// Pre-roll opt-in gate.
				if ( optin.enabled && optin.position === 'pre' && ! optinDoneRef.current ) {
					setActiveOptin( true );
				} else if ( autoStart && ! gateState.locked ) {
					// Booted from a click-to-load poster: begin playing at once. If
					// the browser blocks it (autoplay policy), the big-play button
					// stays visible as the fallback — so swallow the rejection.
					const r = provider.play();
					if ( r && typeof r.catch === 'function' ) {
						r.catch( () => {} );
					}
				}
				sync();
			} );
			provider.on( 'timeupdate', () => {
				const t = provider.getCurrentTime();
				if ( ! provider.isPaused() ) {
					// Advance the furthest-watched marker on natural playback only.
					if ( t > furthestRef.current && t - furthestRef.current < 6 ) {
						furthestRef.current = t;
					}
					if ( tracker ) {
						tracker.mark( t );
						if ( tracker.frontier > frontier ) {
							setFrontier( tracker.frontier );
						}
					}
					if ( behavior.savePosition ) {
						window.localStorage.setItem( `tp_pos_${ videoId }`, String( Math.floor( t ) ) );
					}
					if ( gatingOn && ! maybeOptin( t ) ) {
						maybeCheckpoint( t );
					}
					maybeOverlay( t );
				}
				sync();
			} );
			provider.on( 'durationchange', sync );
			provider.on( 'play', () => { setStarted( true ); sync(); } );
			provider.on( 'pause', () => { if ( tracker ) { tracker.flush(); } sync(); } );
			provider.on( 'playing', sync );
			provider.on( 'waiting', sync );
			provider.on( 'ratechange', sync );
			provider.on( 'volumechange', sync );
			provider.on( 'ended', onEnded );
			provider.on( 'error', () => setError( 'Playback error.' ) );
		} )();

		return () => {
			disposed = true;
			if ( coverageRef.current ) {
				coverageRef.current.flush( true );
				coverageRef.current.stop();
			}
			if ( providerRef.current ) {
				providerRef.current.destroy();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ videoId ] );

	useEffect( () => {
		const onHide = () => coverageRef.current && coverageRef.current.flush( true );
		document.addEventListener( 'visibilitychange', onHide );
		window.addEventListener( 'pagehide', onHide );
		return () => {
			document.removeEventListener( 'visibilitychange', onHide );
			window.removeEventListener( 'pagehide', onHide );
		};
	}, [] );

	// Sticky-on-scroll: pin the player to a corner when scrolled out of view
	// while playing.
	useEffect( () => {
		if ( ! behavior.sticky || ! stageRef.current ) {
			return undefined;
		}
		const io = new IntersectionObserver(
			( entries ) => setSticky( ! entries[ 0 ].isIntersecting && ui.playing ),
			{ threshold: 0.1 }
		);
		io.observe( stageRef.current );
		return () => io.disconnect();
	}, [ behavior.sticky, ui.playing ] );

	const maybeOptin = ( t ) => {
		if ( activeOptin || activeQuiz || optinDoneRef.current ) {
			return false;
		}
		if ( optin.enabled && optin.position === 'time' && t >= ( optin.at || 0 ) ) {
			providerRef.current.pause();
			setActiveOptin( true );
			return true;
		}
		return false;
	};

	const maybeCheckpoint = ( t ) => {
		if ( activeQuiz || activeOptin ) {
			return;
		}
		for ( const cp of gating.checkpoints || [] ) {
			if ( ! cp.questions || ! cp.questions.length ) {
				continue;
			}
			if ( passedCheckpoints.current.has( cp.id ) ) {
				continue;
			}
			if ( t >= cp.at ) {
				providerRef.current.pause();
				setActiveQuiz( { gateId: `checkpoint:${ cp.id }`, quiz: cp, title: cp.title || 'Checkpoint question' } );
				break;
			}
		}
	};

	// Time/pause-triggered marketing overlays. Deduped via a ref so a fired
	// overlay never re-shows until an explicit replay.
	const maybeOverlay = ( t ) => {
		if ( overlayActiveRef.current || ! overlays.length ) {
			return;
		}
		const due = overlays.find(
			( o ) => ( o.trigger || 'time' ) === 'time' && ! firedOverlays.current.has( o.id ) && t >= ( parseFloat( o.at ) || 0 )
		);
		if ( due ) {
			firedOverlays.current.add( due.id );
			overlayActiveRef.current = true;
			if ( due.pause && providerRef.current ) {
				providerRef.current.pause();
			}
			setActiveOverlay( due );
		}
	};
	const closeOverlay = () => {
		overlayActiveRef.current = false;
		setActiveOverlay( null );
	};
	const replayFromStart = () => {
		firedOverlays.current.clear();
		overlayActiveRef.current = false;
		setActiveOverlay( null );
		setStarted( false );
		if ( providerRef.current ) {
			providerRef.current.seek( 0 );
			providerRef.current.play();
		}
	};

	const onEnded = () => {
		if ( coverageRef.current ) {
			coverageRef.current.flush( true );
		}
		let gated = false;
		if ( gatingOn && gating.finalQuiz && gating.finalQuiz.questions && gating.finalQuiz.questions.length ) {
			setActiveQuiz( { gateId: 'final', quiz: gating.finalQuiz, title: gating.finalQuiz.title || 'Final quiz' } );
			gated = true;
		} else if ( gatingOn && optin.enabled && optin.position === 'end' && ! optinDoneRef.current ) {
			setActiveOptin( true );
			gated = true;
		} else if ( behavior.resetOnEnd ) {
			providerRef.current.seek( 0 );
			setStarted( false );
		}
		// End screen — takes precedence over playlist auto-advance.
		const endOverlay = overlays.find( ( o ) => o.trigger === 'end' );
		if ( ! gated && endOverlay && ! firedOverlays.current.has( endOverlay.id ) ) {
			firedOverlays.current.add( endOverlay.id );
			overlayActiveRef.current = true;
			setActiveOverlay( endOverlay );
			gated = true;
		}
		sync();
		// Playlist autoplay-next: only when nothing is gating the end.
		if ( ! gated && onEndedProp ) {
			onEndedProp();
		}
	};

	const finishOptin = () => {
		window.localStorage.setItem( `tp_optin_${ videoId }`, '1' );
		optinDoneRef.current = true;
		setActiveOptin( false );
		if ( optin.position !== 'end' && providerRef.current ) {
			providerRef.current.play();
		}
	};

	// Cap seeking to the furthest point watched when "no skip" (free behavior)
	// or pro anti-skip is on. Never in preview, and released once completed.
	const noSkipActive = ! preview && ! ( gate && gate.completed ) &&
		( behavior.noSkip || ( gatingOn && gating.antiSkip ) );
	const watchedTo = Math.max( furthestRef.current, frontier );
	const seekable = noSkipActive
		? Math.min( ui.duration, Math.max( watchedTo + 1.5, ui.current + 0.5 ) )
		: ui.duration;

	useEffect( () => {
		if ( ! behavior.hideControls ) {
			setIdle( false );
			return undefined;
		}
		let timer;
		const wake = () => {
			setIdle( false );
			clearTimeout( timer );
			timer = setTimeout( () => setIdle( true ), 2800 );
		};
		const node = stageRef.current;
		if ( node ) {
			node.addEventListener( 'mousemove', wake );
			node.addEventListener( 'touchstart', wake );
		}
		return () => {
			clearTimeout( timer );
			if ( node ) {
				node.removeEventListener( 'mousemove', wake );
				node.removeEventListener( 'touchstart', wake );
			}
		};
	}, [ behavior.hideControls ] );

	const playPause = () => {
		const p = providerRef.current;
		if ( ! p ) {
			return;
		}
		p.isPaused() ? p.play() : p.pause();
	};
	const seek = ( t ) => {
		const p = providerRef.current;
		if ( ! p ) {
			return;
		}
		p.seek( t );
		coverageRef.current && coverageRef.current.resync( t );
	};
	const skip = ( delta ) => {
		const p = providerRef.current;
		if ( ! p ) {
			return;
		}
		let t = p.getCurrentTime() + delta;
		t = Math.max( 0, delta > 0 ? Math.min( t, seekable ) : t );
		seek( t );
	};
	const setVolume = ( v ) => { providerRef.current.setVolume( v ); providerRef.current.setMuted( v === 0 ); };
	const toggleMute = () => providerRef.current.setMuted( ! providerRef.current.isMuted() );
	const setRate = ( r ) => providerRef.current.setRate( r );
	const setQuality = ( q ) => { providerRef.current.setQuality( q ); setUi( ( s ) => ( { ...s, quality: q } ) ); };
	const setTrack = ( id ) => { providerRef.current.setTextTrack( id === 'off' ? -1 : id ); setUi( ( s ) => ( { ...s, track: id } ) ); };
	const pip = () => providerRef.current.requestPiP().catch( () => {} );
	const download = () => {
		const url = providerRef.current?.sourceUrl || source.src;
		if ( url ) {
			const a = document.createElement( 'a' );
			a.href = url;
			a.download = '';
			a.click();
		}
	};
	const fullscreen = () => {
		const node = stageRef.current;
		if ( ! document.fullscreenElement ) {
			node.requestFullscreen && node.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	};

	const onKeyDown = ( e ) => {
		if ( activeQuiz ) {
			return;
		}
		const p = providerRef.current;
		if ( ! p ) {
			return;
		}
		switch ( e.key ) {
			case ' ': case 'k': e.preventDefault(); playPause(); break;
			case 'ArrowRight': skip( cz.skipSeconds ); break;
			case 'ArrowLeft': skip( -cz.skipSeconds ); break;
			case 'ArrowUp': setVolume( Math.min( 1, p.getVolume() + 0.1 ) ); break;
			case 'ArrowDown': setVolume( Math.max( 0, p.getVolume() - 0.1 ) ); break;
			case 'm': toggleMute(); break;
			case 'f': fullscreen(); break;
			default: break;
		}
	};

	const onQuizPass = () => {
		const q = activeQuiz;
		setActiveQuiz( null );
		if ( q.gateId.startsWith( 'checkpoint:' ) ) {
			passedCheckpoints.current.add( q.gateId.split( ':' )[ 1 ] );
			providerRef.current.play();
		} else {
			setGate( ( g ) => ( { ...( g || {} ), completed: true } ) );
			if ( optin.enabled && optin.position === 'end' && ! optinDoneRef.current ) {
				setActiveOptin( true );
			} else if ( behavior.resetOnEnd ) {
				providerRef.current.seek( 0 );
				setStarted( false );
			}
		}
	};
	const onQuizFail = () => {};
	const onQuizLocked = () => {
		setActiveQuiz( null );
		setLocked( true );
		setGate( ( g ) => ( { ...( g || {} ), locked: true, requireRewatch: true } ) );
	};
	const rewatch = () => {
		setLocked( false );
		passedCheckpoints.current = new Set();
		if ( coverageRef.current ) {
			coverageRef.current.newSession();
		}
		seek( 0 );
		providerRef.current.play();
	};

	const stageStyle = {
		'--tp-accent': appearance.accent,
		'--tp-radius': `${ appearance.roundness }px`,
	};
	if ( appearance.hoverColor ) {
		stageStyle[ '--tp-hover' ] = appearance.hoverColor;
	}

	const stageClass = [
		'tp-stage',
		idle && ui.playing ? 'is-idle' : '',
		source.mediaType === 'audio' ? 'is-audio' : '',
		`tp-bar-${ appearance.controlBarStyle }`,
		`tp-play-${ appearance.playButtonStyle }`,
		sticky ? `tp-sticky tp-sticky-${ behavior.stickyPosition }` : '',
	].filter( Boolean ).join( ' ' );

	return (
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div ref={ stageRef } className={ stageClass } style={ stageStyle } tabIndex={ 0 } onKeyDown={ onKeyDown }>
			{ sticky && (
				<button className="tp-sticky-close" aria-label="Close" onClick={ () => setSticky( false ) }>×</button>
			) }
			<div ref={ containerRef } className="tp-media-container" onClick={ () => ready && ! activeQuiz && playPause() } />

			{ /* Audio has no picture — show a compact "now playing" tile (album art
			     if provided, otherwise a note glyph) so the bar reads as a player. */ }
			{ source.mediaType === 'audio' && (
				<div className="tp-audio-art" aria-hidden="true">
					{ source.poster ? (
						<img src={ source.poster } alt="" />
					) : (
						<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" /></svg>
					) }
				</div>
			) }

			{ /* Click-shield for embedded providers (YouTube/Vimeo): captures pointer
			     events so their in-frame links — title, "Watch on YouTube", channel,
			     end-screen suggestions — can't be clicked through to leave the site.
			     Clicking still toggles play, exactly like the native players. */ }
			{ ( source.type === 'youtube' || source.type === 'vimeo' ) && ! activeQuiz && ! locked && ! error && (
				// eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
				<div className="tp-shield" aria-hidden="true" onClick={ () => ready && playPause() } />
			) }

			{ /* Universal poster: works for every provider (not just html5's poster attr).
			     Audio uses the compact art tile above instead of a full-bleed poster. */ }
			{ source.poster && ! started && ! error && source.mediaType !== 'audio' && (
				<div className="tp-poster" style={ { backgroundImage: `url("${ source.poster }")` } } />
			) }

			{ branding.logo && <img className="tp-logo" src={ branding.logo } alt="" /> }

			{ ! ready && ! error && <Spinner /> }
			{ error && <Message>{ error }</Message> }

			{ ready && ! started && ! locked && ! activeQuiz && ! activeOptin && ! error && appearance.bigPlay && source.mediaType !== 'audio' && <BigPlay onPlay={ playPause } /> }

			{ activeOptin && (
				<Optin
					videoId={ videoId }
					optin={ optin }
					preview={ preview }
					onDone={ finishOptin }
					onSkip={ finishOptin }
				/>
			) }

			{ activeOverlay && ! activeQuiz && ! activeOptin && ! locked && (
				<Overlay
					overlay={ activeOverlay }
					onClose={ closeOverlay }
					onReplay={ activeOverlay.trigger === 'end' ? replayFromStart : null }
				/>
			) }

			{ locked && ! activeQuiz && (
				<LockScreen requireRewatch={ gate && gate.requireRewatch } onRewatch={ rewatch } />
			) }

			{ activeQuiz && (
				<Quiz
					videoId={ videoId }
					gateId={ activeQuiz.gateId }
					quiz={ activeQuiz.quiz }
					title={ activeQuiz.title }
					preview={ preview }
					onPass={ onQuizPass }
					onFail={ onQuizFail }
					onLocked={ onQuizLocked }
				/>
			) }

			{ ready && ! error && (
				<Controls
					{ ...ui }
					seekable={ seekable }
					chapters={ config.chapters || [] }
					provider={ providerRef.current }
					capabilities={ providerRef.current?.capabilities }
					controls={ cz.controls }
					speeds={ cz.speeds }
					skipSeconds={ cz.skipSeconds }
					onPlayPause={ playPause }
					onSeek={ seek }
					onSkip={ skip }
					onVolume={ setVolume }
					onMute={ toggleMute }
					onRate={ setRate }
					onQuality={ setQuality }
					onTrack={ setTrack }
					onPiP={ pip }
					onDownload={ download }
					onFullscreen={ fullscreen }
					onInfo={ () => setInfoOpen( ( o ) => ! o ) }
					hasInfo={ hasInfo }
					infoOpen={ infoOpen }
					audio={ source.mediaType === 'audio' }
					title={ title }
					waveSeed={ videoId }
				/>
			) }

			{ infoOpen && ready && ! error && ! activeQuiz && ! locked && ! activeOptin && (
				<InfoPanel
					chapters={ chapterList }
					getCues={ getCues }
					current={ ui.current }
					seekable={ seekable }
					onSeek={ seek }
					onClose={ () => setInfoOpen( false ) }
				/>
			) }
		</div>
	);
}
