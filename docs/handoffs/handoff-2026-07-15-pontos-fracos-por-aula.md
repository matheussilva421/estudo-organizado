# Handoff — Pontos Fracos por aula

## Objetivo

Substituir o eixo de tópicos do edital por aulas na aba **Pontos Fracos**, preservando filtros, ranking, média bayesiana, série semanal e ação rápida de estudo.

## Estado final

- Implementação concluída e validada.
- `computeWeakPoints` constrói buckets somente de `disc.aulas`.
- Questões são resolvidas primeiro por `aulaId` direto.
- Na ausência de `aulaId` válido, `assId` resolve uma aula somente quando `linkedAulaIds` possui exatamente um vínculo.
- Tópicos sem vínculo ou com múltiplos vínculos contam apenas no total da disciplina e em `naoAtribuidas`/`orfaos`.
- A view exibe aulas, usa `aula.estudada` para o selo e mantém filtros, expansão, top 3, taxa ajustada e sparkline.
- `Estudar / Agendar` usa o contrato legado `data-assunto-id="aul_<aulaId>"` e agora pré-seleciona a aula no modal, inclusive se já estudada.

## Arquivos alterados

- `src/js/logic/weak-points.js`
- `src/js/views/pontos-fracos-view.js`
- `src/js/views.js`
- `tests/unit/weak-points-core.test.js`
- `tests/unit/weak-points-memo.test.js`
- `tests/unit/views-modules.test.js`
- `tests/unit/pontos-fracos-modal-prereqs.test.js`
- `tests/e2e/pontos-fracos.spec.js`

## TDD executado

1. RED/GREEN: resolução direta por `aulaId`.
2. RED/GREEN: fallback por `assId` com vínculo único.
3. RED/GREEN: zero ou múltiplos vínculos ficam apenas no agregado da disciplina.
4. RED/GREEN: view emite ação rápida para aula.
5. RED/GREEN: modal pré-seleciona aula estudada pela convenção `aul_<id>`.

## Validação

- Relacionados: `140/140` testes verdes.
- Suíte completa: `139` arquivos, `2231/2231` testes verdes.
- Lint: `0` erros; `44` warnings preexistentes fora do escopo.
- E2E específico em Chromium headed: `2/2` testes verdes em `4.2s`.
- O Playwright travou no teardown quando iniciou seus próprios `webServer` via `npx` no Windows. Com os servidores locais iniciados explicitamente e reutilizados, o E2E encerrou normalmente; ambos os processos temporários foram encerrados depois.

## Estado do Git

- A alteração preexistente em `.ai/history/2026-07/2026-07-15/checkpoints.md` não pertence a esta implementação e deve permanecer fora do commit.
- Implementação publicada em `origin/main` no commit `9b449f8` (`feat(pontos-fracos): agrupa desempenho por aulas`).
- Nenhuma ação funcional pendente; a próxima sessão deve apenas reconciliar o Git remoto e preservar o checkpoint `.ai` local.
