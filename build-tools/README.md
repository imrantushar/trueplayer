# Cross-platform release build

One command produces a shippable TruePlayer zip on **Linux, macOS, and Windows**
via a Node orchestrator (no bash / make / `wp dist-archive`).

```bash
npm i -D archiver ignore   # one-time (already committed)
npm run dist               # full release: JS build → POT → zip

npm run dist:zip           # only repackage the current tree (~1s)
node build-tools/build.mjs --only=js|pot|zip
```

The release zip is written to the **parent plugins folder**
(`../trueplayer.<version>.zip`) and overwrites any existing same-name file.

## Pipeline

| # | Step | How |
|---|------|-----|
| 1 | Production JS | `wp-scripts build` (install auto-skips when `node_modules` exists) |
| 2 | Composer | **skipped** — TruePlayer has no PHP dependencies (`steps.composer:false`) |
| 3 | POT | `wp i18n make-pot` → `languages/trueplayer.pot` |
| 4 | Zip | built in Node from `.distignore` — needs no system `zip` |

Version comes from `package.json` (same field `webpack.config.js` reads, which
must match `trueplayer.php`'s `TRUEPLAYER_VERSION`).
