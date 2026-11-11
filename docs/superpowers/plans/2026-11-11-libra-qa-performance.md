# Libra QA and performance implementation plan

> Execute inline, preserving the current production source. Specification: docs/engineering/Libra_QA_Performance_Specification_EN.md.

Goal: execute the approved full QA specification, fix proven defects, and record evidence and unavailable environments honestly.

Baseline: production f930710bbda0e048cd459edf301ea7be677bfe05, revision 23; separate clone and qa/full-performance-20261111 branch. Never substitute main or the old Sites deployment. Do not touch personal data or weaken authentication.

- [x] Inventory source and existing tests. Baseline release suite: 53/53; core integrity verifier: PASS.
- [x] Measure single-chapter indexing: 100k/500k/2m characters block synchronously for 70/339/783 ms on the current executor. This does not measure physical iPhone performance.
- [ ] Add failing cooperative-index tests, preserve exact UTF-16 mappings and DOM node identity, and test abort during a single long chapter. Implement createTextIndexAsync(units, {signal, yieldTask}) using bounded work with event-loop yields; use it for both production adapters. Yield during large CFI result conversion too.
- [ ] Run all release tests and integrity/offline checks. Pin regenerated offline assets after source changes; preserve stored books and account data.
- [ ] Exercise production UI with disposable FB2/EPUB data. Check navigation, search Return/Close, settings, position restoration, quotations/bookmarks and footnotes where available. Run dedicated test scenarios on an isolated preview if required.
- [ ] Measure before/after indexing responsiveness; record limitations of host/browser measurements and leave physical iPhone and two-device sync acceptance open if unavailable.
- [ ] Record coverage, bugs, changes, build, results and unresolved work; review complete diff and prepare reviewable changes with preview where available. Do not call the entire specification complete while mandatory acceptance is unverified.

Review focus: surrogate pairs at chunk edges; whitespace and soft hyphens across boundaries; stale work after close or book replacement; original EPUB node identity for CFIs; offline asset hashes after source modifications.

Ruling: a separate clone provides isolation without changing the user's existing checkout. The task is already authorized; execute without another planning approval.
