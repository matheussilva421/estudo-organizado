// =============================================
// HOME VIEW
// =============================================
function renderHome(el) {
    const today = todayStr();
    const agendadoHoje = state.eventos.filter(e => e.data === today && e.status !== 'estudei');
    const estudadoHoje = state.eventos.filter(e => e.data === today && e.status === 'estudei');
    const atrasados = state.eventos.filter(e => e.status !== 'estudei' && e.data && e.data < today);
    const pendRevs = [];//getPendingRevisoes();
    const hojeSeconds = estudadoHoje.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);

    let disc = getAllDisciplinas();
    const totalDiscs = disc.length;
    const totalAssuntos = disc.reduce((s, d) => s + d.disc.assuntos.length, 0);
    const totalConcluidos = disc.reduce((s, d) => s + d.disc.assuntos.filter(a => a.concluido).length, 0);

    el.innerHTML = `
    <!-- GREETING BANNER -->
    <div style="background:linear-gradient(135deg,var(--sidebar-bg),#1e3a5f);border-radius:14px;padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:4px;">${getGreeting()}</div>
        <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:6px;">Vamos estudar hoje? 🎯</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.65);font-style:italic;">"${getDailyQuote()}"</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);margin-bottom:2px;">PROGRESSO GERAL</div>
        <div style="font-size:28px;font-weight:900;color:#fff;">${totalAssuntos > 0 ? Math.round(totalConcluidos / totalAssuntos * 100) : 0}<span style="font-size:16px;font-weight:600;opacity:0.7;">%</span></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);">${totalConcluidos} de ${totalAssuntos} assuntos</div>
      </div>
    </div>

    ${state.editais.length === 0 ? `
    <div class="card" style="margin-bottom:20px;border:2px dashed var(--accent);background:var(--accent-light);">
      <!-- (Original Onboarding content here) -->
      <div class="card-body" style="padding:20px 24px;">
        <div style="font-size:15px;font-weight:800;color:var(--accent-dark);margin-bottom:4px;">👋 Bem-vindo ao Estudo Organizado!</div>
        <div style="font-size:13px;color:var(--accent-dark);margin-bottom:16px;opacity:0.85;">Siga os passos abaixo para configur seu planejamento de estudos:</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <div onclick="navigate('editais')" style="cursor:pointer;flex:1;min-width:180px;background:var(--card);border-radius:10px;padding:14px 16px;border:1px solid var(--border); transition:box-shadow 0.15s;" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'">
              <div style="font-size:20px;margin-bottom:6px;">📋</div>
              <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:3px;">1. Crie um Edital</div>
              <div style="font-size:12px;color:var(--text-secondary);">Adicione o edital do seu concurso e organize as disciplinas por grupos.</div>
            </div>
            <!-- More onboarding steps could be re-added here -->
        </div>
      </div>
    </div>` : ''}

    <div class="stats-grid">
      <div class="stat-card green">
        <div class="stat-label">Estudado Hoje</div>
        <div class="stat-value">${formatTime(hojeSeconds)}</div>
        <div class="stat-sub">${estudadoHoje.length} evento(s) concluído(s)</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Agendado Hoje</div>
        <div class="stat-value">${agendadoHoje.length}</div>
        <div class="stat-sub">evento(s) pendente(s)</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Atrasados</div>
        <div class="stat-value">${atrasados.length}</div>
        <div class="stat-sub">evento(s) não realizados</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Revisões Pendentes</div>
        <div class="stat-value">${pendRevs.length}</div>
        <div class="stat-sub">assuntos a revisar</div>
      </div>
    </div>

    <div class="grid-2" style="gap:16px;margin-bottom:16px;">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header">
            <h3>📌 Agendado para Hoje</h3>
            <button class="btn btn-primary btn-sm" onclick="openAddEventModal()"><i class="fa fa-plus"></i> Evento</button>
          </div>
          <div class="card-body" style="padding:12px;">
            ${agendadoHoje.length === 0 ? '<div class="empty-state"><div class="icon">✅</div><h4>Nada pendente!</h4><p>Adicione eventos ou aproveite o dia livre.</p></div>' : agendadoHoje.map(e => renderEventCard(e)).join('')}
          </div>
        </div>

        ${atrasados.length > 0 ? `
        <div class="card">
          <div class="card-header"><h3>⏰ Eventos Atrasados</h3></div>
          <div class="card-body" style="padding:12px;">
            ${atrasados.slice(0, 5).map(e => renderEventCard(e)).join('')}
            ${atrasados.length > 5 ? `<div class="cal-more" style="padding:8px;text-align:center;">+${atrasados.length - 5} mais</div>` : ''}
          </div>
        </div>` : ''}
      </div>

      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>✅ Estudado Hoje</h3></div>
          <div class="card-body" style="padding:12px;">
            ${estudadoHoje.length === 0 ? '<div class="empty-state"><div class="icon">📚</div><h4>Nenhum evento concluído</h4><p>Comece seus estudos!</p></div>' : estudadoHoje.map(e => renderEventCard(e)).join('')}
          </div>
        </div>

        ${pendRevs.length > 0 ? `
        <div class="card">
          <div class="card-header">
            <h3>🔄 Revisões Sugeridas para Hoje</h3>
            <button class="btn btn-ghost btn-sm" onclick="navigate('revisoes')">Ver todas</button>
          </div>
          <div class="card-body" style="padding:12px;">
            ${pendRevs.slice(0, 3).map(r => `
              <div class="rev-item">
                <div class="rev-days today">
                  <div class="num">Rev</div>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:600;">${r.assunto.nome}</div>
                  <div style="font-size:12px;color:var(--text-secondary);">${r.disc.nome} • ${r.edital.nome}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="marcarRevisao('${r.assunto.id}')">Feita</button>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        <div class="card" style="margin-top:16px;">
          <div class="card-header"><h3>📊 Progresso do Edital</h3></div>
          <div class="card-body">
            ${state.editais.length === 0 ? '<div class="empty-state"><div class="icon">📋</div><h4>Nenhum edital</h4><p>Crie seu edital para acompanhar o progresso.</p></div>' :
            state.editais.map(edital => {
                const discs = edital.grupos.flatMap(g => g.disciplinas);
                const total = discs.reduce((s, d) => s + d.assuntos.length, 0);
                const done = discs.reduce((s, d) => s + d.assuntos.filter(a => a.concluido).length, 0);
                const pct = total > 0 ? Math.round(done / total * 100) : 0;
                return `
                  <div style="margin-bottom:14px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                      <div style="font-size:13px;font-weight:600;">${esc(edital.nome)}</div>
                      <div style="font-size:12px;color:var(--text-secondary);">${done}/${total} (${pct}%)</div>
                    </div>
                    <div class="progress"><div class="progress-bar" style="width:${pct}%;background:${edital.cor || 'var(--accent)'};"></div></div>
                  </div>
                `;
            }).join('')
        }
          </div>
        </div>
      </div>
    </div>
  `;
}

const FRASES_MOTIVACIONAIS = [
    "A consistência supera o talento todos os dias.",
    "Cada página lida é um passo à frente na aprovação.",
    "O concurso é ganho na rotina, não na véspera.",
    "Foque no processo. O resultado é consequência.",
    "Você já está à frente de quem ainda não começou.",
    "Estudo diário transforma ignorância em aprovação.",
    "A aprovação não é sorte — é a soma dos seus dias.",
    "Cada assunto concluído é uma vitória real.",
    "Disciplina é liberdade. Continue.",
    "Pequenas doses diárias constroem grandes conhecimentos.",
];

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return '☀️ Bom dia';
    if (h < 18) return '🌤️ Boa tarde';
    return '🌙 Boa noite';
}

