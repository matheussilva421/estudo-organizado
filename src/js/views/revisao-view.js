/**
 * Revisão View Module
 * Renderiza página de revisões espaçadas e handlers
 */

import { showConfirm, showToast } from '../app.js?v=8.36';
import { esc, formatDate, todayStr } from '../utils.js?v=8.36';
import { scheduleSave, state } from '../store.js?v=8.36';
import {
  calcRevisionDates,
  getPendingRevisoes,
  invalidateRevCache,
  invalidatePendingRevCache,
} from '../logic.js?v=8.36';
import { getActiveDisciplinas } from '../logic.js?v=8.36';
import { renderCurrentView } from '../components.js?v=8.36';

export function getUpcomingRevisoes(days = 30) {
  const today = todayStr();
  const future = new Date();
  future.setDate(future.getDate() + days);
  const future2 = new Date(future.getTime() - future.getTimezoneOffset() * 60000);
  const futureStr = future2.toISOString().split('T')[0];
  const upcoming = [];
  for (const edital of state.editais) {
    for (const disc of edital.disciplinas || []) {
      if (disc.arquivada) continue;
      for (const ass of disc.assuntos || []) {
        if (!ass.concluido || !ass.dataConclusao) continue;
        const revDates = calcRevisionDates(
          ass.dataConclusao,
          ass.revisoesFetas || [],
          ass.adiamentos || 0
        );
        for (const rd of revDates) {
          if (rd > today && rd <= futureStr) {
            upcoming.push({
              assunto: ass,
              disc,
              edital,
              data: rd,
              revNum: (ass.revisoesFetas || []).length + 1,
            });
            break;
          }
        }
      }
    }
  }
  return upcoming.sort((a, b) => a.data.localeCompare(b.data));
}

export function renderRevisoes(el) {
  const pending = getPendingRevisoes();
  const upcoming = getUpcomingRevisoes(30);
  const today = todayStr();

  el.innerHTML = `
    <div class="rev-summary-grid">
      <div class="card rev-summary-card">
        <div class="section-label">Pendentes Hoje</div>
        <div class="rev-stat-count rev-stat-count--danger">${pending.filter((r) => r.data <= today).length}</div>
      </div>
      <div class="card rev-summary-card">
        <div class="section-label">Próx. 30 dias</div>
        <div class="rev-stat-count rev-stat-count--info">${upcoming.length}</div>
      </div>
      <div class="card rev-summary-card">
        <div class="section-label">Assuntos concluidos</div>
        <div class="rev-stat-count rev-stat-count--accent">${getActiveDisciplinas().reduce((s, { disc }) => s + (disc.assuntos || []).filter((a) => a.concluido).length, 0)}</div>
      </div>
      <div class="card rev-summary-card">
        <div class="section-label">Frequência</div>
        <div class="text-md font-bold text-primary mt-2">${(state.config.frequenciaRevisao || [1, 7, 30, 90]).join(', ')} dias</div>
      </div>
    </div>

    <div class="tabs rev-tabs" role="tablist" aria-label="Revisões">
      <button type="button" class="tab-btn active" data-action="switch-revision-tab" data-tab="pendentes" data-target="this" role="tab" aria-selected="true" aria-controls="rev-tab-pendentes">🔄 Pendentes (${pending.length})</button>
      <button type="button" class="tab-btn" data-action="switch-revision-tab" data-tab="proximas" data-target="this" role="tab" aria-selected="false" aria-controls="rev-tab-proximas">📅 Próximas 30 dias (${upcoming.length})</button>
    </div>

    <div id="rev-tab-pendentes" class="tab-content active">
      ${
        pending.length === 0
          ? `
        <div class="empty-state"><div class="icon">✅</div><h4>Nenhuma revisão pendente!</h4><p>Conclua assuntos para que as revisões sejam agendadas automaticamente.</p></div>
      `
          : pending
              .map((r) => {
                const isOverdue = r.data < today;
                const revNum = (r.assunto.revisoesFetas || []).length + 1;
                return `
          <div class="rev-item revision-card" data-revision-date="${esc(r.data)}">
            <div class="rev-days ${isOverdue ? 'overdue' : 'today'}">
              <div class="num">${revNum}ª</div>
              <div class="label">Rev</div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-md font-semibold">${esc(r.assunto.nome)}</div>
              <div class="text-base text-secondary">${esc(r.disc.nome)} • ${esc(r.edital.nome)}</div>
              <div class="text-sm mt-1 ${isOverdue ? 'text-red' : 'text-accent'}">
                ${isOverdue ? '⚠️ Atrasada' : '📅 Hoje'} • Prevista para ${formatDate(r.data)}
              </div>
            </div>
            <div class="rev-item-actions cluster-sm">
              <button type="button" class="btn btn-primary btn-sm" data-action="mark-revision" data-assunto-id="${r.assunto.id}" aria-label="Marcar revisão como feita">✅ Feita</button>
              <button type="button" class="btn btn-ghost btn-sm" data-action="postpone-revision" data-assunto-id="${r.assunto.id}" aria-label="Adiar revisão para amanhã">⏩ +1 dia</button>
              <button type="button" class="btn btn-ghost btn-sm" data-action="delete-revision" data-assunto-id="${r.assunto.id}" title="Excluir revisão" aria-label="Excluir revisão" style="color:var(--danger);">🗑️</button>
            </div>
          </div>
        `;
              })
              .join('')
      }
    </div>

    <div id="rev-tab-proximas" class="tab-content">
      ${
        upcoming.length === 0
          ? `
        <div class="empty-state"><div class="icon">📅</div><h4>Nenhuma revisão nos próximos 30 dias</h4><p>Continue estudando e concluíndo assuntos!</p></div>
      `
          : (() => {
              return upcoming
                .map((r) => {
                  const diffDays = Math.ceil(
                    (new Date(r.data + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000
                  );
                  return `
            <div class="rev-item revision-card" data-revision-date="${esc(r.data)}">
              <div class="rev-days rev-days--upcoming">
                <div class="num">${r.revNum}ª</div>
                <div class="label">Rev</div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-md font-semibold">${esc(r.assunto.nome)}</div>
                <div class="text-base text-secondary">${esc(r.disc.nome)} • ${esc(r.edital.nome)}</div>
              </div>
              <div class="text-right">
                <div class="text-base font-bold text-blue">${formatDate(r.data)}</div>
                <div class="text-sm text-muted">em ${diffDays} dia${diffDays !== 1 ? 's' : ''}</div>
              </div>
            </div>
          `;
                })
                .join('');
            })()
      }
    </div>
  `;
}

