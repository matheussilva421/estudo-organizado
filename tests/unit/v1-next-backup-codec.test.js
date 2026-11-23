import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import * as validator from '../../src/js/backup-restore.js';
import {
  auditBusinessEquivalence,
  convertBackupV12,
  reconstituteBackupV12,
} from '../../src/js/sync/v1-next/backup-codec.js';

// Entirely invented data. Never read a private backup or environment variable here.
function fixture() {
  return {
    schemaVersion: 12,
    editais: [{ id: 'ed-b', nome: 'Sintético', disciplinas: [
      { id: 'disc-b', aulas: [{ id: 'aula-b', notas: null }, { id: 'aula-a' }],
        assuntos: [{ id: 'ass-b', linkedAulaIds: ['aula-a'] }, { id: 'ass-a' }] },
      { id: 'disc-a', aulas: [], assuntos: [] },
    ] }, { id: 'ed-a', disciplinas: [] }],
    eventos: [
      { id: 'ev-b', aulaId: 'aula-antiga', rfBlocoId: 'rf-antigo', notas: 'Nota inventada' },
      { id: 'ev-a', aulaId: 'aula-a', rfBlocoId: 'rf-b', _timerStart: 123 },
    ],
    habitos: {
      questoes: [{ id: 'h-1', eventoId: 'ev-b', acertos: 7 }],
      leitura: [{ id: 'h-1', eventoId: 'ev-a', paginas: null }],
      futuro: [{ id: 'h-2', extra: [2, 1] }], vazio: [],
    },
    planejamento: { tipo: 'reta_final', planId: 'pl-1', revision: 4, retaFinal: {
      dataFinal: '2027-02-28', blocos: [
        { id: 'rf-b', ordem: 0, discId: 'disc-b', notas: null,
          topicos: [{ aulaId: 'aula-a', assId: null }], operations: [{ type: 'move' }] },
        { id: 'rf-a', ordem: 1, discId: 'disc-a' },
      ],
    } },
    planejamentoArquivado: { tipo: 'ciclo', disciplinas: ['disc-b'], futuro: null },
    ciclo: { sequencia: ['disc-b', 'disc-a'], ativo: false },
    config: { materiasPorDia: 2, extensao: { cfTokenDraft: 'negocio-sintetico', uid: 'referencia' },
      cfTokenDraft: 'SYNTHETIC_CREDENTIAL', cfToken: 'SYNTHETIC_CREDENTIAL',
      cfUrl: 'https://synthetic.invalid', cfSyncEnabled: false, globalSyncPaused: true,
      firestoreSync: { enabled: true, uid: 'SYNTHETIC_SESSION', lastError: 'SYNTHETIC_DIAGNOSTIC' },
      entitySync: { deviceId: 'SYNTHETIC_SESSION' },
      syncHealth: { lastError: 'SYNTHETIC_DIAGNOSTIC' }, manualSyncHistory: ['SYNTHETIC_DIAGNOSTIC'],
      entityTombstones: [{ col: 'habitos.questoes', id: 'old-h', deletedAt: null }],
    },
    syncTombstones: [{ col: 'eventos', id: 'old-ev', deletedAt: '2026-01-01' }],
    cronoLivre: { _timerStart: 123, tempoAcumulado: 90, desconhecido: null },
    bancaRelevance: { userMappings: { 'ass-a': 'banca-a' } },
    arquivo: [], revisoes: [],
    extensao: { lista: [3, null, 1], token: 'conceito-academico', ausente: {} },
    driveFileId: 'SYNTHETIC_SESSION', lastSync: 'SYNTHETIC_DIAGNOSTIC',
  };
}

