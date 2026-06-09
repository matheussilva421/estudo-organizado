# Handoff — Auditoria de abas + correções (2026-06-09)

## Contexto

Auditoria prática de todas as abas do app (Página Inicial, Study Organizer, Cronômetro, Calendário, Ciclo de Estudos, Dashboard, Revisões, Histórico, Hábitos, Editais, Ed. Verticalizado, Intelig. de Banca) com foco em bugs reais, fluxos quebrados, acessibilidade, mobile e performance. **Restrição absoluta respeitada: nenhum arquivo, fluxo, contrato ou teste de sync foi tocado** (`src/js/sync/`, `cloud-sync.js`, `drive-sync.js`, `credentials.js`).

Metodologia: 4 varreduras paralelas por grupo de abas → verificação manual de cada achado no código (vários achados dos agentes foram descartados como falsos) → correções TDD (red → green) → suíte completa.

## Bugs reais corrigidos (todos com TDD)

1. **Intelig. de Banca — filtros completamente quebrados** (`src/js/ui/actions/editais.js`)
   - `filtrar-view-por-disciplina`, `mudar-edital-analisador` e `carregar-analise-banca` eram registrados passando a função direto, mas o dispatcher chama `handler(element, event)` — as funções recebiam o **elemento** em vez de `el.value`/`el.dataset.discId`. Trocar o edital no select, filtrar por disciplina e clicar numa análise salva falhavam silenciosamente.
   - Fix: wrappers `(el) => fn(el.value)` / `(el) => fn(el.dataset.discId)`. Havia inclusive um teste consolidando o comportamento errado (`expect(handler).toBe(...)`) — atualizado.
   - Testes: `tests/unit/editais-actions.test.js` (+3 testes).

2. **Hábitos — crash ao salvar questões com disciplina removida** (`src/js/views/habitos-view.js:479`)
   - `getDisc(discId)` pode retornar `null` → `d.disc.nome` lançava TypeError e o registro não era salvo, sem feedback.
   - Fix: guard `if (d)` — salva sem `gabaritoPorDisc` quando a disciplina não existe mais.
   - Testes: novo `tests/unit/habitos-view-save.test.js` (2 testes: null e caminho feliz).

3. **Hábitos — handler morto `edit-habit`** (`src/js/ui/actions/habitos.js`)
   - Importava dinamicamente `editHabit`, que nunca existiu em `habitos-view.js` (lançaria TypeError se acionado). Nenhum markup usa `data-action="edit-habit"`. Removido; teste atualizado para garantir que NÃO é registrado.

4. **Ciclo — minutos por passo aceitava 0/negativo** (`src/js/views.js:updateSeqItem` + `ciclo-view.js:281`)
   - `parseInt(val) || 0` permitia alvo 0/negativo na edição da sequência. Clampado para ≥1 e `min="1"` no input. (Downstream em `logic/cycle.js` já era guardado com `Math.max(0,…)`, então o impacto era passo inútil, não crash.)
   - Testes: `tests/unit/views-crud-more.test.js` (+3 testes `updateSeqItem`).

5. **Editais — `deleteAula` quebrava com disciplina sem array `assuntos`** (`src/js/views/editais/aula-operations.js:99,105`)
   - Dados antigos/incompletos sem `assuntos` → TypeError ao excluir aula. Fix: `(d.disc.assuntos || [])` e `(d.disc.aulas || [])`.
   - Testes: novo `tests/unit/aula-operations-delete.test.js` (2 testes).

## Acessibilidade

6. **Ativação por teclado de cards clicáveis** (`src/js/ui/actions/dispatcher.js`)
   - Divs com `role="button"` + `tabindex="0"` (cards da Home) eram focáveis mas Enter/Space não fazia nada — o dispatcher só tratava click/change/input. Adicionada delegação `keydown` (Enter/Space) para `[data-action][role="button"]` não-nativos, sem duplicar ativação de botões nativos.
   - Testes: `tests/unit/actions-dispatcher.test.js` (+5 testes).
