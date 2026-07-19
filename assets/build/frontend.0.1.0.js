/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./dev_trueplayer/frontend.js"
/*!************************************!*\
  !*** ./dev_trueplayer/frontend.js ***!
  \************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _player_style_css__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./player/style.css */ "./dev_trueplayer/player/style.css");
/* harmony import */ var _Player_mount__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @Player/mount */ "./dev_trueplayer/player/mount.js");



/**
 * Frontend runtime entry. Scans the DOM for [data-trueplayer] mount nodes and
 * boots a player per node. The player engine itself (MediaProvider, controls,
 * coverage tracker, gate/quiz layers) is built out in Phases 1–3.
 */
function boot() {
  (0,_Player_mount__WEBPACK_IMPORTED_MODULE_1__.mountPlayers)();
  (0,_Player_mount__WEBPACK_IMPORTED_MODULE_1__.mountPlaylists)();
  (0,_Player_mount__WEBPACK_IMPORTED_MODULE_1__.mountPopups)();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/***/ },

/***/ "./dev_trueplayer/player/Player.jsx"
/*!******************************************!*\
  !*** ./dev_trueplayer/player/Player.jsx ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Player)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _providers__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./providers */ "./dev_trueplayer/player/providers/index.js");
/* harmony import */ var _coverage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./coverage */ "./dev_trueplayer/player/coverage.js");
/* harmony import */ var _customize__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./customize */ "./dev_trueplayer/player/customize.js");
/* harmony import */ var _ga__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./ga */ "./dev_trueplayer/player/ga.js");
/* harmony import */ var _Utils_rest__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @Utils/rest */ "./dev_trueplayer/utils/rest.js");
/* harmony import */ var _pip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./pip */ "./dev_trueplayer/player/pip.js");
/* harmony import */ var _components_Controls__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./components/Controls */ "./dev_trueplayer/player/components/Controls.jsx");
/* harmony import */ var _components_InfoPanel__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./components/InfoPanel */ "./dev_trueplayer/player/components/InfoPanel.jsx");
/* harmony import */ var _components_Quiz__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./components/Quiz */ "./dev_trueplayer/player/components/Quiz.jsx");
/* harmony import */ var _components_Optin__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./components/Optin */ "./dev_trueplayer/player/components/Optin.jsx");
/* harmony import */ var _components_Overlay__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./components/Overlay */ "./dev_trueplayer/player/components/Overlay.jsx");
/* harmony import */ var _components_Layers__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./components/Layers */ "./dev_trueplayer/player/components/Layers.jsx");
/* harmony import */ var _components_TimedContent__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./components/TimedContent */ "./dev_trueplayer/player/components/TimedContent.jsx");
/* harmony import */ var _components_Overlays__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./components/Overlays */ "./dev_trueplayer/player/components/Overlays.jsx");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__);
















const containerPipSupported = (0,_pip__WEBPACK_IMPORTED_MODULE_6__.supportsContainerPiP)();
const DEFAULT_GATING = {
  completionThreshold: 90,
  antiSkip: true,
  checkpoints: [],
  finalQuiz: null
};

