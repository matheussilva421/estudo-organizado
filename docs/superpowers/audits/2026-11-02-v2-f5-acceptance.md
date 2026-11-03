# Estudo Organizado V2 — F5: implementação, revisões e publicação na v2

**Status:** `F5_ACCEPTED_WITH_RESERVATIONS` — aceite humano expresso em 2026-11-03; escopo F5 local-first na `v2`, sem cutover, deploy ou homologação F7.
**Data:** 2026-11-03 (rodada corretiva sobre o candidato de 2026-11-02)
**Branch/worktree:** `v2` em `C:\Users\slvma\.codex\worktrees\v2-f4\estudo-organizado`
**Base oficial da rodada:** `origin/v2` = `684e219e4de77b8089e6356f46c231a373068ffe`
**HEAD de código/testes:** `9817fb8`; UI/E2E em `91d7989`; integridade em `d4bbef6`
**Candidato aceito:** `origin/v2@c358928749951b5848217040762af2785fffae8b` (HEAD verificado antes do registro documental; commits posteriores deste aceite são somente documentais).
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

## Rodada corretiva 2026-11-03

A revisão de aceite anterior deixou seis lacunas abertas. Esta rodada as corrigiu
com RED→GREEN→REFACTOR, sem iniciar F6/F7, sem tocar `main`, Cloudflare, Firebase real
ou dados de produção:

1. **F5-T38 — importação atômica:** `commitImport` grava entidades, outbox, recibo e
   registro de operação em uma única transação IndexedDB. Abort, quota, conflito,
   replay e retry foram exercitados; uma falha na segunda gravação deixa zero
   entidades, zero outbox e zero recibo.
2. **F5-T16 — overrides por assunto:** `ReviewPolicy.overrides` versionado, validado,
   com prévia de impacto antes da gravação e UI utilizável. Compromissos e execuções
   existentes permanecem byte a byte iguais; prévia obsoleta retorna
   `CONFLICT/STALE_POLICY`.
3. **F5-T41 — projeções materializadas:** cache `review_projections` (schema v6),
   fingerprint de dependências F2/F4/F5, reconstrução em lotes, status READY/STALE,
   CAS de geração e rejeição de publicação obsoleta de prioridade
   (`CONFLICT/STALE_PROJECTION`).
4. **F5-T46 — lembretes:** preferências locais por perfil, horário de silêncio,
   dispensa que não cumpre nem cancela compromisso, permissão opcional da Notification
   API e lease atômico em IndexedDB para deduplicação entre abas. Não há promessa de
   disparo com o PWA fechado.
5. **F5-T42 — duas abas reais:** E2E com duas páginas no mesmo contexto, IndexedDB
   compartilhado, `operationId` distintos, recarga e verificação de unicidade
   semântica de compromisso e execução.
6. **F5-T47 — acessibilidade:** contraste WCAG AA calculado em oito temas e três
   viewports, foco visível por teclado nos oito temas, landmarks/rótulos, estado de
   erro com `role=alert`, alvos de toque ≥44 px e `prefers-reduced-motion`.

Evidências proporcionais de desempenho: a projeção de 300 assuntos e 3.000 execuções
levou **20,5 ms** com delta de heap de **6,3 MiB** no teste local; o build de produção
ficou em **540,10 kB** (150,21 kB gzip) e mantém o aviso de chunk >500 kB. Não houve
benchmark em hardware modesto real; isso continua sendo limitação, não PASS de F4-T13.

## T01–T20

