# Libra QA execution report: November 11, 2026

Status: initial audit and first performance fix implemented. Full specification acceptance remains open. No production update was made.

## Source and environments

- Production: https://libra-standalone-preview.vercel.app/
- Verified production deployment: dpl_8SNHd9sLaPNn4mM7wEmpfzAKcBDG, READY.
- Production commit: f930710bbda0e048cd459edf301ea7be677bfe05, branch fix/search-audit-defects-2026-11-10, release revision 23.
- Proposed changes: commit f71336897743454d1119ff6f92681d6ac137fc3d, branch qa/full-performance-20261111, revision 24, offline build f18e72ccc5f21870.
- Source inspection and tests: isolated local clone, Node 24.22.1. The release/ directory is the preserved production application; reader/ also contains development source and must not be substituted for the live release without verification.
- UI smoke testing: remote desktop Chrome, disposable local guest data. No personal account, private book, or authenticated backend data was modified.
- Physical iPhone, installed PWA, Safari, and authenticated two-device synchronization were unavailable for this run.

## Confirmed performance defect and implementation

PERF-001, P2: first search normalizes each whole chapter synchronously. Existing yields occur between chapters, so one large chapter monopolizes the main thread and prevents timely input or cancellation.

Exploratory host measurements before changes:

| Chapter characters | One uninterrupted normalization/indexing call |
| --- | --- |
| 100,000 | 70 ms |
| 500,000 | 339 ms |
| 2,000,000 | 783 ms |

The fix adds createTextIndexAsync(units, {signal, yieldTask}), backed by the same normalization algorithm as synchronous indexing. It yields between bounded chunks within a chapter, checks cancellation before and after each yield, and retains original unit objects and UTF-16 source mappings. Both FB2 and EPUB indexing use this path. Large result-to-CFI conversion also yields every 64 matches and rejects stale generations after yielding.

Use scheduler.yield where available, otherwise MessageChannel with both ports closed after delivery; the final fallback is a timer. No runtime dependencies were added. Service-worker asset hashes were regenerated to keep offline resources pinned to the changed code.

PERF-001 status: implementation and unit/DOM regression checks pass; live-browser verification of the modified build is blocked by preview deployment availability. This is not a claim that every UI delay is fixed.

## Evidence and regression checks

- Baseline release suite after dependency installation: 53/53 PASS.
- New cooperative indexing tests initially failed because the capability was absent, then passed after implementation.
- Final release suite: 57/57 PASS, 0 failures, 0 skipped.
- verify-release.mjs: PASS. Preserved production core remains unchanged outside previously approved adapters; changed search modules are covered by tests and regenerated offline hashes.
- Fifty deterministic multilingual corpora match the original production index exactly, including surrogate pairs, case folding, Cyrillic е/ё, soft hyphens, zero-width characters, and whitespace across chunk/unit boundaries.
- Tests verify independent known UTF-16 match endpoints, original unit identity, abort during one large chapter, default-scheduler responsiveness to a timer task, empty input, and already-aborted work.
- Existing search, navigation, Return/Close, recovery, page-turn, reading-clock, and offline tests continue to pass.
- Independent code review found no blocking correctness regressions. It identified the remaining measurement and extraction limits listed below.

An intermediate full test run correctly failed three offline tests after source changes and before asset repinning. After repinning, all tests pass. These intermediate failures were not ignored.

Exploratory host measurements after changes used an instrumented setImmediate scheduler to observe work slices:

| Chapter characters | Total wall time | Yields | Longest observed work slice |
| --- | --- | --- | --- |
| 100,000 | 49 ms | 25 | 7.6 ms |
| 500,000 | 262 ms | 123 | 18.5 ms |
| 2,000,000 | 948 ms | 489 | 81.5 ms |

These are single exploratory host runs, not p95 measurements, browser frame measurements, or proof of iPhone performance. The total time need not decrease: the intended improvement is allowing input between chunks. The 81.5 ms slice on the largest case remains above the specification target; the cause of that outlier has not been established.

## Browser smoke checks on unchanged production

