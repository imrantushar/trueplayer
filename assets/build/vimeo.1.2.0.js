"use strict";
(globalThis["webpackChunktrueplayer"] = globalThis["webpackChunktrueplayer"] || []).push([["vimeo"],{

/***/ "./dev_trueplayer/player/providers/vimeo.js"
/*!**************************************************!*\
  !*** ./dev_trueplayer/player/providers/vimeo.js ***!
  \**************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createVimeoProvider: () => (/* binding */ createVimeoProvider)
/* harmony export */ });
/* harmony import */ var _emitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./emitter */ "./dev_trueplayer/player/providers/emitter.js");


/**
 * Vimeo provider via @vimeo/player (lazy-imported). Native controls hidden;
 * our custom control bar drives it.
 */
async function createVimeoProvider(container, source, opts = {}) {
  const Vimeo = (await __webpack_require__.e(/*! import() | vimeojs */ "vimeojs").then(__webpack_require__.bind(__webpack_require__, /*! @vimeo/player */ "./node_modules/@vimeo/player/dist/player.es.js"))).default;
  const emitter = (0,_emitter__WEBPACK_IMPORTED_MODULE_0__.createEmitter)();
  const host = document.createElement('div');
  host.className = 'tp-media';
  container.appendChild(host);
  const id = source.videoId || (source.src || '').match(/vimeo\.com\/(\d+)/)?.[1] || source.src;
  // `muted` was previously ignored here — this provider only ever read
  // opts.autoStart, so "Start muted" did nothing on a Vimeo video.
  // `loop` stays unset deliberately: Player.jsx loops from its own
  // `ended` handler so end-of-video gating still runs.
  const player = new Vimeo(host, {
    id,
    controls: false,
    responsive: true,
    playsinline: true,
    autoplay: !!opts.autoStart,
    muted: !!(opts.behavior && opts.behavior.muted)
  });
  let duration = 0;
  let current = 0;
  let paused = true;
  player.on('timeupdate', d => {
    current = d.seconds;
    emitter.emit('timeupdate');
  });
  player.on('play', () => {
    paused = false;
    emitter.emit('play');
    emitter.emit('playing');
  });
  player.on('pause', () => {
    paused = true;
    emitter.emit('pause');
  });
  player.on('ended', () => emitter.emit('ended'));
  player.on('bufferstart', () => emitter.emit('waiting'));

  // Emit 'ready' asynchronously (player.ready() resolves over the network),
  // so the Player has subscribed by the time it fires. Awaiting it before we
  // return would emit into the void and leave the player stuck on the spinner.
  player.ready().then(async () => {
    duration = await player.getDuration().catch(() => 0);
    emitter.emit('ready');
    emitter.emit('durationchange');
  });
  return {
    kind: 'vimeo',
    element: host,
    // Whether a given embed actually supports it is only knowable async
    // (player.getPictureInPicture() round-trips to the iframe), so this is
    // a browser-level check; per-video support still governs whether
    // requestPiP() itself resolves.
    capabilities: {
      pip: !!document.pictureInPictureEnabled,
      quality: false,
      rate: true,
      tracks: false
    },
    on: emitter.on,
    play: () => player.play(),
    pause: () => player.pause(),
    // `current` only otherwise moves on the 'timeupdate' event, which Vimeo
    // fires during playback but not reliably right after a seek made while
    // paused (dragging the scrubber without hitting play). Without this,
    // getCurrentTime() kept returning the pre-drag value, so the Scrubber's
    // "wait for playback to catch up" reconciliation never saw it catch up
    // and the thumb snapped back after its timeout — set it optimistically
    // so a paused seek is reflected immediately, then reconcile with the
    // real (resolved) position once the postMessage round-trip completes.
    seek: t => {
      current = t;
      emitter.emit('timeupdate');
      return player.setCurrentTime(t).then(seconds => {
        current = seconds;
        emitter.emit('timeupdate');
      }).catch(() => {});
    },
    setVolume: v => player.setVolume(v),
    setMuted: m => player.setMuted(m),
    setRate: r => player.setPlaybackRate(r),
    getCurrentTime: () => current,
    getDuration: () => duration,
    getBufferedEnd: () => current,
    isPaused: () => paused,
    isMuted: () => false,
    getVolume: () => 1,
    getRate: () => 1,
    getQualities: () => [],
    setQuality: () => {},
    getTextTracks: () => [],
    setTextTrack: () => {},
    requestPiP: () => player.requestPictureInPicture(),
    exitPiP: () => player.exitPictureInPicture(),
    isPiPActive: () => player.getPictureInPicture().catch(() => false),
    destroy: () => {
      try {
        player.destroy();
      } catch (e) {}
      emitter.clear();
    }
  };
}

/***/ }

}]);
//# sourceMappingURL=vimeo.1.2.0.js.map