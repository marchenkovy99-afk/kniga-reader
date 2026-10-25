# Book layout upgrade, 25 October 2026

## Behavior
- FB2/EPUB retain epigraphs, citations, attribution, verse, image captions, inline emphasis and preformatted text through a bounded presentation model.
- EPUB CSS never executes. Only safe local emphasis/alignment declarations and simple selectors are interpreted. Fonts, sizes, margins, colors, positioning, external imports and conditional styles do not override reader controls.
- Conventional XHTML PUBLIC/SYSTEM declarations without internal subsets are removed only from the prolog. A bounded set of common named entities is converted locally. CDATA remains literal; actual DTD/entity definitions remain rejected, with no external requests.
- Short Russian prepositions, initials and units may form measured nonbreaking groups. Text characters stay intact, including selection/search offsets.
- Page composition keeps small subheadings with following lines, avoids one-line paragraph fragments when feasible, and pairs short captions with images. Original text is reconstructed exactly by browser regressions.

## Saved data
No setting defaults, user preference values/timestamps, book IDs, source bytes, progress, annotations or bookmarks are reset. Existing books gain richer presentation only when block count, types, source IDs and text match exactly. Incompatible originals keep the legacy model. Upgrade writes only the local book, never preference records or cloud progress. Page cache version 4 includes presentation metadata. A first reflow can change page numbers while keeping the source position.

## Three sequential QA cycles
1. Data/import tester: nested semantics, sanitization, old anchors/notes, live sync state and failed storage. Found and reproduced CSS at-rule bugs, fixed with balanced parsing.
2. Mobile-layout tester: 48 semantic configurations, screenshots, images, selection, menu and restored settings. Found and reproduced semantic continuation alignment, fixed and rechecked.
3. Final independent tester: 24 adversarial long-string/Unicode configurations, full builds and existing app flows. Conventional XHTML compatibility limitation fixed with unit and native-browser regressions.

Final checks: 103 unit tests, syntax/type checks, Pages build, seven browser scripts. Tests use local/mocked cloud data, not the user's account. No physical iPhone battery or Safari certification. DRM/fixed-layout EPUB and over-height indivisible tables remain unsupported. At an extreme 240px viewport with every typography setting maximized, an emoji can overflow by 2px; the same settings pass at tested 280–393px phone widths.
