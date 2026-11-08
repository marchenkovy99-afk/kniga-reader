# Validation — 8 November 2026

- Existing root Node regression suite: 187/187 passed.
- Production gesture/timer/offline suite: 18/18 passed.
- Real production-reader browser harness: 32/32 passed at 390×844 and 32/32 at
  430×844. FB2 and EPUB: tracking, source position unchanged during drag,
  bounded planes, forward/backward, cancellation, instant taps, zero drag-loop
  geometry reads/clones, bookmarks, selection-mode protection, both chapter
  boundaries, immediate exit/reopen with identical physical page and EPUB CFI.
- Independent review found stale cached content after seek and discarded busy
  swipes. Both were reproduced as failing tests, fixed and verified.
- Browser QA exposed reading-time observation of every animation transform:
  deterministic 60-frame reproduction went from 61 computed-style reads to 0,
  while time continued to persist. A cloud-status repaint was also removed
  from the visibility-measurement path.
- EPUB immediate exit/reopen initially restored page 7 instead of page 10
  (390px) and page 6 instead of page 9 (430px). The live-settle/save fence and
  rejection of intermediate restoration screens fixed both final runs.

## Measured browser performance

Final Chromium runs used real requestAnimationFrame callbacks, with screenshot
capture keeping the cloud page foregrounded. Intervals include drag and settling.
Metrics are opt-in through `?libraPerf`, bounded in memory, with no network export.

| CSS viewport | Median interval | p95 interval | Maximum interval | p95 transform write |
| --- | ---: | ---: | ---: | ---: |
| 390×844 | 16.6 ms | 17.5 ms | 24.5 ms | 0.1 ms |
| 430×844 | 16.6 ms | 17.6–17.7 ms | 22.0 ms | 0.1 ms |

These are cloud Chromium timings, not physical-device FPS guarantees. A JS style
write duration does not measure GPU raster or presentation latency. The harness
instrumented getBoundingClientRect/getComputedStyle/cloneNode in the reader's
window; publisher iframe internals are not a full Safari/WebKit performance
trace. No React state setter is called by the gesture module; the live reader's
physical location remains unchanged until release completion.

Automated worker tests verified exact hashes for every offline module, complete
installation, rejection of a mixed release, offline shell/module retrieval and
readiness acknowledgement. The local preview relay modified some asset responses,
so actual service-worker installation through that relay was not accepted as an
offline-device test. Live cloud sync, iOS background/resume, 120 Hz and prolonged
device memory/thermal testing remain unverified. Cold-preview fallback remains
as described in README.md.
