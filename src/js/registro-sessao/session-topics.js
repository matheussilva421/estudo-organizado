// =============================================
// SESSION TOPICS (puro, sem dependências)
// Núcleo do registro multi-tópico: um evento, vários tópicos/aulas em
// ev.sessao.topicos[], cada um com questões, páginas e status próprios.
// Os TOTAIS são sempre re-derivados nos campos atuais (ev.sessao.questoes/
// paginas + escalares ev.assId/aulaId = 1º item) — dashboard, histórico,
// ciclo e sessões antigas continuam funcionando SEM migração.
// =============================================

function cloneItem(item) {
  return {
    assId: item.assId || null,
    aulaId: item.aulaId || null,
    questoes: item.questoes ? { ...item.questoes } : null,
    paginas: item.paginas ? { ...item.paginas } : null,
    statusTopico: item.statusTopico || 'em_andamento',
  };
}

function isValidItem(item) {
  return Boolean(item && (item.assId || item.aulaId));
}

/**
 * Lista de tópicos de um evento: usa ev.sessao.topicos[] quando presente;
 * sessão antiga (escalares assId/aulaId) converte em topicos[] de 1 item,
 * carregando questões/páginas/status globais. Sempre retorna clones.
 * @returns {Array}
 */
export function normalizeSessionTopics(ev) {
  if (!ev) return [];
  const lista = ev.sessao?.topicos;
  if (Array.isArray(lista) && lista.length > 0) {
    return lista.filter(isValidItem).map(cloneItem);
  }
  if (ev.assId || ev.aulaId) {
    return [
      cloneItem({
        assId: ev.assId || null,
        aulaId: ev.aulaId || null,
        questoes: ev.sessao?.questoes || null,
        paginas: ev.sessao?.paginas || null,
        statusTopico: ev.sessao?.statusTopico || 'em_andamento',
      }),
    ];
  }
  return [];
}

/**
 * Soma das questões dos itens; null se nenhum item tem questões.
 * @returns {{ total: number, acertos: number, erros: number } | null}
 */
export function sumTopicQuestoes(topicos) {
  let found = false;
  const sum = { total: 0, acertos: 0, erros: 0 };
  for (const item of topicos || []) {
    const questoes = item?.questoes;
    if (!questoes || !(Number(questoes.total) > 0)) continue;
    found = true;
    sum.total += Number(questoes.total) || 0;
    sum.acertos += Number(questoes.acertos) || 0;
    sum.erros += Number(questoes.erros) || 0;
  }
  return found ? sum : null;
}

/**
 * Soma das páginas dos itens (sempre modo 'simples' — o total agregado não
 * tem início/fim); null se nenhum item tem páginas.
 * @returns {{ modo: 'simples', total: number } | null}
 */
export function sumTopicPaginas(topicos) {
  let found = false;
  let total = 0;
  for (const item of topicos || []) {
    const paginas = item?.paginas;
    if (!paginas || !(Number(paginas.total) > 0)) continue;
    found = true;
    total += Number(paginas.total) || 0;
  }
  return found ? { modo: 'simples', total } : null;
}

/**
 * Grava a lista no evento e re-deriva os campos de compatibilidade:
 * ev.assId/aulaId = 1º item; sessao.questoes/paginas = somas (com fallback
 * nos valores globais quando nenhum item tem dados); sessao.statusTopico =
 * 'finalizado' se algum item finalizado.
 * @param {object} ev - evento (mutado; ev.sessao precisa existir)
 * @param {Array} topicos
 * @param {{ questoes?: object|null, paginas?: object|null, statusTopico?: string }} [fallbackGlobals]
 */
export function applyTopicosToEvent(ev, topicos, fallbackGlobals = {}) {
  const lista = (topicos || []).filter(isValidItem).map(cloneItem);
  if (!ev.sessao) ev.sessao = {};
  ev.sessao.topicos = lista;
  ev.assId = lista[0]?.assId || null;
  ev.aulaId = lista[0]?.aulaId || null;
  ev.sessao.questoes = sumTopicQuestoes(lista) ?? fallbackGlobals.questoes ?? null;
  ev.sessao.paginas = sumTopicPaginas(lista) ?? fallbackGlobals.paginas ?? null;
  ev.sessao.statusTopico = lista.some((item) => item.statusTopico === 'finalizado')
    ? 'finalizado'
    : fallbackGlobals.statusTopico || 'em_andamento';
  return ev;
}

/**
 * Pré-preenche a lista do registro a partir de um bloco da Reta Final
 * (evento com ev.rfBlocoId): cada tópico do bloco vira um item não iniciado.
 */
export function buildTopicosFromRetaFinalBloco(bloco) {
  return (bloco?.topicos || []).filter(isValidItem).map((topico) =>
    cloneItem({
      assId: topico.assId || null,
      aulaId: topico.aulaId || null,
      statusTopico: 'nao_iniciado',
    })
  );
}
