# LIBRA

A standalone, local-first iPhone e-reader prototype built with React, TypeScript, Vite, IndexedDB, EPUB.js and PDF.js.

## Current status: functional alpha

The code in this directory is a **new application**. It imports no modules, CSS, pagination code, or UI components from the legacy `kniga-reader` project. It currently lives in an isolated GitHub branch because the connected GitHub integration cannot create repositories.

### Implemented in this alpha
- Local IndexedDB library: FB2, EPUB, PDF import and file retention.
- FB2 parser with chapters, paragraphs, poetry, images, tables, basic title/author/cover metadata.
- FB2 reading with native CSS multicolumn pagination and fragmentable DOM; no manual string slicing or content truncation. Stable source-text anchors are used to restore the approximate visible passage after typography and viewport changes.
- EPUB.js paginated reader with CFI-based position persistence.
- PDF.js page-by-page canvas rendering, aspect-ratio-preserving fit.
- Reading progress and bookmarks stored separately from book bytes in IndexedDB schema v2, with a transactional upgrade from v1.
- iPhone-oriented library, search, generated covers, reader controls and settings.
- Four consistent shell themes, with matching `theme-color` metadata.
- PWA manifest and offline same-origin asset caching.
- Vitest unit tests and CI build / type checks.

### Intentionally not claimed as complete
- **Cloud sync / Supabase**: not connected; no migration of old user data. Do not delete the old application.
- Pixel-perfect pagination guarantees, iPhone Status Bar behavior, extensive stress/visual tests, polished design review, cross-device sync conflicts and production accessibility have **not** been accepted.
- EPUB images, fonts and exotic layouts depend on EPUB.js. PDF is fixed-layout, not reflowed.
- FB2 source-character anchors now survive changes to page geometry, but an exact first-line match is not guaranteed because a saved character can move into a newly fragmented page. Image-only positions and bookmarks need additional hardening.
- PDF file size, encrypted PDFs, bad FB2 and malformed archives need stronger limits and error handling.
- Offline PWA requires initial successful online load; exported/remote assets are not guaranteed offline.

## Local use

```sh
cd libra
npm install
npm run dev
npm run test
npm run build
```

For a new GitHub Pages repository set `LIBRA_BASE_PATH=/REPOSITORY_NAME/` at build time. For a custom domain use `LIBRA_BASE_PATH=/`.

## Roadmap / acceptance gates

1. **Engine hardening**: stable FB2 text-anchor implementation added. Next: compare complete source text with rendered DOM, test chapter boundaries, surrogate pairs, images, tables, and large documents. Test and optimize image-only locations.
2. **Browser matrix**: Chromium + WebKit automated mobile tests added for text integrity, anchor reflow, IndexedDB upgrade and theme colors. Extend to varied viewport sizes and font combinations, performance stress tests, screenshots and physical iOS PWA.
3. **Visual approval**: agree on library and reader mockups, then refine production UI.
4. **Cloud sync**: dedicated Supabase project, RLS, Storage permissions, tombstones, conflict policy, local-first queue; verify offline / reconnection / deletion.
5. **Migration**: inspect and document actual legacy schema, implement dry-run and one-way safe copy, test rollback.
6. **Physical devices**: installed PWA on iPhone and iPad. Check top safe areas and status bar on each theme.
7. **Performance**: collect measured timings; 2-second startup and other PRD targets remain **targets**, not proven facts.

Never replace the legacy app until all acceptance gates are satisfied.

## Data safety

All user books remain device-local in this alpha. Do not remove the original reader or its Supabase database. No legacy cloud migration or upload is enabled. IndexedDB v2 separates high-frequency reading state from large immutable files; an upgrade cursor copies V1 positions and bookmarks in the same upgrade transaction. Browser tests cover the migration scenario. Incognito mode or deletion of site data can still remove local books, so maintain a separate copy of the original files.
