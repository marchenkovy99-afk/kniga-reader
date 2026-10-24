# Library Refresh Implementation Plan

Goal: compact library, whole-app theme access, no paragraph gaps by default or after migration.
Architecture: existing vanilla JS/Vite frontend and Supabase unchanged; update library markup, shared sheet styles, and settings restoration.
Spec: ../specs/2026-10-24-library-refresh-design.md

- [x] Test legacy settings migration, retaining font, fields, theme and intentional new spacing.
- [x] Add versioned paragraph-spacing restoration and zero default/fallback; use for local and remote settings.
- [x] Replace library markup and responsive styles, preserve selectors and actions. Add persisted theme control to library.
- [x] Verify library and book at narrow width, both themes, sheets, search, saved progress and spacing after reload. Confirm controls stay within viewport and inputs are 16 px.
- [x] Run tests, type checking, Pages build. Push exact source and generated docs to GitHub; verify successful Pages deployment and published UI.
