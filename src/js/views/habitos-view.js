/**
 * Hábitos View Module
 * Renderiza e gerencia tracked de hábitos de estudo
 */

import {
  esc,
  formatDate,
  todayStr,
  uid,
  HABIT_TYPES,
  renderSparkline,
} from '../utils.js?v=8.37';
import { state, scheduleSave } from '../store.js?v=8.37';
import { getActiveDisciplinas, getDisc } from '../logic.js?v=8.37';
import { renderCurrentView } from '../components.js?v=8.37';
import { showConfirm, showToast, openModal, closeModal as appCloseModal } from '../app.js?v=8.37';

export const HABIT_HIST_PAGE_SIZE = 20;
export let habitHistPage = 1;
let currentHabitType = null;

function getQuestionTotal(record) {
  if (!record) return 0;
  const explicit = Number(record.total ?? record.quantidade);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const acertos = Number(record.acertos ?? record.certas ?? 0);
  const erros = Number(record.erros ?? record.erradas ?? 0);
  const derived = acertos + erros;
  if (Number.isFinite(derived) && derived > 0) return derived;

  const ev = (state.eventos || []).find((e) => e.id === record.eventoId);
  const qs = ev?.sessao?.questoes || ev?.questoes;
  if (!qs) return 0;
  const eventTotal = Number(
    qs.total ?? qs.quantidade ?? (qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0)
  );
  return Number.isFinite(eventTotal) && eventTotal > 0 ? eventTotal : 0;
}

function getPagesTotal(record) {
  if (!record) return 0;
  const rawPages = record.paginas;
  const pagesValue = rawPages && typeof rawPages === 'object' ? rawPages.total : rawPages;
  const total = Number(record.total ?? pagesValue ?? record.quantidade ?? record.paginasLidas ?? 0);
  if (Number.isFinite(total) && total > 0) return total;

  const ev = (state.eventos || []).find((e) => e.id === record.eventoId);
  const evPages = ev?.sessao?.paginas;
  const eventTotal = Number(
    (evPages && typeof evPages === 'object' ? evPages.total : evPages) ?? ev?.paginas ?? 0
  );
  return Number.isFinite(eventTotal) && eventTotal > 0 ? eventTotal : 0;
}

