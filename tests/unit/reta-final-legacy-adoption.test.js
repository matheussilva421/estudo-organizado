import { describe, expect, it } from 'vitest';
import { migrateRetaFinalV2 } from '../../src/js/logic/reta-final-schema.js';
import {
  assessLegacyRetaFinalWrite,
  buildLegacyRetaFinalAdoption,
  isLegacyRetaFinalPlan,
} from '../../src/js/sync/reta-final-legacy.js';
import { mergeStudyStates } from '../../src/js/sync/sync-center.js';

const BLOCK_COUNT = 180;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function civilDate(index) {
  const base = Date.UTC(2026, 8, 1);
  return new Date(base + (index % 100) * 86400000).toISOString().slice(0, 10);
}

function legacyRetaFinalPlan({ blocks = BLOCK_COUNT, ativo = true } = {}) {
  const blocos = [];
  for (let index = 0; index < blocks; index += 1) {
    const data = civilDate(index);
    blocos.push({
      id: `rf_${String(index).padStart(3, '0')}`,
      data,
      dataOriginal: data,
      discId: `disc_${index % 3}`,
      topicos: [{ assId: `ass_${index % 5}`, aulaId: null }],
      minutos: 45 + (index % 3) * 15,
      status: index % 9 === 0 ? 'concluido' : 'pendente',
      rolagens: 0,
      ...(index % 11 === 0 ? { notas: `Nota sintetica ${index}` } : {}),
    });
  }
  return {
    ativo,
    tipo: 'reta_final',
    disciplinas: ['disc_0', 'disc_1', 'disc_2'],
    relevancia: {},
    horarios: { dataFinal: '2026-12-20' },
    materiasPorDia: 3,
    sequencia: [],
    skippedSlots: [],
    slotOverrides: [],
    ciclosCompletos: 1,
    dataInicioCicloAtual: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-10-22T17:45:50.000Z',
    retaFinal: {
      nome: 'Reta Final sintetica',
      dataFinal: '2026-12-20',
      minutosPadrao: 60,
      importadoEm: '2026-09-01T12:00:00.000Z',
      blocos,
    },
  };
}

function localV2From(legacy, planId = 'rfplan_local') {
  const migration = migrateRetaFinalV2(clone(legacy), {
    makePlanId: () => planId,
  });
  if (!migration.changed) throw new Error('fixture nao migrou');
  return migration.plan;
}