function business() {
  const raw = fixture();
  for (const key of ['cfTokenDraft', 'cfToken', 'cfUrl', 'cfSyncEnabled', 'globalSyncPaused',
    'firestoreSync', 'entitySync', 'syncHealth', 'manualSyncHistory']) delete raw.config[key];
  delete raw.driveFileId;
  delete raw.lastSync;
  delete raw.cronoLivre._timerStart;
  delete raw.eventos[1]._timerStart;
  return raw;
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
const sha = value => createHash('sha256').update(canonical(value)).digest('hex');

describe('V1 next backup codec', () => {
  it('round-trips the entire business tree without mutating either input', () => {
    const raw = fixture();
    const before = structuredClone(raw);
    const converted = convertBackupV12(raw);
    const recordsBefore = structuredClone(converted.records);
    const restored = reconstituteBackupV12(converted.records);
    expect(restored).toStrictEqual(business());
    expect(raw).toStrictEqual(before);
    expect(converted.records).toStrictEqual(recordsBefore);
    expect(auditBusinessEquivalence(raw, restored)).toEqual({ ok: true, differences: [] });
  });

  it('calls the real validator on sanitized data and retains its rejection', () => {
    const realValidate = validator.validateBackupPayload;
    let validated;
    vi.spyOn(validator, 'validateBackupPayload').mockImplementation(payload => {
      validated = structuredClone(payload);
      return realValidate(payload);
    });
    convertBackupV12(fixture());
    expect(validated).toStrictEqual(business());
    const invalid = fixture();
    invalid.arquivo = 'invalid';
    expect(() => convertBackupV12(invalid)).toThrow(/arquivo must be an array/);
  });

  it('emits only known excluded paths and never operational values', () => {
    const result = convertBackupV12(fixture());
    expect(result.exclusions).toEqual([...result.exclusions].sort());
    expect(result.exclusions).toEqual(expect.arrayContaining([
      '/config/cfTokenDraft', '/config/firestoreSync', '/config/entitySync',
      '/config/syncHealth', '/config/manualSyncHistory', '/eventos/1/_timerStart',
      '/cronoLivre/_timerStart', '/driveFileId', '/lastSync',
    ]));
    expect(JSON.stringify(result)).not.toMatch(/SYNTHETIC_CREDENTIAL|SYNTHETIC_SESSION|SYNTHETIC_DIAGNOSTIC/);
    expect(result.records.meta.find(item => item.entityId === 'config').data.extensao)
      .toEqual(business().config.extensao);
  });

  it('excludes every known operational config path without removing unknown business fields', () => {
    const raw = business();
    const known = ['localBackupAt', 'cfUrl', 'cfToken', 'cfTokenDraft', 'cfTokenSaved',
      'cfConflict', 'cfRemoteUpdatedAt', 'cfLastSyncAt', '_lastUpdated', 'syncMergeConflicts',
      'cfSyncEnabled', 'firestoreSync', 'entitySync', 'globalSyncPaused', 'manualSyncHistory',
      'lastManualSyncResults', 'lastManualSyncAt', 'syncPerformance', 'syncHealth', 'lastEnvelopeBytes'];
    for (const key of known) raw.config[key] = { value: 'SYNTHETIC_OPERATIONAL_ONLY' };
    const result = convertBackupV12(raw);
    expect(result.exclusions).toEqual(known.map(key => `/config/${key}`).sort());
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC_OPERATIONAL_ONLY');
    expect(reconstituteBackupV12(result.records)).toStrictEqual(business());
  });

  it('splits hybrid entities with stable type:id keys and original IDs', () => {
    const { records } = convertBackupV12(fixture());
    expect(Object.keys(records).sort()).toEqual([
      'disciplinas', 'editais', 'eventos', 'habitos', 'meta', 'retaFinalBlocos', 'tombstones',
    ]);
    expect(records.disciplinas.map(r => r.data.id)).toEqual(['disc-b', 'disc-a']);
    expect(records.disciplinas[0].data.aulas.map(a => a.id)).toEqual(['aula-b', 'aula-a']);
    expect(records.editais[0].data.disciplinas).toEqual([null, null]);
    expect(records.retaFinalBlocos[0].data.id).toBe('rf-b');
    expect(records.habitos[0].key).not.toBe(records.habitos[1].key);
    for (const record of Object.values(records).flat()) {
      expect(record.key).toBe(`${record.entityType}:${record.entityId}`);
    }
  });

  it('provides deterministic SHA-256 counts and digests without content', () => {
    const first = convertBackupV12(fixture());
    // Recursively reverse object insertion order, retaining array order.
    const reverseKeys = v => Array.isArray(v) ? v.map(reverseKeys) : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)])) : v;
    expect(convertBackupV12(reverseKeys(fixture()))).toStrictEqual(first);
    expect(first.manifestDraft).toMatchObject({ schemaVersion: 12, digestAlgorithm: 'SHA-256',
      businessDigest: sha(business()),
      businessCounts: { editais: 2, disciplinas: 2, aulas: 2, assuntos: 2,
        eventos: 2, habitos: 3, retaFinalBlocos: 2, tombstones: 2, planejamentoArquivado: 1 },
    });
    expect(first.manifestDraft.counts.total).toBe(Object.values(first.records).flat().length);
    for (const [collection, records] of Object.entries(first.records)) {
      expect(first.manifestDraft.counts.byCollection[collection]).toBe(records.length);
      expect(first.manifestDraft.collectionDigests[collection]).toBe(sha(records));
      expect(first.manifestDraft.recordDigests[collection]).toEqual(records.map(sha));
    }
  });

  it('classifies unresolved historical references without IDs or repairs in the report', () => {
    const result = convertBackupV12(fixture());
    expect(result.exceptions).toEqual([
      { type: 'historicalUnresolvedReference', path: '/eventos/0/aulaId', target: 'aulas' },
      { type: 'historicalUnresolvedReference', path: '/eventos/0/rfBlocoId', target: 'retaFinalBlocos' },
    ]);
    expect(result.manifestDraft.historicalUnresolvedReferences).toEqual({ aulaId: 1, rfBlocoId: 1 });
    expect(reconstituteBackupV12(result.records).eventos[0]).toEqual(business().eventos[0]);
  });

  it('calculates the 57/86 historical cases from synthetic data, never hardcodes counts', () => {
    const raw = fixture();
    raw.eventos = Array.from({ length: 90 }, (_, i) => ({ id: `e-${i}`,
      ...(i < 57 ? { aulaId: `missing-a-${i}` } : {}),
      ...(i < 86 ? { rfBlocoId: `missing-rf-${i}` } : {}),
    }));
    expect(convertBackupV12(raw).manifestDraft.historicalUnresolvedReferences)
      .toEqual({ aulaId: 57, rfBlocoId: 86 });
  });

  it('does not claim unresolved blocks when the active block inventory is absent', () => {
    const raw = fixture();
    raw.planejamento = null;
    const result = convertBackupV12(raw);
    expect(result.manifestDraft.historicalUnresolvedReferences.rfBlocoId).toBeNull();
    expect(reconstituteBackupV12(result.records).planejamento).toBeNull();
  });

  it.each([null, { tipo: 'ciclo' }])('preserves null/absent optional planning fields: %j', plan => {
    const raw = business();
    raw.planejamento = plan;
    delete raw.planejamentoArquivado;
    delete raw.syncTombstones;
    delete raw.config.entityTombstones;
    expect(reconstituteBackupV12(convertBackupV12(raw).records)).toStrictEqual(raw);
  });

  it('preserves both tombstone origins even for the same historical entity', () => {
    const raw = business();
    raw.config.entityTombstones = structuredClone(raw.syncTombstones);
    const result = convertBackupV12(raw);
    expect(result.records.tombstones).toHaveLength(2);
    expect(new Set(result.records.tombstones.map(r => r.key)).size).toBe(2);
    expect(reconstituteBackupV12(result.records)).toStrictEqual(raw);
  });

  it('keeps tombstone type:id keys stable when their array order changes', () => {
    const raw = business();
    raw.syncTombstones.push({ col: 'eventos', id: 'another-old-event', deletedAt: null });
    const before = convertBackupV12(raw).records.tombstones.map(r => r.key).sort();
    raw.syncTombstones.reverse();
    expect(convertBackupV12(raw).records.tombstones.map(r => r.key).sort()).toEqual(before);
  });

  it.each([
    r => { r.schemaVersion = 11; }, r => { r.schemaVersion = '12'; },
    r => { delete r.editais; }, r => { r.eventos = null; }, r => { r.habitos = []; },
    r => { r.config = null; }, r => { r.editais[0].disciplinas = {}; },
    r => { r.editais[0].disciplinas[0].aulas = null; },
    r => { r.habitos.questoes = {}; }, r => { r.planejamento.retaFinal.blocos = {}; },
    r => { delete r.eventos[0].id; }, r => { r.eventos[1].id = r.eventos[0].id; },
    r => { r.extensao.valor = undefined; }, r => { r.extensao.valor = NaN; },
  ])('rejects invalid schema/structure without silently losing data (%#)', change => {
    const raw = fixture();
    change(raw);
    expect(() => convertBackupV12(raw)).toThrow();
  });

  it('distinguishes null, absent fields, order and values in content-free audit paths', () => {
    const restored = business();
    delete restored.planejamento.retaFinal.blocos[0].notas;
    restored.eventos[0].notas = 'SYNTHETIC_CHANGED_CONTENT';
    restored.extensao.lista.reverse();
    const audit = auditBusinessEquivalence(fixture(), restored);
    expect(audit.ok).toBe(false);
    expect(audit.differences.map(d => d.path)).toEqual(expect.arrayContaining([
      '/planejamento/retaFinal/blocos/0/notas', '/eventos/0/notas', '/',
    ]));
    expect(JSON.stringify(audit)).not.toMatch(/SYNTHETIC_CHANGED_CONTENT|Nota inventada/);
  });

  it('rejects tampered records and missing entities on reconstruction', () => {
    for (const change of [
      r => r.eventos.pop(), r => { r.disciplinas[0].key = 'wrong'; },
      r => { r.eventos[0].path = ['__proto__', 'polluted']; },
      r => { r.meta.find(x => x.entityId === 'config').data.cfTokenDraft = 'SYNTHETIC_CREDENTIAL'; },
    ]) {
      const { records } = convertBackupV12(fixture());
      change(records);
      expect(() => reconstituteBackupV12(records)).toThrow();
    }
    expect({}.polluted).toBeUndefined();
  });

  it('round-trips JSON own keys safely and hashes Unicode canonically', () => {
    const raw = business();
    raw.extensao = JSON.parse('{"__proto__":{"safe":true},"constructor":null,"texto":"ação 📚"}');
    const result = convertBackupV12(raw);
    expect(result.manifestDraft.businessDigest).toBe(sha(raw));
    expect(reconstituteBackupV12(result.records)).toStrictEqual(raw);
    expect({}.safe).toBeUndefined();
  });

  it('reconstructs JSON wire records regardless of Firestore read order', () => {
    const result = convertBackupV12(fixture());
    const fetched = JSON.parse(JSON.stringify(result.records));
    for (const records of Object.values(fetched)) records.reverse();
    expect(reconstituteBackupV12(fetched)).toStrictEqual(business());
  });

  it('preserves map-shaped tombstones, empty maps and null tombstone fields', () => {
    const raw = business();
    raw.config.entityTombstones = { 'evento:old': { id: 'old', col: 'eventos', extra: null } };
    raw.syncTombstones = null;
    expect(reconstituteBackupV12(convertBackupV12(raw).records)).toStrictEqual(raw);
    raw.config.entityTombstones = {};
    expect(reconstituteBackupV12(convertBackupV12(raw).records)).toStrictEqual(raw);
  });

  it('leaves lesson-reference classification unknown when the lesson inventory is incomplete', () => {
    const raw = business();
    delete raw.editais[0].disciplinas[0].aulas;
    const result = convertBackupV12(raw);
    expect(result.manifestDraft.historicalUnresolvedReferences.aulaId).toBeNull();
    expect(reconstituteBackupV12(result.records)).toStrictEqual(raw);
  });

  it('fix round 1: excludes Cloudflare last error by exact path', () => {
    const raw = business();
    raw.config.cfLastError = 'SYNTHETIC_CF_ERROR_ONLY';
    const result = convertBackupV12(raw);
    expect(result.exclusions.includes('/config/cfLastError')).toBe(true);
    expect(JSON.stringify(result.records).includes(raw.config.cfLastError)).toBe(false);
    expect(reconstituteBackupV12(result.records)).toStrictEqual(business());
  });

  it('fix round 1: uses legacy entityType/entityId tombstone identity regardless of array order', () => {
    const raw = business();
    raw.config.entityTombstones = [
      { entityType: 'evento', entityId: 'synthetic-deleted-a', deletedAt: null },
      { entityType: 'evento', entityId: 'synthetic-deleted-b', deletedAt: null },
    ];
    const keysById = result => new Map(result.records.tombstones
      .filter(record => record.data.entityId)
      .map(record => [record.data.entityId, record.key]));
    const before = keysById(convertBackupV12(raw));
    raw.config.entityTombstones.reverse();
    const after = keysById(convertBackupV12(raw));
    expect([...before].every(([id, key]) => after.get(id) === key)).toBe(true);
    expect(reconstituteBackupV12(convertBackupV12(raw).records)).toStrictEqual(raw);
  });

  it('fix round 1: derives map tombstone identity from its legacy key', () => {
    const raw = business();
    raw.config.entityTombstones = { 'eventos:synthetic-deleted': { deletedAt: null } };
    const result = convertBackupV12(raw);
    const record = result.records.tombstones.find(item => item.path[0] === 'config');
    expect(record.entityType === 'tombstone.config.entityTombstones.eventos').toBe(true);
    expect(record.entityId === 'synthetic-deleted').toBe(true);
    expect(reconstituteBackupV12(result.records)).toStrictEqual(raw);
  });

  it('fix round 1: rejects tombstones without recoverable identity rather than using their index', () => {
    for (const tombstone of [{ deletedAt: null }, { col: 'eventos' }, {}, null, 123,
      { col: 'eventos', id: '' }, { entityType: 'evento', entityId: {} }]) {
      const raw = business();
      raw.config.entityTombstones = [tombstone];
      expect(() => convertBackupV12(raw)).toThrow(/tombstone identity/);
    }
  });

  it('fix round 1: distinguishes legacy tombstone types sharing an ID and preserves zero IDs', () => {
    const raw = business();
    raw.config.entityTombstones = [
      { entityType: 'evento', entityId: 0 }, { entityType: 'disciplina', entityId: 0 },
      { col: 'eventos', id: 'same' }, { col: 'disciplinas', id: 'same' },
    ];
    const before = convertBackupV12(raw).records.tombstones.map(record => record.key).sort();
    raw.config.entityTombstones.reverse();
    expect(convertBackupV12(raw).records.tombstones.map(record => record.key).sort()).toEqual(before);
    expect(reconstituteBackupV12(convertBackupV12(raw).records)).toStrictEqual(raw);
  });

  it('fix round 1: collapses dynamic mapping paths for additions, removals and changed values', () => {
    const privateKey = 'SYNTHETIC_DYNAMIC_KEY_ONLY';
    for (const map of ['userMappings', 'lessonMappings']) {
      for (const change of ['remove', 'add', 'value']) {
        const raw = business();
        raw.bancaRelevance[map] = { [privateKey]: { valor: 1 } };
        const restored = structuredClone(raw);
        if (change === 'remove') delete restored.bancaRelevance[map][privateKey];
        else if (change === 'add') delete raw.bancaRelevance[map][privateKey];
        else restored.bancaRelevance[map][privateKey].valor = 2;
        const result = auditBusinessEquivalence(raw, restored);
        expect(result.ok).toBe(false);
        expect(JSON.stringify(result).includes(privateKey)).toBe(false);
        expect(result.differences).toEqual([
          { path: `/bancaRelevance/${map}`, kind: change === 'value' ? 'value' : 'presence' },
        ]);
      }
    }
  });

  it('fix round 1: never includes arbitrary input keys in audit or validation errors', () => {
    const privateKey = 'SYNTHETIC_DYNAMIC_KEY_ONLY';
    const captureError = raw => {
      try { convertBackupV12(raw); } catch (error) { return error.message; }
      throw new Error('Expected validation failure');
    };
    const raw = business();
    raw.bancaRelevance.userMappings = { [privateKey]: undefined };
    const message = captureError(raw);
    expect(message.includes(privateKey)).toBe(false);
    expect(message.includes('/bancaRelevance/userMappings')).toBe(true);
    raw.bancaRelevance.userMappings = {};
    raw[privateKey] = NaN;
    expect(captureError(raw).includes(privateKey)).toBe(false);
    delete raw[privateKey];
    raw.habitos[privateKey] = {};
    expect(captureError(raw).includes(privateKey)).toBe(false);
    delete raw.habitos[privateKey];
    raw.config.entityTombstones = { [privateKey]: undefined };
    expect(captureError(raw).includes(privateKey)).toBe(false);
    delete raw.config.entityTombstones;
    raw.extensao = { [privateKey]: { notas: null } };
    const restored = structuredClone(raw);
    delete restored.extensao[privateKey];
    const audit = auditBusinessEquivalence(raw, restored);
    expect(audit.ok).toBe(false);
    expect(JSON.stringify(audit).includes(privateKey)).toBe(false);
  });
});
