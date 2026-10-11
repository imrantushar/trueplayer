# wp.org trialware migration (TruePlayer)

Review: Guideline 5. The next finding of this kind means permanent rejection, so free must not ship ANY
code that only works with Pro, and must not lock, strip or hide a feature it ships.

Approach (same as GemBooking): Pro gets its own webpack build. Free exposes a `window.trueplayer.*`
extension API (registries + slots + shared libs). Pro features move out of free, PHP and JS.

## Done
- H5P Interactive addon moved to trueplayer-pro/addons/interactive (also clears the arbitrary-JS,
  disk-write, $_FILES/$_SERVER and h5p.org URL findings).
- Custom CSS feature removed (arbitrary CSS insertion).
- Inline JSON config <script> blocks -> escaped data-tp-config attributes; admin <style> echoes ->
  wp_add_inline_style; JSON-LD via wp_print_inline_script_tag.
- videos/{id}/quick permission now checks edit_post.
- StoreEngine SDK 1.6.2. readme: H5P removed, "Source code & build" section.

## To move to Pro (every `Pro::active()` / feature_flags / isPro / UpsellPanel use in free)
PHP: stream-controller + private-video (protection), gate-controller, grade-controller,
progress-controller + progress-service (tracking), grading-service, analytics-controller/service,
retention, rules-controller/service (layer_rules), quizpress-controller, lms-controller,
subtitles-controller (YT import), webhook/* + webhooks-controller, integrations-controller + non-free
providers (gem-crm, mailchimp), instant-page, white-label, Helper::enforce_pro_limits,
Pro::PREMIUM_* lists (skins floating/ambient, audio podcast/audiobook, seek bar rapid-engage,
premium sources), playlists, presets.
JS admin: Analytics, GatingTab, LayersTab, OverlaysTab?, TimedContentTab, SubscribeTab, Playlists,
Presets, Settings sub-tabs (webhooks, integrations, white-label, license), UpsellPanel, H5pEditor,
h5p/, InteractiveTeaser, Bunny/Gumlet fields, pro.js.
JS player: Quiz, QuizpressQuiz, CoverageTracker/coverage.js, gating branches in Player.jsx,
Layers (rules), TimedContent, rapid-engage.js, ambient/floating CSS, dynamic watermark, Playlist.jsx.

## Phases
0. Seams: free `window.trueplayer` (registries: adminRoute, editorTab, settingsTab, sourceType,
   skin, playerPlugin; Slot), Pro webpack build with externals -> window.trueplayer.libs.
1. Server-only PHP moves (verifiable with wp eval).
2. Admin screens/tabs -> Pro bundle.
3. Player features -> Pro "player plugins" registered on window.trueplayer.player.
4. Delete Pro class gating, pro.js, UpsellPanel, feature_flags; readme rewrite; Plugin Check on zip;
   clean-WP test with Pro off/on.