/** Best-effort filename for the download button — from the title, else the URL. */
function downloadFilename(url, title) {
  let base = 'video';
  let ext = '';
  try {
    const path = new URL(url, window.location.href).pathname.split('/').pop() || '';
    if (path.includes('.')) {
      ext = path.slice(path.lastIndexOf('.'));
      base = path.slice(0, path.lastIndexOf('.'));
    } else if (path) {
      base = path;
    }
  } catch (e) {
    // keep defaults
  }
  const name = (title || '').replace(/[\\/:*?"<>|]+/g, '').trim();
  return (name || base || 'video') + ext;
}
function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) {
    return `rgba(0,0,0,${alpha})`;
  }
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${alpha})`;
}
function Player({
  videoId,
  config,
  title = '',
  preview = false,
  onEnded: onEndedProp,
  onDuration: onDurationProp,
  autoStart = false
}) {
  const stageRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const stickySentinelRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const stickyDismissedRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(false); // explicit close, until back at the top
  const pipWinRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const containerRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const providerRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const coverageRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const passedCheckpoints = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(new Set());
  const furthestRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(0); // furthest naturally-watched second (for no-skip)

  const gating = {
    ...DEFAULT_GATING,
    ...(config.gating || {})
  };
  // Anti-skip is an opt-in restriction the admin sets per video (Questions &
  // gating tab). DEFAULT_GATING.antiSkip is only a form default for that tab
  // — a video whose config has never been saved with gating at all must not
  // silently inherit it just because Pro happens to be active, or every
  // video's forward-seeking gets capped at "furthest watched" with no admin
  // choice behind it (this is what looked like "can't drag forward").
  if (!config.gating) {
    gating.antiSkip = false;
  }
  const source = config.source || {};
  const branding = config.branding || {};
  const optin = config.optin || {};
  const optinDoneRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(false);
  const allOverlays = Array.isArray(config.overlays) ? config.overlays : [];
  // CTA cards use the fire-once modal engine; text overlays are non-blocking
  // timed windows rendered over the picture.
  const overlays = allOverlays.filter(o => (o.type || 'cta') !== 'text');
  const textOverlays = allOverlays.filter(o => o.type === 'text');
  const actionBar = config.actionBar || {};
  // Pro: interactive layers + protection (server strips both when free).
  const layers = Array.isArray(config.layers) ? config.layers : [];
  const watermark = {
    ...(config.protection && config.protection.dynamicWatermark || {})
  };
  if (preview && watermark.enabled && !watermark.text) {
    watermark.text = 'viewer@example.com'; // live text is resolved server-side
  }
  const firedOverlays = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(new Set());
  const overlayActiveRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(false);
  const gaStartedRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(false);

  // "Player free, intelligence pro": watch-verification, quiz-gating and
  // opt-in only run with a pro license. In admin preview we simulate them so
  // the merchant can see how they'll behave.
  const proActive = !!(typeof window !== 'undefined' && window.TruePlayerGlobal && window.TruePlayerGlobal.is_pro_active);
  const gatingOn = proActive || preview;
  const cz = (0,_customize__WEBPACK_IMPORTED_MODULE_3__.resolveCustomize)(config);
  const appearance = cz.appearance;
  const behavior = cz.behavior;

  // 'off' | 'muted' | 'sound' — the boolean `autoplay` (legacy) means muted.
  const apMode = (0,_customize__WEBPACK_IMPORTED_MODULE_3__.autoplayMode)(behavior);
  const autoplayOn = apMode !== 'off';

  // "In this video" drawer: chapters (any provider) + transcript (from the
  // caption track on the html5-backed providers; embeds have no cue access).
  const chapterList = config.chapters || [];
  const isEmbedProvider = source.type === 'youtube' || source.type === 'vimeo';
  const hasInfo = chapterList.length > 0 || !isEmbedProvider && (source.subtitles || []).length > 0;
  const [ready, setReady] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [started, setStarted] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [ui, setUi] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({
    playing: false,
    current: 0,
    duration: 0,
    buffered: 0,
    muted: !!(behavior.muted || autoplayOn && apMode !== 'sound'),
    volume: 1,
    rate: 1,
    quality: 'auto',
    track: 'off'
  });
  // Report the media duration up (used by the editor to clamp chapter/overlay times).
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (onDurationProp && ui.duration > 0) {
      onDurationProp(ui.duration);
    }
  }, [ui.duration, onDurationProp]);
  const [gate, setGate] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [activeQuiz, setActiveQuiz] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [locked, setLocked] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [frontier, setFrontier] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const [idle, setIdle] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [sticky, setSticky] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [pipWin, setPipWin] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [activeOptin, setActiveOptin] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [activeOverlay, setActiveOverlay] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [activeTextIds, setActiveTextIds] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [infoOpen, setInfoOpen] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const getCues = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => providerRef.current?.getCues ? providerRef.current.getCues() : [], []);
  const sync = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    const p = providerRef.current;
    if (!p) {
      return;
    }
    setUi(s => ({
      ...s,
      playing: !p.isPaused(),
      current: p.getCurrentTime(),
      duration: p.getDuration(),
      buffered: p.getBufferedEnd(),
      muted: p.isMuted(),
      volume: p.getVolume(),
      rate: p.getRate()
    }));
  }, []);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    let disposed = false;
    (async () => {
      // Premium sources are pro-only.
      if (['bunny', 'mux', 'hls'].includes(source.type) && !gatingOn) {
        setError('This video source requires TruePlayer Pro.');
        return;
      }
      let gateState = null;
      if (preview || !proActive) {
        // Free / preview: no server gate — always playable, no tracking.
        gateState = {
          canPlay: true,
          status: 'in_progress',
          completed: false,
          resumeAt: 0
        };
      } else {
        try {
          gateState = await _Utils_rest__WEBPACK_IMPORTED_MODULE_5__.rest.get(`gate?video=${videoId}`);
        } catch (e) {
          gateState = {
            canPlay: true
          };
        }
      }
      if (disposed) {
        return;
      }
      setGate(gateState);
      if (gateState.canPlay === false) {
        const messages = {
          login_required: 'Please log in to watch this video.',
          enroll_required: 'Enroll in this course to watch.',
          purchase_required: 'Purchase this course to watch.'
        };
        setError(gateState.message || messages[gateState.reason] || 'This video is not available.');
        return;
      }
      if (gateState.locked) {
        setLocked(true);
      }
      let provider;
      try {
        // Providers read `autoplay`/`muted` booleans; translate the mode.
        // `autoplaySound` lets html5 skip the forced mute (we retry muted
        // below if the browser's autoplay policy rejects it).
        const providerBehavior = {
          ...behavior,
          autoplay: autoplayOn,
          autoplaySound: apMode === 'sound'
        };
        provider = await (0,_providers__WEBPACK_IMPORTED_MODULE_1__.createProvider)(containerRef.current, source, {
          behavior: providerBehavior,
          autoStart
        });
      } catch (e) {
        setError('Unable to load the player.');
        return;
      }
      if (disposed) {
        provider.destroy();
        return;
      }
      providerRef.current = provider;

      // Watch-verification tracking runs only with pro (or in preview).
      let tracker = null;
      if (gatingOn) {
        tracker = new _coverage__WEBPACK_IMPORTED_MODULE_2__.CoverageTracker({
          videoId,
          preview,
          getDuration: () => provider.getDuration(),
          onState: st => {
            if (st && typeof st.percent === 'number') {
              setGate(g => ({
                ...(g || {}),
                ...st
              }));
              if (st.status === 'in_progress' && locked) {
                setLocked(false);
              }
            }
          }
        });
        tracker.start(() => provider.getCurrentTime());
        coverageRef.current = tracker;
      }

      // Resume position: server value wins, else localStorage (savePosition).
      let resumeAt = gateState.resumeAt || 0;
      if (!resumeAt && behavior.savePosition) {
        const saved = parseInt(window.localStorage.getItem(`tp_pos_${videoId}`) || '0', 10);
        if (saved > 0) {
          resumeAt = saved;
        }
      }
      if (resumeAt) {
        if (tracker) {
          tracker.frontier = resumeAt;
        }
        furthestRef.current = resumeAt;
        setFrontier(resumeAt);
      }
      optinDoneRef.current = gatingOn ? !!window.localStorage.getItem(`tp_optin_${videoId}`) : true;
      provider.on('ready', () => {
        setReady(true);
        if (resumeAt && resumeAt < provider.getDuration() - 2) {
          provider.seek(resumeAt);
        }
        // Pre-roll opt-in gate.
        if (optin.enabled && optin.position === 'pre' && !optinDoneRef.current) {
          setActiveOptin(true);
        } else if (autoStart && !gateState.locked) {
          // Booted from a click-to-load poster or autoplay: begin playing
          // at once. Autoplay-with-sound gets one unmuted attempt; when the
          // browser's autoplay policy rejects it, retry muted (and if even
          // that fails, the big-play button stays as the fallback).
          const r = provider.play();
          if (r && typeof r.catch === 'function') {
            r.catch(() => {
              if (apMode === 'sound') {
                provider.setMuted(true);
                const retry = provider.play();
                if (retry && typeof retry.catch === 'function') {
                  retry.catch(() => {});
                }
              }
            });
          }
        }
        sync();
      });
      provider.on('timeupdate', () => {
        const t = provider.getCurrentTime();
        if (!provider.isPaused()) {
          // Advance the furthest-watched marker on natural playback only.
          if (t > furthestRef.current && t - furthestRef.current < 6) {
            furthestRef.current = t;
          }
          if (tracker) {
            tracker.mark(t);
            if (tracker.frontier > frontier) {
              setFrontier(tracker.frontier);
            }
          }
          if (behavior.savePosition) {
            window.localStorage.setItem(`tp_pos_${videoId}`, String(Math.floor(t)));
          }
          if (gatingOn && !maybeOptin(t)) {
            maybeCheckpoint(t);
          }
          maybeOverlay(t);
        }
        syncTextOverlays(t);
        sync();
      });
      provider.on('durationchange', sync);
      provider.on('play', () => {
        if (!gaStartedRef.current) {
          gaStartedRef.current = true;
          (0,_ga__WEBPACK_IMPORTED_MODULE_4__.gaEvent)('video_start', {
            video_id: videoId,
            video_title: title
          });
        }
        setStarted(true);
        sync();
      });
      provider.on('pause', () => {
        if (tracker) {
          tracker.flush();
        }
        sync();
      });
      provider.on('playing', sync);
      provider.on('waiting', sync);
      provider.on('ratechange', sync);
      provider.on('volumechange', sync);
      provider.on('ended', onEnded);
      provider.on('error', () => setError('Playback error.'));
    })();
    return () => {
      disposed = true;
      if (coverageRef.current) {
        coverageRef.current.flush(true);
        coverageRef.current.stop();
      }
      if (providerRef.current) {
        providerRef.current.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    const onHide = () => coverageRef.current && coverageRef.current.flush(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  // Sticky-on-scroll: pin the player to a corner when scrolled out of view
  // while playing. Watches a fixed sentinel that stays put in the document
  // flow — NOT the stage itself, which flips to `position: fixed` once sticky
  // engages. Observing the stage directly caused a feedback loop (it leaves
  // its flow slot → the observer immediately reports it "visible" again in
  // its new fixed spot → sticky turns back off → it un-fixes and reports
  // "hidden" again → repeat), which is what showed up as flicker on scroll.
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (!behavior.sticky || !stickySentinelRef.current) {
      return undefined;
    }
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        // Back at the top, main player in view — clear any earlier
        // dismissal so scrolling away again can re-dock it.
        stickyDismissedRef.current = false;
        setSticky(false);
      } else if (ui.playing && !stickyDismissedRef.current) {
        setSticky(true);
      }
      // Otherwise (still out of view but paused, or explicitly dismissed):
      // leave `sticky` exactly as it is — pausing/seeking while docked
      // must not un-dock it, and a dismissal must not re-engage on its own.
    }, {
      threshold: 0.1
    });
    io.observe(stickySentinelRef.current);
    return () => io.disconnect();
  }, [behavior.sticky, ui.playing]);
  const maybeOptin = t => {
    if (activeOptin || activeQuiz || optinDoneRef.current) {
      return false;
    }
    if (optin.enabled && optin.position === 'time' && t >= (optin.at || 0)) {
      providerRef.current.pause();
      setActiveOptin(true);
      return true;
    }
    return false;
  };
  const maybeCheckpoint = t => {
    if (activeQuiz || activeOptin) {
      return;
    }
    for (const cp of gating.checkpoints || []) {
      if (!cp.questions || !cp.questions.length) {
        continue;
      }
      if (passedCheckpoints.current.has(cp.id)) {
        continue;
      }
      if (t >= cp.at) {
        providerRef.current.pause();
        setActiveQuiz({
          gateId: `checkpoint:${cp.id}`,
          quiz: cp,
          title: cp.title || 'Checkpoint question'
        });
        break;
      }
    }
  };

  // Time/pause-triggered marketing overlays. Deduped via a ref so a fired
  // overlay never re-shows until an explicit replay.
  const maybeOverlay = t => {
    if (overlayActiveRef.current || !overlays.length) {
      return;
    }
    const due = overlays.find(o => (o.trigger || 'time') === 'time' && !firedOverlays.current.has(o.id) && t >= (parseFloat(o.at) || 0));
    if (due) {
      firedOverlays.current.add(due.id);
      overlayActiveRef.current = true;
      if (due.pause && providerRef.current) {
        providerRef.current.pause();
      }
      setActiveOverlay(due);
    }
  };
  // Text overlays: timed show/hide windows — unlike CTAs they re-show whenever
  // the playhead re-enters their window (rewinds included).
  const syncTextOverlays = t => {
    if (!textOverlays.length) {
      return;
    }
    const ids = textOverlays.filter(o => t >= (parseFloat(o.start) || 0) && (!o.end || t < parseFloat(o.end))).map(o => o.id);
    setActiveTextIds(prev => prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids);
  };
  const closeOverlay = () => {
    overlayActiveRef.current = false;
    setActiveOverlay(null);
  };
  const replayFromStart = () => {
    firedOverlays.current.clear();
    overlayActiveRef.current = false;
    setActiveOverlay(null);
    setStarted(false);
    if (providerRef.current) {
      providerRef.current.seek(0);
      providerRef.current.play();
    }
  };
  const onEnded = () => {
    if (coverageRef.current) {
      coverageRef.current.flush(true);
    }
    (0,_ga__WEBPACK_IMPORTED_MODULE_4__.gaEvent)('video_complete', {
      video_id: videoId,
      video_title: title
    });
    let gated = false;
    if (gatingOn && gating.finalQuiz && gating.finalQuiz.questions && gating.finalQuiz.questions.length) {
      setActiveQuiz({
        gateId: 'final',
        quiz: gating.finalQuiz,
        title: gating.finalQuiz.title || 'Final quiz'
      });
      gated = true;
    } else if (gatingOn && optin.enabled && optin.position === 'end' && !optinDoneRef.current) {
      setActiveOptin(true);
      gated = true;
    } else if (behavior.resetOnEnd) {
      providerRef.current.seek(0);
      setStarted(false);
    }
    // End screen — takes precedence over playlist auto-advance.
    const endOverlay = overlays.find(o => o.trigger === 'end');
    if (!gated && endOverlay && !firedOverlays.current.has(endOverlay.id)) {
      firedOverlays.current.add(endOverlay.id);
      overlayActiveRef.current = true;
      setActiveOverlay(endOverlay);
      gated = true;
    }
    sync();
    // Playlist autoplay-next: only when nothing is gating the end.
    if (!gated && onEndedProp) {
      onEndedProp();
    }
  };
  const finishOptin = () => {
    window.localStorage.setItem(`tp_optin_${videoId}`, '1');
    optinDoneRef.current = true;
    setActiveOptin(false);
    if (optin.position !== 'end' && providerRef.current) {
      providerRef.current.play();
    }
  };

  // Cap seeking to the furthest point watched when "no skip" (free behavior)
  // or pro anti-skip is on. Never in preview, and released once completed.
  const noSkipActive = !preview && !(gate && gate.completed) && (behavior.noSkip || gatingOn && gating.antiSkip);
  const watchedTo = Math.max(furthestRef.current, frontier);
  const seekable = noSkipActive ? Math.min(ui.duration, Math.max(watchedTo + 1.5, ui.current + 0.5)) : ui.duration;
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (!behavior.hideControls) {
      setIdle(false);
      return undefined;
    }
    let timer;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 2800);
    };
    const node = stageRef.current;
    if (node) {
      node.addEventListener('mousemove', wake);
      node.addEventListener('touchstart', wake);
    }
    return () => {
      clearTimeout(timer);
      if (node) {
        node.removeEventListener('mousemove', wake);
        node.removeEventListener('touchstart', wake);
      }
    };
  }, [behavior.hideControls]);
  const playPause = () => {
    const p = providerRef.current;
    if (!p) {
      return;
    }
    p.isPaused() ? p.play() : p.pause();
  };
  const seek = t => {
    const p = providerRef.current;
    if (!p) {
      return;
    }
    p.seek(t);
    coverageRef.current && coverageRef.current.resync(t);
  };
  const skip = delta => {
    const p = providerRef.current;
    if (!p) {
      return;
    }
    let t = p.getCurrentTime() + delta;
    t = Math.max(0, delta > 0 ? Math.min(t, seekable) : t);
    seek(t);
  };
  const setVolume = v => {
    providerRef.current.setVolume(v);
    providerRef.current.setMuted(v === 0);
  };
  const toggleMute = () => providerRef.current.setMuted(!providerRef.current.isMuted());
  const setRate = r => providerRef.current.setRate(r);
  const setQuality = q => {
    providerRef.current.setQuality(q);
    setUi(s => ({
      ...s,
      quality: q
    }));
  };
  const setTrack = id => {
    providerRef.current.setTextTrack(id === 'off' ? -1 : id);
    setUi(s => ({
      ...s,
      track: id
    }));
  };
  const closePiP = () => {
    if (pipWinRef.current) {
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
      const win = await window.documentPictureInPicture.requestWindow({
        width: 420,
        height: 236
      });
      (0,_pip__WEBPACK_IMPORTED_MODULE_6__.cloneStylesInto)(win.document);
      win.document.body.style.margin = '0';
      win.document.body.style.background = '#000';
      win.addEventListener('pagehide', () => {
        pipWinRef.current = null;
        setPipWin(null);
      }, {
        once: true
      });
      pipWinRef.current = win;
      setPipWin(win);
      return true;
    } catch (e) {
      return false;
    }
  };
  const pip = async () => {
    if (pipWinRef.current) {
      closePiP();
      return;
    }
    if (containerPipSupported && (await openContainerPiP())) {
      return;
    }
    // Fallback: native per-<video>/per-embed PiP (html5, Vimeo only — the
    // button is hidden entirely for sources with neither this nor the
    // fallback available, e.g. YouTube on a non-Chromium browser).
    const p = providerRef.current;
    if (!p || !p.requestPiP) {
      return;
    }
    try {
      // Toggle: clicking again while already in PiP (e.g. re-entered via
      // the OS controls) previously just re-requested it, which the
      // browser silently ignores/rejects — nothing visibly happened.
      const active = p.isPiPActive ? await p.isPiPActive() : false;
      await (active ? p.exitPiP() : p.requestPiP());
    } catch (e) {
      // unsupported for this source/browser — swallow
    }
  };

  // Close the floating window if the player unmounts entirely (a video
  // change alone doesn't unmount this component, so PiP intentionally
  // persists across e.g. a playlist auto-advancing to the next item).
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    return () => {
      if (pipWinRef.current) {
        pipWinRef.current.close();
      }
    };
  }, []);
  const download = async () => {
    const url = providerRef.current?.sourceUrl || source.src;
    if (!url) {
      return;
    }
    // The `download` attribute is silently ignored by browsers for
    // cross-origin URLs — the anchor then just navigates the tab to the raw
    // file (a bare native video "panel" with no way back to the page). Fetch
    // it as a blob instead, which `download` always honors regardless of the
    // original resource's origin, so the page itself is never left.
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('download fetch failed');
      }
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = downloadFilename(url, title);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    } catch (e) {
      // Truly unreachable via fetch (no CORS headers, network error, …) —
      // open in a new tab rather than navigating away with no way back.
      window.open(url, '_blank', 'noopener');
    }
  };
  const fullscreen = () => {
    const node = stageRef.current;
    if (!document.fullscreenElement) {
      node.requestFullscreen && node.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };
  const onKeyDown = e => {
    if (activeQuiz) {
      return;
    }
    const p = providerRef.current;
    if (!p) {
      return;
    }
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        playPause();
        break;
      case 'ArrowRight':
        skip(cz.skipSeconds);
        break;
      case 'ArrowLeft':
        skip(-cz.skipSeconds);
        break;
      case 'ArrowUp':
        setVolume(Math.min(1, p.getVolume() + 0.1));
        break;
      case 'ArrowDown':
        setVolume(Math.max(0, p.getVolume() - 0.1));
        break;
      case 'm':
        toggleMute();
        break;
      case 'f':
        fullscreen();
        break;
      default:
        break;
    }
  };
  const onQuizPass = () => {
    const q = activeQuiz;
    setActiveQuiz(null);
    if (q.gateId.startsWith('checkpoint:')) {
      passedCheckpoints.current.add(q.gateId.split(':')[1]);
      providerRef.current.play();
    } else {
      setGate(g => ({
        ...(g || {}),
        completed: true
      }));
      if (optin.enabled && optin.position === 'end' && !optinDoneRef.current) {
        setActiveOptin(true);
      } else if (behavior.resetOnEnd) {
        providerRef.current.seek(0);
        setStarted(false);
      }
    }
  };
  const onQuizFail = () => {};
  const onQuizLocked = () => {
    setActiveQuiz(null);
    setLocked(true);
    setGate(g => ({
      ...(g || {}),
      locked: true,
      requireRewatch: true
    }));
  };
  const rewatch = () => {
    setLocked(false);
    passedCheckpoints.current = new Set();
    if (coverageRef.current) {
      coverageRef.current.newSession();
    }
    seek(0);
    providerRef.current.play();
  };
  const stageStyle = {
    '--tp-accent': appearance.accent,
    '--tp-radius': `${appearance.roundness}px`
  };
  if (appearance.hoverColor) {
    stageStyle['--tp-hover'] = appearance.hoverColor;
  }
  // Caption cue styling (html5-backed providers; embeds render their own).
  stageStyle['--tp-cap-scale'] = (appearance.captionSize || 100) / 100;
  stageStyle['--tp-cap-color'] = appearance.captionColor || '#ffffff';
  stageStyle['--tp-cap-bg'] = hexToRgba(appearance.captionBackground || '#000000', (appearance.captionOpacity ?? 75) / 100);
  // Aspect ratio (audio keeps its compact bar; sticky keeps the ratio too so
  // the mini player matches the video's shape).
  if (source.mediaType !== 'audio' && appearance.aspectRatio && appearance.aspectRatio !== '16:9') {
    stageStyle.aspectRatio = appearance.aspectRatio === 'auto' ? 'auto' : appearance.aspectRatio.replace(':', ' / ');
  }
  const skin = appearance.skin || 'default';
  const stageClass = ['tp-stage', `tp-skin-${skin}`, idle && ui.playing ? 'is-idle' : '', source.mediaType === 'audio' ? 'is-audio' : '', `tp-bar-${appearance.controlBarStyle}`, `tp-play-${appearance.playButtonStyle}`,
  // A real OS PiP window replaces the in-page floating corner — the two
  // floating mechanisms together would fight over `position: fixed`.
  sticky && !pipWin ? `tp-sticky tp-sticky-${behavior.stickyPosition}` : ''].filter(Boolean).join(' ');

  // Container PiP works regardless of provider (it just floats the whole
  // stage), so it can make the button available even where the provider has
  // no native fallback of its own (YouTube).
  const pipAvailable = containerPipSupported || !!providerRef.current?.capabilities?.pip;
  const stage =
  /*#__PURE__*/
  // eslint-disable-next-line jsx-a11y/no-static-element-interactions
  (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
    ref: stageRef,
    className: stageClass,
    style: stageStyle,
    tabIndex: 0,
    onKeyDown: onKeyDown,
    children: [sticky && !pipWin && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("button", {
      className: "tp-sticky-close",
      "aria-label": "Close",
      onClick: () => {
        stickyDismissedRef.current = true;
        setSticky(false);
      },
      children: "\xD7"
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
      ref: containerRef,
      className: "tp-media-container",
      onClick: () => ready && !activeQuiz && playPause()
    }), source.mediaType === 'audio' && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
      className: "tp-audio-art",
      "aria-hidden": "true",
      children: source.poster ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("img", {
        src: source.poster,
        alt: ""
      }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("svg", {
        viewBox: "0 0 24 24",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("path", {
          d: "M12 3v10.55A4 4 0 1014 17V7h4V3h-6z"
        })
      })
    }), (source.type === 'youtube' || source.type === 'vimeo') && !activeQuiz && !locked && !error &&
    /*#__PURE__*/
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
      className: "tp-shield",
      "aria-hidden": "true",
      onClick: () => ready && playPause()
    }), source.poster && !started && !error && source.mediaType !== 'audio' && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
      className: "tp-poster",
      style: {
        backgroundImage: `url("${source.poster}")`
      }
    }), branding.logo && (branding.logoUrl ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("a", {
      className: `tp-logo tp-logo-${branding.logoPosition || 'top-right'} is-link`,
      style: {
        opacity: branding.logoOpacity ?? 0.9
      },
      href: branding.logoUrl,
      target: "_blank",
      rel: "noreferrer",
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("img", {
        src: branding.logo,
        alt: ""
      })
    }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("img", {
      className: `tp-logo tp-logo-${branding.logoPosition || 'top-right'}`,
      style: {
        opacity: branding.logoOpacity ?? 0.9
      },
      src: branding.logo,
      alt: ""
    })), textOverlays.filter(o => activeTextIds.includes(o.id)).map(o => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
      className: `tp-text-overlay tp-pos-${o.position || 'top-left'}`,
      style: {
        background: hexToRgba(o.background || '#000000', (o.bgOpacity ?? 60) / 100)
      },
      children: [o.title && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("strong", {
        className: "tp-text-overlay-title",
        children: o.title
      }), o.text && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
        className: "tp-text-overlay-text",
        children: o.text
      })]
    }, o.id)), layers.length > 0 && !activeQuiz && !activeOptin && !locked && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_components_Layers__WEBPACK_IMPORTED_MODULE_12__["default"], {
      layers: layers,
      current: ui.current,
      videoId: videoId,
      preview: preview,
      onOptin: ({
        email
      }) => preview ? Promise.resolve() : _Utils_rest__WEBPACK_IMPORTED_MODULE_5__.rest.post('optin', {
        video: videoId,
        email
      })
    }), watermark.enabled && watermark.text && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
      className: `tp-watermark${watermark.drift !== false ? ' is-drifting' : ''}`,
      style: {
        opacity: watermark.opacity ?? 0.35
      },
      "aria-hidden": "true",
      children: watermark.text
    }), actionBar.enabled && (actionBar.text || actionBar.buttonLabel) && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
      className: `tp-actionbar tp-actionbar-${actionBar.position === 'top' ? 'top' : 'bottom'}`,
      style: actionBar.background ? {
        background: actionBar.background
      } : undefined,
      children: [actionBar.text && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
        className: "tp-actionbar-text",
        children: actionBar.text
      }), actionBar.buttonLabel && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("a", {
        className: "tp-actionbar-btn",
        href: actionBar.buttonUrl || '#',
        target: "_blank",
        rel: "noreferrer noopener",
        children: actionBar.buttonLabel
      })]
    }), !ready && !error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_components_Overlays__WEBPACK_IMPORTED_MODULE_14__.Spinner, {}), error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_components_Overlays__WEBPACK_IMPORTED_MODULE_14__.Message, {
      children: error
    }), ready && !ui.playing && !locked && !activeQuiz && !activeOptin && !error && appearance.bigPlay && source.mediaType !== 'audio' && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_components_Overlays__WEBPACK_IMPORTED_MODULE_14__.BigPlay, {
      onPlay: playPause
    }), activeOptin && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_components_Optin__WEBPACK_IMPORTED_MODULE_10__["default"], {
      videoId: videoId,
      optin: optin,
      preview: preview,
      onDone: finishOptin,
      onSkip: finishOptin
    }), activeOverlay && !activeQuiz && !activeOptin && !locked && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_components_Overlay__WEBPACK_IMPORTED_MODULE_11__["default"], {
      overlay: activeOverlay,
      onClose: closeOverlay,
      onReplay: activeOverlay.trigger === 'end' ? replayFromStart : null
    }), locked && !activeQuiz && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_components_Overlays__WEBPACK_IMPORTED_MODULE_14__.LockScreen, {
      requireRewatch: gate && gate.requireRewatch,
      onRewatch: rewatch
    }), activeQuiz && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_components_Quiz__WEBPACK_IMPORTED_MODULE_9__["default"], {
      videoId: videoId,
      gateId: activeQuiz.gateId,
      quiz: activeQuiz.quiz,
      title: activeQuiz.title,
      preview: preview,
      onPass: onQuizPass,
      onFail: onQuizFail,
      onLocked: onQuizLocked
    }), ready && !error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_components_Controls__WEBPACK_IMPORTED_MODULE_7__["default"], {
      ...ui,
      seekable: seekable,
      chapters: config.chapters || [],
      provider: providerRef.current,
      capabilities: {
        ...providerRef.current?.capabilities,
        pip: pipAvailable
      },
      controls: cz.controls,
      speeds: cz.speeds,
      skipSeconds: cz.skipSeconds,
      scrubDisabled: !!behavior.disableSeek,
      hidePiP: sticky && !pipWin,
      onPlayPause: playPause,
      onSeek: seek,
      onSkip: skip,
      onVolume: setVolume,
      onMute: toggleMute,
      onRate: setRate,
      onQuality: setQuality,
      onTrack: setTrack,
      onPiP: pip,
      onDownload: download,
      onFullscreen: fullscreen,
      onInfo: () => setInfoOpen(o => !o),
      hasInfo: hasInfo,
      infoOpen: infoOpen,
      audio: source.mediaType === 'audio',
      title: title,
      waveSeed: videoId
    }), infoOpen && ready && !error && !activeQuiz && !locked && !activeOptin && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_components_InfoPanel__WEBPACK_IMPORTED_MODULE_8__["default"], {
      chapters: chapterList,
      getCues: getCues,
      current: ui.current,
      seekable: seekable,
      onSeek: seek,
      onClose: () => setInfoOpen(false)
    })]
  });

  // Once `sticky` engages, the stage leaves the document flow (`position:
  // fixed`), so this slot reserves its normal footprint — matching the
  // aspect ratio it would otherwise render at — to avoid a layout jump, and
  // hosts the sentinel the observer above watches. Container PiP moves the
  // stage out entirely (into another window), so it reserves the same way.
  const slotStyle = sticky || pipWin ? source.mediaType === 'audio' ? {
    minHeight: '72px'
  } : {
    aspectRatio: stageStyle.aspectRatio || '16 / 9'
  } : undefined;
  const stageInSlot = /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
    className: "tp-stage-slot",
    style: slotStyle,
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
      ref: stickySentinelRef,
      className: "tp-stage-sentinel",
      "aria-hidden": "true"
    }), pipWin ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
      className: "tp-pip-placeholder",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("p", {
        children: "Playing in a floating window"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("button", {
        type: "button",
        className: "tp-pip-return",
        onClick: closePiP,
        children: "Bring back"
      })]
    }) : stage]
  });

  // Ambient skin: a blurred, oversized copy of the poster glows behind the
  // stage (the stage clips its own children, so the glow needs a wrapper).
  // The wrapper renders unconditionally for the skin — toggling it (e.g. on
  // sticky) would remount the stage and destroy the provider's media element.
  let content;
  if (skin === 'ambient' && source.mediaType !== 'audio') {
    // Both children stay mounted (hidden via style) — removing the glow
    // would shift the stage's reconciliation slot and recreate its DOM.
    content = /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
      className: "tp-ambient-wrap",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
        className: "tp-ambient-glow",
        style: {
          backgroundImage: source.poster ? `url("${source.poster}")` : undefined,
          display: source.poster && !sticky ? undefined : 'none'
        },
        "aria-hidden": "true"
      }), stageInSlot]
    });
  } else {
    content = stageInSlot;
  }
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.Fragment, {
    children: [content, gatingOn && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_components_TimedContent__WEBPACK_IMPORTED_MODULE_13__["default"], {
      config: config,
      current: ui.current
    }), pipWin && (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createPortal)(stage, pipWin.document.body)]
  });
}

