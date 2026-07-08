// =============================================
// RETA FINAL CORE (puro, sem dependências)
// Núcleo do plano "reta final" importado por JSON: validação do payload,
// matching por nome normalizado contra os editais, rolagem "empilha no dia
// seguinte" e reconciliação de blocos com os eventos. Espelho de
// cycle-progress.js — consumido por logic/reta-final.js e pelo merge de sync
// (sync-center.js), por isso este módulo não pode importar state/app.
// =============================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Chave de nome para matching: minúsculas, sem acentos (NFD), espaços
 * colapsados. "Direito  Penal " e "direito penal" casam.
 */
export function normalizeNameKey(name) {
  if (name == null) return '';
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Valida o JSON de importação da Reta Final (schema do plano em
 * docs/plano-reta-final-multi-topico.md). Não muta o payload.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRetaFinalPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['O arquivo não contém um objeto JSON válido.'] };
  }
  if (payload.versao !== 1) {
    errors.push('Campo "versao" deve ser 1.');
  }
  if (!DATE_RE.test(String(payload.dataFinal || ''))) {
    errors.push('Campo "dataFinal" deve estar no formato YYYY-MM-DD.');
  }
  if (payload.minutosPadrao !== undefined && !isPositiveInt(payload.minutosPadrao)) {
    errors.push('Campo "minutosPadrao" deve ser um inteiro maior que zero.');
  }
  if (!Array.isArray(payload.dias) || payload.dias.length === 0) {
    errors.push('Campo "dias" deve ser uma lista com pelo menos um dia.');
    return { valid: false, errors };
  }

  payload.dias.forEach((dia, i) => {
    const rotulo = `dias[${i}]`;
    if (!dia || typeof dia !== 'object') {
      errors.push(`${rotulo}: entrada inválida.`);
      return;
    }
    if (!DATE_RE.test(String(dia.data || ''))) {
      errors.push(`${rotulo}: "data" deve estar no formato YYYY-MM-DD.`);
    } else if (DATE_RE.test(String(payload.dataFinal || '')) && dia.data > payload.dataFinal) {
      errors.push(`${rotulo}: data ${dia.data} é posterior à dataFinal.`);
    }
    if (!Array.isArray(dia.blocos) || dia.blocos.length === 0) {
      errors.push(`${rotulo}: "blocos" deve ser uma lista com pelo menos um bloco.`);
      return;
    }
    dia.blocos.forEach((bloco, j) => {
      const rotuloBloco = `${rotulo}.blocos[${j}]`;
      if (!bloco || typeof bloco !== 'object') {
        errors.push(`${rotuloBloco}: entrada inválida.`);
        return;
      }
      if (!normalizeNameKey(bloco.disciplina)) {
        errors.push(`${rotuloBloco}: "disciplina" é obrigatória.`);
      }
      const topicos = Array.isArray(bloco.topicos) ? bloco.topicos : [];
      const temTopico = topicos.some((t) => normalizeNameKey(t));
      const temAula = Boolean(normalizeNameKey(bloco.aula));
      if (!temTopico && !temAula) {
        errors.push(`${rotuloBloco}: informe ao menos um tópico ou uma aula.`);
      }
      if (bloco.minutos !== undefined && !isPositiveInt(bloco.minutos)) {
        errors.push(`${rotuloBloco}: "minutos" deve ser um inteiro maior que zero.`);
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Casa disciplinas/tópicos/aulas do payload contra os editais por nome
 * normalizado. Agrega por disciplina (nomes repetidos em dias diferentes
 * viram uma entrada só). Itens sem id serão CRIADOS na ativação — o preview
 * mostra casados × criados antes de confirmar. Função pura: não muta editais.
 */
export function matchRetaFinalToEditais(payload, editais) {
  const discIndex = new Map(); // key -> { discId, editalId, assuntos: Map, aulas: Map }
  for (const edital of editais || []) {
    // Editais arquivados ficam fora do matching: uma disciplina homônima de um
    // concurso antigo casaria primeiro e mandaria os blocos (e as aulas novas)
    // para o edital errado.
    if (edital?.arquivado) continue;
    for (const disc of edital?.disciplinas || []) {
      const key = normalizeNameKey(disc?.nome);
      if (!key || discIndex.has(key)) continue;
      const assuntos = new Map();
      for (const ass of disc.assuntos || []) {
        const assKey = normalizeNameKey(ass?.nome);
        if (assKey && !assuntos.has(assKey)) assuntos.set(assKey, ass.id);
      }
      const aulas = new Map();
      for (const aula of disc.aulas || []) {
        const aulaKey = normalizeNameKey(aula?.nome);
        if (aulaKey && !aulas.has(aulaKey)) aulas.set(aulaKey, aula.id);
      }
      discIndex.set(key, { discId: disc.id, editalId: edital.id, assuntos, aulas });
    }
  }

  const byKey = new Map();
  for (const dia of payload?.dias || []) {
    for (const bloco of dia?.blocos || []) {
      const key = normalizeNameKey(bloco?.disciplina);
      if (!key) continue;
      let entry = byKey.get(key);
      if (!entry) {
        const matched = discIndex.get(key) || null;
        entry = {
          nome: String(bloco.disciplina).trim(),
          key,
          discId: matched?.discId || null,
          editalId: matched?.editalId || null,
          topicos: [],
          aulas: [],
          _matched: matched,
          _topicoKeys: new Set(),
          _aulaKeys: new Set(),
        };
        byKey.set(key, entry);
      }
      for (const topico of Array.isArray(bloco.topicos) ? bloco.topicos : []) {
        const topicoKey = normalizeNameKey(topico);
        if (!topicoKey || entry._topicoKeys.has(topicoKey)) continue;
        entry._topicoKeys.add(topicoKey);
        entry.topicos.push({
          nome: String(topico).trim(),
          key: topicoKey,
          assId: entry._matched?.assuntos.get(topicoKey) || null,
        });
      }
      const aulaKey = normalizeNameKey(bloco.aula);
      if (aulaKey && !entry._aulaKeys.has(aulaKey)) {
        entry._aulaKeys.add(aulaKey);
        entry.aulas.push({
          nome: String(bloco.aula).trim(),
          key: aulaKey,
          aulaId: entry._matched?.aulas.get(aulaKey) || null,
        });
      }
    }
  }

  const disciplinas = Array.from(byKey.values()).map((entry) => ({
    nome: entry.nome,
    key: entry.key,
    discId: entry.discId,
    editalId: entry.editalId,
    topicos: entry.topicos,
    aulas: entry.aulas,
  }));

  const summary = {
    disciplinasCasadas: disciplinas.filter((d) => d.discId).length,
    disciplinasCriadas: disciplinas.filter((d) => !d.discId).length,
    topicosCasados: 0,
    topicosCriados: 0,
    aulasCasadas: 0,
    aulasCriadas: 0,
  };
  for (const disc of disciplinas) {
    for (const topico of disc.topicos) {
      if (topico.assId) summary.topicosCasados++;
      else summary.topicosCriados++;
    }
    for (const aula of disc.aulas) {
      if (aula.aulaId) summary.aulasCasadas++;
      else summary.aulasCriadas++;
    }
  }

  return { disciplinas, summary };
}

/**
 * Rolagem "empilha no dia seguinte": bloco pendente com data < hoje e sem
 * evento preservado move para HOJE (somando à carga do dia, sem deslocar o
 * resto; ordenação estável — entra depois dos blocos que já eram de hoje) e
 * incrementa `rolagens`. Pós-dataFinal vira `nao_coberto`. Idempotente e
 * NUNCA toca planejamento.updatedAt: cada dispositivo re-deriva a rolagem
 * (padrão anti ping-pong LWW de cycle-progress.js).
 * @param {object} retaFinal - state.planejamento.retaFinal (mutado in place)
 * @param {{ today: string, preservedBlocoIds?: Set<string> }} opts
 * @returns {{ changed: boolean, rolados: string[], naoCobertos: string[] }}
 */
export function rolloverRetaFinalBlocks(retaFinal, { today, preservedBlocoIds } = {}) {
  const result = { changed: false, rolados: [], naoCobertos: [] };
  if (!retaFinal || !Array.isArray(retaFinal.blocos) || !today) return result;
  const preserved = preservedBlocoIds || new Set();
  const aposDataFinal = Boolean(retaFinal.dataFinal) && today > retaFinal.dataFinal;

  const rolados = new Set();
  for (const bloco of retaFinal.blocos) {
    if (!bloco || bloco.status !== 'pendente') continue;
    if (!bloco.data || bloco.data >= today) continue;
    if (preserved.has(bloco.id)) continue;
    if (aposDataFinal) {
      bloco.status = 'nao_coberto';
      result.naoCobertos.push(bloco.id);
    } else {
      bloco.data = today;
      bloco.rolagens = (Number(bloco.rolagens) || 0) + 1;
      rolados.add(bloco.id);
      result.rolados.push(bloco.id);
    }
  }

  if (rolados.size > 0) {
    // Reordena para a rolagem "empilhar": o bloco rolado entra DEPOIS dos
    // blocos que já eram de hoje (ou anteriores), preservando a ordem relativa
    // de todo o resto.
    const fixos = retaFinal.blocos.filter((b) => !rolados.has(b?.id));
    let insertAt = 0;
    for (let i = 0; i < fixos.length; i++) {
      if (fixos[i]?.data && fixos[i].data <= today) insertAt = i + 1;
    }
    const movidos = retaFinal.blocos.filter((b) => rolados.has(b?.id));
    retaFinal.blocos = [...fixos.slice(0, insertAt), ...movidos, ...fixos.slice(insertAt)];
  }

  result.changed = result.rolados.length > 0 || result.naoCobertos.length > 0;
  return result;
}

/**
 * Reconciliação idempotente do status dos blocos com os eventos fornecidos:
 *  - bloco com evento `rfBlocoId` em `estudei` → `concluido` (inclusive se
 *    estava `nao_coberto` — estudo posterior conta);
 *  - bloco `concluido` sem evento de sustentação (sessão excluída/editada em
 *    outro dispositivo) reabre para `pendente`.
 * NÃO altera planejamento.updatedAt: o status é uma view materializada dos
 * eventos, re-derivável em cada dispositivo (anti ping-pong LWW).
 * @returns {{ changed: boolean, completed: string[], reopened: string[] }}
 */
export function reconcileRetaFinalWithEvents(plan, eventos) {
  const result = { changed: false, completed: [], reopened: [] };
  if (!plan?.ativo || plan.tipo !== 'reta_final') return result;
  const blocos = plan.retaFinal?.blocos;
  if (!Array.isArray(blocos) || blocos.length === 0) return result;

  const estudados = new Set();
  for (const ev of eventos || []) {
    if (ev?.rfBlocoId && ev.status === 'estudei') estudados.add(ev.rfBlocoId);
  }

  for (const bloco of blocos) {
    if (!bloco?.id) continue;
    if (estudados.has(bloco.id)) {
      if (bloco.status !== 'concluido') {
        bloco.status = 'concluido';
        result.completed.push(bloco.id);
      }
    } else if (bloco.status === 'concluido') {
      bloco.status = 'pendente';
      result.reopened.push(bloco.id);
    }
  }

  result.changed = result.completed.length > 0 || result.reopened.length > 0;
  return result;
}

/**
 * Resumo por disciplina até a dataFinal (substitui a Previsão de Sessões na
 * view da Reta Final): blocos/minutos totais, concluídos e restantes, além da
 * contagem de não cobertos. Blocos `nao_coberto` não entram nos restantes.
 */
export function computeRetaFinalSummary(retaFinal) {
  const summary = {
    porDisciplina: {},
    totalBlocos: 0,
    totalMinutos: 0,
    minutosConcluidos: 0,
    minutosRestantes: 0,
    naoCobertos: 0,
  };
  if (!retaFinal || !Array.isArray(retaFinal.blocos)) return summary;

  for (const bloco of retaFinal.blocos) {
    if (!bloco) continue;
    const minutos = Math.max(0, Math.round(Number(bloco.minutos) || 0));
    summary.totalBlocos++;
    summary.totalMinutos += minutos;
    const discId = bloco.discId || '_sem_disciplina';
    if (!summary.porDisciplina[discId]) {
      summary.porDisciplina[discId] = {
        blocos: 0,
        blocosConcluidos: 0,
        minutos: 0,
        minutosConcluidos: 0,
        minutosRestantes: 0,
      };
    }
    const disc = summary.porDisciplina[discId];
    disc.blocos++;
    disc.minutos += minutos;
    if (bloco.status === 'concluido') {
      disc.blocosConcluidos++;
      disc.minutosConcluidos += minutos;
      summary.minutosConcluidos += minutos;
    } else if (bloco.status === 'nao_coberto') {
      summary.naoCobertos++;
    } else {
      disc.minutosRestantes += minutos;
      summary.minutosRestantes += minutos;
    }
  }

  return summary;
}
