# Task 4 — Catálogo acadêmico e resolução ambígua

Data: 2026-10-20
Branch: `codex/reta-final-editor-fase-a`
Base: `bccfcabd45fc8eb53bdc1524a87a9b6a643e906b`
Commit de implementação: `7a28ce1f421de225337faecaee8f8d2de127100c` — `feat(reta-final): resolve catalog references safely`

## Resultado

Implementada a função pura `resolveRetaFinalCatalog(catalog, { discId, assuntos, aulas, makeId })`, com retorno `{ refs, createIntents, conflicts }`. `refs` usa diretamente o formato de `topicos` da Task 3 (`{ assId, aulaId }`); intenções têm o formato `{ entity, id, discId, nome }`; conflitos incluem código, entidade, disciplina e, quando ambíguo, IDs candidatos.

A resolução exige um `discId` único. IDs explícitos são autoritativos; sem ID, nomes normalizados são pesquisados apenas dentro da disciplina selecionada. Um único nome casa, nenhum nome cria uma intenção de rascunho e homônimos geram conflito sem escolha automática. IDs gerados são verificados contra o catálogo e entre as intenções da chamada. Propostas repetidas são deduplicadas em ordem estável.

As intenções não alteram o catálogo. O validador PATCH/CREATE aceita uma referência nova somente quando recebe uma intenção única com o mesmo ID, entidade e `discId`, cujo ID ainda não existe no catálogo. Referências sem intenção correspondente continuam inválidas. O módulo novo importa apenas `normalizeNameKey` de `reta-final-core.js`; `reta-final.js` reexporta o resolver. Ativação e importação v1 não foram redesenhadas.

## RED e GREEN

No checkpoint retomado, `tests/unit/reta-final-catalog.test.js` e os arquivos de implementação estavam presentes como alterações locais; não os sobrescrevi. Para registrar um RED real de funcionalidade ausente, movi temporariamente o módulo para `reta-final-catalog.js.task4-red-hold`, executei o teste focado e restaurei o módulo em um bloco `finally`.

RED:

```powershell
npx vitest run tests/unit/reta-final-catalog.test.js
```

Resultado: exit 1; 1 suíte falhou antes da coleta, 0 testes coletados. O erro foi `Failed to resolve import "../../src/js/logic/reta-final-catalog.js"`, exatamente por ausência do resolver. O módulo foi restaurado imediatamente e o teste focado foi executado novamente.

GREEN focado:

```powershell
npx vitest run tests/unit/reta-final-catalog.test.js
```

Resultado: 1 arquivo aprovado, 10/10 testes aprovados.

Durante o primeiro `npm test`, a guarda antiga de importações rejeitou o novo reexport de `reta-final-catalog.js` em `reta-final.js` (1 falha, 2.492 aprovados, 2.493 testes). A allowlist e sua descrição foram atualizadas; foi adicionada uma guarda que exige que `reta-final-catalog.js` importe apenas o módulo puro `reta-final-core.js`.

RED da guarda antes da atualização da allowlist:

```powershell
npx vitest run tests/unit/logic-cycle-imports.test.js -t 'reta-final.js only imports store/utils/core/schema/schedule/session-topics'
```

Resultado: 1 teste falhou e 30 foram ignorados; a mensagem apontou `./reta-final-catalog.js` fora da allowlist.

GREEN da guarda/catálogo:

```powershell
npx vitest run tests/unit/logic-cycle-imports.test.js tests/unit/reta-final-catalog.test.js
```

Resultado: 2 arquivos e 41/41 testes aprovados.

## Validação final

Regressões focadas:

```powershell
npx vitest run tests/unit/reta-final-catalog.test.js tests/unit/reta-final-commands.test.js tests/unit/reta-final-schema-v2.test.js tests/unit/reta-final-schedule.test.js tests/unit/reta-final-activation.test.js tests/unit/reta-final-core.test.js tests/unit/logic-cycle-imports.test.js
```

Resultado: 7 arquivos aprovados, 215/215 testes aprovados.

Suíte completa, executada após a atualização da allowlist e a formatação final:

```powershell
npm test
```

Resultado: 150/150 arquivos e 2.494/2.494 testes aprovados. Avisos de stderr emitidos por casos simulados existentes não causaram falhas.

Verificações complementares:

- `npx prettier --check --single-quote --print-width 100 src/js/logic/reta-final-catalog.js tests/unit/reta-final-catalog.test.js` — aprovado.
- `npx eslint src/js/logic/reta-final-catalog.js src/js/logic/reta-final-commands.js src/js/logic/reta-final.js` — 0 erros; 1 aviso `no-unused-vars` em `reta-final-commands.js:683` (`ctx` não utilizado em função que já existia no commit-base).
- `git diff --cached --check` — aprovado antes do commit de implementação.

## Arquivos

