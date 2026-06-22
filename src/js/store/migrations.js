// =============================================
// SCHEMA MIGRATIONS (v1 → v11)
// =============================================
import { uid } from '../utils.js?v=8.37';

export const DEFAULT_SCHEMA_VERSION = 11;

/**
 * Executa migrações de schema do estado (v1 → v11)
 * @param {Object} state - Estado global a ser migrado
 * @param {Function} onChanged - Callback chamado quando mudanças são aplicadas
 * @returns {void}
 */
export function runMigrations(state, onChanged) {
  let changed = false;
  if (!state.schemaVersion || state.schemaVersion < 2) {
    if (!state.eventos) state.eventos = [];
    if (!state.revisoes) state.revisoes = [];
    if (!state.config) state.config = { visualizacao: 'mes', agruparEventos: true };
    if (!state.config.frequenciaRevisao) state.config.frequenciaRevisao = [1, 7, 30, 90];
    if (!state.habitos)
      state.habitos = {
        questoes: [],
        revisao: [],
        discursiva: [],
        simulado: [],
        leitura: [],
        informativo: [],
        sumula: [],
        videoaula: [],
        paginas: [],
      };

    // Add IDs where missing
    if (!state.editais) state.editais = [];
    state.editais.forEach((ed) => {
      if (!ed.id) ed.id = 'ed_' + uid();
      if (!ed.cor) ed.cor = '#8aa4bf';
      // Migration: flatten grupos into disciplinas
      if (ed.grupos && !ed.disciplinas) {
        ed.disciplinas = [];
        ed.grupos.forEach((gr) => {
          gr.disciplinas.forEach((d) => ed.disciplinas.push(d));
        });
        delete ed.grupos;
      }
      if (!ed.disciplinas) ed.disciplinas = [];
      ed.disciplinas.forEach((d) => {
        if (!d.id) d.id = 'disc_' + uid();
        if (!d.icone) d.icone = '📖';
        if (!d.assuntos) d.assuntos = [];
        d.assuntos.forEach((a) => {
          if (!a.id) a.id = 'ass_' + uid();
          if (!a.revisoesFetas) a.revisoesFetas = [];
        });
      });
    });

    state.schemaVersion = 2;
    changed = true;
  }

  if (state.schemaVersion === 2) {
    if (!state.arquivo) state.arquivo = [];
    if (state.config.frequenciaRevisao && typeof state.config.frequenciaRevisao === 'string') {
      state.config.frequenciaRevisao = state.config.frequenciaRevisao
        .split(',')
        .map(Number)
        .filter((n) => !isNaN(n));
    }
    state.schemaVersion = 3;
    changed = true;
  }

  if (state.schemaVersion === 3) {
    if (!state.ciclo) {
      state.ciclo = { ativo: false, ciclosCompletos: 0, disciplinas: [] };
    }
    state.schemaVersion = 4;
    changed = true;
  }

  if (state.schemaVersion === 4) {
    if (!state.planejamento) {
      state.planejamento = {
        ativo: false,
        tipo: null,
        disciplinas: [],
        relevancia: {},
        horarios: {},
        sequencia: [],
      };
    }
    state.schemaVersion = 5;
    changed = true;
  }

  // v5 and v6 were intermediate states — let the < 7 block below run the aulas migration
  if (state.schemaVersion === 5 || state.schemaVersion === 6) {
    changed = true;
  }

  // Normalize habitos keys
  if (state.habitos) {
    if (state.habitos.sumulas && !state.habitos.sumula) {
      state.habitos.sumula = state.habitos.sumulas;
      delete state.habitos.sumulas;
    }
    if (!state.habitos.videoaula) state.habitos.videoaula = [];
    if (!state.habitos.sumula) state.habitos.sumula = [];
    if (!state.habitos.paginas) state.habitos.paginas = [];
  }

  // Wave 39: Separation between Assuntos (Edital Topics) and Aulas (Course Materials)
  if (state.schemaVersion < 7) {
    if (!state.bancaRelevance)
      state.bancaRelevance = { hotTopics: [], userMappings: {}, lessonMappings: {} };
    if (!state.bancaRelevance.lessonMappings) state.bancaRelevance.lessonMappings = {};

    const classRegex = /(^aula\s*\d+)|(^modulo\s*\d+)/i;

    state.editais.forEach((ed) => {
      ed.disciplinas.forEach((d) => {
        if (!d.aulas) d.aulas = []; // Initialize aulas array

        // Ensure reverse link exists on old items
        d.assuntos.forEach((a) => {
          if (!a.linkedAulaIds) a.linkedAulaIds = [];
        });

        // Scan for lesson-like topics and migrate them
        const remainingAssuntos = [];
        d.assuntos.forEach((ass) => {
          if (classRegex.test(ass.nome.trim())) {
            // Is a lesson! Move to disc.aulas
            const newAula = {
              id: 'aula_' + uid(),
              legacyAssid: ass.id, // For tracking
              nome: ass.nome,
              descricao: ass.descricao || '',
              estudada: !!ass.concluido,
              dataEstudo: ass.dataConclusao || null,
              progress: 0,
              linkedAssuntoIds: [], // Will be populated by ML Mapping
              _migratedFromV6: true,
            };
            d.aulas.push(newAula);
          } else {
            // It is an actual Subject topic, keep it in assuntos
            remainingAssuntos.push(ass);
          }
        });

        d.assuntos = remainingAssuntos;
      });
    });

    state.schemaVersion = 7;
    changed = true;
  }

  // v7 → v8: Add archive flag to disciplines
  if (state.schemaVersion < 8) {
    (state.editais || []).forEach((ed) => {
      (ed.disciplinas || []).forEach((d) => {
        if (d.arquivada === undefined) d.arquivada = false;
        if (d.arquivadaEm === undefined) d.arquivadaEm = null;
      });
    });
    state.schemaVersion = 8;
    changed = true;
  }

  // v9 → v10: Manual-only sync mode. The auto-sync infrastructure was removed
  // and the user now triggers sync via a single button. We normalize the legacy
  // toggle to "paused=true" so any code paths still reading it behave manually.
  if (!state.schemaVersion || state.schemaVersion < 10) {
    if (!state.config) state.config = {};
    state.config.globalSyncPaused = true;
    state.schemaVersion = 10;
    changed = true;
  }

  // v10 → v11: Add archive flag to editais (single-principal model).
  // Mirrors the discipline archive flags (v7 → v8). The principal edital is
  // the one with arquivado=false; archived editais keep all their data.
  if (state.schemaVersion < 11) {
    (state.editais || []).forEach((ed) => {
      if (ed.arquivado === undefined) ed.arquivado = false;
      if (ed.arquivadoEm === undefined) ed.arquivadoEm = null;
    });
    state.schemaVersion = 11;
    changed = true;
  }

  if (changed) onChanged();
}
