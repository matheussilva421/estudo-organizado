import { describe, expect, it } from 'vitest';
import {
  estimateIncrementalWriteBytes,
  estimateRemoteEnvelopeBytes,
  estimateWorkload,
  MAX_SAFE_DOCUMENT_BYTES,
  validateRemoteDocument,
} from '../../src/platform/sync/document-budget';

describe('Firestore document budget', () => {
  it('oversize_remote_entity_is_rejected_without_truncation', () => {
    const record = { id: 's1', title: 'x'.repeat(MAX_SAFE_DOCUMENT_BYTES) };
    const before = JSON.stringify(record);
    const result = validateRemoteDocument(record);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected oversize rejection');
    expect(result.reason).toBe('OVERSIZE');
    expect(result.bytes).toBeGreaterThan(MAX_SAFE_DOCUMENT_BYTES);
    expect(JSON.stringify(record)).toBe(before);
  });

  it('utf8_multibyte_counts_bytes', () => {
    const ascii = estimateRemoteEnvelopeBytes({ title: 'a' });
    const accented = estimateRemoteEnvelopeBytes({ title: 'á' });

    expect(accented).toBe(ascii + 1);
  });

  it('single_entity_edit_does_not_resend_archive', () => {
    const entity = { id: 's1', title: 'Direito' };
    const snapshot = { entities: [entity], archive: ['x'.repeat(50_000)] };

    expect(estimateIncrementalWriteBytes(entity)).toBe(estimateRemoteEnvelopeBytes(entity));
    expect(estimateIncrementalWriteBytes(entity)).toBeLessThan(
      estimateRemoteEnvelopeBytes(snapshot),
    );
  });

  it('three_device_budget_has_explicit_cost_assumptions', () => {
    const budget = estimateWorkload(10, 3, 5);

    expect(budget.writesPerDay).toBe(15);
    expect(budget.readsPerDay).toBe(30);
    expect(budget.indexEntries).toBe(10);
    expect(budget.maxDocumentBytes).toBe(MAX_SAFE_DOCUMENT_BYTES);
    expect(budget.assumptions.length).toBeGreaterThanOrEqual(3);
    expect(budget.assumptions.join(' ')).toContain('3 dispositivos');
  });
});
