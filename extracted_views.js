// =============================================
function renderCalendar(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-body">
        <div class="cal-header">
          <div class="cal-nav">
            <button onclick="calNavigate(-1)"><i class="fa fa-chevron-left"></i></button>
            <button onclick="calNavigate(1)"><i class="fa fa-chevron-right"></i></button>
          </div>
          <div class="cal-title">${calDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}</div>
          <button class="btn btn-ghost btn-sm" onclick="calDate=new Date();renderCurrentView()">Hoje</button>
          <div style="margin-left:auto;" class="cal-view-tabs">
            <div class="cal-view-tab ${calViewMode==='mes'?'active':''}" onclick="calViewMode='mes';renderCurrentView()">M├¬s</div>
            <div class="cal-view-tab ${calViewMode==='semana'?'active':''}" onclick="calViewMode='semana';renderCurrentView()">Semana</div>
          </div>
        </div>
        ${calViewMode === 'mes' ? renderCalendarMonth() : renderCalendarWeek()}
      </div>
    </div>
  `;
}

function calNavigate(dir) {
  if (calViewMode === 'mes') {
    calDate.setMonth(calDate.getMonth() + dir);
  } else {
    calDate.setDate(calDate.getDate() + dir * 7);
  }
  renderCurrentView();
}

function renderCalendarMonth() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = todayStr();
  const startDow = (firstDay.getDay() - (state.config.primeirodiaSemana || 1) + 7) % 7;
  const dows = ['Dom','Seg','Ter','Qua','Qui','Sex','S├íb'];
  const startDow0 = state.config.primeirodiaSemana || 1;
  const dowOrder = Array.from({length:7}, (_,i) => dows[(startDow0 + i) % 7]);

  let cells = [];
  // Previous month fill
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, 1 - startDow + i);
    cells.push({ date: d, other: true });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), other: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length-1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate()+1), other: true });
  }

  const getDateStr = d => d.toISOString().split('T')[0];

  return `
    <div class="cal-grid">
      ${dowOrder.map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells.map(cell => {
        const ds = getDateStr(cell.date);
        const isToday = ds === today;
        const dayEvents = state.eventos.filter(e => e.data === ds);
        const show = dayEvents.slice(0, 3);
        const more = dayEvents.length - 3;
        return `
          <div class="cal-cell ${cell.other ? 'other-month' : ''} ${isToday ? 'today' : ''}" onclick="calClickDay('${ds}')">
            <div class="cal-date">${cell.date.getDate()}</div>
            ${show.map(e => {
              const st = getEventStatus(e);
              return `<div class="cal-event-chip ${st}" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
            }).join('')}
            ${more > 0 ? `<div class="cal-more">+${more} mais</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderCalendarWeek() {
  const today = todayStr();
  const dow = calDate.getDay();
  const startOffset = (dow - (state.config.primeirodiaSemana || 1) + 7) % 7;
  const weekStart = new Date(calDate);
  weekStart.setDate(calDate.getDate() - startOffset);
  const dows = ['Dom','Seg','Ter','Qua','Qui','Sex','S├íb'];
  const startDow0 = state.config.primeirodiaSemana || 1;

  const days = Array.from({length:7}, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const getDateStr = d => d.toISOString().split('T')[0];

  return `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;">
      ${days.map(d => {
        const ds = getDateStr(d);
        const isToday = ds === today;
        const dayEvents = state.eventos.filter(e => e.data === ds);
        return `
          <div style="min-height:200px;border-radius:8px;border:1px solid var(--border);overflow:hidden;">
            <div style="padding:8px;background:${isToday ? '#eff6ff' : 'var(--bg)'};text-align:center;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:600;color:var(--text-secondary);">${dows[d.getDay()]}</div>
              <div style="font-size:16px;font-weight:700;${isToday ? 'color:var(--blue);' : ''}">${d.getDate()}</div>
            </div>
            <div style="padding:6px;">
              ${dayEvents.map(e => {
                const st = getEventStatus(e);
                return `<div class="cal-event-chip ${st}" style="margin-bottom:3px;cursor:pointer;" onclick="openEventDetail('${e.id}')" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
              }).join('')}
              <div style="text-align:center;margin-top:4px;">
                <button class="icon-btn" style="width:24px;height:24px;" onclick="openAddEventModalDate('${ds}')">+</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function calClickDay(dateStr) {
  openAddEventModalDate(dateStr);
}

function openAddEventModalDate(dateStr) {
  openAddEventModal(dateStr);
}

// =============================================
// DASHBOARD VIEW
// =============================================
// =============================================
// UX 4 ÔÇö DASHBOARD WITH PERIOD FILTER
// =============================================
let dashPeriod = 7; // default: last 7 days
let _chartDaily = null, _chartDisc = null;

function renderDashboard(el) {
  const periodDays = dashPeriod; // null = all time
  const periodLabel = { 7: '7 dias', 30: '30 dias', 90: '3 meses', null: 'Total' }[periodDays];

  // Fix 2: compute cutoff once, reuse across all filters in this render
  const cutoffStr = periodDays ? cutoffDateStr(periodDays) : null;
  const filteredEvts = cutoffStr
    ? state.eventos.filter(e => e.status === 'estudei' && e.data && e.data >= cutoffStr)
    : state.eventos.filter(e => e.status === 'estudei');

  const totalSecs = filteredEvts.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
  const questTot = cutoffStr
    ? (state.habitos.questoes || []).filter(r => r.data >= cutoffStr).reduce((s, q) => s + (q.quantidade || 1), 0)
    : (state.habitos.questoes || []).reduce((s, q) => s + (q.quantidade || 1), 0);
  const simTot = cutoffStr
    ? (state.habitos.simulado || []).filter(r => r.data >= cutoffStr).length
    : (state.habitos.simulado || []).length;

  el.innerHTML = `
    <!-- Period selector -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="font-size:13px;color:var(--text-secondary);">Exibindo dados: <strong style="color:var(--text-primary);">${periodLabel}</strong></div>
      <div class="cal-view-tabs">
        ${[7, 30, 90, null].map(p => `
          <div class="cal-view-tab ${dashPeriod === p ? 'active' : ''}" onclick="setDashPeriod(${p})">
            ${{ 7:'7d', 30:'30d', 90:'3m', null:'Total' }[p]}
          </div>`).join('')}
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card green">
        <div class="stat-label">Tempo Estudado</div>
        <div class="stat-value">${formatTime(totalSecs)}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Sess├Áes Realizadas</div>
        <div class="stat-value">${filteredEvts.length}</div>
        <div class="stat-sub">eventos conclu├¡dos</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Quest├Áes</div>
        <div class="stat-value">${questTot}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Simulados</div>
        <div class="stat-value">${simTot}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-header">
          <h3>­ƒôê Horas por Dia</h3>
          <span style="font-size:11px;color:var(--text-muted);">${periodLabel}</span>
        </div>
        <div class="card-body">
          <div class="chart-wrap"><canvas id="chart-daily"></canvas></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>­ƒôÜ Tempo por Disciplina</h3>
          <span style="font-size:11px;color:var(--text-muted);">${periodLabel}</span>
        </div>
        <div class="card-body">
          <div class="chart-wrap"><canvas id="chart-disc"></canvas></div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3>ÔÜí H├íbitos (${periodLabel})</h3></div>
        <div class="card-body">${renderHabitSummary(periodDays)}</div>
      </div>
      <div class="card">
        <div class="card-header"><h3>­ƒôï Progresso por Disciplina</h3></div>
        <div class="card-body">${renderDiscProgress()}</div>
      </div>
    </div>
  `;

  renderDailyChart(periodDays);
  renderDiscChart(periodDays);
}

function setDashPeriod(p) {
  dashPeriod = p;
  renderCurrentView();
}

function renderDailyChart(periodDays) {
  const ctx = document.getElementById('chart-daily');
  if (!ctx) return;
  if (_chartDaily) { _chartDaily.destroy(); _chartDaily = null; }
  const numDays = periodDays ? Math.min(periodDays, 90) : 30;
  const days = [], data = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    days.push(numDays > 30 ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    const secs = state.eventos.filter(e => e.data === ds && e.status === 'estudei').reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
    data.push(Math.round(secs / 60));
  }
  _chartDaily = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{ label: 'Minutos', data, backgroundColor: '#10b98166', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: numDays > 20 ? 9 : 11 }, maxRotation: numDays > 20 ? 45 : 0, maxTicksLimit: 20 } }
      }
    }
  });
}

function renderDiscChart(periodDays) {
  const ctx = document.getElementById('chart-disc');
  if (!ctx) return;
  if (_chartDisc) { _chartDisc.destroy(); _chartDisc = null; }
  const discTime = {};
  const cutoffStr2 = periodDays ? cutoffDateStr(periodDays) : null;
  const evts = cutoffStr2
    ? state.eventos.filter(e => e.status === 'estudei' && e.discId && e.tempoAcumulado && e.data >= cutoffStr2)
    : state.eventos.filter(e => e.status === 'estudei' && e.discId && e.tempoAcumulado);
  evts.forEach(e => { discTime[e.discId] = (discTime[e.discId] || 0) + e.tempoAcumulado; });
  const labels = [], data = [], colors = [];
  Object.entries(discTime).forEach(([id, secs]) => {
    const d = getDisc(id);
    labels.push(d ? d.disc.nome : id);
    data.push(Math.round(secs / 60));
    colors.push(d ? (d.disc.cor || '#10b981') : '#94a3b8');
  });
  if (data.length === 0) { ctx.parentElement.innerHTML = '<div class="empty-state"><div class="icon">­ƒôè</div><p>Sem dados no per├¡odo selecionado</p></div>'; return; }
  _chartDisc = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } } }
    }
  });
}

