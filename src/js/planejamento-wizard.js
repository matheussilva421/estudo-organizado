import { state, scheduleSave } from './store.js?v=8.14';
import { generatePlanejamento, getAllDisciplinas } from './logic.js?v=8.14';
import { esc } from './utils.js?v=8.14';
import { openModal, closeModal } from './app.js?v=8.14';

let currentStep = 1;
let draft = {
    tipo: null, // 'ciclo' ou 'semanal'
    disciplinas: [], // ids
    relevancia: {}, // { id: { importancia, conhecimento } }
    horarios: {
        horasSemanais: '',
        sessaoMin: 30,
        sessaoMax: 120,
        dataInicial: '',
        dataFinal: '',
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
                horasSemanais: '', sessaoMin: 30, sessaoMax: 120, diasAtivos: [], dataInicial: '', dataFinal: '',
                horasPorDia: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }
            }
        }));
    } else {
        draft = {
            tipo: null, disciplinas: [], relevancia: {}, horarios: {
                horasSemanais: '', sessaoMin: 30, sessaoMax: 120, diasAtivos: [], dataInicial: '', dataFinal: '',
                horasPorDia: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }
            }
        };
    }

    currentStep = 1;
    openModal('modal-planejamento');
    attachWizardListeners();
    renderStep();
}

function attachWizardListeners() {
    const btnNext = document.getElementById('pw-btn-proximo');
    const btnBack = document.getElementById('pw-btn-voltar');
    const btnDone = document.getElementById('pw-btn-concluir');

    if (!btnNext || !btnBack || !btnDone) {
        console.error('attachWizardListeners: elementos do wizard não encontrados');
        return;
    }

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
            try {
                generatePlanejamento(draft);
                document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Planejamento gerado com sucesso!', type: 'success' } }));
                closeModal('modal-planejamento');
                document.dispatchEvent(new Event('app:renderCurrentView'));
            } catch (err) {
                document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Erro ao gerar Planejamento: ' + err.message, type: 'error' } }));
                console.error(err);
            }
        } else {
            document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Erro de validação no passo 4. Verifique os campos.', type: 'error' } }));
        }
    });
}

export function pwSelectTipo(tipo) {
    draft.tipo = tipo;
    renderStep();
}

export function pwToggleDisc(id) {
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
}

export function pwSearchDisc(q) {
    const query = q.toLowerCase();
    document.querySelectorAll('.pw-disc-card').forEach(el => {
        const text = el.textContent.toLowerCase();
        el.style.display = text.includes(query) ? 'flex' : 'none';
    });
}

export function pwSelectAllDisc() {
    const all = getAllDisciplinas();
    draft.disciplinas = all.map(d => d.disc.id);
    draft.disciplinas.forEach(id => {
        if (!draft.relevancia[id]) draft.relevancia[id] = { importancia: 3, conhecimento: 3 };
    });
    renderStep();
}

export function pwClearDisc() {
    draft.disciplinas = [];
    renderStep();
}

let _relDebounce = null;
export function pwUpdateRel(id, field, val) {
    if (!draft.relevancia[id]) draft.relevancia[id] = { importancia: 3, conhecimento: 3 };
    draft.relevancia[id][field] = parseInt(val, 10);

    // Update label visual
    const lbl = document.getElementById(`pw-lbl-${field}-${id}`);
    if (lbl) lbl.textContent = val;

    if (_relDebounce) clearTimeout(_relDebounce);
    _relDebounce = setTimeout(() => {
        pwRenderWeightPreview();
    }, 100);
}

export function pwToggleDay(dayIndex) {
    const idx = parseInt(dayIndex, 10);
    if (draft.horarios.diasAtivos.includes(idx)) {
        draft.horarios.diasAtivos = draft.horarios.diasAtivos.filter(d => d !== idx);
    } else {
        draft.horarios.diasAtivos.push(idx);
    }
    renderStep(); // Checkboxes can re-render safely
}

