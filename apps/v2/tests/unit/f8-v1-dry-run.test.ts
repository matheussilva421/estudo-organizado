import { describe, expect, it, vi } from 'vitest';
import { auditLegacyV1DryRun } from '../../src/platform/legacy/v1-dry-run';

type Fixture = {
  schemaVersion: number;
  idbVersion: number;
  editais: Array<Record<string, unknown>>;
  eventos: Array<Record<string, unknown>>;
  habitos: { questoes: Array<Record<string, unknown>> };
  retaFinal: { blocos: Array<Record<string, unknown>> };
};

function validFixture(): Fixture {
  return {
    schemaVersion: 12,
    idbVersion: 7,
    editais: [{ id: 'edital-1', nome: 'Synthetic edital' }],
    eventos: [{ id: 'evento-1', editalId: 'edital-1', duracaoMin: 45 }],
    habitos: { questoes: [{ id: 'questao-1', eventoId: 'evento-1', acertos: 3 }] },
    retaFinal: {
      blocos: [
        { id: 'bloco-1', disciplinaId: 'disc-1', planoRemoto: { id: 'remote-1' } },
        { id: 'bloco-2', disciplinaId: 'disc-2', planoRemoto: { id: 'remote-2' } },
      ],
    },
  };
}

describe('F8 V1 dry-run audit', () => {
  it('reports zero structural losses for a complete synthetic fixture', async () => {
    const report = await auditLegacyV1DryRun(validFixture());
    expect(report.status).toBe('ZERO_LOSS_CANDIDATE');
    expect(report.counts).toEqual({ editais: 1, events: 1, questions: 1, blocks: 2, total: 5 });
    expect(report.losses).toBe(0);
    expect(report.issues).toEqual([]);
    expect(report.inputChecksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('quarantines duplicate ids and reports ambiguity', async () => {
    const fixture = validFixture();
    fixture.retaFinal.blocos.push({ ...fixture.retaFinal.blocos[0]! });
    const report = await auditLegacyV1DryRun(fixture);
    expect(report.status).toBe('AMBIGUOUS');
    expect(report.duplicates).toBe(1);
    expect(report.losses).toBeGreaterThan(0);
  });

  it('detects orphan references and missing remote plan identities', async () => {
    const fixture = validFixture();
    fixture.eventos[0]!.editalId = 'missing-edital';
    fixture.retaFinal.blocos[0]!.planoRemoto = undefined;
    const report = await auditLegacyV1DryRun(fixture);
    expect(report.status).toBe('AMBIGUOUS');
    expect(report.orphans).toBe(1);
    expect(report.issues.some((issue) => issue.code === 'MISSING_REMOTE_PLAN')).toBe(true);
  });

  it('marks unsupported IDB versions invalid', async () => {
    const report = await auditLegacyV1DryRun({ ...validFixture(), idbVersion: 5 });
    expect(report.status).toBe('INVALID');
    expect(report.issues.some((issue) => issue.code === 'UNSUPPORTED_IDB_VERSION')).toBe(true);
  });

  it('never uses the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('network must not be used');
    });
    try {
      await auditLegacyV1DryRun(validFixture());
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
