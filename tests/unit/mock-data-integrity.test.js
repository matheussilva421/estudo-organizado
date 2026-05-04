import { describe, it, expect } from 'vitest';

const { generateMockState } = await import('../../scripts/generate-mock-data.mjs');

const FIXED_TODAY = '2026-05-04';
const REQUIRED_TOP_KEYS = [
  'schemaVersion', 'ciclo', 'planejamento', 'editais', 'eventos',
  'arquivo', 'habitos', 'revisoes', 'config', 'cronoLivre', 'bancaRelevance',
];
const STRIPPED_SYNC_KEYS = [
  'cfUrl', 'cfToken', 'cfTokenSaved', 'cfConflict',
  'cfRemoteUpdatedAt', 'cfLastSyncAt', '_lastUpdated', 'syncMergeConflicts',
  'localBackupAt',
];
const HABIT_TYPE_KEYS = [
  'questoes', 'revisao', 'discursiva', 'simulado',
  'leitura', 'informativo', 'sumula', 'videoaula', 'paginas',
];
const VALID_EVENT_STATUSES = ['agendado', 'estudei', 'atrasado'];
const VALID_EVENT_TIPOS = ['conteudo', 'revisao', 'questoes'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectAllDisciplinas(editais) {
  const map = {};
  for (const edital of editais) {
    for (const disc of edital.disciplinas || []) {
      map[disc.id] = { ...disc, editalId: edital.id };
    }
  }
  return map;
}

function collectAllAssuntos(editais) {
  const map = {};
  for (const edital of editais) {
    for (const disc of edital.disciplinas || []) {
      for (const ass of disc.assuntos || []) {
        map[ass.id] = { ...ass, disciplinaId: disc.id, editalId: edital.id };
      }
    }
  }
  return map;
}

function isValidHexColor(str) {
  return /^#[0-9a-f]{6}$/i.test(str);
}

function isValidDateYYYYMMDD(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function isValidISO(str) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(str);
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateMockState — data integrity', () => {
  describe('1. Schema Version', () => {
    it('returns schemaVersion 9', () => {
      const state = generateMockState('test');
      expect(state.schemaVersion).toBe(9);
    });
  });

  describe('2. Top-Level Keys', () => {
    it('has all required top-level keys', () => {
      const state = generateMockState('test');
      for (const key of REQUIRED_TOP_KEYS) {
        expect(state).toHaveProperty(key);
      }
    });

    it('has driveFileId and lastSync both null', () => {
      const state = generateMockState('test');
      expect(state.driveFileId).toBeNull();
      expect(state.lastSync).toBeNull();
    });
  });

  describe('3. Sync Credentials Stripped', () => {
    it('has cfSyncEnabled false', () => {
      const state = generateMockState('test');
      expect(state.config.cfSyncEnabled).toBe(false);
    });

    it('has firestoreSync.enabled false', () => {
      const state = generateMockState('test');
      expect(state.config.firestoreSync.enabled).toBe(false);
    });

    it('has no sync credential keys in config', () => {
      const state = generateMockState('test');
      for (const key of STRIPPED_SYNC_KEYS) {
        expect(state.config[key]).toBeUndefined();
      }
    });
  });

  describe('4. Config Defaults', () => {
    it('has frequenciaRevisao [1, 7, 30, 90]', () => {
      const state = generateMockState('test');
      expect(state.config.frequenciaRevisao).toEqual([1, 7, 30, 90]);
    });

    it('has visualizacao "mes"', () => {
      const state = generateMockState('test');
      expect(state.config.visualizacao).toBe('mes');
    });

    it('has primeirodiaSemana 1', () => {
      const state = generateMockState('test');
      expect(state.config.primeirodiaSemana).toBe(1);
    });

    it('has agruparEventos true', () => {
      const state = generateMockState('test');
      expect(state.config.agruparEventos).toBe(true);
    });

    it('has metas with horasSemana and questoesSemana', () => {
      const state = generateMockState('test');
      expect(state.config.metas).toBeDefined();
      expect(typeof state.config.metas.horasSemana).toBe('number');
      expect(typeof state.config.metas.questoesSemana).toBe('number');
    });
  });

  describe('5. Habitos Keys Match HABIT_TYPES', () => {
    it('has all 9 habit type keys and no extras', () => {
      const state = generateMockState('test');
      const habitKeys = Object.keys(state.habitos).sort();
      const expectedKeys = [...HABIT_TYPE_KEYS].sort();
      expect(habitKeys).toEqual(expectedKeys);
    });
  });

  describe('6. Edital Structure', () => {
    const state = generateMockState('test');

    it('has at least 3 editais', () => {
      expect(state.editais.length).toBeGreaterThanOrEqual(3);
    });

    it('each edital has id, nome, cor, disciplinas', () => {
      for (const edital of state.editais) {
        expect(typeof edital.id).toBe('string');
        expect(typeof edital.nome).toBe('string');
        expect(isValidHexColor(edital.cor)).toBe(true);
        expect(Array.isArray(edital.disciplinas)).toBe(true);
      }
    });

    it('each disciplina has required fields', () => {
      for (const edital of state.editais) {
        for (const disc of edital.disciplinas) {
          expect(typeof disc.id).toBe('string');
          expect(typeof disc.nome).toBe('string');
          expect(typeof disc.icone).toBe('string');
          expect(isValidHexColor(disc.cor)).toBe(true);
          expect(Array.isArray(disc.assuntos)).toBe(true);
          expect(Array.isArray(disc.aulas)).toBe(true);
        }
      }
    });

    it('each assunto has required fields', () => {
      for (const edital of state.editais) {
        for (const disc of edital.disciplinas) {
          for (const ass of disc.assuntos) {
            expect(typeof ass.id).toBe('string');
            expect(typeof ass.nome).toBe('string');
            expect(typeof ass.concluido).toBe('boolean');
            expect(Array.isArray(ass.revisoesFetas)).toBe(true);
            expect(typeof ass.adiamentos).toBe('number');
            expect(Array.isArray(ass.linkedAulaIds)).toBe(true);
          }
        }
      }
    });

    it('each aula has required fields', () => {
      for (const edital of state.editais) {
        for (const disc of edital.disciplinas) {
          for (const aula of disc.aulas) {
            expect(typeof aula.id).toBe('string');
            expect(typeof aula.nome).toBe('string');
            expect(typeof aula.concluida).toBe('boolean');
            expect(aula.dataConclusao === null || isValidDateYYYYMMDD(aula.dataConclusao)).toBe(true);
          }
        }
      }
    });
  });

  describe('7. Evento Structure', () => {
    const state = generateMockState('test');

    it('has at least 40 eventos', () => {
      expect(state.eventos.length).toBeGreaterThanOrEqual(40);
    });

    it('each evento has required fields with correct types', () => {
      for (const ev of state.eventos) {
        expect(typeof ev.id).toBe('string');
        expect(typeof ev.titulo).toBe('string');
        expect(isValidDateYYYYMMDD(ev.data)).toBe(true);
        expect(ev.dataEstudo === null || isValidDateYYYYMMDD(ev.dataEstudo)).toBe(true);
        expect(typeof ev.duracao).toBe('number');
        expect(ev.duracao).toBeGreaterThanOrEqual(45);
        expect(ev.duracao).toBeLessThanOrEqual(180);
        expect(VALID_EVENT_STATUSES).toContain(ev.status);
        expect(typeof ev.tempoAcumulado).toBe('number');
        expect(VALID_EVENT_TIPOS).toContain(ev.tipo);
        expect(typeof ev.discId).toBe('string');
        expect(ev.assId === null || typeof ev.assId === 'string').toBe(true);
        expect(ev.habito).toBeNull();
        expect(isValidISO(ev.criadoEm)).toBe(true);
        expect(ev._timerStart).toBeNull();
      }
    });

    it('has at least one of each status type', () => {
      const statuses = new Set(state.eventos.map((e) => e.status));
      for (const status of VALID_EVENT_STATUSES) {
        expect(statuses.has(status)).toBe(true);
      }
    });
  });

  describe('8. Arquivo Structure', () => {
    const state = generateMockState('test');

    it('has at least 10 arquivo events', () => {
      expect(state.arquivo.length).toBeGreaterThanOrEqual(10);
    });

    it('each arquivo entry has same shape as eventos', () => {
      for (const ev of state.arquivo) {
        expect(typeof ev.id).toBe('string');
        expect(typeof ev.titulo).toBe('string');
        expect(isValidDateYYYYMMDD(ev.data)).toBe(true);
        expect(ev.dataEstudo === null || isValidDateYYYYMMDD(ev.dataEstudo)).toBe(true);
        expect(typeof ev.duracao).toBe('number');
        expect(ev.status).toBe('estudei');
        expect(typeof ev.tempoAcumulado).toBe('number');
        expect(VALID_EVENT_TIPOS).toContain(ev.tipo);
        expect(typeof ev.discId).toBe('string');
        expect(ev._timerStart).toBeNull();
      }
    });

    it('all arquivo dates are >90 days ago from fixed reference', () => {
      for (const ev of state.arquivo) {
        const days = daysBetween(ev.data, FIXED_TODAY);
        expect(days).toBeGreaterThan(90);
      }
    });
  });

  describe('9. Habitos Structure', () => {
    const state = generateMockState('test');

    it('has total habit entries >= 30', () => {
      const total = Object.values(state.habitos).reduce((sum, arr) => sum + arr.length, 0);
      expect(total).toBeGreaterThanOrEqual(30);
    });

    it('each habit entry has id, data, disciplinaId, assuntoId', () => {
      for (const [_type, entries] of Object.entries(state.habitos)) {
        for (const entry of entries) {
          expect(typeof entry.id).toBe('string');
          expect(isValidDateYYYYMMDD(entry.data)).toBe(true);
          expect(typeof entry.disciplinaId).toBe('string');
          expect(entry.assuntoId === null || typeof entry.assuntoId === 'string').toBe(true);
        }
      }
    });

    it('questoes entries have acertos/erros', () => {
      for (const entry of state.habitos.questoes) {
        expect(typeof entry.acertos).toBe('number');
        expect(typeof entry.erros).toBe('number');
      }
    });

    it('videoaula entries have aulas/tempo', () => {
      for (const entry of state.habitos.videoaula) {
        expect(typeof entry.aulas).toBe('number');
        expect(typeof entry.tempo).toBe('number');
      }
    });

    it('leitura entries have paginas', () => {
      for (const entry of state.habitos.leitura) {
        expect(typeof entry.paginas).toBe('number');
      }
    });

    it('simulado entries have nota/acertos/erros/percentual', () => {
      for (const entry of state.habitos.simulado) {
        expect(typeof entry.nota).toBe('number');
        expect(typeof entry.acertos).toBe('number');
        expect(typeof entry.erros).toBe('number');
        expect(typeof entry.percentual).toBe('number');
      }
    });
  });

  describe('10. Revisoes Structure', () => {
    const state = generateMockState('test');

    it('has at least 20 revisoes', () => {
      expect(state.revisoes.length).toBeGreaterThanOrEqual(20);
    });

    it('each revisao has required fields', () => {
      for (const rev of state.revisoes) {
        expect(typeof rev.id).toBe('string');
        expect(typeof rev.editalId).toBe('string');
        expect(typeof rev.disciplinaId).toBe('string');
        expect(typeof rev.assuntoId).toBe('string');
        expect(isValidDateYYYYMMDD(rev.data)).toBe(true);
        expect(typeof rev.concluida).toBe('boolean');
        expect(rev.dataConclusao === null || isValidDateYYYYMMDD(rev.dataConclusao)).toBe(true);
        expect(typeof rev.criadaEm).toBe('string');
      }
    });
  });

  describe('11. Referential Integrity', () => {
    const state = generateMockState('test');
    const discMap = collectAllDisciplinas(state.editais);
    const assMap = collectAllAssuntos(state.editais);
    const editalIds = new Set(state.editais.map((e) => e.id));

    it('every evento discId references a valid disciplina', () => {
      for (const ev of state.eventos) {
        expect(discMap[ev.discId]).toBeDefined();
      }
    });

    it('every evento assId references a valid assunto in its disciplina', () => {
      for (const ev of state.eventos) {
        if (ev.assId !== null) {
          const ass = assMap[ev.assId];
          expect(ass).toBeDefined();
          if (ass) {
            expect(ass.disciplinaId).toBe(ev.discId);
          }
        }
      }
    });

    it('every habit disciplinaId/assuntoId references valid entities', () => {
      for (const entries of Object.values(state.habitos)) {
        for (const entry of entries) {
          expect(discMap[entry.disciplinaId]).toBeDefined();
          if (entry.assuntoId !== null) {
            expect(assMap[entry.assuntoId]).toBeDefined();
          }
        }
      }
    });

    it('every revisao editalId references a valid edital', () => {
      for (const rev of state.revisoes) {
        expect(editalIds.has(rev.editalId)).toBe(true);
      }
    });

    it('every revisao disciplinaId/assuntoId references valid entities', () => {
      for (const rev of state.revisoes) {
        expect(discMap[rev.disciplinaId]).toBeDefined();
        expect(assMap[rev.assuntoId]).toBeDefined();
      }
    });
  });

  describe('12. Determinism', () => {
    it('same seed produces identical output', () => {
      const state1 = generateMockState('seed1');
      const state2 = generateMockState('seed1');
      expect(JSON.stringify(state1)).toBe(JSON.stringify(state2));
    });

    it('different seeds produce different output', () => {
      const state1 = generateMockState('seed1');
      const state2 = generateMockState('seed2');
      expect(JSON.stringify(state1)).not.toBe(JSON.stringify(state2));
    });
  });

  describe('13. No Envelope Wrapping', () => {
    it('state does NOT have version, slot, checksum, or payload keys', () => {
      const state = generateMockState('test');
      expect(state.version).toBeUndefined();
      expect(state.slot).toBeUndefined();
      expect(state.checksum).toBeUndefined();
      expect(state.payload).toBeUndefined();
    });
  });

  describe('14. No Active Timers', () => {
    it('cronoLivre has null _timerStart and zero tempoAcumulado', () => {
      const state = generateMockState('test');
      expect(state.cronoLivre._timerStart).toBeNull();
      expect(state.cronoLivre.tempoAcumulado).toBe(0);
    });

    it('no evento has a non-null _timerStart', () => {
      const state = generateMockState('test');
      for (const ev of state.eventos) {
        expect(ev._timerStart).toBeNull();
      }
    });

    it('no arquivo entry has a non-null _timerStart', () => {
      const state = generateMockState('test');
      for (const ev of state.arquivo) {
        expect(ev._timerStart).toBeNull();
      }
    });
  });

  describe('15. Config Export Safety', () => {
    it('has no localBackupAt, cfUrl, cfToken, or other sync secrets', () => {
      const state = generateMockState('test');
      const exportUnsafeKeys = [
        'localBackupAt', 'cfUrl', 'cfToken', 'cfTokenSaved',
        'cfConflict', 'cfRemoteUpdatedAt', 'cfLastSyncAt',
        '_lastUpdated', 'syncMergeConflicts',
      ];
      for (const key of exportUnsafeKeys) {
        expect(state.config[key]).toBeUndefined();
      }
    });
  });
});
