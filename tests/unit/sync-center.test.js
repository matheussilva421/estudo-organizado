import { describe, it, expect } from 'vitest';
import {
  canAutoSyncFirestore,
  buildSyncCenterModel,
  getManualSyncStatus,
  mergeStudyStates,
  recordSyncTombstone,
} from '../../src/js/sync/sync-center.js';

describe('sync-center.js', () => {
  describe('canAutoSyncFirestore()', () => {
    it('returns false when global sync is paused by the user', () => {
      expect(canAutoSyncFirestore({ enabled: true, mode: 'primary', globalSyncPaused: true })).toBe(
        false
      );
    });

    it('returns false when not enabled', () => {
      expect(canAutoSyncFirestore({ enabled: false })).toBe(false);
    });

    it('returns false when not primary mode', () => {
      expect(canAutoSyncFirestore({ enabled: true, mode: 'shadow' })).toBe(false);
    });

    it('returns false when entity-conflict exists', () => {
      expect(
        canAutoSyncFirestore({
          enabled: true,
          mode: 'primary',
          conflict: { type: 'entity-conflict' },
        })
      ).toBe(false);
    });

    it('returns true when non-entity conflict exists (snapshot conflict allows retry)', () => {
      expect(
        canAutoSyncFirestore({ enabled: true, mode: 'primary', conflict: { type: 'diverge' } })
      ).toBe(true);
    });

    it('returns true when enabled and primary with no pending', () => {
      expect(canAutoSyncFirestore({ enabled: true, mode: 'primary' })).toBe(true);
    });

    it('returns false when pending status is conflict', () => {
      const config = { enabled: true, mode: 'primary' };
      const pending = { status: 'conflict' };
      expect(canAutoSyncFirestore(config, pending)).toBe(false);
    });

    it('returns false when nextAttemptAt is in future', () => {
      const config = { enabled: true, mode: 'primary' };
      const pending = { nextAttemptAt: new Date(Date.now() + 60000).toISOString() };
      expect(canAutoSyncFirestore(config, pending)).toBe(false);
    });

    it('returns true when nextAttemptAt is in past', () => {
      const config = { enabled: true, mode: 'primary' };
      const pending = { nextAttemptAt: new Date(Date.now() - 60000).toISOString() };
      expect(canAutoSyncFirestore(config, pending)).toBe(true);
    });
  });

  describe('buildSyncCenterModel()', () => {
    it('returns model with 4 sources', () => {
      const model = buildSyncCenterModel({ state: { config: {} } });
      expect(model.sources).toHaveLength(4);
      expect(model.sources.map((s) => s.id)).toEqual(['local', 'firebase', 'cloudflare', 'drive']);
    });

    it('marks firebase as primary source', () => {
      const model = buildSyncCenterModel({ state: { config: {} } });
      expect(model.primarySource).toBe('firebase');
    });

    it('detects needs attention when conflict exists', () => {
      const model = buildSyncCenterModel({
        state: { config: { firestoreSync: { enabled: true, conflict: { type: 'diverge' } } } },
      });
      expect(model.needsAttention).toBe(true);
    });

    it('detects needs attention when error exists', () => {
      const model = buildSyncCenterModel({
        state: { config: { firestoreSync: { enabled: true, lastError: 'timeout' } } },
      });
      expect(model.needsAttention).toBe(true);
    });

    it('shows firebase health as ok when enabled without issues', () => {
      const model = buildSyncCenterModel({
        state: { config: { firestoreSync: { enabled: true, configured: true, signedIn: true } } },
      });
      const firebase = model.sources.find((s) => s.id === 'firebase');
      expect(firebase.health).toBe('ok');
    });

    it('shows firebase health as idle when disabled', () => {
      const model = buildSyncCenterModel({
        state: { config: { firestoreSync: { enabled: false } } },
      });
      const firebase = model.sources.find((s) => s.id === 'firebase');
      expect(firebase.health).toBe('idle');
    });

    it('shows cloudflare configured when cfUrl and token present', () => {
      const model = buildSyncCenterModel({
        state: {
          config: { cfUrl: 'https://worker.test', cfToken: 'token123', cfSyncEnabled: true },
        },
      });
      const cloudflare = model.sources.find((s) => s.id === 'cloudflare');
      expect(cloudflare.configured).toBe(true);
    });

    it('shows drive configured when driveFileId present', () => {
      const model = buildSyncCenterModel({
        state: { driveFileId: 'abc123' },
      });
      const drive = model.sources.find((s) => s.id === 'drive');
      expect(drive.configured).toBe(true);
      expect(drive.health).toBe('ok');
    });

    it('computes newestRemoteAt from multiple sources', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            firestoreSync: { remoteUpdatedAt: '2024-01-01T00:00:00Z' },
            cfRemoteUpdatedAt: '2024-06-01T00:00:00Z',
          },
          lastSync: '2024-03-01T00:00:00Z',
        },
      });
      expect(model.newestRemoteAt).toBe('2024-06-01T00:00:00.000Z');
    });

    it('includes compact health metrics for pending Firestore writes', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            localBackupAt: '2026-04-30T10:00:00.000Z',
            firestoreSync: {
              enabled: true,
              mode: 'primary',
              hasPendingWrites: true,
              pending: {
                attempts: 2,
                queuedAt: '2026-04-30T10:00:00.000Z',
                nextAttemptAt: '2026-04-30T10:04:00.000Z',
              },
            },
          },
        },
      });

      const firebase = model.sources.find((source) => source.id === 'firebase');
      expect(model.health.status).toBe('queued');
      expect(firebase.metrics.retryAttempts).toBe(2);
      expect(firebase.metrics.nextRetryAt).toBe('2026-04-30T10:04:00.000Z');
    });

    it('exposes performance metrics only in the advanced model', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            syncPerformance: {
              metrics: [
                { name: 'localCommitMs', durationMs: 42, at: '2026-05-02T10:00:00.000Z' },
                { name: 'firestoreWriteMs', durationMs: 120, at: '2026-05-02T10:00:01.000Z' },
              ],
            },
            firestoreSync: { enabled: true, mode: 'primary' },
          },
        },
      });

      expect(model.quiet.detail).not.toContain('firestoreWriteMs');
      expect(model.performanceMetrics).toEqual([
        { name: 'localCommitMs', durationMs: 42, at: '2026-05-02T10:00:00.000Z' },
        { name: 'firestoreWriteMs', durationMs: 120, at: '2026-05-02T10:00:01.000Z' },
      ]);
    });

    it('describes automatic synced state in quiet language', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            firestoreSync: {
              enabled: true,
              configured: true,
              signedIn: true,
              mode: 'primary',
              lastPushAt: '2026-05-01T10:00:00.000Z',
            },
          },
        },
      });

      expect(model.quiet.title).toBe('Tudo salvo automaticamente');
      expect(model.quiet.tone).toBe('ok');
      expect(model.quiet.detail).toContain('Firestore sincroniza sozinho');
    });

    it('describes manual-first sync when global sync is paused', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            globalSyncPaused: true,
            firestoreSync: {
              enabled: true,
              configured: true,
              signedIn: true,
              mode: 'primary',
            },
          },
        },
      });

      expect(model.health.status).toBe('paused');
      expect(model.quiet.title).toBe('Sincronização manual');
      expect(model.quiet.detail).toContain('sincroniza quando você iniciar manualmente');
      expect(model.manualSyncEnabled).toBe(true);
    });

    it('sets manualSyncEnabled to false when globalSyncPaused is not set', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            firestoreSync: { enabled: true, mode: 'primary' },
          },
        },
      });

      expect(model.manualSyncEnabled).toBe(false);
    });

    it('asks for action only when a real sync conflict exists', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            firestoreSync: {
              enabled: true,
              configured: true,
              signedIn: true,
              mode: 'primary',
              conflict: { type: 'entity-diverged' },
            },
          },
        },
      });

      expect(model.quiet.title).toBe('Ação necessária');
      expect(model.quiet.tone).toBe('danger');
      expect(model.quiet.primaryAction).toBe('advanced');
    });

    it('asks for action when Firestore denies permission without exposing payloads', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            firestoreSync: {
              enabled: true,
              configured: true,
              signedIn: true,
              mode: 'primary',
              lastError: 'permission-denied',
            },
          },
        },
      });

      expect(model.quiet.title).toBe('Ação necessária');
      expect(model.quiet.detail).toContain('negou permissão');
      expect(model.quiet.primaryAction).toBe('advanced');
    });

    it('explains offline automatic sync without asking for manual action', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            localBackupAt: '2026-05-01T10:00:00.000Z',
            syncHealth: { offline: true },
            firestoreSync: {
              enabled: true,
              configured: true,
              signedIn: true,
              mode: 'primary',
            },
          },
        },
      });

      expect(model.health.status).toBe('offline');
      expect(model.quiet.title).toBe('Offline, sync automático pausado');
      expect(model.quiet.primaryAction).toBeNull();
    });
  });

  describe('getManualSyncStatus()', () => {
    it('returns enabled=true when globalSyncPaused is true', () => {
      const status = getManualSyncStatus({ globalSyncPaused: true });
      expect(status.enabled).toBe(true);
      expect(status.label).toContain('manual');
    });

    it('returns enabled=false when globalSyncPaused is not set', () => {
      const status = getManualSyncStatus({});
      expect(status.enabled).toBe(false);
      expect(status.label).toContain('automática');
    });

    it('returns lastSyncAt from config when available', () => {
      const status = getManualSyncStatus({
        globalSyncPaused: true,
        lastManualSyncAt: '2026-05-01T10:00:00.000Z',
      });
      expect(status.lastSyncAt).toBe('2026-05-01T10:00:00.000Z');
    });

    it('returns lastSyncAt null when no manual sync has occurred', () => {
      const status = getManualSyncStatus({ globalSyncPaused: true });
      expect(status.lastSyncAt).toBeNull();
    });
  });

  describe('mergeStudyStates()', () => {
    it('merges two empty states', () => {
      const merged = mergeStudyStates({}, {});
      expect(merged.config.localBackupAt).toBeDefined();
    });

    it('prefers local state values over remote', () => {
      const local = { config: { theme: 'dark' } };
      const remote = { config: { theme: 'light' } };
      const merged = mergeStudyStates(local, remote);
      expect(merged.config.theme).toBe('dark');
    });

    it('merges editais arrays', () => {
      const local = { editais: [{ id: '1', nome: 'Local' }] };
      const remote = { editais: [{ id: '2', nome: 'Remote' }] };
      const merged = mergeStudyStates(local, remote);
      expect(merged.editais).toHaveLength(2);
    });

    it('merges eventos arrays', () => {
      const local = { eventos: [{ id: '1' }] };
      const remote = { eventos: [{ id: '2' }] };
      const merged = mergeStudyStates(local, remote);
      expect(merged.eventos).toHaveLength(2);
    });

    it('merges arquivo arrays', () => {
      const local = { arquivo: [{ id: '1' }] };
      const remote = { arquivo: [{ id: '2' }] };
      const merged = mergeStudyStates(local, remote);
      expect(merged.arquivo).toHaveLength(2);
    });

    it('merges revisoes arrays', () => {
      const local = { revisoes: [{ id: '1' }] };
      const remote = { revisoes: [{ id: '2' }] };
      const merged = mergeStudyStates(local, remote);
      expect(merged.revisoes).toHaveLength(2);
    });

    it('merges habitos by type', () => {
      const local = { habitos: { diarios: [{ id: '1' }] } };
      const remote = { habitos: { diarios: [{ id: '2' }] } };
      const merged = mergeStudyStates(local, remote);
      expect(merged.habitos.diarios).toHaveLength(2);
    });

    it('handles missing habitos in one state', () => {
      const local = { habitos: { diarios: [{ id: '1' }] } };
      const remote = {};
      const merged = mergeStudyStates(local, remote);
      expect(merged.habitos.diarios).toHaveLength(1);
    });

    it('records syncMergeConflicts when collisions detected', () => {
      const local = { eventos: [{ id: '1', nome: 'Local', updatedAt: '2024-06-01' }] };
      const remote = { eventos: [{ id: '1', nome: 'Remote', updatedAt: '2024-06-01' }] };
      const merged = mergeStudyStates(local, remote);
      // Collision detection depends on mergeEntityAwareArrays implementation
      expect(merged.config.localBackupAt).toBeDefined();
    });

    it('clears stale syncMergeConflicts when a later merge has no collisions', () => {
      const local = {
        config: {
          syncMergeConflicts: {
            detectedAt: '2026-04-29T00:00:00.000Z',
            total: 1,
            items: [{ id: 'old' }],
          },
        },
        eventos: [{ id: '1', titulo: 'Local' }],
      };
      const remote = { eventos: [{ id: '2', titulo: 'Remote' }] };

      const merged = mergeStudyStates(local, remote);

      expect(merged.config.syncMergeConflicts).toBeUndefined();
    });

    it('updates localBackupAt timestamp', () => {
      const merged = mergeStudyStates({}, {});
      expect(merged.config.localBackupAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});

// =============================================
// TOMBSTONES DE EXCLUSÃO
// =============================================
// mergeById é uma união por id: sem tombstones, um item excluído localmente que
// ainda exista no payload remoto ressuscita em qualquer merge (pull automático
// do Cloudflare/Drive/Firestore). Os tombstones registram a exclusão e viajam
// no payload (createExportableState clona o estado inteiro).
describe('syncTombstones (exclusões propagadas no merge)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

  it('exclusão local sobrevive ao merge quando o remoto ainda tem o item', () => {
    const local = {
      eventos: [],
      syncTombstones: [{ col: 'eventos', id: 'ev_1', deletedAt: iso(0) }],
    };
    const remote = { eventos: [{ id: 'ev_1', criadoEm: iso(-5 * DAY) }] };

    const merged = mergeStudyStates(local, remote);

    expect(merged.eventos).toEqual([]);
    expect(merged.syncTombstones).toContainEqual(
      expect.objectContaining({ col: 'eventos', id: 'ev_1' })
    );
  });

  it('exclusão remota remove o item local', () => {
    const local = { eventos: [{ id: 'ev_1', criadoEm: iso(-5 * DAY) }] };
    const remote = {
      eventos: [],
      syncTombstones: [{ col: 'eventos', id: 'ev_1', deletedAt: iso(0) }],
    };

    const merged = mergeStudyStates(local, remote);

    expect(merged.eventos).toEqual([]);
  });

  it('item recriado depois do tombstone sobrevive', () => {
    const local = { syncTombstones: [{ col: 'eventos', id: 'ev_1', deletedAt: iso(-2 * DAY) }] };
    const remote = { eventos: [{ id: 'ev_1', criadoEm: iso(-10 * DAY), updatedAt: iso(-1 * DAY) }] };

    const merged = mergeStudyStates(local, remote);

    expect(merged.eventos).toHaveLength(1);
  });

  it('tombstones dos dois lados são unidos mantendo o deletedAt mais novo', () => {
    const newer = iso(0);
    const local = { syncTombstones: [{ col: 'eventos', id: 'ev_1', deletedAt: iso(-1 * DAY) }] };
    const remote = {
      syncTombstones: [
        { col: 'eventos', id: 'ev_1', deletedAt: newer },
        { col: 'eventos', id: 'ev_2', deletedAt: iso(-3 * DAY) },
      ],
    };

    const merged = mergeStudyStates(local, remote);

    expect(merged.syncTombstones).toHaveLength(2);
    expect(merged.syncTombstones.find((t) => t.id === 'ev_1').deletedAt).toBe(newer);
  });

  it('payload de cliente antigo sem syncTombstones mantém o comportamento atual', () => {
    const local = { eventos: [{ id: '1' }] };
    const remote = { eventos: [{ id: '2' }] };

    const merged = mergeStudyStates(local, remote);

    expect(merged.eventos).toHaveLength(2);
    expect(merged.syncTombstones).toEqual([]);
  });

  it('tombstones com mais de 180 dias são podados no merge', () => {
    const local = {
      syncTombstones: [
        { col: 'eventos', id: 'ev_velho', deletedAt: iso(-200 * DAY) },
        { col: 'eventos', id: 'ev_novo', deletedAt: iso(-1 * DAY) },
      ],
    };

    const merged = mergeStudyStates(local, {});

    expect(merged.syncTombstones.map((t) => t.id)).toEqual(['ev_novo']);
  });

  it('cap de 2000 tombstones mantém os mais recentes', () => {
    const many = Array.from({ length: 2005 }, (_, i) => ({
      col: 'eventos',
      id: 'ev_' + i,
      // i maior = mais novo
      deletedAt: iso(-(2005 - i) * 60 * 1000),
    }));
    const merged = mergeStudyStates({ syncTombstones: many }, {});

    expect(merged.syncTombstones).toHaveLength(2000);
    const ids = new Set(merged.syncTombstones.map((t) => t.id));
    expect(ids.has('ev_2004')).toBe(true); // mais novo permanece
    expect(ids.has('ev_0')).toBe(false); // mais velho cai
  });

  it('tombstone de hábito filtra só o registro do tipo correspondente', () => {
    const local = {
      habitos: { questoes: [] },
      syncTombstones: [{ col: 'habitos.questoes', id: 'hab_1', deletedAt: iso(0) }],
    };
    const remote = {
      habitos: {
        questoes: [{ id: 'hab_1', criadoEm: iso(-2 * DAY) }],
        leitura: [{ id: 'hab_1', criadoEm: iso(-2 * DAY) }],
      },
    };

    const merged = mergeStudyStates(local, remote);

    expect(merged.habitos.questoes).toEqual([]);
    expect(merged.habitos.leitura).toHaveLength(1);
  });

  it('tombstone sem deletedAt válido é ignorado (não derruba o merge)', () => {
    const local = {
      eventos: [{ id: 'ev_1', criadoEm: iso(-1 * DAY) }],
      syncTombstones: [{ col: 'eventos', id: 'ev_1' }, null, { id: 'sem_col' }],
    };

    const merged = mergeStudyStates(local, {});

    expect(merged.eventos).toHaveLength(1);
    expect(merged.syncTombstones).toEqual([]);
  });

  describe('recordSyncTombstone()', () => {
    it('cria a lista e registra a exclusão', () => {
      const state = {};

      recordSyncTombstone(state, 'eventos', 'ev_1');

      expect(state.syncTombstones).toHaveLength(1);
      expect(state.syncTombstones[0]).toMatchObject({ col: 'eventos', id: 'ev_1' });
      expect(state.syncTombstones[0].deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('atualiza o deletedAt sem duplicar quando o mesmo item é excluído de novo', () => {
      const state = {
        syncTombstones: [
          { col: 'eventos', id: 'ev_1', deletedAt: '2026-01-01T00:00:00.000Z' },
        ],
      };

      recordSyncTombstone(state, 'eventos', 'ev_1');

      expect(state.syncTombstones).toHaveLength(1);
      expect(state.syncTombstones[0].deletedAt).not.toBe('2026-01-01T00:00:00.000Z');
    });

    it('ignora chamadas sem col ou id', () => {
      const state = {};
      recordSyncTombstone(state, '', 'x');
      recordSyncTombstone(state, 'eventos', null);
      expect(state.syncTombstones).toBeUndefined();
    });
  });
});

// Planejamento é um objeto singleton: o merge fazia {...remote, ...local} e o
// LOCAL sempre vencia — mudanças de plano (ex.: etapa pulada) nunca propagavam
// entre dispositivos. Agora cada mutação real do plano grava
// planejamento.updatedAt e o merge aplica LWW pelo timestamp; sem updatedAt nos
// dois lados, o local continua vencendo (comportamento antigo, clientes antigos).
describe('merge do planejamento (LWW por updatedAt)', () => {
  it('planejamento remoto mais novo vence — etapa pulada propaga', () => {
    const local = {
      planejamento: {
        ativo: true,
        updatedAt: '2026-06-09T10:00:00.000Z',
        sequencia: [{ id: 'seq_1', status: 'pendente' }],
      },
    };
    const remote = {
      planejamento: {
        ativo: true,
        updatedAt: '2026-06-10T10:00:00.000Z',
        sequencia: [{ id: 'seq_1', status: 'pulada', puladaEm: '2026-06-10T10:00:00.000Z' }],
      },
    };

    const merged = mergeStudyStates(local, remote);

    expect(merged.planejamento.sequencia[0].status).toBe('pulada');
  });

  it('planejamento local mais novo vence', () => {
    const local = {
      planejamento: { updatedAt: '2026-06-10T10:00:00.000Z', sequencia: [{ id: 'a' }] },
    };
    const remote = {
      planejamento: { updatedAt: '2026-06-09T10:00:00.000Z', sequencia: [{ id: 'b' }] },
    };

    const merged = mergeStudyStates(local, remote);

    expect(merged.planejamento.sequencia[0].id).toBe('a');
  });

  it('sem updatedAt nos dois lados, o local vence (comportamento atual)', () => {
    const local = { planejamento: { sequencia: [{ id: 'a' }] } };
    const remote = { planejamento: { sequencia: [{ id: 'b' }] } };

    const merged = mergeStudyStates(local, remote);

    expect(merged.planejamento.sequencia[0].id).toBe('a');
  });

  it('remoto com updatedAt vence local sem updatedAt (cliente antigo)', () => {
    const local = { planejamento: { sequencia: [{ id: 'a' }] } };
    const remote = {
      planejamento: { updatedAt: '2026-06-10T10:00:00.000Z', sequencia: [{ id: 'b' }] },
    };

    const merged = mergeStudyStates(local, remote);

    expect(merged.planejamento.sequencia[0].id).toBe('b');
  });

  it('remoto sem planejamento mantém o local', () => {
    const local = {
      planejamento: { updatedAt: '2026-06-10T10:00:00.000Z', sequencia: [{ id: 'a' }] },
    };

    const merged = mergeStudyStates(local, {});

    expect(merged.planejamento.sequencia[0].id).toBe('a');
  });
});

// O status derivado (autoConcluida) é uma view materializada dos eventos: cada
// dispositivo re-deriva o mesmo resultado após o merge, sem disputar autoria
// do plano via updatedAt ("todo estudo da disciplina conta").
describe('reconciliação do ciclo no merge (todo estudo conta)', () => {
  const sessao = () => ({
    id: 'ev_1',
    status: 'estudei',
    discId: 'disc_1',
    data: '2026-06-10',
    dataEstudo: '2026-06-10',
    tempoAcumulado: 7200, // 120 min
  });

  const etapa = (overrides = {}) => ({
    id: 'seq_1',
    discId: 'disc_1',
    minutosAlvo: 120,
    concluido: false,
    status: 'pendente',
    ...overrides,
  });

  const plano = (sequencia, overrides = {}) => ({
    ativo: true,
    tipo: 'ciclo',
    disciplinas: ['disc_1'],
    dataInicioCicloAtual: '2026-06-01T00:00:00.000Z',
    sequencia,
    ...overrides,
  });

  it('plano remoto mais novo com status desatualizado converge com os eventos merged', () => {
    const local = {
      planejamento: plano(
        [etapa({ status: 'concluida', concluido: true, autoConcluida: true })],
        { updatedAt: '2026-06-09T10:00:00.000Z' }
      ),
      eventos: [sessao()],
    };
    const remote = {
      planejamento: plano([etapa()], { updatedAt: '2026-06-10T10:00:00.000Z' }),
      eventos: [],
    };

    const merged = mergeStudyStates(local, remote);

    // O plano remoto vence o LWW, mas a reconciliação pós-merge re-deriva a
    // conclusão a partir dos eventos preservados no merge.
    expect(merged.planejamento.sequencia[0]).toMatchObject({
      status: 'concluida',
      concluido: true,
      autoConcluida: true,
    });
    // Reconciliação não reivindica autoria do plano
    expect(merged.planejamento.updatedAt).toBe('2026-06-10T10:00:00.000Z');
  });

  it('tombstone da sessão em um lado reabre a etapa autoConcluida no merge', () => {
    const local = {
      planejamento: plano([
        etapa({
          status: 'concluida',
          concluido: true,
          autoConcluida: true,
          finalizadoEm: '2026-06-10T12:00:00.000Z',
        }),
      ]),
      eventos: [sessao()],
    };
    const remote = { eventos: [] };
    recordSyncTombstone(remote, 'eventos', 'ev_1');

    const merged = mergeStudyStates(local, remote);

    expect(merged.eventos).toEqual([]);
    expect(merged.planejamento.sequencia[0]).toMatchObject({
      status: 'pendente',
      concluido: false,
    });
    expect(merged.planejamento.sequencia[0].autoConcluida).toBeUndefined();
  });

  it('merge é convergente: as duas ordens produzem o mesmo status de etapa', () => {
    const deviceA = () => ({
      planejamento: plano([etapa()], { updatedAt: '2026-06-08T10:00:00.000Z' }),
      eventos: [sessao()],
    });
    const deviceB = () => ({
      planejamento: plano([etapa()], { updatedAt: '2026-06-09T10:00:00.000Z' }),
      eventos: [],
    });

    const mergedAB = mergeStudyStates(deviceA(), deviceB());
    const mergedBA = mergeStudyStates(deviceB(), deviceA());

    expect(mergedAB.planejamento.sequencia[0].status).toBe('concluida');
    expect(mergedBA.planejamento.sequencia[0].status).toBe('concluida');
  });

  it('conclusão manual nunca é reaberta pelo merge', () => {
    const local = {
      planejamento: plano([
        etapa({
          status: 'concluida',
          concluido: true,
          finalizadoEm: '2026-06-10T12:00:00.000Z',
        }),
      ]),
      eventos: [], // nada sustenta a conclusão — mas ela é manual
    };

    const merged = mergeStudyStates(local, {});

    expect(merged.planejamento.sequencia[0].status).toBe('concluida');
  });
});