7. **Hábitos — cards inacessíveis por teclado** (`habitos-view.js`): `role="button" tabindex="0" aria-label="Registrar <hábito>"` nos `.habit-card`.
8. **Foco visível** (`src/css/base/accessibility.css`): regra `[role='button'][data-action]:focus-visible` com outline.
9. **Revisões — `aria-selected` não atualizava ao trocar de aba** (`revisao-view.js:switchRevTab`); também escopado o seletor para `.rev-tabs .tab-btn` (antes limpava `.tab-btn` global). Teste novo: `tests/unit/revisao-view-tabs.test.js`.
10. **Editais — botões icon-only sem `aria-label`** (`editais-view.js:371-377`): chevrons de mover, 📝, 🧠, ✏️, 🗑️ ganharam `aria-label`; ícones decorativos com `aria-hidden="true"`.
11. **Home — cards clicáveis com `aria-label`** (`home-view.js`).

## Achados de agentes DESCARTADOS após verificação (não corrigir de novo)

- `utils.js:69 formatDate` "timezone bug": **falso** — `new Date('YYYY-MM-DDT00:00:00')` sem sufixo Z é parseado como hora LOCAL por spec; o padrão está correto. Mesmo para o countdown em `home-view.js:176`.
- `planejamento-wizard.js` "listeners perdidos após renderStep": **falso** — os botões ficam fora de `#modal-planejamento-body`; `renderStep` não os recria.
- `ciclo-view.js:308` "null deref em `d.disc.icone`": **falso** — guard na linha 248 (`!getIsEditingSequence() && !d`) cobre o branch estático.
- `habitos.css` "grid sem media query": **falso** — overrides em `styles.css:647` (2 col) e `:886` (1 col).
- `delete-operations.js` "`delete e.assId` corrompe JSON": **não é bug** — propriedade ausente é equivalente a undefined nos consumidores.
- `revisao-view.js:23-28` cálculo de data: usa o padrão local correto (`getTime() - offset`).

## Observações registradas (não corrigidas — fora de escopo ou risco/benefício ruim)

- **Timer continua em background ao navegar entre abas** (`logic/timer.js`): aparenta ser intencional (sessão continua contando). Não tocado por ser adjacente ao fluxo crítico de sessões.
- `editais-crud.js:toggleEdital` re-renderiza a view inteira no expand/collapse — perf aceitável hoje; otimização cirúrgica fica como melhoria futura.
- Tabela do Ed. Verticalizado tem `overflow-x:auto` sem hint visual de scroll no mobile.
- `calcSimuladoPerc` silencioso quando total=0 (UX menor).
- Histórico mantém filtros persistidos sem indicador visual de "filtro ativo".

## Testes

- `npm test`: **96 arquivos, 1630 testes, 0 falhas** (inclui os 15 testes novos).
- `npm run test:css`: 31/31.
- eslint nos arquivos alterados: 0 erros (2 warnings pré-existentes de imports não usados em arquivo não relacionado à mudança).
- E2E não rodado: mudanças são correções pontuais cobertas por unit tests; nenhuma mudança de PWA/offline/sync. Validação manual de navegação recomendada no PR.

## Arquivos alterados

Fonte: `ui/actions/{dispatcher,editais,habitos}.js`, `views.js`, `views/{habitos-view,revisao-view,editais-view,ciclo-view,home-view}.js`, `views/editais/aula-operations.js`, `css/base/accessibility.css`.
Testes: `actions-dispatcher`, `editais-actions`, `habitos-actions`, `views-crud-more` (atualizados); `habitos-view-save`, `revisao-view-tabs`, `aula-operations-delete` (novos).

## GitHub

Branch `claude/auditoria-abas-fixes` com commit convencional + push (ver status final da sessão).

## Próximos passos sugeridos

1. Validação manual no navegador: aba Intelig. de Banca (trocar edital no select, filtrar disciplina, abrir análise salva — fluxos que estavam quebrados); Tab+Enter nos cards da Home e Hábitos.
2. Avaliar as observações não corrigidas acima (perf do toggleEdital, hint de scroll no verticalizado).
3. Se desejar, subir cobertura E2E para o fluxo do Analisador de Banca (não existia teste que pegasse o wiring quebrado).