function getDailyQuote() {
    const _d = new Date();
    const day = _d.getDate() + _d.getMonth() * 31;
    return FRASES_MOTIVACIONAIS[day % FRASES_MOTIVACIONAIS.length];
}

// =============================================
// MED VIEW
// =============================================
function renderMED(el) {
    const today = todayStr();
    const todayEvents = state.eventos.filter(e => e.data === today);
    const agendados = todayEvents.filter(e => e.status !== 'estudei');
    const estudados = todayEvents.filter(e => e.status === 'estudei');
    const totalSeconds = estudados.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);

    el.innerHTML = `
        < div id = "med-stats-row" style = "display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;" >
      <div class="card" style="flex:1;min-width:200px;padding:20px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tempo Total Hoje</div>
        <div style="font-size:32px;font-weight:800;font-family:'DM Mono',monospace;color:var(--text-primary);" id="total-time">${formatTime(totalSeconds)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${estudados.length} evento(s) concluído(s)</div>
      </div>
      <div class="card" style="flex:1;min-width:200px;padding:20px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Pendentes</div>
        <div style="font-size:32px;font-weight:800;color:var(--blue);">${agendados.length}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">evento(s) para hoje</div>
      </div>
      <div class="card" style="flex:1;min-width:200px;padding:20px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Maior Foco</div>
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-top:8px;">
          ${estudados.length > 0 ? (() => {
            const best = estudados.reduce((a, b) => (b.tempoAcumulado || 0) > (a.tempoAcumulado || 0) ? b : a);
            return esc(best.titulo || 'N/A');
        })() : '—'}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${estudados.length > 0 ? formatTime(estudados.reduce((a, b) => (b.tempoAcumulado || 0) > (a.tempoAcumulado || 0) ? b : a).tempoAcumulado || 0) : ''}</div>
      </div>
    </div >

        ${agendados.length === 0 && estudados.length === 0 ? `
      <div class="empty-state" style="padding:60px 20px;">
        <div class="icon">📅</div>
        <h4>Nenhum evento para hoje</h4>
        <p style="margin-bottom:16px;">Adicione eventos de estudo para começar a registrar seu tempo.</p>
        <button class="btn btn-primary" onclick="openAddEventModal()"><i class="fa fa-plus"></i> Adicionar Evento</button>
      </div>
    ` : `
      <div id="med-section-agendado">
        ${agendados.length > 0 ? `
          <div class="section-header"><h2>📌 Agendado para Hoje</h2></div>
          ${agendados.map(e => renderEventCard(e)).join('')}
        ` : ''}
      </div>
      <div id="med-section-estudado">
        ${estudados.length > 0 ? `
          <div class="section-header" style="margin-top:24px;"><h2>✅ Estudado Hoje</h2></div>
          ${estudados.map(e => renderEventCard(e)).join('')}
        ` : ''}
      </div>
    `}
    `;
}

