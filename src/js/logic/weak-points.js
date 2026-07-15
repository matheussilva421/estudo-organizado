// =============================================
// WEAK POINTS (puro, sem dependências — não pode importar state/app)
// Agrega acertos/erros de questões por AULA a partir dos eventos
// estudados, para a aba "Pontos Fracos". Recebe todos os dados por
// parâmetro; o caller pré-calcula a data de corte (cutoffStr) para a
// função permanecer determinística.
// Cadeia de fallback dos campos de questões espelha getAggregatedStats
// (logic/progress.js): acertos||certas, erros||erradas, total derivado.
// =============================================

export const MIN_QUESTOES_CONFIAVEL = 10;

/** Faixas idênticas ao Dashboard: <50 vermelho | 50–69 amarelo | >=70 verde */
export function classifyTaxa(taxa) {
  return taxa < 50 ? 'vermelho' : taxa < 70 ? 'amarelo' : 'verde';
}

/**
 * Sugere o valor 1-5 do slider "conhecimento" do Ciclo a partir da taxa de
 * acerto medida (0-100). Nunca sugere 0: 0 significa "nunca estudou", o que é
 * incompatível com ter questões registradas.
 */
export function suggestConhecimento(taxa) {
  if (taxa === null || taxa === undefined) return null;
  if (taxa < 40) return 1;
  if (taxa < 55) return 2;
  if (taxa < 70) return 3;
  if (taxa < 85) return 4;
  return 5;
}

function readQuestoes(qs) {
  if (!qs) return null;
  const acertos = Number(qs.acertos ?? qs.certas ?? 0) || 0;
  const erros = Number(qs.erros ?? qs.erradas ?? 0) || 0;
  const total = Math.max(Number(qs.total) || 0, acertos + erros);
  if (total <= 0) return null;
  return { total, acertos, erros };
}

function addTo(bucket, qs) {
  bucket.total += qs.total;
  bucket.acertos += qs.acertos;
  bucket.erros += qs.erros;
}

function finalizeTaxa(bucket) {
  const respondidas = bucket.acertos + bucket.erros;
  bucket.total = Math.max(bucket.total, respondidas);
  if (respondidas > 0) {
    bucket.taxa = Math.round((bucket.acertos / respondidas) * 100);
    bucket.faixa = classifyTaxa(bucket.taxa);
  }
  return respondidas;
}

function byWeakness(a, b) {
  return (
    a.taxa - b.taxa || b.total - a.total || String(a.nome).localeCompare(String(b.nome), 'pt-BR')
  );
}

