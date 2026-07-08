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
  const player = new Vimeo(host, {
    id,
    controls: false,
    responsive: true,
    playsinline: true,
    autoplay: !!opts.autoStart
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
    capabilities: {
      pip: true,
      quality: false,
      rate: true,
      tracks: false
    },
    on: emitter.on,
    play: () => player.play(),
    pause: () => player.pause(),
    seek: t => player.setCurrentTime(t),
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
//# sourceMappingURL=vimeo.0.1.0.js.map