/***/ },

/***/ "./dev_trueplayer/player/Playlist.jsx"
/*!********************************************!*\
  !*** ./dev_trueplayer/player/Playlist.jsx ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Playlist)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _Player__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Player */ "./dev_trueplayer/player/Player.jsx");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__);



/**
 * Renders a group of videos as a sidebar (main player + list) or a grid.
 * Clicking an item swaps the active video; autoplay-next advances on end.
 */

function Playlist({
  data
}) {
  const items = data.items || [];
  const [active, setActive] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const [autoStart, setAutoStart] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const item = items[active];

  // Picking an item (or auto-advancing) should play it; the first render just
  // shows its poster so nothing loads until the viewer chooses to watch.
  const pick = i => {
    setActive(i);
    setAutoStart(true);
  };
  const goNext = () => {
    if (data.autoplayNext && active < items.length - 1) {
      pick(active + 1);
    }
  };
  if (!item) {
    return null;
  }

  // Grid shows poster thumbnails; the sidebar uses a compact icon so the list
  // stays slim (and titles get more room).
  const isGrid = data.layout === 'grid';
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: `tp-pl tp-pl-${data.layout}`,
    children: [data.title && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: "tp-pl-title",
      children: data.title
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "tp-pl-body",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "tp-pl-main",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
          className: "trueplayer-mount",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_Player__WEBPACK_IMPORTED_MODULE_1__["default"], {
            videoId: item.videoId,
            config: item.config,
            title: item.title,
            autoStart: autoStart,
            onEnded: goNext
          }, item.videoId)
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "tp-pl-list",
        children: items.map((it, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("button", {
          className: `tp-pl-item ${i === active ? 'is-active' : ''}`,
          onClick: () => pick(i),
          children: [isGrid ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
            className: "tp-pl-thumb",
            style: it.poster ? {
              backgroundImage: `url("${it.poster}")`
            } : undefined,
            children: !it.poster && i + 1
          }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
            className: "tp-pl-icon",
            "aria-hidden": "true",
            children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("svg", {
              viewBox: "0 0 24 24",
              children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
                d: "M8 5v14l11-7z"
              })
            })
          }), data.showTitles && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
            className: "tp-pl-item-title",
            children: it.title || `Video ${i + 1}`
          })]
        }, it.videoId))
      })]
    })]
  });
}

/***/ },

/***/ "./dev_trueplayer/player/components/Controls.jsx"
/*!*******************************************************!*\
  !*** ./dev_trueplayer/player/components/Controls.jsx ***!
  \*******************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   currentChapter: () => (/* binding */ currentChapter),
/* harmony export */   "default": () => (/* binding */ Controls)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _Utils_format__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @Utils/format */ "./dev_trueplayer/utils/format.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__);



const Icon = ({
  d
}) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("svg", {
  viewBox: "0 0 24 24",
  width: "20",
  height: "20",
  fill: "currentColor",
  "aria-hidden": "true",
  children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
    d: d
  })
});
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
  list: 'M3 5h13v2H3V5zm0 6h13v2H3v-2zm0 6h9v2H3v-2zm15.5-6L22 13l-3.5 2v-4z'
};
function buildSegments(chapters, duration) {
  if (!duration) {
    return [];
  }
  const cs = (chapters || []).filter(c => c.at >= 0 && c.at < duration).sort((a, b) => a.at - b.at);
  if (!cs.length) {
    return [];
  }
  const segs = [];
  if (cs[0].at > 0.5) {
    segs.push({
      start: 0,
      end: cs[0].at,
      label: ''
    });
  }
  cs.forEach((c, i) => segs.push({
    start: c.at,
    end: cs[i + 1] ? cs[i + 1].at : duration,
    label: c.label
  }));
  return segs;
}

