# Book layout implementation plan

> For agentic workers: use superpowers:executing-plans. Execute in this session and request independent QA after implementation.

Goal: better semantic import and page composition without altering saved reading preferences or anchors.
Architecture: bounded source presentation metadata, compatible local upgrade, source-preserving DOM typography, measured page composition.
Tech stack: current vanilla JS, DOM Range, fflate, Vite, Node tests, Playwright Chromium.
Spec: docs/superpowers/specs/2026-10-25-book-layout-design.md

## Global constraints
- Preserve stored preference values and timestamps; no source-text or block-order migration.
- No external styles/fonts/resources; source CSS never executes.
- Existing sync/selection/control fixes remain in place.
- Three sequential QA cycles after all changes, with fixes and reruns.

## Review focus
- Nested/repeated EPUB semantic containers must not lose or duplicate text.
- Source CSS must not override user font size, theme or spacing.
- Existing block anchors/notes must survive upgrade and failed storage.
- Very large fonts/narrow viewports must not lose text or loop.
- Typography spans must retain selection offsets and cached pages must invalidate.

## Task 1: semantic import
- [ ] Add failing FB2/EPUB tests for roles and safe local CSS, including nested containers and malicious styles.
- [ ] Implement reader/src/book-presentation.js and importer.js metadata/inline mappings without changing block order/text.
- [ ] Run importer and complete unit suites.

## Task 2: compatible upgrade
- [ ] Add tests exercising original reimport, exact anchor compatibility, preserved settings/progress/notes and fallback on changed text/storage failure.
- [ ] Implement reader/src/book-upgrade.js; invoke on opening a stored book; update pagination signature version and metadata hashing.
- [ ] Run unit suites.

## Task 3: measured page composition
- [ ] Add browser failures for subheading orphan, one-line paragraph split, image/caption separation, Russian word groups and exact text preservation.
- [ ] Implement source-preserving typography and semantic block classes; keep-with-next and measured widow/orphan rules; short captions with images.
- [ ] Run browser tests across small and large typography; existing mobile selection/sync/menu test; build/check/unit suite.

## Task 4: three QA cycles and deployment
- [ ] Cycle 1: independent data/settings/source compatibility tester, fix issues and rerun.
- [ ] Cycle 2: independent mobile layout/interaction tester, fix issues and rerun.
- [ ] Cycle 3: independent final reviewer, full regression/build/check, publish via reviewed PR and confirm deployed assets.
