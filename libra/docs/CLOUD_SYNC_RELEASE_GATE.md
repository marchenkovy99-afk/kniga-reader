# LIBRA cloud sync: safety gate and implementation plan

**Status: design and deterministic local preflight only. Cloud sync is NOT enabled.**
No existing Supabase database, Storage bucket, user, book, setting or progress was modified.

## Verified scope (30 October 2026)

- The connected Supabase account currently exposes only an existing project that is **not identified as LIBRA**.
- LIBRA itself is a local-first standalone application using IndexedDB.
- A dedicated Supabase project must be chosen or provisioned before any SQL is applied.
- `src/cloudSyncPlan.ts` compares local and remote manifests without writing to either.
- `supabase/schema-draft.sql` is a proposed schema, **not a deployed migration**.

## Release phases

1. **Provision dedicated backend:** verify owner, project name, region, allowed authentication methods, quotas, and production URL. Do not reuse the legacy reader's or another product's database.
2. **Review and apply schema:** use `schema-draft.sql` only after a separate project and independent database backup exist. Deploy the private bucket; confirm anon cannot read, authenticated A cannot read or change B's records or objects, cross-owner inserts fail, and owner updates require expected revision.
3. **Authenticated opt-in:** sign-in, clear account state, explicit choice to upload local library; do not upload automatically on first launch or first sign-in.
4. **Safe initial upload:** compute SHA-256 over original bytes before network transfer, upload immutable content-addressed objects, verify downloaded bytes, then publish metadata with server-managed revision. Store a durable local pending queue and retry idempotently after offline periods. Keep original IndexedDB blobs.
5. **Reading-state synchronization:** bookmarks and progress are separate from immutable book files; use optimistic concurrency against server revision. If remote and local values differ, show a review choice and never replace a newer local passage without consent.
6. **Deletions:** represent removal as a tombstone with retention. Remote tombstones cannot automatically erase local files. Confirm deletion and verification on every device before any eventual GC.
7. **Legacy migration:** first inspect the exact old reader schema and current user data. Offer dry run and local backup; import a copy rather than destructive takeover. Do not combine unrelated projects or merge identity namespaces.
8. **Acceptance and launch:** test two users, two devices, offline edits, simultaneous changes, session expiry, large files, reconnect, failed upload, reinstalled PWA, interrupted restore, and repeated deletion; verify signed-out privacy, RLS and Storage policies. Only then enable sync for users.

## Conflict-preview semantics

| Case | Preview decision | Safety rule |
| --- | --- | --- |
| Local-only file | Upload proposal | Explicit opt-in first |
| Remote-only file | Download proposal | Check local quota and SHA-256 |
| Same file and reading-state digests | No action | Still compare remote revisions before writes |
| Same ID, different book hashes | Manual review | Never overwrite source bytes |
| Same book, different progress/bookmarks | Manual review | Never silently rewind |
| Tombstone on either side | Manual review | No silent deletion |

The local preflight is **not an uploader**, a conflict-resolution UI, or a substitute for access control. It intentionally rejects malformed/duplicate manifest entries.

## Privacy and security constraints

- Public bucket access is prohibited; use user JWT and private Storage RLS.
- `auth.uid()` is the only row ownership basis; never trust a client-provided owner ID or editable profile metadata.
- Only a publishable key may appear in a browser build. Never expose a secret/service-role key.
- Storage paths are rooted at the authenticated user's UUID. Content is immutable once uploaded.
- No enabled client code may read or write LIBRA remote records before the dedicated environment is configured and validated.
- Require an audit of database grants, RLS, cross-user access, CORS, token expiry, download integrity and quotas before launch.

## Documentation references

- [Private buckets and authenticated downloads](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Storage access policies](https://supabase.com/docs/guides/storage/security/access-control)
- [Row level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
