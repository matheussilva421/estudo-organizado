# Pontos Fracos por aula — design aprovado

**Data:** 2026-07-15 · **Status:** aprovado pelo usuário (brainstorming na sessão)

## Objetivo

A aba Pontos Fracos passa a ranquear **aulas** em vez de tópicos (assuntos) do
edital. Decisões do usuário:

1. **Substituição total** — tópicos do edital somem da aba (sem toggle).
2. **Fallback conservador** — questão registrada só com tópico (sem `aulaId`)
   conta na aula **apenas quando o tópico tem exatamente 1 aula vinculada**
   (`ass.linkedAulaIds`); senão conta só no total da matéria (nota de rodapé
   existente).

## Arquitetura (opção A aprovada)

Trocar o universo no núcleo puro `computeWeakPoints`
(`src/js/logic/weak-points.js`), preservando o formato dos buckets — a view,
memoização, filtros (edital/disciplina/arquivados), média bayesiana e série
semanal continuam funcionando sem mudança estrutural.

### Núcleo — `src/js/logic/weak-points.js`

- Universo: buckets por **aula** (`disc.aulas`), não mais por assunto.
  - Campo de identidade: `aulaId` (no lugar de `assId`).
  - Badge ✅: `aula.estudada` (no lugar de `assunto.concluido`).
- Resolução de cada questão (`registra`):
  1. `aulaId` do item/evento → bucket direto;
  2. senão `assId`: se o assunto correspondente tem **exatamente 1** aula em
     `linkedAulaIds` e ela existe no universo → bucket dessa aula;
  3. senão → conta só no total da disciplina (`naoAtribuidas`); se havia
     referência a assunto/aula morto, acumula em `orfaos` (mecânica existente).
- `semQuestoes`: aulas do universo com `total === 0`.
- Ranking/ordenção/taxa ajustada/série semanal: inalterados (operam nos buckets).

### View — `src/js/views/pontos-fracos-view.js`

- Linhas dos cards (compacto top 3 + expandido) mostram aulas.
- "Estudar / Agendar": convenção já suportada pelo modal —
  `data-assunto-id="aul_<aulaId>"` (mesmo padrão de dashboard-view/editais-crud).
- Seção "Sem questões registradas (N)" lista aulas.
- Textos: "assunto(s)" → "aula(s)"; título/subtítulo da aba mencionam aulas.

### Fora de escopo

- `suggestConhecimento` e usos do ranking fora da aba (se houver) não mudam.
- Sem toggle aulas/tópicos (YAGNI — a estrutura aceita um `groupBy` futuro).

## Testes (TDD)

- Reescrever/adaptar `tests/unit/weak-points-core.test.js`: builders com aulas;
  casos novos — resolução por `aulaId`; fallback por vínculo único; assunto com
  0 ou 2+ aulas vinculadas cai no total da matéria; ✅ por `aula.estudada`;
  `semQuestoes` com aulas; arquivados/filtros preservados.
- `tests/unit/views-modules.test.js` (describe pontos-fracos) e memo: adaptar
  seeds para aulas; asserir `data-assunto-id="aul_..."` no botão.
- Validação manual no mock server (grade, expansão, botão Estudar/Agendar
  pré-selecionando a aula no modal).

## Risco aceito

Disciplinas com questões registradas só por tópico cujos tópicos têm várias
aulas vinculadas exibirão menos linhas ranqueadas (questões caem no total da
matéria) — custo da escolha conservadora "mapear só quando único".
