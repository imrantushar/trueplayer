import { useEffect, useRef, useState, useCallback, createPortal } from '@wordpress/element';
import { createProvider } from './providers';
import { resolveCustomize, autoplayMode } from './customize';
import { gaEvent } from './ga';
import { rest } from '@Utils/rest';
import { isEmbedSource } from '@Utils/source-types';
import { usePlayerExt, useScrubMap, wrapStage } from '@Ext/player';
import { __ } from '@Utils/translation';
import { supportsContainerPiP, cloneStylesInto } from './pip';
import Controls from './components/Controls';
import InfoPanel from './components/InfoPanel';
import Optin from './components/Optin';
import Overlay from './components/Overlay';
import Layers from './components/Layers';
import { BigPlay, Message, Spinner } from './components/Overlays';

/** Frame width for ratios that would otherwise fill the column as a tall block. */
const FRAME_WIDTH = {
	'9:16': 'min(100%, max(34%, 280px))',
	'1:1': 'min(100%, max(62%, 280px))',
	'4:3': 'min(100%, max(80%, 280px))',
};

const containerPipSupported = supportsContainerPiP();

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

/**
 * The viewer's remembered quality choice.
 *
 * Site-wide rather than per-video (unlike `tp_pos_{id}`, which is a position
 * and only means anything for one video): a quality preference is about the
 * connection, and a per-video key would mean the choice never actually sticks.
 * Both accessors are guarded — localStorage throws outright in some privacy
 * modes, and losing the preference must never break playback.
 */
const QUALITY_KEY = 'tp_quality';

function storedQuality() {
	try {
		return window.localStorage.getItem( QUALITY_KEY ) || '';
	} catch ( e ) {
		return '';
	}
}

function rememberQuality( id ) {
	try {
		window.localStorage.setItem( QUALITY_KEY, id );
	} catch ( e ) {}
}