describe('reta-final legacy adoption', () => {
  it('adopts the migrated local copy of a 180-block legacy planning', () => {
    const legacy = legacyRetaFinalPlan();
    const local = localV2From(legacy);

    const result = buildLegacyRetaFinalAdoption({
      legacyPlan: legacy,
      localPlan: local,
    });

    expect(result.status).toBe('equivalent');
    expect(result.plan).toMatchObject({
      planId: 'rfplan_local',
      revision: 0,
      schemaVersionRetaFinal: 2,
      ativo: true,
    });
    expect(result.plan.retaFinal.blocos).toHaveLength(180);
    expect(result.plan.retaFinal.blocos[0].dataPlanejada).toBe(
      result.plan.retaFinal.blocos[0].dataOriginal
    );
    expect(result.plan.retaFinal.blocos[179].ordem).toBe(179);
  });

  it('ignores derived projections, v2 bookkeeping and revision metadata', () => {
    const legacy = legacyRetaFinalPlan();
    const local = localV2From(legacy);
    local.revision = 7;
    local.updatedAt = '2026-10-26T12:00:00.000Z';
    local.operations = [{ operationId: 'op_1' }];
    local.pendingOperations = [];
    local.operationIds = ['op_1'];
    local.retaFinal.blocos[3] = {
      ...local.retaFinal.blocos[3],
      status: 'atrasado',
      data: '2026-10-26',
      dataEfetiva: '2026-10-26',
      categoriaTemporal: 'atrasado',
      naoAlocado: false,
      concluido: false,
      atrasoDias: 4,
      rolagens: 2,
    };

    const result = buildLegacyRetaFinalAdoption({
      legacyPlan: legacy,
      localPlan: local,
    });

    expect(result.status).toBe('equivalent');
  });

  it('blocks adoption when a block changed its intent fields', () => {
    const legacy = legacyRetaFinalPlan();
    const local = localV2From(legacy);
    local.retaFinal.blocos[10] = {
      ...local.retaFinal.blocos[10],
      minutos: 90,
      notas: 'Editado localmente',
    };

    const result = buildLegacyRetaFinalAdoption({
      legacyPlan: legacy,
      localPlan: local,
    });

    expect(result.status).toBe('mismatch');
    expect(result.differences.join('\n')).toContain('retaFinal.blocos.rf_010.minutos');
    expect(result.differences.join('\n')).toContain('retaFinal.blocos.rf_010.notas');
  });

  it('blocks adoption when a block exists on only one side', () => {
    const legacy = legacyRetaFinalPlan();
    const local = localV2From(legacy);
    local.retaFinal.blocos.pop();

    const missingLocal = buildLegacyRetaFinalAdoption({
      legacyPlan: legacy,
      localPlan: local,
    });
    expect(missingLocal.status).toBe('mismatch');
    expect(missingLocal.differences.join('\n')).toContain('rf_179');

    const extraLocal = localV2From(legacy);
    extraLocal.retaFinal.blocos.push({
      ...extraLocal.retaFinal.blocos[0],
      id: 'rf_extra',
    });
    const extra = buildLegacyRetaFinalAdoption({
      legacyPlan: legacy,
      localPlan: extraLocal,
    });
    expect(extra.status).toBe('mismatch');
    expect(extra.differences.join('\n')).toContain('rf_extra');
  });

  it('blocks adoption when the planning was rescheduled or retired', () => {
    const legacy = legacyRetaFinalPlan();
    const rescheduled = localV2From(legacy);
    rescheduled.retaFinal.blocos[2] = {
      ...rescheduled.retaFinal.blocos[2],
      dataPlanejada: '2026-12-01',
    };
    expect(
      buildLegacyRetaFinalAdoption({
        legacyPlan: legacy,
        localPlan: rescheduled,
      }).status
    ).toBe('mismatch');

    const retired = localV2From(legacy);
    retired.ativo = false;
    expect(buildLegacyRetaFinalAdoption({ legacyPlan: legacy, localPlan: retired }).status).toBe(
      'mismatch'
    );
  });

  it('rejects partial or ambiguous v2 metadata instead of guessing', () => {
    const legacy = legacyRetaFinalPlan();
    const local = localV2From(legacy);
    const ambiguous = { ...clone(legacy), planId: 'rfplan_other' };

    expect(isLegacyRetaFinalPlan(ambiguous)).toBe(false);
    expect(buildLegacyRetaFinalAdoption({ legacyPlan: ambiguous, localPlan: local }).status).toBe(
      'ambiguous'
    );

    const invalid = clone(legacy);
    invalid.retaFinal.blocos[0].discId = '';
    expect(buildLegacyRetaFinalAdoption({ legacyPlan: invalid, localPlan: local }).status).toBe(
      'invalid-legacy'
    );
  });

  it('does not treat a v2 plan as legacy input', () => {
    const legacy = legacyRetaFinalPlan();
    const local = localV2From(legacy);
    expect(isLegacyRetaFinalPlan(local)).toBe(false);
    expect(buildLegacyRetaFinalAdoption({ legacyPlan: local, localPlan: local }).status).toBe(
      'not-legacy'
    );
  });

  it('keeps academic data from both sides while the local v2 plan stays intact', () => {
    const legacy = legacyRetaFinalPlan();
    const local = localV2From(legacy);
    const adoption = buildLegacyRetaFinalAdoption({
      legacyPlan: legacy,
      localPlan: local,
    });
    const localState = {
      planejamento: local,
      eventos: [
        {
          id: 'ev_local',
          discId: 'disc_0',
          status: 'estudei',
          tempo: 30,
          notas: 'local',
          updatedAt: '2026-10-24T10:00:00.000Z',
        },
      ],
      editais: [{ id: 'edital_1', nome: 'TJPB', updatedAt: '2026-10-01T00:00:00.000Z' }],
      revisoes: [{ id: 'rev_1', discId: 'disc_1', updatedAt: '2026-10-02T00:00:00.000Z' }],
      arquivo: [],
      habitos: { questoes: [{ id: 'q_1', total: 20 }] },
      syncTombstones: [],
      config: { localBackupAt: '2026-10-24T10:00:00.000Z' },
    };
    const remotePayload = {
      eventos: [
        {
          id: 'ev_remote',
          discId: 'disc_2',
          status: 'estudei',
          tempo: 45,
          notas: 'remoto',
          updatedAt: '2026-10-23T10:00:00.000Z',
        },
      ],
      editais: [],
      revisoes: [{ id: 'rev_2', discId: 'disc_2', updatedAt: '2026-10-03T00:00:00.000Z' }],
      arquivo: [],
      habitos: { questoes: [{ id: 'q_2', total: 10 }] },
      syncTombstones: [],
    };

    const merged = mergeStudyStates(localState, remotePayload);

    expect(adoption.status).toBe('equivalent');
    expect(merged.planejamento).toBe(local);
    expect(merged.planejamento.retaFinal.blocos).toHaveLength(180);
    expect(merged.eventos.map((item) => item.id).sort()).toEqual(['ev_local', 'ev_remote']);
    expect(merged.eventos.find((item) => item.id === 'ev_remote').notas).toBe('remoto');
    expect(merged.editais.map((item) => item.id)).toEqual(['edital_1']);
    expect(merged.revisoes.map((item) => item.id).sort()).toEqual(['rev_1', 'rev_2']);
    expect(merged.habitos.questoes.map((item) => item.id).sort()).toEqual(['q_1', 'q_2']);
    expect(merged.config.syncMergeConflicts).toBeUndefined();
  });

  it('allows a v2 adoption write only over an equivalent legacy planning', () => {
    const legacy = legacyRetaFinalPlan();
    const local = localV2From(legacy);
    const remoteEnvelope = {
      version: 1,
      payloadUpdatedAt: '2026-10-22T17:45:50.000Z',
      payload: { planejamento: legacy },
    };

    expect(assessLegacyRetaFinalWrite({ plan: local, remoteEnvelope })).toMatchObject({
      allowed: true,
      reason: 'legacy-equivalent',
    });

    const divergent = clone(local);
    divergent.retaFinal.blocos[10].minutos += 15;
    const denied = assessLegacyRetaFinalWrite({
      plan: divergent,
      remoteEnvelope,
    });
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('mismatch');
    expect(denied.differences.join('\n')).toContain('retaFinal.blocos.rf_010.minutos');
  });

  it('allows writes when the remote has no Reta Final plan to protect', () => {
    const local = localV2From(legacyRetaFinalPlan());
    expect(assessLegacyRetaFinalWrite({ plan: local, remoteEnvelope: null })).toMatchObject({
      allowed: true,
      reason: 'no-remote',
    });
    expect(
      assessLegacyRetaFinalWrite({
        plan: local,
        remoteEnvelope: {
          payload: { planejamento: { ativo: true, tipo: 'sequencia' } },
        },
      })
    ).toMatchObject({ allowed: true, reason: 'no-reta-plan' });
  });
});
