# DOM reader engine: architecture and acceptance

Status: review branch, not released to the production PWA. Physical iPhone acceptance remains required by the user's specification.

## Confirmed findings

The original reported measurement (19.5 px free space, 23 px line advance) does not admit another full row. The previous large blank area on the user's other physical pages has not been reproduced on that device in this environment; there is no claim that its specific cause was established.

A separate, reproducible source defect was confirmed in the old engine: pagination of repeated family/flag/combining graphemes cut a cluster at UTF-16 offset 108. The new regression rejects this. Canvas line planning also made independent final-DOM density verification difficult; the replacement no longer uses Canvas for line breaking.

Review of the new implementation exposed additional cases, now covered and fixed: empty-line/table blocks forced premature page breaks; zero-text BR siblings could disappear between source slices; image captions lost grouping; fractional DOM sizes could trigger endless repagination; clipping-ancestor recovery and cancellation of an open-book continuation needed guards. Giant-paragraph preparation now yields/cancels and break/boundary lookups use indexes rather than repeated prefix scans.

## Modules

| Module | Responsibility |
| --- | --- |
| `document-model.js` | Immutable source blocks, stable block IDs, chapter IDs, global source offsets, grapheme indexes and legacy anchor normalization. |
| `viewport-manager.js` | Live normalized DOM size snapshots and recovery from clipping ancestors. Physical display size never supplies extra reading pixels. |
| `typography.js` | Shared production font/style application and font-environment fingerprint. |
| `text-layout-engine.js` | Browser-native DOM probes with production typography; font/image readiness and line/glyph geometry. |
| `dom-pagination.js` | Grapheme-safe fitting, maximal legal continuation probes, explicit semantic break reasons, bounded work slices and validated prefix snapshots. |
| `page-renderer.js` | Materializes source ranges while retaining inline formatting and zero-text markup. It does not decide page boundaries. |
| `pagination-geometry.js` | Independent Range/replaced-element checks against the page, viewport and intermediate clipping layers. Empty trailing padding is distinguished from glyph overflow. |
| `page-integrity.js` | Validates rendered text and metadata against source ranges; validates complete books or individual contiguous prefix pages. |
| `pagination-cache.js` | Device-local source/engine/typography/viewport/font fingerprint, cancellation-safe persistence and three recent layout variants. |

Pages carry `fragments: [{block, from, to, hyphen?, reserveHeight?}]`. Existing `html`, `start` and `end` fields remain compatible with the surrounding application. Display HTML is regenerated from the source model; cached HTML never becomes the source of truth. Hyphen markers have no textContent and do not alter original offsets.

The renderer uses the same DOM boundary for both ends of adjacent slices. A zero-text sibling between characters, such as BR, belongs to the preceding slice. It is not silently removed to improve density.

## Layout rules

- Ordinary paragraphs can split on every available row; there is no ordinary widow/orphan reservation.
- Word/hyphen opportunities are preferred. If moving an oversized word would discard a complete usable row, it may continue at a whole-grapheme boundary.
- Every capacity break probes the next legal continuation in final DOM. A successful probe extends the page.
- Chapter headings start a page. Subheadings stay with at least the first word of the following text where feasible.
- Tables are indivisible but can share a page with prose. Oversized tables fail visibly instead of being clipped.
- Empty-line blocks stay in normal document flow.
- An image uses an illustration page under the existing CSS; a short recognized caption is measured and reserved on the same page. A long caption follows normal flow if pairing cannot fit.
- Poetry/preformatted text keeps explicit whitespace and breaks. A structural break can consume space; it is preserved rather than erased.
- Each page records a semantic/capacity/end reason and measured geometry. Final pages can legitimately have large remaining space.

The lower toolbar remains a fixed overlay and never participates in pagination size. The existing upper iOS blur clearance and lower device insets are preserved, pending physical-device acceptance. No larger physical-screen height is inferred.

## Incremental display, cancellation and recovery