| Tarefa | Estado | Evidência principal |
| --- | --- | --- |
| T01 contratos/fixtures | PASS | `f5-review-domain`, `f5-review-service` |
| T02 identidade de assunto | PASS | vínculo canônico explícito; `F5-T10` |
| T03 persistência/migração/outbox | PASS | `f5-schema` v4→v6 aditivo e outbox bloqueada |
| T04 sugestões e opt-in | PASS | `F5-T01/T02`; consulta pura |
| T05 execução/cobertura | PASS | `F5-T04–T09`; replay e CAS |
| T06 motor temporal | PASS | `F5-T11–T16/T25/T45` |
| T07 atraso e duração | PASS com limitação | duração limitada 5–180 min e amostras >12 h ignoradas; backlog ordenado por vencimento; sem hardware modesto |
| T08 integração F3 | PASS | `F5-T18/T19`; capacidade global e read-back |
| T09 evidências F4 | PASS | `F5-T21/T22/T26` |
| T10 tendências/suficiência | PASS | `F5-T23/T24` |
| T11 importação de banca | PASS | `F5-T27/T28/T37/T39` |
| T12 matching | PASS | `F5-T29/T30` |
| T13 prioridade/reversão | PASS com limitação | prioridade explicável; reversão conflita se houver decisão nova |
| T14 invalidação/projeções | PASS | `F5-T03/T40/T41`; fingerprint, cache materializado e CAS |
| T15 portabilidade | PASS com limitação | JSON/CSV, prévia, perfil, idempotência e falha parcial explícita |
| T16 lembretes progressivos | PASS com limitação | preferências, silêncio, dispensa, lease multiaba e permissão opcional; sem push com app fechado |
| T17 UI de revisões | PASS | `f5-review-journey` |
| T18 UI de pontos fracos/banca | PASS | `f5-review-journey`, `f5-accessibility` |
| T19 concorrência/falhas | PASS com limitação | abort, CAS, duas abas reais e load local; sem hardware modesto |
| T20 regressões/revisões | PASS | suítes completas e duas revisões críticas com correções revalidadas |

## Matriz F5-T01–F5-T48

| ID | Estado | Teste/evidência |
| --- | --- | --- |
| T01 | PASS | `f5-review-domain` sugestão determinística/pureza |
| T02 | PASS | `f5-review-service` opt-in e revogação |
| T03 | PASS | `f5-review-domain` fingerprint; F4 schema |
| T04 | PASS | `f5-review-domain` execução avulsa |
| T05 | PASS | `f5-review-service` replay |
| T06 | PASS | `f5-review-service` payload divergente |
| T07 | PASS com limitação | `f5-review-domain` conclusão concorrente, limites de duração e `f5-load`; sem hardware modesto real |
| T08 | PASS | cobertura parcial sem sobreposição |
| T09 | PASS | UNKNOWN não conclui |
| T10 | PASS | vínculo explícito/homônimos |
| T11 | PASS | multiplicador FORGOT |
| T12 | PASS | política versionada GOOD/PARTIAL |
| T13 | PASS | execução tardia ancora CivilDate |
| T14 | PASS | UNRATED fallback conservador |
| T15 | PASS | retenção e acurácia separadas |
| T16 | PASS | `f5-review-domain`/`f5-review-service` + `f5-settings-ui`: override versionado, prévia, CAS e fatos preservados |
| T17 | PASS | duração histórica/fallback |
| T18 | PASS | capacidade global e UNALLOCATED |
| T19 | PASS | enchaixe F3, CAS, read-back |
| T20 | PASS | `f5-archived`: edital arquivado fora das opções e do matching automático; vínculo histórico permanece visível |
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
| T38 | PASS | `f5-import-atomic`: transação única, quota/abort/conflito/replay/retry e reabertura após falha, sem parcial |
| T39 | PASS | CSV sem formula injection |
| T40 | PASS | projeção obsoleta invalidada |
| T41 | PASS | `f5-projections`: fingerprint, lotes, CAS, status STALE e prioridade obsoleta rejeitada |
| T42 | PASS | `f5-two-tabs`: duas abas reais, IndexedDB compartilhado e recarga |
| T43 | PASS com limitação | conflito fake multi-device puro; convergência real continua F7 |
| T44 | PASS | tombstone/edição/replay |
| T45 | PASS | CivilDate/DST |
| T46 | PASS com limitação | `f5-reminders`, `f5-settings-ui` e `f5-two-tabs`: preferência, silêncio, dispensa e dedup em duas abas reais; sem push com app fechado |
| T47 | PASS | contraste AA 8×3, foco/teclado 8 temas, landmarks, erro, toque 44 px e reduced motion |
| T48 | PASS | unit/E2E completos e regressões F1–F4 |

## Revisões e correções

### Rodada corretiva — duas revisões críticas distintas

As duas passagens desta rodada foram feitas por subagentes distintos, em modo
somente leitura, sobre o diff completo. Nenhum deles editou, commitou ou publicou.

**Revisão de integridade/concorrência (Gauss) — `CHANGES_REQUIRED` antes das correções:**

- o CAS da projeção lia o snapshot *depois* do build; uma geração antiga podia
  sobrescrever uma mais nova. O snapshot agora é capturado antes do build e testado
  com um build concorrente aninhado;
