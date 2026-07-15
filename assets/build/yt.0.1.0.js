"use strict";
(globalThis["webpackChunktrueplayer"] = globalThis["webpackChunktrueplayer"] || []).push([["yt"],{

/***/ "./dev_trueplayer/player/providers/youtube.js"
/*!****************************************************!*\
  !*** ./dev_trueplayer/player/providers/youtube.js ***!
  \****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createYouTubeProvider: () => (/* binding */ createYouTubeProvider)
/* harmony export */ });
/* harmony import */ var _emitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./emitter */ "./dev_trueplayer/player/providers/emitter.js");


/** Load the YT IFrame API once. */
let ytReady = null;
function loadYT() {
  if (ytReady) {
    return ytReady;
  }
  ytReady = new Promise(resolve => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) {
        prev();
      }
      resolve(window.YT);
    };
    // The script may already be in flight (warmed on facade hover). Only
    // inject once so the ready callback fires exactly one time.
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
  return ytReady;
}
function parseId(source) {
  if (source.videoId) {
    return source.videoId;
  }
  const m = (source.src || '').match(/(?:v=|\.be\/|embed\/)([\w-]{11})/);
  return m ? m[1] : source.src;
}

/**
 * YouTube provider with our own controls overlaid (controls=0, modestbranding).
 * A poll loop synthesizes timeupdate since the IFrame API has no such event.
 */
async function createYouTubeProvider(container, source, opts = {}) {
  const YT = await loadYT();
  const emitter = (0,_emitter__WEBPACK_IMPORTED_MODULE_0__.createEmitter)();
  const host = document.createElement('div');
  host.className = 'tp-media';
  container.appendChild(host);
  let poll = null;
  let duration = 0;

  // The YT.Player constructor returns synchronously; `onReady` fires later.
  // Build and return the provider now, and emit our own 'ready' from the
  // handler — waiting on onReady before returning would emit 'ready' before
  // the Player has subscribed to it, leaving it stuck on the spinner.
  const player = new YT.Player(host, {
    videoId: parseId(source),
    playerVars: {
      controls: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      fs: 0,
      disablekb: 1,
      iv_load_policy: 3,
      // Booted from a click → begin playing as soon as the player is ready.
      autoplay: opts.autoStart ? 1 : 0,
      origin: window.location.origin
    },
    events: {
      onReady: () => {
        duration = player.getDuration() || 0;
        emitter.emit('ready');
        emitter.emit('durationchange');
      },
      onStateChange: e => {
        if (e.data === YT.PlayerState.PLAYING) {
          emitter.emit('play');
          emitter.emit('playing');
          if (!poll) {
            poll = setInterval(() => emitter.emit('timeupdate'), 250);
          }
        } else if (e.data === YT.PlayerState.PAUSED) {
          emitter.emit('pause');
        } else if (e.data === YT.PlayerState.ENDED) {
          emitter.emit('ended');
        } else if (e.data === YT.PlayerState.BUFFERING) {
          emitter.emit('waiting');
        }
      }
    }
  });
  return {
    kind: 'youtube',
    element: host,
    capabilities: {
      pip: false,
      quality: false,
      rate: true,
      tracks: false
    },
    on: emitter.on,
    play: () => player.playVideo(),
    pause: () => player.pauseVideo(),
    seek: t => player.seekTo(t, true),
    setVolume: v => player.setVolume(v * 100),
    setMuted: m => m ? player.mute() : player.unMute(),
    setRate: r => player.setPlaybackRate(r),
    getCurrentTime: () => player.getCurrentTime() || 0,
    getDuration: () => player.getDuration() || duration || 0,
    getBufferedEnd: () => (player.getVideoLoadedFraction() || 0) * (player.getDuration() || 0),
    isPaused: () => player.getPlayerState() !== YT.PlayerState.PLAYING,
    isMuted: () => player.isMuted(),
    getVolume: () => (player.getVolume() || 0) / 100,
    getRate: () => player.getPlaybackRate() || 1,
    getQualities: () => [],
    setQuality: () => {},
    getTextTracks: () => [],
    setTextTrack: () => {},
    requestPiP: () => Promise.reject(),
    destroy: () => {
      if (poll) {
        clearInterval(poll);
      }
      try {
        player.destroy();
      } catch (e) {}
      emitter.clear();
    }
  };
}

/***/ }

}]);
//# sourceMappingURL=yt.0.1.0.js.map