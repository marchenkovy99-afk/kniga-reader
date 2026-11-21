import {describe, expect, it} from 'vitest';
import {previewCloudSync, type SyncRecord} from '../cloudSyncPlan';

const checksum = (digit: string) => digit.repeat(64);
const row = (id: string, sha256 = checksum('a'), extra: Partial<SyncRecord> = {}): SyncRecord =>
 ({id, sha256, ...extra});

describe('non-destructive cloud sync preflight', () => {
 it('distinguishes uploads, downloads and genuinely identical books without mutating manifests', () => {
  const local = Object.freeze([row('same'), row('local')]);
  const remote = Object.freeze([row('remote'), row('same')]);
  const before = JSON.stringify([local, remote]);
  const result = previewCloudSync(local, remote);
  expect(result.requiresUserApproval).toBe(true);
  expect(result.decisions).toEqual([
   {id: 'local', action: 'upload', reason: 'local-only'},
   {id: 'remote', action: 'download', reason: 'remote-only'},
   {id: 'same', action: 'identical', reason: 'same-file-and-state'}
  ]);
  expect(result.counts).toEqual({upload: 1, download: 1, identical: 1, review: 0});
  expect(JSON.stringify([local, remote])).toBe(before);
 });

 it('never silently overwrites different source files for the same book ID', () => {
  const result = previewCloudSync([row('book', checksum('a'))], [row('book', checksum('b'))]);
  expect(result.decisions).toEqual([{id: 'book', action: 'review', reason: 'different-file'}]);
 });

 it('never silently overwrites conflicting reading positions or bookmarks', () => {
  const result = previewCloudSync(
   [row('book', checksum('a'), {stateDigest: checksum('1')})],
   [row('book', checksum('a'), {stateDigest: checksum('2')})]
  );
  expect(result.decisions).toEqual([{id: 'book', action: 'review', reason: 'different-reading-state'}]);
 });

 it('treats either deletion marker as manual review, including an offline local copy', () => {
  const now = '2026-10-30T10:00:00.000Z';
  expect(previewCloudSync([row('book')], [row('book', checksum('a'), {deletedAt: now})]).decisions)
   .toEqual([{id: 'book', action: 'review', reason: 'remote-deleted'}]);
  expect(previewCloudSync([row('book', checksum('a'), {deletedAt: now})], [row('book')]).decisions)
   .toEqual([{id: 'book', action: 'review', reason: 'local-deleted'}]);
  expect(previewCloudSync([], [row('book', checksum('a'), {deletedAt: now})]).decisions)
   .toEqual([{id: 'book', action: 'review', reason: 'remote-deleted'}]);
  expect(previewCloudSync([row('book', checksum('a'), {deletedAt: now})], [row('book', checksum('a'), {deletedAt: now})]).decisions)
   .toEqual([{id: 'book', action: 'review', reason: 'both-deleted'}]);
 });

 it('rejects duplicate IDs, malformed digests and untrusted server revisions', () => {
  expect(() => previewCloudSync([row('book'), row('book')], [])).toThrow(/Duplicate local/);
  expect(() => previewCloudSync([], [row('book', 'unknown')])).toThrow(/SHA-256/);
  expect(() => previewCloudSync([row('bad/path')], [])).toThrow(/book ID/);
  expect(() => previewCloudSync([], [row('book', checksum('a'), {revision: -1})])).toThrow(/revision/);
  expect(() => previewCloudSync([], [row('book', checksum('a'), {deletedAt: 'not-a-date'})])).toThrow(/timestamp/);
 });
});
