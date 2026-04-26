/**
 * Hábitos View Module
 * Renderiza e gerencia tracked de hábitos de estudo
 */

import { esc, formatDate, todayStr, uid, HABIT_TYPES, addCleanupListener } from '../utils.js?v=8.19';
import { state, scheduleSave } from '../store.js?v=8.19';
import { getAllDisciplinas, getDisc } from '../logic.js?v=8.19';
import { renderCurrentView } from '../components.js?v=8.19';
import { showConfirm, showToast, openModal } from '../app.js?v=8.19';

export const HABIT_HIST_PAGE_SIZE = 20;
export let habitHistPage = 1;
let currentHabitType = null;

/**
 * Soma total de questões em registros de hábito
 */
function sumQuestionRecords(records = []) {
  return records.reduce((sum, r) => sum + (Number(r.quantidade) || 0), 0);
}

/**
 * Soma total de páginas em registros de hábito
 */
function sumPageRecords(records = []) {
  return records.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
}

/**
 * Renderiza view de Hábitos
 * @param {HTMLElement} el - Container
 */
export function renderHabitos(el) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const cutoff2 = new Date(cutoff.getTime() - (cutoff.getTimezoneOffset() * 60000));
  const cutoffStr = cutoff2.toISOString().split('T')[0];

  el.innerHTML = `
    <div class="habit-grid">
      ${HABIT_TYPES.map(h => {
        const all = state.habitos[h.key] || [];
        const recentArr = all.filter(r => r.data >= cutoffStr);

        let total = 0;
        let recentStr = '';

        if (h.key === 'questoes') {
          total = sumQuestionRecords(all);
          recentStr = `Total acumulado`;
        } else if (h.key === 'paginas') {
          total = sumPageRecords(all);
          recentStr = `Total acumulado`;
        } else {
          total = all.length;
          recentStr = `Total acumulado`;
        }

        return `
          <div class="habit-card" data-action="open-habit-modal" data-habit-key="${h.key}">
            <div class="hc-icon">${h.icon}</div>
            <div class="hc-label">${h.label}</div>
            <div class="hc-count" data-habit-color="${h.color}">${total}</div>
            <div class="hc-sub">${recentStr}</div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="card habit-history-card">
      <div class="card-header">
        <h3>📏 Histórico de Hábitos</h3>
        <span class="text-base text-muted" id="habit-hist-count"></span>
      </div>
      <div class="card-body habit-hist-list" id="habit-hist-list">
      </div>
      <div id="habit-hist-footer" class="habit-hist-footer"></div>
    </div>
  `;
  renderHabitHistPage();
}

/**
 * Renderiza página do histórico de hábitos
 */
export function renderHabitHistPage() {
  const all = HABIT_TYPES
    .flatMap(h => (state.habitos[h.key] || []).map(r => ({ ...r, tipo: h })))
    .sort((a, b) => b.data.localeCompare(a.data));
  const total = all.length;
  const page = habitHistPage;
  const start = (page - 1) * HABIT_HIST_PAGE_SIZE;
  const end = start + HABIT_HIST_PAGE_SIZE;
  const items = all.slice(start, end);
  const totalPages = Math.max(1, Math.ceil(total / HABIT_HIST_PAGE_SIZE));

  const countEl = document.getElementById('habit-hist-count');
  if (countEl) countEl.textContent = `${total} registro(s)`;

  const listEl = document.getElementById('habit-hist-list');
  if (listEl) {
    listEl.innerHTML = items.length === 0
      ? '<div class="empty-state"><div class="icon">⚡</div><p>Nenhum hábito registrado ainda</p></div>'
      : items.map(r => {
        // Constrói informações adicionais de forma consistente
        const extraInfo = [];

        // Adiciona quantidade de questões para hábito de questões
        if (r.tipo.key === 'questoes' && (r.quantidade || r.total)) {
          extraInfo.push(`${r.quantidade || r.total} questões`);
        }

        // Adiciona páginas para hábito de páginas
        if (r.tipo.key === 'paginas' && r.total) {
          extraInfo.push(`${r.total} páginas`);
        }

        // Adiciona acertos para questões
        if (r.tipo.key === 'questoes' && r.acertos !== undefined) {
          extraInfo.push(`${r.acertos} acertos`);
        }

        // Adiciona porcentagem de acertos
        if (r.tipo.key === 'questoes' && r.total && r.total > 0) {
          const perc = Math.round((r.acertos / r.total) * 100);
          extraInfo.push(`${perc}%`);
        }

        if (r.tipo.key === 'discursiva' && r.nota !== undefined && r.nota !== '') {
          extraInfo.push(`Nota ${r.nota}`);
        }

        const extraStr = extraInfo.length > 0 ? ` • ${extraInfo.join(' • ')}` : '';

        return `
        <div class="flex border-b habit-hist-item">
          <div class="habit-item-icon">${r.tipo.icon}</div>
          <div class="flex-1">
            <div class="text-md font-semibold">${esc(r.tipo.label)}${r.descricao ? ' - ' + esc(r.descricao) : ''}</div>
            <div class="text-base text-secondary">${formatDate(r.data)}${extraStr}</div>
            ${r.gabaritoPorDisc && r.gabaritoPorDisc.length ? `
              <div class="flex-wrap gap-sm mt-1 habit-disc-tags">
                ${r.gabaritoPorDisc.map(g => `<span class="habit-disc-tag">${esc(g.discNome)}: ${g.acertos}/${g.total}</span>`).join('')}
              </div>` : ''}
          </div>
          <button class="icon-btn" data-action="delete-habit" data-type="${r.tipo.key}" data-habit-id="${r.id}">🗑️</button>
        </div>
      `;
      }).join('');
  }

  const footerEl = document.getElementById('habit-hist-footer');
  if (footerEl && total > HABIT_HIST_PAGE_SIZE) {
    footerEl.innerHTML = `
      <button class="btn btn-ghost btn-sm" data-action="set-habit-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>⇉ Anterior</button>
      <span class="text-base text-muted flex-1 text-center">Página ${page} de ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" data-action="set-habit-page" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Próxima ⇆</button>
    `;
    footerEl.style.display = 'flex';
  } else if (footerEl) {
    footerEl.style.display = 'none';
  }
}

/**
 * Navega para página do histórico
 */
export function setHabitPage(p) {
  const all = HABIT_TYPES.flatMap(h => (state.habitos[h.key] || []).map(r => ({ ...r, tipo: h })));
  const totalPages = Math.max(1, Math.ceil(all.length / HABIT_HIST_PAGE_SIZE));
  habitHistPage = Math.max(1, Math.min(p, totalPages));
  renderHabitHistPage();
  document.getElementById('habit-hist-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Abre modal de registro de hábito
 */
export function openHabitModal(tipo) {
  currentHabitType = tipo;
  const h = tipo ? HABIT_TYPES.find(ht => ht.key === tipo) : null;
  const titleEl = document.getElementById('modal-habit-title');
  if (titleEl) titleEl.textContent = h ? `Registrar: ${h.label}` : 'Registrar Hábito';

  const discOptions = getAllDisciplinas().map(d => `<option value="${d.disc.id}">${esc(d.disc.nome)}</option>`).join('');

  const habitBody = document.getElementById('modal-habit-body');
  if (!habitBody) return;
  habitBody.innerHTML = `
    ${!tipo ? `
      <div class="form-group">
        <label class="form-label">Tipo de Hábito</label>
        <div class="event-type-grid">
          ${HABIT_TYPES.map(h => `
            <div class="event-type-card" data-action="select-habit-type" data-tipo="${h.key}">
              <div class="et-icon">${h.icon}</div>
              <div class="et-label">${h.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    <div class="form-group">
      <label class="form-label">Data</label>
      <input type="date" class="form-control" id="habit-data" value="${todayStr()}">
    </div>
    ${tipo === 'questoes' ? `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Quantidade de Questões</label>
          <input type="number" class="form-control" id="habit-qtd" value="10" min="1">
        </div>
        <div class="form-group">
          <label class="form-label">Acertos</label>
          <input type="number" class="form-control" id="habit-acertos" value="0" min="0">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Disciplina</label>
        <select class="form-control" id="habit-disc">${discOptions}</select>
      </div>
    ` : tipo === 'simulado' ? `
      <div class="form-group">
        <label class="form-label">Nome do Simulado</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Ex: Simulado CEBRASPE 01">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Total de Questões</label>
          <input type="number" class="form-control" id="habit-total" value="120" data-action="calc-simulado-perc">
        </div>
        <div class="form-group">
          <label class="form-label">Acertos (Geral)</label>
          <input type="number" class="form-control" id="habit-acertos" value="0" min="0" data-action="calc-simulado-perc">
        </div>
      </div>
      <div id="sim-perc" class="simulado-perc"></div>

      <details>
        <summary class="simulado-disc-summary">📈 Gabarito por Disciplina (opcional)</summary>
        <div id="sim-disc-list" class="simulado-disc-list">
          ${getAllDisciplinas().map(({ disc, edital }) => `
            <div class="simulado-disc-row">
              <span class="simulado-disc-name" title="${esc(edital.nome)}">${disc.icone || '📚'} ${esc(disc.nome)}</span>
              <input type="number" class="form-control simulado-disc-input" placeholder="Total" id="sim-total-${disc.id}" min="0">
              <span class="simulado-disc-separator">/</span>
              <input type="number" class="form-control simulado-disc-input" placeholder="Acertos" id="sim-acertos-${disc.id}" min="0">
            </div>
          `).join('')}
          ${getAllDisciplinas().length === 0 ? '<div class="simulado-empty">Cadastre disciplinas para usar o gabarito detalhado.</div>' : ''}
        </div>
      </details>
    ` : tipo === 'discursiva' ? `
      <div class="form-group">
        <label class="form-label">Tema</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Tema da discursiva">
      </div>
      <div class="form-group">
        <label class="form-label">Nota/Pontuação (opcional)</label>
        <input type="number" class="form-control" id="habit-nota" placeholder="Ex: 8.5">
      </div>
    ` : tipo === 'leitura' ? `
      <div class="form-group">
        <label class="form-label">Título / Legislação</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Ex: Lei 8.112/1990">
      </div>
      <div class="form-group">
        <label class="form-label">Páginas/Artigos lidos</label>
        <input type="number" class="form-control" id="habit-paginas" placeholder="Ex: 30">
      </div>
    ` : `
      <div class="form-group">
        <label class="form-label">Descrição (opcional)</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Observações">
      </div>
    `}
  `;

  openModal('modal-habit');
}

/**
 * Seleciona tipo de hábito no modal
 */
export function selectHabitType(tipo, el) {
  currentHabitType = tipo;
  const all = document.querySelectorAll('.event-type-card');
  all.forEach(card => card.classList.remove('selected'));
  el.closest('.event-type-card')?.classList.add('selected');
}

/**
 * Salva registro de hábito
 */
export function saveHabit() {
  const data = document.getElementById('habit-data')?.value;
  if (!data) { showToast('Data é obrigatória', 'error'); return; }
  if (!currentHabitType) { showToast('Selecione o tipo de hábito', 'error'); return; }

  const registro = { id: uid(), data, tipo: currentHabitType };

  if (currentHabitType === 'questoes') {
    const quantidade = parseInt(document.getElementById('habit-qtd')?.value || '0');
    const acertos = parseInt(document.getElementById('habit-acertos')?.value || '0');
    const discId = document.getElementById('habit-disc')?.value;
    if (!quantidade) { showToast('Quantidade de questões é obrigatória', 'error'); return; }
    registro.quantidade = quantidade;
    registro.acertos = acertos;
    if (discId) {
      const d = getDisc(discId);
      registro.gabaritoPorDisc = [{ discId, discNome: d.disc.nome, total: quantidade, acertos }];
    }
  } else if (currentHabitType === 'simulado') {
    registro.descricao = document.getElementById('habit-desc')?.value || '';
    const total = parseInt(document.getElementById('habit-total')?.value || '0');
    const acertos = parseInt(document.getElementById('habit-acertos')?.value || '0');
    const gabaritoPorDisc = [];
    getAllDisciplinas().forEach(({ disc }) => {
      const t = parseInt(document.getElementById(`sim-total-${disc.id}`)?.value || '0');
      const a = parseInt(document.getElementById(`sim-acertos-${disc.id}`)?.value || '0');
      if (t > 0) gabaritoPorDisc.push({ discId: disc.id, discNome: disc.nome, total: t, acertos: a });
    });
    registro.quantidade = total;
    registro.acertos = acertos;
    registro.total = total;
    if (gabaritoPorDisc.length > 0) registro.gabaritoPorDisc = gabaritoPorDisc;
  } else if (currentHabitType === 'discursiva') {
    registro.descricao = document.getElementById('habit-desc')?.value || '';
    registro.nota = document.getElementById('habit-nota')?.value || '';
  } else if (currentHabitType === 'leitura') {
    registro.descricao = document.getElementById('habit-desc')?.value || '';
    registro.total = parseInt(document.getElementById('habit-paginas')?.value || '0');
  } else {
    registro.descricao = document.getElementById('habit-desc')?.value || '';
  }

  if (!state.habitos[currentHabitType]) state.habitos[currentHabitType] = [];
  state.habitos[currentHabitType].push(registro);
  habitHistPage = 1;
  scheduleSave();
  closeModal('modal-habit');
  renderCurrentView();
  document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Hábito registrado!', type: 'success' } }));
}

/**
 * Calcula percentual de aproveitamento do simulado
 */
export function calcSimuladoPerc() {
  const tot = parseInt(document.getElementById('habit-total')?.value || '0');
  const ace = parseInt(document.getElementById('habit-acertos')?.value || '0');
  const el = document.getElementById('sim-perc');
  if (!el || !tot) return;
  const pct = Math.round(ace / tot * 100);
  const colorClass = pct >= 70 ? 'text-accent' : pct >= 50 ? 'text-orange' : 'text-red';
  el.innerHTML = `<span class="${esc(colorClass)}">${esc(pct)}% de aproveitamento (${esc(ace)}/${esc(tot)})</span>`;
}

/**
 * Exclui registro de hábito
 */
export function deleteHabito(tipo, id) {
  showConfirm('Excluir este registro de hábito?', () => {
    state.habitos[tipo] = (state.habitos[tipo] || []).filter(h => h.id !== id);
    habitHistPage = 1;
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir', title: 'Excluir registro' });
}

function closeModal(modalId) {
  if (typeof window.EstudoApp?.closeModal === 'function') {
    window.EstudoApp.closeModal(modalId);
  }
}

// Legacy global exports (to be removed in v9.0)
window.renderHabitos = renderHabitos;
window.renderHabitHistPage = renderHabitHistPage;
window.setHabitPage = setHabitPage;
window.openHabitModal = openHabitModal;
window.selectHabitType = selectHabitType;
window.saveHabit = saveHabit;
window.calcSimuladoPerc = calcSimuladoPerc;
window.deleteHabito = deleteHabito;
