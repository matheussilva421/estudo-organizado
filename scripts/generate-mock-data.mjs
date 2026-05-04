/**
 * Deterministic Mock Data Generator — Estudo Organizado
 *
 * Usage:
 *   import { generateMockState } from './scripts/generate-mock-data.mjs';
 *   const state = generateMockState('my-seed');
 *
 *   Or CLI: node scripts/generate-mock-data.mjs [--seed=my-seed]
 */

// ---------------------------------------------------------------------------
// 1. Seeded PRNG (mulberry32)
// ---------------------------------------------------------------------------

/**
 * Simple string → numeric seed hasher (djb2 variant).
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * Mulberry32 PRNG.
 * Returns a function that produces floats in [0, 1).
 */
function mulberry32(seed) {
  let s = seed | 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 2. Deterministic ID generator
// ---------------------------------------------------------------------------

/**
 * Deterministic uid() — same format as src/js/utils.js:9-11
 * Uses seeded PRNG so IDs are stable for a given seed.
 */
function makeDeterministicUid(rng, counter) {
  const baseTime = 1746316800000; // 2026-05-04T00:00:00Z
  const ts = (baseTime + counter * 1000).toString(36);
  const randPart = () => {
    const r = Math.floor(rng() * 0xffffffff);
    return r.toString(36).substring(0, 7);
  };
  return ts + randPart();
}

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------

/** Pick a random element from array. */
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Return integer in [min, max] (inclusive). */
function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Return `dateStr` offset by `days`. */
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD for today (deterministic: use fixed base date). */
function fixedToday() {
  return '2026-05-04';
}

/** ISO timestamp for given date at given hour/minute. */
function isoAt(dateStr, hour, minute) {
  const h = (hour || 0).toString().padStart(2, '0');
  const m = (minute || 0).toString().padStart(2, '0');
  return `${dateStr}T${h}:${m}:00.000Z`;
}

// ---------------------------------------------------------------------------
// 4. Data vocabularies
// ---------------------------------------------------------------------------

const EDITAL_NAMES = [
  'Concurso TRF 3ª Região',
  'CEBRASPE Analista Judiciário',
  'Concurso TJ-SP',
];

const EDITAL_COLORS = ['#0f766e', '#1d4ed8', '#b45309'];

// Brazilian law disciplines grouped by edital index
const DISCIPLINAS_POR_EDITAL = [
  // Edital 1 — TRF 3
  [
    { nome: 'Direito Constitucional', icone: '📚', cor: '#0f766e' },
    { nome: 'Direito Administrativo', icone: '🏛️', cor: '#1d4ed8' },
    { nome: 'Direito Civil', icone: '⚖️', cor: '#b45309' },
    { nome: 'Direito Processual Civil', icone: '📋', cor: '#6d28d9' },
    { nome: 'Direito Penal', icone: '🔒', cor: '#be123c' },
    { nome: 'Direito Processual Penal', icone: '🔍', cor: '#0e7490' },
    { nome: 'Direito Tributário', icone: '💰', cor: '#15803d' },
  ],
  // Edital 2 — CEBRASPE
  [
    { nome: 'Direito Constitucional', icone: '📚', cor: '#1d4ed8' },
    { nome: 'Direito Administrativo', icone: '🏛️', cor: '#0f766e' },
    { nome: 'Direito Civil', icone: '⚖️', cor: '#b45309' },
    { nome: 'Direito Processual Civil', icone: '📋', cor: '#6d28d9' },
    { nome: 'Direito Ambiental', icone: '🌿', cor: '#15803d' },
    { nome: 'Direito Previdenciário', icone: '👴', cor: '#9a3412' },
  ],
  // Edital 3 — TJ-SP
  [
    { nome: 'Direito Constitucional', icone: '📚', cor: '#b45309' },
    { nome: 'Direito Administrativo', icone: '🏛️', cor: '#0f766e' },
    { nome: 'Direito Civil', icone: '⚖️', cor: '#1d4ed8' },
    { nome: 'Direito Processual Civil', icone: '📋', cor: '#6d28d9' },
    { nome: 'Direito Penal', icone: '🔒', cor: '#be123c' },
    { nome: 'Legislação Estadual', icone: '📜', cor: '#0e7490' },
    { nome: 'Normas da Corregedoria', icone: '📐', cor: '#9a3412' },
    { nome: 'Direito Empresarial', icone: '🏢', cor: '#15803d' },
  ],
];

const ASSUNTOS_POOL = [
  // Direito Constitucional
  ['Princípios Fundamentais', 'Direitos e Garantias Fundamentais', 'Organização do Estado', 'Poder Legislativo', 'Poder Executivo', 'Poder Judiciário', 'Controle de Constitucionalidade', 'Defesa do Estado e Instituições Democráticas'],
  // Direito Administrativo
  ['Atos Administrativos', 'Licitações e Contratos', 'Serviços Públicos', 'Agentes Públicos', 'Responsabilidade Civil do Estado', 'Poder de Polícia', 'Improbidade Administrativa', 'Processo Administrativo'],
  // Direito Civil
  ['Pessoas Naturais e Jurídicas', 'Bens', 'Fatos Jurídicos', 'Obrigações', 'Contratos', 'Responsabilidade Civil', 'Direito das Coisas', 'Família e Sucessões'],
  // Direito Processual Civil
  ['Jurisdição e Competência', 'Partes e Procuradores', 'Tutela Provisória', 'Procedimento Comum', 'Recursos', 'Execução', 'Cumprimento de Sentença', 'Procedimentos Especiais'],
  // Direito Penal
  ['Princípios do Direito Penal', 'Teoria do Crime', 'Penas', 'Crimes contra a Pessoa', 'Crimes contra o Patrimônio', 'Crimes contra a Administração Pública', 'Crimes contra a Fé Pública'],
  // Direito Processual Penal
  ['Inquérito Policial', 'Ação Penal', 'Provas', 'Prisão e Liberdade Provisória', 'Procedimentos', 'Tribunal do Júri', 'Recursos'],
  // Direito Tributário
  ['Competência Tributária', 'Impostos', 'Taxas e Contribuições', 'Crédito Tributário', 'Processo Administrativo Fiscal', 'Execução Fiscal'],
  // Direito Ambiental
  ['Princípios do Direito Ambiental', 'Licenciamento Ambiental', 'Responsabilidade Ambiental', 'Áreas Protegidas', 'Política Nacional do Meio Ambiente'],
  // Direito Previdenciário
  ['Segurados', 'Benefícios Previdenciários', 'Custeio da Seguridade Social', 'Acidente do Trabalho', 'Processo Administrativo Previdenciário'],
  // Legislação Estadual
  ['Estatuto dos Servidores', 'Lei Orgânica do TJ', 'Regimento Interno', 'Código de Organização Judiciária'],
  // Normas da Corregedoria
  ['Provimentos CNJ', 'Normas Extrajudiciais', 'Fiscalização de Serviços', 'Processo Disciplinar'],
  // Direito Empresarial
  ['Empresário e Sociedade', 'Títulos de Crédito', 'Falência e Recuperação', 'Propriedade Industrial'],
];

const AULAS_POOL = [
  // Direito Constitucional
  ['Aula 01 — Princípios Fundamentais (Art. 1º ao 4º)', 'Aula 02 — Direitos Fundamentais (Art. 5º)', 'Aula 03 — Remédios Constitucionais', 'Aula 04 — Organização do Estado (Art. 18-43)'],
  // Direito Administrativo
  ['Aula 01 — Princípios da Administração Pública', 'Aula 02 — Atos Administrativos', 'Aula 03 — Licitações (Lei 14.133/21)', 'Aula 04 — Contratos Administrativos'],
  // Direito Civil
  ['Aula 01 — Pessoas Naturais', 'Aula 02 — Pessoas Jurídicas', 'Aula 03 — Bens (Art. 79-103)', 'Aula 04 — Fatos Jurídicos'],
  // Direito Processual Civil
  ['Aula 01 — Jurisdição e Competência', 'Aula 02 — Petição Inicial', 'Aula 03 — Tutela Provisória', 'Aula 04 — Audiência de Conciliação'],
  // Direito Penal
  ['Aula 01 — Princípios Penais', 'Aula 02 — Teoria do Crime', 'Aula 03 — Crime Doloso e Culposo', 'Aula 04 — Penas Privativas de Liberdade'],
  // Direito Processual Penal
  ['Aula 01 — Inquérito Policial', 'Aula 02 — Ação Penal', 'Aula 03 — Prova Testemunhal', 'Aula 04 — Prisão Cautelar'],
  // Direito Tributário
  ['Aula 01 — Competência Tributária', 'Aula 02 — Impostos Federais', 'Aula 03 — ICMS e ISS', 'Aula 04 — Processo Administrativo Fiscal'],
  // Direito Ambiental
  ['Aula 01 — Princípios do Direito Ambiental', 'Aula 02 — Licenciamento Ambiental', 'Aula 03 — EIA/RIMA', 'Aula 04 — Crimes Ambientais'],
  // Direito Previdenciário
  ['Aula 01 — Segurados do RGPS', 'Aula 02 — Aposentadorias', 'Aula 03 — Auxílios', 'Aula 04 — Pensão por Morte'],
  // Legislação Estadual
  ['Aula 01 — Estatuto dos Servidores', 'Aula 02 — Lei Orgânica do TJ-SP', 'Aula 03 — Regimento Interno'],
  // Normas da Corregedoria
  ['Aula 01 — Provimentos do CNJ', 'Aula 02 — Normas Extrajudiciais', 'Aula 03 — Código de Normas'],
  // Direito Empresarial
  ['Aula 01 — Empresário Individual', 'Aula 02 — Sociedades Limitadas', 'Aula 03 — Sociedades Anônimas'],
];

// map discipline name → index in ASSUNTOS_POOL and AULAS_POOL
const DISCIPLINE_INDEX_MAP = {
  'Direito Constitucional': 0,
  'Direito Administrativo': 1,
  'Direito Civil': 2,
  'Direito Processual Civil': 3,
  'Direito Penal': 4,
  'Direito Processual Penal': 5,
  'Direito Tributário': 6,
  'Direito Ambiental': 7,
  'Direito Previdenciário': 8,
  'Legislação Estadual': 9,
  'Normas da Corregedoria': 10,
  'Direito Empresarial': 11,
};

// ---------------------------------------------------------------------------
// 5. State builder
// ---------------------------------------------------------------------------

/** @param {string} seed */
export function generateMockState(seed = 'default') {
  const rng = mulberry32(hashString(seed));
  let counter = 0;
  const uid = () => makeDeterministicUid(rng, ++counter);

  const today = fixedToday();

  // === Build all editais with disciplinas, assuntos, and aulas ===

  const allDiscs = []; // flat list of { discObj, editalId, editalName }
  const allAssuntos = []; // flat list of { assObj, discObj, editalId }

  /** @type {Array} */
  const editais = EDITAL_NAMES.map((nome, edIdx) => {
    const edId = uid();
    const discTemplates = DISCIPLINAS_POR_EDITAL[edIdx];

    const disciplinas = discTemplates.map((dt) => {
      const discId = uid();
      const poolIdx = DISCIPLINE_INDEX_MAP[dt.nome];
      const assuntoNames = poolIdx != null ? ASSUNTOS_POOL[poolIdx] : [];
      const aulaNames = poolIdx != null ? AULAS_POOL[poolIdx] : [];

      // Pick 3-8 assuntos
      const numAssuntos = Math.min(assuntoNames.length, randInt(rng, 3, 8));
      const shuffledAssuntos = shuffleCopy(rng, assuntoNames).slice(0, numAssuntos);
      const assuntos = shuffledAssuntos.map((nome, aIdx) => {
        const assId = uid();
        const concluido = aIdx < Math.floor(numAssuntos * 0.4); // ~40% concluded
        const assObj = {
          id: assId,
          nome,
          concluido,
          dataConclusao: concluido ? addDays(today, -randInt(rng, 120, 300)) : null,
          revisoesFetas: [],
          adiamentos: 0,
          linkedAulaIds: [],
        };
        // If concluded, generate revisoesFetas
        if (concluido) {
          const numRevFeitas = randInt(rng, 0, 3);
          for (let r = 0; r < numRevFeitas; r++) {
            assObj.revisoesFetas.push(addDays(assObj.dataConclusao, (r + 1) * randInt(rng, 5, 20)));
            assObj.revisoesFetas.sort();
          }
          assObj.adiamentos = randInt(rng, 0, 2);
        }
        allAssuntos.push({ assObj, discId, editalId: edId });
        return assObj;
      });

      // Pick 2-4 aulas
      const numAulas = Math.min(aulaNames.length, randInt(rng, 2, 4));
      const shuffledAulas = shuffleCopy(rng, aulaNames).slice(0, numAulas);
      const aulas = shuffledAulas.map((nome) => {
        const aula = {
          id: uid(),
          nome,
          concluida: rng() > 0.5,
          dataConclusao: null,
        };
        if (aula.concluida) {
          aula.dataConclusao = addDays(today, -randInt(rng, 30, 200));
        }
        return aula;
      });

      // Link some aulas to assuntos
      if (assuntos.length > 0 && aulas.length > 0) {
        const assLink = assuntos[0];
        const aulaToLink = aulas[0];
        if (aulaToLink && !assLink.linkedAulaIds.includes(aulaToLink.id)) {
          assLink.linkedAulaIds.push(aulaToLink.id);
        }
      }

      const discObj = {
        id: discId,
        nome: dt.nome,
        icone: dt.icone,
        cor: dt.cor,
        assuntos,
        aulas,
      };
      allDiscs.push({ discObj, editalId: edId, editalName: nome });
      return discObj;
    });

    return { id: edId, nome, cor: EDITAL_COLORS[edIdx], disciplinas };
  });

  // Build lookup maps for referential integrity
  const discLookup = {};
  for (const { discObj } of allDiscs) {
    discLookup[discObj.id] = discObj;
  }
  const assLookup = {};
  for (const { assObj } of allAssuntos) {
    assLookup[assObj.id] = assObj;
  }

  // === Build eventos (40-80) ===

  const numEventos = randInt(rng, 50, 80);
  const eventos = [];
  const disciplinaKeys = Object.keys(discLookup);

  for (let i = 0; i < numEventos; i++) {
    const daysOffset = randInt(rng, -180, 60); // -180 (past) to +60 (future)
    const data = addDays(today, daysOffset);
    const isFuture = daysOffset > 0;
    const isVeryPast = daysOffset < -90;

    let status;
    if (isFuture) {
      status = 'agendado';
    } else if (isVeryPast) {
      status = rng() > 0.3 ? 'estudei' : 'atrasado';
    } else {
      status = rng() > 0.2 ? 'estudei' : 'atrasado';
    }

    const discId = pick(rng, disciplinaKeys);
    const disc = discLookup[discId];
    const assuntosArr = disc.assuntos || [];
    const assId = assuntosArr.length > 0 ? pick(rng, assuntosArr).id : null;

    const tipoOptions = ['conteudo', 'revisao', 'questoes'];
    const tipo = pick(rng, tipoOptions);

    const duracao = randInt(rng, 45, 180);
    const tempoAcumulado = status === 'estudei' ? duracao * 60 : 0;

    const criadoEm = isoAt(addDays(data, -randInt(rng, 1, 14)), randInt(rng, 8, 22), 0);

    eventos.push({
      id: uid(),
      titulo: (disc ? disc.nome : '') + (assId && assuntosArr.find((a) => a.id === assId) ? ' — ' + assuntosArr.find((a) => a.id === assId).nome : ''),
      data,
      dataEstudo: status === 'estudei' ? data : null,
      duracao,
      status,
      tempoAcumulado,
      tipo,
      discId,
      assId,
      habito: null,
      criadoEm,
      _timerStart: null,
    });
  }

  // Sort eventos by data
  eventos.sort((a, b) => a.data.localeCompare(b.data));

  // === Build arquivo (10-20 very old concluded events) ===

  const numArquivo = randInt(rng, 12, 20);
  const arquivo = [];
  for (let i = 0; i < numArquivo; i++) {
    const daysOffset = randInt(rng, -540, -95);
    const data = addDays(today, daysOffset);
    const discId = pick(rng, disciplinaKeys);
    const disc = discLookup[discId];
    const assuntosArr = disc.assuntos || [];
    const assId = assuntosArr.length > 0 ? pick(rng, assuntosArr).id : null;
    const tipoOptions = ['conteudo', 'revisao', 'questoes'];
    const tipo = pick(rng, tipoOptions);
    const duracao = randInt(rng, 30, 120);

    arquivo.push({
      id: uid(),
      titulo: (disc ? disc.nome : '') + (assId && assuntosArr.find((a) => a.id === assId) ? ' — ' + assuntosArr.find((a) => a.id === assId).nome : ''),
      data,
      dataEstudo: data,
      duracao,
      status: 'estudei',
      tempoAcumulado: duracao * 60,
      tipo,
      discId,
      assId,
      habito: null,
      criadoEm: isoAt(addDays(data, -randInt(rng, 1, 10)), randInt(rng, 8, 22), 0),
      _timerStart: null,
    });
  }
  arquivo.sort((a, b) => a.data.localeCompare(b.data));

  // === Build habitos (30-50 entries across all 9 types) ===

  const habitTypes = ['questoes', 'revisao', 'discursiva', 'simulado', 'leitura', 'informativo', 'sumula', 'videoaula', 'paginas'];
  const bancas = ['CESPE/CEBRASPE', 'FCC', 'VUNESP', 'FGV', 'CESGRANRIO', 'Quadrix'];
  const modos = ['treino', 'simulado'];
  const fontes = ['TEC Concursos', 'QConcursos', 'Estratégia', 'Gran Cursos', 'PDF do edital'];

  const habitos = {};
  let totalHabits = 0;
  const habitCountPerType = {};

  for (const type of habitTypes) {
    const count =
      type === 'questoes' ? randInt(rng, 5, 10) :
      type === 'videoaula' || type === 'leitura' ? randInt(rng, 3, 7) :
      type === 'simulado' ? randInt(rng, 1, 3) :
      randInt(rng, 2, 6);
    habitCountPerType[type] = count;
    totalHabits += count;
  }

  // Clamp total to 30-50 range
  const totalTarget = randInt(rng, 35, 50);
  if (totalHabits !== totalTarget) {
    const scaleFactor = totalTarget / totalHabits;
    for (const type of habitTypes) {
      habitCountPerType[type] = Math.max(1, Math.round(habitCountPerType[type] * scaleFactor));
    }
  }

  for (const type of habitTypes) {
    const count = habitCountPerType[type];
    const entries = [];
    for (let i = 0; i < count; i++) {
      const daysAgo = randInt(rng, 1, 90);
      const data = addDays(today, -daysAgo);
      const discId = pick(rng, disciplinaKeys);
      const disc = discLookup[discId];
      const assuntosArr = disc.assuntos || [];
      const assId = assuntosArr.length > 0 ? pick(rng, assuntosArr).id : null;

      const base = {
        id: uid(),
        data,
        disciplinaId: discId,
        assuntoId: assId,
        criadoEm: isoAt(addDays(data, -randInt(rng, 0, 2)), randInt(rng, 8, 22), 0),
      };

      // Type-specific fields
      switch (type) {
        case 'questoes':
          entries.push({
            ...base,
            acertos: randInt(rng, 5, 25),
            erros: randInt(rng, 1, 10),
            banca: pick(rng, bancas),
            fonte: pick(rng, fontes),
            modo: pick(rng, modos),
          });
          break;
        case 'videoaula':
          entries.push({
            ...base,
            aulas: randInt(rng, 1, 5),
            tempo: randInt(rng, 30, 180),
          });
          break;
        case 'leitura':
          entries.push({
            ...base,
            paginas: randInt(rng, 5, 50),
          });
          break;
        case 'simulado': {
          const acertos = randInt(rng, 20, 45);
          const erros = randInt(rng, 5, 20);
          entries.push({
            ...base,
            nota: Math.round((acertos / (acertos + erros)) * 100),
            acertos,
            erros,
            percentual: Math.round((acertos / (acertos + erros)) * 100),
          });
          break;
        }
        case 'discursiva':
        case 'informativo':
        case 'sumula':
          entries.push({
            ...base,
            tempo: randInt(rng, 20, 120),
            disciplinaId: discId,
            assuntoId: assId,
          });
          break;
        case 'revisao':
          entries.push({
            ...base,
            tempo: randInt(rng, 15, 90),
            disciplinaId: discId,
            assuntoId: assId,
          });
          break;
        case 'paginas':
          entries.push({
            ...base,
            paginas: randInt(rng, 10, 60),
            disciplinaId: discId,
            assuntoId: assId,
          });
          break;
        default:
          entries.push(base);
      }
    }
    habitos[type] = entries;
  }

  // === Build revisoes (20-40) ===

  const numRevisoes = randInt(rng, 25, 40);
  const revisoes = [];
  const concludedAssuntos = allAssuntos.filter((a) => a.assObj.concluido);

  for (let i = 0; i < numRevisoes; i++) {
    // Pick a concluded assunto
    let source;
    if (concludedAssuntos.length > 0 && rng() > 0.2) {
      source = pick(rng, concludedAssuntos);
    } else {
      // Pick any assunto
      const any = pick(rng, allAssuntos);
      source = any;
    }

    // Find the edital containing this disc
    let editalId = '';
    for (const edital of editais) {
      for (const disc of edital.disciplinas || []) {
        if (disc.id === source.discId) {
          editalId = edital.id;
          break;
        }
      }
      if (editalId) break;
    }
    if (!editalId) editalId = editais[0] ? editais[0].id : '';

    const daysFromNow = randInt(rng, -30, 90); // -30 (past due) to +90 (future)
    const dueDate = addDays(today, daysFromNow);
    const concluida = daysFromNow < -5 || rng() > 0.5;
    const dataConclusaoValue = concluida ? addDays(dueDate, -randInt(rng, 0, 3)) : null;

    revisoes.push({
      id: uid(),
      editalId,
      disciplinaId: source.discId,
      assuntoId: source.assObj.id,
      data: dueDate,
      concluida,
      dataConclusao: dataConclusaoValue,
      criadaEm: isoAt(addDays(dueDate, -randInt(rng, 15, 60)), randInt(rng, 8, 22), 0),
    });
  }

  revisoes.sort((a, b) => a.data.localeCompare(b.data));

  // === Build state ===

  return {
    schemaVersion: 9,
    ciclo: { ativo: false, ciclosCompletos: 0, disciplinas: [] },
    planejamento: {
      ativo: false,
      tipo: null,
      disciplinas: [],
      relevancia: {},
      horarios: {},
      sequencia: [],
      ciclosCompletos: 0,
      dataInicioCicloAtual: null,
    },
    editais,
    eventos,
    arquivo,
    habitos,
    revisoes,
    config: {
      visualizacao: 'mes',
      primeirodiaSemana: 1,
      mostrarNumeroSemana: false,
      agruparEventos: true,
      frequenciaRevisao: [1, 7, 30, 90],
      materiasPorDia: 3,
      metas: {
        horasSemana: 20,
        questoesSemana: 100,
      },
      cfSyncEnabled: false,
      firestoreSync: {
        enabled: false,
        mode: 'shadow',
        uid: null,
        lastPullAt: null,
        lastPushAt: null,
        remoteUpdatedAt: null,
        hasPendingWrites: false,
        conflict: null,
        lastError: null,
      },
    },
    cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
    bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} },
    driveFileId: null,
    lastSync: null,
  };
}

// ---------------------------------------------------------------------------
// 6. Utility — Fisher-Yates shuffle (returns new array)
// ---------------------------------------------------------------------------

function shuffleCopy(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// 7. CLI entry point
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && (
  process.argv[1].endsWith('generate-mock-data.mjs') ||
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/generate-mock-data.mjs')
);

if (isMain) {
  let seed = 'default';
  const seedArg = process.argv.find((a) => a.startsWith('--seed='));
  if (seedArg) {
    seed = seedArg.slice('--seed='.length);
  }
  const state = generateMockState(seed);
  process.stdout.write(JSON.stringify(state, null, 2));
}
