import { state, scheduleSave } from './store.js';
import { generatePlanejamento, getAllDisciplinas } from './logic.js';
import { esc } from './utils.js';

let currentStep = 1;
let draft = {
    tipo: null, // 'ciclo' ou 'semanal'
    disciplinas: [], // ids
    relevancia: {}, // { id: { importancia, conhecimento } }
    horarios: {
        horasSemanais: '',
        sessaoMin: 30,
        sessaoMax: 120,
        diasAtivos: [],
        horasPorDia: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }
    }
};

export function openPlanejamentoWizard() {
    // Carregar estado existente seo houver
    if (state.planejamento && state.planejamento.tipo) {
        draft = JSON.parse(JSON.stringify({
            tipo: state.planejamento.tipo || null,
            disciplinas: state.planejamento.disciplinas || [],
            relevancia: state.planejamento.relevancia || {},
            horarios: state.planejamento.horarios || {
                horasSemanais: '', sessaoMin: 30, sessaoMax: 120, diasAtivos: [],
                horasPorDia: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }
            }
        }));
    } else {
        draft = {
            tipo: null, disciplinas: [], relevancia: {}, horarios: {
                horasSemanais: '', sessaoMin: 30, sessaoMax: 120, diasAtivos: [],
                horasPorDia: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }
            }
        };
    }

    currentStep = 1;
    document.getElementById('modal-planejamento').classList.add('open');
    attachWizardListeners();
    renderStep();
}

function attachWizardListeners() {
    const btnNext = document.getElementById('pw-btn-proximo');
    const btnBack = document.getElementById('pw-btn-voltar');
    const btnDone = document.getElementById('pw-btn-concluir');

    // Remove old listeners by cloning
    btnNext.replaceWith(btnNext.cloneNode(true));
    btnBack.replaceWith(btnBack.cloneNode(true));
    btnDone.replaceWith(btnDone.cloneNode(true));

    document.getElementById('pw-btn-proximo').addEventListener('click', () => {
        if (validateStep(currentStep)) {
            currentStep++;
            renderStep();
        }
    });

    document.getElementById('pw-btn-voltar').addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            renderStep();
        }
    });

    document.getElementById('pw-btn-concluir').addEventListener('click', () => {
        if (validateStep(4)) {
            generatePlanejamento(draft);
            document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Planejamento gerado com sucesso!', type: 'success' } }));
            document.getElementById('modal-planejamento').classList.remove('open');
            document.dispatchEvent(new Event('app:renderCurrentView'));
        }
    });
}

window.pwSelectTipo = function (tipo) {
    draft.tipo = tipo;
    renderStep();
};

window.pwToggleDisc = function (id) {
    if (draft.disciplinas.includes(id)) {
        draft.disciplinas = draft.disciplinas.filter(d => d !== id);
    } else {
        draft.disciplinas.push(id);
    }

    // Auto populate relevance if not exists
    if (!draft.relevancia[id]) {
        draft.relevancia[id] = { importancia: 3, conhecimento: 3 };
    }

    // Update counter
    const c = document.getElementById('pw-disc-count');
    if (c) c.textContent = `${draft.disciplinas.length} disciplinas selecionadas`;

    renderStep(); // Recalculate button states
};

window.pwSearchDisc = function (q) {
    const query = q.toLowerCase();
    document.querySelectorAll('.pw-disc-card').forEach(el => {
        const text = el.textContent.toLowerCase();
        el.style.display = text.includes(query) ? 'flex' : 'none';
    });
};

window.pwSelectAllDisc = function () {
    const all = getAllDisciplinas();
    draft.disciplinas = all.map(d => d.disc.id);
    draft.disciplinas.forEach(id => {
        if (!draft.relevancia[id]) draft.relevancia[id] = { importancia: 3, conhecimento: 3 };
    });
    renderStep();
};

window.pwClearDisc = function () {
    draft.disciplinas = [];
    renderStep();
};

