# H5P engine — build plan

One plugin, two rendering engines. TruePlayer keeps its native player untouched
and gains a second engine that renders H5P interactive content through H5P's own
runtime, while the **authoring UI** is rebuilt with TruePlayer's own component
kit so it looks and feels consistent with the rest of the admin.

## Design invariants

- **Native path is sacred.** The existing player, storage, and shortcode must
  behave byte-for-byte the same. The H5P engine stays dormant until its runtime
  is vendored (`H5P\Module::is_available()`), and even then only activates for
  items explicitly flagged `_trueplayer_engine = h5p`.
- **No runtime mixing.** Native content → native player. H5P content → H5P
  player. They never share storage or a player instance.
- **Shared shell above, shared services below.** Both editors mount in the same
  React/Tailwind admin and reuse the same UI primitives. Both players feed the
  same analytics / webhooks / CRM / LMS pipeline (H5P via xAPI normalisation).
- **We replace the editor front-end only** — not H5P's storage/validation or
  player. Rendering stays H5P's job.

## Routing primitive (this is what makes it "one plugin")

- `_trueplayer_engine` post meta on `tp_video`: `native` (default) | `h5p`.
- `H5P\Module::engine_of()` / `is_h5p()` resolve the engine, falling back to
  native whenever the runtime is missing.
- `Shortcode::render()` branches to `H5P\Renderer::render()` for H5P items.

## Phases

- [x] **Phase 0 — foundation (dormant router).**
  - `_trueplayer_engine` meta (queryable, default native).
  - `H5P\Module` (availability gate + engine resolution) + `H5P\Renderer` stub.
  - Frontend router branch in `Shortcode::render`, wired into bootstrap.
  - No behaviour change until the runtime lands.

- [x] **Phase 1 — runtime foundation.** *(complete, verified end-to-end)*
  - [x] Vendored the official H5P core + editor under `includes/h5p/runtime/`
        (`h5p-php-library` 2.2M, `h5p-editor-php-library` trimmed to 1.9M —
        CKEditor removed since our own UI replaces H5P's rich-text authoring).
        Both **GPL-3.0**; compatible with the plugin's "GPLv2 or later".
  - [x] **Framework glue** — `TruePlayer\H5P\Framework implements
        H5PFrameworkInterface` (all **59 methods**): the bridge between H5PCore
        and WordPress. Adapted from the reference plugin with `tp_h5p_` tables,
        `trueplayer_h5p_` options, WP-standard caps, and the H5P-plugin/hub
        coupling removed. Load-verified against the real interface (0 missing).
  - [x] **File storage** — reuse `H5PDefaultStorage` rooted at
        `uploads/trueplayer-h5p/` via the `H5P\Core` factory.
  - [x] **Schema** — 11 `tp_h5p_*` tables via the dbDelta installer
        (`create-h5ptables.php`), `TRUEPLAYER_DB_VERSION` bumped to 4.
  - [x] **Importer** — `H5P\Importer`: validate/store a `.h5p` (H5PValidator +
        H5PStorage) and one-click install from the official content-type hub
        API. Verified: installed H5P.Accordion (+ FontAwesome + AdvancedText
        deps) with sample content.
  - [x] **Frontend enqueue + Renderer** — `H5P\Assets` builds `H5PIntegration`
        and enqueues core + aggregated library assets (styles flushed in the
        footer since a shortcode renders after wp_head); `H5P\Renderer` emits
        the `.h5p-content` mount. Verified on the live frontend: all 9 styles +
        11 scripts serve HTTP 200, params embedded, dependency cache populated.
  - Router (`_trueplayer_engine` + `_trueplayer_h5p_content_id` meta) delegates
    H5P videos to the runtime; native videos are byte-for-byte unchanged.

- [x] **Phase 2 — content REST + storage.** *(complete, verified)*
  `API\H5pController` (`trueplayer/v1/h5p/*`): list installed + featured content
  types, one-click install from the hub, fetch a library's semantics, and
  create/update/read content (saved via H5PCore, linked to a `tp_video` on the
  h5p engine). Verified with Accordion + MultiChoice.

- [x] **Phase 3 — builder UI (generic semantics renderer).** *(complete, verified)*
  `dev_trueplayer/admin/h5p/SemanticsForm.jsx` renders a content type's
  `semantics.json` with TruePlayer's own components (text/html/number/boolean/
  select/group/list/library/media, recursive). `screens/Interactive.jsx` (a new
  "Interactive" submenu) is the hub — content-type gallery + item list; opens
  `screens/H5pEditor.jsx` to author. Round-trips a full MultiChoice (nested
  groups, answers list, behaviour flags) end-to-end.

- [~] **Phase 4 — spatial content types.** *(functional via the generic
  renderer; visual canvas editors remain)* The `SemanticsForm` renders *any*
  content type's semantics recursively, so spatial types (Interactive Video,
  Drag & Drop, Course Presentation, Branching Scenario) are authorable as
  nested forms. Bespoke visual editors (timeline / drag canvas) — or an
  H5P-editor iframe fallback — are the remaining UX polish.

- [x] **Phase 5 — shared services bridge.** *(complete, verified)*
  `assets/h5p-xapi.js` listens to root-level H5P xAPI statements and posts to
  `h5p/xapi`, which normalises them into `Events::emit` (`view.completed`,
  `quiz.passed`/`quiz.failed`) — the same bus the native player feeds, so
  analytics / webhooks / CRM / Academy LMS work across both engines. Also
  records a `tp_h5p_results` row. Nonce-verified.

## Remaining loose ends

- Visual canvas editors for spatial types (Phase 4 polish).
- H5P content-state save/resume endpoints (`setFinished` / `contentUserData`)
  referenced in `H5PIntegration` — currently `postUserStatistics` is off.
- Uninstall cleanup for the `tp_h5p_*` tables + `uploads/trueplayer-h5p/`.
- Multi-item pages: the xAPI localize is per-last-content (fine for one H5P item
  per page; refine for several).

## Open decision (blocks Phase 1)

**How to source H5P's server-side + JS runtime.** See conversation — bundle the
official H5P PHP + JS core (proven, heavier) vs. a minimal custom loader
(lighter, we reimplement library/dependency resolution). The routing layer is
built to hide this choice from everything downstream.