The engine yields around a 12 ms work budget. Grapheme and legal-break preparation also yields, including giant individual paragraphs. Only validated contiguous prefixes are published. The initial view waits until its exact restored source anchor is covered. Later snapshots append pages without changing the already rendered fragments or current source anchor. A `+` beside the temporary page count indicates unfinished preparation.

Settings, font and viewport changes abort the previous generation. Late results cannot install pages or become a completed cached layout. Closing/switching a book also cancels work and prevents its old opening continuation from attaching a new observer. Neighboring pages are hydrated near the current page.

Initial verification waits for the reader entrance animation and untransformed PageFlip render frames. Real geometry failures trigger one cache invalidation/reflow using measured available bounds; failure after the retry leaves an actionable error and the original file intact. No DOM truncation repairs content.

## Compatibility and rollback

- IndexedDB version, original book records, Supabase schema, authentication and cloud transport are unchanged.
- `block`/UTF-16 `offset` anchors, marks and annotations remain compatible. A corrupt old anchor inside a grapheme snaps to the preceding whole boundary at read time; valid anchors stay exact.
- Pagination cache is disposable and versioned separately from books and positions. Regeneration never deletes a book or a cloud record.
- `?engine=legacy` selects the retained previous engine locally with a separate cache key. This is an explicit diagnostic rollback, not an automatic fallback after an integrity failure. Its old grapheme limitations remain; first offline use also requires its lazy module to have been cached earlier.
- The baseline already used instantaneous page turns (`pageTurnMotion()` returns zero duration). This change retains that setting and the PageFlip integration; it does not claim to restore an animated curl.

## Reproducible checks

```
npm test
npm run check
npm run build:pages
node tests/engine.browser.mjs
```

The final command needs Playwright with Chromium and WebKit installed. The dedicated `Reader engine acceptance` workflow runs both browsers, writes JSON reports/screenshots and has no deployment step. Browser fixtures use disposable books on a local origin and block cloud connections.

Local Node suite: 182 tests passed. Type checks and production Pages build passed. Browser checks on the cloud Chromium confirmed:

- every source character across actual rendered pages;
- unchanged panels and exact position after font edits/reload;
- viewport shrink and six portrait/landscape sizes without clipped glyphs;
- large typography and queued search navigation during reflow;
- 18 engine typography variants, 111 pages, independent next-row probes;
- a wider 44-scenario import/geometry matrix;
- BR ownership, normal flow of empty lines/tables, image-caption pairing;
- cancellation of a single 1,376,000-character paragraph before any page was published (198 ms in this environment).

The first review-branch CI run passed Chromium/WebKit on commit `29cb2f5`. Final review-fix CI and the last close-during-streaming scenario must be recorded before release; a passing older commit does not validate later changes.

## Performance comparison

Same browser/CSS, 393 × 808 reading area, three runs. Milliseconds are environment measurements, not iPhone promises.

| Source | Engine | Median total | Median first usable prefix | Pages |
| --- | --- | ---: | ---: | ---: |
| 6,302 characters / 12 paragraphs | Previous | 220 ms | 220 ms | 6 |
| Same source | DOM | 204 ms | 125 ms | 6 |
| 63,130 characters / 120 paragraphs | Previous | 1,490 ms | 1,490 ms | 55 |
| Same source | DOM | 1,677 ms | 116 ms | 55 |

The longer sample's total work increased about 13%, while its first prefix became available much earlier. This sample does not demonstrate a universal increase in text per page: both engines produced the same page count. Final acceptance should compare opening, navigation and battery/latency on the target iPhone.

## Remaining acceptance gates

1. Final commit's Chromium/WebKit CI and complete streaming-close regression.
2. Installed PWA on a physical iPhone: first-line blur, last-line visibility, home indicator clearance, the user's formerly sparse pages, stable panels and source position after restart.
3. Actual two-device Supabase and offline restart checks with a disposable account/book. Contract/regression tests pass, but no live production-account round trip was performed here.

The existing production URL remains unchanged. The new engine is not claimed as fully accepted or published while these gates are outstanding.