// Deterministic pseudo-waveform bar heights (0.2–1) seeded by the track, so an
// audio player looks like a waveform without decoding the file. Same seed →
// same shape every render.
function waveBars(seed, n) {
  let s = (seed || 1) >>> 0 || 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    s = s * 1103515245 + 12345 & 0x7fffffff;
    out.push(0.2 + s % 1000 / 1000 * 0.8);
  }
  return out;
}
function Scrubber({
  current,
  duration,
  buffered,
  chapters,
  seekable,
  onSeek,
  waveform,
  waveSeed,
  disabled
}) {
  const [hover, setHover] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  // While dragging, the thumb/fill follow the pointer immediately instead of
  // waiting on the provider's (occasionally laggy) timeupdate — this is what
  // makes the scrubber feel grab-able instead of only click-to-seek. The
  // preview stays up after release too, until `current` actually catches up
  // to it — otherwise the thumb flashes back to the old spot while the seek
  // is still in flight (visible on network sources / unbuffered ranges).
  const [drag, setDrag] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null); // ratio 0..1, or null when not previewing
  const draggingRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(false); // true only while the pointer is actually down
  const trackRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const bars = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => waveform ? waveBars(waveSeed, 56) : [], [waveform, waveSeed]);

  // Clamp once, in ratio space, so the preview we render and the position we
  // actually seek to always agree (a mismatch here is what left the preview
  // stuck when noSkip capped the seek short of the dragged ratio).
  const clampRatio = ratio => duration && seekable < duration ? Math.min(ratio, seekable / duration) : ratio;
  const moveTo = clientX => {
    const rect = trackRef.current.getBoundingClientRect();
    const raw = rect.width ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
    const ratio = clampRatio(raw);
    setDrag(ratio);
    onSeek(ratio * duration);
  };

  // Track the pointer on `window` for the duration of the drag rather than
  // relying on setPointerCapture's target reassignment — that can behave
  // inconsistently depending on what else is on the page (overlays, the
  // admin preview panel, etc.), which was leaving the thumb stuck in place.
  const onWindowMove = e => {
    if (!draggingRef.current) {
      return;
    }
    moveTo(e.clientX);
  };
  const onWindowUp = () => {
    draggingRef.current = false;
    window.removeEventListener('pointermove', onWindowMove);
    window.removeEventListener('pointerup', onWindowUp);
    window.removeEventListener('pointercancel', onWindowUp);
  };
  const onPointerDown = e => {
    if (disabled || !duration) {
      return;
    }
    draggingRef.current = true;
    moveTo(e.clientX);
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowUp);
  };
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => onWindowUp, []); // eslint-disable-line react-hooks/exhaustive-deps -- unmount safety net only

  // Clear the preview once playback has genuinely reached it (or after a
  // timeout fallback, so a stalled/failed seek can't strand the thumb).
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (drag === null || draggingRef.current) {
      return undefined;
    }
    if (Math.abs(current - drag * duration) < 0.35) {
      setDrag(null);
      return undefined;
    }
    const t = setTimeout(() => setDrag(null), 1200);
    return () => clearTimeout(t);
  }, [current, drag, duration]);
  const effectiveCurrent = drag !== null ? drag * duration : current;
  const pct = duration ? effectiveCurrent / duration * 100 : 0;
  const bpct = duration ? buffered / duration * 100 : 0;
  const spct = duration && seekable < duration ? seekable / duration * 100 : 100;
  const segs = buildSegments(chapters, duration);
  const fill = (value, start, end) => {
    const span = end - start;
    return span > 0 ? Math.min(100, Math.max(0, (value - start) / span * 100)) : 0;
  };
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    ref: trackRef,
    className: `tp-scrubber${disabled ? ' is-disabled' : ''}`,
    onPointerDown: onPointerDown,
    role: "slider",
    "aria-valuenow": Math.floor(current),
    "aria-valuemax": Math.floor(duration),
    "aria-disabled": disabled || undefined,
    tabIndex: disabled ? -1 : 0,
    children: [hover && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: "tp-chapter-tip",
      style: {
        left: `${hover.left}%`
      },
      children: hover.label
    }), segs.length > 1 ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "tp-scrubber-segs",
      children: [segs.map((s, i) => {
        const left = s.start / duration * 100;
        const width = (s.end - s.start) / duration * 100;
        return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
          className: "tp-seg",
          style: {
            left: `${left}%`,
            width: `calc(${width}% - 3px)`
          },
          onMouseEnter: () => s.label && setHover({
            label: s.label,
            left: left + width / 2
          }),
          onMouseLeave: () => setHover(null),
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
            className: "tp-seg-buffered",
            style: {
              width: `${fill(buffered, s.start, s.end)}%`
            }
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
            className: "tp-seg-played",
            style: {
              width: `${fill(effectiveCurrent, s.start, s.end)}%`
            }
          })]
        }, i);
      }), seekable < duration && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "tp-scrubber-lockline",
        style: {
          left: `${spct}%`
        }
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "tp-scrubber-thumb",
        style: {
          left: `${pct}%`
        }
      })]
    }) : waveform ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "tp-wave",
      children: [bars.map((h, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
        className: `tp-wave-bar ${(i + 0.5) / bars.length <= (duration ? effectiveCurrent / duration : 0) ? 'is-played' : ''}`,
        style: {
          height: `${Math.round(h * 100)}%`
        }
      }, i)), seekable < duration && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "tp-scrubber-lockline",
        style: {
          left: `${spct}%`
        }
      })]
    }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "tp-scrubber-track",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "tp-scrubber-buffered",
        style: {
          width: `${bpct}%`
        }
      }), seekable < duration && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "tp-scrubber-lockline",
        style: {
          left: `${spct}%`
        }
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "tp-scrubber-played",
        style: {
          width: `${pct}%`
        }
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "tp-scrubber-thumb",
        style: {
          left: `${pct}%`
        }
      })]
    })]
  });
}
function currentChapter(chapters, current, duration) {
  const segs = buildSegments(chapters, duration);
  const seg = segs.find(s => current >= s.start && current < s.end);
  return seg && seg.label ? seg.label : '';
}
function Menu({
  provider,
  rate,
  setRate,
  quality,
  setQuality,
  track,
  setTrack,
  speeds
}) {
  const [open, setOpen] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const rates = speeds && speeds.length ? speeds : [0.5, 0.75, 1, 1.25, 1.5, 2];
  const qualities = provider?.getQualities?.() || [];
  const tracks = provider?.getTextTracks?.() || [];
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: "tp-menu-wrap",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
      className: "tp-btn",
      "aria-label": "Settings",
      onClick: () => setOpen(!open),
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Icon, {
        d: P.gear
      })
    }), open && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "tp-menu",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "tp-menu-section",
        children: "Speed"
      }), rates.map(r => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: `tp-menu-item ${r === rate ? 'is-active' : ''}`,
        onClick: () => {
          setRate(r);
          setOpen(false);
        },
        children: r === 1 ? 'Normal' : `${r}×`
      }, r)), qualities.length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
          className: "tp-menu-section",
          children: "Quality"
        }), qualities.map(q => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
          className: `tp-menu-item ${q.id === quality ? 'is-active' : ''}`,
          onClick: () => {
            setQuality(q.id);
            setOpen(false);
          },
          children: q.label
        }, q.id))]
      }), tracks.length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
          className: "tp-menu-section",
          children: "Subtitles"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
          className: `tp-menu-item ${track === 'off' ? 'is-active' : ''}`,
          onClick: () => {
            setTrack('off');
            setOpen(false);
          },
          children: "Off"
        }), tracks.map(t => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
          className: `tp-menu-item ${t.id === track ? 'is-active' : ''}`,
          onClick: () => {
            setTrack(t.id);
            setOpen(false);
          },
          children: t.label
        }, t.id))]
      })]
    })]
  });
}
function Controls(props) {
  const {
    playing,
    current,
    duration,
    buffered,
    muted,
    volume,
    rate,
    quality,
    track,
    seekable,
    chapters,
    provider,
    capabilities,
    controls = {},
    speeds,
    skipSeconds = 10,
    scrubDisabled,
    hidePiP,
    onPlayPause,
    onSeek,
    onVolume,
    onMute,
    onRate,
    onQuality,
    onTrack,
    onPiP,
    onFullscreen,
    onSkip,
    onDownload,
    onInfo,
    hasInfo,
    infoOpen,
    audio,
    title,
    waveSeed
  } = props;
  const show = (key, fallback = true) => controls[key] === undefined ? fallback : controls[key];
  const chapterNow = currentChapter(chapters, current, duration);
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: "tp-controls",
    children: [audio && title && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: "tp-audio-title",
      title: title,
      children: title
    }), show('progress') && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Scrubber, {
      current: current,
      duration: duration,
      buffered: buffered,
      chapters: chapters,
      seekable: seekable,
      onSeek: onSeek,
      waveform: audio,
      waveSeed: waveSeed,
      disabled: scrubDisabled
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "tp-controls-row",
      children: [show('play') && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: "tp-btn",
        "aria-label": playing ? 'Pause' : 'Play',
        onClick: onPlayPause,
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Icon, {
          d: playing ? P.pause : P.play
        })
      }), show('rewind') && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: "tp-btn",
        "aria-label": "Rewind",
        onClick: () => onSkip(-skipSeconds),
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Icon, {
          d: P.rewind
        })
      }), show('forward') && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: "tp-btn",
        "aria-label": "Fast forward",
        onClick: () => onSkip(skipSeconds),
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Icon, {
          d: P.forward
        })
      }), show('mute') && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: "tp-btn",
        "aria-label": muted ? 'Unmute' : 'Mute',
        onClick: onMute,
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Icon, {
          d: muted || volume === 0 ? P.mute : P.volume
        })
      }), show('volume') && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("input", {
        className: "tp-volume",
        type: "range",
        min: "0",
        max: "1",
        step: "0.05",
        value: muted ? 0 : volume,
        onChange: e => onVolume(parseFloat(e.target.value)),
        "aria-label": "Volume"
      }), (show('currentTime') || show('duration')) && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("span", {
        className: "tp-time",
        children: [show('currentTime') && (0,_Utils_format__WEBPACK_IMPORTED_MODULE_1__.formatTime)(current), show('currentTime') && show('duration') && ' / ', show('duration') && (0,_Utils_format__WEBPACK_IMPORTED_MODULE_1__.formatTime)(duration)]
      }), chapterNow && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("span", {
        className: "tp-chapter-now",
        title: chapterNow,
        children: ["\xB7 ", chapterNow]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "tp-spacer"
      }), show('download') && capabilities?.download && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: "tp-btn",
        "aria-label": "Download",
        onClick: onDownload,
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Icon, {
          d: P.download
        })
      }), hasInfo && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: `tp-btn ${infoOpen ? 'is-active' : ''}`,
        "aria-label": "Chapters & transcript",
        "aria-pressed": infoOpen,
        onClick: onInfo,
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Icon, {
          d: P.list
        })
      }), show('settings') && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Menu, {
        provider: provider,
        rate: rate,
        setRate: onRate,
        quality: quality,
        setQuality: onQuality,
        track: track,
        setTrack: onTrack,
        speeds: speeds
      }), show('pip') && capabilities?.pip && !hidePiP && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: "tp-btn",
        "aria-label": "Picture in picture",
        onClick: onPiP,
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Icon, {
          d: P.pip
        })
      }), show('fullscreen') && capabilities?.fullscreen !== false && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: "tp-btn",
        "aria-label": "Fullscreen",
        onClick: onFullscreen,
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Icon, {
          d: P.full
        })
      })]
    })]
  });
}

/***/ },

/***/ "./dev_trueplayer/player/components/InfoPanel.jsx"
/*!********************************************************!*\
  !*** ./dev_trueplayer/player/components/InfoPanel.jsx ***!
  \********************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ InfoPanel)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _Utils_format__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @Utils/format */ "./dev_trueplayer/utils/format.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__);



/**
 * YouTube-style "In this video" drawer: Chapters + Transcript tabs that slide
 * in over the right of the player. Clicking a row jumps the video; the row for
 * the current position stays highlighted and auto-scrolls into view.
 *
 * Transcript cues load asynchronously (the browser parses the WebVTT track only
 * once it's enabled), so we poll getCues a few times after opening.
 */

function InfoPanel({
  chapters = [],
  getCues,
  current,
  seekable,
  onSeek,
  onClose
}) {
  const hasChapters = chapters.length > 0;
  const [cues, setCues] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(() => getCues ? getCues() : []);
  const hasTranscript = cues.length > 0;
  const [tab, setTab] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(hasChapters ? 'chapters' : 'transcript');

  // Poll for cues after mount — WebVTT parsing is async.
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (!getCues || cues.length) {
      return undefined;
    }
    let tries = 0;
    let id;
    const load = () => {
      const c = getCues();
      if (c.length) {
        setCues(c);
      } else if (tries++ < 12) {
        id = setTimeout(load, 300);
      }
    };
    id = setTimeout(load, 200);
    return () => clearTimeout(id);
  }, [getCues, cues.length]);

  // If chapters are absent, default the tab to transcript once it arrives.
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (!hasChapters && hasTranscript) {
      setTab('transcript');
    }
  }, [hasChapters, hasTranscript]);
  const sortedChapters = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => chapters.map((c, i) => ({
    ...c,
    _i: i
  })).sort((a, b) => a.at - b.at), [chapters]);
  const activeChapter = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => {
    let idx = -1;
    sortedChapters.forEach((c, i) => {
      if (current >= c.at - 0.25) {
        idx = i;
      }
    });
    return idx;
  }, [sortedChapters, current]);
  const activeCue = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => {
    let idx = -1;
    for (let i = 0; i < cues.length; i++) {
      if (current >= cues[i].start - 0.15) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [cues, current]);
  const listRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const activeRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        block: 'nearest'
      });
    }
  }, [activeChapter, activeCue, tab]);
  const jump = at => {
    if (seekable !== undefined && at > seekable + 0.5) {
      return; // no-skip: can't jump past what's been watched
    }
    onSeek(at);
  };
  const blocked = at => seekable !== undefined && at > seekable + 0.5;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: "tp-info",
    role: "dialog",
    "aria-label": "Chapters and transcript",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "tp-info-head",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
        className: "tp-info-tabs",
        children: [hasChapters && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
          className: `tp-info-tab ${tab === 'chapters' ? 'is-active' : ''}`,
          onClick: () => setTab('chapters'),
          children: "Chapters"
        }), hasTranscript && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
          className: `tp-info-tab ${tab === 'transcript' ? 'is-active' : ''}`,
          onClick: () => setTab('transcript'),
          children: "Transcript"
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: "tp-info-close",
        "aria-label": "Close",
        onClick: onClose,
        children: "\xD7"
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "tp-info-body",
      ref: listRef,
      children: [tab === 'chapters' && sortedChapters.map((c, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("button", {
        ref: i === activeChapter ? activeRef : null,
        className: `tp-info-row ${i === activeChapter ? 'is-active' : ''} ${blocked(c.at) ? 'is-locked' : ''}`,
        onClick: () => jump(c.at),
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
          className: "tp-info-time",
          children: (0,_Utils_format__WEBPACK_IMPORTED_MODULE_1__.formatTime)(c.at)
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
          className: "tp-info-label",
          children: c.label || `Chapter ${i + 1}`
        })]
      }, c._i)), tab === 'transcript' && (hasTranscript ? cues.map((c, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("button", {
        ref: i === activeCue ? activeRef : null,
        className: `tp-info-row tp-info-cue ${i === activeCue ? 'is-active' : ''} ${blocked(c.start) ? 'is-locked' : ''}`,
        onClick: () => jump(c.start),
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
          className: "tp-info-time",
          children: (0,_Utils_format__WEBPACK_IMPORTED_MODULE_1__.formatTime)(c.start)
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
          className: "tp-info-label",
          children: c.text
        })]
      }, i)) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
        className: "tp-info-empty",
        children: "No transcript available for this video."
      }))]
    })]
  });
}

/***/ },

/***/ "./dev_trueplayer/player/components/Layers.jsx"
/*!*****************************************************!*\
  !*** ./dev_trueplayer/player/components/Layers.jsx ***!
  \*****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Layers)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _rules__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../rules */ "./dev_trueplayer/player/rules.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__);



/**
 * Interactive layers (pro) — timed, positioned elements over the picture:
 *  - hotspot:  clickable region (percent coords) with an optional tooltip → URL
 *  - banner:   image + link
 *  - shortcode: server-rendered HTML (prepared by the shortcode pipeline)
 *  - form:     lightweight email capture posting to the opt-in endpoint
 * Layers show while `start <= t < end` (no end = until the video finishes).
 */

function active(layer, t) {
  const start = parseFloat(layer.start) || 0;
  const end = layer.end ? parseFloat(layer.end) : Infinity;
  return t >= start && t < end;
}
function Hotspot({
  layer
}) {
  const style = {
    left: `${layer.x ?? 10}%`,
    top: `${layer.y ?? 10}%`,
    width: `${layer.w ?? 20}%`,
    height: `${layer.h ?? 20}%`
  };
  const body = /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
      className: "tp-hotspot-pulse"
    }), layer.tooltip && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
      className: "tp-hotspot-tip",
      children: layer.tooltip
    })]
  });
  return layer.url ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("a", {
    className: "tp-layer tp-hotspot",
    style: style,
    href: layer.url,
    target: "_blank",
    rel: "noreferrer noopener",
    children: body
  }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
    className: "tp-layer tp-hotspot",
    style: style,
    children: body
  });
}
function Banner({
  layer
}) {
  if (!layer.image) {
    return null;
  }
  const img = /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("img", {
    src: layer.image,
    alt: layer.alt || ''
  });
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
    className: `tp-layer tp-banner tp-pos-${layer.position || 'bottom-center'}`,
    children: layer.url ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("a", {
      href: layer.url,
      target: "_blank",
      rel: "noreferrer noopener",
      children: img
    }) : img
  });
}
function ShortcodeLayer({
  layer
}) {
  if (!layer.html) {
    return null;
  }
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
    className: `tp-layer tp-shortcode-layer tp-pos-${layer.position || 'middle-center'}`
    // Rendered server-side from admin-authored shortcodes (same trust
    // model as post content).
    ,
    dangerouslySetInnerHTML: {
      __html: layer.html
    }
  });
}
function FormLayer({
  layer,
  videoId,
  onSubmit
}) {
  const [email, setEmail] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)('');
  const [state, setState] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)('idle'); // idle | busy | done | error
  if (state === 'done') {
    return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: `tp-layer tp-form-layer tp-pos-${layer.position || 'middle-center'}`,
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
        className: "tp-form-layer-thanks",
        children: layer.thanks || 'Thanks — you’re in!'
      })
    });
  }
  const submit = async e => {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) {
      setState('error');
      return;
    }
    setState('busy');
    try {
      await onSubmit({
        email,
        layerId: layer.id
      });
      setState('done');
    } catch (err) {
      setState('error');
    }
  };
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("form", {
    className: `tp-layer tp-form-layer tp-pos-${layer.position || 'middle-center'}`,
    onSubmit: submit,
    children: [layer.title && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("strong", {
      className: "tp-form-layer-title",
      children: layer.title
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "tp-form-layer-row",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("input", {
        type: "email",
        value: email,
        onChange: e => setEmail(e.target.value),
        placeholder: layer.placeholder || 'you@email.com',
        "aria-label": "Email"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        type: "submit",
        disabled: state === 'busy',
        children: layer.buttonLabel || 'Subscribe'
      })]
    }), state === 'error' && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
      className: "tp-form-layer-error",
      children: "Please enter a valid email."
    })]
  });
}
function Layers({
  layers,
  current,
  videoId,
  onOptin,
  viewer,
  preview
}) {
  // Per-viewer facts for conditional rules (loggedIn / CRM / etc.). Fetched
  // once; falls back to the localized login flag so URL/login rules still work.
  const [facts, setFacts] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(viewer || {
    loggedIn: !!(window.TruePlayerGlobal && window.TruePlayerGlobal.is_login),
    isCrmContact: false,
    crmTags: [],
    crmLists: []
  });
  // Layer interaction state (seen / completed / email submitted) for rules.
  const stateRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)({
    seen: {},
    completed: {},
    emailSubmitted: false
  });
  const hasConditions = (layers || []).some(l => l.conditions && l.conditions.rules && l.conditions.rules.length);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (viewer || preview || !hasConditions) {
      return;
    }
    const g = window.TruePlayerGlobal || {};
    fetch(`${g.rest_url}${g.namespace}rules/context`, {
      headers: {
        'X-WP-Nonce': g.nonce
      }
    }).then(r => r.ok ? r.json() : null).then(data => data && setFacts(f => ({
      ...f,
      ...data
    }))).catch(() => {});
  }, [hasConditions, viewer, preview]);
  const ctx = {
    viewer: facts,
    url: new URLSearchParams(window.location.search),
    layerState: stateRef.current
  };
  const due = (layers || []).filter(l => {
    if (!active(l, current)) {
      return false;
    }
    return (0,_rules__WEBPACK_IMPORTED_MODULE_1__.passesConditions)(l.conditions, ctx);
  });

  // Record that these layers have been seen (for layer_seen rules on others).
  due.forEach(l => {
    stateRef.current.seen[l.id] = true;
  });
  if (!due.length) {
    return null;
  }
  const handleOptin = async payload => {
    stateRef.current.emailSubmitted = true;
    if (payload && payload.layerId) {
      stateRef.current.completed[payload.layerId] = true;
    }
    return onOptin ? onOptin(payload) : undefined;
  };
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
    className: "tp-layers",
    children: due.map(l => {
      switch (l.type) {
        case 'hotspot':
          return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Hotspot, {
            layer: l
          }, l.id);
        case 'banner':
          return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Banner, {
            layer: l
          }, l.id);
        case 'shortcode':
          return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(ShortcodeLayer, {
            layer: l
          }, l.id);
        case 'form':
          return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(FormLayer, {
            layer: l,
            videoId: videoId,
            onSubmit: handleOptin
          }, l.id);
        default:
          return null;
      }
    })
  });
}

