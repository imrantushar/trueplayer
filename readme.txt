=== TruePlayer ===
Contributors: kodezen
Tags: video, player, lms, quiz, webhooks, watch tracking
Requires at least: 6.4
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 0.1.0
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

= 0.1.0 =
* Initial scaffold.
