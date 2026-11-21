# LIBRA cloud synchronization

Implemented 30 October 2026. Supabase project `qwnkigorqsgugcctnfmj` (Trecker) hosts new, isolated `public.libra_records` and private `libra-files` resources. Existing `kniga_*`, lawyer and fitness tables, existing Storage and authentication configuration were inspected and left unchanged. No legacy reader data is automatically imported.

## Behavior

- Settings → Cloud accepts email/password sign-in or account creation. If signup requires confirmation, confirm the email and then return to sign in; no custom redirect URL is assumed.
- First connection explicitly attaches unowned device books. Existing books belonging to another account never attach automatically. Later imports are queued for the connected account.
- Original bytes remain in IndexedDB. IDB v3 adds account bindings, server revisions and durable pending entries. Book, progress, bookmark and setting writes queue in the same local transaction.
- A worker mounted at App level syncs after local changes (1.5-second debounce), network reconnection, foregrounding and every 30 seconds while visible. Reading and offline use continue when refresh/auth/network requests fail.
- SHA-256-addressed uploads are immutable; downloads must match the metadata size and SHA-256 before local application. Books are limited to 50 MiB per file.
- The compare-and-set RPC rejects stale server revisions. Simultaneous edits remain pending and show a choice between the device and cloud versions. Selecting one replaces the whole book's reading metadata or the whole settings record; automatic per-bookmark merging is not claimed.
- Deletions create permanent server tombstones. Another device hides the book but retains its downloaded bytes in IndexedDB. Tombstoned IDs are never reuploaded. No remote object garbage collection is enabled.
- Signing out hides account books and keeps their bytes. The UI explains that sign-in is needed to regain access. Auth refresh failures alone do not hide offline books. Reader settings are stored separately for each account.

## Backend security and evidence

Migration: `supabase/migrations/20261030103156_libra_private_sync.sql` was applied successfully through the connected Supabase tool.

- RLS is enabled, with `auth.uid() = user_id` ownership and explicit authenticated grants. Anonymous table/function access is revoked.
- CAS uses `SECURITY INVOKER` with an empty search path; the server increments revisions. A trigger forbids owner/key changes, file-hash changes and revival of deleted rows.
- The private bucket permits authenticated reads/inserts only under the user's UUID. There is no client overwrite or deletion policy; the preexisting bucket's policies are restricted to its own bucket.
- Rollback-only SQL transactions with two synthetic auth identities passed: cross-account insert/read/CAS denial; anonymous table/RPC denial; private Storage listing and cross-owner upload denial; stale CAS rejection; durable tombstone rejection. No test identities or objects were retained.
- Security advisors reported no Libra table/function/RLS findings. The existing project has leaked-password protection disabled; enabling it is an independent auth configuration decision: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Automated checks and acceptance limits

`cloud-storage.test.ts` exercises real IndexedDB behavior with fake-indexeddb: local-byte preservation, account scoping, offline outbox, deletion markers, generation-aware acknowledgements and per-account settings. `cloud-sync.test.ts` uses the real sync engine with an injected in-memory transport to exercise two-device book/bookmark/settings transfer, stale conflicts, permanent tombstones and corrupt download rejection.

`e2e/cloud-sync.spec.ts` is a browser integration test using two isolated contexts and mocked Supabase HTTP responses. It covers UI sign-in/opt-in, transfer, bookmarks, offline changes/reconnection and sign-out privacy. Its current browser execution evidence belongs to CI; authoring the test alone does not establish a pass.

Real-user authentication across two physical devices, actual email delivery/confirmation, installed iOS PWA offline lifecycle, quota exhaustion and production-scale libraries remain acceptance work. No claim is made that these were exercised using the user's identity.
