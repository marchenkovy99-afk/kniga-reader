# Libra production page-turn release

This directory contains the exact published production application recovered from
`dpl_BBvNQjfHmHXy3pqRt17RbKjMrGzX`, plus targeted changes in `src/page-turns.js`
and `src/reading-time.js`. The repository's TypeScript branch predates several
published fixes. Rebuilding it would discard those fixes. `baseline.json` and
`npm run verify` protect the unchanged production core, CSS, account isolation,
cloud, selection, footnotes and typography bytes.

## Verification

```sh
npm ci
npm test
npm run verify
node scripts/prepare-browser-qa.mjs
```

Serve `src/` and open `/qa.html` or `/qa.html?width=430` in a browser. The QA
page clears its own origin's IndexedDB and local storage before creating test
books: **run it only on a disposable local origin**. It is excluded from the
production upload allowlist. The browser harness uses the actual production
React readers, FB2 and EPUB, synthetic touch sequences and real rAF timing.

After changing a production module, run `node scripts/pin-offline.mjs` and tests.
Do not deploy the QA fixtures, test dependencies or local preview configuration.
The Vercel upload allowlist is `baseline.json`'s files under `src/` plus
`vercel.json`. Deploy to the existing project `prj_iI4zMb2wQcXHRcEGR2iVDIAVmx0k`
in team `team_7npIzWiAnWNm56uAuTUbfnMV`.

## Behavior

- Idle preparation mounts an inert current/previous/next track. One rAF writes
  one `translate3d` per drag frame; it does not clone, measure, paginate or set
  React state. Reversal reuses the same planes.
- Monotone velocity-aware release can be grabbed again. Live navigation runs
  after visual completion, so its work does not block those animation frames.
  Final preview stays until the live reader commits; EPUB also waits for its
  queued layout/save fence. Seek/settings changes invalidate cached planes.
- Swipes arriving during the live handoff are queued; taps remain instant.
- Reading time ignores inert visual mutations and paints once a second. Cloud
  status repaint does not recompute visibility. Counting/storage/cloud format
  and account ownership are unchanged.
- Existing CSP, offline install verification, previous-cache retention and the
  existing service-worker update lifecycle remain in place. No forced reload,
  storage migration or skipWaiting is introduced.

## Remaining limits

Physical iPhone/Safari/standalone PWA and 120 Hz hardware were unavailable.
Browser QA used cloud Chromium with 390×844 and 430×844 CSS-pixel iframe viewports;
this is not an iPhone emulator. No live authenticated cloud write was performed.
Long-duration device memory/thermal behavior remains unverified.

If a chapter preview is still loading, or the existing 5,000-element snapshot
limit is exceeded, a cold gesture uses safe instant navigation. This avoids
blank content, but means fully animated swipes cannot be guaranteed in that
fallback. A queued swipe waits up to one second for preparation before using it.
The native-quality iPhone Definition of Done still needs device acceptance.
