const fs = require('fs');

// 1. Update button labels in app.js and components.js
const appFile = 'src/js/app.js';
let appStr = fs.readFileSync(appFile, 'utf8');
appStr = appStr.replace(/<i class="fa fa-plus"><\/i> Novo Evento<\/button>/g, '<i class="fa fa-plus"></i> Iniciar Estudo</button>');
fs.writeFileSync(appFile, appStr);
console.log('✅ Updated buttons in app.js');

const compFile = 'src/js/components.js';
let compStr = fs.readFileSync(compFile, 'utf8');
compStr = compStr.replace(/<i class="fa fa-plus"><\/i> Novo Evento<\/button>/g, '<i class="fa fa-plus"></i> Iniciar Estudo</button>');
fs.writeFileSync(compFile, compStr);
console.log('✅ Updated buttons in components.js');

// 2. Refactor views.js
const viewsFile = 'src/js/views.js';
let viewsStr = fs.readFileSync(viewsFile, 'utf8');

// Replace openAddEventModal
const openAddRegex = /export function openAddEventModal[\s\S]*?openModal\('modal-event'\);\r?\n\s*setTimeout\(\(\) => updateDayLoad\(dateStr \|\| todayStr\(\)\), 50\);\r?\n\}/;

const newOpenAddEventModal = `export function openAddEventModal(dateStr = null) {
  editingEventId = null;
  const allDiscs = getAllDisciplinas();
  const discOptions = allDiscs.map(({ disc, edital }) => \`<option value="\${disc.id}" data-edital="\${edital.id}">\${esc(edital.nome)} → \${esc(disc.nome)}</option>\`
  ).join('');

  document.getElementById('modal-event-title').textContent = 'Iniciar Estudo';
  document.getElementById('modal-event-body').innerHTML = \`
    <div id="event-conteudo-fields">
      <div class="form-group">
        <label class="form-label">Disciplina</label>
        <select class="form-control" id="event-disc" onchange="loadAssuntos()">
          <option value="">Sem disciplina específica</option>
          \${discOptions}
        </select>
      </div>
      <div class="form-group" id="event-assunto-group" style="display:none;">
        <label class="form-label">Assunto (opcional)</label>
        <select class="form-control" id="event-assunto">
          <option value="">Sem assunto específico</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Título do Evento</label>
      <input type="text" class="form-control" id="event-titulo" placeholder="Ex: Estudar Direito Constitucional">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data</label>
        <input type="date" class="form-control" id="event-data" value="\${dateStr || todayStr()}"
          oninput="updateDayLoad(this.value)">
        <div id="day-load-hint" style="font-size:11px;margin-top:4px;color:var(--text-muted);"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Duração Prevista</label>
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
      <label class="form-label">Anotações (opcional)</label>
      <textarea class="form-control" id="event-notas" rows="2" placeholder="Observações rápidas sobre o estudo..."></textarea>
    </div>
    <details style="margin-bottom:12px;">
      <summary style="font-size:13px;font-weight:600;color:var(--text-secondary);cursor:pointer;padding:6px 0;">📝 Fontes e referências (opcional)</summary>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Fontes de Estudo</label>
          <input type="text" class="form-control" id="event-fontes" placeholder="Ex: Gran Cursos pág. 45, Art. 37 CF/88...">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Legislação Pertinente</label>
          <input type="text" class="form-control" id="event-legislacao" placeholder="Ex: Lei 8.112/90, CF Art. 5º...">
        </div>
      </div>
    </details>
    <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
      <button class="btn btn-ghost" onclick="closeModal('modal-event')">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEvent()">Salvar / Iniciar</button>
    </div>
  \`;
  openModal('modal-event');
  setTimeout(() => updateDayLoad(dateStr || todayStr()), 50);
}`;

viewsStr = viewsStr.replace(openAddRegex, newOpenAddEventModal);

// Remove unused state and selectEventType function
viewsStr = viewsStr.replace(/export let currentEventType = 'conteudo';\r?\nexport function selectEventType\(tipo\) \{[\s\S]*?\}\r?\n/, '');

// Replace saveEvent
const saveEventRegex = /export function saveEvent\(\) \{[\s\S]*?  \};\r?\n\r?\n  \/\/ Tech 3: Warn if there are already many events on this day[\s\S]*?\}\r?\n/;

const newSaveEvent = `export function saveEvent() {
  const titulo = document.getElementById('event-titulo').value.trim();
  const data = document.getElementById('event-data').value;
  const duracao = parseInt(document.getElementById('event-duracao').value || '60');
  const notas = document.getElementById('event-notas').value.trim();
  const fontes = document.getElementById('event-fontes')?.value.trim() || '';
  const legislacao = document.getElementById('event-legislacao')?.value.trim() || '';

  let discId = document.getElementById('event-disc')?.value || '';
  let assId = document.getElementById('event-assunto')?.value || '';
  let autoTitle = titulo;

  if (!titulo && discId) {
    const d = getDisc(discId);
    autoTitle = \`Estudar \${d?.disc.nome || 'Disciplina'}\`;
  }

  if (!autoTitle) { showToast('Informe um título para o evento', 'error'); return; }

  // Helper that actually creates and saves the event
  const doSave = () => {
    const evento = {
      id: uid(), titulo: autoTitle, data, duracao, notas, fontes, legislacao,
      status: 'agendado', tempoAcumulado: 0,
      tipo: 'conteudo', // Fixed to conteudo since we unified it
      discId: discId || null,
      assId: assId || null,
      habito: null, // Habit array is formed upon completion
      criadoEm: new Date().toISOString()
    };

    state.eventos.push(evento);
    scheduleSave();
    closeModal('modal-event');
    renderCurrentView();
    showToast('Estudo iniciado/agendado!', 'success');
  };

  // Tech 3: Warn if there are already many events on this day
  const existingOnDay = state.eventos.filter(e => e.data === data && e.status !== 'estudei');
  const totalDuracao = existingOnDay.reduce((s, e) => s + (e.duracao || 0), 0) + duracao;
  if (existingOnDay.length >= 3 || totalDuracao > 480) {
    const horas = Math.round(totalDuracao / 60 * 10) / 10;
    const msg = existingOnDay.length >= 3
      ? \`Você já tem \${existingOnDay.length} evento(s) neste dia. Adicionar mais pode gerar sobrecarga.\`
      : \`Você já tem \${Math.round((totalDuracao - duracao) / 60 * 10) / 10}h agendadas neste dia. Com este evento seriam \${horas}h.\`;
    showConfirm(msg, doSave, { label: 'Adicionar mesmo assim', title: 'Muitos eventos no dia' });
    return;
  }

  doSave();
}`;

viewsStr = viewsStr.replace(saveEventRegex, newSaveEvent);

// Also remove from index.html -> <h2 id="modal-event-title">Adicionar Evento de Estudo</h2>
// Since we overwrite it in HTML generation, no hard change needed unless it's static.
const indexFile = 'src/index.html';
let indexStr = fs.readFileSync(indexFile, 'utf8');
indexStr = indexStr.replace(/<h2 id="modal-event-title">Adicionar Evento de Estudo<\/h2>/, '<h2 id="modal-event-title">Iniciar Estudo</h2>');
fs.writeFileSync(indexFile, indexStr);
console.log('✅ Updated title in index.html');

fs.writeFileSync(viewsFile, viewsStr);
console.log('✅ Simplifed openAddEventModal and saveEvent in views.js');
