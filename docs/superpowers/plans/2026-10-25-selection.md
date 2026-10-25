# Reader selection implementation plan
> Execute inline with superpowers:executing-plans.
Goal: implement the approved word selection, custom handles and anchored action menu.
Architecture: a standalone DOM selection controller owns touch gestures and a cloned Range, renders its own highlight and handles, and invokes existing annotation callbacks. Main retains source-anchor conversion and persistence.
Tech stack: existing ES modules, Pointer Events, DOM Range, CSS, Node tests, Playwright.
Spec: docs/superpowers/specs/2026-10-25-selection-design.md
Constraints: instant page transitions, unchanged sync/storage schema, no native selection on touch book text, native editing in fields.
Review focus: multiline/reverse drag; accidental page turns; cancellation; menu viewport clipping; copy/save after range adjustments.
- [x] Add range word-boundary tests, observe failures, implement selection controller with hit testing and start/end handles.
- [x] Integrate range-to-source mapping, action lifecycle and navigation guard; replace timer-based mobile selection.
- [x] Style highlights, hit targets and viewport-clamped menu in both themes.
- [x] Run suite/check/build and browser long press/drag/actions/dismissal/instant-navigation scenarios. Verify no sync regression.
- [ ] Publish through reviewed GitHub PR and confirm Pages deployment.

Verification: 78 Node tests, check, Pages build and browser long-press/handle/copy/quote/note/dismissal/keyboard/resize scenarios passed. Independent reviewer found keyboard propagation and stale drag state; both fixed. Physical iPhone system UI remains unverified.