- `claimNotification` gravava leases sem incrementar `localRevision`, permitindo que
  uma escrita concorrente de preferências apagasse o lease. A revisão agora incrementa
  e o CAS de settings conflita corretamente;
- settings ausente era classificado como `DUPLICATE`; agora retorna `DISABLED`;
- a chave de notificação ganhou o dia civil e a poda passou a ser por idade (90 dias),
  não apenas por contagem;
- overrides com limites contraditórios contra a política base passaram a ser rejeitados
  na gravação;
- `applyImport` preserva a distinção entre preview `CONFLICT` e `INVALID`.

**Revisão de UX/acessibilidade/testes (Bernoulli) — `CHANGES_REQUIRED` antes das correções:**

- prévia de override podia ser aplicada depois de alterar os campos ou no modo de
  remoção; edições agora invalidam a prévia e o botão nomeia o modo aplicado;
- duas abas podiam apagar overrides uma da outra; o serviço agora mescla somente a
  chave editada sobre a política persistida e mantém CAS por chave;
- “Testar aviso externo” consumia o lease real; agora usa uma chave de teste isolada;
- textos que sugeriam disparo automático foram corrigidos para envio manual;
- status da projeção deixou de expor jargão e data ISO crua;
- uma falha ao carregar o status da projeção não derruba mais a área inteira;
- `aria-live` passou a ser persistente, dispensas têm nomes acessíveis únicos e o erro
  de política associa `aria-invalid`/`aria-describedby`;
- o teste de contraste passou a medir 14 pares de texto e 4 bordas de controle nos
  oito temas × três viewports; controles usam `--control-border` para contraste não
  textual;
- o teste de duas abas exige ambos os botões habilitados, usa `Promise.all` e verifica
  um sucesso + uma duplicidade; autoaprovação concorrente também foi adicionada;
- T16 e T46 passaram a verificar fatos no IndexedDB, recarga, permissão simulada,
  silêncio e deduplicação manual.

Após as correções, os testes direcionados e as suítes completas foram reexecutados
(resultados na seção seguinte). O único achado residual aceito é a leitura de inputs e
status da projeção em transações separadas: pode produzir um falso `STALE` transitório
na UI, mas nunca publica nem autoriza comando com payload obsoleto.

### Histórico das revisões anteriores

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
| `npm run build` | PASS — 540,10 kB (150,21 kB gzip); aviso de chunk >500 kB |
| `npm run test:unit` | PASS — 79 arquivos, 520 testes |
| `npm run test:e2e` | PASS — 115 testes, 114 PASS + 1 skip intencional |
| `f5-import-atomic` | PASS — 6 testes de transação, quota, conflito, replay e retry |
| `f5-projections` | PASS — fingerprint, lotes, CAS, STALE e prioridade obsoleta |
| `f5-reminders` | PASS — preferência, silêncio, dispensa e lease entre abas |
| `f5-two-tabs` | PASS — duas páginas reais, recarga, unicidade semântica e dedup de notificação |
| `f5-accessibility` | PASS — contraste 8×3, foco/teclado, landmarks, erro, toque e reduced motion |
| `f5-load` | PASS — 300 assuntos/3.000 execuções em 20,5 ms; heap +6,3 MiB |

## Publicação e main

- `origin/v2` será confirmado por read-back após o fast-forward desta rodada sobre `684e219`; o SHA final será confirmado na entrega e na issue #108.
- A `main` não foi alterada. O push de `v2` para `main` está **bloqueado** na avaliação de segurança: o repositório declara Cloudflare Pages conectado ao GitHub e um workflow em `main`; não há prova de que um push em `main` não dispare publicação de produção. O GOAL 0.1 exige essa prova antes da integração.
- Nenhum deploy, PR ou Action foi criado. Nenhuma credencial Firebase/Google foi usada.

## Ressalvas

- F4-T13 `NOT_RUN`; quatro HIGH F0 `UNVERIFIED`; F7 para Firebase/multi-dispositivo real.
- `INCOMING` parcial F4 preservado; projeções que dependem dele permanecem diagnósticas.
- A importação F5 é atômica dentro de uma transação IndexedDB; pacotes grandes ainda podem falhar por quota, mas falham fechados e podem ser repetidos sem parcial.
- Notificações externas dependem da permissão e de app aberto; a central local não promete disparo com o PWA fechado.
- O bundle Vite ultrapassa 500 kB; não houve benchmark em hardware modesto. O teste de carga é sintético e local.
- Multi-dispositivo real, Firestore/Auth/Rules e convergência remota permanecem exclusivos da F7.
- A suíte visual Playwright regenerou as três capturas F4 que já estavam modificadas; os bytes anteriores não tinham backup e não foram recuperados. Os arquivos continuam não commitados; nenhuma limpeza destrutiva foi feita.