window.pwUpdateRel = function (id, field, val) {
    if (!draft.relevancia[id]) draft.relevancia[id] = { importancia: 3, conhecimento: 3 };
    draft.relevancia[id][field] = parseInt(val, 10);

    // Update label visual
    const lbl = document.getElementById(`pw-lbl-${field}-${id}`);
    if (lbl) lbl.textContent = val;

    pwRenderWeightPreview();
};

window.pwToggleDay = function (dayIndex) {
    const idx = parseInt(dayIndex, 10);
    if (draft.horarios.diasAtivos.includes(idx)) {
        draft.horarios.diasAtivos = draft.horarios.diasAtivos.filter(d => d !== idx);
    } else {
        draft.horarios.diasAtivos.push(idx);
    }
    renderStep(); // Checkboxes can re-render safely
};

window.pwUpdateHours = function (field, val) {
    draft.horarios[field] = val;
    pwUpdateButtons();
};

window.pwUpdateDayHour = function (dayIdx, val) {
    draft.horarios.horasPorDia[dayIdx] = val;
    pwUpdateButtons();
};

function pwUpdateButtons() {
    const btnNext = document.getElementById('pw-btn-proximo');
    const btnDone = document.getElementById('pw-btn-concluir');
    if (currentStep === 4) {
        if (btnDone) btnDone.disabled = !validateStep(4);
    } else {
        if (btnNext) btnNext.disabled = !validateStep(currentStep);
    }
}

function renderStep() {
    // Update Stepper UI
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`pw-step-${i}`);
        if (el) {
            if (i === currentStep) {
                el.style.color = 'var(--accent)';
                el.style.fontWeight = '600';
            } else if (i < currentStep) {
                el.style.color = 'var(--green)';
                el.style.fontWeight = '500';
            } else {
                el.style.color = 'var(--text-muted)';
                el.style.fontWeight = '500';
            }
        }
    }

    // Buttons
    document.getElementById('pw-btn-voltar').style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    const btnNext = document.getElementById('pw-btn-proximo');
    const btnDone = document.getElementById('pw-btn-concluir');

    if (currentStep === 4) {
        btnNext.style.display = 'none';
        btnDone.style.display = 'block';
        btnDone.disabled = !validateStep(4);
    } else {
        btnNext.style.display = 'block';
        btnDone.style.display = 'none';
        btnNext.disabled = !validateStep(currentStep);
    }

    const body = document.getElementById('modal-planejamento-body');
    if (currentStep === 1) body.innerHTML = htmlStep1();
    if (currentStep === 2) body.innerHTML = htmlStep2();
    if (currentStep === 3) {
        body.innerHTML = htmlStep3();
        pwRenderWeightPreview();
    }
    if (currentStep === 4) body.innerHTML = htmlStep4();
}

function validateStep(step) {
    if (step === 1) return !!draft.tipo;
    if (step === 2) return draft.disciplinas.length > 0;
    if (step === 3) return true; // sliders always have values
    if (step === 4) {
        const min = parseInt(draft.horarios.sessaoMin, 10) || 0;
        const max = parseInt(draft.horarios.sessaoMax, 10) || 0;
        if (min < 1 || max < min) return false;

        if (draft.tipo === 'ciclo') {
            const hs = parseFloat(draft.horarios.horasSemanais) || 0;
            return hs > 0 && draft.horarios.diasAtivos.length > 0;
        } else {
            let hasTime = false;
            for (let i = 0; i < 7; i++) {
                const val = draft.horarios.horasPorDia[i];
                if (val && val.trim() !== '' && draft.horarios.diasAtivos.includes(i)) hasTime = true;
            }
            return hasTime && draft.horarios.diasAtivos.length > 0;
        }
    }
    return false;
}

