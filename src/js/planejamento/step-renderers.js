import { esc } from '../utils.js?v=8.37';
import { getActiveDisciplinas } from '../logic.js?v=8.37';

// ─── Edital grouping helpers ────────────────────────────────────────

export function getEditalGroupId(item) {
  return item.edital?.id || item.edital?.nome || 'sem-edital';
}

export function getDisciplinasByEditalId(editalId) {
  return (getActiveDisciplinas() || []).filter((item) => getEditalGroupId(item) === editalId);
}

export function groupDisciplinasByEdital(items) {
  const groups = [];
  const byId = new Map();

  items.forEach((item) => {
    const id = getEditalGroupId(item);
    if (!byId.has(id)) {
      const group = {
        id,
        edital: item.edital || {},
        disciplinas: [],
      };
      byId.set(id, group);
      groups.push(group);
    }
    byId.get(id).disciplinas.push(item);
  });

  return groups;
}

// ─── Card rendering helpers ─────────────────────────────────────────

function renderPlanejamentoDiscCard(d, draft) {
  const sel = draft.disciplinas.includes(d.disc.id);
  return `
                                <div class="pw-disc-card selection-card ${sel ? 'is-selected' : ''}" data-action="pw-toggle-disc" data-disc-id="${d.disc.id}">
                                    <div class="selection-check">
                                        ${sel ? '\u2713' : ''}
                                    </div>
                                    <div class="flex-1 text-md font-medium text-ellipsis" title="${esc(d.disc.nome)}">
                                        ${d.disc.icone || '\uD83D\uDCDA'} ${esc(d.disc.nome)}
                                    </div>
                                </div>`;
}

function renderPlanejamentoEditalGroup(group, draft) {
  const selectedCount = group.disciplinas.filter((d) =>
    draft.disciplinas.includes(d.disc.id)
  ).length;

  return `
                    <section class="pw-edital-group" data-edital-id="${esc(group.id)}">
                        <div class="pw-edital-group-header">
                            <div class="pw-edital-title-row">
                                <span class="pw-edital-color" style="background:${group.edital.cor || 'var(--accent)'};"></span>
                                <div>
                                    <h4 class="pw-edital-title">${esc(group.edital.nome || 'Sem edital')}</h4>
                                    <div class="pw-edital-count">${selectedCount}/${group.disciplinas.length} disciplinas selecionadas</div>
                                </div>
                            </div>
                            <div class="cluster-sm">
                                <button type="button" class="btn btn-ghost btn-sm" data-action="pw-select-edital-disc" data-edital-id="${esc(group.id)}">Todas deste edital</button>
                                <button type="button" class="btn btn-ghost btn-sm" data-action="pw-clear-edital-disc" data-edital-id="${esc(group.id)}">Limpar edital</button>
                            </div>
                        </div>
                        <div class="pw-disc-grid">
                            ${group.disciplinas.map((d) => renderPlanejamentoDiscCard(d, draft)).join('')}
                        </div>
                    </section>`;
}

// ─── Step HTML generators ───────────────────────────────────────────

export function htmlStep1(draft) {
  return `
        <div class="pw-center-container">
            <h3 class="mb-2 text-20px">Qual é a sua estratégia de estudo?</h3>
            <p class="text-secondary text-lg mb-6">
                Escolha o modelo que melhor se adapta à sua rotina atual.
            </p>

            <div class="stack-md">
                <div data-action="pw-select-tipo" data-tipo="ciclo" class="selection-card ${draft.tipo === 'ciclo' ? 'is-selected' : ''}">
                    <div class="cluster-lg mb-2">
                        <div class="text-3xl">\uD83D\uDD04</div>
                        <div>
                            <div class="text-xl font-semibold text-primary">Ciclo de Estudos (Recomendado)</div>
                            <div class="text-md text-muted mt-1">As disciplinas se revezam em uma sequência contínua. Ideal para rotinas flexíveis, pois você nunca perde matéria se não puder estudar um dia.</div>
                        </div>
                    </div>
                </div>

                <div data-action="pw-select-tipo" data-tipo="semanal" class="selection-card ${draft.tipo === 'semanal' ? 'is-selected' : ''}">
                    <div class="cluster-lg mb-2">
                        <div class="text-3xl">\uD83D\uDCC5</div>
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

export function htmlStep2(draft) {
  const all = getActiveDisciplinas() || [];
  const groups = groupDisciplinasByEdital(all);

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

            <div class="pw-edital-groups">
                ${groups.map((g) => renderPlanejamentoEditalGroup(g, draft)).join('')}
            </div>
        </div>
    `;
}

