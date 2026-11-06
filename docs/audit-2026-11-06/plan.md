# Libra QA and security audit

Goal: audit and repair Libra while preserving the current November 6 published reader.
Base: 8d0fdb6, branch audit/libra-qa-security-20261106.

1. Inventory: compare typed source and recovered release; baseline unit, build, audit and current-release browser checks. Inspect deployed RLS/configuration read-only, never read user records.
2. Reproduce security/data-integrity defects with isolated fixtures; write failing regression tests before each minimal fix. Inspect dependency advisories and update affected development packages.
3. Add glass footnote overlay, tap interception, same-book target resolution, keyboard close/focus recovery, without altering text geometry. Exercise FB2 and EPUB with malicious note text and offline reopening.
4. Retest source and recovered release independently. Three cycles: baseline, remediation, final regression. Record measured timings and all failures.
5. Deliver defect register, separate security report, evidence and changed files in this repository. Push an audit branch/PR; do not recommend production release unless all high findings are fixed in the actual build.

Constraints: no production mutation/active pentest, no user records, no destructive tests, preserve IndexedDB/original files, auth, offline architecture, current theme and controls.

Review focus: stale downloads over newer local edits; tombstones over offline edits; account switch during async work; untrusted XML/EPUB and note markup; physical-page restoration and first tap.

Scope ruling: current release has no matching typed source in GitHub. Keep source fixes separate from release overlay changes; do not deploy the older source as a replacement.