- Criado `src/js/logic/reta-final-catalog.js` — resolução pura, escopo por ID e conflitos explícitos.
- Criado `tests/unit/reta-final-catalog.test.js` — cobertura de ID, isolamento entre editais, homônimos, intenções, idempotência, contexto fail-closed, imutabilidade e integração PATCH/CREATE.
- Alterado `src/js/logic/reta-final-commands.js` — valida IDs catalogados sem ambiguidade e intenções pendentes exatas, sem permitir referências desacompanhadas.
- Alterado `src/js/logic/reta-final.js` — reexport do resolver.
- Alterado `tests/unit/logic-cycle-imports.test.js` — allowlist e verificação de pureza do módulo de catálogo.
- Criado este relatório e `docs/handoffs/handoff-2026-10-20-reta-final-task-4.md`.

## Auto-revisão

- **Ambiguidade:** nomes são consultados somente na disciplina identificada; ID de disciplina duplicado, assunto/aula homônimo ou referência explícita não única falha fechado. Nenhum caminho seleciona o primeiro homônimo.
- **Determinismo:** duplicatas normalizadas da proposta e referências repetidas não geram entradas duplicadas; a ordem segue a proposta e IDs candidatos são ordenados.
- **Imutabilidade:** catálogo e entrada não são escritos; catálogo/proposta congelados passam no teste. Intenções são apenas valores retornados e nunca são materializadas durante render.
- **Compatibilidade:** a ativação e o importador v1 ficaram intactos; testes existentes de ativação/importação, schema, agenda e comandos passam.
- **Limite:** a materialização persistente de intenções permanece fora deste resolver; o contrato de comando apenas aceita referências quando o draft fornece a intenção correspondente.

## Git e continuidade

Commit de código/testes: `7a28ce1f421de225337faecaee8f8d2de127100c` (`feat(reta-final): resolve catalog references safely`). O hook teria atualizado arquivos compartilhados de cache fora do escopo, então o commit foi executado com `SKIP_CACHE_BUMP=1`. O pedido foi não fazer push; nada foi enviado ao GitHub. O relatório e o handoff serão registrados em um commit documental separado para que este relatório possa conter o SHA real da implementação.

Próximo passo: nenhum para Task 4. A branch permanece local; não fazer push sem nova instrução. O próximo implementador pode seguir para a próxima task do plano mantendo `createIntents` como rascunho até o fluxo de commit autorizado materializá-las.

## Fix round 1 — colisão de ID após resolução por nome

Data: 2026-10-20
Commit de correção: `f9fb2a45e61ba4297b5b1e68525a207c20609edd` — `fix(reta-final): reject colliding catalog references`

### Correção

A resolução por nome passava a devolver um ID encontrado na disciplina selecionada sem verificar se o mesmo ID existia também em outra disciplina. O `applyRetaFinalCommand` já rejeitava essa referência depois, mas o resolver violava o contrato fail-closed. `resolveByName` agora recebe o catálogo, localiza todas as ocorrências do ID na entidade e só devolve a referência quando existe exatamente uma ocorrência, na disciplina selecionada. Colisão produz `REFERENCIA_AMBIGUA` com `candidateIds`; ID malformado produz `REFERENCIA_INVALIDA`. Em ambos os casos não há `ref` nem `createIntent`.

### RED e GREEN

Os testes foram adicionados antes da alteração de produção. O RED focado foi:

```powershell
npx vitest run tests/unit/reta-final-catalog.test.js
```

Resultado: 1 falha e 14 aprovados. O caso novo devolveu `refs: [{ assId: 'ass_colide', aulaId: null }]` quando esperava `[]`, provando que o nome único era aceito apesar do ID duplicado em outra disciplina. Os quatro casos de intenção (entidade errada, `discId` errado, intenções duplicadas e ID já catalogado) já eram rejeitados pelo validador e ficaram como regressões de contrato, todos com `REFERENCIA_INVALIDA`.

O GREEN focado foi o mesmo comando: 1 arquivo, 15/15 testes aprovados.

### Validação

```powershell
npx vitest run tests/unit/reta-final-catalog.test.js tests/unit/reta-final-commands.test.js tests/unit/logic-cycle-imports.test.js
```

Resultado: 3 arquivos, 114/114 testes aprovados.

```powershell
npm test
```

Resultado: 150/150 arquivos e 2.499/2.499 testes aprovados.

- Prettier nos dois arquivos alterados: aprovado.
- ESLint no resolver: 0 erros e 0 avisos.
- `git diff --cached --check`: aprovado antes do commit.

### Arquivos

- `src/js/logic/reta-final-catalog.js` — verificação global de unicidade do ID após match por nome.
- `tests/unit/reta-final-catalog.test.js` — RED de colisão transversal e quatro regressões de intenções pendentes.

### Auto-revisão

- **Fail-closed:** uma única ocorrência global e pertencente à disciplina selecionada é condição necessária para devolver a referência.
- **API:** assinatura pública, formato de retorno e `makeId` não mudaram.
- **Pureza e imutabilidade:** o resolver continua sem estado, store, DOM, rede ou timers; os novos testes apenas congelam os dados de entrada e verificam o retorno.
- **Legado:** nenhuma alteração no importador/ativação v1 ou no schema; a suíte completa passou.
- **Validador:** entidade, disciplina, unicidade de intenção e ausência do ID no catálogo continuam exigidos antes de aceitar uma referência pendente.