/***/ },

/***/ "./dev_trueplayer/player/components/Optin.jsx"
/*!****************************************************!*\
  !*** ./dev_trueplayer/player/components/Optin.jsx ***!
  \****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Optin)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _Utils_rest__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @Utils/rest */ "./dev_trueplayer/utils/rest.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__);



/**
 * In-player subscribe / email-capture gate. On submit it posts to the server,
 * which routes the subscription to the configured integration (GemCRM, …).
 * When `required` is false the viewer can skip.
 */

function Optin({
  videoId,
  optin,
  onDone,
  onSkip,
  preview = false
}) {
  const [email, setEmail] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)('');
  const [name, setName] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)('');
  const [busy, setBusy] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)('');
  const submit = async () => {
    if (!email) {
      setError('Please enter your email.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (preview) {
        onDone(); // preview: don't actually subscribe
        return;
      }
      await _Utils_rest__WEBPACK_IMPORTED_MODULE_1__.rest.post('optin', {
        video: videoId,
        email,
        name
      });
      onDone();
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
    className: "tp-overlay tp-optin",
    children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "tp-optin-card",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("h3", {
        className: "tp-optin-title",
        children: optin.headline || 'Subscribe to keep watching'
      }), optin.description && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
        className: "tp-optin-desc",
        children: optin.description
      }), optin.collectName && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("input", {
        className: "tp-optin-input",
        type: "text",
        placeholder: "Your name",
        value: name,
        onChange: e => setName(e.target.value)
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("input", {
        className: "tp-optin-input",
        type: "email",
        placeholder: "you@example.com",
        value: email,
        onChange: e => setEmail(e.target.value),
        onKeyDown: e => e.key === 'Enter' && submit()
      }), error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
        className: "tp-optin-error",
        children: error
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: "tp-quiz-submit",
        disabled: busy,
        onClick: submit,
        children: busy ? 'Subscribing…' : optin.buttonText || 'Subscribe & continue'
      }), !optin.required && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        className: "tp-optin-skip",
        onClick: onSkip,
        children: "No thanks, continue"
      })]
    })
  });
}

/***/ },

/***/ "./dev_trueplayer/player/components/Overlay.jsx"
/*!******************************************************!*\
  !*** ./dev_trueplayer/player/components/Overlay.jsx ***!
  \******************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Overlay)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);

/**
 * Marketing overlay — a call-to-action card shown at a timestamp, on pause, or
 * as an end screen. Optional image, heading, text, and a button; end screens
 * also offer a replay.
 */
function Overlay({
  overlay,
  onClose,
  onReplay
}) {
  const dismissible = overlay.dismissible !== false;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", {
    className: "tp-overlay tp-cta",
    children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
      className: "tp-cta-card",
      children: [dismissible && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", {
        className: "tp-cta-close",
        "aria-label": "Close",
        onClick: onClose,
        children: "\xD7"
      }), overlay.image && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("img", {
        className: "tp-cta-img",
        src: overlay.image,
        alt: ""
      }), overlay.title && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", {
        className: "tp-cta-title",
        children: overlay.title
      }), overlay.text && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", {
        className: "tp-cta-text",
        children: overlay.text
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
        className: "tp-cta-actions",
        children: [onReplay && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", {
          className: "tp-cta-btn tp-cta-secondary",
          onClick: onReplay,
          children: "\u21BA Replay"
        }), overlay.buttonLabel && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("a", {
          className: "tp-cta-btn",
          href: overlay.buttonUrl || '#',
          target: "_blank",
          rel: "noreferrer noopener",
          children: overlay.buttonLabel
        })]
      })]
    })
  });
}

/***/ },

/***/ "./dev_trueplayer/player/components/Overlays.jsx"
/*!*******************************************************!*\
  !*** ./dev_trueplayer/player/components/Overlays.jsx ***!
  \*******************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BigPlay: () => (/* binding */ BigPlay),
/* harmony export */   LockScreen: () => (/* binding */ LockScreen),
/* harmony export */   Message: () => (/* binding */ Message),
/* harmony export */   Spinner: () => (/* binding */ Spinner)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);

/** Lock / big-play / message overlays for the player. */

function LockScreen({
  requireRewatch,
  onRewatch
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", {
    className: "tp-overlay tp-lock",
    children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
      className: "tp-lock-card",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", {
        className: "tp-lock-icon",
        "aria-hidden": "true",
        children: "\uD83D\uDD12"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", {
        children: "Video locked"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", {
        children: requireRewatch ? 'You used all your attempts. Re-watch the full video to earn another try.' : 'This video is locked.'
      }), requireRewatch && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", {
        className: "tp-quiz-submit",
        onClick: onRewatch,
        children: "Re-watch to unlock"
      })]
    })
  });
}
function BigPlay({
  onPlay
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", {
    className: "tp-bigplay",
    "aria-label": "Play",
    onClick: onPlay,
    children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", {
      viewBox: "0 0 24 24",
      width: "40",
      height: "40",
      fill: "currentColor",
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", {
        d: "M8 5v14l11-7z"
      })
    })
  });
}
function Message({
  children
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", {
    className: "tp-overlay tp-message",
    children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", {
      className: "tp-lock-card",
      children: children
    })
  });
}
function Spinner() {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", {
    className: "tp-spinner",
    "aria-label": "Loading"
  });
}

/***/ },

/***/ "./dev_trueplayer/player/components/Quiz.jsx"
/*!***************************************************!*\
  !*** ./dev_trueplayer/player/components/Quiz.jsx ***!
  \***************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Quiz)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _Utils_rest__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @Utils/rest */ "./dev_trueplayer/utils/rest.js");
/* harmony import */ var _grade_local__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../grade-local */ "./dev_trueplayer/player/grade-local.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__);




/**
 * In-player quiz layer used for both checkpoints and the final gate. Renders
 * question prompts (never answers), submits to the server for grading, and
 * surfaces pass / fail / lock outcomes.
 *
 * In admin `preview` mode the config still carries the correct answers, so we
 * grade client-side (no server call, no locking).
 */

function Quiz({
  videoId,
  gateId,
  quiz,
  title,
  onPass,
  onFail,
  onLocked,
  preview = false
}) {
  const [answers, setAnswers] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({});
  const [busy, setBusy] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [result, setResult] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const questions = quiz.questions || [];
  const setAnswer = (qid, val) => setAnswers(a => ({
    ...a,
    [qid]: val
  }));
  const submit = async () => {
    setBusy(true);
    try {
      const verdict = preview ? (0,_grade_local__WEBPACK_IMPORTED_MODULE_2__.gradeLocal)(quiz, answers) : await _Utils_rest__WEBPACK_IMPORTED_MODULE_1__.rest.post('grade', {
        video: videoId,
        gate: gateId,
        answers
      });
      setResult(verdict);
      if (verdict.passed) {
        setTimeout(() => onPass(verdict), 900);
      } else if (verdict.locked) {
        setTimeout(() => onLocked(verdict), 1500);
      } else {
        onFail(verdict);
      }
    } catch (e) {
      setResult({
        error: e.message
      });
    } finally {
      setBusy(false);
    }
  };
  const answeredAll = questions.every(q => answers[q.id] !== undefined && answers[q.id] !== '');
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
    className: "tp-overlay tp-quiz",
    children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      className: "tp-quiz-card",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("h3", {
        className: "tp-quiz-title",
        children: title
      }), questions.map((q, idx) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        className: "tp-quiz-q",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("p", {
          className: "tp-quiz-prompt",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("span", {
            className: "tp-quiz-num",
            children: [idx + 1, "."]
          }), " ", q.prompt]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
          className: "tp-quiz-opts",
          children: q.type === 'boolean' ? [{
            id: 'true',
            label: 'True'
          }, {
            id: 'false',
            label: 'False'
          }].map(o => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("label", {
            className: `tp-quiz-opt ${String(answers[q.id]) === o.id ? 'is-picked' : ''}`,
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("input", {
              type: "radio",
              name: q.id,
              checked: String(answers[q.id]) === o.id,
              onChange: () => setAnswer(q.id, o.id)
            }), o.label]
          }, o.id)) : (q.options || []).map(o => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("label", {
            className: `tp-quiz-opt ${answers[q.id] === o.id ? 'is-picked' : ''}`,
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("input", {
              type: "radio",
              name: q.id,
              checked: answers[q.id] === o.id,
              onChange: () => setAnswer(q.id, o.id)
            }), o.label]
          }, o.id))
        })]
      }, q.id)), result && !result.passed && !result.error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("p", {
        className: "tp-quiz-feedback tp-fail",
        children: result.locked ? 'Locked — you must re-watch the video to try again.' : `Not quite (${result.score}%). Attempts left: ${result.attemptsLeft}.`
      }), result && result.passed && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("p", {
        className: "tp-quiz-feedback tp-pass",
        children: ["Passed (", result.score, "%)! \uD83C\uDF89"]
      }), result && result.error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("p", {
        className: "tp-quiz-feedback tp-fail",
        children: result.error
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("button", {
        className: "tp-quiz-submit",
        disabled: !answeredAll || busy,
        onClick: submit,
        children: busy ? 'Checking…' : 'Submit'
      })]
    })
  });
}

/***/ },

/***/ "./dev_trueplayer/player/components/TimedContent.jsx"
/*!***********************************************************!*\
  !*** ./dev_trueplayer/player/components/TimedContent.jsx ***!
  \***********************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ TimedContent)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);

/**
 * Timed content region (pro) — rendered below the player. Shows the content of
 * whichever segment covers the current time. Segment content is pre-rendered
 * server-side (shortcodes resolved) into `html`; in admin preview it falls back
 * to the raw authored `content`.
 */
function activeItem(items, t) {
  return (items || []).find(it => {
    const start = parseFloat(it.start) || 0;
    const end = it.end ? parseFloat(it.end) : Infinity;
    return t >= start && t < end;
  });
}
function TimedContent({
  config,
  current
}) {
  const timed = config && config.timedContent;
  if (!timed || !timed.enabled || !timed.items || !timed.items.length) {
    return null;
  }
  const item = activeItem(timed.items, current);
  if (!item) {
    return null;
  }
  const html = item.html != null ? item.html : item.content || '';
  if (!html) {
    return null;
  }
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", {
    className: "tp-timed-content",
    dangerouslySetInnerHTML: {
      __html: html
    }
  });
}

/***/ },

/***/ "./dev_trueplayer/player/coverage.js"
/*!*******************************************!*\
  !*** ./dev_trueplayer/player/coverage.js ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CoverageTracker: () => (/* binding */ CoverageTracker)
/* harmony export */ });
/* harmony import */ var _Utils_rest__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @Utils/rest */ "./dev_trueplayer/utils/rest.js");


/**
 * Client-side coverage tracker. Marks whole-seconds only while playback is
 * genuinely advancing (guards against seek jumps and rate cheating), and
 * heartbeats deltas to the server, which remains the source of truth.
 */
