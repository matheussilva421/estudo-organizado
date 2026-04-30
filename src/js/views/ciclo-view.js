/**
 * Ciclo View Module
 * Renderiza visualização de Ciclo Contínuo e Grade Semanal
 */

import { esc, formatH } from '../utils.js?v=8.30';
import { state, scheduleSave } from '../store.js?v=8.30';
import {
  getDisc,
  resetCicloAndWipeEvents,
  calculateCyclePredictionsModel,
} from '../logic.js?v=8.30';
import { renderCurrentView } from '../components.js?v=8.30';
import { showConfirm } from '../app.js?v=8.30';
import { getIsEditingSequence, getTempSequencia } from '../views.js?v=8.30';
import { getPlanjChartInstance, setPlanjChartInstance } from '../state/chart-state.js?v=8.30';

// Module-level state
let _hideConcluidosCiclo = false;

export function getHideConcluidosCiclo() {
  return _hideConcluidosCiclo;
}
export function setHideConcluidosCiclo(val) {
  _hideConcluidosCiclo = val;
}

function formatCycleDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total === 0) return '0h';

  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  return `${mins}min`;
}

function formatCyclePercent(value) {
  return Math.round(Math.max(0, Number(value) || 0));
}

function formatPredictionDate(dateStr) {
  const [year, month, day] = String(dateStr || '').split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

function pluralizeSession(count) {
  return count === 1 ? 'sessão' : 'sessões';
}

export function recomecarCiclo() {
  showConfirm(
    'Isto irá arquivar a rodada e reiniciar toda a sequência do zero, mantendo as configurações. Tem certeza?',
    () => {
      if (state.planejamento && state.planejamento.tipo) {
        state.planejamento.ciclosCompletos = (state.planejamento.ciclosCompletos || 0) + 1;
        state.planejamento.dataInicioCicloAtual = new Date().toISOString();
        resetCicloAndWipeEvents();
        renderCurrentView();
        document.dispatchEvent(
          new CustomEvent('app:showToast', {
            detail: { msg: 'Ciclo recomeçado com sucesso! (Eventos Limpos)', type: 'success' },
          })
        );
      }
    }
  );
}

export function zerarCiclosCounter() {
  showConfirm('Isso voltará a contagem de "Ciclos Completos" para zero. Tem certeza?', () => {
    if (state.planejamento) {
      state.planejamento.ciclosCompletos = 0;
      scheduleSave();
      renderCurrentView();
      document.dispatchEvent(
        new CustomEvent('app:showToast', {
          detail: { msg: 'Contador de ciclos zerado!', type: 'info' },
        })
      );
    }
  });
}

export function calculateCyclePredictions() {
  const startObj = document.getElementById('predict-start-date');
  const endObj = document.getElementById('predict-end-date');
  if (!startObj || !endObj) return;

  const sVal = startObj.value;
  const eVal = endObj.value;
  const container = document.getElementById('predict-results-container');
  const emptyState = document.getElementById('predict-empty-state');
  if (!container || !emptyState) return;

  if (sVal && eVal) {
    if (sVal > eVal) {
      emptyState.style.display = 'block';
      emptyState.textContent = 'A data inicial não pode ser maior que a final.';
      emptyState.style.color = '#f87171';
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    const proj = calculateCyclePredictionsModel(sVal, eVal);
    const keys = Object.keys(proj);

    if (keys.length === 0) {
      emptyState.style.display = 'block';
      emptyState.textContent = 'O ciclo não gera sessões nesses dias (Verifique Dias Ativos).';
      emptyState.style.color = 'var(--text-muted)';
      container.style.display = 'none';
      container.innerHTML = '';
    } else {
      emptyState.style.display = 'none';
      container.style.display = 'flex';

      const totalSessions = keys.reduce((sum, id) => sum + proj[id].sessoes, 0);
      const totalMinutes = keys.reduce((sum, id) => sum + proj[id].minutos, 0);
      const summaryHTML = `
        <div class="ciclo-predict-summary">
          <span>${totalSessions} ${pluralizeSession(totalSessions)} previstas</span>
          <span>${formatCycleDuration(totalMinutes)} totais</span>
          <span class="ciclo-predict-summary-date">${formatPredictionDate(sVal)} a ${formatPredictionDate(eVal)}</span>
        </div>
      `;

      const listHTML = keys
        .map((id) => {
          const disc = getDisc(id);
          const name = disc ? disc.disc.nome : 'Desconhecida';
          const color = disc ? disc.disc.cor || disc.edital.cor || '#888' : '#888';
          const sessCount = proj[id].sessoes;
          const mins = proj[id].minutos;
          const hrStr = formatCycleDuration(mins);

          return `
          <div class="seq-discipline-list-item">
             <div class="seq-discipline-info">
               <div class="seq-discipline-dot" style="background:${color};"></div>
               <span class="seq-discipline-name">${esc(name)}</span>
             </div>
             <div class="seq-discipline-stats">
               <span class="seq-discipline-stats-count">${sessCount}</span> sessões <span class="seq-discipline-stats-meta">(${hrStr})</span>
             </div>
          </div>
        `;
        })
        .join('');
      container.innerHTML = `${summaryHTML}${listHTML}`;
    }
  } else {
    emptyState.style.display = 'block';
    emptyState.textContent = 'Selecione as datas para calcular.';
    emptyState.style.color = 'var(--text-muted)';
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

/**
 * Renderiza view de Ciclo/Grade
 * @param {HTMLElement} el - Elemento container
 */
export function renderCiclo(el) {
  const plan = state.planejamento || {};

  if (!plan.ativo || !plan.disciplinas || plan.disciplinas.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="icon">🧭</div>
        <h4>Nenhum Planejamento de Estudos</h4>
        <p class="mb-6">Configure uma estratégia escolhendo entre o "Ciclo Contínuo de Estudos" ou a "Grade Semanal Fixa" para organizar seu tempo otimizamente.</p>
        <button class="btn btn-primary" data-action="open-planejamento-wizard"><i class="fa fa-play"></i> Criar Meu Planejamento</button>
      </div>
    `;
    return;
  }

  if (plan.tipo === 'ciclo') {
    renderCicloView(el, plan);
  } else if (plan.tipo === 'semanal') {
    renderGradeView(el, plan);
  }
}

/**
 * Renderiza view de Ciclo Contínuo
 * @param {HTMLElement} el - Elemento container
 * @param {Object} plan - Planejamento state
 */
function renderCicloView(el, plan) {
  // Cálculo do tempo estudado desde dataInicioCicloAtual
  let dataInicio = plan.dataInicioCicloAtual || '1970-01-01T00:00:00.000Z';
  dataInicio = dataInicio.substring(0, 10);
  const statsPorDisc = {};
  plan.disciplinas.forEach((id) => (statsPorDisc[id] = 0));

  const eventosFiltrados = state.eventos.filter((ev) => {
    const isEstudado = ev.status === 'estudei' && ev.tempoAcumulado && ev.tempoAcumulado > 0;
    const evDate = ev.dataEstudo || ev.data;
    return isEstudado && evDate >= dataInicio;
  });

  eventosFiltrados.forEach((ev) => {
    if (statsPorDisc[ev.discId] !== undefined) {
      statsPorDisc[ev.discId] += ev.tempoAcumulado / 60;
    }
  });

  let totalTarget = 0;
  const dictDisciplinas = {};
  plan.disciplinas.forEach((id) => {
    const disc = getDisc(id);
    if (disc) dictDisciplinas[id] = disc;
  });

  const copyStats = { ...statsPorDisc };
  let minutosCompletosCiclo = 0;
  let sessoesConcluidas = 0;

  const targetLoop = getIsEditingSequence() ? getTempSequencia() || [] : plan.sequencia;

  let optionsHtml = '<option value="">(Selecione)</option>';
  if (getIsEditingSequence()) {
    plan.disciplinas.forEach((dId) => {
      const disc = getDisc(dId);
      if (disc) optionsHtml += `<option value="${dId}">${esc(disc.disc.nome)}</option>`;
    });
  }

  let sequenceHtml = '';
  targetLoop.forEach((seq, i) => {
    const d = dictDisciplinas[seq.discId];
    if (!getIsEditingSequence() && !d) return;

    totalTarget += seq.minutosAlvo;

    let pct = 0;
    let usedMins = 0;
    if (seq.discId && copyStats[seq.discId] > 0) {
      if (copyStats[seq.discId] >= seq.minutosAlvo) {
        usedMins = seq.minutosAlvo;
        pct = 100;
        copyStats[seq.discId] -= seq.minutosAlvo;
      } else {
        usedMins = copyStats[seq.discId];
        pct = (usedMins / seq.minutosAlvo) * 100;
        copyStats[seq.discId] = 0;
      }
    }
    minutosCompletosCiclo += usedMins;
    const pctInt = formatCyclePercent(pct);
    const cor = d ? d.disc.cor || d.edital.cor || '#8aa4bf' : '#7f8a99';
    if (pct >= 100) sessoesConcluidas++;

    if (!getIsEditingSequence() && getHideConcluidosCiclo() && pct >= 100) return;

    if (getIsEditingSequence()) {
      let selHtml = optionsHtml;
      if (seq.discId)
        selHtml = selHtml.replace(`value="${seq.discId}"`, `value="${seq.discId}" selected`);

      sequenceHtml += `
        <div class="seq-item-card seq-item-card--editing">
          <div class="seq-item-color-bar" style="background:${cor};"></div>
          <div class="seq-item-content">
             <div class="seq-item-field seq-item-field--wide">
               <div class="seq-item-field-label">Disciplina</div>
               <select class="form-control seq-item-select" data-action="update-seq-item" data-index="${i}" data-field="discId">
                 ${selHtml}
               </select>
             </div>
             <div class="seq-item-field seq-item-field--narrow">
               <div class="seq-item-field-label">Minutos</div>
               <input type="number" class="form-control seq-item-input" value="${seq.minutosAlvo}" data-action="update-seq-item" data-index="${i}" data-field="minutosAlvo">
             </div>

             <div class="seq-item-actions">
               <div class="seq-item-action-buttons">
                 <button class="btn btn-ghost btn-sm seq-item-action-btn" data-action="dup-seq-item" data-index="${i}">Duplicar</button>
                 <button class="btn btn-ghost btn-sm seq-item-action-btn" data-action="rem-seq-item" data-index="${i}">Remover</button>
               </div>
               <div class="seq-item-time">
                 <i class="fa fa-clock"></i> ${formatH(usedMins)} ${pct >= 100 ? '(Feito)' : ''}
               </div>
             </div>

             <div class="seq-item-move-controls">
               ${i > 0 ? `<i class="fa fa-caret-up seq-item-move-btn" data-action="move-seq-item" data-index="${i}" data-dir="-1"></i>` : '<div class="seq-item-move-placeholder"></div>'}
               ${i < targetLoop.length - 1 ? `<i class="fa fa-caret-down seq-item-move-btn" data-action="move-seq-item" data-index="${i}" data-dir="1"></i>` : '<div class="seq-item-move-placeholder"></div>'}
             </div>

          </div>
        </div>
      `;
    } else {
      sequenceHtml += `
        <div class="seq-item-card seq-item-card--static">
          <div class="seq-item-color-bar" style="background:${cor};"></div>
          <div class="seq-item-content seq-item-content--static">
            <div class="seq-item-header">
              <div class="seq-item-title seq-item-discipline" title="Editar Nome do Evento" data-action="open-ciclo-history" data-seq-id="${seq.id}">${d.disc.icone || '📚'} ${esc(d.disc.nome)}</div>
              <div class="seq-item-time-display">
                 <i class="fa fa-clock"></i> <span class="seq-item-time-value">${formatCycleDuration(usedMins)}</span> de ${formatCycleDuration(seq.minutosAlvo)}
              </div>
            </div>

            <div class="seq-progress-bar">
              <div class="seq-progress-fill absolute h-full rounded-lg" style="top:0; left:0; width:${Math.min(pct, 100)}%; background:${cor}; opacity:0.6;"></div>
              <div class="seq-progress-text">${pctInt}%</div>
            </div>

            <div class="ciclo-sequence-actions">
              <button type="button" class="ciclo-action-link ciclo-action-link--primary" data-action="iniciar-etapa-planejamento" data-seq-id="${seq.id}"><i class="fa fa-play"></i> Iniciar Estudo</button>
              <button type="button" class="ciclo-action-link" data-action="open-add-event"><i class="fa fa-plus"></i> Adicionar Estudo Manualmente</button>
              <button type="button" class="ciclo-action-link" data-action="open-ciclo-history" data-seq-id="${seq.id}"><i class="fa fa-history"></i> Ver Últimos Estudos</button>
            </div>
          </div>
        </div>
      `;
    }
  });

  if (getIsEditingSequence()) {
    sequenceHtml += `
       <div class="seq-edit-footer">
         <button class="btn btn-ghost seq-edit-footer-btn" data-action="add-seq-item"><i class="fa fa-plus"></i> Adicionar Disciplina</button>
         <div class="seq-edit-footer-actions">
            <button class="btn btn-ghost" data-action="cancel-edit-seq">Cancelar</button>
            <button class="btn btn-primary" data-action="save-edit-seq"><i class="fa fa-save"></i> Salvar Alterações</button>
         </div>
       </div>
    `;
  }

  const progressoGlobalPct =
    totalTarget > 0 ? formatCyclePercent((minutosCompletosCiclo / totalTarget) * 100) : 0;
  const minutosRestantes = Math.max(totalTarget - minutosCompletosCiclo, 0);
  const totalSessoes = targetLoop.length;
  const ciclosFeitos = plan.ciclosCompletos || 0;

  el.innerHTML = `
    <div class="ciclo-header-actions">
      <h2 class="ciclo-header-title">Planejamento</h2>
      <div class="ciclo-header-buttons">
        <button class="btn btn-primary btn-sm ciclo-btn ciclo-btn--primary" data-action="open-planejamento-wizard"><i class="fa fa-edit"></i> Replanejar</button>
        <button class="btn btn-ghost btn-sm ciclo-btn ciclo-btn--secondary" data-action="recomecar-ciclo"><i class="fa fa-sync"></i> Recomeçar Ciclo</button>
        <button class="btn btn-danger btn-sm ciclo-btn ciclo-btn--danger" data-action="remover-planejamento"><i class="fa fa-trash"></i> Remover</button>
      </div>
    </div>

    <div class="grid-2 ciclo-layout">
      <div class="ciclo-content-col">
        <div class="ciclo-summary-row">
          <div class="card ciclo-stat-card ciclo-stat-card--center">
            <div class="ciclo-stat-label">CICLOS COMPLETOS</div>
            <div class="ciclo-stat-value">${ciclosFeitos}</div>
          </div>
          <div class="card ciclo-stat-card ciclo-stat-card--fill">
            <div class="ciclo-stat-label">PROGRESSO</div>
            <div class="ciclo-stat-detail">${formatCycleDuration(minutosCompletosCiclo)} de ${formatCycleDuration(totalTarget)}</div>
            <div class="ciclo-stat-meta">
              <span>faltam ${formatCycleDuration(minutosRestantes)}</span>
              <span>${sessoesConcluidas} de ${totalSessoes} sessões concluídas</span>
            </div>
            <div class="flex cluster-sm">
              <div class="ciclo-stat-badge">${progressoGlobalPct}%</div>
              <div class="ciclo-progress-track">
                <div class="ciclo-progress-bar" style="width:${Math.min(progressoGlobalPct, 100)}%;"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card ciclo-sequence-card">
          <div class="ciclo-sequence-header">
             <div class="ciclo-sequence-title">Sequência dos Estudos</div>
             <div class="ciclo-sequence-controls">
               ${
                 !getIsEditingSequence()
                   ? `
                 <button class="btn btn-ghost btn-sm ciclo-sequence-edit-btn" data-action="toggle-edit-seq"><i class="fa fa-pencil"></i> Editar Sequência</button>
               `
                   : ''
               }
               <label class="ciclo-filter-label">
                 <input type="checkbox" data-action="toggle-ciclo-fin" ${getHideConcluidosCiclo() ? 'checked' : ''} class="ciclo-filter-checkbox"> FINALIZADOS
               </label>
             </div>
          </div>
          <div class="custom-scrollbar scroll-area-md">
            ${sequenceHtml}
          </div>
        </div>
      </div>

      <div class="card ciclo-side-panel">
        <div class="ciclo-side-panel-header">
          <span>CICLO</span>
          <button class="btn btn-ghost btn-sm ciclo-side-panel-btn" data-action="zerar-ciclos-counter">
            <i class="fa fa-undo"></i> Zerar
          </button>
        </div>

        <div class="ciclo-chart-container">
           <canvas id="planejamentoChart"></canvas>
           <div class="ciclo-chart-total">${formatCycleDuration(totalTarget)}</div>
        </div>

        <div id="filete-linear-ciclo" class="ciclo-filete-linear"></div>

        <div class="ciclo-predict-box">
           <h4 class="ciclo-predict-title"><i class="fa fa-calculator ciclo-predict-title-icon"></i> PREVISÃO DE SESSÕES</h4>
           <div class="ciclo-predict-dates">
              <div class="ciclo-predict-field">
                 <label class="ciclo-predict-label">DATA INICIAL</label>
                 <input type="date" id="predict-start-date" class="form-control ciclo-predict-input" data-action="calculate-cycle-predictions" value="${plan.horarios?.dataInicial || ''}">
              </div>
              <div class="ciclo-predict-field">
                 <label class="ciclo-predict-label">DATA FINAL</label>
                 <input type="date" id="predict-end-date" class="form-control ciclo-predict-input" data-action="calculate-cycle-predictions" value="${plan.horarios?.dataFinal || ''}">
              </div>
           </div>
           <div id="predict-results-container" class="ciclo-predict-results"></div>
           <div id="predict-empty-state" class="ciclo-predict-empty">Selecione as datas para calcular.</div>
        </div>

      </div>
    </div>
  `;

  renderCicloChart(plan, dictDisciplinas, totalTarget);

  if (plan.horarios?.dataInicial && plan.horarios?.dataFinal) {
    setTimeout(() => calculateCyclePredictions(), 150);
  }
}

/**
 * Renderiza gráfico do ciclo
 */
function renderCicloChart(plan, dictDisciplinas, totalTarget) {
  setTimeout(() => {
    const ctx = document.getElementById('planejamentoChart');
    if (!ctx) return;

    const labels = [];
    const data = [];
    const bgColors = [];
    const chartData = {};

    plan.sequencia.forEach((seq) => {
      if (!chartData[seq.discId]) chartData[seq.discId] = 0;
      chartData[seq.discId] += seq.minutosAlvo;
    });

    let linearHtml = '';
    for (const [id, min] of Object.entries(chartData)) {
      const d = dictDisciplinas[id];
      if (d) {
        labels.push(d.disc.nome);
        data.push(min);
        const color = d.disc.cor || d.edital.cor || '#8aa4bf';
        bgColors.push(color);
        const wPct = totalTarget > 0 ? ((min / totalTarget) * 100).toFixed(2) : 0;
        linearHtml += `<div style="width:${wPct}%; background:${color}; height:100%;"></div>`;
      }
    }

    document.getElementById('filete-linear-ciclo').innerHTML = linearHtml;

    if (getPlanjChartInstance()) {
      getPlanjChartInstance().destroy();
      setPlanjChartInstance(null);
    }

    setPlanjChartInstance(
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [
            {
              data: data,
              backgroundColor: bgColors,
              borderColor: 'transparent',
              borderWidth: 0,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              titleFont: { size: 13 },
              bodyFont: { size: 14, weight: 'bold' },
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                label: (context) => ' ' + formatH(context.raw),
              },
            },
          },
        },
      })
    );
  }, 100);
}

/**
 * Renderiza view de Grade Semanal
 */
function renderGradeView(el, plan) {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  let weeklyHtml = '';
  let _totalTarget = 0;

  for (let i = 0; i < 7; i++) {
    if (plan.horarios.diasAtivos.includes(i)) {
      weeklyHtml += `
        <div class="grade-day-card">
           <div class="grade-day-title">${days[i]}</div>
           <div class="grade-day-time">${formatTimeStr(plan.horarios.horasPorDia[i])}</div>
        </div>
      `;
    }
  }

  let sequenceHtml = '';
  const dictDisciplinas = {};
  if (plan.disciplinas && plan.sequencia) {
    plan.disciplinas.forEach((id) => {
      const disc = getDisc(id);
      if (disc) dictDisciplinas[id] = disc;
    });

    plan.sequencia.forEach((seq, i) => {
      const d = dictDisciplinas[seq.discId];
      if (!d) return;
      _totalTarget += seq.minutosAlvo;

      sequenceHtml += `
        <div class="ciclo-item ${seq.concluido ? 'concluido' : ''} grade-seq-card">
          <div class="ciclo-item-cor" style="background:${d.disc.cor || d.edital.cor || '#8aa4bf'};"></div>
          <div class="ciclo-item-body">
            <div class="ciclo-item-header grade-seq-header">
              <div class="ciclo-item-title grade-seq-title-link">
                <div class="grade-seq-controls">
                  <button aria-label="Subir" class="icon-btn grade-seq-move-btn" data-action="move-ciclo-seq" data-index="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}><i class="fa fa-chevron-up"></i></button>
                  <button aria-label="Descer" class="icon-btn grade-seq-move-btn" data-action="move-ciclo-seq" data-index="${i}" data-dir="1" ${i === plan.sequencia.length - 1 ? 'disabled' : ''}><i class="fa fa-chevron-down"></i></button>
                </div>
                <div data-action="open-ciclo-history" data-seq-id="${seq.id}" title="Ver Histórico de Sessões">${d.disc.icone || '📚'} <span class="grade-seq-title">${esc(d.disc.nome)}</span></div>
              </div>
              <div class="ciclo-item-meta grade-seq-meta" data-action="edit-ciclo-seq-hours" data-index="${i}" title="Clique para editar as horas planejadas">${formatH(seq.minutosAlvo)} planejado</div>
            </div>
            <div class="grade-seq-step-label">Etapa ${i + 1} da sequência global da semana</div>
            <div class="grade-seq-action">
              ${
                !seq.concluido
                  ? `<button class="btn btn-primary btn-sm" data-action="iniciar-etapa-planejamento" data-seq-id="${seq.id}"><i class="fa fa-play"></i> Estudar Agora</button>`
                  : '<span class="grade-concluded-badge"><i class="fa fa-check"></i> Etapa Concluída</span>'
              }
            </div>
          </div>
        </div>
      `;
    });
  }

  el.innerHTML = `
    <div class="grade-header">
      <h2 class="grade-header-title"><i class="fa fa-calendar-alt"></i> Sua Grade Semanal</h2>
      <div class="grade-actions">
        <button class="btn btn-ghost btn-sm" data-action="open-planejamento-wizard"><i class="fa fa-edit"></i> Editar Grade</button>
        <button class="btn btn-danger btn-sm" data-action="remover-planejamento"><i class="fa fa-trash"></i> Remover</button>
      </div>
    </div>

    <div class="grade-grid">
      <div>${weeklyHtml || '<p>Nenhum dia de estudo planejado.</p>'}</div>
      <div class="card">
        <div class="grade-sequence-list">${sequenceHtml}</div>
      </div>
    </div>
  `;
}

/**
 * Formata string de hora para exibição
 */
function formatTimeStr(hm) {
  if (!hm || !hm.includes(':')) return hm || '?';
  const [h, m] = hm.split(':');
  const hi = parseInt(h, 10);
  const mi = parseInt(m, 10);
  return hi > 0 ? (mi > 0 ? `${hi}h${String(mi).padStart(2, '0')}min` : `${hi}h`) : `${mi}min`;
}