## Aceite humano formal — 2026-11-03

**Decisão expressa do proprietário:** `F5_ACCEPTED_WITH_RESERVATIONS` para o candidato publicado em `origin/v2@c358928749951b5848217040762af2785fffae8b`. O aceite abrange **somente a F5 local-first na branch `v2`**, conforme a especificação e o writing-plans aprovados: revisões, pontos fracos e inteligência de banca. O aceite não retroage para validar implantações, testes não executados ou funcionalidades F6/F7/F8.

**Fundamento do aceite:** relatório de execução corretiva; matriz F5-T01–F5-T48 (45 `PASS`, três `PASS com limitação`: T07, T43 e T46); 520 testes unitários reportados como PASS; 115 E2E (114 PASS + 1 skip); typecheck, lint e build reportados como PASS; duas revisões críticas por subagentes distintos e correções. O aceite humano não significa que essas suítes tenham sido novamente executadas no ato deste registro documental.

**Ressalvas expressamente mantidas:**

1. **Capturas F4 e histórico:** as três PNGs F4, anteriormente modificadas e regeneradas pelo Playwright, permanecem locais e não commitadas; os **bytes anteriores à regeneração não foram recuperados**. As versões atuais, as versões `HEAD` e 24 variantes históricas foram preservadas/inventariadas. O pacote integral da preservação foi verificado com 43/43 artefatos e uma cópia em outro disco físico (C: e D:); não há redundância offsite comprovada. Não confundir variantes históricas com as versões locais perdidas.
2. **Git Hygiene:** manter sem exclusão a branch `codex/f5-local-preserved-20261102@6cad56ce2c3ff09ad9640ce7214a421c01819572`, dois worktrees, snapshots, refs e branches históricas com commits exclusivos (`2f556da`, `83ae15e` etc.) até inventário/decisão específicos. O saneamento foi de **preservação verificada, sem limpeza destrutiva**. Não autoriza apagar arquivos nem executar `reset`, `restore`, `clean`, `prune` ou operação equivalente.
3. **Pendências herdadas:** `F4-T13` segue `NOT_RUN`; quatro riscos HIGH da F0 continuam `UNVERIFIED`; conflito `INCOMING` parcial F4 não foi homologado como convergência real.
4. **Desempenho e UX:** benchmark apenas sintético local (300 assuntos/3.000 execuções, cerca de 20,5 ms, +6,3 MiB); **hardware modesto real não testado**; build com aviso de chunk >500 kB (540,10 kB, 150,21 kB gzip); possível indicação `STALE` transitória na UI, sem publicação de comando obsoleto. Manter limites de notificações com PWA fechada e a ausência de avaliação com leitor de tela real como restrições conhecidas.
5. **F7/F8 e produção:** Google Auth/Firestore, regras, sincronização e convergência multi-dispositivo reais, migração/restauração produtiva e backup global dependem de homologação própria F7. **`main@9046cfa` permanece V1**, com risco concreto de workflow `Auto cache bump` e deploy Cloudflare em push. Integração `v2→main`, deploy e cutover continuam **bloqueados até gate específico F8/G5**, não sendo autorizados por este aceite.
6. **Fases posteriores:** **não iniciar F6 nem F7** por inferência deste registro; requerem brainstorming, spec, plano e autorização correspondentes.

**Condição de encerramento deste gate:** implementação/testes/revisões publicados na `v2` e aceite humano formal registrados. Preservação e pendências residuais permanecem abertas e rastreáveis; **não declarar o projeto integralmente concluído, a `main` integrada ou a V2 implantada**.

## Veredito

**`F5_ACCEPTED_WITH_RESERVATIONS` por decisão expressa do proprietário em 2026-11-03**, para o candidato `c358928749951b5848217040762af2785fffae8b`, implementado, testado, revisado e publicado na `v2`. Ressalvas acima permanecem abertas; **não houve homologação F7, merge na `main`, deploy, cutover ou autorização para iniciar F6**.
