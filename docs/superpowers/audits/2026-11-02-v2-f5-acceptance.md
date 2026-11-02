# Estudo Organizado V2 — F5: implementação, revisões e publicação na v2

**Status:** `F5_IMPLEMENTED_REVIEWED_PUBLISHED_V2_MAIN_BLOCKED_EXACT`
**Data:** 2026-11-02
**Branch/worktree:** `v2` em `C:\Users\slvma\.codex\worktrees\v2-f4\estudo-organizado`
**Base oficial:** `origin/v2` = `bf32821` (spec/plano aprovados)
**HEAD de código:** `59fdb33` (antes do commit documental final)
**Publicação efetiva:** `origin/v2` = `db7fcf3`; read-back local/remoto 0/0 em 2026-11-02.
**main:** `9046cfa`, V1 preservada, sem alteração

## Fontes normativas

- [Especificação F5](../specs/2026-11-01-estudo-organizado-v2-f5-reviews-design.md), SHA-256 `0f45de81a0161a54651205ee6b9d1b27989ec4c2cf8151ff682c7e558180dee3`.
- [Writing-plans F5](../plans/2026-11-01-estudo-organizado-v2-f5-reviews.md), SHA-256 `f24c6caf949bacbb18beba9a02de607e483e080e0cd5ebc6101fc5dceef85c72`.

## Entrega

Foram implementadas as três capacidades F5 em um único workspace local-first:

- vínculos explícitos de assunto de revisão por IDs da F2, sem associação por nome;
- sugestões puras, compromissos versionados, execução parcial, retenção, reagendamento, cancelamento e recuperação;
- política determinística versionada; estimativa de duração por histórico atribuível com fallback explícito;
- pontos fracos a partir de `StudySession`, `SessionAllocation` e `StudyMeasurement`, sem criar tempo ou questões;
- fontes de banca versionadas, matching assistido, prioridade contextual e reversão conservadora;
- importação/exportação seletiva, CSV sanitizado, central local de lembretes e UI acessível em oito temas;
- persistência aditiva em IndexedDB, operação/replay/CAS, outbox única com `deliveryMode: BLOCKED` para F5;
- consultas de agenda, projeções e explicações sem escrita escondida em render.

## T01–T20

| Tarefa | Estado | Evidência principal |
| --- | --- | --- |
| T01 contratos/fixtures | PASS | `f5-review-domain`, `f5-review-service` |
| T02 identidade de assunto | PASS | vínculo canônico explícito; `F5-T10` |
| T03 persistência/migração/outbox | PASS | `f5-schema` v4→v5 e outbox bloqueada |
| T04 sugestões e opt-in | PASS | `F5-T01/T02`; consulta pura |
| T05 execução/cobertura | PASS | `F5-T04–T09`; replay e CAS |
| T06 motor temporal | PASS | `F5-T11–T16/T25/T45` |
| T07 atraso e duração | PASS com limitação | duração histórica; backlog vencido na agenda |
| T08 integração F3 | PASS | `F5-T18/T19`; capacidade global e read-back |
| T09 evidências F4 | PASS | `F5-T21/T22/T26` |
| T10 tendências/suficiência | PASS | `F5-T23/T24` |
| T11 importação de banca | PASS | `F5-T27/T28/T37/T39` |
| T12 matching | PASS | `F5-T29/T30` |
| T13 prioridade/reversão | PASS com limitação | prioridade explicável; reversão conflita se houver decisão nova |
| T14 invalidação/projeções | PASS | `F5-T03/T40/T41`; fingerprints |
| T15 portabilidade | PASS com limitação | JSON/CSV, prévia, perfil, idempotência e falha parcial explícita |
| T16 lembretes progressivos | PASS com limitação | central local; sem promessa de push com app fechado |
| T17 UI de revisões | PASS | `f5-review-journey` |
| T18 UI de pontos fracos/banca | PASS | `f5-review-journey`, `f5-accessibility` |
| T19 concorrência/falhas | PASS com limitação | abort, CAS, duplicidade; sem benchmark de hardware |
| T20 regressões/revisões | PASS | suítes completas e duas passagens estruturadas |

## Matriz F5-T01–F5-T48

