import { describe, expect, it } from 'vitest';
import {
  estimateF2Budget,
  estimateRemoteEnvelopeBytes,
  MAX_SAFE_DOCUMENT_BYTES,
  SPARK_DAILY_WRITE_PREMISE,
  validateRemoteDocument,
} from '../../src/platform/sync/document-budget';

describe('F2 Firestore budget (synthetic)', () => {
  it('fake_multiclient_contract_does_not_claim_spark_quota', () => {
    // 3 clientes x 7.840 documentos x 1 gravação = 23.520 escritas/dia.
    const scenario = estimateF2Budget(7_840, 3, 1);

    expect(scenario.entities).toBe(7_840);
    expect(scenario.writesPerDay).toBe(23_520);
    expect(scenario.sparkPremise).toBe(SPARK_DAILY_WRITE_PREMISE);
    expect(scenario.exceedsSparkPremise).toBe(true);
    // The premise is an analytical budget, never a billed quota.
    expect(scenario.isBillingMeasurement).toBe(false);
    expect(scenario.recommendation).toContain('seed único');

    // A single seed for the whole account stays inside the premise.
    const seeded = estimateF2Budget(7_840, 1, 2);
    expect(seeded.writesPerDay).toBe(15_680);
    expect(seeded.exceedsSparkPremise).toBe(false);
  });

  it('document_ceiling_is_conservative_and_never_truncates', () => {
    expect(MAX_SAFE_DOCUMENT_BYTES).toBe(900_000);

    const realistic = {
      profileId: 'profile-local',
      entityType: 'assunto',
      entity: {
        id: 'assunto-1',
        profileId: 'profile-local',
        editalDisciplineId: 'link-1',
        parentId: null,
        parentKey: '',
        title: 'Controle de constitucionalidade',
        orderKey: '000010',
        localRevision: 3,
        provenance: 'a'.repeat(64),
      },
    };
    expect(estimateRemoteEnvelopeBytes(realistic)).toBeLessThan(MAX_SAFE_DOCUMENT_BYTES);
    expect(validateRemoteDocument(realistic)).toMatchObject({ ok: true });

    const oversize = { id: 'x', payload: 'y'.repeat(MAX_SAFE_DOCUMENT_BYTES + 10) };
    const rejected = validateRemoteDocument(oversize);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.reason).toBe('OVERSIZE');
    // Rejection is explicit: nothing is truncated to fit.
    expect(JSON.stringify(oversize).length).toBeGreaterThan(MAX_SAFE_DOCUMENT_BYTES);
  });

  it('f2_t22_emulator_gate_stays_not_run', () => {
    // Documented gate: no emulator, SDK or Rules were installed or executed.
    const gate = {
      id: 'F2-T22',
      state: 'NOT_RUN',
      reason: 'F2_EMULATOR_NOT_AUTHORIZED',
      proves: 'contrato fake apenas; nada sobre Google Auth, Rules ou quota real',
    };
    expect(gate.state).toBe('NOT_RUN');
    expect(gate.reason).toBe('F2_EMULATOR_NOT_AUTHORIZED');
  });
});
