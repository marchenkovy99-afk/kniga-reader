# Libra interface refinement

Approved direction: the user's instruction to implement the preceding interface review. Keep the warm paper palette, restrained coral accent, existing vanilla JS/Vite reader, source anchors, offline storage and cloud isolation.

Implement: safe fixed reading header without chrome-dependent reflow; return point after intentional jumps; legible progress; consistent Libra branding; library/saved/settings navigation; planned filter, sorting, two-column default and compact grid; persistent shelf UI; searchable saved quotes/bookmarks; chapter tabs; contextual highlighted search; scoped appearance reset, explicit defaults, font samples, equal theme tiles with system switch; grouped book details and accurate empty states.

Approach: targeted changes around the existing reader. Rewriting the app or replacing pagination/gesture engines increases regression risk without helping this scope. Keep existing tap/swipe mechanics; do not add a new curl engine or promise physical-device verification.

Limits: browser QA can verify the cloud browser, not a physical iPhone. Authentication and synchronization internals are unchanged. Existing installed shortcut names may require reinstalling the shortcut to pick up manifest branding.
