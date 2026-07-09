# Handoff — Correção dos 7 achados da revisão do PR #96 (2026-07-09)

## O que foi feito

Após o merge do PR #96 (padronização da UI da Reta Final), uma revisão de código
reportou 7 achados — nenhum bug funcional, todos de limpeza/robustez. Esta sessão
corrigiu todos. **Mudança visual: apenas os 4px do item 6**; todo o resto é
refatoração neutra de CSS/testes/doc.

1. **Asserção vazia** (`tests/unit/css-architecture.test.js`): o assert de
   `.rf-day-group` casava com bloco CSS inexistente (string vazia). Agora
   `expect(retaFinal).not.toMatch(/\.rf-day-group\s*\{/)` garante que a regra
   não volta.
2. **Override por id** (`reta-final.css` + `reta-final-view.js`): `#rf-dias-lista
   { padding-top: 0 }` virou classe modificadora — o div ganhou a classe
   `rf-dias-lista` (id mantido para JS/testes) e o seletor
   `.ciclo-sequence-card .scroll-area-md.rf-dias-lista` (0,3,0) vence o bloco
   compartilhado de `styles.css` sem depender do id nem da ordem de carga.
3. **Seletor redundante**: `.rf-foco-title .fa` removido — o ícone já recebe
   accent pela regra compartilhada de ícone de título.
4. **`.first()` posicional no e2e** (`tests/e2e/reta-final.spec.js:192,254`):
   trocado por escopo de contêiner (`.rf-foco-card [data-action=...]`), que
   declara a seção sob teste e sobrevive a reordenação do DOM.
5. **Receita de título duplicada**: extraída para grupos compartilhados em
   `ciclo.css` — `.ciclo-sequence-title, .ciclo-predict-title, .rf-section-title`
   (12px/700/ls 0.5/uppercase/text-primary), `.ciclo-predict-title-icon,
   .rf-section-title .fa` (accent) e `.ciclo-sequence-header, .rf-section-header`
   (layout flex). Os blocos individuais mantêm só o que difere (espaçamentos;
   `.rf-foco-title` só a cor accent, que vence por vir em arquivo posterior).
   O bloco `.rf-section-title` de `reta-final.css` foi removido. Uppercase é
   no-op para `.ciclo-predict-title` (textos já maiúsculos no markup — conferido).
6. **Alinhamento dos filtros**: `.rf-filtros` agora `padding: 0 12px 0 16px` —
   borda direita alinhada à dos cards do cronograma (calha de 12px do scrollbar).
7. **DESIGN.md** (decisão do usuário: atualizar o doc, não o app): adicionada a
   entrada **Section Title** (700, 12px, ls 0.5px, MAIÚSCULAS) à hierarquia
   tipográfica; **Label** (600, 11.5px) fica restrita a rótulos de stat-card/KPI.

O teste de arquitetura "keeps the reta final sections on one shared anatomy" foi
atualizado ANTES das mudanças (TDD red→green) e agora também pina: ausência de
`#rf-dias-lista` como seletor de estilo, presença da classe modificadora, o grupo
compartilhado de título em `ciclo.css` e a ausência do bloco `.rf-section-title`
duplicado em `reta-final.css`.

## Estado atual

- Branch `claude/study-cycle-ui-standardize-akl839` recriada a partir da main
  pós-merge do #96 (o PR mergeado não foi reutilizado) — novo PR aberto.
- Unit: **134 arquivos / 2149 testes passando**.
- E2E `reta-final.spec.js`: 6/6. E2E `ciclo-grade.spec.js`: 18/19 — a falha
  ("espacados sem overflow", diferença de altura 8px>6px) é **pré-existente**
  e sensível ao ambiente (reproduzida na main sem estas mudanças).
- Verificação visual (Playwright + fixture reta_final): render idêntico ao
  pré-correção; view do Ciclo comum coberta pelos e2e de estilo computado.

## O que falta / próximos passos

- Nada pendente deste escopo.
- Opcional (já registrado antes): investigar a falha pré-existente do e2e
  `ciclo-grade`; avaliar aplicar a mesma limpeza de espaçamento duplicado
  (padding+margin do `.ciclo-sequence-header`) na view do Ciclo comum.
