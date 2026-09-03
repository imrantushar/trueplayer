=== TruePlayer ===
Contributors: kodezen
Tags: video, player, lms, quiz, webhooks, watch tracking
Requires at least: 6.4
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Watch-verified, quiz-gated video & audio player for WordPress. Knows whether a viewer actually watched, locks the video on quiz failure, and fires webhooks for automation.

== Description ==

TruePlayer is a native WordPress video/audio player built for enforcement and automation, not just playback:

* **Watch verification** — server-side coverage tracking proves a viewer actually watched (not just pressed play or skipped to the end), with anti-skip.
* **Quiz gating** — attach built-in checkpoint and end-gate questions to a video; failing locks the video until the viewer re-watches and re-attempts.
* **Webhooks** — signed JSON payloads fire on key events (completed, quiz passed/failed, locked, milestones) for Zapier / automation tools.

Pro adds a reporting dashboard, exports, webhook delivery logs, premium sources (Mux, BunnyCDN), and Gem-ecosystem bridges.

== Changelog ==

= 1.2.0 - 03-09-2026 =
* Added - Direct Bunny.net Storage uploads from the editor with drag & drop, picker, progress bar, and cancel support.
* Added - Bunny.net Storage file browser to reuse existing uploads.
* Added - Bunny.net Storage credentials under Settings → Sources & CDN.
* Added - 4 MB chunked uploads for large files.
* Added - Post-upload URL verification with playback error details.
* Added - Collapsible Bunny.net settings sections with status badges.
* Added - Bunny.net Storage as a source in the Create Media dialog.

* Fixed - Bunny.net Storage Private mode not applying token protection.
* Fixed - Bunny.net token signing for single files and HLS directories.
* Fixed - Single-file tokens potentially unlocking an entire folder.
* Fixed - The standalone video page to provide a clean, shareable URL.

= 1.0.0 - 27/08/2026 =
First stable release. TruePlayer ships as a native WordPress video & audio player built for enforcement and automation.

**Player**
* Native React player with multiple skins (default, modern, simple, minimal, standard).
* Sources: self-hosted / direct URL, HLS, audio, YouTube and Vimeo.
* Full customization: control toggles, autoplay/loop/save-position/sticky-float, preload & load strategy (facade/eager/on-visible), accent color, play-button style, roundness, control-bar style, aspect ratio, caption size/color/background, playback speeds, Picture-in-Picture.
* Optional bundled H5P interactive engine (import + render H5P content, xAPI fed into the event pipeline).

**Watch verification**
* Server-authoritative coverage tracking proves a viewer genuinely watched (whole-second progress only), with anti-skip / seek-jump and playback-rate guards.

**Quiz gating**
* Checkpoint and end-gate questions attached to a video; server-side grading (answers never sent to the client). Failing locks the video and resets coverage until the viewer re-watches and re-attempts. (Enforcement activates with TruePlayer Pro.)

**Events & webhooks**
* Event bus: view.started, progress.milestone, view.completed, checkpoint.passed/failed, quiz.passed/failed, video.locked/unlocked, subscriber.added.
* HMAC-SHA256 signed JSON webhooks (X-TruePlayer-Signature header) for automation tools.

**Admin**
* React single-page admin: Dashboard, Media library, Editor, Playlists, Presets, Settings (and Interactive when the H5P engine is present).
* WP-CLI `trueplayer` command; REST API across videos, progress, grading, playlists, presets, subtitles, viewers and webhooks.

Premium sources (Bunny, Bunny Storage, Mux, signed/private streaming), premium skins (floating, ambient), playlists, interactive layers, analytics, LMS progression and white-label are unlocked by TruePlayer Pro.
