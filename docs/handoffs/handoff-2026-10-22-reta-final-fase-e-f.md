# Handoff — Reta Final, Fases E e F

## Estado

- Branch: codex/reta-final-editor-fase-a
- Código: 258fa5c
- Correção de rolagem: 5cffee4
- Checkpoints/importação: 66e9adc · Capacidade: d3b744e
- Documentação: bae42e7
- Base: 69278ee (fim da Fase D)
- main: eb8cc6c (não alterada)
- Worktree: C:/Users/slvma/.codex/worktrees/reta-final-fase-d/estudo-organizado

## Concluído

- Task 14: detalhe integral com HTML inerte, botão nativo, drawer/sheet, Escape,
  foco preso e restaurado.
- Task 15: formulário individual sobre rascunho persistido, chips de assunto e
  aula removíveis por campo, troca de disciplina re-vincula o primeiro assunto,
  restrição de timer derivada dos eventos.
- Task 16: Modo Planejamento com filtros, seleção visível × todo o cronograma,
  drag e botão gerando o mesmo MOVE, lote atômico, duplicação sem sessões e
  redistribuição ligada ao motor.
- Task 17: prévia oficial × simulada, projeção de dias e não alocados, bloqueio
  de diff vazio e de data que ficou passada, aplicação local atômica.
- Correções da revisão independente: 10 achados Major tratados; os residuais
  estão listados abaixo.
- Falha de migração no boot agora grava um marcador e reconcilia o Ciclo uma
  única vez no próximo boot bem-sucedido.
- Teste explícito de aulaId duplicado adicionado (pendência da Fase C).

## Arquivos principais

- src/js/views/reta-final-detail.js
- src/js/views/reta-final-editor-form.js
- src/js/views/reta-final-planner.js
- src/js/views/reta-final-bulk-actions.js
- src/js/views/reta-final-apply-preview.js
- src/js/ui/actions/reta-final-editor.js
- src/js/ui/actions/reta-final-apply.js
- src/js/app/boot-reconciliation.js
- src/js/store/boot-recovery.js
- src/css/views/reta-final-editor.css
- tests/e2e/reta-final-editor.spec.js

## Decisões

- Nenhum campo é publicado no estado oficial antes de a transação do rascunho
  completar; falha de quota mantém o draft anterior.
- A prévia usa o plano atual quando a linhagem é a mesma, evitando ready seguido
  de BASE_STALE após rolagem derivada.
- Rascunho aplicado é recriado; rascunho obsoleto mostra "Recomeçar rascunho".
- "Sincronizado" nunca aparece antes de ACK remoto.

## Testes

- npm test: 174 arquivos, 2858 testes, PASS.
- npm run test:design: 45 testes + contraste AA, PASS.
- npm run lint: 0 erros.
- E2E release: 162/162 PASS.
- E2E editor: 4/4 PASS (inclui mobile/touch).
- bump:check: PASS.
- format:check: falha preexistente em 193 arquivos.
- Regras Firestore no emulador: 38/38 PASS; sem deploy real.

## GitHub

- Nenhum push, PR, merge ou deploy nesta sessão.
- PRs #102 e #103 continuam abertos e documentais.

## Pendências

1. Revisão visual manual dos oito temas em desktop, tablet e mobile.
2. Publicar firestore.rules em ambiente controlado e provar a barreira remota.
3. UI de exceções/folgas (capacidade semanal e fixação já cobertas).
4. format:check do repositório (baseline de 193 arquivos).

## Retomada

    git -C 'C:/Users/slvma/.codex/worktrees/reta-final-fase-d/estudo-organizado' status --short --branch
    git -C 'C:/Users/slvma/.codex/worktrees/reta-final-fase-d/estudo-organizado' log -3 --oneline

Ler docs/qa/reta-final-editor-acceptance-2026-10-19.md e este arquivo antes de
continuar. Não iniciar merge na main sem autorização.
