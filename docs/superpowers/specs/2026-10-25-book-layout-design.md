# Book import and typography upgrade

User-approved scope: improve semantic import, page composition and Russian typography while retaining all existing preferences. The user additionally requires three sequential QA cycles after implementation.

Approach: extend the existing importer and renderer. A replacement reading engine would risk the user's synchronized anchors; wholesale EPUB CSS would override their chosen typography. Neither is needed. Preserve the current block order, text and source identifiers. Parse only a bounded presentation vocabulary from FB2, EPUB tags and local EPUB styles: epigraphs, quotations, verse, attribution, captions, preformatted text, emphasis, alignment. Never execute source CSS or fetch external resources; source font sizes/families/line-height/colors/margins are ignored.

Existing books are re-read from their stored original once. Apply the richer markup only if block count, text, types and source identifiers match exactly. Otherwise retain the original model, bookmarks and selections. Preserve book ID, original bytes, preference records, timestamps, notes and reading position. Migration is local and must never become a settings/progress edit or queue an upload.

Pagination retains source character anchors. Keep small subheadings with the next text; avoid a single paragraph line at either side of a page break when a two-line split can fit. Keep images and short adjacent captions together. Nonbreaking Russian typographic groups retain original characters and cannot exceed a conservative width budget. Do not modify the source string or silently rewrite punctuation.

No new settings defaults, fonts, network dependencies or storage schema. Typography cache version changes once and includes presentation metadata. Large unsplittable tables and DRM/fixed-layout EPUB remain explicitly unsupported rather than silently truncated. We do not claim parity with commercial apps without comparable device testing.

Validation: import/security/compatibility unit tests; real-browser layout tests with exact text reconstruction, no overflow, subheading/widow/caption rules; existing sync/selection/navigation browser tests. Three QA cycles: data/settings/anchors, mobile layout and interactions, final independent review and regression before deployment. Physical iPhone verification remains a stated limitation.
