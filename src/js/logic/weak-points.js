// =============================================
// WEAK POINTS (puro, sem dependências — não pode importar state/app)
// Agrega acertos/erros de questões por ASSUNTO a partir dos eventos
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

/**
 * @param {object} p
 * @param {Array}  p.eventos   state.eventos
 * @param {Array}  p.arquivo   state.arquivo — percorrido SÓ quando cutoffStr é null ("Tudo")
 * @param {Array}  p.editais   state.editais
 * @param {string|null} [p.cutoffStr]  'YYYY-MM-DD'; null = sem janela (inclui arquivo)
 * @param {string|null} [p.editalFilterId]
 * @param {string|null} [p.discFilterId]
 * @returns {{ disciplinas: Array, ranking: Array,
 *             semQuestoes: Array, orfaos: {total:number,acertos:number,erros:number} }}
 */
export function computeWeakPoints({
  eventos,
  arquivo,
  editais,
  cutoffStr = null,
  editalFilterId = null,
  discFilterId = null,
}) {
  // 1) Universo: disciplinas/assuntos ativos (filtros aplicados aqui)
  const assIndex = new Map(); // assId -> bucket de assunto
  const aulaIndex = new Map(); // aulaId (linkedAulaIds) -> bucket de assunto
  const discIndex = new Map(); // discId -> bucket de disciplina
  const disciplinas = [];

  (editais || []).forEach((ed) => {
    if (!ed || ed.arquivado) return;
    if (editalFilterId && ed.id !== editalFilterId) return;
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
        assuntos: [],
      };
      discIndex.set(disc.id, discBucket);
      disciplinas.push(discBucket);
      (disc.assuntos || []).forEach((ass) => {
        if (!ass || !ass.id) return;
        const bucket = {
          assId: ass.id,
          nome: ass.nome,
          concluido: !!ass.concluido,
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
        discBucket.assuntos.push(bucket);
        assIndex.set(ass.id, bucket);
        (ass.linkedAulaIds || []).forEach((aulaId) => {
          if (aulaId && !aulaIndex.has(aulaId)) aulaIndex.set(aulaId, bucket);
        });
      });
    });
  });

  const orfaos = { total: 0, acertos: 0, erros: 0 };

  function registra(assId, aulaId, qs, evDiscId) {
    if (!qs) return;
    let bucket = assId ? assIndex.get(assId) : null;
    if (!bucket && aulaId) bucket = aulaIndex.get(aulaId) || null;
    if (bucket) {
      addTo(bucket, qs);
      addTo(discIndex.get(bucket.discId), qs);
      return;
    }
    // Sem assunto identificável: só conta se a disciplina do evento está no universo
    const disc = evDiscId ? discIndex.get(evDiscId) : null;
    if (!disc) return;
    if (assId || aulaId) addTo(orfaos, qs); // referência a assunto/aula que não existe mais
    addTo(disc, qs);
    disc.naoAtribuidas += qs.total;
  }

  // 2) Passada única pelos eventos (arquivo só no modo "Tudo")
  const fonte =
    cutoffStr === null ? [...(eventos || []), ...(arquivo || [])] : eventos || [];
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
          ev.discId || null
        );
      });
    } else {
      registra(
        ev.assId || null,
        ev.aulaId || null,
        readQuestoes(ev.sessao?.questoes || ev.questoes),
        ev.discId || null
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
    disc.assuntos.forEach((bucket) => {
      globalAcertos += bucket.acertos;
      globalRespondidas += bucket.acertos + bucket.erros;
    });
  });
  const prior = globalRespondidas > 0 ? globalAcertos / globalRespondidas : 0.5;
  const m = MIN_QUESTOES_CONFIAVEL;

  const ranking = [];
  const semQuestoes = [];
  disciplinas.forEach((disc) => {
    disc.assuntos.forEach((bucket) => {
      const respondidas = finalizeTaxa(bucket);
      if (bucket.total === 0) {
        semQuestoes.push({
          assId: bucket.assId,
          nome: bucket.nome,
          concluido: bucket.concluido,
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
