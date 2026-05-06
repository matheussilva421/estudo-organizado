// =============================================
// HISTORICO DE SESSOES
// =============================================

import { state } from '../store.js?v=8.37';
import { formatDate, formatTime, esc } from '../utils.js?v=8.37';
import { getDisc } from '../logic.js?v=8.37';

export function renderHistoricoSessoes(el) {
  const eventosEstudados = [...(state.eventos || []), ...(state.arquivo || [])]
    .filter((ev) => ev && ev.status === 'estudei')
    .sort((a, b) => {
      const dateA = String(a.dataEstudo || a.data || '');
      const dateB = String(b.dataEstudo || b.data || '');
      if (dateA !== dateB) return dateB.localeCompare(dateA);

      const timeA = Number(new Date(a.updatedAt || a.createdAt || a.criadoEm || 0).getTime()) || 0;
      const timeB = Number(new Date(b.updatedAt || b.createdAt || b.criadoEm || 0).getTime()) || 0;
      return timeB - timeA;
    });

  if (eventosEstudados.length === 0) {
    el.innerHTML = `
      <div class="card p-24 session-empty-state">
        <div class="session-empty-icon">🕘</div>
        <div class="session-empty-title">Nenhuma sessão registrada ainda</div>
        <div class="session-empty-hint">Quando você finalizar uma sessão de estudo, ela aparecerá aqui para edição e exclusão.</div>
      </div>
    `;
    return;
  }

  const gruposPorData = new Map();
  eventosEstudados.forEach((ev) => {
    const dateKey = ev.dataEstudo || ev.data || '__sem_data__';
    if (!gruposPorData.has(dateKey)) gruposPorData.set(dateKey, new Map());

    const discInfo = ev.discId ? getDisc(ev.discId) : null;
    const discId = discInfo?.disc?.id || '__sem_disciplina__';

    if (!gruposPorData.get(dateKey).has(discId)) {
      gruposPorData.get(dateKey).set(discId, {
        discId,
        discNome: discInfo?.disc?.nome || 'Sem disciplina',
        discIcone: discInfo?.disc?.icone || '📚',
        discCor: discInfo?.disc?.cor || discInfo?.edital?.cor || '#64748b',
        itens: [],
      });
    }

    gruposPorData.get(dateKey).get(discId).itens.push(ev);
  });

  const dateKeys = [...gruposPorData.keys()].sort((a, b) => {
    if (a === '__sem_data__') return 1;
    if (b === '__sem_data__') return -1;
    return String(b).localeCompare(String(a));
  });

  const totalSessoes = eventosEstudados.length;
  const totalTempo = eventosEstudados.reduce(
    (sum, ev) => sum + (Number(ev.tempoAcumulado) || 0),
    0
  );

  el.innerHTML = `
    <div class="card p-16 session-history-summary">
      <div class="session-history-header">
        <div class="dash-label">HISTÓRICO GLOBAL DE SESSÕES</div>
        <div class="session-history-badges">
          <span class="badge">${totalSessoes} sessões</span>
          <span class="badge">⏱ ${formatTime(totalTempo)}</span>
        </div>
      </div>
      <div class="session-history-hint">Agrupado pela data real do estudo e por disciplina. Use "Editar" para ajustar o registro e "Apagar" para remover permanentemente.</div>
    </div>

    ${dateKeys
      .map((dateKey) => {
        const disciplinas = [...gruposPorData.get(dateKey).values()].sort((a, b) =>
          String(a.discNome).localeCompare(String(b.discNome), 'pt-BR', { sensitivity: 'base' })
        );

        const dateLabel = dateKey === '__sem_data__' ? 'Sem data' : formatDate(dateKey);
        const sessoesNoDia = disciplinas.reduce((sum, d) => sum + d.itens.length, 0);

        return `
        <section class="card p-16 session-group-section">
          <div class="session-group-header">
            <div class="session-group-title">${esc(dateLabel)}</div>
            <div class="session-group-count">${sessoesNoDia} sessão(ões)</div>
          </div>

          <div class="session-group-list">
            ${disciplinas
              .map((group) => {
                // Fallback para disciplina sem nome
                const discName =
                  group.discNome === 'Sem disciplina' || !group.discNome
                    ? 'Disciplina não vinculada'
                    : group.discNome;
                const discIcon = group.discIcone || '📚';

                const discColor = group.discCor || '#64748b';
                return `
              <div class="session-disc-card" style="--session-disc-color:${esc(discColor)};">
                <div class="session-disc-header">
                  <div class="session-disc-title">${esc(discIcon)} ${esc(discName)}</div>
                  <div class="session-disc-count">${group.itens.length} registro(s)</div>
                </div>

                <div class="custom-scrollbar session-scroll-container">
                  ${group.itens
                    .map((ev) => {
                      const questoes = ev.sessao?.questoes || ev.questoes || {};
                      const acertos = Number(questoes.acertos ?? questoes.certas ?? 0) || 0;
                      const erros = Number(questoes.erros ?? questoes.erradas ?? 0) || 0;
                      const totalExplicito = Number(questoes.total ?? questoes.quantidade);
                      const totalQuestoes =
                        Number.isFinite(totalExplicito) && totalExplicito > 0
                          ? totalExplicito
                          : acertos + erros;
                      const percAcertos =
                        totalQuestoes > 0 ? Math.round((acertos / totalQuestoes) * 100) : 0;

                      const paginasRaw = ev.sessao?.paginas;
                      const paginas =
                        Number(
                          (paginasRaw && typeof paginasRaw === 'object'
                            ? paginasRaw.total
                            : paginasRaw) ??
                            ev.paginas ??
                            0
                        ) || 0;
                      const tempoLabel = formatTime(Number(ev.tempoAcumulado) || 0);

                      const discInfo = ev.discId ? getDisc(ev.discId) : null;
                      const assunto =
                        ev.assId && discInfo?.disc?.assuntos
                          ? discInfo.disc.assuntos.find((a) => a.id === ev.assId)?.nome
                          : '';
                      const eventId = esc(String(ev.id || ''));

                      return `
                    <div class="session-detail-card">
                      <div class="session-detail-row">
                        <div class="session-detail-content">
                          <div class="session-detail-title">${esc(ev.titulo || 'Sessão de estudo')}</div>
                          ${assunto ? `<div class="session-detail-subject">Tópico: ${esc(assunto)}</div>` : ''}
                        </div>
                        <div class="session-detail-actions">
                          <button class="btn btn-ghost btn-sm session-item-btn" data-action="edit-session-record" data-session-id="${eventId}" aria-label="Editar sessão">Editar</button>
                          <button class="btn btn-ghost btn-sm session-item-btn session-item-btn-danger" data-action="delete-session-record" data-session-id="${eventId}" aria-label="Apagar sessão">Apagar</button>
                        </div>
                      </div>

                      <div class="session-item-badges">
                        <span class="badge session-item-badge">⏱ ${tempoLabel}</span>
                        <span class="badge session-item-badge">❓ ${totalQuestoes > 0 ? `${acertos}/${totalQuestoes} (${percAcertos}%)` : '-'}</span>
                        <span class="badge session-item-badge">📄 ${paginas > 0 ? paginas : '-'}</span>
                      </div>
                    </div>
                  `;
                    })
                    .join('')}
                </div>
              </div>
            `;
              })
              .join('')}
          </div>
        </section>
      `;
      })
      .join('')}
  `;
}