function htmlStep1() {
    return `
        <div style="text-align:center; max-width:500px; margin:0 auto;">
            <h3 style="margin-bottom:8px; font-size:20px;">Qual é a sua estratégia de estudo?</h3>
            <p style="color:var(--text-secondary); margin-bottom:32px; font-size:14px;">
                Escolha o modelo que melhor se adapta à sua rotina atual.
            </p>
            
            <div style="display:flex; flex-direction:column; gap:16px;">
                <div onclick="pwSelectTipo('ciclo')" style="
                    border: 2px solid ${draft.tipo === 'ciclo' ? 'var(--accent)' : 'var(--border)'};
                    background: ${draft.tipo === 'ciclo' ? 'rgba(88,166,255,0.1)' : 'var(--bg-secondary)'};
                    border-radius: 12px; padding: 20px; cursor: pointer; transition: all 0.2s; text-align: left;
                ">
                    <div style="display:flex; align-items:center; gap:16px; margin-bottom:8px;">
                        <div style="font-size:32px;">🔄</div>
                        <div>
                            <div style="font-size:16px; font-weight:600; color:var(--text-primary);">Ciclo de Estudos (Recomendado)</div>
                            <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">As disciplinas se revezam em uma sequência contínua. Ideal para rotinas flexíveis, pois você nunca perde matéria se não puder estudar um dia.</div>
                        </div>
                    </div>
                </div>

                <div onclick="pwSelectTipo('semanal')" style="
                    border: 2px solid ${draft.tipo === 'semanal' ? 'var(--accent)' : 'var(--border)'};
                    background: ${draft.tipo === 'semanal' ? 'rgba(88,166,255,0.1)' : 'var(--bg-secondary)'};
                    border-radius: 12px; padding: 20px; cursor: pointer; transition: all 0.2s; text-align: left;
                ">
                    <div style="display:flex; align-items:center; gap:16px; margin-bottom:8px;">
                        <div style="font-size:32px;">📅</div>
                        <div>
                            <div style="font-size:16px; font-weight:600; color:var(--text-primary);">Grade Semanal Fixa</div>
                            <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">Define horários estritos. Ex: Segunda é Matemática, Terça é Português. Ideal para quem tem rotina 100% previsível.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function htmlStep2() {
    const all = getAllDisciplinas();

    if (all.length === 0) {
        return `
            <div style="text-align:center; padding: 40px 20px;">
                <h3 style="margin-bottom:16px; color:var(--red);">Nenhuma disciplina encontrada</h3>
                <p style="color:var(--text-secondary); margin-bottom:24px;">Você precisa cadastrar editais e disciplinas antes de planejar.</p>
                <button class="btn btn-primary" onclick="window.closeModal('modal-planejamento'); window.navigate('editais');">Ir para Editais</button>
            </div>
        `;
    }

    return `
        <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div>
                    <h3 style="font-size:18px;">Quais disciplinas incluir?</h3>
                    <div id="pw-disc-count" style="font-size:13px; color:var(--text-muted); margin-top:4px;">${draft.disciplinas.length} disciplinas selecionadas</div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-ghost btn-sm" onclick="pwSelectAllDisc()">Todas</button>
                    <button class="btn btn-ghost btn-sm" onclick="pwClearDisc()">Nenhuma</button>
                </div>
            </div>
            
            <input type="text" class="form-control" placeholder="Buscar disciplina..." onkeyup="pwSearchDisc(this.value)" style="margin-bottom: 16px;">
            
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px; max-height: 300px; overflow-y:auto; padding-right:8px;">
                ${all.map(d => {
        const sel = draft.disciplinas.includes(d.disc.id);
        return `
                    <div class="pw-disc-card" onclick="pwToggleDisc('${d.disc.id}')" style="
                        border: 1px solid ${sel ? 'var(--accent)' : 'var(--border)'};
                        background: ${sel ? 'rgba(88,166,255,0.1)' : 'var(--bg-secondary)'};
                        padding: 12px; border-radius: 8px; cursor:pointer; display:flex; align-items:center; gap:8px;
                        transition: all 0.2s;
                    ">
                        <div style="width:20px; height:20px; border-radius:4px; border:1px solid ${sel ? 'var(--accent)' : 'var(--border)'}; background:${sel ? 'var(--accent)' : 'transparent'}; display:flex; align-items:center; justify-content:center; color:var(--accent-text, #fff); font-size:12px;">
                            ${sel ? '✓' : ''}
                        </div>
                        <div style="flex:1; font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(d.disc.nome)}">
                            ${d.disc.icone || '📚'} ${esc(d.disc.nome)}
                        </div>
                    </div>`;
    }).join('')}
            </div>
        </div>
    `;
}

function htmlStep3() {
    const selected = getAllDisciplinas().filter(d => draft.disciplinas.includes(d.disc.id));

    return `
        <div style="display:flex; gap: 24px; flex-wrap: wrap;">
            <div style="flex: 2; min-width:300px;">
                <h3 style="font-size:18px; margin-bottom:4px;">Relevância e Domínio</h3>
                <p style="color:var(--text-secondary); font-size:13px; margin-bottom:24px;">Defina a importância da matéria para sua prova e o seu nível de conhecimento atual. O sistema priorizará matérias muito importantes que você ainda não domina.</p>
                
                <div style="display:flex; flex-direction:column; gap:16px; max-height:400px; overflow-y:auto; padding-right:8px;">
                    ${selected.map(d => {
        const rel = draft.relevancia[d.disc.id] || { importancia: 3, conhecimento: 3 };
        return `
                        <div style="background:var(--bg-secondary); border:1px solid var(--border); padding:16px; border-radius:12px;">
                            <div style="font-weight:600; font-size:14px; margin-bottom:12px; color:var(--text-primary);">${d.disc.icone || '📚'} ${esc(d.disc.nome)}</div>
                            
                            <div style="display:flex; flex-wrap:wrap; gap:24px;">
                                <div style="flex:1; min-width:150px;">
                                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px; color:var(--text-muted);">
                                        <span>Importância (Peso da prova)</span>
                                        <span id="pw-lbl-importancia-${d.disc.id}" style="color:var(--text-primary); font-weight:600;">${rel.importancia}</span>
                                    </div>
                                    <input type="range" min="1" max="5" value="${rel.importancia}" 
                                        oninput="pwUpdateRel('${d.disc.id}', 'importancia', this.value)"
                                        style="width:100%; cursor:pointer;">
                                    <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted); margin-top:4px;">
                                        <span>Baixa</span><span>Alta</span>
                                    </div>
                                </div>
                                <div style="flex:1; min-width:150px;">
                                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px; color:var(--text-muted);">
                                        <span>Seu Conhecimento Atual</span>
                                        <span id="pw-lbl-conhecimento-${d.disc.id}" style="color:var(--text-primary); font-weight:600;">${rel.conhecimento}</span>
                                    </div>
                                    <input type="range" min="0" max="5" value="${rel.conhecimento}" 
                                        oninput="pwUpdateRel('${d.disc.id}', 'conhecimento', this.value)"
                                        style="width:100%; cursor:pointer;">
                                    <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted); margin-top:4px;">
                                        <span>Iniciante</span><span>Mestre</span>
                                    </div>
                                </div>
                            </div>
                        </div>`;
    }).join('')}
                </div>
            </div>
            
            <div style="flex: 1; min-width:250px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; padding:16px; align-self:flex-start;">
                <h4 style="font-size:14px; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">Distribuição de Tempo Estimada</h4>
                <div id="pw-weight-preview" style="display:flex; flex-direction:column; gap:8px;">
                    <!-- Injected real time -->
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:16px; text-align:center;">Atualizado em tempo real baseado no Peso = Importância x (6 - Conhecimento)</div>
            </div>
        </div>
    `;
}

window.pwRenderWeightPreview = function () {
    const el = document.getElementById('pw-weight-preview');
    if (!el) return;

    let totalPeso = 0;
    const computed = [];
    const selected = getAllDisciplinas().filter(d => draft.disciplinas.includes(d.disc.id));

    selected.forEach(d => {
        const r = draft.relevancia[d.disc.id] || { importancia: 3, conhecimento: 3 };
        const peso = r.importancia * (6 - r.conhecimento);
        totalPeso += peso;
        computed.push({ name: d.disc.nome, color: d.edital.cor || 'var(--accent)', peso });
    });

    computed.sort((a, b) => b.peso - a.peso);

    el.innerHTML = computed.map(c => {
        const pct = totalPeso > 0 ? ((c.peso / totalPeso) * 100).toFixed(1) : 0;
        return `
            <div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70%;">${esc(c.name)}</span>
                    <span style="font-weight:600;">${pct}%</span>
                </div>
                <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden;">
                    <div style="height:100%; width:${pct}%; background:${c.color};"></div>
                </div>
            </div>
        `;
    }).join('');
};

function htmlStep4() {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    let html = `
        <h3 style="font-size:18px; margin-bottom:4px;">Configuração de Horários</h3>
        <p style="color:var(--text-secondary); font-size:13px; margin-bottom:24px;">Defina os limites corporais do seu estudo. Qual o tamanho de um "bloco de estudo" para este longo prazo?</p>
        
        <div style="display:flex; gap:16px; margin-bottom:24px;">
            <div style="flex:1;">
                <label class="form-label">Sessão Mínima (minutos)</label>
                <input type="number" class="form-control" value="${draft.horarios.sessaoMin}" oninput="pwUpdateHours('sessaoMin', this.value)">
                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Bloco inquebrável (ex: 30)</div>
            </div>
            <div style="flex:1;">
                <label class="form-label">Sessão Máxima (minutos)</label>
                <input type="number" class="form-control" value="${draft.horarios.sessaoMax}" oninput="pwUpdateHours('sessaoMax', this.value)">
                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Trocar de matéria após X min (ex: 120)</div>
            </div>
        </div>
    `;

    if (draft.tipo === 'ciclo') {
        html += `
            <div style="background:var(--bg-secondary); border:1px solid var(--border); padding:20px; border-radius:12px;">
                <h4 style="font-size:15px; margin-bottom:16px;">Meta do Ciclo</h4>
                <div style="margin-bottom:24px;">
                    <label class="form-label">Total de horas para Fechar um Ciclo inteiro</label>
                    <input type="number" step="0.5" class="form-control" placeholder="Ex: 30" value="${draft.horarios.horasSemanais}" oninput="pwUpdateHours('horasSemanais', this.value)">
                    <p style="font-size:12px; color:var(--text-muted); margin-top:6px;">Quando você atingir essas X horas estudadas, o ciclo zera e as matérias se repetem. É comum alinhar as horas do ciclo com as suas de estudo semanal, mas no Ciclo, o Carga Horária independe dos dias solares.</p>
                </div>

                <label class="form-label">Quais dias de sol você pretende estudar? (Apenas para estimativas)</label>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    ${days.map((d, i) => `
                        <button onclick="pwToggleDay(${i})" class="btn" style="flex:1; min-width:40px; padding:8px; 
                            background:${draft.horarios.diasAtivos.includes(i) ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}; 
                            color:${draft.horarios.diasAtivos.includes(i) ? 'var(--accent-text)' : 'var(--text-muted)'};
                        ">${d}</button>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        html += `
            <div style="background:var(--bg-secondary); border:1px solid var(--border); padding:20px; border-radius:12px;">
                <h4 style="font-size:15px; margin-bottom:16px;">Agenda Semanal</h4>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${days.map((d, i) => {
            const ativo = draft.horarios.diasAtivos.includes(i);
            return `
                        <div style="display:flex; align-items:center; gap:16px;">
                            <label style="display:flex; align-items:center; gap:8px; width:80px; cursor:pointer;">
                                <input type="checkbox" ${ativo ? 'checked' : ''} onchange="pwToggleDay(${i})">
                                <span style="font-weight:600; color:${ativo ? 'var(--text-primary)' : 'var(--text-muted)'}">${d}</span>
                            </label>
                            <input type="time" class="form-control" style="flex:1; opacity: ${ativo ? '1' : '0.3'}; pointer-events: ${ativo ? 'auto' : 'none'};" 
                                value="${draft.horarios.horasPorDia[i] || ''}" oninput="pwUpdateDayHour(${i}, this.value)">
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    }

    return html;
}
