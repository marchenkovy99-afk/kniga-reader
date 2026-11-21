# Libra: iOS file selection and chapter transitions

Production URL: https://libra-standalone-preview.vercel.app/
Canonical source: `feature/libra-standalone-v1`. Base: `21f647e8fb3e457c0b9b3fa9059767a82f302c61`.

The user reported a visible jump at EPUB chapter boundaries and when turning back. Their iPhone recording showed an intermediate page before the final layout. Backward navigation called `display(previous.href)` before moving to the previous chapter's last physical page, exposing its first page during asynchronous pagination. A sanitized, inert outgoing viewport now covers chapter loading, seeking and reflow until pagination settles. Ordinary within-chapter turns remain unchanged. The snapshot preserves iframe coordinates, publisher root variables and responsive CSS evaluated against the original iframe viewport. Reader DOM, quote anchors and CFIs remain untouched.

The user confirmed that FB2 could not be selected in iPhone Files. The extension-only file-input accept filter was removed so iOS does not grey out FB2 files without a registered UTI. App-level extension validation still rejects unsupported files. Importing uppercase `.FB2` with a generic binary MIME type is covered.

Unified oval four-action controls and position capsule are retained. Service-worker shell cache advances to `libra-shell-v7-ios-chapters`.

Verification: 104 unit tests pass; production build passes; 38 affected EPUB, typography, illustration and quote browser cases pass in iPhone-sized Chromium and WebKit after the final CSS fidelity fix. The broader earlier regression run passed 46 cases including large FB2, legacy encodings and chapter anchors. Original defects were reproduced by failing tests before correction. Review found a snapshot root-variable/media-query fidelity issue; the new fixture failed in both engines before correction and passes afterward.

No physical iPhone or native iOS Files picker was available. Automated file input selection does not substitute for that native picker check. Public `/release.json` identifies the deployed source commit. Publish the verified static build to the existing Vercel project; do not restore older reader panels or source branches.