export function switchRevTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  btn?.classList.add('active');
  document.getElementById('rev-tab-pendentes').classList.toggle('active', tab === 'pendentes');
  document.getElementById('rev-tab-proximas').classList.toggle('active', tab === 'proximas');
}

export function marcarRevisao(assId) {
  for (const edital of state.editais) {
    for (const disc of edital.disciplinas || []) {
      const ass = (disc.assuntos || []).find((a) => a.id === assId);
      if (ass) {
        if (!ass.revisoesFetas) ass.revisoesFetas = [];
        ass.revisoesFetas.push(todayStr());
        invalidateRevCache();
        invalidatePendingRevCache();
        scheduleSave();
        renderCurrentView();
        showToast('Revisão registrada! ✅', 'success');
        return;
      }
    }
  }
}

export function adiarRevisao(assId) {
  for (const edital of state.editais) {
    for (const disc of edital.disciplinas || []) {
      const ass = (disc.assuntos || []).find((a) => a.id === assId);
      if (ass) {
        if (!ass.adiamentos) ass.adiamentos = 0;
        ass.adiamentos = (ass.adiamentos || 0) + 1;
        invalidateRevCache();
        invalidatePendingRevCache();
        scheduleSave();
        renderCurrentView();
        showToast('Revisão adiada por 1 dia', 'info');
        return;
      }
    }
  }
}

export function deletarRevisao(assId) {
  showConfirm(
    'Tem certeza que deseja excluir esta revisão? Isso não removerá o tópico dos concluídos, apenas a removerá da lista de revisões pendentes.',
    async () => {
      for (const edital of state.editais) {
        for (const disc of edital.disciplinas || []) {
          const ass = (disc.assuntos || []).find((a) => a.id === assId);
          if (ass) {
            if (!ass.revisoesFetas) ass.revisoesFetas = [];
            const today = todayStr();
            const maxSteps = (state.config.frequenciaRevisao || [1, 7, 30, 90]).length;
            let removed = 0;

            while (removed < maxSteps) {
              const dueDate = calcRevisionDates(
                ass.dataConclusao,
                ass.revisoesFetas,
                ass.adiamentos || 0
              ).find((rd) => rd <= today);
              if (!dueDate) break;
              ass.revisoesFetas.push(dueDate);
              removed++;
            }

            invalidateRevCache();
            invalidatePendingRevCache();
            scheduleSave();
            renderCurrentView();
            showToast('Revisão removida.', 'info');
            return;
          }
        }
      }
    },
    { label: 'Excluir', title: 'Excluir revisão' }
  );
}