class CoverageTracker {
  constructor({
    videoId,
    getDuration,
    onState,
    preview = false
  }) {
    this.videoId = videoId;
    this.getDuration = getDuration;
    this.onState = onState || (() => {});
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
  mark(currentTime) {
    const sec = Math.floor(currentTime);
    const delta = currentTime - this.lastTime;
    // Only count forward, real-time-ish advances (<= ~1.5s per tick at 1x
    // with 4x rate headroom). Big jumps (seeks/skips) are ignored.
    if (delta >= 0 && delta <= 6) {
      if (!this.watched.has(sec)) {
        this.watched.add(sec);
        this.unsent.add(sec);
      }
      if (sec > this.frontier) {
        this.frontier = sec;
      }
      // Replay tally: count every played second per 100-bucket, INCLUDING
      // repeats, so re-watched segments show up hotter than watch-once ones.
      const dur = this.getDuration() || 0;
      if (dur > 0) {
        const bucket = Math.min(99, Math.floor(sec / dur * 100));
        this.playTally[bucket] = (this.playTally[bucket] || 0) + 1;
      }
    }
    this.lastTime = currentTime;
  }

  /** Player calls this when a fresh play-session starts (initial play / replay). */
  newSession() {
    this.sessionStarted = false;
  }

  /** After a legitimate seek, resync the reference time. */
  resync(currentTime) {
    this.lastTime = currentTime;
  }
  start(mediaGetter) {
    this.mediaGetter = mediaGetter;
    // In preview mode we still track coverage locally (frontier/anti-skip)
    // but never hit the network.
    if (!this.preview) {
      this.timer = setInterval(() => this.flush(), 10000);
    }
  }
  toRanges(set) {
    const arr = Array.from(set).sort((a, b) => a - b);
    const ranges = [];
    let s = null;
    let p = null;
    arr.forEach(n => {
      if (s === null) {
        s = n;
        p = n;
      } else if (n === p + 1) {
        p = n;
      } else {
        ranges.push([s, p + 1]);
        s = n;
        p = n;
      }
    });
    if (s !== null) {
      ranges.push([s, p + 1]);
    }
    return ranges;
  }
  async flush(final = false) {
    if (this.preview) {
      this.unsent.clear();
      return;
    }
    const hasActivity = this.unsent.size > 0 || Object.keys(this.playTally).length > 0;
    if (!hasActivity && !final) {
      return;
    }
    const ranges = this.toRanges(this.unsent);
    const plays = this.playTally;
    const now = Date.now();
    const realElapsed = Math.round((now - this.lastFlush) / 1000);
    this.lastFlush = now;
    const mediaTime = this.mediaGetter ? Math.floor(this.mediaGetter()) : 0;
    const duration = Math.floor(this.getDuration() || 0);

    // First heartbeat with real playback counts as a new view/session.
    const sessionStart = !this.sessionStarted && Object.keys(plays).length > 0;
    if (sessionStart) {
      this.sessionStarted = true;
    }
    this.unsent.clear();
    this.playTally = {};
    const body = {
      video: this.videoId,
      ranges,
      plays,
      sessionStart,
      duration,
      mediaTime,
      realElapsed
    };
    try {
      if (final && navigator.sendBeacon) {
        await (0,_Utils_rest__WEBPACK_IMPORTED_MODULE_0__.beacon)('progress', body);
      } else {
        const state = await _Utils_rest__WEBPACK_IMPORTED_MODULE_0__.rest.post('progress', body);
        this.onState(state);
      }
    } catch (e) {
      // Re-queue on failure so coverage + tally aren't lost.
      ranges.forEach(([a, b]) => {
        for (let i = a; i < b; i++) {
          this.unsent.add(i);
        }
      });
      Object.keys(plays).forEach(b => {
        this.playTally[b] = (this.playTally[b] || 0) + plays[b];
      });
      if (sessionStart) {
        this.sessionStarted = false;
      }
    }
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/***/ },

/***/ "./dev_trueplayer/player/customize.js"
/*!********************************************!*\
  !*** ./dev_trueplayer/player/customize.js ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CUSTOMIZE_DEFAULTS: () => (/* binding */ CUSTOMIZE_DEFAULTS),
/* harmony export */   autoplayMode: () => (/* binding */ autoplayMode),
/* harmony export */   resolveCustomize: () => (/* binding */ resolveCustomize)
/* harmony export */ });
/**
 * Central customization defaults + resolver. The admin writes a `customize`
 * object into the video config; here we deep-merge it over defaults so the
 * player and controls can read a complete, safe shape.
 */
const CUSTOMIZE_DEFAULTS = {
  controls: {
    play: true,
    rewind: true,
    forward: true,
    progress: true,
    currentTime: true,
    duration: true,
    mute: true,
    volume: true,
    captions: true,
    settings: true,
    // gear menu (speed/quality/captions)
    pip: true,
    fullscreen: true,
    download: false
  },
  behavior: {
    autoplay: false,
    autoplayMode: '',
    // '' (derive from autoplay) | off | muted | sound
    muted: false,
    loop: false,
    resetOnEnd: false,
    savePosition: true,
    hideControls: true,
    // auto-hide when idle during playback
    sticky: false,
    // float on scroll-out
    stickyPosition: 'bottom-right',
    preload: 'metadata',
    // auto | metadata | none
    loadStrategy: 'facade',
    // facade (click-to-load) | eager (boot on load) | onvisible (boot in view)
    noSkip: false,
    // block seeking past the furthest point watched (rewind ok)
    disableSeek: false,
    // lock the scrubber entirely — no click or drag, forward or back
    hoverPreview: false // muted inline preview when hovering the poster facade (direct-file sources)
  },
  appearance: {
    skin: 'default',
    // default | modern | simple | minimal | standard | floating (pro) | ambient (pro)
    accent: '#4f46e5',
    hoverColor: '',
    bigPlay: true,
    playButtonStyle: 'circle',
    // circle | square | soft
    roundness: 10,
    // stage border radius, px
    controlBarStyle: 'gradient',
    // gradient | solid | minimal
    aspectRatio: '16:9',
    // 16:9 | 9:16 | 4:3 | 1:1 | 21:9 | auto
    // Caption rendering (html5-backed providers). Flat keys — the section
    // merge is shallow, so nested objects would override wholesale.
    captionSize: 100,
    // % of the player's base cue size
    captionColor: '#ffffff',
    captionBackground: '#000000',
    captionOpacity: 75 // background opacity, %
  },
  speeds: [0.5, 0.75, 1, 1.25, 1.5, 2],
  skipSeconds: 10
};

/**
 * Effective autoplay mode: 'off' | 'muted' | 'sound'. `autoplayMode` wins;
 * older configs only have the boolean `autoplay` (which always meant muted).
 */
function autoplayMode(behavior = {}) {
  if (behavior.autoplayMode) {
    return behavior.autoplayMode;
  }
  return behavior.autoplay ? 'muted' : 'off';
}
function mergeSection(base, ...overrides) {
  return overrides.reduce((acc, o) => ({
    ...acc,
    ...(o && typeof o === 'object' ? o : {})
  }), {
    ...base
  });
}

/**
 * Resolve the effective customization by layering, lowest → highest priority:
 *   built-in defaults  →  site-wide defaults (TruePlayerGlobal.player_defaults)
 *   →  per-video config.customize
 *
 * So an admin sets global defaults once and any single video can override.
 */
function resolveCustomize(config = {}) {
  const global = typeof window !== 'undefined' && window.TruePlayerGlobal && window.TruePlayerGlobal.player_defaults || {};
  const c = config.customize || {};
  // Back-compat: older configs stored the accent under `branding`.
  const brandingAccent = config.branding && config.branding.accent;
  return {
    controls: mergeSection(CUSTOMIZE_DEFAULTS.controls, global.controls, c.controls),
    behavior: mergeSection(CUSTOMIZE_DEFAULTS.behavior, global.behavior, c.behavior),
    appearance: mergeSection({
      ...CUSTOMIZE_DEFAULTS.appearance,
      accent: brandingAccent || CUSTOMIZE_DEFAULTS.appearance.accent
    }, global.appearance, c.appearance),
    speeds: Array.isArray(c.speeds) && c.speeds.length && c.speeds || Array.isArray(global.speeds) && global.speeds.length && global.speeds || CUSTOMIZE_DEFAULTS.speeds,
    skipSeconds: c.skipSeconds || global.skipSeconds || CUSTOMIZE_DEFAULTS.skipSeconds
  };
}

/***/ },

/***/ "./dev_trueplayer/player/ga.js"
/*!*************************************!*\
  !*** ./dev_trueplayer/player/ga.js ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   gaEvent: () => (/* binding */ gaEvent)
/* harmony export */ });
/**
 * Google Analytics push (Settings → Integrations). Off unless enabled. Uses the
 * site's existing GA4 gtag / GTM dataLayer when present; if a measurement ID is
 * configured and no gtag exists, TruePlayer loads its own GA4 tag once.
 */
function ensureGtag(id) {
  if (window.gtag || !id) {
    return;
  }
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id);
}
function gaEvent(name, params) {
  const g = window.TruePlayerGlobal || {};
  if (!g.ga_enabled) {
    return;
  }
  try {
    ensureGtag(g.ga_measurement_id);
    const payload = g.ga_measurement_id ? {
      ...params,
      send_to: g.ga_measurement_id
    } : params;
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, payload);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: name,
        ...payload
      });
    }
  } catch (e) {
    // ignore
  }
}

/***/ },

/***/ "./dev_trueplayer/player/grade-local.js"
/*!**********************************************!*\
  !*** ./dev_trueplayer/player/grade-local.js ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   gradeLocal: () => (/* binding */ gradeLocal)
/* harmony export */ });
/**
 * Client-side quiz grading — used ONLY in admin preview mode, where the full
 * config (including correct answers) is available. Mirrors the server-side
 * GradingService::is_correct logic so the preview matches production grading.
 * The live frontend never uses this (answers are stripped before they reach
 * the browser).
 */
function toBool(v) {
  return v === true || v === 'true' || v === '1' || v === 1;
}
function isCorrect(q, given) {
  if (q.type === 'boolean') {
    const c = q.correct !== undefined ? q.correct : q.answer;
    return toBool(given) === toBool(c);
  }
  let correctIds = [];
  if (q.correct !== undefined && q.correct !== null) {
    correctIds = Array.isArray(q.correct) ? q.correct : [q.correct];
  } else if (Array.isArray(q.correctIndexes)) {
    correctIds = q.correctIndexes;
  } else if (Array.isArray(q.options)) {
    correctIds = q.options.filter(o => o && o.isCorrect).map(o => o.id);
  }
  const givenIds = Array.isArray(given) ? given : given === undefined || given === null ? [] : [given];
  const a = correctIds.map(String).sort();
  const b = givenIds.map(String).sort();
  return a.length > 0 && JSON.stringify(a) === JSON.stringify(b);
}
function gradeLocal(quiz, answers) {
  const questions = quiz.questions || [];
  const perQuestion = {};
  let correct = 0;
  questions.forEach(q => {
    const ok = isCorrect(q, answers[q.id]);
    perQuestion[q.id] = ok;
    if (ok) {
      correct++;
    }
  });
  const total = questions.length;
  const score = total ? Math.round(correct / total * 10000) / 100 : 0;
  const passPercent = quiz.passPercent !== undefined ? quiz.passPercent : 70;
  return {
    passed: score >= passPercent,
    score,
    perQuestion
  };
}

/***/ },

/***/ "./dev_trueplayer/player/mount.js"
/*!****************************************!*\
  !*** ./dev_trueplayer/player/mount.js ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   mountPlayers: () => (/* binding */ mountPlayers),
/* harmony export */   mountPlaylists: () => (/* binding */ mountPlaylists),
/* harmony export */   mountPopups: () => (/* binding */ mountPopups)
/* harmony export */ });
/* harmony import */ var react_dom_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-dom/client */ "react-dom/client");
/* harmony import */ var react_dom_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_dom_client__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _Player__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Player */ "./dev_trueplayer/player/Player.jsx");
/* harmony import */ var _Playlist__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./Playlist */ "./dev_trueplayer/player/Playlist.jsx");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__);




// Domains to warm (DNS + TLS) so an embed starts fast once clicked.

const WARM_HOSTS = {
  youtube: ['https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://i.ytimg.com', 'https://s.ytimg.com', 'https://googleads.g.doubleclick.net'],
  vimeo: ['https://player.vimeo.com', 'https://i.vimeocdn.com', 'https://f.vimeocdn.com']
};
function preconnect(href) {
  if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
    return;
  }
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = href;
  link.crossOrigin = '';
  document.head.appendChild(link);
}

/**
 * Warm the network for an embed the moment the visitor shows intent (hover /
 * focus / touch), so the click-to-play chain isn't waiting on DNS, TLS, or the
 * YouTube IFrame API script. Called once per node.
 */
function warm(type) {
  (WARM_HOSTS[type] || []).forEach(preconnect);
  if (type === 'youtube' && !document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
}

/**
 * Read + parse the inline JSON config a mount node carries.
 */
function readConfig(node) {
  const configEl = node.querySelector('script.trueplayer-config');
  try {
    return configEl ? JSON.parse(configEl.textContent) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Boot the real React player into a node, replacing any poster facade. When
 * `autoStart` is set the player begins playing as soon as its provider is ready.
 */
function bootPlayer(node, data, videoId, autoStart) {
  if (node.dataset.tpBooted) {
    return;
  }
  node.dataset.tpBooted = '1';
  const facade = node.querySelector('.tp-facade');
  if (facade) {
    facade.remove();
  }
  const root = document.createElement('div');
  root.className = 'tp-root';
  node.appendChild(root);
  (0,react_dom_client__WEBPACK_IMPORTED_MODULE_0__.createRoot)(root).render(/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Player__WEBPACK_IMPORTED_MODULE_1__["default"], {
    videoId: videoId,
    config: data.config || {},
    title: data.title || '',
    autoStart: autoStart
  }));
}

/**
 * Muted, looped inline preview while hovering the poster facade — Presto-style
 * "muted autoplay preview". Direct-file sources only (no iframe/hls machinery);
 * starts after a short intent delay and is torn down on pointer-leave.
 */
function attachHoverPreview(facade, config) {
  const source = config && config.source || {};
  const behavior = config && config.customize && config.customize.behavior || {};
  const src = source.src || '';
  const previewable = behavior.hoverPreview && ['self', 'url'].includes(source.type) && source.mediaType !== 'audio' && src && !/\.m3u8($|\?)/i.test(src);
  if (!previewable) {
    return;
  }
  let timer = null;
  let vid = null;
  const stop = () => {
    clearTimeout(timer);
    timer = null;
    if (vid) {
      vid.pause();
      vid.remove();
      vid = null;
    }
  };
  facade.addEventListener('pointerenter', () => {
    if (facade.closest('[data-tp-booted]') || timer || vid) {
      return;
    }
    timer = setTimeout(() => {
      vid = document.createElement('video');
      vid.className = 'tp-facade-poster tp-hover-preview';
      vid.src = src;
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.preload = 'auto';
      facade.insertBefore(vid, facade.querySelector('.tp-facade-btn'));
      const p = vid.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    }, 300);
  });
  facade.addEventListener('pointerleave', stop);
  // The click boot removes the facade wholesale; just clear our timer.
  facade.addEventListener('click', stop, {
    once: true
  });
}

/**
 * Discovers [data-trueplayer] mount nodes. To keep pages fast, a node that
 * rendered a poster facade stays inert — no video element, no YouTube/Vimeo
 * iframe, no hls.js, no gate request — until the visitor clicks to play. Nodes
 * with autoplay (or no facade) boot immediately.
 */
function mountPlayers() {
  document.querySelectorAll('[data-trueplayer]').forEach(node => {
    if (node.dataset.tpBooted) {
      return;
    }
    const data = readConfig(node);
    const videoId = data.videoId || parseInt(node.dataset.videoId, 10);
    if (!videoId) {
      return;
    }
    const facade = node.querySelector('.tp-facade');
    const autoplay = node.dataset.tpAutoplay === '1';
    const strategy = node.dataset.tpLoad || (facade ? 'facade' : 'eager');
    const type = data.config && data.config.source && data.config.source.type;

    // on-visible: boot (without playing) once the player scrolls into view,
    // so below-the-fold videos don't load their media on first paint.
    if (facade && !autoplay && strategy === 'onvisible' && 'IntersectionObserver' in window) {
      warm(type);
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !node.dataset.tpBooted) {
            obs.disconnect();
            bootPlayer(node, data, videoId, false);
          }
        });
      }, {
        rootMargin: '200px'
      });
      io.observe(node);
      return;
    }
    if (facade && !autoplay) {
      let warmed = false;
      const doWarm = () => {
        if (!warmed) {
          warmed = true;
          warm(type);
        }
      };
      ['pointerenter', 'touchstart', 'focusin'].forEach(ev => facade.addEventListener(ev, doWarm, {
        once: true,
        passive: true
      }));
      const boot = e => {
        if (e) {
          e.preventDefault();
        }
        doWarm();
        bootPlayer(node, data, videoId, true);
      };
      facade.addEventListener('click', boot, {
        once: true
      });
      attachHoverPreview(facade, data.config);
      return;
    }
    bootPlayer(node, data, videoId, autoplay);
  });
}

