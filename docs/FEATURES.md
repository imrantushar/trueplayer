# TruePlayer — Feature List (Free vs Pro)

Audited against the code on 2026-08-26 (`trueplayer` 1.0-beta1 + `trueplayer-pro` 1.0-beta1).
Positioning: **the player is free, the intelligence is Pro.** Everything that tracks, gates,
analyses, automates or extends sits behind `TruePlayer\Pro::active()`.

---

## Free — TruePlayer

### Player & playback
- Native React player on HTML5 `<video>`/`<audio>` — no third-party player library.
- Custom control bar: play/pause, rewind & forward (configurable skip seconds), scrubber,
  current time, duration, mute, volume, captions, settings (speed/quality/captions), PiP,
  fullscreen, optional download button. Every control individually toggleable.
- Keyboard shortcuts; Picture-in-Picture; playback-speed menu (configurable speed list).
- Behaviour: autoplay (off / muted / with sound), muted, loop, reset-on-end, auto-hide controls,
  preload (auto/metadata/none).
- **Resume where you left off** — position saved to `localStorage` per video.
- **Sticky / floating on scroll** with four corner positions.
- **Load strategy**: facade (click-to-load poster, fastest LCP), eager, or on-visible
  (IntersectionObserver). Optional hover-preview on the facade.
- **No-skip mode** (free, self-contained): blocks seeking past the furthest point actually
  watched; rewind still allowed; released on completion.
- **Disable seek**: lock the scrubber entirely.
- Universal poster overlay across all providers (not just HTML5).

### Sources
- Self-hosted / WordPress Media Library (video + audio).
- YouTube.
- Vimeo.
- External URL (mp4/webm).

### Appearance & branding
- 5 skins: Default, Modern, Simple, Minimal, Standard.
- Accent colour, hover colour, big-play toggle, play-button style (circle / soft / square)
  and size, stage roundness, control-bar style (gradient / solid / minimal).
- Aspect ratio: 16:9, 9:16, 4:3, 1:1, 21:9, auto.
- Caption styling: size, colour, background colour, background opacity.
- Custom CSS per video.
- Brand logo / static watermark overlay.
- **Chapters** with YouTube-style segmented scrubber (per-chapter segments, hover tooltip,
  current-chapter label).
- Multi-track subtitles/captions (WebVTT), plus best-effort YouTube caption import.

### Interactions
- **Call-to-action overlays** — text/CTA overlays at a timestamp, at the end, or persistent,
  with 9 positions and button styling.
- **Info panel** and end-screen behaviour.

### Content types
- **Media** (single video/audio) — CPT `tp_video`.
- **Playlists** — CPT `tp_playlist`, sidebar or grid layout, autoplay-next, show/hide titles,
  drag-order editing, `[trueplayer_playlist id]` shortcode. *(Marketed as Pro — see Gaps.)*
- **Interactive (H5P)** — optional bundled H5P engine: import `.h5p` packages, authoring UI
  generated from each content type's `semantics.json`, save & resume, xAPI statements
  normalised into the TruePlayer event pipeline. Dormant until the runtime is vendored.

### Presets
- Reusable player presets (CPT `tp_preset`) — save a look once, apply to many videos.
  (Premium skin templates inside the preset picker need Pro.)

### Publishing & embedding
- `[trueplayer id="N"]` shortcode.
- Gutenberg block `trueplayer/player` (dynamic).
- Site-wide player defaults (Settings → Player) layered under per-video overrides:
  built-in defaults → global → per-video.

### Admin & developer
- React SPA admin: Dashboard, Library (All / Media / Playlists / Interactive), Editor with
  live preview panel, Presets, Settings.
- Editor with always-on **live preview** of the real frontend player.
- **Media tagging** — `tp_video_tag` taxonomy + library filter.
- **Migration importer** — scan & import from Presto Player and FluentPlayer (idempotent).
- Event bus with 10 named events (`view.started`, `progress.milestone`, `view.completed`,
  `checkpoint.passed/failed`, `quiz.passed/failed`, `video.locked/unlocked`, `subscriber.added`).
- REST API `trueplayer/v1` and a `wp trueplayer` WP-CLI command.
- Extension seams: `trueplayer/config`, `trueplayer/gate/access`, `trueplayer/addons/loader_filtered`,
  `trueplayer/integrations/register`, `trueplayer/viewer_context`, `trueplayer/brand_name`.
- Google Analytics event forwarding (gtag / dataLayer).
- Data-retention purge cron (Compliance settings) — free code, Pro-facing UI.

---

## Pro — TruePlayer Pro

### Watch verification (enforcement)
- Server-authoritative coverage tracking: unique-second bitmap merged server-side via heartbeat +
  `sendBeacon`; the client cannot forge "completed".
- Configurable completion threshold (default 90%).
- **Anti-skip** — seeking past unwatched regions blocked; seek-jump and playback-rate guards
  (max rate 3×).
- **Must-watch strict mode** — forces 100% coverage + anti-skip.
- Require-login gate for reliable per-person tracking; guest tracking via signed `tp_uid` cookie.
- Session tracking, replay tallies, device detection, first/last seen.

### Quiz gating
- Checkpoint quizzes at timestamps + a final end-gate quiz (MCQ / true-false), no external
  quiz plugin needed.
