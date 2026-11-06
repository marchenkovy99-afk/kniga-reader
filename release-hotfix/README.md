# Current Libra release recovery and reader repair

This directory preserves the exact November 5 published application, including dark chapter headings, remaining chapter pages, read/unread book filters, and its current interface.

The original typed source commit was not uploaded to GitHub. The built JavaScript, CSS and binary assets are recovered without modification from immutable Vercel deployment `dpl_C6pMj1A1abRKbtpeUpbswhJVqcwC`. `build.mjs` checks every original file against its published SHA-1 content identifier, adds the small reader gesture module, and regenerates the complete pinned offline cache. `output/` is the resulting complete deployable application and is committed for durability.

Reproduce using Node 22 or newer:

```sh
node release-hotfix/build.mjs
```

The repair handles central taps on touchend, prevents a duplicate synthetic click, and starts the existing native quote-selection mode on a stationary hold. It retains the application's save/copy quote panel, original quote storage, page navigation, modal controls, typography and settings.

Verified against the exact built application in Chromium with iPhone emulation:
- First touch immediately opens controls; the following click does not close them.
- Holding text selects and saves quotes in FB2 and EPUB.
- Vertical movement and cancelled gestures do not toggle controls.
- Saved quotes survive source navigation and offline reloads.
- Read/unread filters survive reload and support moving books back.
- Controls overlay the book without moving its text.
- Half-point font sizes and OLED theme persist; dark headings remain legible.
- Remaining chapter pages decrement on a swipe; bookmarks save.
- Closing and reopening returns to the saved physical page.
- First-touch controls work across repeated reopenings.
- An already-installed old PWA updates on a full close/reopen without losing its book or position, and then works offline.

The existing worker intentionally leaves an open book on its complete old release. New releases activate after all old app windows are closed. The upgrade regression exercises that lifecycle.

Chromium/WebKit tests against the immutable new Vercel build are configured in `.github/workflows/libra-current-release-checks.yml`.
