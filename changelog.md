# Changelog

## 1.8.0 - 2026-10-29

### Added

- TruePlayer block rebuilt with a saved-video picker, native embed support, block transforms and more style controls.

### Fixed

- Translation issues in add-ons, WP-CLI and integrations.

### Security

- Hardened REST controllers, opt-in, import, meta handling and WP-CLI input and output (security audit fixes).
- Link URLs in the player config are sanitized, and the opt-in throttle can no longer be bypassed.

### Changed

- The Pro admin and player screens (gating, analytics, webhooks, layers, protection, premium sources and skins, interactive content, license) are back in this plugin and stay locked until TruePlayer Pro is active. Pro provides the functionality behind them.

## 1.7.4 - 2026-10-24

### Changed

- Removed the unused progress, quiz-attempts, engagement and daily tables from the free plugin; they are no longer created on activation, and uninstall cleanup was updated to match.

## 1.7.3 - 2026-10-17

### Security

- Colour settings (accent and other colour fields) are now strictly validated on save and at render time.

## 1.7.2 - 2026-10-14

### Security

- Public opt-in REST endpoint (`/wp-json/trueplayer/v1/optin`) now requires a `wp_rest` nonce, applies a per-IP+video rate limit, and includes a honeypot field to block form-walking bots.

### Changed

- Admin screens no longer remove queued `admin_notices` callbacks; a CSS-only suppression keeps the layout clean while leaving other plugins' notices in the DOM.
- Admin asset enqueue matches this plugin's own page hooks exactly instead of a substring on the plugin slug, so an unrelated screen whose hook contains "trueplayer" no longer loads the backend bundle.
- YouTube caption importer sends an honest `TruePlayer/<version>; <site_url>` User-Agent.
- Readme tags no longer use third-party brand names.

### Added

- `uninstall.php` drops this plugin's custom tables, options, transients and generated poster attachments when the site owner deletes the plugin. Honours a `trueplayer_keep_data_on_uninstall` option, and runs per-site on multisite.

## 1.7.1 - 2026-10-14

### Fixed

- Activation schema no longer uses `JSON` columns or `DATETIME DEFAULT CURRENT_TIMESTAMP`, so tables create cleanly on MySQL versions WordPress still supports.
- Schema sync now verifies every expected table exists before recording the database version, so a silent `dbDelta` failure can no longer mark the install as upgraded.
- Seed data and preset-preview samples no longer reference remote demo files; sources start empty and the author picks their own media.

### Security

- The video-preview REST route now requires edit rights on the specific video, not just a generic edit-posts capability.

### Changed

- Vimeo poster transient is now namespaced as `trueplayer_vimeo_poster_` to avoid colliding with other plugins' short prefixes.

## 1.7.0 - 2026-10-11

### Changed

- Everything in the free plugin now works on its own, with no locked options. Features that belong to TruePlayer Pro now ship only in that add-on.
- HLS streams, Google Analytics events and YouTube caption import are free.
- Player settings are passed to the page as data attributes instead of inline script tags; admin styles load through the WordPress style queue.
- Updated the StoreEngine SDK to 1.6.2.

### Removed

- Interactive (H5P) content moved to TruePlayer Pro.
- Custom CSS fields — use the Customizer or Site Editor's Additional CSS instead.

### Security

- Quick-editing a video from the block editor now also checks you can edit that video.

### Added

- Readme documents where the source for the compiled scripts lives and how to rebuild it.

## 1.6.1 - 2026-10-10

### Security

- Harden inline player config against breakout — JSON blobs rendered beside the player, popup and playlist now escape `</script>` sequences.

### Changed

- Plugin URI updated to https://true-player.net/.
- Rename post types and taxonomy to plugin-prefixed slugs (`truepl_video`, `truepl_preset`, `truepl_video_tag`, `truepl_playlist`) to avoid collisions. Existing content is migrated automatically on first admin load.
- Admin-area white-labeling no longer touches player attribution (the player carries none to suppress).

### Added

- Readme now documents every external service the plugin can contact, with Terms and Privacy links.

## 1.6.0 - 2026-09-24

### Added

- Quality selector: Auto plus every available level, in the gear menu or as a one-tap button. Bunny Stream, Mux, Gumlet ABR, HLS, YouTube and Vimeo.
- The viewer's quality choice is remembered across videos.
- Rapid Engage Bar: a simulated seek bar that runs ahead early so a video feels shorter. Needs Pro.
- Seek bar is now its own section in the player editor.
- Waveform is selectable as a video seek bar style, not only for audio.
- Separate Rapid Engage speeds for desktop and mobile.

### Fixed

- The volume slider's indicator sat above its track instead of on it.
- Firefox drew the volume fill thicker than the track it was filling.
- The volume slider could be squashed by a host theme's input styles.

## 1.5.0 - 2026-09-14