/** Dias inteiros entre duas datas 'YYYY-MM-DD' (to - from), via UTC — sem fuso/DST */
function daysBetween(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

/**
 * @param {object} p
 * @param {Array}  p.eventos   state.eventos
 * @param {Array}  p.arquivo   state.arquivo — percorrido SÓ quando cutoffStr é null ("Tudo")
 * @param {Array}  p.editais   state.editais
 * @param {string|null} [p.cutoffStr]  'YYYY-MM-DD'; null = sem janela (inclui arquivo)
 * @param {string|null} [p.editalFilterId]  Selecionar um edital arquivado
 *                                  específico o inclui mesmo sem includeArquivados.
 * @param {boolean} [p.includeArquivados]  true = editais arquivados entram no
 *                                  universo (disciplinas arquivadas continuam fora)
 * @param {string|null} [p.discFilterId]
 * @param {number} [p.seriesWeeks]  >0 gera `serie` por aula: taxa em blocos
 *                                  rolantes de 7 dias terminando em todayStr
 * @param {string|null} [p.todayStr] 'YYYY-MM-DD' — obrigatório com seriesWeeks
 * @returns {{ disciplinas: Array, ranking: Array,
 *             semQuestoes: Array, orfaos: {total:number,acertos:number,erros:number} }}
 */
export function computeWeakPoints({
  eventos,
  arquivo,
  editais,
  cutoffStr = null,
  editalFilterId = null,
  includeArquivados = false,
  discFilterId = null,
  seriesWeeks = 0,
  todayStr = null,
}) {
  const wantSeries = seriesWeeks > 0 && !!todayStr;
  // 1) Universo: aulas de disciplinas ativas (filtros aplicados aqui)
  const directAulaIndex = new Map(); // aulaId -> bucket da própria aula
  const uniqueAulaIdByAss = new Map(); // assId -> aulaId quando o vínculo é inequívoco
  const discIndex = new Map(); // discId -> bucket de disciplina
  const disciplinas = [];

  (editais || []).forEach((ed) => {
    if (!ed) return;
    if (editalFilterId && ed.id !== editalFilterId) return;
    if (ed.arquivado && !includeArquivados && ed.id !== editalFilterId) return;
    (ed.disciplinas || []).forEach((disc) => {
      if (!disc || disc.arquivada) return;
      if (discFilterId && disc.id !== discFilterId) return;
      const discBucket = {
        editalId: ed.id,
        editalNome: ed.nome,
        discId: disc.id,
        discNome: disc.nome,
        icone: disc.icone || '',
        cor: disc.cor || '',
        total: 0,
        acertos: 0,
        erros: 0,
        taxa: null,
        faixa: null,
        naoAtribuidas: 0,
        aulas: [],
      };
      discIndex.set(disc.id, discBucket);
      disciplinas.push(discBucket);
      (disc.assuntos || []).forEach((ass) => {
        if (!ass || !ass.id) return;
        if ((ass.linkedAulaIds || []).filter(Boolean).length === 1) {
          uniqueAulaIdByAss.set(ass.id, ass.linkedAulaIds.find(Boolean));
        }
      });
      (disc.aulas || []).forEach((aula) => {
        if (!aula || !aula.id) return;
        const bucket = {
          aulaId: aula.id,
          nome: aula.nome,
          estudada: !!aula.estudada,
          total: 0,
          acertos: 0,
          erros: 0,
          taxa: null,
          taxaAjustada: null,
          faixa: null,
          confiavel: false,
          discId: disc.id,
          discNome: disc.nome,
          editalId: ed.id,
          editalNome: ed.nome,
          icone: disc.icone || '',
          cor: disc.cor || '',
        };
        discBucket.aulas.push(bucket);
        directAulaIndex.set(aula.id, bucket);
      });
    });
  });

  const orfaos = { total: 0, acertos: 0, erros: 0 };

  function registra(assId, aulaId, qs, evDiscId, studyDate) {
    if (!qs) return;
    let bucket = aulaId ? directAulaIndex.get(aulaId) : null;
    if (!bucket && assId) {
      const linkedAulaId = uniqueAulaIdByAss.get(assId);
      bucket = linkedAulaId ? directAulaIndex.get(linkedAulaId) || null : null;
    }
    if (bucket) {
      addTo(bucket, qs);
      addTo(discIndex.get(bucket.discId), qs);
      if (wantSeries && studyDate) {
        const daysAgo = daysBetween(studyDate, todayStr);
        const week = daysAgo >= 0 ? Math.floor(daysAgo / 7) : -1;
        if (week >= 0 && week < seriesWeeks) {
          const idx = seriesWeeks - 1 - week; // antiga → recente
          if (!bucket._serieAcc) bucket._serieAcc = new Array(seriesWeeks).fill(null);
          const acc = bucket._serieAcc[idx] || (bucket._serieAcc[idx] = { acertos: 0, erros: 0 });
          acc.acertos += qs.acertos;
          acc.erros += qs.erros;
        }
      }
      return;
    }
    // Sem aula resolvida: só conta se a disciplina do evento está no universo
    const disc = evDiscId ? discIndex.get(evDiscId) : null;
    if (!disc) return;
    if (assId || aulaId) addTo(orfaos, qs); // referência inexistente ou vínculo ambíguo
    addTo(disc, qs);
    disc.naoAtribuidas += qs.total;
  }

  // 2) Passada única pelos eventos (arquivo só no modo "Tudo")
  const fonte = cutoffStr === null ? [...(eventos || []), ...(arquivo || [])] : eventos || [];
  fonte.forEach((ev) => {
    if (!ev || ev.status !== 'estudei') return;
    const studyDate = ev.dataEstudo || ev.data;
    if (cutoffStr !== null && (!studyDate || studyDate < cutoffStr)) return;
    const topicos = ev.sessao?.topicos;
    if (Array.isArray(topicos) && topicos.length > 0) {
      // topicos[] presente: ev.sessao.questoes é a soma derivada — usar SÓ os itens
      topicos.forEach((item) => {
        if (!item) return;
        registra(
          item.assId || null,
          item.aulaId || null,
          readQuestoes(item.questoes),
          ev.discId || null,
          studyDate
        );
      });
    } else {
      registra(
        ev.assId || null,
        ev.aulaId || null,
        readQuestoes(ev.sessao?.questoes || ev.questoes),
        ev.discId || null,
        studyDate
      );
    }
  });

  // 3) Derivação: taxa/faixa, taxa ajustada (média bayesiana) e partição
  // Prior p = taxa média global do universo filtrado; m = MIN_QUESTOES_CONFIAVEL.
  // taxaAjustada = (acertos + m·p) / (respondidas + m) — amostras pequenas são
  // puxadas para a média geral em vez de dominarem o topo/fundo do ranking.
  let globalAcertos = 0;
  let globalRespondidas = 0;
  disciplinas.forEach((disc) => {
    disc.aulas.forEach((bucket) => {
      globalAcertos += bucket.acertos;
      globalRespondidas += bucket.acertos + bucket.erros;
    });
  });
  const prior = globalRespondidas > 0 ? globalAcertos / globalRespondidas : 0.5;
  const m = MIN_QUESTOES_CONFIAVEL;

  const ranking = [];
  const semQuestoes = [];
  disciplinas.forEach((disc) => {
    disc.aulas.forEach((bucket) => {
      const respondidas = finalizeTaxa(bucket);
      if (bucket.total === 0) {
        semQuestoes.push({
          aulaId: bucket.aulaId,
          nome: bucket.nome,
          estudada: bucket.estudada,
          discId: bucket.discId,
          discNome: bucket.discNome,
          editalId: bucket.editalId,
          editalNome: bucket.editalNome,
        });
        return;
      }
      bucket.confiavel = bucket.total >= MIN_QUESTOES_CONFIAVEL;
      bucket.taxaAjustada =
        respondidas > 0
          ? Math.round(((bucket.acertos + m * prior) / (respondidas + m)) * 100)
          : null;
      if (wantSeries) {
        const acc = bucket._serieAcc;
        bucket.serie = Array.from({ length: seriesWeeks }, (_, i) => {
          const semana = acc ? acc[i] : null;
          const resp = semana ? semana.acertos + semana.erros : 0;
          return { taxa: resp > 0 ? Math.round((semana.acertos / resp) * 100) : null };
        });
        delete bucket._serieAcc;
      }
      ranking.push(bucket);
    });
    finalizeTaxa(disc);
  });

  ranking.sort((a, b) => {
    if (a.taxaAjustada === null || b.taxaAjustada === null)
      return (a.taxaAjustada === null) - (b.taxaAjustada === null);
    return (
      a.taxaAjustada - b.taxaAjustada ||
      b.total - a.total ||
      String(a.nome).localeCompare(String(b.nome), 'pt-BR')
    );
  });
  disciplinas.sort((a, b) => {
    if (a.taxa === null || b.taxa === null) return (a.taxa === null) - (b.taxa === null);
    return byWeakness(a, b);
  });

  return { disciplinas, ranking, semQuestoes, orfaos };
}