/**
 * Discovers [data-trueplayer-popup] triggers and opens the player in a lightbox
 * on click. Nothing loads until then — the player is mounted into the modal and
 * torn down on close.
 */
function mountPopups() {
  document.querySelectorAll('[data-trueplayer-popup]').forEach(node => {
    if (node.dataset.tpPopupBound) {
      return;
    }
    node.dataset.tpPopupBound = '1';
    const el = node.querySelector('script.trueplayer-popup-config');
    let data = {};
    try {
      data = el ? JSON.parse(el.textContent) : {};
    } catch (e) {
      data = {};
    }
    const videoId = data.videoId || parseInt(node.dataset.videoId, 10);
    if (!videoId) {
      return;
    }
    const trigger = node.querySelector('.trueplayer-popup-trigger') || node;
    trigger.addEventListener('click', e => {
      e.preventDefault();
      openPopup(videoId, data.config || {});
    });
  });
}
function openPopup(videoId, config) {
  const backdrop = document.createElement('div');
  backdrop.className = 'tp-popup-backdrop';
  backdrop.innerHTML = '<div class="tp-popup-dialog"><button class="tp-popup-close" aria-label="Close">×</button><div class="tp-popup-player"></div></div>';
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  const root = (0,react_dom_client__WEBPACK_IMPORTED_MODULE_0__.createRoot)(backdrop.querySelector('.tp-popup-player'));
  root.render(/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Player__WEBPACK_IMPORTED_MODULE_1__["default"], {
    videoId: videoId,
    config: config,
    autoStart: true
  }));
  const close = () => {
    root.unmount();
    backdrop.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  };
  const onKey = e => {
    if (e.key === 'Escape') {
      close();
    }
  };
  backdrop.querySelector('.tp-popup-close').addEventListener('click', close);
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) {
      close();
    }
  });
  document.addEventListener('keydown', onKey);
}

/** Discovers [data-trueplayer-playlist] nodes and boots a Playlist per node. */
function mountPlaylists() {
  document.querySelectorAll('[data-trueplayer-playlist]').forEach(node => {
    if (node.dataset.tpBooted) {
      return;
    }
    node.dataset.tpBooted = '1';
    const configEl = node.querySelector('script.trueplayer-playlist-config');
    let data = {};
    try {
      data = configEl ? JSON.parse(configEl.textContent) : {};
    } catch (e) {
      data = {};
    }
    if (!(data.items && data.items.length)) {
      return;
    }
    const root = document.createElement('div');
    node.appendChild(root);
    (0,react_dom_client__WEBPACK_IMPORTED_MODULE_0__.createRoot)(root).render(/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Playlist__WEBPACK_IMPORTED_MODULE_2__["default"], {
      data: data
    }));
  });
}

/***/ },

/***/ "./dev_trueplayer/player/pip.js"
/*!**************************************!*\
  !*** ./dev_trueplayer/player/pip.js ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   cloneStylesInto: () => (/* binding */ cloneStylesInto),
/* harmony export */   supportsContainerPiP: () => (/* binding */ supportsContainerPiP)
/* harmony export */ });
/**
 * "Container" Picture-in-Picture — floats the entire stage element (the
 * video/iframe *and* our custom controls) into a real OS-level floating
 * window via the Document Picture-in-Picture API.
 *
 * This is what makes PiP possible at all for YouTube/Vimeo: the standard
 * per-<video> `element.requestPictureInPicture()` can't reach into a
 * cross-origin embed's iframe, so those providers have no native PiP target
 * to hand the browser. Document PiP sidesteps that entirely — it just moves
 * our own DOM node (iframe and all) into a new always-on-top window, the
 * same way a portal would.
 *
 * Chromium-only (Chrome/Edge 116+) for now; callers should fall back to a
 * provider's own native PiP (html5, and Vimeo's SDK method) where this isn't
 * supported, and hide the button entirely where neither is available.
 */
const supportsContainerPiP = () => typeof window !== 'undefined' && !!window.documentPictureInPicture;

/** Clone the host page's stylesheets into the PiP window so the portaled stage keeps its styling. */
function cloneStylesInto(doc) {
  [...document.styleSheets].forEach(sheet => {
    try {
      if (sheet.href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        doc.head.appendChild(link);
        return;
      }
      const rules = [...sheet.cssRules].map(r => r.cssText).join('\n');
      const style = document.createElement('style');
      style.textContent = rules;
      doc.head.appendChild(style);
    } catch (e) {
      // Cross-origin sheet with no accessible cssRules and no href — skip it.
    }
  });
}

/***/ },

/***/ "./dev_trueplayer/player/providers/emitter.js"
/*!****************************************************!*\
  !*** ./dev_trueplayer/player/providers/emitter.js ***!
  \****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createEmitter: () => (/* binding */ createEmitter)
/* harmony export */ });
/** Minimal event emitter shared by all media providers. */
function createEmitter() {
  const map = new Map();
  return {
    on(event, cb) {
      if (!map.has(event)) {
        map.set(event, new Set());
      }
      map.get(event).add(cb);
      return () => map.get(event).delete(cb);
    },
    emit(event, payload) {
      (map.get(event) || []).forEach(cb => {
        try {
          cb(payload);
        } catch (e) {
          // swallow — one bad listener shouldn't break playback
        }
      });
    },
    clear() {
      map.clear();
    }
  };
}

/***/ },

/***/ "./dev_trueplayer/player/providers/html5.js"
/*!**************************************************!*\
  !*** ./dev_trueplayer/player/providers/html5.js ***!
  \**************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createHtml5Provider: () => (/* binding */ createHtml5Provider)
/* harmony export */ });
/* harmony import */ var _emitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./emitter */ "./dev_trueplayer/player/providers/emitter.js");


/**
 * HTML5 <video>/<audio> provider. Plays self-hosted files and HLS — natively on
 * Safari, otherwise via a lazily-imported hls.js. Exposes quality levels for
 * HLS and native <track> captions.
 */
async function createHtml5Provider(container, source, opts = {}) {
  const emitter = (0,_emitter__WEBPACK_IMPORTED_MODULE_0__.createEmitter)();
  const isAudio = source.mediaType === 'audio';
  const el = document.createElement(isAudio ? 'audio' : 'video');
  el.className = 'tp-media';
  el.playsInline = true;
  const behavior = opts.behavior || {};
  el.preload = behavior.preload || 'metadata';
  if (behavior.loop) {
    el.loop = true;
  }
  if (behavior.muted || behavior.autoplay && !behavior.autoplaySound) {
    el.muted = true; // autoplay only works muted (unless sound mode, which retries muted on rejection)
  }
  if (behavior.autoplay) {
    el.autoplay = true;
  }
  if (source.poster) {
    el.poster = source.poster;
  }
  // Only set crossOrigin when explicitly requested (or when cross-origin
  // subtitle tracks need it). Setting it unconditionally makes the browser
  // REQUIRE CORS headers, which breaks playback of ordinary external videos
  // (YouTube-CDN, S3, most hosts) that don't send them.
  const needsCors = source.crossOrigin || (source.subtitles || []).some(t => t.src && /^https?:\/\//i.test(t.src) && !t.src.startsWith(window.location.origin));
  if (needsCors) {
    el.crossOrigin = typeof source.crossOrigin === 'string' ? source.crossOrigin : 'anonymous';
  }
  container.appendChild(el);
  let hls = null;
  let qualities = [];
  const src = source.src || '';
  const isHls = source.type === 'hls' || /\.m3u8($|\?)/i.test(src);
  if (isHls && !el.canPlayType('application/vnd.apple.mpegurl')) {
    const Hls = (await __webpack_require__.e(/*! import() | hlsjs */ "hlsjs").then(__webpack_require__.bind(__webpack_require__, /*! hls.js */ "./node_modules/hls.js/dist/hls.mjs"))).default;
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true
      });
      hls.loadSource(src);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        qualities = (hls.levels || []).map((lvl, i) => ({
          id: String(i),
          label: lvl.height ? `${lvl.height}p` : `Level ${i}`
        }));
        qualities.unshift({
          id: 'auto',
          label: 'Auto'
        });
        emitter.emit('qualitychange', qualities);
      });
    } else {
      el.src = src; // last-ditch
    }
  } else {
    el.src = src;
  }

  // Subtitles.
  (source.subtitles || []).forEach((t, i) => {
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = t.label || `Track ${i + 1}`;
    track.srclang = t.srclang || 'en';
    track.src = t.src;
    if (t.default) {
      track.default = true;
    }
    el.appendChild(track);
  });

  // Wire native events → emitter.
  const fwd = (native, mapped) => el.addEventListener(native, () => emitter.emit(mapped || native));
  fwd('loadedmetadata', 'ready');
  fwd('durationchange');
  fwd('timeupdate');
  fwd('play');
  fwd('pause');
  fwd('ended');
  fwd('waiting');
  fwd('playing');
  fwd('ratechange');
  fwd('volumechange');
  el.addEventListener('error', () => emitter.emit('error', el.error));
  return {
    kind: 'html5',
    element: el,
    sourceUrl: src,
    capabilities: {
      // `'requestPictureInPicture' in el` alone isn't enough — Firefox and
      // permissions-policy-restricted frames (some embed contexts) expose
      // the method but reject every call, which made the button look
      // broken. `document.pictureInPictureEnabled` reflects whether it can
      // actually succeed.
      pip: !isAudio && !!document.pictureInPictureEnabled && !el.disablePictureInPicture,
      quality: qualities.length > 0,
      rate: true,
      tracks: true,
      download: true,
      fullscreen: !isAudio
    },
    on: emitter.on,
    play: () => el.play(),
    pause: () => el.pause(),
    seek: t => {
      el.currentTime = t;
    },
    setVolume: v => {
      el.volume = v;
    },
    setMuted: m => {
      el.muted = m;
    },
    setRate: r => {
      el.playbackRate = r;
    },
    getCurrentTime: () => el.currentTime || 0,
    getDuration: () => isFinite(el.duration) ? el.duration : 0,
    getBufferedEnd: () => {
      try {
        return el.buffered.length ? el.buffered.end(el.buffered.length - 1) : 0;
      } catch (e) {
        return 0;
      }
    },
    isPaused: () => el.paused,
    isMuted: () => el.muted,
    getVolume: () => el.volume,
    getRate: () => el.playbackRate,
    getQualities: () => qualities,
    setQuality: id => {
      if (hls) {
        hls.currentLevel = id === 'auto' ? -1 : parseInt(id, 10);
      }
    },
    getTextTracks: () => Array.from(el.textTracks || []).map((t, i) => ({
      id: String(i),
      label: t.label
    })),
    setTextTrack: id => {
      Array.from(el.textTracks || []).forEach((t, i) => {
        t.mode = String(i) === String(id) ? 'showing' : 'hidden';
      });
    },
    // Cues for the interactive transcript. Force the track to load (mode
    // 'hidden' parses cues without rendering them) and flatten to plain data.
    getCues: () => {
      const tracks = Array.from(el.textTracks || []);
      const t = tracks.find(x => x.cues && x.cues.length) || tracks.find(x => x.mode !== 'disabled') || tracks[0];
      if (!t) {
        return [];
      }
      if (t.mode === 'disabled') {
        t.mode = 'hidden'; // triggers async cue parsing
      }
      return Array.from(t.cues || []).map(c => ({
        start: c.startTime,
        end: c.endTime,
        text: (c.text || '').replace(/<[^>]+>/g, '')
      }));
    },
    requestPiP: () => el.requestPictureInPicture ? el.requestPictureInPicture() : Promise.reject(),
    exitPiP: () => document.pictureInPictureElement ? document.exitPictureInPicture() : Promise.resolve(),
    isPiPActive: () => document.pictureInPictureElement === el,
    destroy: () => {
      if (hls) {
        hls.destroy();
      }
      el.remove();
      emitter.clear();
    }
  };
}

/***/ },

/***/ "./dev_trueplayer/player/providers/index.js"
/*!**************************************************!*\
  !*** ./dev_trueplayer/player/providers/index.js ***!
  \**************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createProvider: () => (/* binding */ createProvider)
/* harmony export */ });
/* harmony import */ var _html5__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./html5 */ "./dev_trueplayer/player/providers/html5.js");


/**
 * Bunny.net Stream → HLS. We play the raw playlist with our own controls +
 * watch-tracking rather than Bunny's iframe. Bunny CDN sends CORS headers, so
 * hls.js can fetch the manifest/segments.
 */
function resolveBunny(source) {
  if (source.src) {
    return {
      ...source,
      type: 'hls'
    }; // a full .m3u8 URL was provided
  }
  const zone = (source.pullZone || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return {
    ...source,
    type: 'hls',
    src: `https://${zone}/${source.videoId}/playlist.m3u8`
  };
}

/**
 * Mux → HLS. Mux serves an HLS playlist at stream.mux.com/{PLAYBACK_ID}.m3u8;
 * a full .m3u8 (e.g. a signed URL) can be supplied directly instead.
 */
function resolveMux(source) {
  if (source.src) {
    return {
      ...source,
      type: 'hls'
    };
  }
  const id = (source.playbackId || source.videoId || '').trim();
  return {
    ...source,
    type: 'hls',
    src: `https://stream.mux.com/${id}.m3u8`
  };
}

/**
 * Bunny Storage → a direct file (mp4/webm) or playlist from a pull zone. An
 * .m3u8 plays through hls.js; anything else is a plain progressive file.
 */
function resolveBunnyStorage(source) {
  const src = (source.src || '').trim();
  return {
    ...source,
    type: /\.m3u8(\?|$)/i.test(src) ? 'hls' : 'url',
    src
  };
}

/**
 * Provider factory. HTML5 (self-hosted/HLS/Bunny/audio/url) ships in the core
 * bundle; YouTube and Vimeo SDKs are code-split and only loaded when that
 * source type is actually used.
 */
async function createProvider(container, source, opts = {}) {
  if (source.type === 'bunny') {
    return (0,_html5__WEBPACK_IMPORTED_MODULE_0__.createHtml5Provider)(container, resolveBunny(source), opts);
  }
  if (source.type === 'mux') {
    return (0,_html5__WEBPACK_IMPORTED_MODULE_0__.createHtml5Provider)(container, resolveMux(source), opts);
  }
  if (source.type === 'bunnyStorage') {
    return (0,_html5__WEBPACK_IMPORTED_MODULE_0__.createHtml5Provider)(container, resolveBunnyStorage(source), opts);
  }
  switch (source.type) {
    case 'youtube':
      {
        const {
          createYouTubeProvider
        } = await __webpack_require__.e(/*! import() | yt */ "yt").then(__webpack_require__.bind(__webpack_require__, /*! ./youtube */ "./dev_trueplayer/player/providers/youtube.js"));
        return createYouTubeProvider(container, source, opts);
      }
    case 'vimeo':
      {
        const {
          createVimeoProvider
        } = await __webpack_require__.e(/*! import() | vimeo */ "vimeo").then(__webpack_require__.bind(__webpack_require__, /*! ./vimeo */ "./dev_trueplayer/player/providers/vimeo.js"));
        return createVimeoProvider(container, source, opts);
      }
    case 'self':
    case 'url':
    case 'hls':
    case 'audio':
    default:
      return (0,_html5__WEBPACK_IMPORTED_MODULE_0__.createHtml5Provider)(container, source, opts);
  }
}

/***/ },

