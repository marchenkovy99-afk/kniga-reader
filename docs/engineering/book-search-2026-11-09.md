# Book search implementation and verification

Production source: `release/src`, based on `cfc8d30`. The base bundle, gesture
module and timer were compared with the live deployment before editing.

Search code lives in `book-search-core.js`, `book-search.js` and `book-search.css`.
The original application bundle only gains two adapter extensions. `verify-release`
reverses precisely those additions and checks the original core's SHA-256.
The original CSS, storage/auth/cloud, quote and footnote code is unchanged.

Search uses literal normalized text with original UTF-16 source offsets. Inline
formatting, whitespace and ё/е are supported. Indexing is canceled on closing
the panel or leaving the book. Results are capped at 10,000, rendered in batches
of 50, and snippets use textContent, never imported book HTML. EPUB indexing uses
detached XML and existing archive/safety hooks; it does not unload live sections.
Highlights are separate rectangles, so they never modify the reader text DOM.

Independent review found navigation state reset after reopening results, missing
FB2 table cells, and indexing continuing after close. All three were addressed.
The table and cancellation cases were reproduced by failing tests before fixes.
Browser testing also exposed epub.js manager replacement during resize; a new
failing gesture test covered it and the module now treats that state as not ready.

Verification commands:

```
npm test
npm test --prefix libra
npm test --prefix release-hotfix
npm test --prefix release
npm run verify --prefix release
```

Browser QA: upload only to a disposable preview origin, with test-only
`search-qa.html`, `search-qa.js`, `search-qa-bootstrap.js` and `search-fixture.epub`.
Those files must never enter the production upload. The QA bootstrap prevents
the production service worker from replacing the test route with its offline shell.
Test FB2/EPUB, `?format=epub`, `?theme=night&width=430&scene=results`, and
`?width=320&scene=hit`. No personal books or authenticated cloud writes are used.

Limits: no physical iPhone/Safari PWA or 120 Hz device test. Automatic keyboard
focus restoration after closing can fall back to reader controls; this browser
did not reliably restore the launch button despite it being visible and enabled.
Touch operation and access to controls are tested independently of focus.

## Search dismissal correction

Closing the bottom search capsule explicitly preserves the selected text anchor
while page height is restored. FB2 resolves the source anchor under the new
geometry; EPUB redisplays the selected CFI through its navigation queue. Only
the separately labeled Return button reads the pre-search origin. Added unit
regressions for close versus return and browser scenarios `?stay=1` and
`?stay=same`, including library exit/reopen.

## Navigation repair, 9 November 2026

The repair uses source anchors rather than previously measured page numbers.
FB2 adapter seeking gives anchors precedence even across chapters. EPUB reports
queue/layout readiness. Search waits for stable live geometry, verifies a
positive-area intersection of the requested source range with the viewport,
and waits for pending manual navigation before capturing a Close target.

Manual movement is recorded from edge taps, horizontal gestures, page keys,
range inputs and fallback scrolling. Center taps do not discard the selected
match. Container/font/visualViewport changes reconcile an active match only;
an idle or closed search never opens itself on a resize. The search launcher
is disabled during asynchronous navigation/close/return so a new session
cannot race a previous restoration. FB2 scrolling fallback has separate
readiness, source scrolling and position persistence through the existing
storage function.

Search query edits remove old rows immediately, and row handlers validate
the query generation. Readable non-linear EPUB spine sections are included.
FB2 table targets account for the preceding cells' text. Existing literal
normalization and UTF-16 source mappings are retained.

Validation: release Node tests (51), root Node tests (187), preserved-release
security/footnote/reading-time tests (38), and release core-preservation check.
Regression tests were observed failing before the corresponding repairs.
The offline manifest was regenerated with exact asset hashes.
Browser tests use a disposable origin and `?stress=1`, with 20 alternating
same/other-chapter cycles, delayed container resizing, close/return and reopen.
The QA script checks live engine geometry and the public search busy state;
a stale renderer's ready flag alone is insufficient.

Physical iPhone, Safari/PWA and local WebKit verification remain unavailable
in this executor. Cloud Chromium checks do not establish those results.
No authenticated cloud test or personal book upload is required by the QA page.

