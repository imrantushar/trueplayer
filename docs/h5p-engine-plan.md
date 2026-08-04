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

- [ ] **Phase 2 — content REST + storage.** CRUD for H5P items: create/save
  `content.json` + `h5p.json`, per-item library dependency resolution, `.h5p`
  import/export.

- [ ] **Phase 3 — builder UI (generic semantics renderer).** Read a content
  type's `semantics.json`; map field types (text/html/number/boolean/select/
  group/list/library/image/video/file) to TruePlayer's `Field`/`Input`/
  `Select`/`Toggle`/`Card`/`MediaPicker`. Covers the field-only content types
  end-to-end (Multiple Choice, True/False, Fill in the Blanks, Flashcards,
  Summary, Accordion, Single-choice set).

- [ ] **Phase 4 — spatial content types.** Custom authoring widgets (or an
  H5P-editor iframe fallback) for Interactive Video, Drag & Drop, Course
  Presentation, Branching Scenario.

- [ ] **Phase 5 — shared services bridge.** Normalise H5P xAPI statements into
  the existing events pipeline so analytics, webhooks, CRM rules, and Academy
  LMS completion work identically across both engines.

## Open decision (blocks Phase 1)

**How to source H5P's server-side + JS runtime.** See conversation — bundle the
official H5P PHP + JS core (proven, heavier) vs. a minimal custom loader
(lighter, we reimplement library/dependency resolution). The routing layer is
built to hide this choice from everything downstream.
