# Handoff: Slots reais no planejamento do Ciclo

Data: 2026-07-02

## Contexto

O objetivo foi mudar o planejamento do Ciclo de Estudos de uma agenda puramente regenerada para um modelo de slots reais. Uma sessao apagada deve virar perda daquele slot, nao uma etapa inteira pulada; uma sessao livre ou disciplina diferente deve poder substituir explicitamente um slot do dia; `materiasPorDia` deve pertencer ao planejamento.

## Implementado

- `src/js/logic/cycle.js`
  - adiciona `planejamento.materiasPorDia` e `planejamento.slotOverrides`;
  - registra exclusao de evento automatico pendente como `slotOverrides[].status = 'perdido'`;
  - faz previsao e geracao automatica pularem slots `perdido` e `substituido`;
  - exporta helpers de slot e materias por dia.
- `src/js/registro-sessao/session-save.js`
  - pergunta qual slot substituir quando uma sessao livre ou disciplina alterada pode consumir uma vaga planejada;
  - registra `substituido` e remove o evento automatico substituido;
  - corrigido durante revisao: usa snapshot do slot original para nao perder a disciplina planejada quando o proprio evento tem `discId` alterado.
- `src/js/views/calendar*`
  - mostra slots perdidos/substituidos no calendario e painel do dia como marcadores nao editaveis.
- `src/js/planejamento-wizard.js` e `src/js/planejamento/step-renderers.js`
  - adicionam `materiasPorDia` ao wizard.
- `src/js/store*`
  - schema sobe para 12;
  - estado padrao e reset incluem `materiasPorDia` e `slotOverrides`;
  - migracao v12 inicializa campos e converte `skippedSlots` legados confiaveis para `slotOverrides` perdidos.
- Testes tocados:
  - `tests/unit/logic.test.js`;
  - `tests/unit/store-migrations.test.js`;
  - `tests/unit/store.test.js`;
  - `tests/e2e/calendar.spec.js`;
  - `tests/e2e/sync-devices.spec.js`.

## Revisao feita

- Sintaxe validada com `node --check` nos arquivos JS e testes alterados.
- Encontrei e corrigi:
  - campo `lost` duplicado em `tests/e2e/sync-devices.spec.js`;
  - bug de substituicao no mesmo evento planejado, onde `originalDiscId` podia virar a disciplina real estudada.
- Validacao final em 2026-07-03:
  - `npm.cmd test -- --maxWorkers=1`: 1941 testes passaram;
  - `npm.cmd run test:e2e:quick -- tests/e2e/calendar.spec.js tests/e2e/sync-devices.spec.js`:
    5 testes passaram;
  - `npm.cmd run lint`: 0 erros; 44 avisos preexistentes fora do escopo;
  - expectativas legadas foram alinhadas ao modelo de slot perdido sem compactacao;
  - o E2E de sync voltou a verificar `slotOverrides` no round-trip B -> A.

## O que ainda falta

- Validar manualmente no navegador:
  - apagar evento automatico pendente e confirmar que so aquele slot nao volta;
  - recarregar pagina e reabrir calendario/ciclo;
  - registrar sessao livre substituindo slot do dia;
  - editar disciplina em evento planejado e confirmar `originalDiscId` correto no `slotOverrides`;
  - sync entre dois dispositivos simulados sem ressuscitar `auto_seed_1`.
- Avaliar se `slotOverrides` visiveis no calendario devem respeitar filtro de edital ativo. Hoje eles aparecem pelo `originalDiscId`, mas o filtro nao foi endurecido.
- Atualizar/remover UI antiga de configuracao global `materiasPorDia` se a decisao for remover completamente a segunda fonte de verdade. O wizard ja grava por plano; config global segue como fallback legado.

## Comandos sugeridos

Depois de destravar `node_modules`/`esbuild`:

```powershell
npm test -- tests/unit/logic.test.js tests/unit/store-migrations.test.js tests/unit/store.test.js
npm run test:e2e:quick -- tests/e2e/calendar.spec.js
npm run test:e2e:quick -- tests/e2e/sync-devices.spec.js
```

## Suggested skills

- `diagnose`: se o `spawn EPERM` do esbuild continuar.
- `review`: para revisar o diff completo depois que a suite rodar.
- `handoff`: se outra sessao precisar continuar a validacao.