function renderHabitSummary(periodDays) {
  const cutoffStr = periodDays ? cutoffDateStr(periodDays) : null;
  return HABIT_TYPES.map(h => {
    const recent = cutoffStr
      ? (state.habitos[h.key] || []).filter(r => r.data >= cutoffStr)
      : (state.habitos[h.key] || []);
    const count = h.key === 'questoes' ? recent.reduce((s, q) => s + (q.quantidade || 1), 0) : recent.length;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:18px;">${h.icon}</div>
        <div style="flex:1;font-size:13px;font-weight:500;">${h.label}</div>
        <div style="font-size:16px;font-weight:700;color:${h.color};">${count}</div>
      </div>
    `;
  }).join('');
}

function renderDiscProgress() {
  const discs = getAllDisciplinas();
  if (discs.length === 0) return '<div class="empty-state"><div class="icon">­ƒôï</div><p>Nenhuma disciplina cadastrada</p></div>';
  return discs.slice(0, 8).map(({ disc, edital }) => {
    const total = disc.assuntos.length;
    const done = disc.assuntos.filter(a => a.concluido).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <div style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;">
            <span>${disc.icone || '­ƒôû'}</span> ${esc(disc.nome)}
          </div>
          <div style="font-size:11px;color:var(--text-muted);">${done}/${total}</div>
        </div>
        <div class="progress">
          <div class="progress-bar" style="width:${pct}%;background:${disc.cor || 'var(--accent)'};"></div>
        </div>
      </div>
    `;
  }).join('');
}

// =============================================
// REVISOES VIEW
// =============================================
// Fix 4: Get upcoming revisions for next N days
function getUpcomingRevisoes(days = 30) {
  const today = todayStr();
  const future = new Date();
  future.setDate(future.getDate() + days);
  const futureStr = future.toISOString().split('T')[0];
  const upcoming = [];
  for (const edital of state.editais) {
    for (const grupo of edital.grupos) {
      for (const disc of grupo.disciplinas) {
        for (const ass of disc.assuntos) {
          if (!ass.concluido || !ass.dataConclusao) continue;
          const revDates = calcRevisionDates(ass.dataConclusao, ass.revisoesFetas || []);
          for (const rd of revDates) {
            if (rd > today && rd <= futureStr) {
              upcoming.push({ assunto: ass, disc, edital, data: rd, revNum: (ass.revisoesFetas || []).length + 1 });
              break; // only the next scheduled one
            }
          }
        }
      }
    }
  }
  return upcoming.sort((a, b) => a.data.localeCompare(b.data));
}

