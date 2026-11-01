# Libra FB2 and Illustrations Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

**Goal:** Reliable FB2 formatting, original-colour illustrations and user-controlled EPUB typography on iPhone PWA.
**Architecture:** Extend existing parsers/readers, share an illustration viewer, normalize EPUB prose CSS without changing CFI text nodes. Keep FB2 flattened block text and legacy anchor compatibility.
**Tech Stack:** TypeScript, React, epub.js, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-31-fb2-illustrations.md

## Global Constraints
- Original colours and white illustration backing in every theme.
- Existing records, bookmarks, quotes and cloud persistence remain compatible.
- iPhone viewport and standalone PWA are primary targets.
- No new runtime dependencies; no physical iPhone claim.

## Review Focus
- Publisher inline !important font and colour rules; retain symbol/MathML/SVG fonts.
- Transparent/tall/landscape illustrations and captions; no clipped source text.
- Large media-heavy FB2 and missing or corrupt images; finite loading.
- Legacy FB2 anchors after adding inline emphasis; saved quotes remain highlighted.
- Viewer gestures and modal focus must not turn a page or alter saved position.

### Task 1: FB2 formatting and backward-compatible anchors
Files: src/fb2.ts, src/domain.ts, src/reader/FB2Reader.tsx, src/reader/BookBlock.tsx, src/anchors.ts, src/quoteHighlights.ts; tests in src/__tests__/fb2.test.ts and anchors.test.ts.
Interfaces: optional InlineRun[] and notes map added to parsed blocks; resolveFB2Point(block,anchor) restores both legacy flat offsets and new inline node offsets.
- [ ] Add failing tests for emphasis, nested footnotes, namespace hrefs and old offsets.
- [ ] Implement safe inline rendering and note dialog without changing flattened text/block order.
- [ ] Run targeted tests and full unit suite.

### Task 2: EPUB typography and illustration layout
Files: src/reader/epubAppearance.ts, epubLayout.ts, bookMedia.ts, src/styles.css; unit and browser regressions.
Interfaces: enforceEpubUniformSpacing retains CFI DOM; prepareBookMedia(doc) returns cleanup for image sizing and events.
- [ ] Reproduce publisher font rules and transparent image styling in tests.
- [ ] Apply user prose font/size/spacing via inherited CSS variables, override inline !important, preserve semantic emphasis and symbol fonts.
- [ ] Bound images to column viewport, preserve aspect ratio, await decode before visible FB2 measurement; verify both renderers.

### Task 3: shared image viewer and end-to-end verification
Files: src/components/IllustrationViewer.tsx, src/reader/EpubReader.tsx, FB2Reader.tsx, styles.css, e2e/illustrations-typography.spec.ts.
Interfaces: IllustrationViewer({image:{src,alt},onClose}); book image clicks open the viewer while navigation is suspended.
- [ ] Add tests for viewer zoom, focus, closing, source colours and position stability.
- [ ] Implement white full-screen viewer with fit/zoom and native pan/pinch; wire FB2 and iframe EPUB image clicks.
- [ ] Run npm test, npm run build and mobile Chromium/WebKit tests including existing position/quotes/media suites.
- [ ] Review final diff, commit and publish through the existing release path when verified.