// SURGICAL DOM UPDATES ---------------------------------------
function refreshEventCard(eventId) {
    const el = document.querySelector(`[data-event-id="${eventId}"]`);
    if (!el) { renderCurrentView(); return; }
    const ev = state.eventos.find(e => e.id === eventId);
    if (!ev) { el.remove(); return; }
    const tmp = document.createElement('div');
    tmp.innerHTML = renderEventCard(ev);
    el.replaceWith(tmp.firstElementChild);
    reattachTimers();
}

function refreshMEDSections() {
    if (currentView !== 'med') { renderCurrentView(); return; }
    const today = todayStr();
    const todayEvents = state.eventos.filter(e => e.data === today);
    const agendados = todayEvents.filter(e => e.status !== 'estudei');
    const estudados = todayEvents.filter(e => e.status === 'estudei');
    const totalSecs = estudados.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);

    const statsRow = document.getElementById('med-stats-row');
    if (statsRow) {
        statsRow.innerHTML = `
        < div class="card" style = "flex:1;min-width:200px;padding:20px;text-align:center;" >
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tempo Total Hoje</div>
        <div style="font-size:32px;font-weight:800;font-family:'DM Mono',monospace;color:var(--text-primary);" id="total-time">${formatTime(totalSecs)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${estudados.length} evento(s) concluído(s)</div>
      </div >
      <div class="card" style="flex:1;min-width:200px;padding:20px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Pendentes</div>
        <div style="font-size:32px;font-weight:800;color:var(--blue);">${agendados.length}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">evento(s) para hoje</div>
      </div>
      <div class="card" style="flex:1;min-width:200px;padding:20px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Maior Foco</div>
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-top:8px;">
          ${estudados.length > 0 ? esc(estudados.reduce((a, b) => (b.tempoAcumulado || 0) > (a.tempoAcumulado || 0) ? b : a).titulo || 'N/A') : '—'}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
          ${estudados.length > 0 ? formatTime(estudados.reduce((a, b) => (b.tempoAcumulado || 0) > (a.tempoAcumulado || 0) ? b : a).tempoAcumulado || 0) : ''}
        </div>
      </div>`;
    }

    const secAgendado = document.getElementById('med-section-agendado');
    if (secAgendado) {
        secAgendado.innerHTML = agendados.length > 0
            ? `< div class="section-header" > <h2>📌 Agendado para Hoje</h2></div > ${agendados.map(e => renderEventCard(e)).join('')} `
            : '';
    }

    const secEstudado = document.getElementById('med-section-estudado');
    if (secEstudado) {
        secEstudado.innerHTML = estudados.length > 0
            ? `< div class="section-header" style = "margin-top:24px;" > <h2>✅ Estudado Hoje</h2></div > ${estudados.map(e => renderEventCard(e)).join('')} `
            : '';
    }

    reattachTimers();
    //updateBadges();
}

function removeDOMCard(eventId) {
    const el = document.querySelector(`[data - event - id= "${eventId}"]`);
    if (el) {
        el.remove();
    } else {
        renderCurrentView();
        return;
    }
    refreshMEDSections();
}