export default function Player( { videoId, config, title = '', preview = false, onEnded: onEndedProp, onDuration: onDurationProp, autoStart = false, previewCue = null, onPrev = null, onNext = null } ) {
	const stageRef = useRef( null );
	const stickySentinelRef = useRef( null );
	const stickyDismissedRef = useRef( false ); // explicit close, until back at the top
	const pipWinRef = useRef( null );
	const containerRef = useRef( null );
	const providerRef = useRef( null );
	const furthestRef = useRef( 0 ); // furthest naturally-watched second (for no-skip)
	// Scopes this player's ::cue rule to its own stage — several players can
	// share a page with different caption styling.
	const cueUid = useRef( Math.random().toString( 36 ).slice( 2, 9 ) ).current;

	const source = config.source || {};
	const branding = config.branding || {};
	const optinDoneRef = useRef( false );
	const allOverlays = Array.isArray( config.overlays ) ? config.overlays : [];
	// CTA cards use the fire-once modal engine; text overlays are non-blocking
	// timed windows rendered over the picture.
	const overlays = allOverlays.filter( ( o ) => ( o.type || 'cta' ) !== 'text' );
	const textOverlays = allOverlays.filter( ( o ) => o.type === 'text' );
	const actionBar = config.actionBar || {};
	const allLayers = Array.isArray( config.layers ) ? config.layers : [];
	/**
	 * The email-capture gate, which is an Email form layer in `mode: 'gate'`.
	 *
	 * Capture used to be a second feature with its own `config.optin` object and
	 * its own player path, so a video could carry two ways of asking for the
	 * same address and only one of them had a provider. There is exactly one
	 * source now; the old object is converted to a layer on upgrade and then
	 * removed (see Migrator).
	 */
	const optinGate = allLayers.find( ( l ) => 'form' === l.type && 'gate' === l.mode ) || null;
	// The gate is rendered by the player itself (it has to pause playback), so
	// the layer stack must not draw it a second time as an inline panel.
	const layers = optinGate ? allLayers.filter( ( l ) => l.id !== optinGate.id ) : allLayers;
	const optinKey = `tp_optin_${ videoId }_${ optinGate ? optinGate.id : 'none' }`;
	const firedOverlays = useRef( new Set() );
	const overlayActiveRef = useRef( false );
	// Text overlay the editor's eye toggle has hidden; syncTextOverlays skips it
	// until a new cue or a play releases it.
	const hiddenTextRef = useRef( null );
	const gaStartedRef = useRef( false );

	const cz = resolveCustomize( config );
	const appearance = cz.appearance;
	const behavior = cz.behavior;

	// 'off' | 'muted' | 'sound' — the boolean `autoplay` (legacy) means muted.
	const apMode = autoplayMode( behavior );
	const autoplayOn = apMode !== 'off';

	// "In this video" drawer: chapters (any provider) + transcript (from the
	// caption track on the html5-backed providers; embeds have no cue access).
	const chapterList = config.chapters || [];
	const isEmbedProvider = isEmbedSource( source.type );
	const hasInfo = chapterList.length > 0 || ( ! isEmbedProvider && ( source.subtitles || [] ).length > 0 );

	const [ ready, setReady ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ started, setStarted ] = useState( false );
	const [ ui, setUi ] = useState( {
		playing: false, current: 0, duration: 0, buffered: 0,
		muted: !! ( behavior.muted || ( autoplayOn && apMode !== 'sound' ) ), volume: 1, rate: 1, quality: 'auto', activeQuality: '', track: 'off',
	} );
	// Report the media duration up (used by the editor to clamp chapter/overlay times).
	useEffect( () => {
		if ( onDurationProp && ui.duration > 0 ) {
			onDurationProp( ui.duration );
		}
	}, [ ui.duration, onDurationProp ] );

	const [ idle, setIdle ] = useState( false );
	const [ sticky, setSticky ] = useState( false );
	const [ pipWin, setPipWin ] = useState( null );
	const [ activeOptin, setActiveOptin ] = useState( false );
	const [ activeOverlay, setActiveOverlay ] = useState( null );
	const [ activeTextIds, setActiveTextIds ] = useState( [] );
	const [ infoOpen, setInfoOpen ] = useState( false );
	// The media's real intrinsic ratio ('1920 / 1080'), once it can be read.
	const [ nativeRatio, setNativeRatio ] = useState( null );
	/**
	 * The quality levels the current provider offers.
	 *
	 * React state rather than a call to provider.getQualities() at render time:
	 * every provider fills its list asynchronously (an HLS manifest parse, a
	 * Vimeo round-trip, YouTube's first PLAYING state), so the list arrives
	 * well after mount and nothing else would tell React it had. The menu used
	 * to read the provider directly and only appeared because `timeupdate`
	 * happens to re-render constantly — which meant it never appeared at all
	 * for a viewer who opened the menu before pressing play.
	 */
	const [ qualities, setQualities ] = useState( [] );

	// Optional extension (gating, tracking, protection …). Inert by default:
	// every method resolves to "nothing to do" and every render slot is null.
	const ext = usePlayerExt( {
		videoId,
		config,
		title,
		preview,
		providerRef,
		furthestRef,
		current: ui.current,
		setStarted,
		// A blocking step the extension showed at the end has been cleared:
		// carry on with what the end of the video does next.
		onEndCleared: () => {
			if ( optinGate && 'end' === optinGate.trigger && ! optinDoneRef.current ) {
				setActiveOptin( true );
			} else if ( behavior.resetOnEnd && providerRef.current ) {
				providerRef.current.seek( 0 );
				setStarted( false );
			}
		},
	} );

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
			// Reconciled, not trusted. setQuality() writes this optimistically,
			// but a provider is free to refuse (YouTube's setPlaybackQuality is
			// advisory) or to move the level itself under `auto`. Only the
			// forced selection is sticky, so 'auto' is preserved as a selection
			// while getActiveQuality() supplies what it resolved to.
			activeQuality: p.getActiveQuality ? p.getActiveQuality() : '',
		} ) );
	}, [] );

	useEffect( () => {
		let disposed = false;
		// Belongs to the media being torn down, not the one coming in.
		setNativeRatio( null );

		( async () => {
			const gateState = await ext.load();
			if ( disposed ) {
				return;
			}
			if ( gateState.canPlay === false ) {
				setError( gateState.message || __( 'This video is not available.' ) );
				return;
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
				provider = await createProvider( containerRef.current, source, { behavior: providerBehavior, appearance, autoStart } );
			} catch ( e ) {
				// Surface the real cause — a blocked/neutered YouTube IFrame API,
				// a failed lazy provider chunk and a bad source URL all look
				// identical once this message is all the author sees.
				// eslint-disable-next-line no-console
				console.error( '[TruePlayer] provider failed to load', source.type, e );
				setError( __( 'Unable to load the player.' ) );
				return;
			}
			if ( disposed ) {
				provider.destroy();
				return;
			}
			providerRef.current = provider;

			// Resume position: server value wins, else localStorage (savePosition).
			let resumeAt = gateState.resumeAt || 0;
			// Not in the editor preview: it shares the `tp_pos_` key with the
			// real front end, so the preview would open part-way through the
			// video — easy to misread as reset-on-end being broken.
			if ( ! resumeAt && behavior.savePosition && ! preview ) {
				const saved = parseInt( window.localStorage.getItem( `tp_pos_${ videoId }` ) || '0', 10 );
				if ( saved > 0 ) {
					resumeAt = saved;
				}
			}
			if ( resumeAt ) {
				furthestRef.current = resumeAt;
			}
			ext.attach( provider, { ...gateState, resumeAt } );

			// Keyed per gate now that a video can carry more than one form, but the
			// pre-merge key still counts — someone who already subscribed must not
			// be asked again just because the feature moved.
			optinDoneRef.current = optinGate
				? !! ( window.localStorage.getItem( optinKey ) || window.localStorage.getItem( `tp_optin_${ videoId }` ) )
				: true;

			// The media element only when it is a real <video>/<audio> — YouTube
			// and Vimeo hand back a host <div> wrapping an iframe, which has no
			// intrinsic size to read.
			const mediaEl = () => {
				const el = provider.element;
				return el && typeof el.videoWidth === 'number' ? el : null;
			};
			// Measured unconditionally rather than only when the ratio is set to
			// `auto`: the author can switch to Auto in the editor long after the
			// provider is up, and this effect only re-runs on videoId.
			const measureNative = () => {
				const el = mediaEl();
				if ( el && el.videoWidth > 0 && el.videoHeight > 0 ) {
					setNativeRatio( `${ el.videoWidth } / ${ el.videoHeight }` );
					return true;
				}
				return false;
			};

			provider.on( 'ready', () => {
				setReady( true );
				// `loadedmetadata` usually already carries the dimensions, but an
				// HLS level can land later; <video> fires `resize` exactly when its
				// intrinsic size becomes known, so fall back to that.
				const el = mediaEl();
				if ( ! measureNative() && el ) {
					const onResize = () => {
						if ( measureNative() ) {
							el.removeEventListener( 'resize', onResize );
						}
					};
					el.addEventListener( 'resize', onResize );
				}
				// A track the author marked default is shown by the browser itself,
				// so read back what is actually on screen instead of trusting the
				// 'off' this state started on — otherwise the caption button and the
				// menu both report captions off while they are being rendered.
				const active = provider.getActiveTextTrack?.();
				if ( active ) {
					setUi( ( s ) => ( { ...s, track: active } ) );
				}
				if ( resumeAt && resumeAt < provider.getDuration() - 2 ) {
					provider.seek( resumeAt );
				}
				// Pre-roll opt-in gate.
				if ( optinGate && 'pre' === optinGate.trigger && ! optinDoneRef.current ) {
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
					ext.onTime( t );
					if ( behavior.savePosition && ! preview ) {
						window.localStorage.setItem( `tp_pos_${ videoId }`, String( Math.floor( t ) ) );
					}
					if ( ! maybeOptin( t ) ) {
						ext.onCue( t );
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
			provider.on( 'pause', () => { ext.onPause(); sync(); } );
			provider.on( 'playing', sync );
			provider.on( 'waiting', sync );
			provider.on( 'ratechange', sync );
			provider.on( 'volumechange', sync );
			/**
			 * Quality levels arrived (or the active one moved).
			 *
			 * Also the point where a remembered preference is applied: the
			 * levels do not exist until now, so there is nothing to match
			 * against any earlier. Re-applied on every list change because a
			 * provider can replace its list mid-playback (YouTube repopulates
			 * as the video buffers).
			 */
			provider.on( 'qualitychange', ( list ) => {
				const next = list || [];
				setQualities( next );
				const want = storedQuality();
				if ( want && 'auto' !== want && next.some( ( q ) => q.id === want ) ) {
					provider.setQuality( want );
					setUi( ( s ) => ( { ...s, quality: want } ) );
				}
				sync();
			} );
			provider.on( 'ended', onEnded );
			// Providers that know why they failed say so — YouTube's embed-disabled
			// case is the one an author most needs named, since the video plays
			// perfectly on youtube.com and nothing about the URL is wrong.
			provider.on( 'error', ( detail ) => setError(
				( detail && detail.message ) || __( 'Playback error.' )
			) );

			// A provider whose list was already filled before the subscription
			// above existed (a cached manifest parses fast) would otherwise
			// never announce it — nothing re-emits on subscribe.
			const levels = provider.getQualities ? provider.getQualities() : [];
			if ( levels.length ) {
				setQualities( levels );
			}
		} )();

		return () => {
			disposed = true;
			ext.dispose();
			if ( providerRef.current ) {
				providerRef.current.destroy();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ videoId ] );

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
		if ( activeOptin || ext.blocking || optinDoneRef.current ) {
			return false;
		}
		if ( optinGate && 'time' === ( optinGate.trigger || 'time' ) && t >= ( optinGate.start || 0 ) ) {
			providerRef.current.pause();
			setActiveOptin( true );
			return true;
		}
		return false;
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
	const cuedLayerRef = useRef( null ); // layer the eye currently has up
	// Preview-only overrides for the layer stack: one layer forced on screen
	// regardless of its window, and one suppressed after the eye let it go.
	// Without these the eye did nothing visible for an inline form — the default
	// window starts at 0, so the panel was already up, and nothing took it down.
	const [ forcedLayerId, setForcedLayerId ] = useState( null );
	const [ hiddenLayerId, setHiddenLayerId ] = useState( null );
	useEffect( () => {
		if ( ! preview || ! previewCue || ! ready || cueRef.current === previewCue.token ) {
			return;
		}
		const p = providerRef.current;
		if ( ! p ) {
			return;
		}
		cueRef.current = previewCue.token;

		// The eye on an Email form row. A layer cue and an overlay cue are the
		// same gesture — "show me this one now" — but a form has to be raised
		// differently depending on its mode, so it branches out here before the
		// overlay path.
		if ( undefined !== previewCue.layerId ) {
			const l = previewCue.layerId ? allLayers.find( ( x ) => x.id === previewCue.layerId ) : null;
			if ( ! l ) {
				// Toggled off, or the layer is gone — take down whatever the eye
				// put up. An inline panel has to be suppressed rather than merely
				// released: we are paused inside its window, so the normal rule
				// would simply draw it again.
				setActiveOptin( false );
				setHiddenLayerId( cuedLayerRef.current );
				setForcedLayerId( null );
				cuedLayerRef.current = null;
				return;
			}
			cuedLayerRef.current = l.id;
			setHiddenLayerId( null ); // a new cue releases any earlier suppression
			setStarted( true );
			const gateMode = 'inline' !== l.mode;
			// Where the layer is due. A gate on 'pre' or 'end' has no timestamp of
			// its own, so preview it at the edge it actually fires on.
			const at = gateMode
				? ( 'end' === l.trigger ? Math.max( 0, p.getDuration() - 0.25 ) : ( 'pre' === l.trigger ? 0 : parseFloat( l.start ) || 0 ) )
				: ( parseFloat( l.start ) || 0 );
			p.seek( at );
			p.pause();
			if ( gateMode ) {
				// Ignore the once-per-viewer rule while previewing: an author
				// asking to see the gate has asked to see it, and a previous
				// preview must not make it un-showable.
				optinDoneRef.current = false;
				setActiveOptin( true );
				setForcedLayerId( null );
			} else {
				// Forced rather than left to the time window: `seek` resolves
				// asynchronously, so the position the window is tested against is
				// still the old one when this returns.
				setActiveOptin( false );
				setForcedLayerId( l.id );
			}
			sync();
			return;
		}

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

	const onEnded = async () => {
		const extGated = await ext.onEnded();
		gaEvent( 'video_complete', { video_id: videoId, video_title: title } );
		let gated = extGated;
		if ( gated ) {
			// The extension claimed the end; it calls onEndCleared when done.
		} else if ( optinGate && 'end' === optinGate.trigger && ! optinDoneRef.current ) {
			setActiveOptin( true );
			gated = true;
		} else if ( behavior.resetOnEnd && ! behavior.loop ) {
			// Loop supersedes reset-on-end — both rewind, but only loop keeps
			// playing, and it is applied below once nothing has claimed the end.
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
		// Loop, once the quiz / opt-in / end screen have all declined the end.
		// Deliberately not the media element's own `loop` attribute: a looping
		// element never fires `ended`, so every branch above would be dead. An
		// explicit per-video Loop also wins over playlist auto-advance — an
		// author who wanted the next item would have left Loop off.
		if ( ! gated && behavior.loop ) {
			providerRef.current.seek( 0 );
			ext.onLoop();
			providerRef.current.play();
			return;
		}
		// Playlist autoplay-next: only when nothing is gating the end.
		if ( ! gated && onEndedProp ) {
			onEndedProp();
		}
	};

	const finishOptin = () => {
		// Only remembered when the author asked for it; a gate set to show every
		// time is a deliberate choice, not something to quietly suppress.
		if ( ! optinGate || false !== optinGate.dedupe ) {
			window.localStorage.setItem( optinKey, '1' );
		}
		optinDoneRef.current = true;
		setActiveOptin( false );
		if ( optinGate && 'end' !== optinGate.trigger && providerRef.current ) {
			providerRef.current.play();
		}
	};

	// Optional display mapping for the scrubber's fill ({ ratio, className,
	// hideClock, locksSeek }), or null for the ordinary bar.
	const scrubMap = useScrubMap( appearance, ui.duration, source.mediaType === 'audio', preview );
	const scrubLocks = !! ( scrubMap && scrubMap.locksSeek );

	// What the timeline lock actually is, everywhere below.
	const seekLocked = !! behavior.disableSeek || scrubLocks;

	// Cap seeking to the furthest point watched when "no skip" is on (never in
	// preview, released once the extension reports the video completed), and to
	// any limit an extension sets.
	const limits = [];
	if ( ! preview && ! ext.completed && behavior.noSkip ) {
		limits.push( Math.max( furthestRef.current + 1.5, ui.current + 0.5 ) );
	}
	if ( typeof ext.seekLimit === 'number' ) {
		limits.push( ext.seekLimit );
	}
	const seekable = limits.length ? Math.min( ui.duration, ...limits ) : ui.duration;

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
		ext.onSeek( t );
	};
	const skip = ( delta ) => {
		const p = providerRef.current;
		if ( ! p ) {
			return;
		}
		// "Disable the timeline entirely" has to mean the keyboard and the
		// rewind/forward buttons too, not just the scrubber — both land here.
		if ( seekLocked ) {
			return;
		}
		let t = p.getCurrentTime() + delta;
		t = Math.max( 0, delta > 0 ? Math.min( t, seekable ) : t );
		seek( t );
	};
	const setVolume = ( v ) => { providerRef.current.setVolume( v ); providerRef.current.setMuted( v === 0 ); };
	const toggleMute = () => providerRef.current.setMuted( ! providerRef.current.isMuted() );
	const setRate = ( r ) => providerRef.current.setRate( r );
	const setQuality = ( q ) => {
		providerRef.current.setQuality( q );
		rememberQuality( q );
		// Optimistic, then reconciled by sync() from getActiveQuality() — a
		// provider may refuse or override the request.
		setUi( ( s ) => ( { ...s, quality: q } ) );
	};
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
		//
		// Not under a locking scrub map: native PiP hands the raw <video> to the
		// browser, which draws its own scrubber from the real duration.
		if ( scrubLocks ) {
			return;
		}
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
		if ( ext.blocking ) {
			return;
		}
		const p = providerRef.current;
		if ( ! p ) {
			return;
		}
		switch ( e.key ) {
			case ' ': case 'k': e.preventDefault(); playPause(); break;
			// preventDefault on every arrow case: without it the page scrolls
			// (vertically for Up/Down, and some browsers/OSes treat Left/Right as
			// a back/forward or horizontal-scroll gesture too) at the same time
			// the player reacts, so a volume/seek key press also yanked the page.
			case 'ArrowRight': e.preventDefault(); skip( cz.skipSeconds ); break;
			case 'ArrowLeft': e.preventDefault(); skip( -cz.skipSeconds ); break;
			case 'ArrowUp': e.preventDefault(); setVolume( Math.min( 1, p.getVolume() + 0.1 ) ); break;
			case 'ArrowDown': e.preventDefault(); setVolume( Math.max( 0, p.getVolume() - 0.1 ) ); break;
			case 'm': toggleMute(); break;
			case 'f': fullscreen(); break;
			default: break;
		}
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
	//
	// "Auto (native)" must resolve to a real ratio, never the CSS keyword
	// `auto`. The stage is sized purely by `aspect-ratio` — every child of it
	// (.tp-media-container, .tp-media) is `position: absolute; inset: 0` and
	// contributes no height — so `aspect-ratio: auto` on a <div>, which has no
	// intrinsic ratio of its own, collapsed the whole player to 0px and left a
	// blank page with the video playing invisibly inside it.
	if ( source.mediaType !== 'audio' && appearance.aspectRatio && appearance.aspectRatio !== '16:9' ) {
		// `auto` must never reach CSS as-is. `aspect-ratio: auto` on a plain
		// <div> resolves to no ratio at all, and every child of the stage is
		// absolutely positioned, so the box collapsed to zero height and the
		// player vanished. Use the measured intrinsic ratio instead, holding
		// the 16:9 default until it is known — and permanently for iframe
		// embeds, which expose no intrinsic size to measure.
		stageStyle.aspectRatio = appearance.aspectRatio === 'auto'
			? ( nativeRatio || '16 / 9' )
			: appearance.aspectRatio.replace( ':', ' / ' );
		// A tall or square frame at full column width is a tower of black with
		// the video floating in it, so those ratios take a narrower, centred
		// frame (the facade in Shortcode::facade matches, to avoid a jump).
		if ( FRAME_WIDTH[ appearance.aspectRatio ] ) {
			stageStyle[ '--tp-stage-w' ] = FRAME_WIDTH[ appearance.aspectRatio ];
		}
	}

	// Caption cues are styled by a real rule carrying literal values, not by
	// the custom properties above. Chromium does not reliably resolve `var()`
	// inside `::cue` — the declaration is dropped and the cue silently falls
	// back to the UA default, which is why the background colour and opacity
	// controls appeared to do nothing. The properties are still set on the
	// stage so Custom CSS can read them.
	const cueCss = [
		`.tp-cap-${ cueUid } video::cue{`,
		`color:${ appearance.captionColor || '#ffffff' };`,
		`background-color:${ hexToRgba( appearance.captionBackground || '#000000', ( appearance.captionOpacity ?? 75 ) / 100 ) };`,
		`font-size:calc(1em * ${ ( appearance.captionSize || 100 ) / 100 });`,
		'}',
	].join( '' );

	const skin = appearance.skin || 'default';
	// The control bar is shown from the moment the media is ready, before the
	// first play as well as after it. It used to be held back until playback
	// started, on the grounds that there is nothing to scrub yet — but that
	// leaves the player looking inert, hides the duration and the volume and
	// captions controls that are perfectly meaningful on a paused video, and
	// gives an author no way to see their own control-bar styling without
	// starting the video. Auto-hide-while-playing (is-idle) is unaffected.
	const stageClass = [
		'tp-stage',
		`tp-cap-${ cueUid }`,
		`tp-skin-${ skin }`,
		idle && ui.playing ? 'is-idle' : '',
		source.mediaType === 'audio' ? 'is-audio' : '',
		// The audio bar's shape. It rides the className rather than a wrapper
		// element on purpose: the provider effect below is keyed on videoId
		// alone, so anything that changed the element tree when the author
		// picked a layout would tear down the live media element mid-playback.
		// A className diff costs nothing and works while playing.
		source.mediaType === 'audio' ? `tp-audio-${ appearance.audioLayout || 'compact' }` : '',
		`tp-bar-${ appearance.controlBarStyle }`,
		// A frame the author picked (not 16:9, not "match the video") is filled
		// edge to edge, cropping the video, rather than letterboxed in black.
		source.mediaType !== 'audio' && appearance.aspectRatio && ! [ '16:9', 'auto' ].includes( appearance.aspectRatio ) ? 'tp-fill' : '',
		`tp-play-${ appearance.playButtonStyle }`,
		// A real OS PiP window replaces the in-page floating corner — the two
		// floating mechanisms together would fight over `position: fixed`.
		( sticky && ! pipWin ) ? `tp-sticky tp-sticky-${ behavior.stickyPosition }` : '',
	].filter( Boolean ).join( ' ' );

	// Container PiP works regardless of provider (it just floats the whole
	// stage), so it can make the button available even where the provider has
	// no native fallback of its own (YouTube).
	// Container PiP keeps our controls and is safe always;
	// the native fallback exposes the browser's real scrubber, so under the
	// a locking scrub map it is not an option and the button goes away rather
	// than sitting there doing nothing.
	const pipAvailable = containerPipSupported ||
		( ! scrubLocks && !! providerRef.current?.capabilities?.pip );

	const stage = (
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div ref={ stageRef } className={ stageClass } style={ stageStyle } tabIndex={ 0 } onKeyDown={ onKeyDown }>
			<style>{ cueCss }</style>
			{ sticky && ! pipWin && (
				<button
					className="tp-sticky-close"
					aria-label={ __( 'Close' ) }
					onClick={ () => {
						stickyDismissedRef.current = true;
						setSticky( false );
					} }
				>×</button>
			) }
			<div ref={ containerRef } className="tp-media-container" onClick={ () => ready && ! ext.blocking && playPause() } />

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
			{ isEmbedProvider && ! ext.blocking && ! error && (
				// eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
				<div className="tp-shield" aria-hidden="true" onClick={ () => ready && playPause() } />
			) }

			{ /* Universal poster: works for every provider (not just html5's poster attr).
			     Audio uses the compact art tile above instead of a full-bleed poster. */ }
			{ source.poster && ! started && ! error && source.mediaType !== 'audio' && (
				<div className="tp-poster" style={ { backgroundImage: `url("${ source.poster }")` } } />
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

			{ /* Layers. */ }
			{ layers.length > 0 && ! ext.blocking && ! activeOptin && (
				<Layers
					layers={ layers }
					current={ ui.current }
					forcedId={ forcedLayerId }
					hiddenId={ hiddenLayerId }
					videoId={ videoId }
					preview={ preview }
					onOptin={ ( { email, name, layerId } ) => ( preview
						? Promise.resolve()
						: rest.post( 'optin', { video: videoId, email, name, layer: layerId } ) ) }
				/>
			) }

			{ ext.stage }

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

			{ ready && ! ui.playing && ! ext.blocking && ! activeOptin && ! error && appearance.bigPlay && source.mediaType !== 'audio' && <BigPlay onPlay={ playPause } /> }

			{ activeOptin && optinGate && (
				<Optin
					videoId={ videoId }
					optin={ optinGate }
					preview={ preview }
					onDone={ finishOptin }
					onSkip={ finishOptin }
				/>
			) }

			{ activeOverlay && ! ext.blocking && ! activeOptin && (
				<Overlay
					overlay={ activeOverlay }
					onClose={ closeOverlay }
					onReplay={ activeOverlay.trigger === 'end' ? replayFromStart : null }
				/>
			) }

			{ ext.overlay }

			{ ready && ! error && (
				<Controls
					{ ...ui }
					seekable={ seekable }
					chapters={ config.chapters || [] }
					provider={ providerRef.current }
					capabilities={ { ...providerRef.current?.capabilities, pip: pipAvailable } }
					controls={ cz.controls }
					speeds={ cz.speeds }
					qualities={ qualities }
					skipSeconds={ cz.skipSeconds }
					scrubDisabled={ seekLocked }
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
					/* Track navigation, forwarded straight from a playlist. Null for
					   a standalone player, which is what hides the buttons. */
					onPrev={ onPrev }
					onNext={ onNext }
					/* The minimal audio bar IS its waveform, so chapters must not
					   replace it there the way they do in the other layouts. */
					scrubberStyle={
						source.mediaType === 'audio' && ( appearance.audioLayout || 'compact' ) === 'minimal' ? 'waveform'
							: 'waveform' === appearance.seekBarStyle ? 'waveform'
								: undefined
					}
					scrubMap={ scrubMap }
				/>
			) }

			{ infoOpen && ready && ! error && ! ext.blocking && ! activeOptin && (
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
					<p>{ __( 'Playing in a floating window' ) }</p>
					<button type="button" className="tp-pip-return" onClick={ closePiP }>{ __( 'Bring back' ) }</button>
				</div>
			) : stage }
		</div>
	);

	// An extension may wrap the stage (it must keep `stageInSlot` mounted in a
	// stable position, or the provider's media element is recreated).
	const content = wrapStage( stageInSlot, { skin, source, sticky } );

	return (
		<>
			{ content }
			{ ext.below }
			{ /* The stage (video/iframe + controls) itself lives in the PiP
			     window once open — a portal, not a copy, so it's the exact same
			     live provider/DOM node, not a re-mounted one. */ }
			{ pipWin && createPortal( stage, pipWin.document.body ) }
		</>
	);
}
