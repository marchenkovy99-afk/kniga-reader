# PWA-first release criteria for the book reader

The primary supported mobile interaction is **Safari > Add to Home Screen > standalone PWA**. The reader must remain usable in ordinary browser tabs, but desktop/Chromium-only success is not a sufficient release check.

## Mandatory automated gate

On each change to `reader/**`, `tests/**`, or the build workflow, GitHub Actions must pass:

1. `npm test` and `npm run check`: content integrity, pagination anchors, preferences, syntax/types.
2. `npm run build:pages`.
3. `INSTALLED_APP=1 node tests/reader-geometry.browser.mjs`: browser viewport and safe inset geometry, 6 consecutive pages, header/footer overlay, no repagination when controls toggle.
4. `node tests/pagination-layout.browser.mjs`: every source character preserved across pages.
5. `node tests/reader-pwa.webkit.browser.mjs`: WebKit at three phone sizes with simulated iOS standalone mode and safe areas; no cropped glyph rectangles, anchor continuity, control overlay, appearance-sheet continuity, reload with a book present. Save screenshots as an Actions artifact.

**Do not release when a required check fails.** Update only the affected application code and/or tests; retain synced books, reader preferences and reading positions.

## Manual iOS check (when an actual device or remote iPhone is available)

- Open the published URL in Safari, use Share > Add to Home Screen, launch the installed icon.
- Check the first and last *fully legible* line in dark and light themes; the status bar and home indicator must not blur or crop text.
- Check 2 or more font sizes and landscape/portrait rotation.
- Open and close reading controls: page count, text and current source anchor must not change.
- Turn several pages and verify no missing or duplicated text. Close/reopen the PWA and verify the saved reading position and settings.
- Check offline startup with previously downloaded content and return of connectivity.
- Check successful update of an already installed PWA (including service-worker cache refresh and preservation of books/preferences).

## Explicit limitation

Linux Playwright WebKit is **not** iOS Safari running as an actual Home Screen application. Simulating `navigator.standalone`, mobile viewports and safe-area values covers application logic and layout but cannot certify the native iOS status-bar blur, keyboard or gesture compositor. Such points must be described as **device-unverified** until tested on a real or remote iPhone.
