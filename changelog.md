# Changelog

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
