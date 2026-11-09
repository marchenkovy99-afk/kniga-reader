# Book text search implementation plan

**Goal:** Add the approved search reference to the existing production reader, preserving its themes, typography, gestures and stored books.

**Architecture:** Keep the recovered production application. Expose narrowly scoped reader navigation adapters from its existing preview bridges. Implement indexing and UI as separate modules using existing CSS variables. Search stays on device and works offline.

**Spec:** Approved two-screen reference in the conversation: full-book word/phrase/sentence search, contextual snippets, chapter labels, highlights, next/previous navigation and return to starting position. User approved implementation on 9 November 2026.

## Constraints
- Existing production bundle and styles match the live deployment before editing.
- Use current themes, control fonts, book fonts, safe areas and touch targets.
- No storage schema changes or remote search requests.
- Search is case-insensitive, folds ё/е and whitespace; literal punctuation, no regex interpretation.
- Cancel outdated work and dispose resources on leaving the book.

## Tasks
1. Write and run failing search-core tests: normalization with original offsets, inline and paragraph boundaries, repeated matches, punctuation, empty query and cancellation. Implement `book-search-core.js` and verify.
2. Write browser tests for actual FB2 and EPUB imports, search, exact navigation, highlighting, return, theme consistency, empty results, narrow screens and offline. Observe failure before adding UI.
3. Implement `book-search.js`, `book-search.css` and scoped adapters in the preserved bundle. Keep saved reading positions and page geometry under the existing readers' control.
4. Update offline manifest hashes and release metadata. Run unit/regression/browser checks and production asset verification. Review the change and publish to the existing Vercel project; verify live assets.

## Review focus
- Inline formatting and phrase breaks must not shift offsets.
- EPUB section indexing must not unload a live section or insert untrusted HTML.
- Search panel and navigation must not intercept reading gestures outside their controls.
- Returning must restore the original FB2 page or EPUB CFI.
- Typing, rapid navigation, changing books and closing search must invalidate stale asynchronous work.

## Progress
- Inspected exact deployed source and compared core bundle/gesture/timer bytes: all match.
- Implementation uses the existing isolated checkout on `feat/book-text-search`.
