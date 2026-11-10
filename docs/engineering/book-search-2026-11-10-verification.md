# EPUB search verification — 10 November 2026

Published code: `82ef772663849833eae4100e864a2c94325d544b`.
Production: https://libra-standalone-preview.vercel.app/
Deployment: `dpl_HWPw36i6CdbWCHoNPaZ9gYTUWhLq`, READY.
Release revision: 21; offline build: `a5e171cac04debad`.

## Fix

A saved EPUB point CFI can resolve to a collapsed, zero-width DOM Range.
Return incorrectly rejected this valid position as invisible after repagination.
Visibility now measures one adjacent character on a clone without changing
the target CFI or book DOM. The regression failed before the fix and passed
after it.

## Observed results

| Check | Result |
| --- | --- |
| Release automated tests | 52/52 PASS |
| Core preservation and pinned offline asset hashes | PASS |
| EPUB browser series, 20 alternating chapter cycles | 90/90 functional assertions PASS |
| Series final no-runtime-errors assertion | FAIL: 2 ResizeObserver notifications |
| EPUB full scenario, 320px, night theme | 17/17 PASS, no runtime errors |
| Manual turn → Close → library reopen, before the visibility-only fix | 10/10 PASS with the original manual text still visible |

The series checks literal phrase results, removal of stale rows, actual text
visibility, delayed viewport resizing, explicit Return, Close, and ten immediate
library exit/reopen operations. The full scenario additionally covers a single
word split by inline emphasis, case-insensitivity, a full sentence, empty and
absent queries, rapid replacement, match navigation, controls and panel bounds.

The long series status is FAIL solely because its final general error check
captured twice: `ResizeObserver loop completed with undelivered notifications.`
Every functional assertion completed successfully. These notifications remain
an open diagnostic observation; the complete 91-assertion suite is not green.

QA deployment: `dpl_3R9D5MpvH92hpwM5RQ7DJpPnnh4C`. All 22 production source
assets match that tested deployment except release.json metadata. Test routes
and fixtures are excluded from production. Tests use a controlled two-chapter
EPUB and a guest local library. No personal book or authenticated sync was used.

Physical iPhone, Safari and installed PWA behavior remain unverified.
