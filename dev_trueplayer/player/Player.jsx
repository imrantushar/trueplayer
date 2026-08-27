import { useEffect, useRef, useState, useCallback, createPortal } from '@wordpress/element';
import { createProvider } from './providers';
import { CoverageTracker } from './coverage';
import { resolveCustomize, autoplayMode } from './customize';
import { gaEvent } from './ga';
import { rest } from '@Utils/rest';
import { supportsContainerPiP, cloneStylesInto } from './pip';
import Controls from './components/Controls';
import InfoPanel from './components/InfoPanel';
import Quiz from './components/Quiz';
import Optin from './components/Optin';
import Overlay from './components/Overlay';
import Layers from './components/Layers';
import TimedContent from './components/TimedContent';
import { LockScreen, BigPlay, Message, Spinner } from './components/Overlays';

const containerPipSupported = supportsContainerPiP();

const DEFAULT_GATING = { completionThreshold: 90, antiSkip: true, checkpoints: [], finalQuiz: null };

/** Best-effort filename for the download button — from the title, else the URL. */
function downloadFilename( url, title ) {
	let base = 'video';
	let ext = '';
	try {
		const path = new URL( url, window.location.href ).pathname.split( '/' ).pop() || '';
		if ( path.includes( '.' ) ) {
			ext = path.slice( path.lastIndexOf( '.' ) );
			base = path.slice( 0, path.lastIndexOf( '.' ) );
		} else if ( path ) {
			base = path;
		}
	} catch ( e ) {
		// keep defaults
	}
	const name = ( title || '' ).replace( /[\\/:*?"<>|]+/g, '' ).trim();
	return ( name || base || 'video' ) + ext;
}

function hexToRgba( hex, alpha ) {
	const m = /^#?([0-9a-f]{6})$/i.exec( hex || '' );
	if ( ! m ) {
		return `rgba(0,0,0,${ alpha })`;
	}
	const n = parseInt( m[ 1 ], 16 );
	return `rgba(${ ( n >> 16 ) & 255 },${ ( n >> 8 ) & 255 },${ n & 255 },${ alpha })`;
}

export default function Player( { videoId, config, title = '', preview = false, onEnded: onEndedProp, onDuration: onDurationProp, autoStart = false, previewCue = null } ) {
	const stageRef = useRef( null );
	const stickySentinelRef = useRef( null );
	const stickyDismissedRef = useRef( false ); // explicit close, until back at the top
	const pipWinRef = useRef( null );
	const containerRef = useRef( null );
	const providerRef = useRef( null );
	const coverageRef = useRef( null );
	const passedCheckpoints = useRef( new Set() );
	const furthestRef = useRef( 0 ); // furthest naturally-watched second (for no-skip)

	const gating = { ...DEFAULT_GATING, ...( config.gating || {} ) };
	// Anti-skip is an opt-in restriction the admin sets per video (Questions &
	// gating tab). DEFAULT_GATING.antiSkip is only a form default for that tab
	// — a video whose config has never been saved with gating at all must not
	// silently inherit it just because Pro happens to be active, or every
	// video's forward-seeking gets capped at "furthest watched" with no admin
	// choice behind it (this is what looked like "can't drag forward").
	if ( ! config.gating ) {
		gating.antiSkip = false;
	}
	const source = config.source || {};
	const branding = config.branding || {};
	const optin = config.optin || {};
	const optinDoneRef = useRef( false );
	const allOverlays = Array.isArray( config.overlays ) ? config.overlays : [];
	// CTA cards use the fire-once modal engine; text overlays are non-blocking
	// timed windows rendered over the picture.
	const overlays = allOverlays.filter( ( o ) => ( o.type || 'cta' ) !== 'text' );
	const textOverlays = allOverlays.filter( ( o ) => o.type === 'text' );
	const actionBar = config.actionBar || {};
	// Pro: interactive layers + protection (server strips both when free).
	const layers = Array.isArray( config.layers ) ? config.layers : [];
	const watermark = { ...( ( config.protection && config.protection.dynamicWatermark ) || {} ) };
	if ( preview && watermark.enabled && ! watermark.text ) {
		watermark.text = 'viewer@example.com'; // live text is resolved server-side
	}
	const firedOverlays = useRef( new Set() );
	const overlayActiveRef = useRef( false );
	// Text overlay the editor's eye toggle has hidden; syncTextOverlays skips it
	// until a new cue or a play releases it.
	const hiddenTextRef = useRef( null );
	const gaStartedRef = useRef( false );

	// "Player free, intelligence pro": watch-verification, quiz-gating and
	// opt-in only run with a pro license. In admin preview we simulate them so
	// the merchant can see how they'll behave.
	const proActive = !! ( typeof window !== 'undefined' && window.TruePlayerGlobal && window.TruePlayerGlobal.is_pro_active );
	const gatingOn = proActive || preview;

	const cz = resolveCustomize( config );
	const appearance = cz.appearance;
	const behavior = cz.behavior;

	// 'off' | 'muted' | 'sound' — the boolean `autoplay` (legacy) means muted.
	const apMode = autoplayMode( behavior );
	const autoplayOn = apMode !== 'off';

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
		muted: !! ( behavior.muted || ( autoplayOn && apMode !== 'sound' ) ), volume: 1, rate: 1, quality: 'auto', track: 'off',
	} );
	// Report the media duration up (used by the editor to clamp chapter/overlay times).
	useEffect( () => {
		if ( onDurationProp && ui.duration > 0 ) {
			onDurationProp( ui.duration );
		}
	}, [ ui.duration, onDurationProp ] );

	const [ gate, setGate ] = useState( null );
	const [ activeQuiz, setActiveQuiz ] = useState( null );
	const [ locked, setLocked ] = useState( false );
	const [ frontier, setFrontier ] = useState( 0 );
	const [ idle, setIdle ] = useState( false );
	const [ sticky, setSticky ] = useState( false );
	const [ pipWin, setPipWin ] = useState( null );
	const [ activeOptin, setActiveOptin ] = useState( false );
	const [ activeOverlay, setActiveOverlay ] = useState( null );
	const [ activeTextIds, setActiveTextIds ] = useState( [] );
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
				// Providers read `autoplay`/`muted` booleans; translate the mode.
				// `autoplaySound` lets html5 skip the forced mute (we retry muted
				// below if the browser's autoplay policy rejects it).
				const providerBehavior = {
					...behavior,
					autoplay: autoplayOn,
					autoplaySound: apMode === 'sound',
				};
				provider = await createProvider( containerRef.current, source, { behavior: providerBehavior, autoStart } );
			} catch ( e ) {
				// Surface the real cause — a blocked/neutered YouTube IFrame API,
				// a failed lazy provider chunk and a bad source URL all look
				// identical once this message is all the author sees.
				// eslint-disable-next-line no-console
				console.error( '[TruePlayer] provider failed to load', source.type, e );
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
					// Booted from a click-to-load poster or autoplay: begin playing
					// at once. Autoplay-with-sound gets one unmuted attempt; when the
					// browser's autoplay policy rejects it, retry muted (and if even
					// that fails, the big-play button stays as the fallback).
					const r = provider.play();
					if ( r && typeof r.catch === 'function' ) {
						r.catch( () => {
							if ( apMode === 'sound' ) {
								provider.setMuted( true );
								const retry = provider.play();
								if ( retry && typeof retry.catch === 'function' ) {
									retry.catch( () => {} );
								}
							}
						} );
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
				syncTextOverlays( t );
				sync();
			} );
			provider.on( 'durationchange', sync );
			provider.on( 'play', () => {
					if ( ! gaStartedRef.current ) {
						gaStartedRef.current = true;
						gaEvent( 'video_start', { video_id: videoId, video_title: title } );
					}
					// Playing on returns the preview to normal timed behaviour, so a
					// text overlay the editor's eye toggle hid becomes eligible again.
					hiddenTextRef.current = null;
					setStarted( true );
					sync();
				} );
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
	// while playing. Watches a fixed sentinel that stays put in the document
	// flow — NOT the stage itself, which flips to `position: fixed` once sticky
	// engages. Observing the stage directly caused a feedback loop (it leaves
	// its flow slot → the observer immediately reports it "visible" again in
	// its new fixed spot → sticky turns back off → it un-fixes and reports
	// "hidden" again → repeat), which is what showed up as flicker on scroll.
	useEffect( () => {
		if ( ! behavior.sticky || ! stickySentinelRef.current ) {
			return undefined;
		}
		const io = new IntersectionObserver(
			( entries ) => {
				if ( entries[ 0 ].isIntersecting ) {
					// Back at the top, main player in view — clear any earlier
					// dismissal so scrolling away again can re-dock it.
					stickyDismissedRef.current = false;
					setSticky( false );
				} else if ( ui.playing && ! stickyDismissedRef.current ) {
					setSticky( true );
				}
				// Otherwise (still out of view but paused, or explicitly dismissed):
				// leave `sticky` exactly as it is — pausing/seeking while docked
				// must not un-dock it, and a dismissal must not re-engage on its own.
			},
			{ threshold: 0.1 }
		);
		io.observe( stickySentinelRef.current );
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
	// Text overlays: timed show/hide windows — unlike CTAs they re-show whenever
	// the playhead re-enters their window (rewinds included).
	const syncTextOverlays = ( t ) => {
		if ( ! textOverlays.length ) {
			return;
		}
		const ids = textOverlays
			.filter( ( o ) => o.id !== hiddenTextRef.current )
			.filter( ( o ) => t >= ( parseFloat( o.start ) || 0 ) && ( ! o.end || t < parseFloat( o.end ) ) )
			.map( ( o ) => o.id );
		setActiveTextIds( ( prev ) => ( prev.length === ids.length && prev.every( ( id, i ) => id === ids[ i ] ) ? prev : ids ) );
	};

	const closeOverlay = () => {
		overlayActiveRef.current = false;
		setActiveOverlay( null );
	};

	// Editor only — the overlay list's eye button, which toggles. A cue with an
	// id seeks to that overlay's own time, pauses there and puts it on screen so
	// the author sees the card exactly as configured; a cue with `overlayId:
	// null` takes it back down. `token` changes on every click, which re-fires
	// this either way.
	const cueRef = useRef( null );
	const cuedTextRef = useRef( null ); // text overlay the eye currently has up
	useEffect( () => {
		if ( ! preview || ! previewCue || ! ready || cueRef.current === previewCue.token ) {
			return;
		}
		const p = providerRef.current;
		if ( ! p ) {
			return;
		}
		cueRef.current = previewCue.token;

		const o = previewCue.overlayId ? allOverlays.find( ( x ) => x.id === previewCue.overlayId ) : null;
		if ( ! o ) {
			// Toggled off (or the overlay is gone) — take down whatever the eye
			// put up. A text overlay also has to be suppressed, because we are
			// paused inside its window and syncTextOverlays would re-add it on
			// the very next timeupdate.
			const cued = cuedTextRef.current;
			hiddenTextRef.current = cued;
			cuedTextRef.current = null;
			overlayActiveRef.current = false;
			setActiveOverlay( null );
			// Drop only the one the eye raised — blanking the list would also
			// hide text overlays that are legitimately inside their window, and
			// a paused <video> fires no timeupdate to put them back.
			if ( cued ) {
				setActiveTextIds( ( prev ) => prev.filter( ( id ) => id !== cued ) );
			}
			return;
		}

		hiddenTextRef.current = null; // a new cue releases any earlier suppression
		setStarted( true );
		const isText = ( o.type || 'cta' ) === 'text';
		const at = isText
			? parseFloat( o.start ) || 0
			: ( o.trigger === 'end' ? Math.max( 0, p.getDuration() - 0.25 ) : parseFloat( o.at ) || 0 );
		p.seek( at );
		p.pause();
		if ( isText ) {
			cuedTextRef.current = o.id;
			setActiveTextIds( [ o.id ] );
		} else {
			cuedTextRef.current = null;
			// Mark it fired so playing on from here doesn't pop it a second time.
			firedOverlays.current.add( o.id );
			overlayActiveRef.current = true;
			setActiveOverlay( o );
		}
		sync();
	}, [ previewCue, ready ] );

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
		gaEvent( 'video_complete', { video_id: videoId, video_title: title } );
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
	const closePiP = () => {
		if ( pipWinRef.current ) {
			pipWinRef.current.close(); // triggers the 'pagehide' listener below
		}
	};

	// Container PiP (see pip.js): floats the *whole stage* — video/iframe and
	// our controls — into a real OS window. It's what makes PiP possible at
	// all for YouTube (whose iframe a native per-<video> PiP call can't reach)
	// and more reliable for Vimeo (independent of whether that specific embed
	// has Vimeo's own PiP enabled).
	const openContainerPiP = async () => {
		try {
			const win = await window.documentPictureInPicture.requestWindow( { width: 420, height: 236 } );
			cloneStylesInto( win.document );
			win.document.body.style.margin = '0';
			win.document.body.style.background = '#000';
			win.addEventListener( 'pagehide', () => {
				pipWinRef.current = null;
				setPipWin( null );
			}, { once: true } );
			pipWinRef.current = win;
			setPipWin( win );
			return true;
		} catch ( e ) {
			return false;
		}
	};

	const pip = async () => {
		if ( pipWinRef.current ) {
			closePiP();
			return;
		}
		if ( containerPipSupported && await openContainerPiP() ) {
			return;
		}
		// Fallback: native per-<video>/per-embed PiP (html5, Vimeo only — the
		// button is hidden entirely for sources with neither this nor the
		// fallback available, e.g. YouTube on a non-Chromium browser).
		const p = providerRef.current;
		if ( ! p || ! p.requestPiP ) {
			return;
		}
		try {
			// Toggle: clicking again while already in PiP (e.g. re-entered via
			// the OS controls) previously just re-requested it, which the
			// browser silently ignores/rejects — nothing visibly happened.
			const active = p.isPiPActive ? await p.isPiPActive() : false;
			await ( active ? p.exitPiP() : p.requestPiP() );
		} catch ( e ) {
			// unsupported for this source/browser — swallow
		}
	};

	// Close the floating window if the player unmounts entirely (a video
	// change alone doesn't unmount this component, so PiP intentionally
	// persists across e.g. a playlist auto-advancing to the next item).
	useEffect( () => {
		return () => {
			if ( pipWinRef.current ) {
				pipWinRef.current.close();
			}
		};
	}, [] );
	const download = async () => {
		const url = providerRef.current?.sourceUrl || source.src;
		if ( ! url ) {
			return;
		}
		// The `download` attribute is silently ignored by browsers for
		// cross-origin URLs — the anchor then just navigates the tab to the raw
		// file (a bare native video "panel" with no way back to the page). Fetch
		// it as a blob instead, which `download` always honors regardless of the
		// original resource's origin, so the page itself is never left.
		try {
			const res = await fetch( url );
			if ( ! res.ok ) {
				throw new Error( 'download fetch failed' );
			}
			const blobUrl = URL.createObjectURL( await res.blob() );
			const a = document.createElement( 'a' );
			a.href = blobUrl;
			a.download = downloadFilename( url, title );
			document.body.appendChild( a );
			a.click();
			a.remove();
			setTimeout( () => URL.revokeObjectURL( blobUrl ), 4000 );
		} catch ( e ) {
			// Truly unreachable via fetch (no CORS headers, network error, …) —
			// open in a new tab rather than navigating away with no way back.
			window.open( url, '_blank', 'noopener' );
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
	// Center play-button size override (0 = let each skin keep its own default).
	if ( appearance.playButtonSize ) {
		stageStyle[ '--tp-bigplay-size' ] = `${ appearance.playButtonSize }px`;
	}
	// Caption cue styling (html5-backed providers; embeds render their own).
	stageStyle[ '--tp-cap-scale' ] = ( appearance.captionSize || 100 ) / 100;
	stageStyle[ '--tp-cap-color' ] = appearance.captionColor || '#ffffff';
	stageStyle[ '--tp-cap-bg' ] = hexToRgba( appearance.captionBackground || '#000000', ( appearance.captionOpacity ?? 75 ) / 100 );
	// Aspect ratio (audio keeps its compact bar; sticky keeps the ratio too so
	// the mini player matches the video's shape).
	if ( source.mediaType !== 'audio' && appearance.aspectRatio && appearance.aspectRatio !== '16:9' ) {
		stageStyle.aspectRatio = appearance.aspectRatio === 'auto' ? 'auto' : appearance.aspectRatio.replace( ':', ' / ' );
	}

	const skin = appearance.skin || 'default';
	const stageClass = [
		'tp-stage',
		`tp-skin-${ skin }`,
		idle && ui.playing ? 'is-idle' : '',
		source.mediaType === 'audio' ? 'is-audio' : '',
		`tp-bar-${ appearance.controlBarStyle }`,
		`tp-play-${ appearance.playButtonStyle }`,
		// A real OS PiP window replaces the in-page floating corner — the two
		// floating mechanisms together would fight over `position: fixed`.
		( sticky && ! pipWin ) ? `tp-sticky tp-sticky-${ behavior.stickyPosition }` : '',
	].filter( Boolean ).join( ' ' );

	// Container PiP works regardless of provider (it just floats the whole
	// stage), so it can make the button available even where the provider has
	// no native fallback of its own (YouTube).
	const pipAvailable = containerPipSupported || !! providerRef.current?.capabilities?.pip;

	const stage = (
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div ref={ stageRef } className={ stageClass } style={ stageStyle } tabIndex={ 0 } onKeyDown={ onKeyDown }>
			{ sticky && ! pipWin && (
				<button
					className="tp-sticky-close"
					aria-label="Close"
					onClick={ () => {
						stickyDismissedRef.current = true;
						setSticky( false );
					} }
				>×</button>
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
			     Audio uses the compact art tile above instead of a full-bleed poster.
			     A provider-derived poster is framed for the stage, so it covers;
			     an author's own poster is contained so nothing is cropped. */ }
			{ source.poster && ! started && ! error && source.mediaType !== 'audio' && (
				<div
					className={ `tp-poster${ source.posterDerived ? ' is-cover' : '' }` }
					style={ { backgroundImage: `url("${ source.poster }")` } }
				/>
			) }

			{ branding.logo && (
				branding.logoUrl ? (
					<a
						className={ `tp-logo tp-logo-${ branding.logoPosition || 'top-right' } is-link` }
						style={ { opacity: branding.logoOpacity ?? 0.9 } }
						href={ branding.logoUrl }
						target="_blank"
						rel="noreferrer"
					>
						<img src={ branding.logo } alt="" />
					</a>
				) : (
					<img
						className={ `tp-logo tp-logo-${ branding.logoPosition || 'top-right' }` }
						style={ { opacity: branding.logoOpacity ?? 0.9 } }
						src={ branding.logo }
						alt=""
					/>
				)
			) }

			{ /* Non-blocking timed text overlays (title/info cards over the picture). */ }
			{ textOverlays
				.filter( ( o ) => activeTextIds.includes( o.id ) )
				.map( ( o ) => (
					<div
						key={ o.id }
						className={ `tp-text-overlay tp-pos-${ o.position || 'top-left' }` }
						style={ { background: hexToRgba( o.background || '#000000', ( o.bgOpacity ?? 60 ) / 100 ) } }
					>
						{ o.title && <strong className="tp-text-overlay-title">{ o.title }</strong> }
						{ o.text && <span className="tp-text-overlay-text">{ o.text }</span> }
					</div>
				) ) }

			{ /* Interactive layers (pro). */ }
			{ layers.length > 0 && ! activeQuiz && ! activeOptin && ! locked && (
				<Layers
					layers={ layers }
					current={ ui.current }
					videoId={ videoId }
					preview={ preview }
					onOptin={ ( { email } ) => ( preview ? Promise.resolve() : rest.post( 'optin', { video: videoId, email } ) ) }
				/>
			) }

			{ /* Dynamic watermark (pro): identity burned over the picture. */ }
			{ watermark.enabled && watermark.text && (
				<div
					className={ `tp-watermark${ watermark.drift !== false ? ' is-drifting' : '' }` }
					style={ { opacity: watermark.opacity ?? 0.35 } }
					aria-hidden="true"
				>
					{ watermark.text }
				</div>
			) }

			{ /* Persistent action bar. */ }
			{ actionBar.enabled && ( actionBar.text || actionBar.buttonLabel ) && (
				<div
					className={ `tp-actionbar tp-actionbar-${ actionBar.position === 'top' ? 'top' : 'bottom' }` }
					style={ actionBar.background ? { background: actionBar.background } : undefined }
				>
					{ actionBar.text && <span className="tp-actionbar-text">{ actionBar.text }</span> }
					{ actionBar.buttonLabel && (
						<a className="tp-actionbar-btn" href={ actionBar.buttonUrl || '#' } target="_blank" rel="noreferrer noopener">
							{ actionBar.buttonLabel }
						</a>
					) }
				</div>
			) }

			{ ! ready && ! error && <Spinner /> }
			{ error && <Message>{ error }</Message> }

			{ ready && ! ui.playing && ! locked && ! activeQuiz && ! activeOptin && ! error && appearance.bigPlay && source.mediaType !== 'audio' && <BigPlay onPlay={ playPause } /> }

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
					capabilities={ { ...providerRef.current?.capabilities, pip: pipAvailable } }
					controls={ cz.controls }
					speeds={ cz.speeds }
					skipSeconds={ cz.skipSeconds }
					scrubDisabled={ !! behavior.disableSeek }
					hidePiP={ sticky && ! pipWin }
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

	// Once `sticky` engages, the stage leaves the document flow (`position:
	// fixed`), so this slot reserves its normal footprint — matching the
	// aspect ratio it would otherwise render at — to avoid a layout jump, and
	// hosts the sentinel the observer above watches. Container PiP moves the
	// stage out entirely (into another window), so it reserves the same way.
	const slotStyle = ( sticky || pipWin )
		? ( source.mediaType === 'audio' ? { minHeight: '72px' } : { aspectRatio: stageStyle.aspectRatio || '16 / 9' } )
		: undefined;
	const stageInSlot = (
		<div className="tp-stage-slot" style={ slotStyle }>
			<span ref={ stickySentinelRef } className="tp-stage-sentinel" aria-hidden="true" />
			{ pipWin ? (
				<div className="tp-pip-placeholder">
					<p>Playing in a floating window</p>
					<button type="button" className="tp-pip-return" onClick={ closePiP }>Bring back</button>
				</div>
			) : stage }
		</div>
	);

	// Ambient skin: a blurred, oversized copy of the poster glows behind the
	// stage (the stage clips its own children, so the glow needs a wrapper).
	// The wrapper renders unconditionally for the skin — toggling it (e.g. on
	// sticky) would remount the stage and destroy the provider's media element.
	let content;
	if ( skin === 'ambient' && source.mediaType !== 'audio' ) {
		// Both children stay mounted (hidden via style) — removing the glow
		// would shift the stage's reconciliation slot and recreate its DOM.
		content = (
			<div className="tp-ambient-wrap">
				<div
					className="tp-ambient-glow"
					style={ {
						backgroundImage: source.poster ? `url("${ source.poster }")` : undefined,
						display: source.poster && ! sticky ? undefined : 'none',
					} }
					aria-hidden="true"
				/>
				{ stageInSlot }
			</div>
		);
	} else {
		content = stageInSlot;
	}

	return (
		<>
			{ content }
			{ /* Timed content region (pro): a block below the player that swaps
			     with the video timeline. Stays in flow under the stage. */ }
			{ gatingOn && <TimedContent config={ config } current={ ui.current } /> }
			{ /* The stage (video/iframe + controls) itself lives in the PiP
			     window once open — a portal, not a copy, so it's the exact same
			     live provider/DOM node, not a re-mounted one. */ }
			{ pipWin && createPortal( stage, pipWin.document.body ) }
		</>
	);
}
