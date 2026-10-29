# kniga-reader 2.0 — implementation plan

**Reference:** user Technical Specification v2.0 (2026-10-29). Implement incrementally on the existing repository. Keep current GitHub Pages production and Supabase/IndexedDB schemas stable until each subsystem is proven safe.

## Working architecture and boundaries

- `reader/src/importer.js`: format decoding and defensive extraction, preserving original bytes.
- `reader/src/document-model.js`: immutable normalized source, stable block and offset identity, source ordering.
- `reader/src/dom-pagination.js`, `text-layout-engine.js`, `page-renderer.js`, `page-integrity.js`: geometry-driven page boundaries and validated text.
- `reader/src/pagination-cache.js`: disposable cached representation, never the source of truth.
- `reader/src/viewport-manager.js`, `reader-window.js`: a single fixed page geometry that controls never change.
- `reader/src/main.js`: existing UI coordinator to split by product scenario only after regression coverage is established.
- `reader/src/style.css`: existing styles to consolidate by subsystem, not append new global overrides.
- `reader/src/cloud.js`, `sync-model.js`, `shelf-state.js`, `supabase-transport.js`: cloud lifecycle and user intent.
- `reader/public/manifest.webmanifest`, `reader/index.html`, `reader/public/sw.js`: PWA and Apple safe areas.
- `tests/`, `.github/workflows/`: all acceptance checks before release.

## Phase A — Re-establish a trustworthy gate (in PR #12)

1. Confirm the failing `main` GitHub Actions job and identify exact mismatch (obsolete arrow assertions).
2. Add failing unit tests for corrupted in-memory cache and incomplete fresh-page output.
3. Validate both at cache ingress before writing or reuse. Preserve disk cache compatibility.
4. Update browser tests for arrow-free tap/swipe navigation, actual iOS overlay and translucent status bar.
5. In WebKit fixture, cycle all four themes and compare the root, body, reader and visible page color, asserting source markup and position unchanged.
6. Expand pull-request CI to include the same installed-PWA tests used by release.
7. Pass all Node tests, static checks, Pages build, Chromium and WebKit integration on the final commit.

## Phase B — Preserve content across formats

1. Define versioned document-block contracts that preserve text, inline marks, tables, images, notes, source offsets.
2. Expand test corpus with long words, grapheme clusters, malformed markup, tables larger than viewport, captions, mixed EPUB formatting.
3. For content that cannot be paginated without clipping, provide an explicit accessible scroll/dedicated-view fallback. Never use `overflow:hidden` as a corrective strategy.
4. Build an isolated PDF renderer with PDF-specific reading progress, navigation and offline state; verify a representative real PDF corpus.
5. Keep document identity and legacy UTF-16 anchors stable; implement migration only where absolutely necessary.

## Phase C — Canonical visual system

1. Introduce one design-token owner for paper/white/night/OLED and component surface roles.
2. Move repeated `.reader` safe-area/toolbar declarations out of the historical cascade; delete superseded styles after visual regressions.
3. Keep the viewport independent of toolbar visibility; preserve the source anchor on theme/typography changes.
4. Produce approved compact/standard/large iPhone and iPad snapshots for library, reading, controls, sheet, failure and offline states.
5. Check focus, large text, reduced motion and 16px input controls without disabling OS zoom.

## Phase D — Reading interaction and performance

1. Preserve page-tap and swipe navigation; remove all permanent prev/next buttons and dead UI.
2. Add an opt-in animated curl only after integration tests prove no clipping, jump, double-advance or input latency regressions.
3. Measure first page time, prepared turn latency and memory on real iPhone books; profile `requestAnimationFrame` and font readiness.
4. Keep incremental rendering cancel-safe and release unused page nodes.
5. Test suspend/restart, orientation changes, long sessions and cache invalidation on all supported themes.

## Phase E — Cloud lifecycle and deletion

1. Define server-owned, per-user book deletion tombstones with monotonic revision/observed timestamps, replay protection and an explicit re-import restore action.
2. Add an additive Supabase schema migration with restrictive per-user RLS and documented rollback; do not drop/overwrite existing data.
3. Test offline delete, interrupted upload, stale second device, concurrent re-import, user switching, and partial book failures.
4. Merge reading progress by intent and revision rather than allowing a stale device to silently override newer progress.
5. Verify end-to-end using a disposable account on two actual clients before release.

## Phase F — Library and settings

1. Separate compact library UI, book details, search, sorting and generated cover templates into reusable components with shared tokens.
2. Group settings into appearance, typography, geometry, navigation, sync and application preferences; ensure live preview doesn't change source position.
3. Verify library pagination, empty states, import errors, deletion and cloud reconnect.

## Phase G — Release and acceptance

1. Gate main deployment on all critical tests; automate real screenshot diffs only after baselines are approved.
2. Run benchmark corpus and compare to v2.0 targets on at least one physical iPhone.
3. Validate installed Home Screen PWA with all four themes, safe-area/clock contrast and reinstallation, explicitly recording OS limitations.
4. Validate source reconstruction and glyph-fit properties across FB2/ZIP/EPUB/PDF test fixtures.
5. Complete manual two-device Supabase synchronization and deletion checks.
6. Merge and publish only when critical acceptance checks are green, preserving rollback to the previous GitHub Pages build.

## Completion definition

PR #12 is **only Phase A**. Passing its CI does not certify the redesigned reader, PDF support, cloud-deletion semantics, physical iOS status-bar behavior or the final performance targets. Track each subsystem separately to avoid changing the book engine, cloud schema and visual design in one unreviewable merge.