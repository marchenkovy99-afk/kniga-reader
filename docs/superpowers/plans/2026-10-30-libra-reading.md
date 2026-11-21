# Libra reading release

The user requested one completed release without intermediate design approvals.

Preserve the standalone Libra URL, IndexedDB books, source anchors, bookmarks,
FB2/EPUB support and existing themes. Do not modify the legacy reader or add PDF.

1. Add exact book-wide FB2 page totals by measuring chapters in the background
   with the same browser column geometry; keep source anchors through reflow.
2. Add a real accessible progress slider, compact persistent page/percentage
   footer, chapter context, keyboard navigation and jump-to-page control.
3. Reduce default gutters and vertical spacing, account for the footer once,
   and offer compact/standard/large presets without overwriting saved settings.
4. Refine the library, toolbar and settings using one paper/ink design system.
5. Verify unit tests, build, mobile geometry, actual final-character visibility,
   seek/reload and all themes. Publish to the existing Vercel project.

Full-book FB2 counts are layout-dependent. EPUB uses generated stable content
locations, clearly identified as conditional pages in the interface.
