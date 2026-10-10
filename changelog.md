# Changelog

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
