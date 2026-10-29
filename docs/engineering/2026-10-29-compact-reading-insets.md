# Compact reading bounds

The supplied Yandex Books screenshot is the visual reference for compact top
and bottom whitespace, without changing the reader's saved typography.

Confirmed cause: the final `.reader` rule added 22 CSS px after the iOS top
safe area, then `.book-text` added another 4 px. This reserved an extra row
before pagination even began. At 59 px top safe area the stage began at 81 px.

The stage now starts 4 px after the top safe area and text has 2 px top
padding. At 393 × 852 and 430 × 932, with a simulated 59 px top inset,
Chromium measured the first glyph at 65 px. This removes 20 px of upper
whitespace. The lower stage edge is 14 px above the viewport bottom when the
safe area is 34 px; at least 12 px remains on other tested screens to avoid
placing text against the gesture indicator. The old 2 px lower inset was
unsafe for that purpose.

The DOM engine measures these bounds and continues to accept complete rows
only. Book typography, saved source anchors, cloud data and original content
are unchanged. Pagination cache version is 16; PWA shell cache is v36.

## Verification

- New `reading-insets.fixture.mjs` reproduced the old 22 px excess on all four
  viewport cases before the CSS change.
- Chromium: 393 × 852, 430 × 932, 852 × 393, 375 × 667; 43 pages checked with
  exact source reconstruction and no clipped glyph rectangles.
- At 393 × 852 ordinary-page residual space within the reading stage was at
  most 9.1 px with 26.4 px line spacing; at 430 × 932 at most 9.9 px.
- Node suite: 182 passed; type checks and Pages build passed.
- The CI browser runner includes the new fixture in both Chromium and WebKit.
- Desktop automation does not establish that the real iPhone status-bar blur
  matches the simulated safe area. Physical installed-PWA confirmation is
  still required; no claim of a physical-device test is made.
