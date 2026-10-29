# DOM pagination engine implementation plan

Goal: implement the user's final specification v1.0 for kniga-reader without replacing the library, account state or Supabase transport.

Architecture: immutable document blocks and grapheme-safe source ranges feed a browser DOM layout session. Pages contain source fragments; a renderer materializes their HTML, independently checks source integrity and validates glyph geometry before display. Incremental snapshots expose only a validated contiguous prefix; a cancelled generation cannot publish or cache results.

Stack: existing vanilla JS, Vite, IndexedDB, PageFlip and Supabase. No new runtime dependency.

Constraints: preserve source, legacy block/offset anchors and imported HTML formatting; no clipping as a fit mechanism; preserve design and chrome overlays. Physical iPhone verification is a release gate and cannot be inferred from desktop WebKit. The existing published engine currently disables animation; retain its behavior rather than silently enabling it.

Review focus: combining/ZWJ graphemes; paragraph boundary whitespace; clipped ancestors; fonts/images loading late; settings changes during an in-flight generation.

1. Audit baseline and record deterministic failing density/Unicode/geometry tests. Compare the production Canvas line planner with browser-native layout on identical source/CSS; classify semantic gaps separately.
2. Add DocumentModel (stable IDs, chapter membership, offsets, grapheme boundaries), source-backed PageRenderer and prefix/full ContentIntegrityValidator. Test gaps, duplicate text, invalid boundaries, formatted spans, empty image blocks, old anchors.
3. Add DOM TextLayoutEngine and async PaginationEngine. Fill ordinary paragraphs across boundaries; probe the next legal fragment; record explicit heading/table/image rules. Yield by time budget and publish validated prefix snapshots; support AbortSignal. Test mixed structure and extreme typography in Chromium and WebKit.
4. Integrate measured viewport snapshots, engine routing, cache version, incremental prefix rendering and exact anchor preservation. Validate final untransformed visible pages and retry using measured actual bounds, then fail visibly without deleting source. Keep the previous engine available only as an explicit local rollback.
5. Run full Node suite, type check, production build and browser integration. Compare speed and page density with baseline. Write architecture, migration/rollback, verification and remaining limitations. Save on an isolated review branch; do not update production until mandatory physical iPhone acceptance is recorded.

Each implementation task starts with a failing behavior test, then implementation, green tests and a commit. The final spec supplied in the conversation is authoritative. Routine implementation choices proceed under that authorization without another approval round.
