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
