# Libra floating controls implementation plan

Goal: implement approved variant 2, preserving every library tab and reader capability.
Architecture: presentation-only JSX groups and scoped CSS. Preserve reader geometry, typography, settings persistence, anchors and cloud behavior.
Spec: approved reference and overlay requirement in conversation, 2026-10-31.

- [ ] Group library Bookmarks/Quotes in a capsule between separate Library/Settings buttons. Keep import separate.
- [ ] Group reader Text/Page between separate Contents/Quote controls. Keep bookmark, seek and all text settings. Absolute overlay only; never change reading canvas dimensions.
- [ ] Verify unit tests/typecheck/build, browser toggling and settings invariance, mobile widths and themes.
- [ ] Commit/push isolated branch, deploy existing Vercel project and verify served URL.