function renderRevisoes(el) {
  const pending = getPendingRevisoes();
  const upcoming = getUpcomingRevisoes(30);
  const today = todayStr();

  el.innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
      <div class="card" style="flex:1;min-width:140px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Pendentes Hoje</div>
        <div style="font-size:28px;font-weight:800;color:var(--red);">${pending.filter(r => r.data <= today).length}</div>
      </div>
      <div class="card" style="flex:1;min-width:140px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Pr├│x. 30 dias</div>
        <div style="font-size:28px;font-weight:800;color:var(--blue);">${upcoming.length}</div>
      </div>
      <div class="card" style="flex:1;min-width:140px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Assuntos Conclu├¡dos</div>
        <div style="font-size:28px;font-weight:800;color:var(--accent);">${getAllDisciplinas().reduce((s, {disc}) => s + disc.assuntos.filter(a => a.concluido).length, 0)}</div>
      </div>
      <div class="card" style="flex:1;min-width:140px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Frequ├¬ncia</div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-top:8px;">${(state.config.frequenciaRevisao || [1,7,30,90]).join(', ')} dias</div>
      </div>
    </div>

    <div class="tabs">
      <div class="tab-btn active" onclick="switchRevTab('pendentes', this)">­ƒö┤ Pendentes (${pending.length})</div>
      <div class="tab-btn" onclick="switchRevTab('proximas', this)">­ƒôà Pr├│ximas 30 dias (${upcoming.length})</div>
    </div>

    <div id="rev-tab-pendentes" class="tab-content active">
      ${pending.length === 0 ? `
        <div class="empty-state"><div class="icon">­ƒÄë</div><h4>Nenhuma revis├úo pendente!</h4><p>Conclua assuntos para que as revis├Áes sejam agendadas automaticamente.</p></div>
      ` : pending.map(r => {
        const isOverdue = r.data < today;
        const revNum = (r.assunto.revisoesFetas || []).length + 1;
        return `
          <div class="rev-item">
            <div class="rev-days ${isOverdue ? 'overdue' : 'today'}">
              <div class="num">${revNum}┬¬</div>
              <div class="label">Rev</div>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;">${r.assunto.nome}</div>
              <div style="font-size:12px;color:var(--text-secondary);">${r.disc.nome} ÔÇó ${r.edital.nome}</div>
              <div style="font-size:11px;color:${isOverdue ? 'var(--red)' : 'var(--accent)'};margin-top:2px;">
                ${isOverdue ? 'ÔÜá´©Å Atrasada' : '­ƒôà Hoje'} ÔÇó Prevista para ${formatDate(r.data)}
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-primary btn-sm" onclick="marcarRevisao('${r.assunto.id}')">Ô£à Feita</button>
              <button class="btn btn-ghost btn-sm" onclick="adiarRevisao('${r.assunto.id}')">ÔÅ¡ +1 dia</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div id="rev-tab-proximas" class="tab-content">
      ${upcoming.length === 0 ? `
        <div class="empty-state"><div class="icon">­ƒôà</div><h4>Nenhuma revis├úo nos pr├│ximos 30 dias</h4><p>Continue estudando e concluindo assuntos!</p></div>
      ` : (() => {
        // Group by week
        let lastWeek = null;
        return upcoming.map(r => {
          const d = new Date(r.data + 'T00:00:00');
          const weekLabel = `Semana de ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
          const diffDays = Math.ceil((new Date(r.data + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
          return `
            <div class="rev-item">
              <div class="rev-days" style="background:#dbeafe;color:#1d4ed8;">
                <div class="num">${r.revNum}┬¬</div>
                <div class="label">Rev</div>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;">${r.assunto.nome}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${r.disc.nome} ÔÇó ${r.edital.nome}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:12px;font-weight:700;color:var(--blue);">${formatDate(r.data)}</div>
                <div style="font-size:11px;color:var(--text-muted);">em ${diffDays} dia${diffDays !== 1 ? 's' : ''}</div>
              </div>
            </div>
          `;
        }).join('');
      })()}
    </div>
  `;
}

function switchRevTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rev-tab-pendentes').classList.toggle('active', tab === 'pendentes');
  document.getElementById('rev-tab-proximas').classList.toggle('active', tab === 'proximas');
}

function marcarRevisao(assId) {
  for (const edital of state.editais) {
    for (const grupo of edital.grupos) {
      for (const disc of grupo.disciplinas) {
        const ass = disc.assuntos.find(a => a.id === assId);
        if (ass) {
          if (!ass.revisoesFetas) ass.revisoesFetas = [];
          ass.revisoesFetas.push(todayStr());
          scheduleSave();
          renderCurrentView();
          showToast('Revis├úo registrada! ­ƒÄë', 'success');
          return;
        }
      }
    }
  }
}

function adiarRevisao(assId) {
  for (const edital of state.editais) {
    for (const grupo of edital.grupos) {
      for (const disc of grupo.disciplinas) {
        const ass = disc.assuntos.find(a => a.id === assId);
        if (ass) {
          // Store a deferral date: push back the base date by 1 day
          if (!ass.adiamentos) ass.adiamentos = 0;
          ass.adiamentos = (ass.adiamentos || 0) + 1;
          // Shift dataConclusao forward 1 day so all subsequent revisions shift
          const base = new Date(ass.dataConclusao + 'T00:00:00');
          base.setDate(base.getDate() + 1);
          ass.dataConclusao = base.toISOString().split('T')[0];
          scheduleSave();
          renderCurrentView();
          showToast('Revis├úo adiada por 1 dia', 'info');
          return;
        }
      }
    }
  }
}

// =============================================
// HABITOS VIEW
// =============================================
let habitHistPage = 1;
const HABIT_HIST_PAGE_SIZE = 20;

function renderHabitos(el) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  el.innerHTML = `
    <div class="habit-grid">
      ${HABIT_TYPES.map(h => {
        const all = state.habitos[h.key] || [];
        const recent = all.filter(r => r.data >= cutoffStr);
        const total = h.key === 'questoes' ? all.reduce((s,q) => s + (q.quantidade||1), 0) : all.length;
        return `
          <div class="habit-card" onclick="openHabitModal('${h.key}')">
            <div class="hc-icon">${h.icon}</div>
            <div class="hc-label">${h.label}</div>
            <div class="hc-count" style="color:${h.color};">${total}</div>
            <div class="hc-sub">${recent.length} nos ├║ltimos 7 dias</div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="card">
      <div class="card-header">
        <h3>­ƒôï Hist├│rico de H├íbitos</h3>
        <span style="font-size:12px;color:var(--text-muted);" id="habit-hist-count"></span>
      </div>
      <div class="card-body" style="padding:0;" id="habit-hist-list">
      </div>
      <div id="habit-hist-footer" style="padding:12px 16px;display:flex;gap:8px;align-items:center;border-top:1px solid var(--border);"></div>
    </div>
  `;
  renderHabitHistPage();
}

function renderHabitHistPage() {
  const all = HABIT_TYPES
    .flatMap(h => (state.habitos[h.key] || []).map(r => ({...r, tipo: h})))
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
      ? '<div class="empty-state"><div class="icon">ÔÜí</div><p>Nenhum h├íbito registrado ainda</p></div>'
      : items.map(r => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);">
          <div style="font-size:20px;">${r.tipo.icon}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;">${esc(r.tipo.label)}${r.descricao ? ' - ' + r.descricao : ''}</div>
            <div style="font-size:12px;color:var(--text-secondary);">${formatDate(r.data)}${r.quantidade ? ' ÔÇó ' + r.quantidade + ' quest├Áes' : ''}${r.acertos !== undefined && r.tipo.key === 'questoes' ? ' ÔÇó ' + r.acertos + ' acertos' : ''}${r.total ? ` ÔÇó ${r.acertos}/${r.total} (${Math.round(r.acertos/r.total*100)}%)` : ''}</div>
            ${r.gabaritoPorDisc && r.gabaritoPorDisc.length ? `
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
                ${r.gabaritoPorDisc.map(g => `<span style="font-size:10px;background:var(--bg);border:1px solid var(--border);border-radius:20px;padding:1px 8px;color:var(--text-secondary);">${g.discNome}: ${g.acertos}/${g.total}</span>`).join('')}
              </div>` : ''}
          </div>
          <button class="icon-btn" onclick="deleteHabito('${r.tipo.key}','${r.id}')">­ƒùæ</button>
        </div>
      `).join('');
  }

  const footerEl = document.getElementById('habit-hist-footer');
  if (footerEl && total > HABIT_HIST_PAGE_SIZE) {
    footerEl.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="setHabitPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>ÔåÉ Anterior</button>
      <span style="font-size:12px;color:var(--text-muted);flex:1;text-align:center;">P├ígina ${page} de ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" onclick="setHabitPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Pr├│xima ÔåÆ</button>
    `;
    footerEl.style.display = 'flex';
  } else if (footerEl) {
    footerEl.style.display = 'none';
  }
}

function setHabitPage(p) {
  const all = HABIT_TYPES.flatMap(h => (state.habitos[h.key] || []).map(r => ({...r, tipo: h})));
  const totalPages = Math.max(1, Math.ceil(all.length / HABIT_HIST_PAGE_SIZE));
  habitHistPage = Math.max(1, Math.min(p, totalPages));
  renderHabitHistPage();
  document.getElementById('habit-hist-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openHabitModal(tipo) {
  currentHabitType = tipo;
  const h = tipo ? HABIT_TYPES.find(h => h.key === tipo) : null;
  document.getElementById('modal-habit-title').textContent = h ? `Registrar: ${h.label}` : 'Registrar H├íbito';

  const discOptions = getAllDisciplinas().map(d => `<option value="${d.disc.id}">${d.disc.nome}</option>`).join('');

  document.getElementById('modal-habit-body').innerHTML = `
    ${!tipo ? `
      <div class="form-group">
        <label class="form-label">Tipo de H├íbito</label>
        <div class="event-type-grid">
          ${HABIT_TYPES.map(h => `
            <div class="event-type-card" onclick="selectHabitType('${h.key}', this)" data-tipo="${h.key}">
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
          <label class="form-label">Quantidade de Quest├Áes</label>
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
          <label class="form-label">Total de Quest├Áes</label>
          <input type="number" class="form-control" id="habit-total" value="120" oninput="calcSimuladoPerc()">
        </div>
        <div class="form-group">
          <label class="form-label">Acertos (Geral)</label>
          <input type="number" class="form-control" id="habit-acertos" value="0" min="0" oninput="calcSimuladoPerc()">
        </div>
      </div>
      <div id="sim-perc" style="font-size:13px;font-weight:700;text-align:center;color:var(--accent);margin-bottom:12px;"></div>

      <!-- Feature 13: gabarito por disciplina -->
      <details>
        <summary style="font-size:13px;font-weight:600;color:var(--text-secondary);cursor:pointer;padding:4px 0;margin-bottom:8px;">­ƒôè Gabarito por Disciplina (opcional)</summary>
        <div id="sim-disc-list" style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
          ${getAllDisciplinas().map(({ disc, edital }) => `
            <div style="display:flex;align-items:center;gap:8px;background:var(--bg);padding:8px;border-radius:8px;">
              <span style="font-size:13px;flex:1;font-weight:500;" title="${esc(edital.nome)}">${disc.icone || '­ƒôû'} ${esc(disc.nome)}</span>
              <input type="number" class="form-control" style="width:70px;" placeholder="Total" id="sim-total-${disc.id}" min="0">
              <span style="color:var(--text-muted);font-size:12px;">/</span>
              <input type="number" class="form-control" style="width:70px;" placeholder="Acertos" id="sim-acertos-${disc.id}" min="0">
            </div>
          `).join('')}
          ${getAllDisciplinas().length === 0 ? '<div style="font-size:12px;color:var(--text-muted);padding:8px;">Cadastre disciplinas para usar o gabarito detalhado.</div>' : ''}
        </div>
      </details>
    ` : tipo === 'discursiva' ? `
      <div class="form-group">
        <label class="form-label">Tema</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Tema da discursiva">
      </div>
      <div class="form-group">
        <label class="form-label">Nota/Pontua├º├úo (opcional)</label>
        <input type="number" class="form-control" id="habit-nota" placeholder="Ex: 8.5">
      </div>
    ` : tipo === 'leitura' ? `
      <div class="form-group">
        <label class="form-label">T├¡tulo / Legisla├º├úo</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Ex: Lei 8.112/1990">
      </div>
      <div class="form-group">
        <label class="form-label">P├íginas/Artigos lidos</label>
        <input type="number" class="form-control" id="habit-paginas" placeholder="Ex: 30">
      </div>
    ` : `
      <div class="form-group">
        <label class="form-label">Descri├º├úo (opcional)</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Observa├º├Áes">
      </div>
    `}
  `;
  openModal('modal-habit');
}

function selectHabitType(tipo, el) {
  document.querySelectorAll('.event-type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  currentHabitType = tipo;
}

function saveHabit() {
  if (!currentHabitType) { showToast('Selecione o tipo de h├íbito', 'error'); return; }
  const data = document.getElementById('habit-data')?.value || todayStr();
  const registro = { id: uid(), data, tipo: currentHabitType };

  if (currentHabitType === 'questoes') {
    const qtd = parseInt(document.getElementById('habit-qtd')?.value || '10');
    const acertos = parseInt(document.getElementById('habit-acertos')?.value || '0');
    // Fix J: validate questoes
    if (isNaN(qtd) || qtd < 1) { showToast('Informe uma quantidade v├ílida de quest├Áes (m├¡nimo 1)', 'error'); return; }
    if (isNaN(acertos) || acertos < 0) { showToast('Acertos n├úo pode ser negativo', 'error'); return; }
    if (acertos > qtd) { showToast(`Acertos (${acertos}) n├úo pode ser maior que o total (${qtd})`, 'error'); return; }
    registro.quantidade = qtd;
    registro.acertos = acertos;
    registro.discId = document.getElementById('habit-disc')?.value;

  } else if (currentHabitType === 'simulado') {
    const total = parseInt(document.getElementById('habit-total')?.value || '0');
    const acertos = parseInt(document.getElementById('habit-acertos')?.value || '0');
    // Fix J: validate simulado
    if (isNaN(total) || total < 1) { showToast('Informe o total de quest├Áes do simulado (m├¡nimo 1)', 'error'); return; }
    if (isNaN(acertos) || acertos < 0) { showToast('Acertos n├úo pode ser negativo', 'error'); return; }
    if (acertos > total) { showToast(`Acertos (${acertos}) n├úo pode ser maior que o total (${total})`, 'error'); return; }
    registro.total = total;
    registro.acertos = acertos;
    registro.descricao = document.getElementById('habit-desc')?.value;
    // Feature 13: collect gabarito por disciplina
    const gabDiscs = [];
    getAllDisciplinas().forEach(({ disc }) => {
      const tot = parseInt(document.getElementById(`sim-total-${disc.id}`)?.value || '');
      const ace = parseInt(document.getElementById(`sim-acertos-${disc.id}`)?.value || '');
      if (!isNaN(tot) && tot > 0) {
        // Fix J: cap per-disc acertos at its total
        gabDiscs.push({ discId: disc.id, discNome: disc.nome, total: tot, acertos: isNaN(ace) ? 0 : Math.min(ace, tot) });
      }
    });
    if (gabDiscs.length > 0) registro.gabaritoPorDisc = gabDiscs;

  } else if (currentHabitType === 'discursiva') {
    registro.descricao = document.getElementById('habit-desc')?.value;
    const nota = parseFloat(document.getElementById('habit-nota')?.value || '0');
    // Fix J: validate nota
    if (!isNaN(nota) && (nota < 0 || nota > 10)) { showToast('Nota deve estar entre 0 e 10', 'error'); return; }
    registro.nota = isNaN(nota) ? null : nota;

  } else if (currentHabitType === 'leitura') {
    registro.descricao = document.getElementById('habit-desc')?.value;
    const paginas = parseInt(document.getElementById('habit-paginas')?.value || '0');
    // Fix J: validate paginas
    if (isNaN(paginas) || paginas < 1) { showToast('Informe o n├║mero de p├íginas (m├¡nimo 1)', 'error'); return; }
    registro.paginas = paginas;

  } else {
    registro.descricao = document.getElementById('habit-desc')?.value;
  }

  if (!state.habitos[currentHabitType]) state.habitos[currentHabitType] = [];
  state.habitos[currentHabitType].push(registro);
  scheduleSave();
  closeModal('modal-habit');
  renderCurrentView();
  showToast('H├íbito registrado!', 'success');
}

function calcSimuladoPerc() {
  const tot = parseInt(document.getElementById('habit-total')?.value || '0');
  const ace = parseInt(document.getElementById('habit-acertos')?.value || '0');
  const el = document.getElementById('sim-perc');
  if (!el || !tot) return;
  const pct = Math.round(ace / tot * 100);
  const color = pct >= 70 ? 'var(--accent)' : pct >= 50 ? 'var(--orange)' : 'var(--red)';
  el.innerHTML = `<span style="color:${color};">${pct}% de aproveitamento (${ace}/${tot})</span>`;
}

function deleteHabito(tipo, id) {
  showConfirm('Excluir este registro de h├íbito?', () => {
    state.habitos[tipo] = (state.habitos[tipo] || []).filter(h => h.id !== id);
    habitHistPage = 1;
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir', title: 'Excluir registro' });
}

// =============================================
// EDITAIS VIEW
// =============================================
let _vertSearchDebounce = null;

function onVertSearch(val) {
  vertSearch = val;
  clearTimeout(_vertSearchDebounce);
  _vertSearchDebounce = setTimeout(() => {
    // Fix 3: only re-render the list portion, not the entire view
    const listEl = document.getElementById('vert-list-container');
    if (listEl) {
      renderVerticalList(listEl);
    } else {
      renderCurrentView(); // fallback if container not found
    }
  }, 200);
}
let vertFilterEdital = '';
let vertFilterStatus = 'todos';
let vertSearch = '';

function getFilteredVertItems() {
  let items = [];
  for (const edital of state.editais) {
    for (const grupo of edital.grupos) {
      for (const disc of grupo.disciplinas) {
        for (const ass of disc.assuntos) {
          items.push({ edital, grupo, disc, ass });
        }
      }
    }
  }
  if (vertFilterEdital) items = items.filter(i => i.edital.id === vertFilterEdital);
  if (vertFilterStatus === 'pendentes') items = items.filter(i => !i.ass.concluido);
  if (vertFilterStatus === 'concluidos') items = items.filter(i => i.ass.concluido);
  if (vertSearch) {
    const q = vertSearch.toLowerCase();
    items = items.filter(i => i.ass.nome.toLowerCase().includes(q) || i.disc.nome.toLowerCase().includes(q));
  }
  return items;
}

function renderVertical(el) {
  // Fix 3: render the shell ONCE (filters, header); list gets its own container
  el.innerHTML = `
    <!-- Filters row ÔÇö full re-render only when filter chips change -->
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
      <div style="position:relative;flex:1;min-width:180px;">
        <i class="fa fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:12px;"></i>
        <input class="form-control" style="padding-left:32px;" id="vert-search" value="${esc(vertSearch)}"
          placeholder="Buscar assunto ou disciplina..."
          oninput="onVertSearch(this.value)">
      </div>
      <select class="form-control" style="width:auto;" onchange="vertFilterEdital=this.value;renderCurrentView()">
        <option value="">Todos os editais</option>
        ${state.editais.map(e => `<option value="${e.id}" ${vertFilterEdital===e.id?'selected':''}>${esc(e.nome)}</option>`).join('')}
      </select>
      <div class="filter-row" style="margin:0;gap:4px;">
        ${['todos','pendentes','concluidos'].map(s => `
          <div class="filter-chip ${vertFilterStatus===s?'active':''}" onclick="vertFilterStatus='${s}';renderCurrentView()">
            ${{todos:'Todos',pendentes:'Pendentes',concluidos:'Conclu├¡dos'}[s]}
          </div>`).join('')}
      </div>
    </div>

    <!-- Stats header -->
    <div id="vert-stats-bar" class="card" style="margin-bottom:16px;padding:14px 20px;"></div>

    <!-- Fix 3: isolated list container ÔÇö only this gets re-rendered on search -->
    <div class="card"><div id="vert-list-container" style="padding:0;"></div></div>
  `;
  renderVerticalList(document.getElementById('vert-list-container'));
}

function renderVerticalList(container) {
  if (!container) return;
  const allItems = getFilteredVertItems();
  const total = allItems.length;
  const concluidos = allItems.filter(i => i.ass.concluido).length;
  const pct = total > 0 ? Math.round(concluidos / total * 100) : 0;

  // Update stats bar
  const statsBar = document.getElementById('vert-stats-bar');
  if (statsBar) {
    statsBar.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:2px;">VIS├âO LINEAR DO EDITAL</div>
          <div style="font-size:20px;font-weight:800;">${concluidos} de ${total} assuntos conclu├¡dos</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:32px;font-weight:900;color:var(--accent);">${pct}<span style="font-size:16px;opacity:0.7;">%</span></div>
          <div style="background:var(--border);height:6px;border-radius:4px;width:120px;margin-top:4px;">
            <div style="background:var(--accent);height:6px;border-radius:4px;width:${pct}%;transition:width 0.3s;"></div>
          </div>
        </div>
      </div>`;
  }

  if (allItems.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">­ƒôæ</div>
      <h4>${state.editais.length === 0 ? 'Nenhum edital cadastrado' : 'Nenhum assunto encontrado'}</h4>
      <p>${state.editais.length === 0 ? 'Crie um edital em Editais para usar esta visualiza├º├úo.' : 'Tente ajustar os filtros.'}</p>
    </div>`;
    return;
  }

  const hiReg = vertSearch ? new RegExp(`(${vertSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi') : null;
  const highlight = str => hiReg ? esc(str).replace(hiReg, '<mark>$1</mark>') : esc(str);

  container.innerHTML = allItems.map(({ edital, disc, ass }) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);${ass.concluido ? 'background:#f8fafc;' : ''}">
      <div class="check-circle ${ass.concluido ? 'done' : ''}" onclick="toggleAssunto('${disc.id}','${ass.id}')" style="flex-shrink:0;">${ass.concluido ? 'Ô£ô' : ''}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:${ass.concluido ? '400' : '600'};color:${ass.concluido ? 'var(--text-muted)' : 'var(--text-primary)'};${ass.concluido ? 'text-decoration:line-through;' : ''}">${highlight(ass.nome)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">${esc(disc.icone || '­ƒôû')} ${highlight(disc.nome)} ÔÇó ${esc(edital.nome)}</div>
      </div>
      ${ass.concluido ? `<div style="text-align:right;flex-shrink:0;">
        <div style="font-size:10px;color:var(--accent);font-weight:600;">Ô£à Conclu├¡do</div>
        <div style="font-size:10px;color:var(--text-muted);">${formatDate(ass.dataConclusao)}</div>
        <div style="font-size:10px;color:var(--text-muted);">${(ass.revisoesFetas||[]).length} rev.</div>
      </div>` : `<button class="btn btn-ghost btn-sm" onclick="addEventoParaAssunto('${edital.id}','${disc.id}','${ass.id}')">­ƒôà Agendar</button>`}
    </div>
  `).join('');
}

function addEventoParaAssunto(editaId, discId, assId) {
  const d = getDisc(discId);
  const ass = d?.disc.assuntos.find(a => a.id === assId);
  if (!ass || !d) return;
  // Pre-select discipline and subject then open modal
  openAddEventModal(todayStr());
  // After modal renders, pre-fill
  setTimeout(() => {
    const discSel = document.getElementById('event-disc');
    if (discSel) {
      discSel.value = discId;
      loadAssuntos();
      setTimeout(() => {
        const assSel = document.getElementById('event-assunto');
        if (assSel) {
          assSel.value = assId;
          const ti = document.getElementById('event-titulo');
          if (ti) { ti.value = ass.nome; ti.dataset.autoFilled = 'true'; }
        }
      }, 50);
    }
  }, 50);
}

function renderEditais(el) {
  el.innerHTML = `
    ${state.editais.length === 0 ? `
      <div class="empty-state" style="padding:80px 20px;">
        <div class="icon">­ƒôï</div>
        <h4>Nenhum edital cadastrado</h4>
        <p style="margin-bottom:16px;">Crie seu edital com disciplinas e assuntos para organizar seus estudos.</p>
        <button class="btn btn-primary" onclick="openEditaModal()"><i class="fa fa-plus"></i> Criar Edital</button>
      </div>
    ` : `
      <div class="edital-tree">
        ${state.editais.map(edital => renderEditalTree(edital)).join('')}
      </div>
    `}
  `;
}

function renderEditalTree(edital) {
  return `
    <div class="tree-edital" id="edital-${edital.id}">
      <div class="tree-edital-header" onclick="toggleEdital('${edital.id}')">
        <span style="width:10px;height:10px;border-radius:50%;background:${edital.cor || '#10b981'};flex-shrink:0;display:inline-block;"></span>
        <span style="flex:1;font-size:14px;font-weight:700;">${esc(edital.nome)}</span>
        <span style="font-size:11px;opacity:0.7;">${edital.grupos.reduce((s,g) => s + g.disciplinas.length, 0)} disc.</span>
        <button class="icon-btn" style="color:#fff;" title="Editar" onclick="event.stopPropagation();openEditaModal('${edital.id}')">Ô£Å´©Å</button>
        <button class="icon-btn" style="color:#fff;" title="Excluir" onclick="event.stopPropagation();deleteEdital('${edital.id}')">­ƒùæ</button>
        <i class="fa fa-chevron-down" style="font-size:12px;opacity:0.7;"></i>
      </div>
      <div id="edital-tree-${edital.id}">
        ${edital.grupos.map(grupo => `
          <div class="tree-group">
            <div class="tree-group-header" onclick="toggleGrupo('${edital.id}','${grupo.id}')">
              <i class="fa fa-folder" style="color:var(--orange);font-size:13px;"></i>
              <span style="flex:1;">${esc(grupo.nome)}</span>
              <button class="icon-btn" style="font-size:11px;" title="Add Disciplina" onclick="event.stopPropagation();openDiscModal('${edital.id}','${grupo.id}')">+ Disciplina</button>
              <button class="icon-btn" title="Excluir grupo" onclick="event.stopPropagation();deleteGrupo('${edital.id}','${grupo.id}')">­ƒùæ</button>
            </div>
            <div id="grupo-tree-${grupo.id}">
              ${grupo.disciplinas.map(disc => `
                <div class="tree-disc" onclick="toggleDisc('${disc.id}')">
                  <div style="width:8px;height:8px;border-radius:50%;background:${disc.cor || '#10b981'};flex-shrink:0;"></div>
                  <span style="font-size:15px;">${disc.icone || '­ƒôû'}</span>
                  <span style="flex:1;font-size:13px;font-weight:500;">${esc(disc.nome)}</span>
                  <span style="font-size:11px;color:var(--text-muted);">${disc.assuntos.filter(a=>a.concluido).length}/${disc.assuntos.length}</span>
                  <div class="progress" style="width:60px;"><div class="progress-bar" style="width:${disc.assuntos.length>0?Math.round(disc.assuntos.filter(a=>a.concluido).length/disc.assuntos.length*100):0}%;background:${disc.cor||'var(--accent)'};"></div></div>
                  <button class="icon-btn" style="font-size:11px;" onclick="event.stopPropagation();openSubjectModal('${edital.id}','${disc.id}')" title="Add Assuntos">+ Assuntos</button>
                  <button class="icon-btn" onclick="event.stopPropagation();deleteDisc('${edital.id}','${grupo.id}','${disc.id}')" title="Excluir">­ƒùæ</button>
                </div>
                <div id="disc-tree-${disc.id}" style="display:none;">
                  ${disc.assuntos.map((ass, idx) => `
                    <div class="tree-assunto ${ass.concluido ? 'done' : ''}"
                      draggable="true"
                      data-disc-id="${disc.id}"
                      data-ass-idx="${idx}"
                      ondragstart="dndStart(event,'${disc.id}',${idx})"
                      ondragover="dndOver(event)"
                      ondragleave="dndLeave(event)"
                      ondrop="dndDrop(event,'${disc.id}',${idx})">
                      <span class="drag-handle-icon" title="Arrastar para reordenar">Ôá┐</span>
                      <div class="check-circle ${ass.concluido ? 'done' : ''}" onclick="toggleAssunto('${disc.id}','${ass.id}')">
                        ${ass.concluido ? 'Ô£ô' : ''}
                      </div>
                      <span style="flex:1;">${esc(ass.nome)}</span>
                      ${ass.concluido ? `<span style="font-size:10px;color:var(--text-muted);">${formatDate(ass.dataConclusao)}</span>` : ''}
                      <button class="icon-btn" style="font-size:10px;" onclick="deleteAssunto('${disc.id}','${ass.id}')">├ù</button>
                    </div>
                  `).join('')}
                  ${disc.assuntos.length === 0 ? '<div class="tree-assunto" style="color:var(--text-muted);font-style:italic;">Nenhum assunto adicionado</div>' : ''}
                </div>
              `).join('')}
              ${grupo.disciplinas.length === 0 ? '<div class="tree-disc" style="color:var(--text-muted);font-style:italic;cursor:default;">Nenhuma disciplina</div>' : ''}
            </div>
          </div>
        `).join('')}
        <div style="padding:10px 16px;border-top:1px solid var(--border);">
          <button class="btn btn-ghost btn-sm" onclick="addGrupo('${edital.id}')">+ Grupo</button>
        </div>
      </div>
    </div>
  `;
}

function toggleEdital(id) {
  const el = document.getElementById(`edital-tree-${id}`);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

function toggleGrupo(editaId, grupoId) {
  const el = document.getElementById(`grupo-tree-${grupoId}`);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

function toggleDisc(discId) {
  const el = document.getElementById(`disc-tree-${discId}`);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

function toggleAssunto(discId, assId) {
  for (const edital of state.editais) {
    for (const grupo of edital.grupos) {
      const disc = grupo.disciplinas.find(d => d.id === discId);
      if (disc) {
        const ass = disc.assuntos.find(a => a.id === assId);
        if (ass) {
          ass.concluido = !ass.concluido;
          ass.dataConclusao = ass.concluido ? todayStr() : null;
          if (ass.concluido) ass.revisoesFetas = [];
          scheduleSave();
          renderCurrentView();
          return;
        }
      }
    }
  }
}

function deleteAssunto(discId, assId) {
  showConfirm('Excluir este assunto? Eventos vinculados ser├úo desvinculados.', () => {
    const entry = getDisc(discId);
    if (entry) {
      entry.disc.assuntos = entry.disc.assuntos.filter(a => a.id !== assId);
      invalidateDiscCache();
      scheduleSave();
      renderCurrentView();
    }
  }, { danger: true, label: 'Excluir', title: 'Excluir assunto' });
}

function deleteDisc(editaId, grupoId, discId) {
  showConfirm('Excluir esta disciplina e todos seus assuntos?\n\nEsta a├º├úo n├úo pode ser desfeita.', () => {
    const edital = state.editais.find(e => e.id === editaId);
    if (!edital) return;
    const grupo = edital.grupos.find(g => g.id === grupoId);
    if (!grupo) return;
    grupo.disciplinas = grupo.disciplinas.filter(d => d.id !== discId);
    invalidateDiscCache();
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir disciplina', title: 'Excluir disciplina' });
}

function deleteGrupo(editaId, grupoId) {
  showConfirm('Excluir este grupo e todas suas disciplinas?\n\nEsta a├º├úo n├úo pode ser desfeita.', () => {
    const edital = state.editais.find(e => e.id === editaId);
    if (!edital) return;
    edital.grupos = edital.grupos.filter(g => g.id !== grupoId);
    invalidateDiscCache();
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir grupo', title: 'Excluir grupo' });
}

function deleteEdital(editaId) {
  const edital = state.editais.find(e => e.id === editaId);
  const nome = edital ? edital.nome : 'edital';
  showConfirm(`Excluir "${nome}" completamente?

Todos os grupos, disciplinas e assuntos ser├úo removidos. Esta a├º├úo n├úo pode ser desfeita.`, () => {
    state.editais = state.editais.filter(e => e.id !== editaId);
    invalidateDiscCache();
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir edital', title: 'Excluir edital' });
}

function addGrupo(editaId) {
  const nome = prompt('Nome do grupo (ex: Conhecimentos Gerais):');
  if (!nome) return;
  const edital = state.editais.find(e => e.id === editaId);
  if (!edital) return;
  edital.grupos.push({ id: uid(), nome, disciplinas: [] });
  scheduleSave();
  renderCurrentView();
}

// =============================================
// EDITAL MODAL
// =============================================
function openEditaModal(editaId = null) {
  const edital = editaId ? state.editais.find(e => e.id === editaId) : null;
  document.getElementById('modal-edital-title').textContent = edital ? 'Editar Edital' : 'Novo Edital';
  document.getElementById('modal-edital-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Nome do Edital</label>
      <input type="text" class="form-control" id="edital-nome" placeholder="Ex: Concurso TRF 2025" value="${edital ? edital.nome : ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Cor</label>
      <div class="color-row" id="edital-colors">
        ${COLORS.map(c => `<div class="color-swatch ${edital && edital.cor === c ? 'selected' : ''}" style="background:${c};" onclick="selectColor('${c}','edital-colors')"></div>`).join('')}
      </div>
      <input type="hidden" id="edital-cor" value="${edital ? edital.cor : COLORS[0]}">
    </div>
    <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
      <button class="btn btn-ghost" onclick="closeModal('modal-edital')">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEdital('${editaId || ''}')">Salvar Edital</button>
    </div>
  `;
  if (!edital) {
    document.querySelector('#edital-colors .color-swatch').classList.add('selected');
  }
  openModal('modal-edital');
}

function selectColor(color, containerId) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  container.querySelector(`[style="background:${color};"]`).classList.add('selected');
  const input = document.getElementById(containerId === 'edital-colors' ? 'edital-cor' : containerId === 'disc-colors' ? 'disc-cor' : 'edital-cor');
  if (input) input.value = color;
}

function saveEdital(editaId) {
  const nome = document.getElementById('edital-nome').value.trim();
  if (!nome) { showToast('Informe o nome do edital', 'error'); return; }
  const cor = document.getElementById('edital-cor').value || COLORS[0];

  if (editaId) {
    const edital = state.editais.find(e => e.id === editaId);
    if (edital) { edital.nome = nome; edital.cor = cor; }
  } else {
    state.editais.push({
      id: uid(), nome, cor,
      grupos: [{ id: uid(), nome: 'Conhecimentos Gerais', disciplinas: [] }]
    });
  }
  scheduleSave();
  closeModal('modal-edital');
  renderCurrentView();
  showToast('Edital salvo!', 'success');
}

// =============================================
// DISCIPLINE MODAL
// =============================================
function openDiscModal(editaId, grupoId) {
  editingDiscCtx = { editaId, grupoId };
  document.getElementById('modal-disc-title').textContent = 'Nova Disciplina';
  document.getElementById('modal-disc-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Nome da Disciplina</label>
      <input type="text" class="form-control" id="disc-nome" placeholder="Ex: Direito Constitucional">
    </div>
    <div class="form-group">
      <label class="form-label">├ìcone</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;" id="disc-icons">
        ${DISC_ICONS.map((ic, i) => `<div style="width:36px;height:36px;border-radius:8px;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;transition:all 0.15s;" class="${i===0?'selected-icon':''}" onclick="selectIcon('${ic}', this)">${ic}</div>`).join('')}
      </div>
      <input type="hidden" id="disc-icone" value="${DISC_ICONS[0]}">
    </div>
    <div class="form-group">
      <label class="form-label">Cor</label>
      <div class="color-row" id="disc-colors">
        ${COLORS.map((c,i) => `<div class="color-swatch ${i===0?'selected':''}" style="background:${c};" onclick="selectDiscColor('${c}')"></div>`).join('')}
      </div>
      <input type="hidden" id="disc-cor" value="${COLORS[0]}">
    </div>
  `;
  openModal('modal-disc');
}

function selectIcon(icon, el) {
  document.querySelectorAll('#disc-icons > div').forEach(d => {
    d.style.border = '2px solid var(--border)';
    d.classList.remove('selected-icon');
  });
  el.style.border = '2px solid var(--accent)';
  el.classList.add('selected-icon');
  document.getElementById('disc-icone').value = icon;
}

function selectDiscColor(color) {
  document.querySelectorAll('#disc-colors .color-swatch').forEach(s => s.classList.remove('selected'));
  document.querySelector(`#disc-colors [style="background:${color};"]`).classList.add('selected');
  document.getElementById('disc-cor').value = color;
}

function saveDisc() {
  const nome = document.getElementById('disc-nome').value.trim();
  if (!nome) { showToast('Informe o nome da disciplina', 'error'); return; }
  const icone = document.getElementById('disc-icone').value;
  const cor = document.getElementById('disc-cor').value;
  const { editaId, grupoId } = editingDiscCtx;
  const edital = state.editais.find(e => e.id === editaId);
  if (!edital) return;
  const grupo = edital.grupos.find(g => g.id === grupoId);
  if (!grupo) return;
  grupo.disciplinas.push({ id: uid(), nome, icone, cor, assuntos: [] });
  scheduleSave();
  closeModal('modal-disc');
  renderCurrentView();
  showToast('Disciplina criada!', 'success');
}

// =============================================
// SUBJECT MODAL
// =============================================
function openSubjectModal(editaId, discId) {
  // Find disc
  let disc = null;
  for (const edital of state.editais) {
    for (const grupo of edital.grupos) {
      const d = grupo.disciplinas.find(d => d.id === discId);
      if (d) { disc = d; break; }
    }
    if (disc) break;
  }
  if (!disc) return;
  editingSubjectCtx = { editaId, discId };

  document.getElementById('modal-subject-body').innerHTML = `
    <div style="margin-bottom:12px;">
      <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">
        Adicionando assuntos em: <strong style="color:var(--text-primary);">${esc(disc.nome)}</strong>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Cole os assuntos (um por linha)</label>
      <textarea class="form-control" id="subject-text" rows="10" placeholder="Princ├¡pios fundamentais
Direitos e garantias fundamentais
Organiza├º├úo do Estado
Organiza├º├úo dos Poderes
Tributa├º├úo e Or├ºamento"></textarea>
    </div>
    <div style="font-size:12px;color:var(--text-muted);">Voc├¬ tamb├®m pode adicionar um assunto por vez abaixo:</div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <input type="text" class="form-control" id="subject-single" placeholder="Nome do assunto">
      <button class="btn btn-ghost" onclick="addSingleSubject()">Adicionar</button>
    </div>
    <div style="margin-top:12px;font-size:12.5px;font-weight:600;color:var(--text-secondary);">Assuntos atuais (${disc.assuntos.length}):</div>
    <div id="current-subjects" style="max-height:120px;overflow-y:auto;margin-top:6px;">
      ${disc.assuntos.map(a => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;">
          <span class="${a.concluido ? 'badge badge-green' : 'badge badge-gray'}">${a.concluido ? 'Ô£ô' : 'Ôùï'}</span>
          ${esc(a.nome)}
        </div>
      `).join('') || '<span style="font-size:12px;color:var(--text-muted);">Nenhum assunto ainda</span>'}
    </div>
  `;
  openModal('modal-subject');
}

function addSingleSubject() {
  const input = document.getElementById('subject-single');
  const nome = input.value.trim();
  if (!nome) return;
  const { discId } = editingSubjectCtx;
  for (const edital of state.editais) {
    for (const grupo of edital.grupos) {
      const disc = grupo.disciplinas.find(d => d.id === discId);
      if (disc) {
        disc.assuntos.push({ id: uid(), nome, concluido: false, dataConclusao: null, revisoesFetas: [] });
        input.value = '';
        openSubjectModal(editingSubjectCtx.editaId, discId);
        scheduleSave();
        return;
      }
    }
  }
}

function saveSubjects() {
  const text = document.getElementById('subject-text').value.trim();
  if (!text) { closeModal('modal-subject'); return; }
  const { discId } = editingSubjectCtx;
  const names = text.split('\n').map(s => s.trim()).filter(s => s);

  for (const edital of state.editais) {
    for (const grupo of edital.grupos) {
      const disc = grupo.disciplinas.find(d => d.id === discId);
      if (disc) {
        names.forEach(nome => {
          if (!disc.assuntos.find(a => a.nome === nome)) {
            disc.assuntos.push({ id: uid(), nome, concluido: false, dataConclusao: null, revisoesFetas: [] });
          }
        });
        scheduleSave();
        closeModal('modal-subject');
        renderCurrentView();
        showToast(`${names.length} assunto(s) adicionado(s)!`, 'success');
        return;
      }
    }
  }
}

// =============================================
// ADD EVENT MODAL
// =============================================
function openAddEventModal(dateStr = null) {
  editingEventId = null;
  const allDiscs = getAllDisciplinas();
  const discOptions = allDiscs.map(({ disc, edital, grupo }) =>
    `<option value="${disc.id}" data-edital="${edital.id}">${esc(edital.nome)} ÔÇ║ ${esc(disc.nome)}</option>`
  ).join('');

  document.getElementById('modal-event-title').textContent = 'Adicionar Evento de Estudo';
  document.getElementById('modal-event-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">O que voc├¬ vai estudar?</label>
      <div class="event-type-grid" style="grid-template-columns:repeat(2,1fr);">
        <div class="event-type-card selected" id="etype-conteudo" onclick="selectEventType('conteudo')">
          <div class="et-icon">­ƒôû</div>
          <div class="et-label">Avan├ºar no Edital</div>
          <div class="et-sub">Estudar disciplinas e assuntos</div>
        </div>
        <div class="event-type-card" id="etype-habito" onclick="selectEventType('habito')">
          <div class="et-icon">ÔÜí</div>
          <div class="et-label">H├íbito de Estudo</div>
          <div class="et-sub">Quest├Áes, simulado, etc.</div>
        </div>
      </div>
    </div>

    <div id="event-conteudo-fields">
      <div class="form-group">
        <label class="form-label">Disciplina</label>
        <select class="form-control" id="event-disc" onchange="loadAssuntos()">
          <option value="">Sem disciplina espec├¡fica</option>
          ${discOptions}
        </select>
      </div>
      <div class="form-group" id="event-assunto-group" style="display:none;">
        <label class="form-label">Assunto (opcional)</label>
        <select class="form-control" id="event-assunto">
          <option value="">Sem assunto espec├¡fico</option>
        </select>
      </div>
    </div>

    <div id="event-habito-fields" style="display:none;">
      <div class="form-group">
        <label class="form-label">Tipo de H├íbito</label>
        <select class="form-control" id="event-habito">
          ${HABIT_TYPES.map(h => `<option value="${h.key}">${h.icon} ${h.label}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">T├¡tulo do Evento</label>
      <input type="text" class="form-control" id="event-titulo" placeholder="Ex: Estudar Direito Constitucional">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data</label>
        <input type="date" class="form-control" id="event-data" value="${dateStr || todayStr()}"
          oninput="updateDayLoad(this.value)">
        <div id="day-load-hint" style="font-size:11px;margin-top:4px;color:var(--text-muted);"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Dura├º├úo Prevista</label>
        <select class="form-control" id="event-duracao">
          <option value="30">30 min</option>
          <option value="60" selected>1 hora</option>
          <option value="90">1h30</option>
          <option value="120">2 horas</option>
          <option value="180">3 horas</option>
          <option value="240">4 horas</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Anota├º├Áes (opcional)</label>
      <textarea class="form-control" id="event-notas" rows="2" placeholder="Observa├º├Áes r├ípidas sobre o estudo..."></textarea>
    </div>
    <details style="margin-bottom:12px;">
      <summary style="font-size:13px;font-weight:600;color:var(--text-secondary);cursor:pointer;padding:6px 0;">­ƒôÄ Fontes e refer├¬ncias (opcional)</summary>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Fontes de Estudo</label>
          <input type="text" class="form-control" id="event-fontes" placeholder="Ex: Gran Cursos p├íg. 45, Art. 37 CF/88...">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Legisla├º├úo Pertinente</label>
          <input type="text" class="form-control" id="event-legislacao" placeholder="Ex: Lei 8.112/90, CF Art. 5┬║...">
        </div>
      </div>
    </details>
    <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
      <button class="btn btn-ghost" onclick="closeModal('modal-event')">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEvent()">Adicionar Evento</button>
    </div>
  `;
  openModal('modal-event');
  // Tech 3: Show day load immediately
  setTimeout(() => updateDayLoad(dateStr || todayStr()), 50);
}

let currentEventType = 'conteudo';
function selectEventType(tipo) {
  currentEventType = tipo;
  document.getElementById('etype-conteudo').classList.toggle('selected', tipo === 'conteudo');
  document.getElementById('etype-habito').classList.toggle('selected', tipo === 'habito');
  document.getElementById('event-conteudo-fields').style.display = tipo === 'conteudo' ? '' : 'none';
  document.getElementById('event-habito-fields').style.display = tipo === 'habito' ? '' : 'none';
}

// Tech 3: Real-time day-load hint
function updateDayLoad(dateStr) {
  const el = document.getElementById('day-load-hint');
  if (!el || !dateStr) return;
  const evts = state.eventos.filter(e => e.data === dateStr && e.status !== 'estudei');
  const mins = evts.reduce((s, e) => s + (e.duracao || 0), 0);
  if (evts.length === 0) {
    el.textContent = '­ƒôà Dia livre';
    el.style.color = 'var(--accent)';
  } else {
    const horas = (mins / 60).toFixed(1);
    const color = mins > 480 ? 'var(--red)' : mins > 300 ? 'var(--orange)' : 'var(--text-muted)';
    el.textContent = `ÔÜá´©Å ${evts.length} evento(s) j├í agendado(s) neste dia ÔÇö ${horas}h previstas`;
    el.style.color = color;
  }
}

function loadAssuntos() {
  const discId = document.getElementById('event-disc').value;
  const assuntoGroup = document.getElementById('event-assunto-group');
  const assuntoSel = document.getElementById('event-assunto');
  if (!discId) {
    assuntoGroup.style.display = 'none';
    return;
  }
  const d = getDisc(discId);
  // Fix 5: auto-fill title when user hasn't typed anything yet
  const tituloInput = document.getElementById('event-titulo');
  if (d && (!tituloInput.value || tituloInput.dataset.autoFilled === 'true')) {
    tituloInput.value = `Estudar ${d.disc.nome}`;
    tituloInput.dataset.autoFilled = 'true';
  }
  if (!d || d.disc.assuntos.length === 0) { assuntoGroup.style.display = 'none'; return; }
  const pending = d.disc.assuntos.filter(a => !a.concluido);
  assuntoSel.innerHTML = `<option value="">Sem assunto espec├¡fico</option>` +
    pending.map(a => `<option value="${a.id}">${esc(a.nome)}</option>`).join('');
  assuntoGroup.style.display = '';
  assuntoSel.onchange = () => {
    const assId = assuntoSel.value;
    if (assId && (!tituloInput.value || tituloInput.dataset.autoFilled === 'true')) {
      const ass = d.disc.assuntos.find(a => a.id === assId);
      if (ass) {
        tituloInput.value = ass.nome;
        tituloInput.dataset.autoFilled = 'true';
      }
    } else if (!assId && tituloInput.dataset.autoFilled === 'true') {
      tituloInput.value = `Estudar ${d.disc.nome}`;
    }
  };
}

// Clear auto-filled flag if user manually types in title
document.addEventListener('input', e => {
  if (e.target && e.target.id === 'event-titulo') {
    e.target.dataset.autoFilled = 'false';
  }
});

function saveEvent() {
  const titulo = document.getElementById('event-titulo').value.trim();
  const data = document.getElementById('event-data').value;
  const duracao = parseInt(document.getElementById('event-duracao').value || '60');
  const notas = document.getElementById('event-notas').value.trim();
  const fontes = document.getElementById('event-fontes')?.value.trim() || '';
  const legislacao = document.getElementById('event-legislacao')?.value.trim() || '';

  let discId, assId, habito, autoTitle = titulo;

  if (currentEventType === 'conteudo') {
    discId = document.getElementById('event-disc').value;
    assId = document.getElementById('event-assunto')?.value;
    if (!titulo && discId) {
      const d = getDisc(discId);
      autoTitle = `Estudar ${d?.disc.nome || 'Disciplina'}`;
    }
  } else {
    habito = document.getElementById('event-habito').value;
    const h = getHabitType(habito);
    if (!titulo && h) autoTitle = h.label;
  }

  if (!autoTitle) { showToast('Informe um t├¡tulo para o evento', 'error'); return; }

  // Helper that actually creates and saves the event
  const doSave = () => {
    const evento = {
      id: uid(), titulo: autoTitle, data, duracao, notas, fontes, legislacao,
      status: 'agendado', tempoAcumulado: 0,
      tipo: currentEventType,
      discId: discId || null,
      assId: assId || null,
      habito: habito || null,
      criadoEm: new Date().toISOString()
    };

    state.eventos.push(evento);
    scheduleSave();
    closeModal('modal-event');
    renderCurrentView();
    showToast('Evento adicionado!', 'success');
  };

  // Tech 3: Warn if there are already many events on this day
  const existingOnDay = state.eventos.filter(e => e.data === data && e.status !== 'estudei');
  const totalDuracao = existingOnDay.reduce((s, e) => s + (e.duracao || 0), 0) + duracao;
  if (existingOnDay.length >= 3 || totalDuracao > 480) {
    const horas = Math.round(totalDuracao / 60 * 10) / 10;
    const msg = existingOnDay.length >= 3
      ? `Voc├¬ j├í tem ${existingOnDay.length} evento(s) neste dia. Adicionar mais pode gerar sobrecarga.`
      : `Voc├¬ j├í tem ${Math.round((totalDuracao - duracao) / 60 * 10) / 10}h agendadas neste dia. Com este evento seriam ${horas}h.`;
    showConfirm(msg, doSave, { label: 'Adicionar mesmo assim', title: 'Muitos eventos no dia' });
    return;
  }

  doSave();
}

// =============================================
// CONFIG VIEW
// =============================================
function renderConfig(el) {
  const cfg = state.config;
  el.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>­ƒÄ¿ Apar├¬ncia</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Modo escuro</div>
                <div class="config-sub">Reduz o brilho da tela para uso noturno</div>
              </div>
              <div class="toggle ${cfg.darkMode ? 'on' : ''}" id="dark-toggle"
                onclick="applyTheme(true);this.classList.toggle('on');renderCurrentView()"></div>
            </div>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>ÔÜÖ´©Å Calend├írio</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Visualiza├º├úo padr├úo</div>
                <div class="config-sub">Modo inicial do calend├írio</div>
              </div>
              <select class="form-control" style="width:120px;" onchange="updateConfig('visualizacao',this.value)">
                <option value="mes" ${cfg.visualizacao==='mes'?'selected':''}>M├¬s</option>
                <option value="semana" ${cfg.visualizacao==='semana'?'selected':''}>Semana</option>
              </select>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Primeiro dia da semana</div>
              </div>
              <select class="form-control" style="width:130px;" onchange="updateConfig('primeirodiaSemana',parseInt(this.value))">
                <option value="0" ${cfg.primeirodiaSemana===0?'selected':''}>Domingo</option>
                <option value="1" ${cfg.primeirodiaSemana===1?'selected':''}>Segunda-feira</option>
              </select>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">N├║mero da semana</div>
              </div>
              <div class="toggle ${cfg.mostrarNumeroSemana?'on':''}" onclick="toggleConfig('mostrarNumeroSemana',this)"></div>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Agrupar eventos no dia</div>
                <div class="config-sub">Limita quantidade vis├¡vel</div>
              </div>
              <div class="toggle ${cfg.agruparEventos?'on':''}" onclick="toggleConfig('agruparEventos',this)"></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>­ƒöä Frequ├¬ncia de Revis├úo</h3></div>
          <div class="card-body">
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
              Defina em quantos dias ap├│s concluir um assunto o programa vai sugerir cada revis├úo.
            </div>
            <div class="form-group">
              <label class="form-label">Intervalos (em dias, separados por v├¡rgula)</label>
              <input type="text" class="form-control" id="freq-input" value="${(cfg.frequenciaRevisao || [1,7,30,90]).join(', ')}"
                onchange="updateFrequencia(this.value)">
            </div>
            <div style="font-size:12px;color:var(--text-muted);">Ex: 1, 7, 30, 90 = 4 revis├Áes no 1┬║, 7┬║, 30┬║ e 90┬║ dia</div>
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>Ôÿü´©Å Google Drive</h3></div>
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <div style="font-size:32px;">Ôÿü´©Å</div>
              <div>
                <div style="font-size:14px;font-weight:700;">${cfg.driveConnected ? 'Conectado ao Google Drive' : 'N├úo conectado'}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${cfg.driveConnected ? 'Seus dados s├úo sincronizados automaticamente' : 'Sincronize seus dados entre dispositivos'}</div>
              </div>
            </div>
            ${cfg.driveConnected ? `
              <div style="display:flex;gap:8px;">
                <button class="btn btn-primary btn-sm" onclick="syncToDrive();showToast('Sincronizando...','info')">
                  <i class="fa fa-cloud-upload-alt"></i> Sincronizar agora
                </button>
                <button class="btn btn-ghost btn-sm" onclick="loadFromDrive()">
                  <i class="fa fa-cloud-download-alt"></i> Carregar do Drive
                </button>
                <button class="btn btn-danger btn-sm" onclick="driveDisconnect()">Desconectar</button>
              </div>
            ` : `
              <button class="btn btn-primary" onclick="openDriveModal()">
                <i class="fa fa-cloud"></i> Conectar ao Google Drive
              </button>
            `}
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>­ƒöö Notifica├º├Áes</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Notifica├º├Áes do browser</div>
                <div class="config-sub">${'Notification' in window ? (Notification.permission === 'granted' ? 'Ô£à Ativadas' : Notification.permission === 'denied' ? '­ƒÜ½ Bloqueadas (altere nas config do browser)' : 'Permite receber lembretes de eventos e revis├Áes') : 'ÔØî Browser n├úo suporta'}</div>
              </div>
              ${'Notification' in window && Notification.permission !== 'denied' && Notification.permission !== 'granted' ? `
                <button class="btn btn-primary btn-sm" onclick="requestNotifPermission()">­ƒöö Ativar</button>
              ` : Notification.permission === 'granted' ? `
                <button class="btn btn-ghost btn-sm" onclick="scheduleNotifications(true);showToast('Lembretes enviados!','success')">­ƒöö Testar</button>
              ` : ''}
            </div>
            ${Notification.permission === 'granted' ? `
            <div class="config-row">
              <div>
                <div class="config-label">Lembrete noturno</div>
                <div class="config-sub">Aviso ├ás 20h se houver eventos pendentes</div>
              </div>
              <div style="font-size:12px;color:var(--accent);font-weight:600;">­ƒòù 20:00</div>
            </div>` : ''}
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>­ƒÆ¥ Dados</h3></div>
          <div class="card-body">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
              ${state.eventos.length} evento(s) ativos
              ${(state.arquivo||[]).length > 0 ? ` ÔÇó ${state.arquivo.length} arquivado(s)` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-ghost" onclick="exportData()">­ƒôñ Exportar JSON</button>
              <button class="btn btn-ghost" onclick="importData()">­ƒôÑ Importar JSON</button>
              <button class="btn btn-ghost btn-sm" onclick="archiveOldEvents(90)" title="Move eventos conclu├¡dos h├í mais de 90 dias para o arquivo">­ƒùé Arquivar antigos</button>
              <button class="btn btn-danger btn-sm" onclick="clearAllData()">­ƒùæ Limpar tudo</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Ôä╣´©Å Sobre</h3></div>
          <div class="card-body">
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.7;">
              <strong>Estudo Organizado</strong> ├® um app para planejamento e organiza├º├úo de estudos para concursos p├║blicos.<br><br>
              Baseado no Ciclo PDCA: planeje no Calend├írio, execute no Meu Estudo Di├írio, me├ºa no Dashboard e corrija com as Revis├Áes.<br><br>
              <span style="font-size:11px;color:var(--text-muted);">Vers├úo 1.0 ÔÇó Dados salvos localmente + Google Drive</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateConfig(key, value) {
  state.config[key] = value;
  scheduleSave();
}

function toggleConfig(key, el) {
  state.config[key] = !state.config[key];
  el.classList.toggle('on', state.config[key]);
  scheduleSave();
}

function updateFrequencia(value) {
  const nums = value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  if (nums.length > 0) {
    state.config.frequenciaRevisao = nums;
    scheduleSave();
  }
}

function driveDisconnect() {
  state.config.driveConnected = false;
  state.config.driveToken = null;
  state.config.driveFileId = null;
  saveLocal();
  updateDriveUI();
  renderCurrentView();
  showToast('Google Drive desconectado', 'info');
}

// Fix 7: Move concluded events older than N days into state.arquivo.
// Archived events are excluded from all renders/filters but kept in export/Drive sync.
function archiveOldEvents(days = 90) {
  const cutoffStr = cutoffDateStr(days);
  const toArchive = state.eventos.filter(e => e.status === 'estudei' && e.data && e.data < cutoffStr);
  if (toArchive.length === 0) {
    showToast('Nenhum evento para arquivar.', 'info');
    return;
  }
  showConfirm(
    `Arquivar ${toArchive.length} evento(s) conclu├¡do(s) com mais de ${days} dias?\n\nEles continuar├úo no export/backup, mas n├úo aparecer├úo nos relat├│rios.`,
    () => {
      state.arquivo = [...(state.arquivo || []), ...toArchive];
      const archiveIds = new Set(toArchive.map(e => e.id));
      state.eventos = state.eventos.filter(e => !archiveIds.has(e.id));
      scheduleSave();
      renderCurrentView();
      showToast(`${toArchive.length} evento(s) arquivados.`, 'success');
    },
    { label: 'Arquivar', title: `Arquivar eventos (>${days} dias)` }
  );
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `estudo-organizado-backup-${todayStr()}.json`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Dados exportados!', 'success');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        showConfirm(
          `Importar dados de "${file.name}"?\n\nIsso substituir├í todos os dados atuais. Fa├ºa um export antes para garantir o backup.`,
          () => {
            state = imported;
            invalidateDiscCache();
            invalidateRevCache();
            invalidateTodayCache();
            saveLocal();
            renderCurrentView();
            showToast('Dados importados com sucesso!', 'success');
          },
          { label: 'Importar', title: 'Importar dados' }
        );
      } catch(err) {
        showToast('Arquivo inv├ílido! Verifique se ├® um JSON de backup do Estudo Organizado.', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function clearAllData() {
  showConfirm(
    'ÔÜá´©Å Apagar TODOS os dados permanentemente?\n\nEditais, eventos, h├íbitos e configura├º├Áes ser├úo removidos.\n\nEsta a├º├úo ├® irrevers├¡vel.',
    () => {
      showConfirm(
        '├Ültima confirma├º├úo: isso n├úo pode ser desfeito.',
        () => {
          localStorage.removeItem('estudo-organizado');
          location.reload();
        },
        { danger: true, label: 'Apagar tudo definitivamente', title: 'ÔÜá´©Å Confirma├º├úo final' }
      );
    },
    { danger: true, label: 'Continuar com exclus├úo', title: 'ÔÜá´©Å Apagar todos os dados' }
  );
}

// =============================================
// UX 3 ÔÇö DRAG AND DROP ASSUNTOS
// =============================================
let _dndSrcDiscId = null;
let _dndSrcIdx = null;

function dndStart(event, discId, idx) {
  _dndSrcDiscId = discId;
  _dndSrcIdx = idx;
  event.currentTarget.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(idx));
}
function dndOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}
function dndLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}
function dndDrop(event, discId, targetIdx) {
  event.preventDefault();
  event.stopPropagation();
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  const srcIdx = _dndSrcIdx;
  if (srcIdx === null || srcIdx === targetIdx || _dndSrcDiscId !== discId) return;
  for (const edital of state.editais) {
    for (const grupo of edital.grupos) {
      const disc = grupo.disciplinas.find(d => d.id === discId);
      if (disc) {
        const moved = disc.assuntos.splice(srcIdx, 1)[0];
        disc.assuntos.splice(targetIdx, 0, moved);
        scheduleSave();
        // Re-render then re-open that disc's assuntos
        renderCurrentView();
        const cont = document.getElementById(`disc-tree-${discId}`);
        if (cont) cont.style.display = '';
        showToast('Assunto reordenado!', 'success');
        _dndSrcDiscId = null; _dndSrcIdx = null;
        return;
      }
    }
  }
}
document.addEventListener('dragend', () => {
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
});

// =============================================
// UX 1 ÔÇö GLOBAL SEARCH
// =============================================
let searchBlurTimeout = null;

function onSearch(query) {
  const box = document.getElementById('search-results');
  if (!query || query.length < 2) { box.classList.remove('open'); return; }
  const q = query.toLowerCase();
  const results = { eventos: [], assuntos: [], habitos: [] };

  // Search eventos
  state.eventos.forEach(ev => {
    if (ev.titulo.toLowerCase().includes(q)) {
      const disc = ev.discId ? getDisc(ev.discId)?.disc : null;
      results.eventos.push({ ev, disc });
    }
  });

  // Search assuntos
  getAllDisciplinas().forEach(({ disc, edital }) => {
    disc.assuntos.forEach(ass => {
      if (ass.nome.toLowerCase().includes(q) || disc.nome.toLowerCase().includes(q)) {
        results.assuntos.push({ ass, disc, edital });
      }
    });
  });

  // Search h├íbitos
  HABIT_TYPES.forEach(h => {
    (state.habitos[h.key] || []).forEach(r => {
      if ((r.descricao || '').toLowerCase().includes(q)) {
        results.habitos.push({ r, h });
      }
    });
  });

  const highlight = str => str.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  let html = '';

  if (results.eventos.length) {
    html += `<div class="search-section-title">­ƒôà Eventos</div>`;
    html += results.eventos.slice(0, 5).map(({ ev, disc }) => `
      <div class="search-item" onclick="openEventDetail('${ev.id}');clearSearch()">
        <div class="search-item-icon">${disc ? disc.icone || '­ƒôû' : '­ƒôà'}</div>
        <div>
          <div class="search-item-label">${highlight(ev.titulo)}</div>
          <div class="search-item-sub">${ev.data ? formatDate(ev.data) : ''}${disc ? ' ÔÇó ' + disc.nome : ''}</div>
        </div>
      </div>`).join('');
  }

  if (results.assuntos.length) {
    html += `<div class="search-section-title">­ƒôÜ Assuntos</div>`;
    html += results.assuntos.slice(0, 5).map(({ ass, disc, edital }) => `
      <div class="search-item" onclick="navigate('editais');clearSearch()">
        <div class="search-item-icon">${disc.icone || '­ƒôû'}</div>
        <div>
          <div class="search-item-label">${highlight(ass.nome)}</div>
          <div class="search-item-sub">${esc(disc.nome)} ÔÇó ${esc(edital.nome)} ${ass.concluido ? 'Ô£à' : ''}</div>
        </div>
      </div>`).join('');
  }

  if (results.habitos.length) {
    html += `<div class="search-section-title">ÔÜí H├íbitos</div>`;
    html += results.habitos.slice(0, 3).map(({ r, h }) => `
      <div class="search-item" onclick="navigate('habitos');clearSearch()">
        <div class="search-item-icon">${h.icon}</div>
        <div>
          <div class="search-item-label">${highlight(r.descricao || h.label)}</div>
          <div class="search-item-sub">${formatDate(r.data)}</div>
        </div>
      </div>`).join('');
  }

  if (!html) html = `<div class="search-empty">Nenhum resultado para "<strong>${query}</strong>"</div>`;
  box.innerHTML = html;
  box.classList.add('open');
}

function onSearchFocus() {
  clearTimeout(searchBlurTimeout);
  const val = document.getElementById('global-search').value;
  if (val && val.length >= 2) onSearch(val);
}

function onSearchBlur() {
  searchBlurTimeout = setTimeout(() => {
    document.getElementById('search-results')?.classList.remove('open');
  }, 200);
}

function clearSearch() {
  document.getElementById('global-search').value = '';
  document.getElementById('search-results').classList.remove('open');
}

// ESC closes search
document.addEventListener('keydown', e => {
  // Fix H: ESC ÔÇö close the topmost open modal, or clear search
  if (e.key === 'Escape') {
    const openModals = [...document.querySelectorAll('.modal-overlay.open')];
    if (openModals.length > 0) {
      const top = openModals[openModals.length - 1];
      if (top.id === 'modal-confirm') {
        _confirmCallback = null; // Fix B: cancel callback
      }
      closeModal(top.id);
    } else {
      clearSearch();
    }
  }

  // Fix H: Enter submits the active modal form (not inside textarea)
  if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
    const openModal = document.querySelector('.modal-overlay.open:not(#modal-confirm):not(#modal-event-detail)');
    if (openModal) {
      const saveBtn = openModal.querySelector('button[onclick*="save"], button[onclick*="Save"], button.btn-primary');
      if (saveBtn && !saveBtn.disabled) {
        e.preventDefault();
        saveBtn.click();
      }
    }
  }
});

// =============================================
// UX 5 ÔÇö MOBILE SIDEBAR
// =============================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// Close sidebar on nav item click on mobile
const _origNavigate = navigate;
function navigate(view) {
  if (window.innerWidth <= 768) closeSidebar();
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  renderCurrentView();
}
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// Fix B: Custom confirm replacing browser confirm() ÔÇö consistent design, works on mobile
let _confirmCallback = null;

function showConfirm(msg, onYes, opts = {}) {
  const { title = 'Confirmar', label = 'Confirmar', danger = false } = opts;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.textContent = label;
  okBtn.className = `btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`;
  _confirmCallback = onYes;
  openModal('modal-confirm');
}

document.getElementById('confirm-ok-btn').addEventListener('click', () => {
  closeModal('modal-confirm');
  if (_confirmCallback) { const cb = _confirmCallback; _confirmCallback = null; cb(); }
});
document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
  closeModal('modal-confirm');
  _confirmCallback = null;
});

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    if (e.target.id === 'modal-confirm') _confirmCallback = null; // Fix B: cancel on backdrop
    closeModal(e.target.id);
  }
});

// =============================================
// TOAST
// =============================================
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');

  // Fix G: deduplicate ÔÇö don't show the exact same message twice in a row
  const last = container.lastElementChild;
  if (last && last.dataset.msg === msg) {
    last.classList.remove('show');
    void last.offsetWidth; // force reflow to restart animation
    last.classList.add('show');
    return;
  }

  // Fix G: limit to 3 visible toasts ÔÇö remove oldest if exceeded
  while (container.children.length >= 3) {
    const oldest = container.firstElementChild;
    oldest.classList.remove('show');
    setTimeout(() => oldest.remove(), 300);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');      // Fix G: accessible
  toast.setAttribute('aria-live', 'polite');
  toast.dataset.msg = msg;
  const icons = { success: 'Ô£à', error: 'ÔØî', info: 'Ôä╣´©Å' };
  toast.innerHTML = `<span>${icons[type] || '­ƒÆ¼'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.classList.add('show'); });
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// =============================================
// INIT
// =============================================
function init() {
  loadLocal();
  applyTheme(); // Fix F: restore user's theme preference before first render
  updateDriveUI();
  if (state.config.clientId && state.config.driveConnected) {
    loadGIS();
  }
  navigate('home');
  // Update atrasados automatically
  state.eventos.forEach(ev => {
    if (ev.status === 'agendado' && ev.data && ev.data < todayStr()) {
      ev.status = 'atrasado';
    }
  });
  saveLocal();
  // Auto-sync every 5 minutes
  setInterval(() => {
    if (state.config.driveConnected) syncToDrive();
  }, 300000);

  // Feature 14: Schedule browser notifications
  scheduleNotifications(true); // initial app load ÔÇö force
}

// Fix F: Apply/toggle theme ÔÇö sets data-theme on <html> and persists preference
function applyTheme(toggle = false) {
  if (toggle) {
    state.config.darkMode = !state.config.darkMode;
    scheduleSave();
  }
  document.documentElement.setAttribute('data-theme', state.config.darkMode ? 'dark' : 'light');
  // Update toggle button label if visible
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = state.config.darkMode ? 'ÔÿÇ´©Å Modo claro' : '­ƒîÖ Modo escuro';
}

init();
</script>
</body>