| Check | Observed result | Limits |
| --- | --- | --- |
| Fresh launch and empty library | PASS | Desktop Chrome only |
| Settings screen | PASS: appearance, offline, cloud, and backup sections present | Opening a section is not end-to-end validation |
| Offline readiness indicator | Displayed Ready | Network-disconnected PWA behavior not exercised |
| Batch import of one FB2 and one EPUB | PASS: two book entries and count of 2 | Small fixtures only |
| Open imported FB2 and EPUB | PASS | Does not prove full text integrity for arbitrary books |
| FB2 phrase across inline formatting | PASS: two expected results in two chapters | One reference phrase |
| FB2 result navigation and Close | PASS: reached page 5/7 and remained there on Close | One completed navigation |
| FB2 panel geometry | PASS: viewport stayed 786 × 920 before/after closing the bottom panel | Desktop viewport only |
| FB2 reload and reopen | PASS: saved page 5/7 restored | One restart cycle |
| EPUB phrase search and navigation | PASS: two results; second result reached page 3/4 | Small controlled EPUB |
| EPUB explicit Return | PASS: returned to page 1/4; search panel absent | One Return cycle |
| Reading-time display | Increased and survived reload | Accuracy, hh:mm requirement, and sync not accepted |

Some immediate UI snapshots were captured before asynchronous navigation finished. Assertions above use completed result counters or the resulting stable screen; early snapshots were not treated as failures of the application. Browser extension metadata errors were observed in console output and were not attributed to Libra.

## Coverage still required

| Specification area | Remaining coverage |
| --- | --- |
| Library and import | Duplicate/corrupted files, large books, deletion/cancel/reimport, sorting, filters, library sizes 50 and 300 |
| Reading and integrity | Full-text continuity, first/last pages, chapter boundaries, images, tables, long footnotes, font/orientation changes, two-page-offset regression |
| Gestures | Physical touch tracking, reversals, cancellation, rapid taps/swipes, boundary cases, Reduce Motion, frame pacing |
| Search | Browser test of modified code, long single chapters, rapid query replacement, close while indexing, 20-cycle real-engine scenarios, cancellation with actual browser scheduler |
| Settings and overlays | Fractional sizes 22.5/23.5, safe areas, keyboard, themes, focus, contrast, overlay interaction |
| Bookmarks, quotations, notes | Full create/edit/delete/navigation workflows and stable source anchors |
| Reading time | Timed sessions, background/lock handling, storage errors, hh:mm presentation, migrations, two-device totals |
| Offline, auth, sync, updates | Network loss, local write errors, account isolation, competing updates, update/rollback migration, real installed PWA |
| Performance and endurance | 30-repeat p95 samples, frame recordings, 60-minute mixed session, memory growth, slower iPhone |

Remaining profiling targets: FB2 unit extraction and EPUB DOM/style extraction are still synchronous before cooperative normalization. Their presence in code is established; unacceptable latency for these steps has not yet been measured. Character-count chunks also cannot guarantee a maximum elapsed duration under garbage collection or resource pressure.

## Deployment blocker and continuation

Two preview deployment requests were rejected by Vercel with HTTP 429, rate_limited: GitHub API rate limit exceeded. Neither returned a deployment ID. There is no new preview URL to claim as working. The existing production alias was not reassigned.

Requested preview source: commit f71336897743454d1119ff6f92681d6ac137fc3d in the existing Vercel project prj_iI4zMb2wQcXHRcEGR2iVDIAVmx0k, team team_7npIzWiAnWNm56uAuTUbfnMV. Preview-only build command: node release/scripts/prepare-search-qa.mjs; output: release/src; no install step. Test fixtures are copied at preview build time, not committed into production src.

Next: once deployment is available, verify the changed code in the isolated preview, including /search-qa.html and /search-suite.html. Do not publish these QA routes to production. Continue the coverage matrix above and collect actual device metrics before declaring the full specification complete.

Rulings: use a separate clone and the actual published commit; keep this change separate from the older main branch and Sites version. Risk if the baseline is later superseded: rebase or transplant only after checking the newly deployed source. Do not infer full acceptance from green unit tests or exploratory host measurements.