/***/ "./dev_trueplayer/player/rules.js"
/*!****************************************!*\
  !*** ./dev_trueplayer/player/rules.js ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   passesConditions: () => (/* binding */ passesConditions)
/* harmony export */ });
/**
 * Conditional-rules evaluator (pro) — client mirror of PHP
 * TruePlayer\Services\Rules. Decides whether a layer applies to the current
 * viewer. Any change to fields/operators must be mirrored in includes/services/rules.php.
 *
 * A rule group: { match: 'all'|'any', rules: [ { field, operator, value, key? }, … ] }
 *
 * context = {
 *   viewer:     { loggedIn, isCrmContact, crmTags:[], crmLists:[] },
 *   url:        URLSearchParams,
 *   layerState: { seen:{id:true}, completed:{id:true}, emailSubmitted:bool },
 * }
 */

function cmpBool(actual, value, operator) {
  const want = value === 'yes' || value === true || value === '1' || value === 1;
  const eq = actual === want;
  return operator === 'is_not' ? !eq : eq;
}
function cmpIn(haystack, value, operator) {
  const list = (haystack || []).map(String);
  const inList = list.includes(String(value));
  return operator === 'is_not' ? !inList : inList;
}
function cmpStr(actual, value, operator) {
  const a = String(actual ?? '');
  const v = String(value ?? '');
  if (operator === 'is_not') {
    return a !== v;
  }
  if (operator === 'contains') {
    return v !== '' && a.indexOf(v) !== -1;
  }
  return a === v;
}
function evalRule(rule, context) {
  const {
    field,
    operator = 'is',
    value = ''
  } = rule || {};
  const viewer = context.viewer || {};
  const state = context.layerState || {};
  switch (field) {
    case 'logged_in':
      return cmpBool(!!viewer.loggedIn, value, operator);
    case 'crm_contact':
      return cmpBool(!!viewer.isCrmContact, value, operator);
    case 'crm_tag':
      return cmpIn(viewer.crmTags, value, operator);
    case 'crm_list':
      return cmpIn(viewer.crmLists, value, operator);
    case 'url_param':
      {
        const params = context.url || new URLSearchParams('');
        const actual = params.get ? params.get(rule.key || '') : null;
        return cmpStr(actual, value, operator);
      }
    case 'email_submitted':
      return cmpBool(!!state.emailSubmitted, value, operator);
    case 'layer_seen':
      return cmpBool(!!(state.seen && state.seen[value]), 'yes', operator === 'is_not' ? 'is_not' : 'is');
    case 'layer_completed':
      return cmpBool(!!(state.completed && state.completed[value]), 'yes', operator === 'is_not' ? 'is_not' : 'is');
    default:
      return true;
  }
}
function passesConditions(group, context) {
  if (!group || !group.rules || !group.rules.length) {
    return true;
  }
  const match = group.match === 'any' ? 'any' : 'all';
  const results = group.rules.map(r => evalRule(r, context));
  return match === 'any' ? results.some(Boolean) : results.every(Boolean);
}

/***/ },

/***/ "./dev_trueplayer/utils/format.js"
/*!****************************************!*\
  !*** ./dev_trueplayer/utils/format.js ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   formatTime: () => (/* binding */ formatTime)
/* harmony export */ });
/** Format seconds → m:ss or h:mm:ss. */
function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) {
    sec = 0;
  }
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor(sec % 3600 / 60);
  const s = sec % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/***/ },

/***/ "./dev_trueplayer/utils/rest.js"
/*!**************************************!*\
  !*** ./dev_trueplayer/utils/rest.js ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   beacon: () => (/* binding */ beacon),
/* harmony export */   rest: () => (/* binding */ rest)
/* harmony export */ });
/**
 * Thin REST helper. Uses the localized TruePlayerGlobal for base URL + nonce so
 * logged-in requests authenticate (cookie + X-WP-Nonce) and guests still work.
 */
const G = () => window.TruePlayerGlobal || {};
function base() {
  const g = G();
  // rest_url already ends with a slash; namespace is like "trueplayer/v1/".
  return (g.rest_url || '/wp-json/') + (g.namespace || 'trueplayer/v1/');
}
async function request(path, {
  method = 'GET',
  body
} = {}) {
  const g = G();
  const res = await fetch(base() + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': g.nonce || ''
    },
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    let detail = {};
    try {
      detail = await res.json();
    } catch (e) {}
    const err = new Error(detail.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  if (res.status === 204) {
    return null;
  }
  return res.json();
}
const rest = {
  get: path => request(path),
  post: (path, body) => request(path, {
    method: 'POST',
    body
  }),
  put: (path, body) => request(path, {
    method: 'PUT',
    body
  }),
  del: path => request(path, {
    method: 'DELETE'
  }),
  base
};

/**
 * Best-effort beacon (used on unload/visibility change). Falls back to a
 * keepalive fetch when sendBeacon can't attach our nonce header.
 */
function beacon(path, body) {
  const g = G();
  try {
    return fetch(base() + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': g.nonce || ''
      },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify(body)
    });
  } catch (e) {
    return Promise.resolve();
  }
}

/***/ },

/***/ "./dev_trueplayer/player/style.css"
/*!*****************************************!*\
  !*** ./dev_trueplayer/player/style.css ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ },

/***/ "react-dom/client"
/*!***************************!*\
  !*** external "ReactDOM" ***!
  \***************************/
(module) {

module.exports = window["ReactDOM"];

/***/ },

/***/ "react/jsx-runtime"
/*!**********************************!*\
  !*** external "ReactJSXRuntime" ***!
  \**********************************/
(module) {

module.exports = window["ReactJSXRuntime"];

/***/ },

/***/ "@wordpress/element"
/*!*********************************!*\
  !*** external ["wp","element"] ***!
  \*********************************/
(module) {

module.exports = window["wp"]["element"];

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/chunk loaded */
/******/ 	(() => {
/******/ 		const deferred = [];
/******/ 		__webpack_require__.O = (result, chunkIds, fn, priority) => {
/******/ 			if(chunkIds) {
/******/ 				priority = priority || 0;
/******/ 				for(var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--) deferred[i] = deferred[i - 1];
/******/ 				deferred[i] = [chunkIds, fn, priority];
/******/ 				return;
/******/ 			}
/******/ 			let notFulfilled = Infinity;
/******/ 			for (var i = 0; i < deferred.length; i++) {
/******/ 				let [chunkIds, fn, priority] = deferred[i];
/******/ 				let fulfilled = true;
/******/ 				for (var j = 0; j < chunkIds.length; j++) {
/******/ 					if ((priority & 1 === 0 || notFulfilled >= priority) && Object.keys(__webpack_require__.O).every((key) => (__webpack_require__.O[key](chunkIds[j])))) {
/******/ 						chunkIds.splice(j--, 1);
/******/ 					} else {
/******/ 						fulfilled = false;
/******/ 						if(priority < notFulfilled) notFulfilled = priority;
/******/ 					}
/******/ 				}
/******/ 				if(fulfilled) {
/******/ 					deferred.splice(i--, 1)
/******/ 					const r = fn();
/******/ 					if (r !== undefined) result = r;
/******/ 				}
/******/ 			}
/******/ 			return result;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			const getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter/value functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			if(Array.isArray(definition)) {
/******/ 				var i = 0;
/******/ 				while(i < definition.length) {
/******/ 					var key = definition[i++];
/******/ 					var binding = definition[i++];
/******/ 					if(!__webpack_require__.o(exports, key)) {
/******/ 						if(binding === 0) {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, value: definition[i++] });
/******/ 						} else {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, get: binding });
/******/ 						}
/******/ 					} else if(binding === 0) { i++; }
/******/ 				}
/******/ 			} else {
/******/ 				for(var key in definition) {
/******/ 					if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 						Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".0.1.0.js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get mini-css chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.miniCssF = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return undefined;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.hasOwn(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/load script */
/******/ 	(() => {
/******/ 		const inProgress = {};
/******/ 		const dataWebpackPrefix = "trueplayer:";
/******/ 		// loadScript function to load a script via script tag
/******/ 		__webpack_require__.l = (url, done, key, chunkId) => {
/******/ 			if(inProgress[url]) { inProgress[url].push(done); return; }
/******/ 			let script, needAttach;
/******/ 			if(key !== undefined) {
/******/ 				const scripts = document.getElementsByTagName("script");
/******/ 				for(var i = 0; i < scripts.length; i++) {
/******/ 					const s = scripts[i];
/******/ 					if(s.getAttribute("src") == url || s.getAttribute("data-webpack") == dataWebpackPrefix + key) { script = s; break; }
/******/ 				}
/******/ 			}
/******/ 			if(!script) {
/******/ 				needAttach = true;
/******/ 				script = document.createElement('script');
/******/ 		
/******/ 				script.charset = 'utf-8';
/******/ 				if (__webpack_require__.nc) {
/******/ 					script.setAttribute("nonce", __webpack_require__.nc);
/******/ 				}
/******/ 				script.setAttribute("data-webpack", dataWebpackPrefix + key);
/******/ 		
/******/ 				script.src = url;
/******/ 			}
/******/ 			inProgress[url] = [done];
/******/ 			const onScriptComplete = (prev, event) => {
/******/ 				// avoid mem leaks in IE.
/******/ 				script.onerror = script.onload = null;
/******/ 				clearTimeout(timeout);
/******/ 				const doneFns = inProgress[url];
/******/ 				delete inProgress[url];
/******/ 				script.parentNode?.removeChild(script);
/******/ 				doneFns?.forEach((fn) => (fn(event)));
/******/ 				if(prev) return prev(event);
/******/ 			}
/******/ 			const timeout = setTimeout(onScriptComplete.bind(null, undefined, { type: 'timeout', target: script }), 120000);
/******/ 			script.onerror = onScriptComplete.bind(null, script.onerror);
/******/ 			script.onload = onScriptComplete.bind(null, script.onload);
/******/ 			needAttach && document.head.appendChild(script);
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		let scriptUrl;
/******/ 		if (globalThis.importScripts) scriptUrl = globalThis.location + "";
/******/ 		const document = globalThis.document;
/******/ 		if (!scriptUrl && document) {
/******/ 			if (document.currentScript?.tagName.toUpperCase() === 'SCRIPT')
/******/ 				scriptUrl = document.currentScript.src;
/******/ 			if (!scriptUrl) {
/******/ 				const scripts = document.getElementsByTagName("script");
/******/ 				if(scripts.length) {
/******/ 					let i = scripts.length - 1;
/******/ 					while (i > -1 && (!scriptUrl || !/^http(s?):/.test(scriptUrl))) scriptUrl = scripts[i--].src;
/******/ 				}
/******/ 			}
/******/ 		}
/******/ 		// When supporting browsers where an automatic publicPath is not supported you must specify an output.publicPath manually via configuration
/******/ 		// or pass an empty string ("") and set the __webpack_public_path__ variable from your code to use your own logic.
/******/ 		if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");
/******/ 		scriptUrl = scriptUrl.replace(/^blob:/, "").replace(/#.*$/, "").replace(/\?.*$/, "").replace(/\/[^\/]+$/, "/");
/******/ 		__webpack_require__.p = scriptUrl;
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		const installedChunks = {
/******/ 			"frontend": 0,
/******/ 			"./style-frontend": 0
/******/ 		};
/******/ 		
/******/ 		__webpack_require__.f.j = (chunkId, promises) => {
/******/ 				// JSONP chunk loading for javascript
/******/ 				let installedChunkData = __webpack_require__.o(installedChunks, chunkId) ? installedChunks[chunkId] : undefined;
/******/ 				if(installedChunkData !== 0) { // 0 means "already installed".
/******/ 		
/******/ 					// a Promise means "currently loading".
/******/ 					if(installedChunkData) {
/******/ 						promises.push(installedChunkData[2]);
/******/ 					} else {
/******/ 						if("./style-frontend" != chunkId) {
/******/ 							// setup Promise in chunk cache
/******/ 							const promise = new Promise((resolve, reject) => (installedChunkData = installedChunks[chunkId] = [resolve, reject]));
/******/ 							promises.push(installedChunkData[2] = promise);
/******/ 		
/******/ 							// start chunk loading
/******/ 							const url = __webpack_require__.p + __webpack_require__.u(chunkId);
/******/ 							// create error before stack unwound to get useful stacktrace later
/******/ 							const error = new Error();
/******/ 							const loadingEnded = (event) => {
/******/ 								if(__webpack_require__.o(installedChunks, chunkId)) {
/******/ 									installedChunkData = installedChunks[chunkId];
/******/ 									if(installedChunkData !== 0) installedChunks[chunkId] = undefined;
/******/ 									if(installedChunkData) {
/******/ 										const errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 										const realSrc = event && event.target && event.target.src;
/******/ 										error.message = 'Loading chunk ' + chunkId + ' failed.\n(' + errorType + ': ' + realSrc + ')';
/******/ 										error.name = 'ChunkLoadError';
/******/ 										error.type = errorType;
/******/ 										error.request = realSrc;
/******/ 										installedChunkData[1](error);
/******/ 									}
/******/ 								}
/******/ 							};
/******/ 							__webpack_require__.l(url, loadingEnded, "chunk-" + chunkId, chunkId);
/******/ 						} else installedChunks[chunkId] = 0;
/******/ 					}
/******/ 				}
/******/ 		};
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		__webpack_require__.O.j = (chunkId) => (installedChunks[chunkId] === 0);
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		const webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			let [chunkIds, moreModules, runtime] = data;
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 			return __webpack_require__.O(result);
/******/ 		}
/******/ 		
/******/ 		const chunkLoadingGlobal = globalThis["webpackChunktrueplayer"] ||= [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module depends on other loaded chunks and execution need to be delayed
/******/ 	let __webpack_exports__ = __webpack_require__.O(undefined, ["./style-frontend"], () => (__webpack_require__("./dev_trueplayer/frontend.js")))
/******/ 	__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
/******/ 	
/******/ })()
;
//# sourceMappingURL=frontend.0.1.0.js.map