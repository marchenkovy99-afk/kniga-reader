# Libra book search

Approved by the user on 9 November 2026 after reviewing the two-screen reference.

Add a magnifying glass to the existing reader controls. Open a full-height search
panel using the current reader background, text, accent and border tokens. Search
the complete book for literal words, phrases and sentences, case-insensitively,
treating ё/е and whitespace consistently. Show chapter titles, contextual excerpts
and highlighted matches. Selecting a result navigates to the actual physical
FB2 page or EPUB CFI. A compact bottom capsule provides a match counter,
previous/next, results and close controls. Reserve space rather than cover prose.
Return to reading restores the position captured before search.

The user explicitly asked to preserve the existing app's design. Existing themes,
typography, user books, cloud/auth, selection, footnotes and gesture fixes remain.
Search stays on-device and its assets join the existing verified offline cache.

Use the recovered production release: the older TypeScript app is not the live
version and rebuilding it would lose deployed fixes. Extend its two existing
reader preview adapters rather than duplicate reader navigation or import logic.
