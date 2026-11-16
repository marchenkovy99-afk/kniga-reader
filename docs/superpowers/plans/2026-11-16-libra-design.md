# Libra Design Implementation Plan

> Execute inline using superpowers:executing-plans. Track verified results here.

**Goal:** Apply the approved Libra interface review while preserving reading data and offline/sync behavior.
**Architecture:** Existing main.js manages screens; ui-model.js owns testable filtering, search context, chapter labels and section resets; a scoped UI stylesheet defines new components without changing text typography.
**Tech Stack:** Vanilla JavaScript, CSS, Vite, IndexedDB, existing Supabase transport.
**Spec:** docs/superpowers/specs/2026-11-16-libra-design.md

## Global Constraints
- Keep source anchors and original book text unchanged.
- Preserve account isolation, cloud writes, cached pages and offline support.
- Controls work with touch and keyboard, with reduced-motion support.
- Main publication remains GitHub Pages /kniga-reader/.

## Review Focus
- A jump during progressive pagination retains a usable return point.
- Saved items belong to the active account, including after account changes.
- Search snippets cannot inject HTML and retain original source offsets.
- Settings for one book do not silently replace defaults for all books.
- Small screens, long Cyrillic titles and open keyboards do not overflow.

## Tasks
- [ ] 1. Reading controls: fixed clearance, progress preview, intentional jump return, chapter title spacing. Write model regression tests, run red then green.
- [ ] 2. Library: branding, three destinations, sorting, planned filter, compact/default view and distinct empty states. Exercise model cases.
- [ ] 3. Saved and search: unified account-local saves, chapter tabs, highlighted contextual search and no empty export. Exercise search and saved filters.
- [ ] 4. Appearance and book sheet: scoped reset and explicit defaults, presets, font samples, themes, grouped technical details. Exercise reset regressions.
- [ ] 5. Selection and quotes (user extension): stable touch drag, direct quote actions, color/note/copy/delete with undo; canonical source quotation text and duplicate protection.
- [ ] 6. Verification and publication: npm test/check/build, visual browser walkthrough, review diff, publish with expected-head lease and verify live assets.

## Verification ledger
- Baseline: npm test passed, 189/189 tests.
- Ruling: preserve existing instant tap/swipe mechanics; animation-engine work is outside this interface refinement.

- Review fix: removed an awaited cache read from interactive shelf initialization; deferred updates now check the captured owner and exact continuation node.

- Quote review fixes: actionable notice is hosted inside an open modal; undo rerenders only the originating quote view.
- Ruling: global appearance retains the existing timestamp conflict model and is explicitly labelled “Использовать для всех книг”, rather than claiming it affects new books only.
