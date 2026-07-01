// =============================================
// CYCLE PROGRESS CORE (puro, sem dependências)
// Fonte única de progresso do planejamento: "todo estudo da disciplina conta".
// Consumido por logic/cycle.js (barra, previsão, agendador, save) e pelo merge
// de sync (sync-center.js) — por isso este módulo não pode importar state/app.
// =============================================

export function getSeqStatus(seq) {
  if (seq?.status) return seq.status;
  return seq?.concluido ? 'concluida' : 'pendente';
}

/**
 * Soma (em minutos) das sessões concluídas por disciplina, derivada da lista
 * de eventos fornecida. Versão pura de getStudiedMinutesByDiscipline.
 * @param {Array} eventos
 * @param {{ since?: string, discId?: string }} [opts]
 */
export function computeStudiedMinutesByDiscipline(eventos, opts = {}) {
  const { since, discId } = opts;
  const totals = {};
  for (const ev of eventos || []) {
    if (!ev || ev.status !== 'estudei') continue;
    const minutos = Math.round((Number(ev.tempoAcumulado) || 0) / 60);
    if (minutos <= 0) continue;
    if (since) {
      const evDate = ev.dataEstudo || ev.data;
      if (!evDate || evDate < since) continue;
    }
    if (discId && ev.discId !== discId) continue;
    if (!ev.discId) continue;
    totals[ev.discId] = (totals[ev.discId] || 0) + minutos;
  }
  return discId ? totals[discId] || 0 : totals;
}

/**
 * Distribui os minutos estudados por disciplina pelos passos da sequência, em
 * ordem. Passos concluídos consomem o alvo primeiro; passos pulados não
 * consomem nem recebem agenda (remaining 0). Função pura: é a FONTE ÚNICA de
 * progresso do planejamento, compartilhada por barras, Previsão, agendador e
 * reconciliação de status — toda sessão concluída da disciplina conta,
 * inclusive sessões livres sem seqId.
 * @param {Array} sequence - state.planejamento.sequencia (ou a sequência temporária em edição)
 * @param {Record<string, number>} minutosPorDisc - mapa discId -> minutos estudados
 * @returns {Record<string, { usedMins: number, remaining: number, pct: number, shouldComplete: boolean }>} mapa por seq.id
 */
export function distributeStudiedAcrossSeq(sequence, minutosPorDisc) {
  const copy = { ...(minutosPorDisc || {}) };
  const result = {};
  for (const seq of sequence || []) {
    const target = Math.max(0, Math.round(Number(seq?.minutosAlvo) || 0));
    const status = getSeqStatus(seq);
    let usedMins = 0;
    if (status === 'pulada') {
      result[seq.id] = { usedMins: 0, remaining: 0, pct: 0, shouldComplete: false };
      continue;
    }
    if (status === 'concluida') {
      usedMins = target;
      if (seq.discId && copy[seq.discId] > 0) {
        copy[seq.discId] = Math.max(copy[seq.discId] - target, 0);
      }
    } else if (seq.discId && copy[seq.discId] > 0) {
      usedMins = Math.min(target, copy[seq.discId]);
      copy[seq.discId] -= usedMins;
    }
    result[seq.id] = {
      usedMins,
      remaining: Math.max(target - usedMins, 0),
      pct: target > 0 ? (usedMins / target) * 100 : 0,
      shouldComplete: status === 'pendente' && target > 0 && usedMins >= target,
    };
  }
  return result;
}

/**
 * Reconciliação idempotente do status das etapas com o progresso derivado dos
 * eventos fornecidos:
 *  - etapa pendente cujo consumo atingiu o alvo vira `concluida` com a flag
 *    `autoConcluida` (distingue da conclusão manual);
 *  - etapa `autoConcluida` cujo consumo deixou de cobrir o alvo (sessão
 *    excluída/editada/tombstone de outro dispositivo) volta para `pendente`;
 *  - conclusões manuais (sem a flag — inclui dados legados) nunca regridem.
 * NÃO altera planejamento.updatedAt: o status auto é uma view materializada
 * dos eventos, re-derivável em cada dispositivo — reivindicar autoria aqui
 * causaria ping-pong no LWW do plano.
 * @returns {{ changed: boolean, completed: string[], reopened: string[] }}
 */
export function reconcileSequenceWithEvents(plan, eventos) {
  const result = { changed: false, completed: [], reopened: [] };
  if (!plan?.ativo || !Array.isArray(plan.sequencia) || plan.sequencia.length === 0) {
    return result;
  }

  // Sequência-sombra: etapas autoConcluida são reavaliadas como pendentes,
  // porque sua conclusão é derivada dos eventos. Conclusões manuais e puladas
  // mantêm o status real (manual consome o alvo cheio; pulada não consome).
  const shadow = plan.sequencia.map((seq) =>
    seq.autoConcluida && getSeqStatus(seq) === 'concluida'
      ? { ...seq, status: 'pendente', concluido: false }
      : seq
  );
  const sinceCiclo = (plan.dataInicioCicloAtual || '').substring(0, 10) || undefined;
  const minutosPorDisc = computeStudiedMinutesByDiscipline(eventos, { since: sinceCiclo });
  const dist = distributeStudiedAcrossSeq(shadow, minutosPorDisc);

  for (const seq of plan.sequencia) {
    const entry = dist[seq.id];
    if (!entry) continue;
    const status = getSeqStatus(seq);
    if (status === 'pendente' && entry.shouldComplete) {
      seq.status = 'concluida';
      seq.concluido = true;
      seq.autoConcluida = true;
      seq.finalizadoEm = new Date().toISOString();
      delete seq.puladaEm;
      result.completed.push(seq.id);
    } else if (status === 'concluida' && seq.autoConcluida && !entry.shouldComplete) {
      // Os eventos não sustentam mais esta conclusão derivada.
      seq.status = 'pendente';
      seq.concluido = false;
      delete seq.autoConcluida;
      delete seq.finalizadoEm;
      result.reopened.push(seq.id);
    }
  }

  result.changed = result.completed.length > 0 || result.reopened.length > 0;
  return result;
}