### Added

- Two more audio starting points: Audiobook and Playlist.
- Podcast and Audiobook are now audio bars of their own, not just switched-on controls. Need Pro.
- Video and Audio filters in the media library.
- The create dialog names the look a new item will use.
- "Start from a template" in the preset builder — a whole look in one click.
- The site-wide default look is now set separately for video and audio.
- A short description on every template tile, on hover or keyboard focus.

### Fixed

- A site-wide video template pushed its skin and aspect ratio onto audio items.
- Choosing a template added to the saved look instead of replacing it.
- A site-wide default preset never showed in the editor preview.
- Saving Settings did not refresh the audio defaults until the page was reloaded.
- A default preset overrode the template tiles with nothing on screen to say so.
- Template tiles showed a PRO badge even with TruePlayer Pro active.
- Audio items offered "Generate from video" for cover art, which could only fail.
- The unsaved-changes dialog opened at full width for a single sentence.
- The Minimal audio bar and the Simple video skin looked alike in the picker.

### Security

- Videos inside a playlist skipped the free-plan clamp, leaking premium source URLs into the page.
- A video title containing markup could break out of the SEO data block and run script.
- Hardened the importer, an interactive-engine query, and imported caption parsing.

### Changed

- Template tiles redesigned: light preview, and a brand-blue tick on the chosen one.
- The audio bar's shape is now called "Skin", the same as video.
- Free starting points sit above the Pro ones, which are grouped and labelled.
- The default audio look is Minimal, so a fresh install starts on something it can use.
- The default aspect ratio setting now says it never reaches an audio item.

## 1.4.0 - 2026-09-10

### Added

- Audio as its own media type — Video / Audio tabs when creating media.
- Three audio layouts: compact bar, card, and minimal.
- Audio presets, separate from video ones, with Podcast, Album and Bare starting points.
- Audio control toggles: previous / next track, playback speed, chapters & transcript.
- Previous / next track buttons in playlists.
- Automatic audio detection from the file extension, so imported and pasted audio needs no re-saving.
- Site-wide default presets for video and audio, under Settings → General.
- A "When attempts run out" policy — lock and require a re-watch, or never lock. Overridable per video.
- Audio wording and icons in Bunny.net Storage and Gumlet uploads.

### Fixed

- Re-watching after using every quiz attempt gave only one attempt instead of a fresh set.
- A checkpoint before the completion threshold could lock a re-watching viewer out for good.
- Audio items previewed as a video player in the editor.
- The minimal audio layout rendered as an empty white box on light backgrounds.
- Audio was published to search engines as video.
- The audio preset's "Preview with" row did not line up with the preview below it.
- Fields took their border from WordPress instead of the plugin.

### Changed

- Player controls are defined in one place, so the editor and player can't drift apart.
- The editor hides settings that cannot apply to audio.
- The Interactive tab is always shown, with a teaser when the addon is off.
- All dialogs open at the same width.

## 1.3.0 - 2026-09-06

### Added

- Gumlet as a video source — upload a file from the editor, or use one already in your Gumlet workspace. Needs Pro.
- Uploads go straight from the browser to Gumlet, with drag & drop, progress and cancel. PHP's upload size limit no longer applies, and your API key never leaves the server.
- Gumlet settings under Settings → Sources & CDN, with your workspaces offered as a list.
- Signed, expiring links for Gumlet videos marked private.
- A video saved while Gumlet is still encoding starts playing on its own when encoding finishes.

### Fixed

- Premium sources leaked their real media URL into the page on free installs. The location is now stripped on the server.
- Bunny.net Storage videos could not be marked private, played on free installs despite being premium, and showed a raw "bunnyStorage" badge.
- HLS video failed to play in Chrome — the player trusted Chrome's claim that it supports HLS and skipped hls.js.
- Playback failures said only "Playback error". They now name the cause.

### Changed

- Video source types are defined in one place, so the editor, library and Pro gate can no longer drift apart.
- Updated the bundled StoreEngine licensing SDK to 1.5.6.
- Dependencies are now managed with Composer.

## 1.2.0 - 2026-09-03

### Added

- Added Direct Bunny.net Storage uploads from the editor with drag & drop, picker, progress bar, and cancel support.
- Added Bunny.net Storage file browser to reuse existing uploads.
- Added Bunny.net Storage credentials under Settings → Sources & CDN.
- Added 4 MB chunked uploads for large files.
- Added post-upload URL verification with playback error details.
- Added collapsible Bunny.net settings sections with status badges.
- Added Bunny.net Storage as a source in the Create Media dialog.
- Added QuizPress quiz as an alternative question source for checkpoints and the final quiz.
- Added inline QuizPress quiz-taking UI, question-by-question, using QuizPress's own answer widgets and grading.
- Added real pass/fail and score read from QuizPress's own attempt data.
- Added a no-penalty "awaiting manual review" outcome for QuizPress quizzes with manually-reviewed questions.
- Added QuizPress passing grade, attempt limit, and manual-review warnings shown in the Gating tab.
- Added live-preview grading for QuizPress-sourced quizzes.
- Added "Try again" after a failed QuizPress-sourced checkpoint.
- Added drag-and-drop reordering and a collapsible accordion for checkpoint and question lists.
- Added URL-based editor tabs, so a reload keeps your place.
- Added a "What's New" panel in the admin top bar.
- Added js translation.