export function pwUpdateHours(field, val) {
    draft.horarios[field] = val;
    pwUpdateButtons();
}

let _hoursDebounce = null;
export function pwUpdateDayHour(dayIdx, val) {
    draft.horarios.horasPorDia[dayIdx] = val;
    if (_hoursDebounce) clearTimeout(_hoursDebounce);
    _hoursDebounce = setTimeout(() => {
        pwUpdateButtons();
    }, 100);
}

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
            return hs > 0;
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
        <div class="pw-center-container">
            <h3 class="mb-2 text-20px">Qual é a sua estratégia de estudo?</h3>
            <p class="text-secondary text-lg mb-6">
                Escolha o modelo que melhor se adapta à sua rotina atual.
            </p>

            <div class="stack-md">
                <div data-action="pw-select-tipo" data-tipo="ciclo" style="
                    border: 2px solid ${draft.tipo === 'ciclo' ? 'var(--accent)' : 'var(--border)'};
                    background: ${draft.tipo === 'ciclo' ? 'rgba(88,166,255,0.1)' : 'var(--bg-secondary)'};
                    border-radius: 12px; padding: 20px; cursor: pointer; transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s; text-align: left;
                ">
                    <div class="cluster-lg mb-2">
                        <div class="text-3xl">🔄</div>
                        <div>
                            <div class="text-xl font-semibold text-primary">Ciclo de Estudos (Recomendado)</div>
                            <div class="text-md text-muted mt-1">As disciplinas se revezam em uma sequência contínua. Ideal para rotinas flexíveis, pois você nunca perde matéria se não puder estudar um dia.</div>
                        </div>
                    </div>
                </div>

                <div data-action="pw-select-tipo" data-tipo="semanal" style="
                    border: 2px solid ${draft.tipo === 'semanal' ? 'var(--accent)' : 'var(--border)'};
                    background: ${draft.tipo === 'semanal' ? 'rgba(88,166,255,0.1)' : 'var(--bg-secondary)'};
                    border-radius: 12px; padding: 20px; cursor: pointer; transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s; text-align: left;
                ">
                    <div class="cluster-lg mb-2">
                        <div class="text-3xl">📅</div>
                        <div>
                            <div class="text-xl font-semibold text-primary">Grade Semanal Fixa</div>
                            <div class="text-md text-muted mt-1">Define horários estritos. Ex: Segunda é Matemática, Terça é Português. Ideal para quem tem rotina 100% previsível.</div>
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
            <div class="pw-empty-state">
                <h3 class="mb-4 text-red">Nenhuma disciplina encontrada</h3>
                <p class="text-secondary mb-6">Você precisa cadastrar editais e disciplinas antes de planejar.</p>
                <button class="btn btn-primary" data-action="navigate" data-view="editais">Ir para Editais</button>
            </div>
        `;
    }

    return `
        <div>
            <div class="flex-between mb-4">
                <div>
                    <h3 class="text-18px">Quais disciplinas incluir?</h3>
                    <div id="pw-disc-count" class="text-md text-muted mt-1">${draft.disciplinas.length} disciplinas selecionadas</div>
                </div>
                <div class="cluster-sm">
                    <button class="btn btn-ghost btn-sm" data-action="pw-select-all-disc">Todas</button>
                    <button class="btn btn-ghost btn-sm" data-action="pw-clear-disc">Nenhuma</button>
                </div>
            </div>

            <input type="text" class="form-control mb-4" placeholder="Buscar disciplina..." data-action="pw-search-disc">

            <div class="pw-disc-grid">
                ${all.map(d => {
        const sel = draft.disciplinas.includes(d.disc.id);
        return `
                    <div class="pw-disc-card" data-action="pw-toggle-disc" data-disc-id="${d.disc.id}" style="
                        border: 1px solid ${sel ? 'var(--accent)' : 'var(--border)'};
                        background: ${sel ? 'rgba(88,166,255,0.1)' : 'var(--bg-secondary)'};
                        padding: 12px; border-radius: 8px; cursor:pointer; display:flex; align-items:center; gap:8px;
                        transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
                    ">
                        <div style="width:20px; height:20px; border-radius:4px; border:1px solid ${sel ? 'var(--accent)' : 'var(--border)'}; background:${sel ? 'var(--accent)' : 'transparent'}; display:flex; align-items:center; justify-content:center; color:var(--accent-text, #fff); font-size:12px;">
                            ${sel ? '✓' : ''}
                        </div>
                        <div class="flex-1 text-md font-medium text-ellipsis" title="${esc(d.disc.nome)}">
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
        <div class="pw-main-layout">
            <div class="pw-main-left">
                <h3 class="text-18px mb-1">Relevância e Domínio</h3>
                <p class="text-secondary text-md mb-6">Defina a importância da matéria para sua prova e o seu nível de conhecimento atual. O sistema priorizará matérias muito importantes que você ainda não domina.</p>

                <div class="pw-slider-group">
                    ${selected.map(d => {
        const rel = draft.relevancia[d.disc.id] || { importancia: 3, conhecimento: 3 };
        return `
                        <div class="pw-slider-card">
                            <div class="font-semibold text-lg mb-3 text-primary">${d.disc.icone || '📚'} ${esc(d.disc.nome)}</div>

                            <div class="pw-slider-row">
                                <div class="pw-slider-field">
                                    <div class="pw-range-label-row">
                                        <span>Importância (Peso da prova)</span>
                                        <span id="pw-lbl-importancia-${d.disc.id}" class="pw-range-value">${rel.importancia}</span>
                                    </div>
                                    <input type="range" min="1" max="5" value="${rel.importancia}"
                                        data-action="pw-update-relevancia" data-disc-id="${d.disc.id}" data-type="importancia"
                                        class="w-full cursor-pointer">
                                    <div class="pw-range-bounds">
                                        <span>Baixa</span><span>Alta</span>
                                    </div>
                                </div>
                                <div class="pw-slider-field">
                                    <div class="pw-range-label-row">
                                        <span>Seu Conhecimento Atual</span>
                                        <span id="pw-lbl-conhecimento-${d.disc.id}" class="pw-range-value">${rel.conhecimento}</span>
                                    </div>
                                    <input type="range" min="0" max="5" value="${rel.conhecimento}"
                                        data-action="pw-update-relevancia" data-disc-id="${d.disc.id}" data-type="conhecimento"
                                        class="w-full cursor-pointer">
                                    <div class="pw-range-bounds">
                                        <span>Iniciante</span><span>Mestre</span>
                                    </div>
                                </div>
                            </div>
                        </div>`;
    }).join('')}
                </div>
            </div>

            <div class="pw-main-right">
                <h4 class="pw-preview-heading">Distribuição de Tempo Estimada</h4>
                <div id="pw-weight-preview" class="stack-sm">
                    <!-- Injected real time -->
                </div>
                <div class="text-sm text-muted mt-4 text-center">Atualizado em tempo real baseado no Peso = Importância x (6 - Conhecimento)</div>
            </div>
        </div>
    `;
}

export function pwRenderWeightPreview() {
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
                <div class="pw-bar-label-row">
                    <span class="pw-bar-name">${esc(c.name)}</span>
                    <span class="pw-bar-pct">${pct}%</span>
                </div>
                <div class="pw-bar-track">
                    <div style="height:100%; width:${pct}%; background:${c.color};"></div>
                </div>
            </div>
        `;
    }).join('');
}

Object.assign(window, {
    pwSelectTipo,
    pwToggleDisc,
    pwSearchDisc,
    pwSelectAllDisc,
    pwClearDisc,
    pwUpdateRel,
    pwToggleDay,
    pwUpdateHours,
    pwUpdateDayHour,
    pwRenderWeightPreview
});

function htmlStep4() {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    let html = `
        <h3 class="text-18px mb-1">Configuração de Horários</h3>
        <p class="text-secondary text-md mb-6">Defina os limites corporais do seu estudo. Qual o tamanho de um "bloco de estudo" para este longo prazo?</p>

        <div class="pw-date-row">
            <div class="flex-1">
                <label class="form-label">Data Inicial (Opcional - Previsões)</label>
                <input type="date" class="form-control" value="${draft.horarios.dataInicial || ''}" data-action="pw-update-hours" data-field="dataInicial">
                <div class="text-sm text-muted mt-1">Início do Período</div>
            </div>
            <div class="flex-1">
                <label class="form-label">Data Final (Opcional - Previsões)</label>
                <input type="date" class="form-control" value="${draft.horarios.dataFinal || ''}" data-action="pw-update-hours" data-field="dataFinal">
                <div class="text-sm text-muted mt-1">Fim do Período</div>
            </div>
        </div>

        <div class="pw-date-row">
            <div class="flex-1">
                <label class="form-label">Sessão Mínima (minutos)</label>
                <input type="number" class="form-control" value="${draft.horarios.sessaoMin}" data-action="pw-update-hours" data-field="sessaoMin">
                <div class="text-sm text-muted mt-1">Bloco inquebrável (ex: 30)</div>
            </div>
            <div class="flex-1">
                <label class="form-label">Sessão Máxima (minutos)</label>
                <input type="number" class="form-control" value="${draft.horarios.sessaoMax}" data-action="pw-update-hours" data-field="sessaoMax">
                <div class="text-sm text-muted mt-1">Trocar de matéria após X min (ex: 120)</div>
            </div>
        </div>
    `;

    if (draft.tipo === 'ciclo') {
        html += `
            <div class="pw-config-card">
                <h4 class="pw-config-heading">Meta do Ciclo</h4>
                <div class="mb-6">
                    <label class="form-label">Total de horas para Fechar um Ciclo inteiro</label>
                    <input type="number" step="0.5" class="form-control" placeholder="Ex: 30" value="${draft.horarios.horasSemanais}" data-action="pw-update-hours" data-field="horasSemanais">
                    <p class="text-base text-muted mt-2">Quando você atingir essas X horas estudadas, o ciclo zera e as matérias se repetem. É comum alinhar as horas do ciclo com as suas de estudo semanal, mas no Ciclo, o Carga Horária independe dos dias solares.</p>
                </div>

                <label class="form-label">Quais dias de sol você pretende estudar? (Apenas para estimativas)</label>
                <div class="flex-wrap cluster-sm">
                    ${days.map((d, i) => `
                        <button data-action="pw-toggle-day" data-day-index="${i}" class="btn" style="flex:1; min-width:40px; padding:8px;
                            background:${draft.horarios.diasAtivos.includes(i) ? 'var(--accent)' : 'rgba(255,255,255,0.05)'};
                            color:${draft.horarios.diasAtivos.includes(i) ? 'var(--accent-text)' : 'var(--text-muted)'};
                        ">${d}</button>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="pw-config-card">
                <h4 class="pw-config-heading">Agenda Semanal</h4>
                <div class="pw-week-grid">
                    ${days.map((d, i) => {
            const ativo = draft.horarios.diasAtivos.includes(i);
            return `
                        <div class="pw-week-row">
                            <label class="cluster-sm cursor-pointer" style="width:80px;">
                                <input type="checkbox" ${ativo ? 'checked' : ''} data-action="pw-toggle-day" data-day-index="${i}">
                                <span class="font-semibold" style="color:${ativo ? 'var(--text-primary)' : 'var(--text-muted)'}">${d}</span>
                            </label>
                            <input type="time" class="form-control flex-1" style="opacity: ${ativo ? '1' : '0.3'}; pointer-events: ${ativo ? 'auto' : 'none'};"
                                value="${draft.horarios.horasPorDia[i] || ''}" data-action="pw-update-day-hour" data-day-index="${i}">
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    }

    return html;
}
