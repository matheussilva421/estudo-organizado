const fs = require('fs');

// ============================================================
// 1. Add modal HTML to index.html
// ============================================================
let html = fs.readFileSync('src/index.html', 'utf8');

// Add the modal before </body>
const modalHtml = `
    <!-- REGISTRO SESSÃO MODAL -->
    <div class="modal-overlay" id="modal-registro-sessao" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="modal" style="max-width:720px;max-height:90vh;">
            <div class="modal-header" style="background:linear-gradient(135deg,#0d1117,#161b22);border-bottom:1px solid rgba(255,255,255,0.06);">
                <h2 style="color:#e6edf3;">📝 Registro da Sessão de Estudo</h2>
                <button class="modal-close" data-action="close-modal" data-modal="modal-registro-sessao"
                    aria-label="Fechar" title="Fechar">×</button>
            </div>
            <div class="modal-body" id="modal-registro-body" style="overflow-y:auto;max-height:calc(90vh - 140px);padding:0;">
                <!-- Dynamic content rendered by JS -->
            </div>
            <div class="modal-footer" style="background:var(--card-bg);border-top:1px solid var(--border);gap:8px;">
                <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-registro-sessao">Cancelar</button>
                <button class="btn btn-ghost" onclick="saveAndStartNew()" style="color:var(--green);">
                    Salvar e iniciar nova ↻
                </button>
                <button class="btn btn-primary" onclick="saveRegistroSessao()">
                    💾 Salvar Registro
                </button>
            </div>
        </div>
    </div>
`;

html = html.replace('</body>', modalHtml + '\n</body>');
fs.writeFileSync('src/index.html', html);
console.log('✅ Added modal-registro-sessao to index.html');

// ============================================================
// 2. Add CSS for the Registro form
// ============================================================
let css = fs.readFileSync('src/css/styles.css', 'utf8');

const registroCss = `

/* =============================================
   REGISTRO SESSÃO STYLES
   ============================================= */

.reg-block {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}
.reg-block:last-child {
  border-bottom: none;
}
.reg-block-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 14px 0;
}
.reg-summary {
  background: linear-gradient(135deg, rgba(16,185,129,0.06), rgba(56,189,248,0.04));
}
.reg-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}
.reg-stat {
  text-align: center;
  padding: 12px;
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border);
}
.reg-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.reg-stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}
.reg-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}
.reg-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.reg-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
}
.reg-label .req {
  color: var(--red);
  font-weight: 700;
}
.reg-select, .reg-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.reg-select:focus, .reg-input:focus {
  outline: none;
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgba(16,185,129,0.15);
}
.reg-textarea {
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  box-sizing: border-box;
}
.reg-textarea:focus {
  outline: none;
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgba(16,185,129,0.15);
}
.btn-inline {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--green);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.2s;
}
.btn-inline:hover {
  background: rgba(16,185,129,0.1);
  border-color: var(--green);
}

/* Chips */
.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.chip:hover {
  border-color: var(--green);
  color: var(--text);
}
.chip-active {
  background: rgba(16,185,129,0.15);
  border-color: var(--green);
  color: var(--green);
  font-weight: 600;
}

/* Results cards */
.reg-results-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}
.reg-results-header {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 12px;
}

@media (max-width: 600px) {
  .reg-summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .reg-row {
    flex-direction: column;
  }
}
`;

css += registroCss;
fs.writeFileSync('src/css/styles.css', css);
console.log('✅ Added Registro Sessão CSS styles');

// ============================================================
// 3. Update main.js to import registro-sessao.js
// ============================================================
let main = fs.readFileSync('src/js/main.js', 'utf8');

if (!main.includes('registro-sessao')) {
    main = main.replace(
        "import * as drive_sync from './drive-sync.js';",
        "import * as drive_sync from './drive-sync.js';\nimport * as registro from './registro-sessao.js';"
    );
    main = main.replace(
        "const modules = [store, app, logic, components, views, drive_sync];",
        "const modules = [store, app, logic, components, views, drive_sync, registro];"
    );
    fs.writeFileSync('src/js/main.js', main);
    console.log('✅ Updated main.js with registro-sessao import');
}

// ============================================================
// 4. Update marcarEstudei in logic.js to open registro
// ============================================================
let logic = fs.readFileSync('src/js/logic.js', 'utf8');

// Replace the marcarEstudei function body to call openRegistroSessao
const oldMarcar = `export function marcarEstudei(eventId) {`;
const newMarcar = `export function marcarEstudei(eventId) {
  // Open the Registro da Sessão de Estudo modal instead of immediately marking
  if (typeof window.openRegistroSessao === 'function') {
    window.openRegistroSessao(eventId);
    return;
  }
  // Fallback: original behavior if registro module not loaded
  _marcarEstudeiDirect(eventId);
}

export function _marcarEstudeiDirect(eventId) {`;

logic = logic.replace(oldMarcar, newMarcar);
fs.writeFileSync('src/js/logic.js', logic);
console.log('✅ Updated marcarEstudei to open Registro modal');

// ============================================================
// 5. Update Cronômetro ⏹ button in components.js
// ============================================================
let comp = fs.readFileSync('src/js/components.js', 'utf8');

// The ⏹ button already calls marcarEstudei, which now opens the modal
// No changes needed here since marcarEstudei was updated
console.log('✅ Cronômetro ⏹ button already wired via marcarEstudei');

console.log('\n✅ All Registro da Sessão changes applied!');