### Fixed

- Fixed Bunny.net Storage Private mode not applying token protection.
- Fixed Bunny.net token signing for single files and HLS directories.
- Fixed single-file tokens potentially unlocking an entire folder.
- Fixed the standalone video page to provide a clean, shareable URL.
- Fixed the frontend volume slider stretching to fill the control bar on some themes.
- Fixed the settings/speed menu not closing on an outside click.
- Fixed arrow key volume/seek shortcuts also scrolling the page.

## 1.1.0 - 2026-09-01

### Added

- Email capture now works with no CRM connected: a built-in Email notification provider mails each capture to the site administrator.
- An Email form layer with two modes, gate (pauses the video) and inline (does not interrupt). The old Email capture section merged into it and is converted on upgrade.
- Conditional display rules on layers: logged in, CRM contact, tag or list, URL parameter, or having seen or completed another layer.
- A poster field and media file card in the Source step, so a file and its poster are managed together.
- Player preset templates in Settings, with presets resolved in the live preview.
- A trueplayer:layer-rendered DOM event, so code that initialises at page load can pick up layers added mid-playback.

### Improved

- Removing a video now also removes the poster that came from it, instead of leaving it in the media library.
- Video titles are reduced to plain single-line text and capped in length.
- The control bar now appears as soon as the media is ready, not only after playback starts.
- Layer timings are entered as hours, minutes and seconds instead of raw seconds, and layer rows read as timestamps.
- The editor's eye toggle now genuinely previews a layer, ignoring its time window and taking it down again afterwards.
- Settings the preview cannot demonstrate now say so, and "Reset to start when finished" is disabled while Loop is on.
- Shortcode layers show a placeholder in the editor preview instead of appearing empty, and their inline scripts now run.
- Self-hosted video workflow, audio player styling, H5P media options and admin submenu presentation.

### Fixed

- Saving a video, preset or playlist whose settings contained a double quote or a backslash wiped the whole configuration, source and layers included. Adding a shortcode layer was the easiest way to hit it.
- Aspect ratio "Auto (native)" rendered an invisible player.
- Caption background colour and background opacity had no effect during playback.
- Loop stopped the end of a video ever being reached, silently disabling the final quiz, end screen, end email gate, reset-on-end and playlist auto-advance.
- "Disable the timeline entirely" left the arrow keys and the rewind and fast-forward buttons still able to seek.
- "Start muted" was ignored on YouTube and Vimeo sources.
- The editor preview shared its saved playback position with the front end, so it could open part-way through a video.
- A caption track marked as default reported itself as off while it was being displayed.
- Playback failures gave no reason. A YouTube video that disallows embedding is now named as such.
- Discarding a preset or playlist edit left the discarded changes on screen.
- Video control, audio playback, source type and interactive email form issues reported during testing.

## 1.0.0 - 2026-08-27

First stable release. TruePlayer ships as a native WordPress video & audio player built for enforcement and automation.

### Added

- Native React player with multiple skins (default, modern, simple, minimal, standard).
- Sources: self-hosted / direct URL, HLS, audio, YouTube and Vimeo.
- Full customization: control toggles, autoplay/loop/save-position/sticky-float, preload & load strategy (facade/eager/on-visible), accent color, play-button style, roundness, control-bar style, aspect ratio, caption size/color/background, playback speeds, Picture-in-Picture.
- Optional bundled H5P interactive engine (import + render H5P content, xAPI fed into the event pipeline).
- Watch verification: server-authoritative coverage tracking proves a viewer genuinely watched (whole-second progress only), with anti-skip / seek-jump and playback-rate guards.
- Quiz gating: checkpoint and end-gate questions attached to a video, graded on the server (answers never sent to the client). Failing locks the video and resets coverage until the viewer re-watches and re-attempts. Enforcement activates with TruePlayer Pro.
- Events & webhooks: view.started, progress.milestone, view.completed, checkpoint.passed/failed, quiz.passed/failed, video.locked/unlocked and subscriber.added, delivered as HMAC-SHA256 signed JSON webhooks (X-TruePlayer-Signature header).
- React single-page admin: Dashboard, Media library, Editor, Playlists, Presets, Settings.
- WP-CLI `trueplayer` command, and a REST API across videos, progress, grading, playlists, presets, subtitles, viewers and webhooks.