- **Server-side grading — correct answers never reach the browser** (stripped from shortcode output).
- Pass percentage per quiz, max attempts, **lock-on-fail**; retry only after a full re-watch
  (coverage reset).
- Unlock / reset per viewer from the admin.

### Access, protection & drip
- **Private video / expiring links** — signed short-lived REST stream URLs for self-hosted files;
  Bunny CDN token authentication for pull zones. The real source URL never reaches the DOM.
- Configurable signed-URL TTL.
- **Dynamic watermark** — burns the viewer's identity into the picture (server-resolved), with
  optional slow drift.
- **Drip / availability window** — `availableFrom` date gate, with a filter for
  days-after-enrolment LMS drip.
- `trueplayer/gate/access` denial reasons surfaced in the player: login required,
  enrolment required, purchase required, not yet available.

### Premium sources
- Bunny.net Stream (pull zone + video ID → HLS).
- Bunny.net Storage (direct file / m3u8).
- Mux (playback ID → HLS, signed playlist URL supported).
- Raw HLS (`.m3u8`) with lazy-loaded hls.js.

### Premium skins & presets
- **Floating** and **Ambient** skins (free installs are silently downgraded to Default).
- Premium preset templates.

### Interactive layers & timed content
- **Interactive layers** over the picture: clickable hotspots, timed banners, forms, and
  shortcode embeds (shortcodes pre-rendered server-side).
- **Conditional display rules** engine (PHP + mirrored JS): logged-in, CRM contact / tag / list,
  URL parameter, plus client-side layer-seen / layer-completed / email-submitted; match all or any.
- **Timed content** — a content region below the player that swaps with the timeline
  (time-synced text, buttons, forms).

### Email capture & CRM
- **In-player opt-in gate** — pre-roll, at a timestamp, or on end; required or skippable;
  optional name field; per-viewer dedupe.
- Integration registry with pluggable providers: **GemCRM** (verified live) and **Mailchimp**
  built in, plus a generic `trueplayer/subscribe` seam.
- Server decides provider + lists from the video config (client input is never trusted).

### Analytics
- All collection **and** the dashboard are Pro (free installs write no rows).
- Summary cards: viewers, views, completions, completion rate, locked.
- **Audience retention curve**, **replay heatmap** (100-bucket, with drop-off and most-replayed
  callouts), completion **funnel**, views over time, device donut, new vs returning,
  engagement score, quiz performance.
- Viewers table with **per-viewer drill-down** (heatmap, quiz attempts, reset / unlock actions).

### Automation
- **HMAC-SHA256 signed webhooks** (`X-TruePlayer-Signature`) on every event, dispatched
  asynchronously via wp-cron.
- Site-wide endpoints + per-video endpoints, with a test-fire button.
- **Webhook delivery logs** addon — URL, event, status code, error and payload persisted
  (trimmed to 2000 rows) with an admin list view.

### LMS & education
- **Academy LMS sync** addon (two-way): access-gates playback to enrolled learners
  (`login_required` / `enrol_required` with a course CTA), and marks the mapped Academy lesson
  complete on watch-completion or quiz pass (idempotent).
- QuizPress bridge via `quizpress/api/after_quiz_attempt_finished`.
- Video → course/lesson mapping in the editor.

### Attestation & compliance
- **Completion attestation** addon — turns watch + quiz records into tamper-evident
  proof-of-completion (self-contained signed token, HMAC over `wp_salt`).
- Admin records table, CSV export, **public verify endpoint** (re-checks completion, so a
  revoked completion stops verifying), printable HTML certificate.
- Certificate branding: issuer, logo, signature, footer.
- Data-retention auto-purge UI (GDPR) — daily cron deletes progress + attempts older than N days.

### Instant pages
- **Standalone shareable video pages** at `/tp/{id}` — clean title + player + description,
  one toggle per video.

### White-label
- Rebrand the admin (`trueplayer/brand_name`) and remove "Powered by" attribution.

### Licensing
- StoreEngine WordPress SDK bundled in both plugins. Free = product 430 (insights only,
  wp.org owns updates). Pro = product 431 with automatic updates and the SDK's own
  Manage License submenu.

---

## Gaps found during the audit

1. **Playlists are marketed as Pro but ship unrestricted.** `Pro::FEATURES` lists `playlists`
   and the Pro readme sells them, but nothing in `includes/playlist.php`,
   `includes/api/playlists-controller.php` or the admin `Playlists` screen checks
   `Pro::active()`. Either gate them or move them into the free column.

2. **The licence check is a no-op.** After the "config only" SDK refactor, nothing hooks
   `trueplayer/license_valid`, so `Pro::license_valid()` always returns `true` —
   **Pro is active the moment the Pro plugin is present, licensed or not.** Wire
   `TruePlayerPro\StoreLicense` back into that filter before release.

3. **Per-feature gating is uniform.** `Pro::can()` ignores its `$feature` argument and
   `feature_flags()` returns one blanket verdict — fine for a single Pro tier, but it blocks any
   future tiering (e.g. an entry Pro without analytics).

4. **Deferred admin UI** (backends done, REST ready, no screen yet): attestation records
   table/export in the Analytics screen, and the Mailchimp API key / white-label brand fields
   in Settings.
