# Libra release: FB2, illustrations, typography and floating capsules

Production: https://libra-standalone-preview.vercel.app/

Canonical source branch: `feature/libra-standalone-v1`.
Verified code commit: `c47d08dbdb878644c3a4a1bfa597508a9e07fb3b`.
Code tree: `5e78f76e86ce77ae02a1673f5047039cc8b1f64f`.
Vercel project: `prj_iI4zMb2wQcXHRcEGR2iVDIAVmx0k`, team `team_7npIzWiAnWNm56uAuTUbfnMV`.
Production deployment: `dpl_ChA6zUUTsyivbVb3jVBBXkeYH49D`.

The previous production deployment came from older source and did not contain `.reading-position-capsule` or the unified four-action oval controls. This release starts from the latest design branch (base `4dd0282`) and retains that design. Do not restore the older reader CSS/components while making subsequent updates. Confirm the live `/release.json` and inspect the live JS/CSS when establishing a future baseline.

Changes: FB2 safe inline formatting and internal notes; unchanged legacy block indices and legacy flat-offset quote/bookmark restoration; original-colour raster/SVG illustration surfaces and zoom/pan viewer; user font precedence over publisher CSS including inline !important, with symbol/MathML/SVG preservation; image decoding before FB2 page measurement; physical EPUB page restoration only for an identical layout; safer EPUB import/renderer cleanup and bounded damaged-file loading. Service-worker cache: `libra-shell-v6-media`.

Validation: `npm test` passed 102 tests; `npm run build` passed; 42 relevant browser scenarios passed in mobile Chromium/WebKit; two production-build standalone-startup scenarios passed. Chromium additionally passed offline reload with persisted font/position and images. WebKit startup was tested with networking enabled because its automation offline mode rejects service-worker navigation. No physical iPhone verification was performed.

The deployment contains the locally verified static `libra/dist` output. Git-source deployment failed with `git_info_fail`, so the same verified static files were uploaded through the existing Vercel project. Public `/release.json` records the code commit and source branch. All three existing Vercel aliases point to this release.
