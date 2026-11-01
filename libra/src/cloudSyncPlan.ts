/**
 * Cloud synchronization preflight (no network or persistent side effects).
 *
 * A plan is intentionally descriptive. Applying it requires a dedicated
 * authenticated backend, the user's explicit opt-in, and a tested conflict UI.
 * In particular, a remote tombstone must never silently delete local bytes.
 */
export type SyncRecord = {
 id: string;
 sha256: string;
 /** A server-assigned revision, not a client-clock timestamp. */
 revision?: number;
 /** Deletion is a durable marker, never a direct file-removal command. */
 deletedAt?: string | null;
 /** Canonical serialized reading metadata, for conflict comparison only. */
 stateDigest?: string;
};

export type SyncDecision =
 | {id: string; action: 'upload'; reason: 'local-only'}
 | {id: string; action: 'download'; reason: 'remote-only'}
 | {id: string; action: 'identical'; reason: 'same-file-and-state'}
 | {id: string; action: 'review'; reason:
    'local-deleted' | 'remote-deleted' | 'different-file' | 'different-reading-state' | 'both-deleted'};

export type SyncPreview = {
 decisions: SyncDecision[];
 counts: Record<SyncDecision['action'], number>;
 /** Never treat this preflight as consent to sync or delete user data. */
 requiresUserApproval: true;
};

const HASH = /^[0-9a-f]{64}$/;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const REVISION_MAX = Number.MAX_SAFE_INTEGER;

function validate(record: SyncRecord, source: 'local' | 'remote'): void {
 if (!ID.test(record.id)) throw Error('Invalid ' + source + ' sync book ID');
 if (!HASH.test(record.sha256)) throw Error('Invalid ' + source + ' SHA-256');
 if (record.revision !== undefined &&
  (!Number.isSafeInteger(record.revision) || record.revision < 0 || record.revision > REVISION_MAX))
  throw Error('Invalid ' + source + ' server revision');
 if (record.deletedAt != null &&
  (typeof record.deletedAt !== 'string' || !Number.isFinite(Date.parse(record.deletedAt))))
  throw Error('Invalid ' + source + ' deletion timestamp');
 if (record.stateDigest !== undefined && !HASH.test(record.stateDigest))
  throw Error('Invalid ' + source + ' state digest');
}

function indexed(records: readonly SyncRecord[], source: 'local' | 'remote'): Map<string, SyncRecord> {
 const result = new Map<string, SyncRecord>();
 for (const item of records) {
  validate(item, source);
  if (result.has(item.id)) throw Error('Duplicate ' + source + ' sync book ID');
  result.set(item.id, item);
 }
 return result;
}

/**
 * Conservative and deterministic comparison of two independently prepared
 * manifests. The algorithm never modifies either input, local IndexedDB,
 * remote Storage or remotely synced reading positions.
 *
 * A real sync worker must additionally use optimistic concurrency checking
 * against the remote server revision and re-plan on any concurrent write.
 */
export function previewCloudSync(
 local: readonly SyncRecord[],
 remote: readonly SyncRecord[]
): SyncPreview {
 const a = indexed(local, 'local'), b = indexed(remote, 'remote');
 const decisions: SyncDecision[] = [];
 const counts: SyncPreview['counts'] = {upload: 0, download: 0, identical: 0, review: 0};
 for (const id of new Set([...a.keys(), ...b.keys()])) {
  const own = a.get(id), other = b.get(id);
  let decision: SyncDecision;
  if (own?.deletedAt && other?.deletedAt) {
   decision = {id, action: 'review', reason: 'both-deleted'};
  } else if (own?.deletedAt) {
   decision = {id, action: 'review', reason: 'local-deleted'};
  } else if (other?.deletedAt) {
   decision = {id, action: 'review', reason: 'remote-deleted'};
  } else if (!other) {
   decision = {id, action: 'upload', reason: 'local-only'};
  } else if (!own) {
   decision = {id, action: 'download', reason: 'remote-only'};
  } else if (own.sha256 !== other.sha256) {
   decision = {id, action: 'review', reason: 'different-file'};
  } else if (own.stateDigest !== other.stateDigest) {
   decision = {id, action: 'review', reason: 'different-reading-state'};
  } else {
   decision = {id, action: 'identical', reason: 'same-file-and-state'};
  }
  decisions.push(decision);
  counts[decision.action]++;
 }
 decisions.sort((x, y) => x.id.localeCompare(y.id, 'en'));
 return {decisions, counts, requiresUserApproval: true};
}