The stress suite also reproduced a stale-library reopening race. The existing
library reload is now awaited before switching out of the reader, preventing
a quick tile click from reopening a book with its pre-search position. This
two-statement callback replacement is explicitly reversed by verify-release
in addition to the two search adapters; the remaining original core is intact.

A further RED→GREEN regression covers search before FB2 parsing completes: the
index builder now waits for chapters (or the EPUB Book) rather than caching an
empty index during startup. Closing search cancels this wait.

Repeated EPUB reopen/resize revealed that saving a rendered page-start CFI
is insufficient: the match can move onto the next physical page under new
geometry. The EPUB adapter now persists the exact selected source CFI through
the existing guarded storage function and updates its retained resize target.
Cancelled edge gestures compare physical page/chapter movement, so an unchanged
page-start CFI notification does not discard that exact selected source.

Startup EPUB relocation must retain the saved source CFI while the first
geometry resize is queued. Two narrowly matched startup substitutions preserve
that CFI until loaded; later ordinary relocations still update it. A regression
test executes the actual compiled commit handler in both startup and loaded
states. Browser reopen assertions now wait for fresh stable geometry and the
expected visible text; a momentary ready report is not an acceptance signal.

## EPUB follow-up, 10 November 2026

The follow-up browser suite reproduced a false Return error after a viewport
change. A page-start EPUB CFI may resolve to a collapsed DOM Range with zero
width. Source verification now measures one adjacent character on a cloned
range; it leaves the navigation target and the book DOM unchanged. The added
regression failed before the change and passes with it. Release checks: 52/52
Node tests and core-preservation/offline hash verification.

Browser acceptance checks compare source text visibility across repagination.
Neither physical page numbers nor the renderer's page-start CFI are stable
identities when the search capsule changes the usable viewport height. The
manual-reading scenario checks the original manual source CFI remains visible
after Close and library exit/reopen. The test fixture waits for stable live
geometry before capturing origins and checks enabled controls before clicks.
Earlier timing and page-identity assertion failures are not passing results.
The suite now includes single-word search through inline emphasis, diagnostic
positions on failure, and a manual turn/close/reopen scenario.

Physical iPhone/Safari/PWA validation remains outstanding. Test EPUBs are
controlled fixtures; no personal EPUB or authenticated cloud account was used.

## Overlay and immediate dismissal correction, 10 November 2026

The user's follow-up supersedes the earlier reserved-space capsule design.
Production reproduction measured a 106px reader inset and a capsule that was
still mounted immediately after Close. The inset changed live geometry, caused
pagination and made Close wait for layout plus an unnecessary seek.

Removed the search-specific bottom inset. The existing absolutely positioned
capsule now overlays the unchanged reader viewport. Close synchronously removes
search UI and clears its navigation state; it does not seek, repaginate or wait
for the renderer. The normal reader continues persisting manual page turns.
Close stays enabled during navigation. Navigation versions prevent cancelled
lookups, table highlighting and resize work from reopening UI, painting stale
highlights, writing a stale target or clearing a newer session's busy state.
Explicit Return retains source-aware restoration.

Four regression assertions failed against the prior implementation and pass
with this correction. The release suite has 49 passing tests; obsolete Close
re-seek expectations were replaced with immediate-dismissal and no-navigation
contracts. Root suite: 187 passing tests. Core-preservation and offline hash
verification pass. No original compiled core changes were required.

The browser overlay scenario measures viewport dimensions, source layout key
and computed font before search, while browsing a hit and after dismissal;
it also checks word/phrase/sentence search, same-handler Close, reopening the
book, explicit Return and cancellation during lookup. Both EPUB and 320px FB2
passed 27 checks on the overlay implementation. Final cancellation guards are
additionally checked by the complete regression suite and final browser QA.
Physical iPhone/Safari/PWA checks remain unavailable.
Final full browser scenario: 17/17 PASS each for EPUB and 320px FB2 on dpl_HCRotvshcskeXb1gZLqbvdAFDUDj, including literal word/sentence search, stale-query cancellation, previous match, explicit Return and unchanged layout. No runtime errors in either scenario.