function getVideoMinutes(record) {
  if (!record) return 0;
  const total = Number(record.tempoMin ?? record.tempo ?? record.minutos ?? record.duracaoMin);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

function getVideoLessons(record) {
  if (!record) return 0;
  const total = Number(record.aulas ?? record.quantidade ?? record.total);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

function sumQuestionRecords(records = []) {
  return records.reduce((sum, r) => sum + getQuestionTotal(r), 0);
}

function sumPageRecords(records = []) {
  return records.reduce((sum, r) => sum + getPagesTotal(r), 0);
}

function sumVideoMinutes(records = []) {
  return records.reduce((sum, r) => sum + getVideoMinutes(r), 0);
}

function sumVideoLessons(records = []) {
  return records.reduce((sum, r) => sum + getVideoLessons(r), 0);
}

/**
 * Computa série diária de um hábito nos últimos N dias.
 * Para 'questoes' soma .quantidade, para 'paginas' soma .total, demais: count.
 */
function buildHabitSeries(habitKey, records, days = 7) {
  const series = new Array(days).fill(0);
  const today = todayStr();
  const todayDate = new Date(today + 'T00:00:00');
  for (const r of records) {
    if (!r?.data) continue;
    const dt = new Date(r.data + 'T00:00:00');
    const diff = Math.round((todayDate - dt) / 86400000);
    if (diff < 0 || diff >= days) continue;
    const idx = days - 1 - diff;
    if (habitKey === 'questoes') series[idx] += getQuestionTotal(r);
    else if (habitKey === 'paginas' || habitKey === 'leitura') series[idx] += getPagesTotal(r);
    else if (habitKey === 'videoaula') series[idx] += getVideoMinutes(r) || getVideoLessons(r) || 1;
    else series[idx] += 1;
  }
  return series;
}

/**
 * Streak = dias consecutivos com pelo menos 1 registro, terminando hoje OU ontem.
 */
function computeHabitStreak(records) {
  if (!records || records.length === 0) return 0;
  const dates = new Set(records.map((r) => r.data).filter(Boolean));
  let streak = 0;
  // `cursor` is local midnight (constructed from local date string).
  // Format it back to YYYY-MM-DD using local components — calling toISOString
  // would shift to UTC and produce a wrong date in negative timezones.
  const cursor = new Date(todayStr() + 'T00:00:00');
  const formatLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  let started = false;
  for (let i = 0; i < 365; i++) {
    const ds = formatLocal(cursor);
    if (dates.has(ds)) {
      streak += 1;
      started = true;
    } else if (started) {
      break;
    } else if (i > 0) {
      // permite gap apenas no dia atual (não estudei hoje ainda)
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Renderiza view de Hábitos
 * @param {HTMLElement} el - Container
 */
export function renderHabitos(el) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoff2 = new Date(cutoff.getTime() - cutoff.getTimezoneOffset() * 60000);
  const cutoffStr = cutoff2.toISOString().split('T')[0];

  el.innerHTML = `
    <div class="habit-grid">
      ${HABIT_TYPES.map((h) => {
        const all = state.habitos[h.key] || [];
        const _recentArr = all.filter((r) => r.data >= cutoffStr);

        let total, recentStr;

        if (h.key === 'questoes') {
          total = sumQuestionRecords(all);
          recentStr = 'questões acumuladas';
        } else if (h.key === 'paginas' || h.key === 'leitura') {
          total = sumPageRecords(all);
          recentStr = 'páginas acumuladas';
        } else if (h.key === 'videoaula') {
          const minutes = sumVideoMinutes(all);
          total = minutes || sumVideoLessons(all) || all.length;
          recentStr = minutes ? 'min acumulados' : total === all.length ? 'registros acumulados' : 'aulas acumuladas';
        } else {
          total = all.length;
          recentStr = h.key === 'simulado' ? 'simulados registrados' : 'registros acumulados';
        }

        const series = buildHabitSeries(h.key, all, 7);
        const sparkline = renderSparkline(series, {
          width: 90,
          height: 22,
          stroke: h.color,
          fill: true,
        });
        const streak = computeHabitStreak(all);
        const streakBadge =
          streak > 0
            ? `<div class="hc-streak" title="Sequência de dias com registro">🔥 ${streak}d</div>`
            : '';

        return `
          <div class="habit-card" data-action="open-habit-modal" data-habit-key="${h.key}" role="button" tabindex="0" aria-label="Registrar ${h.label}">
            <div class="hc-icon">${h.icon}</div>
            <div class="hc-label">${h.label}</div>
            <div class="hc-count" data-habit-color="${h.color}">${total}</div>
            <div class="hc-sub">${recentStr}</div>
            <div class="hc-spark" style="color:${h.color};margin-top:6px;">${sparkline}</div>
            ${streakBadge}
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
  const all = HABIT_TYPES.flatMap((h) =>
    (state.habitos[h.key] || []).map((r) => ({ ...r, tipo: h }))
  ).sort((a, b) => b.data.localeCompare(a.data));
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / HABIT_HIST_PAGE_SIZE));
  // Exclusões podem deixar a página atual fora do range — clampa antes de fatiar.
  if (habitHistPage > totalPages) habitHistPage = totalPages;
  const page = habitHistPage;
  const start = (page - 1) * HABIT_HIST_PAGE_SIZE;
  const end = start + HABIT_HIST_PAGE_SIZE;
  const items = all.slice(start, end);

  const countEl = document.getElementById('habit-hist-count');
  if (countEl) countEl.textContent = `${total} registro(s)`;

  const listEl = document.getElementById('habit-hist-list');
  if (listEl) {
    listEl.innerHTML =
      items.length === 0
        ? '<div class="empty-state"><div class="icon">⚡</div><p>Nenhum hábito registrado ainda</p></div>'
        : items
            .map((r) => {
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

              // Adiciona porcentagem de acertos — registros manuais usam `quantidade`,
              // registros vindos do registro de sessão usam `total`.
              const totQuestoes = Number(r.total ?? r.quantidade) || 0;
              const acertosNum = Number(r.acertos);
              if (r.tipo.key === 'questoes' && totQuestoes > 0 && Number.isFinite(acertosNum)) {
                const perc = Math.round((acertosNum / totQuestoes) * 100);
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
            ${
              r.gabaritoPorDisc && r.gabaritoPorDisc.length
                ? `
              <div class="flex-wrap gap-sm mt-1 habit-disc-tags">
                ${r.gabaritoPorDisc.map((g) => `<span class="habit-disc-tag">${esc(g.discNome)}: ${g.acertos}/${g.total}</span>`).join('')}
              </div>`
                : ''
            }
          </div>
          <button class="icon-btn" data-action="delete-habit" data-type="${r.tipo.key}" data-habit-id="${r.id}" aria-label="Excluir hábito">🗑️</button>
        </div>
      `;
            })
            .join('');
  }

  const footerEl = document.getElementById('habit-hist-footer');
  if (footerEl && total > HABIT_HIST_PAGE_SIZE) {
    footerEl.innerHTML = `
      <button class="btn btn-ghost btn-sm" data-action="set-habit-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="text-base text-muted flex-1 text-center">Página ${page} de ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" data-action="set-habit-page" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Próxima →</button>
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
  const all = HABIT_TYPES.flatMap((h) =>
    (state.habitos[h.key] || []).map((r) => ({ ...r, tipo: h }))
  );
  const totalPages = Math.max(1, Math.ceil(all.length / HABIT_HIST_PAGE_SIZE));
  habitHistPage = Math.max(1, Math.min(p, totalPages));
  renderHabitHistPage();
  document
    .getElementById('habit-hist-list')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Abre modal de registro de hábito
 */
export function openHabitModal(tipo) {
  currentHabitType = tipo;
  const h = tipo ? HABIT_TYPES.find((ht) => ht.key === tipo) : null;
  const titleEl = document.getElementById('modal-habit-title');
  if (titleEl) titleEl.textContent = h ? `Registrar: ${h.label}` : 'Registrar Hábito';

  const discOptions = getActiveDisciplinas()
    .map((d) => `<option value="${d.disc.id}">${esc(d.disc.nome)}</option>`)
    .join('');

  const habitBody = document.getElementById('modal-habit-body');
  if (!habitBody) return;
  habitBody.innerHTML = `
    ${
      !tipo
        ? `
      <div class="form-group">
        <label class="form-label">Tipo de Hábito</label>
        <div class="event-type-grid">
          ${HABIT_TYPES.map(
            (h) => `
            <div class="event-type-card" data-action="select-habit-type" data-tipo="${h.key}" role="button" tabindex="0" aria-label="Tipo ${h.label}">
              <div class="et-icon">${h.icon}</div>
              <div class="et-label">${h.label}</div>
            </div>
          `
          ).join('')}
        </div>
      </div>
    `
        : ''
    }
    <div class="form-group">
      <label class="form-label">Data</label>
      <input type="date" class="form-control" id="habit-data" value="${todayStr()}">
    </div>
    ${
      tipo === 'questoes'
        ? `
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
    `
        : tipo === 'simulado'
          ? `
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
          ${getActiveDisciplinas()
            .map(
              ({ disc, edital }) => `
            <div class="simulado-disc-row">
              <span class="simulado-disc-name" title="${esc(edital.nome)}">${disc.icone || '📚'} ${esc(disc.nome)}</span>
              <input type="number" class="form-control simulado-disc-input" placeholder="Total" id="sim-total-${disc.id}" min="0">
              <span class="simulado-disc-separator">/</span>
              <input type="number" class="form-control simulado-disc-input" placeholder="Acertos" id="sim-acertos-${disc.id}" min="0">
            </div>
          `
            )
            .join('')}
          ${getActiveDisciplinas().length === 0 ? '<div class="simulado-empty">Cadastre disciplinas para usar o gabarito detalhado.</div>' : ''}
        </div>
      </details>
    `
          : tipo === 'discursiva'
            ? `
      <div class="form-group">
        <label class="form-label">Tema</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Tema da discursiva">
      </div>
      <div class="form-group">
        <label class="form-label">Nota/Pontuação (opcional)</label>
        <input type="number" class="form-control" id="habit-nota" placeholder="Ex: 8.5">
      </div>
    `
            : tipo === 'leitura'
              ? `
      <div class="form-group">
        <label class="form-label">Título / Legislação</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Ex: Lei 8.112/1990">
      </div>
      <div class="form-group">
        <label class="form-label">Páginas/Artigos lidos</label>
        <input type="number" class="form-control" id="habit-paginas" placeholder="Ex: 30">
      </div>
    `
              : `
      <div class="form-group">
        <label class="form-label">Descrição (opcional)</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Observações">
      </div>
    `
    }
  `;

  openModal('modal-habit');
}

/**
 * Seleciona tipo de hábito no modal
 */
export function selectHabitType(tipo, el) {
  currentHabitType = tipo;
  const all = document.querySelectorAll('.event-type-card');
  all.forEach((card) => card.classList.remove('selected'));
  el.closest('.event-type-card')?.classList.add('selected');

  const h = HABIT_TYPES.find((ht) => ht.key === tipo);
  const titleEl = document.getElementById('modal-habit-title');
  if (titleEl && h) titleEl.textContent = `Registrar: ${h.label}`;
}

/**
 * Salva registro de hábito
 */
export function saveHabit() {
  const data = document.getElementById('habit-data')?.value;
  if (!data) {
    showToast('Data é obrigatória', 'error');
    return;
  }
  if (!currentHabitType) {
    showToast('Selecione o tipo de hábito', 'error');
    return;
  }

  const registro = { id: uid(), data, tipo: currentHabitType };

  if (currentHabitType === 'questoes') {
    const quantidade = parseInt(document.getElementById('habit-qtd')?.value || '0');
    const acertos = parseInt(document.getElementById('habit-acertos')?.value || '0');
    const discId = document.getElementById('habit-disc')?.value;
    if (!quantidade || quantidade < 0) {
      showToast('Quantidade de questões é obrigatória', 'error');
      return;
    }
    if (acertos < 0 || acertos > quantidade) {
      showToast('Acertos deve estar entre 0 e a quantidade de questões', 'error');
      return;
    }
    registro.quantidade = quantidade;
    registro.acertos = acertos;
    if (discId) {
      const d = getDisc(discId);
      if (d) {
        registro.gabaritoPorDisc = [{ discId, discNome: d.disc.nome, total: quantidade, acertos }];
      }
    }
  } else if (currentHabitType === 'simulado') {
    registro.descricao = document.getElementById('habit-desc')?.value || '';
    const total = parseInt(document.getElementById('habit-total')?.value || '0');
    const acertos = parseInt(document.getElementById('habit-acertos')?.value || '0');
    if (total < 0 || acertos < 0 || acertos > total) {
      showToast('Acertos deve estar entre 0 e o total do simulado', 'error');
      return;
    }
    const gabaritoPorDisc = [];
    for (const { disc } of getActiveDisciplinas()) {
      const t = parseInt(document.getElementById(`sim-total-${disc.id}`)?.value || '0');
      const a = parseInt(document.getElementById(`sim-acertos-${disc.id}`)?.value || '0');
      if (t > 0 && (a < 0 || a > t)) {
        showToast(`Acertos de ${disc.nome} deve estar entre 0 e o total da disciplina`, 'error');
        return;
      }
      if (t > 0)
        gabaritoPorDisc.push({ discId: disc.id, discNome: disc.nome, total: t, acertos: a });
    }
    registro.quantidade = total;
    registro.acertos = acertos;
    registro.total = total;
    if (gabaritoPorDisc.length > 0) registro.gabaritoPorDisc = gabaritoPorDisc;
  } else if (currentHabitType === 'discursiva') {
    registro.descricao = document.getElementById('habit-desc')?.value || '';
    registro.nota = document.getElementById('habit-nota')?.value || '';
  } else if (currentHabitType === 'leitura') {
    registro.descricao = document.getElementById('habit-desc')?.value || '';
    const paginas = parseInt(document.getElementById('habit-paginas')?.value || '0');
    if (paginas < 0) {
      showToast('Páginas não podem ser negativas', 'error');
      return;
    }
    registro.total = paginas;
  } else {
    registro.descricao = document.getElementById('habit-desc')?.value || '';
  }

  if (!state.habitos[currentHabitType]) state.habitos[currentHabitType] = [];
  state.habitos[currentHabitType].push(registro);
  habitHistPage = 1;
  scheduleSave();
  closeModal('modal-habit');
  renderCurrentView();
  document.dispatchEvent(
    new CustomEvent('app:showToast', { detail: { msg: 'Hábito registrado!', type: 'success' } })
  );
}

/**
 * Calcula percentual de aproveitamento do simulado
 */
export function calcSimuladoPerc() {
  const tot = parseInt(document.getElementById('habit-total')?.value || '0');
  const ace = parseInt(document.getElementById('habit-acertos')?.value || '0');
  const el = document.getElementById('sim-perc');
  if (!el) return;
  if (!tot) {
    el.innerHTML = '';
    return;
  }
  if (tot < 0 || ace < 0) {
    el.innerHTML = '<span class="text-red">⚠️ Valores não podem ser negativos</span>';
    return;
  }
  const pct = Math.round((ace / tot) * 100);
  const colorClass = pct >= 70 ? 'text-accent' : pct >= 50 ? 'text-orange' : 'text-red';
  el.innerHTML = `<span class="${esc(colorClass)}">${esc(pct)}% de aproveitamento (${esc(ace)}/${esc(tot)})</span>`;
}

/**
 * Exclui registro de hábito
 */
export function deleteHabito(tipo, id) {
  showConfirm(
    'Excluir este registro de hábito?',
    () => {
      state.habitos[tipo] = (state.habitos[tipo] || []).filter((h) => h.id !== id);
      habitHistPage = 1;
      scheduleSave();
      renderCurrentView();
    },
    { danger: true, label: 'Excluir', title: 'Excluir registro' }
  );
}

function closeModal(modalId) {
  appCloseModal(modalId);
}
