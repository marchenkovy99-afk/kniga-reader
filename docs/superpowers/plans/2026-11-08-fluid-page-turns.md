# Libra fluid page turns
Goal: improve the existing production gesture module without rebuilding stale React sources.
Production source of truth: dpl_BBvNQjfHmHXy3pqRt17RbKjMrGzX, recovered byte-for-byte into release/src. Git branch sources predate the latest published fixes; compiled core must remain byte-identical.
1. Reproduce gesture hot-path layout reads and release-time wait with node/jsdom tests, then add a browser fixture for frame timing.
2. Prepare a mounted three-sheet track outside active gestures. Drag writes only track translate3d in one rAF. Defer warming while active. Animate release immediately with velocity-aware, monotone, timestamp-based physics while existing reader navigation runs beneath. Keep final preview until reader ready. Interrupt settlement without jumps, cancel pending work on visibility/resize, preserve edge taps and selection.
3. Run gesture/regression tests, real app FB2/EPUB checks and browser timing. Regenerate pinned service worker hashes. Preserve core/auth/cloud/data bytes. Commit source and deploy existing Vercel project only after checks.
Limits: no physical iPhone available; browser timing is not evidence of physical-device smoothness.
