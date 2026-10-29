# Reading viewport and source integrity

The reader must keep every imported source character in order and paint only
complete, fitting pages. A DOM text-content comparison alone does not prove
that a page is readable inside its current viewport.

## Reproduced defect

When the window shrank from 852 px to 470 px, a previously rendered 759 px
page could remain inside the new 377 px reading stage during the resize
debounce. The regression fixture observed 16 clipped text rectangles.

## Protection

- Invalidate and hide the old page as soon as its stage geometry changes.
- Bind a CSS media-query paint guard to the viewport snapshot. A smaller
  viewport hides the old page even before JavaScript resize handlers run.
  Read media-query dimensions directly when Safari's JS/CSS sizes disagree.
- Preserve the exact source anchor while rebuilding the layout.
- Wait for fonts and the page engine's render frames, then check the actual
  text rectangles against the page, current reading stage and visible viewport.
- Keep a failed layout hidden and show an actionable message. The original
  book remains available; an oversized indivisible block is never truncated.
- Queue chapter/search/bookmark jumps during reflow and commit their anchor
  after the requested layout is validated.
- Version the pagination cache when changing the page padding.

## Reproducible checks

Run `npm test`, `npm run check`, and `npm run build:pages`.

`tests/build-pagination-visibility-fixture.mjs <output.html>` builds the
typography matrix from production pagination and CSS. It compares the full
rendered text with imported source and inspects every text rectangle.

`tests/build-rendered-reader-fixture.mjs <output.html>` creates an HTML file
and a sibling module. Serve them alongside the Pages build at `/kniga-reader/`.
The fixture uses disposable local test data, walks the actual reader's pages,
changes viewport sizes and type settings, reloads saved state, and checks a
search jump requested during reflow. Safe areas can be emulated in the test
stylesheet; do not replace production `env()` values in shipped files.
Block outgoing connections in the QA-only reader index (`connect-src 'none'`)
so an existing preview-origin auth session cannot sync disposable test books.

Browser coverage is Chromium with emulated viewport/safe-area sizes. This
does not claim verification on physical iPhones or Safari/WebKit.
