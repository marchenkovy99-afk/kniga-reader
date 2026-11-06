# Footnote content correction, 6 November 2026

Confirmed defect: the dialog displayed a reference marker such as 16 instead of the associated explanation when a publisher placed the target anchor in a number-only title/paragraph.

Root cause: targetText returned the target element textContent immediately. FB2 lookup had the same early return. Neither expanded a title anchor to its note body.

Fix: resolve the exact document anchor, expand to its enclosing FB2/semantic note container or collect following paragraphs until the next note boundary. Preserve all paragraphs without a character limit. Render via textContent. Keep the scrollable dialog and local-only original-file lookup. A marker alone is no longer accepted as successful resolution.

Executed validation: 22 Node tests passed, including 10 document fixtures, one click-to-dialog integration test using the original FB2 Blob from fake IndexedDB, and the existing 11 release security regressions. The reproduced pre-fix marker-only failure is recorded in 20-footnote-content-red.log. Long-note fixtures compare the entire string exactly and exclude neighbouring note content. EPUB document layouts and FB2 XML layouts are included.

Added browser regressions for FB2 and EPUB with references 13/16, a long multi-paragraph note, end-of-note scroll visibility, offline reopening, and stable reading position. Execution was attempted, but Chromium could not launch: process_singleton socket() returned Operation not permitted. These browser tests did not execute and are not reported as passed. No physical iPhone or original user book file was available. The screenshot identifies the symptom but cannot establish the original note text.

Production artifact: release 2026-11-06-full-footnote-content, repair revision 7. Offline precache includes the new resolver module and uses a regenerated integrity manifest.