| ID | Estado | Teste/evidência |
| --- | --- | --- |
| T01 | PASS | `f5-review-domain` sugestão determinística/pureza |
| T02 | PASS | `f5-review-service` opt-in e revogação |
| T03 | PASS | `f5-review-domain` fingerprint; F4 schema |
| T04 | PASS | `f5-review-domain` execução avulsa |
| T05 | PASS | `f5-review-service` replay |
| T06 | PASS | `f5-review-service` payload divergente |
| T07 | PASS | `f5-review-domain` conclusão concorrente |
| T08 | PASS | cobertura parcial sem sobreposição |
| T09 | PASS | UNKNOWN não conclui |
| T10 | PASS | vínculo explícito/homônimos |
| T11 | PASS | multiplicador FORGOT |
| T12 | PASS | política versionada GOOD/PARTIAL |
| T13 | PASS | execução tardia ancora CivilDate |
| T14 | PASS | UNRATED fallback conservador |
| T15 | PASS | retenção e acurácia separadas |
| T16 | INCONCLUSIVE | override por assunto não tem UI completa |
| T17 | PASS | duração histórica/fallback |
| T18 | PASS | capacidade global e UNALLOCATED |
| T19 | PASS | enchaixe F3, CAS, read-back |
| T20 | PASS com limitação | F2 arquivado não é autoassociado; UI só oferece editais ativos |
| T21 | PASS | agregação F4 única |
| T22 | PASS | sem assunto/ID individual não classifica |
| T23 | PASS | amostra pequena INSUFFICIENT_DATA |
| T24 | PASS | janelas comparáveis/INCONCLUSIVE |
| T25 | PASS | parâmetros versionados sem mutar fatos |
| T26 | PASS | conflito F4 preservado |
| T27 | PASS | fonte qualitativa sem percentual |
| T28 | PASS | fonte quantitativa com amostra |
| T29 | PASS | matching propõe, não grava |
| T30 | PASS | homônimos/contexto de edital |
| T31 | PASS | fontes sobrepostas limitadas |
| T32 | PASS | versão de fonte, sem newest-wins |
| T33 | PASS | prioridade contextual por edital |
| T34 | PASS | reversão conflita com decisão nova |
| T35 | PASS | tombstones não ressuscitam |
| T36 | PASS | perfil diferente exige remapeamento |
| T37 | PASS | JSON/URL/texto hostil recusado |
| T38 | PASS | falha de import retorna parcial explícito |
| T39 | PASS | CSV sem formula injection |
| T40 | PASS | projeção obsoleta invalidada |
| T41 | PASS com limitação | consultas puras; sem lote materializado |
| T42 | PASS | concorrência/duplicidade semântica |
| T43 | PASS com limitação | conflito fake multi-device puro |
| T44 | PASS | tombstone/edição/replay |
| T45 | PASS | CivilDate/DST |
| T46 | INCONCLUSIVE | central local; sem dedup externa multiaba/permissão |
| T47 | PASS | oito temas × três viewports; teclado/touch |
| T48 | PASS | unit/E2E completos e regressões F1–F4 |

## Revisões e correções

Revisão 1 estruturada (subagentes não retornaram parecer; não foi chamada de independente) encontrou e corrigiu:

1. prioridade usava deficiência quantitativa com `INSUFFICIENT_DATA`; agora fator de deficiência é zero e a UI marca insuficiência;
2. compromissos `FULFILLED` apareciam em lembretes; removidos dos grupos pendentes;
3. reagendamento podia duplicar compromisso ativo do mesmo tópico; CAS semântico cobre criação e atualização;
4. execução sobre compromisso podia sobrescrever revisão concorrente; adicionado `commitmentBaseRevision` com CAS transacional;
5. importação aceitava IDs com `profileId` diferente; prévia e repositório rejeitam vazamento entre perfis;
6. estimativa de duração ignorava histórico; execuções passaram a carregar duração atribuível;
7. schema v4→v5 não tinha fixture de preservação; adicionado teste de migração sintético.

Revisão 2 estruturada (checklist distinto de UX/adversarial, sem alegar independência) corrigiu:

- IDs técnicos de evidências/conflitos expostos na UI foram substituídos por contagens legíveis;
- razões de matching técnico foram traduzidas para linguagem de estudante;
- migração v4→v5 e stores F5 foram exercitadas com dados F4 preservados.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS (aviso de chunk >500 kB) |
| `npm run test:unit` | PASS — 75 arquivos, 489 testes |
| `npm run test:e2e` | PASS — 104 testes, 103 PASS + 1 skip intencional |
| `f5-review-journey` | PASS |
| `f5-accessibility` | PASS — 8 temas × 3 viewports |

## Publicação e main

- `origin/v2` foi confirmado por read-back em `db7fcf3`, com seis commits F5 sobre a base documental `bf32821`; este adendo documental é o commit seguinte.
- A `main` não foi alterada. O push de `v2` para `main` está **bloqueado** na avaliação de segurança: o repositório declara Cloudflare Pages conectado ao GitHub e um workflow em `main`; não há prova de que um push em `main` não dispare publicação de produção. O GOAL 0.1 exige essa prova antes da integração.
- Nenhum deploy, PR ou Action foi criado. Nenhuma credencial Firebase/Google foi usada.

## Ressalvas

- F4-T13 `NOT_RUN`; quatro HIGH F0 `UNVERIFIED`; F7 para Firebase/multi-dispositivo real.
- `INCOMING` parcial F4 preservado; projeções que dependem dele permanecem diagnósticas.
- Importação em lote pode retornar `IMPORT_PARTIAL_NOT_COMMITTED`; não há staging transacional para volumes que excedam uma transação.
- Notificações externas progressivas não foram implementadas; a central local não promete disparo com app fechado.
- O bundle Vite ultrapassa 500 kB; não houve benchmark em hardware modesto.

## Veredito

**F5 implementada, testada e revisada na v2; integração à `main` bloqueada por risco de deploy automático não comprovado.** Não declarar aceite humano nem homologação F7. A próxima ação é o aceite humano do candidato publicado e, separadamente, a decisão sobre a proteção de publicação da `main`.