export function htmlStep3(draft) {
  const selected = (getActiveDisciplinas() || []).filter((d) =>
    draft.disciplinas.includes(d.disc.id)
  );

  return `
        <div class="pw-main-layout">
            <div class="pw-main-left">
                <h3 class="text-18px mb-1">Relevância e Domínio</h3>
                <p class="text-secondary text-md mb-6">Defina a importância da matéria para sua prova e o seu nível de conhecimento atual. O sistema priorizará matérias muito importantes que você ainda não domina.</p>

                <div class="pw-slider-group">
                    ${selected
                      .map((d) => {
                        const rel = draft.relevancia[d.disc.id] || {
                          importancia: 3,
                          conhecimento: 3,
                        };
                        return `
                        <div class="pw-slider-card">
                            <div class="font-semibold text-lg mb-3 text-primary">${d.disc.icone || '\uD83D\uDCDA'} ${esc(d.disc.nome)}</div>

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
                      })
                      .join('')}
                </div>
            </div>

            <div class="pw-main-right">
                <h4 class="pw-preview-heading">Distribuição de Tempo Estimada</h4>
                <div id="pw-weight-preview" class="stack-sm">
                </div>
                <div class="text-sm text-muted mt-4 text-center">Atualizado em tempo real baseado no Peso = Importância x (6 - Conhecimento)</div>
            </div>
        </div>
    `;
}

export function htmlStep4(draft) {
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
                    ${days
                      .map(
                        (d, i) => `
                        <button data-action="pw-toggle-day" data-day-index="${i}" class="btn pw-day-toggle ${draft.horarios.diasAtivos.includes(i) ? 'is-selected' : ''}">${d}</button>
                    `
                      )
                      .join('')}
                </div>
            </div>
        `;
  } else {
    html += `
            <div class="pw-config-card">
                <h4 class="pw-config-heading">Agenda Semanal</h4>
                <div class="pw-week-grid">
                    ${days
                      .map((d, i) => {
                        const ativo = draft.horarios.diasAtivos.includes(i);
                        return `
                        <div class="pw-week-row">
                            <label class="cluster-sm cursor-pointer pw-week-day-label">
                                <input type="checkbox" ${ativo ? 'checked' : ''} data-action="pw-toggle-day" data-day-index="${i}">
                                <span class="font-semibold pw-week-day-name ${ativo ? 'is-active' : ''}">${d}</span>
                            </label>
                            <input type="time" class="form-control flex-1 ${ativo ? '' : 'pw-time-input is-inactive'}"
                                value="${draft.horarios.horasPorDia[i] || ''}" data-action="pw-update-day-hour" data-day-index="${i}">
                        </div>
                    `;
                      })
                      .join('')}
                </div>
            </div>
        `;
  }

  return html;
}

// ─── Weight preview (live update) ───────────────────────────────────

export function pwRenderWeightPreview(draft) {
  const el = document.getElementById('pw-weight-preview');
  if (!el) return;

  let totalPeso = 0;
  const computed = [];
  const selected = (getActiveDisciplinas() || []).filter((d) =>
    draft.disciplinas.includes(d.disc.id)
  );

  selected.forEach((d) => {
    const r = draft.relevancia[d.disc.id] || { importancia: 3, conhecimento: 3 };
    const peso = r.importancia * (6 - r.conhecimento);
    totalPeso += peso;
    computed.push({ name: d.disc.nome, color: d.edital?.cor || 'var(--accent)', peso });
  });

  computed.sort((a, b) => b.peso - a.peso);

  el.innerHTML = computed
    .map((c) => {
      const pct = totalPeso > 0 ? ((c.peso / totalPeso) * 100).toFixed(1) : 0;
      return `
            <div>
                <div class="pw-bar-label-row">
                    <span class="pw-bar-name">${esc(c.name)}</span>
                    <span class="pw-bar-pct">${pct}%</span>
                </div>
                <div class="pw-bar-track">
                    <div class="pw-bar-fill" style="width:${pct}%; background:${c.color};"></div>
                </div>
            </div>
        `;
    })
    .join('');
}
