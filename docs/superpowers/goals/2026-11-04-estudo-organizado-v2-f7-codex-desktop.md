# GOAL ÚNICO — CODEX DESKTOP — ESTUDO ORGANIZADO V2 / F7

**Status deste documento:** `F7_GOAL_PREPARED_NOT_EXECUTED`  
**Uso:** copiar integralmente para uma futura sessão do Codex Desktop, anexando o ZIP de entrada.  
**Repositório:** `matheussilva421/estudo-organizado`  
**Destino de desenvolvimento:** branch `v2` — a `main` contém a V1 produtiva e deve permanecer intocada durante a F7.  
**Objetivo:** implementar e homologar integralmente a F7, tarefas T01–T27, e entregar uma **V2 funcional em ambiente separado de avaliação (F7-G)**, para que eu a experimente antes de decidir se a V1 será substituída. **Custo obrigatório: R$ 0.**

> **AUTORIZAÇÃO E GATES:** Este texto é um GOAL preparado, **não uma ordem para executar agora**. Ao receber posteriormente minha ordem explícita **“Execute este GOAL F7”**, você fica autorizado a executar o trabalho LOCAL no repositório `v2` nos limites abaixo: alterar código/testes/docs V2, instalar dependências gratuitas necessárias no ambiente de desenvolvimento após verificação, executar testes locais e emuladores, produzir commits locais e, **apenas quando `origin/v2` estiver verificadamente apta a fast-forward, publicar esses commits em `origin/v2` como integração da F7**. O comando de execução **não** autoriza G-EXT nem G-STAGING, pois exigem meu consentimento expresso separado. Não autoriza modificar `main`, publicar no domínio V1, alterar serviços produtivos, migrar dados pessoais, habilitar billing ou aposentar a V1. Se a integração remota não puder ser segura, preserve os commits locais e reporte, sem force push.

## A. Documentos vinculantes — ler ANTES de trabalhar

A fonte canônica é o pacote de entrada anexado `Estudo_Organizado_V2_F7_Pacote_Writing_Plans_2026-11-04.zip`. Verifique integridade e extraia **estes dois arquivos, sem modificá-los antes do inventário**:

1. **Spec aprovada v1.0:** `docs/superpowers/specs/2026-11-04-estudo-organizado-v2-f7-design.md`, SHA-256 `ef53d1fafefe383e77bb0c2cdb2c4314feacf3c1e8e58e98584d58fa24c0786e`.
2. **Writing-plans aprovado (568 linhas, T01–T27):** `docs/superpowers/plans/2026-11-04-estudo-organizado-v2-f7-writing-plans.md`, SHA-256 `b8a1c2e189b2505cf76ef432783b55a801d96b8ba03a1504b0c1df4e2172a6a2`.

**Atenção ao versionamento:** existe um Markdown avulso do plano de 546 linhas que não contém a tabela de rastreabilidade das decisões. **O plano canônico aprovado é o de 568 linhas contido no ZIP**; não escolher silenciosamente o avulso. Verifique o manifesto do pacote. Se o ZIP não estiver anexado nem seus dois conteúdos puderem ser localizados e autenticados por hash, pare **antes de alterar código** e solicite somente a fonte ausente; não substitua pela spec F7 histórica.

Referências já existentes no GitHub a consultar, sem tratá-las como substitutos do pacote aprovado:
- `docs/superpowers/v2/ROADMAP.md` — estado/gates, F7 e F8;
- `docs/superpowers/specs/2026-10-28-v2-multidevice-sync-f1-contracts.md` — A-02;
- `docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f7-integration-design.md` — proposta **histórica, não aprovada**;
- `docs/superpowers/audits/2026-11-04-v2-f6-acceptance.md` — F6 aceita com ressalvas;
- `AGENTS.md`, `docs/README.md`, `PRODUCT.md`, `DESIGN.md` e instruções pertinentes sem extrapolar regras Vanilla V1 para React V2;
- issue-mãe GitHub **#108** e issue legada **#107** (`missing-remote-plan`), esta última somente como referência/fixture sintética.

**Precedência:** meus gates explícitos e a spec v1.0 aprovada > writing-plans aprovado > contratos existentes A-02 e decisões anteriores > proposta histórica F7. Se houver conflito material entre fontes, resolver conservadoramente dentro das decisões já aprovadas e registrar o ajuste; mudança arquitetural nova e relevante requer gate humano. **Não alterar unilateralmente a spec aprovada.**

## B. Contexto e preflight verificável (antes de qualquer edição)

**Referência remota consultada em 04/11/2026, não garantia do estado de sua máquina:**
- `origin/v2`: `53553f291678f943bb6d96a0de56a511d4d5c369`;
- `origin/main`: `9046cfa2283cd293b38df9d52fabfcd5de9ac67c`;
- 0 PR aberto na consulta. A F6 foi aceita com ressalvas e integrada à `v2`; F7 ainda não foi implementada/validada.

**Execute e registre antes de trabalhar:**

```bash
git status --short --branch
git branch -avv
git worktree list --porcelain
git stash list
git remote -v
git log -1 --format='%H %s' HEAD
git log -1 --format='%H %s' v2
git log -1 --format='%H %s' main
git fetch --prune --dry-run origin
git rev-list --left-right --count v2...origin/v2
git rev-list --left-right --count main...origin/main
git log --oneline --decorate --all -25
```

A consulta a PRs e branches remotos pode usar `gh`/API conectada, **somente leitura**. Não executar `git fetch --prune` de verdade antes de examinar refs locais especiais e decidir se a atualização é segura; atualize as refs por operação conservadora após o inventário. Conferir HEAD local, HEAD remoto, working tree, arquivos ignorados relevantes, branches/worktrees com commits exclusivos, PRs e artefatos não integrados. Não tomar os SHAs acima como atuais por presunção.

**Preservações conhecidas:** branch `codex/f5-local-preserved-20261102` relatada com quatro commits exclusivos (`2f556da`, `9654fcd`, `90a1d9a`, `6cad56c`), worktrees associados, três PNGs F4 locais modificados e seus backups/hashes históricos. Verificar existência, estado e integridade; **não apagar, regravar, consolidar por adivinhação nem misturar com a F7**. Se `v2` tiver alterações não commitadas/exclusivas, preservar backup verificável antes de escrever. Se houver trabalho concorrente em outra máquina, não sobrescrever.

**Backup de preflight:** inventariar alterações e dados sintéticos insubstituíveis; copiar para destino independente já disponível, calcular SHA-256, verificar leitura/restauração amostral e registrar local e manifesto. **Sem `reset --hard`, `clean -fd`, force push, rebase destrutivo ou exclusão de refs/commits não integrados.** Se não puder preservar com segurança, trabalhar somente no que for comprovadamente isolado; documentar bloqueio específico. Não exigir HD/serviço novo como dependência.

**Identificar stack real:** `apps/v2/package.json`, lockfile, `tsconfig`, Vitest/Playwright, `src/platform/indexeddb.ts`, `sync/{delivery-policy,coordination,flush,fake-remote,retry-policy,document-budget}.ts`, `application/sync-types.ts`, `local-profile-repository.ts`, `platform/backup/*`, `src/platform/sw-update.ts`, `public/sw.js`, componentes e testes existentes. Reaproveitar estrutura; **não duplicar outbox, modelos de domínio ou design system**. Verificar a existência real de Firebase SDK/CLI e emuladores — no baseline `package.json` V2 não continha Firebase — antes de escolher versões.

**Conclua G0:** plano/spec íntegros, inventário e backup verificáveis, branch de trabalho identificada, `main` e V1 intocadas. Produza um registro sucinto do preflight dentro do relatório único de execução; não crie uma coleção de relatórios redundantes.

## C. Restrições absolutas e escopo autorizado

1. **Implementar T01–T27 da especificação aprovada**, seguindo os passos e os testes exatos do writing-plans, modificando o mínimo necessário em `apps/v2/**` e documentação F7 em `docs/superpowers/**`. D-F7-01–17, F7-A–G e S01–S25 são vinculantes. Não incluir melhorias não aprovadas ou refatorações decorativas.
2. **Produto pessoal e simples:** React/TypeScript/Vite existentes, IndexedDB local-first, Firebase Auth Google e Firestore Spark como **único backend remoto de sync da V2**. Cloudflare Workers KV Free apenas para backup criptografado; R2 desabilitado; sem servidores novos, bots, CRDT, jobs remotos obrigatórios, Cloud Functions pagas, Actions/CI/CD novos ou múltiplas filas de escrita.
3. **R$ 0 sem surpresa:** nenhum vínculo de faturamento, Blaze, assinatura R2, serviço de excedentes cobrados, backup Firestore gerenciado, recursos pagos ou testes de carga reais irrestritos. Reconfirmar documentação oficial e elegibilidade no dia da integração. Sem ambiente gratuito comprovado, bloquear apenas a operação externa e oferecer alternativa gratuita, sem concluir falsamente o gate.
4. **V1 protegida:** `main`, root `src/**`, regras Firestore/Cloudflare produtivas, URL/domínio e dados V1 são somente leitura. **Não mexer em produção.** Não alterar a origem/cache/Service Worker V1, não fazer merge `v2`→`main` nem publicar na URL V1.
5. **D-F7-17/C ajustada pela última diretriz humana:** concluir a V2, publicar candidato em **URL própria de avaliação** e permitir que eu a experimente **antes** de decidir a transição. A escolha futura de coexistência produtiva V1/V2 com ponte bidirecional continua possível, mas **não implementar/ativar essa ponte na F7** nem gerar escrita dupla em acervo real. Se necessária depois, exigirá desenho/homologação/gate futuros. Não tratar essa delimitação como revogação da decisão C.
6. **Segurança dos dados:** sem perda silenciosa de sessões, planos, blocos, questões, revisões, histórico, drafts, tombstones, commits ou operações pendentes. `LOCAL_COMMITTED`, `REMOTE_COMMITTED` e `CONVERGED` exigem provas distintas. Nunca mascarar `NOT_RUN`, `INCONCLUSIVE` ou `FAIL`.
7. **Gates externos obrigatórios:** G-EXT para criar/usar Google/Firebase Spark reais e Workers/KV reais; G-STAGING para publicar URL de avaliação e alterar DNS/hosting. **Minha futura autorização de executar este GOAL cobre somente execução local/emulador e integração limitada na `v2`, não esses dois gates.** Se faltar autorização, prepare 100% do que for offline, registre o gate e formule **um único pedido consolidado**, sem interromper tarefas independentes.
8. **Autonomia técnica com limites:** escolha versões, nomes menores e soluções rotineiras conforme spec/plan sem me consultar a cada passo. Interrompa somente diante de ação destrutiva, custos, credenciais inexistentes, mudanças arquiteturais materiais, risco de dados pessoais ou gate humano. Não crie loops intermináveis de revisão.

## D. Método obrigatório: Superpowers + TDD e qualidade

Use a skill `superpowers:subagent-driven-development` quando disponível e proporcional ao trabalho crítico; alternativamente `superpowers:executing-plans`. Respeite os passos do writing-plans sem reinventar o roadmap. Para **cada T01–T27**:

- Ler contrato, arquivos, dependências e testes existentes antes de mexer;
- Escrever teste focal que demonstra requisito ausente (RED), executá-lo e registrar o erro **esperado** (não confundir falha ambiental ou falta de dependência com RED válido);
- Implementar GREEN mínimo, reaproveitando portas e stores atuais;
- Executar teste focal PASS, typecheck/lint pertinentes e regressões afetadas;
- Revisar diffs de segurança/integração, registrar evidências e criar **commit pequeno e coeso** somente na `v2` autorizada; não fazer PR por tarefa;
- Para tarefas de infraestrutura externa T26/T27, diferenciar preparação local de **prova real**, sem fingir RED por falta de credencial nem execução impossível sem gate.

**Comandos reais** (a partir de `apps/v2`, após verificar scripts/ambiente):

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:e2e
npm run test:unit -- tests/unit/f7-<area>.test.ts
npm run test:e2e -- tests/e2e/f7-<area>.spec.ts
```

O script Playwright atual inicia Chromium em `127.0.0.1:18431` e constrói a aplicação em modo E2E. Testes Firebase de T04 serão **específicos do emulador**, sem confundir com a suite Vitest jsdom padrão. Não presumir que Android ADB ou hardware físico está disponível; detectar e usar quando autorizado, mantendo `NOT_RUN` caso ausente. Não criar CI/Actions.

**Revisão independente** após blocos de Auth/Rules/Sync, backup/cripto e migração, e uma revisão holística ao final. Corrigir falhas **materiais**, não reiniciar todo o fluxo por detalhes cosméticos. Revisores não têm autorização extra de editar V1/produção.

## E. Execução consolidada das 27 tarefas — não omitir nenhuma

### E1. T01–T04 — Ambientes, identidade e regras

| Tarefa | Implementação verificável | Teste/gate |
|---|---|---|
| T01 | Configuração explícita V2, local-only por padrão e rejeição de origem/projeto produtivo V1 | `f7-environment`, isolamentos de URL/IDB/SW |
| T02 | Porta testável Firebase Auth Google com fake/emulador, cancelamento e logout seguros | `f7-auth`; login real **só G-EXT** |
| T03 | Vínculo `profileId`/UID/`remoteLibraryId`, preview e consentimento; ignorar respostas tardias de UID anterior | `f7-google-link` e regressão `f2-delivery-identity` |
| T04 | Rules/índices/Emulator Suite **exclusivos V2**, negar acesso cruzado e payload inválido | testes negativos `test:firebase`, root `firestore.rules` intocado |

### E2. T05–T13 — Sync durável e controle gratuito

| Tarefa | Implementação verificável | Teste/gate |
|---|---|---|
| T05 | Documentos Firestore pequenos, versões/cursores e orçamento por documento; sem snapshot global | limites + prova de payload >1 MiB rejeitado |
| T06 | Adaptador remoto CAS e deduplicação por `operationId`, tombstone causal | emulador, replay idempotente, concorrência |
| T07 | ACK local atômico **após prova remota**, sem apagar outbox em timeout | testes de confirmação/recusa/repetição |
| T08 | Flush seguro entre abas com Web Locks e retomada após crash; falhar fechado sem lock seguro | multiaba E2E, timeout após commit |
| T09 | Pull incremental, cursor e isolamento de contexto/UID, inclusive resposta tardia | read-back, cursor e troca de conta |
| T10 | Merge independente, conflito incompatível persistido, delete-vs-edit conservador | testes de conflitos e ausência de LWW |
| T11 | Epoch/tombstone/rebaseline sem ressuscitar exclusões e sem descartar drafts | cliente antigo, backup antigo, recovery |
| T12 | Gatilhos automáticos adaptativos enquanto app ativo; estados honestos | offline, reconexão, `PAUSED_*` |
| T13 | Instrumentação/limitação de leituras, escritas, deletes, listeners e quotas Spark | simulação 1–3 dispositivos, medição conservadora |

**Invariantes:** apenas uma outbox aplicativa em IndexedDB, operações comutativas só após prova, CAS sem transação online fictícia, sem dupla fila SDK para mesmo dado, Firestore único peer remoto da V2; KV não é sync. Se quota/expiração Auth impedir, manter dados/pendências locais e declarar o estado correto.

### E3. T14–T21 — Backup completo, criptografia, Workers KV e migração

| Tarefa | Implementação verificável | Teste/gate |
|---|---|---|
| T14 | Snapshot/manifest íntegros de **todas** as entidades F2–F6, não só backup F2 | inventário dos stores, contagens, hash, outbox/tombstones |
| T15 | Criptografia AES-GCM client-side, chave local e recuperação independente; nonce único | adulteração, chave incorreta e recuperação noutro dispositivo |
| T16 | Worker mínimo no Free com validação Firebase Auth JWT, identidade e autorização | fake/emulador; rede real **só G-EXT** |
| T17 | KV Free com objetos de versão imutáveis e read-back; não truncar acima do limite por valor | quota, duplicação e integridade, R2 desabilitada |
| T18 | Backup automático no máximo 1/24h **se mudou**, 7 versões válidas, manual livre | retenção segura, não apagar última íntegra |
| T19 | Preview, isolamento, restauração e commit recuperável, epoch/rebaseline seguro | roundtrip, rollback e ausência de overwrite |
| T20 | Migração V1 sintética (schemas 12/11/9/7 e IDB 7/6), plano legado #107 | IDs, relações, tempo e 180 blocos sintéticos divergentes/equivalentes |
| T21 | Estresse de backup/cripto/KV sem cobrar, corruptela e pacote >25 MiB | falha fechada da nuvem e exportação local íntegra |

**Proteção adicional:** backup na mesma origem do IndexedDB não é cópia independente; exportação local de arquivo deve funcionar offline. Manter última versão boa mesmo diante de falha de upload, compressão, criptografia, verificação ou limpeza. Não guardar secrets no bundle da PWA nem publicar tokens nos logs.

### E4. T22–T25 — Produto, PWA e hardening

| Tarefa | Implementação verificável | Teste/gate |
|---|---|---|
| T22 | UX pessoal discreta: login, sync e backup com estados separados, ações manuais opcionais | browser/mobile, teclado, status sem falsa convergência |
| T23 | Service Worker e PWA offline seguros, update adiado se timer/draft/abas impedirem | E2E `f4-update`, `pwa-offline` e novos casos |
| T24 | Persistência IndexedDB quando disponível, quota, abortos e restauração segura | `QuotaExceededError`, storage removido e aviso honesto |
| T25 | Revisão de segurança/privacidade/acessibilidade e regressão de F1–F6 | suites completas, testes adversariais, matriz de funções |

Não transformar UI em dashboard técnico complexo; preservar oito temas, teclado, mobile e preferências existentes. Corrigir ressalvas herdadas de F6 que sejam materialmente relevantes para entrega integrada; registrar as que exigem hardware/leitor de tela ausente.

### E5. T26 — Piloto operacional isolado (exige G-EXT)

- **Sem autorização externa:** rodar Emulator Suite + suites sintéticas, preparar configurações isoladas e matriz; marcar testes reais como `NOT_RUN`. Nunca apontar para projeto Firebase da V1.
- **Após autorização G-EXT específica:** Google Auth real em projeto Spark isolado, Firestore Rules, segurança por UID, PC/Android emulador e dispositivos reais disponíveis, Worker/KV Free autorizado, backup remoto criptografado e read-back, jornadas de edital→planejar→estudar→revisar→analytics→sync→backup→restore.
- Medir custos/cotas no ambiente real **com limites**, usar identidades/fixtures de teste, logs sanitizados, nenhum dado pessoal produtivo. Confirmar se as condições atuais dos planos Free continuam adequadas.
- S01–S25 e quatro HIGH F0: apresentar provas por cenário, distinguir `EMULATOR_PASS` de `REAL_ISOLATED_PASS`; marcar `NOT_RUN` onde ambiente não permita.

### E6. T27 — F7-G: V2 completa em URL independente (exige G-STAGING)

- **Sem autorização externa:** gerar build reproduzível, preparar configuração isolada, checklist de publicação, testes de origem/manifest/SW, ensaio local e pacote de homologação; não inventar URL nem declarar acessibilidade real.
- **Após G-STAGING:** selecionar hospedagem efetivamente Free e separada, preferencialmente Cloudflare Pages Free; publicar **somente a V2 candidata**, com projeto Firebase de homologação, dados sintéticos, origem distinta e proteções de acesso apropriadas. Nada de domínio/Service Worker/Cloudflare produtivos V1.
- Fazer HTTP read-back real, abrir URL em navegador desktop e viewports mobile/tablet, verificar módulos F2–F6, Auth, sync, backup e funcionamento PWA. Se houver dispositivo físico disponível/autorizado, registrar ensaio; caso não, `NOT_RUN` para físico.
- Entregar ao proprietário **URL, instruções de teste, limitações conhecidas e pontos para feedback**. A F7 fica `READY_FOR_HUMAN_REVIEW` somente após testes críticos e ambiente acessível. **Não declarar `F7_ACCEPTED` antes que eu experimente e aprove.**

## F. Matriz de rastreabilidade obrigatória

Verificar cada decisão **D-F7-01 a D-F7-17**, cada cenário **S01 a S25**, cada tarefa **T01 a T27**, cada módulo **F7-A a F7-G** e os quatro riscos HIGH. Reutilizar a matriz de rastreabilidade do **plano ZIP (568 linhas)**, sem copiar para 25 documentos.

Os riscos HIGH são:
- `R-V1-LEGACY-REMOTE-PLAN`: equivalência semântica da Reta Final legada, sem considerar documento não reconhecido como ausente;
- `R-V1-FIRESTORE-DOCUMENT-1MIB`: esquemas/payloads limitados, sem truncamento;
- `R-V1-MULTITAB-OUTBOX-RACE`: uma aplicação lógica, lock/ACK seguros;
- `R-V1-BACKUP-TOMBSTONE-LOSS`: restauração antiga não ressuscita exclusões.

Estados possíveis por cenário: `PASS_LOCAL`, `PASS_EMULATOR`, `PASS_REAL_ISOLATED`, `FAIL`, `NOT_RUN`, `INCONCLUSIVE`, `BLOCKED_G-EXT`, `BLOCKED_G-STAGING`. **Não converter prova simulada em prova real.** Critérios críticos de segurança/integridade não podem ser “aceitos com ressalvas” sem bloqueio efetivo da capacidade insegura.

## G. Estratégia de continuidade autônoma, sem loops

- Execute as tarefas na ordem de dependência do plano. Se um teste depender de G-EXT/G-STAGING, **não suspenda o trabalho local independente**; registre o gate e prossiga até onde for seguro.
- Agrupe perguntas humanas: uma solicitação G-EXT para Firebase/Cloudflare, uma solicitação G-STAGING para URL. Não pedir confirmação para decisões rotineiras cobertas por spec/plan.
- Em erros de código, investigar, escrever regressão, corrigir no mesmo módulo/branch e repetir testes afetados e suíte crítica. Revisão independente proporcional ao risco; evite repetir inspeções sem evidência nova.
- Se um recurso não couber em Free ou tornar o uso inseguro, mantenha o funcionamento local, ofereça fallback gratuito autorizado e **não** habilite billing. Registre impacto e peça decisão somente se mudar materialmente a arquitetura aprovada.
- Se ambiente/desempenho/ADB/NVDA não permitir ensaio físico, registre `NOT_RUN` com motivo e efeito sobre o gate. Nunca inventar sucesso.
- Preservar trabalho existente: não editar a V1 para “consertar” um teste V2, nem apagar ou ajustar a branch de preservação F5/PNG F4 por conveniência.

## H. Revisão independente, integração e GitHub Hygiene

**Revisão final:** confrontar diffs e comportamento com spec v1.0 + plano aprovado; revisar arquitetura Auth/Rules, deduplicação, conflitos, tombstones, proteção contra UID stale, cripto/recuperação, quotas, PWA e isolamento. Corrigir achados materiais **na `v2`** com testes; listar pendências honestas.

**Comprovações locais:** executar e registrar saídas exatas de `typecheck`, `lint`, `test:unit`, `build`, `test:e2e`, testes Firebase em emulador e smoke de integração. Relatar totais por suite, skips, FAIL, ambiente, timestamp/commit; não usar números de F6 como prova F7. Preservar relatórios originais de falha. A V1 pode continuar com falhas E2E históricas; não afirmar que a V2 as corrigiu sem comparação funcional.

**Git:** confirmar diff e commits, árvore limpa ou pendências justificadas, worktrees/stashes/branches e PRs. **Integração da F7 é `v2`**; nunca `main`. Quando a execução tiver sido expressamente autorizada, permitir **push fast-forward exclusivamente em `origin/v2`** se não houver divergência/trabalho concorrente, proteções estiverem respeitadas e todos os commits pretendidos tiverem testes pertinentes. Se não for fast-forward ou houver proteção/conflito, **não forçar**, preservar commits locais e registrar bloqueio. Não abrir PR novo automaticamente; se política exigir PR, pedir gate apropriado. Não modificar Actions existentes, nem criar novas.

**Higiene:** detectar branches/worktrees/stashes/arquivos temporários duplicados, conferir se cada mudança exclusiva chegou à `v2`. Limpar **somente** resíduos comprovadamente sem trabalho exclusivo e cuja remoção esteja autorizada; não excluir preservações F5/F4 ou mudanças de outra máquina. Um relatório e atualização enxuta do `ROADMAP.md` + issue #108 (apenas quando autorizado) bastam; evitar relatórios redundantes.

**Rollback por camada:**
- Código local: reverter somente diff identificado, com cópia íntegra; não `reset --hard`/force push.
- IndexedDB/migração: restaurar fixture/backup de testes verificado; não reverter schema sobre dados reais nem executar downgrade automático.
- Firestore/Rules de teste: desabilitar cliente remoto isolado, restaurar configuração isolada validada; nunca tocar no Firestore V1.
- Workers KV de teste: interromper uploads e preservar versões íntegras; não excluir última cópia válida.
- Staging: retornar versão anterior do **ambiente V2 isolado**, documentar URL/versão; não alterar V1.
- Operações após rollout de teste: preservar dados novos de teste e reconciliar antes de qualquer restauração; rollback de código não equivale a rollback de dados.

## I. Relatório único e pacote ZIP final — obrigatório

Entregar **um único pacote ZIP**, por exemplo `ESTUDO-ORGANIZADO-V2-F7-EXECUTION-REVIEW-<DATA>-<SHA7>.zip`, criado em diretório de saída local acessível ao usuário. A nomenclatura pode variar; os conteúdos são obrigatórios:

1. `README.md` — escopo, estado final, instruções de acesso, riscos e links;
2. `spec-aprovada.md` e `writing-plans-aprovado.md` **exatos** (hashes preservados) + este GOAL;
3. `relatorio-unico.md` — implementado, testado, integrado a `v2`, disponibilizado em staging, **aceito ou não**; nunca confundir estados;
4. `matriz-T01-T27.md` e `matriz-S01-S25.md` — resultado, prova, motivos de skips, gate, SHA;
5. `quatro-riscos-high.md` — mitigação comprovada no contexto V2 ou bloqueio técnico explícito;
6. `testes/` — comandos e trechos essenciais de logs, totais unit/E2E/emulador, data, ambiente, resultados de read-back; remover segredos;
7. `custos-e-quotas.md` — serviços configurados, Free comprovado, orçamento medido, limite e gatilhos de pausa;
8. `backup-rollback.md` — hashes, inventário, cópias verificadas, provas de restore e contingência;
9. `git-state.md` — SHAs inicial/final, estado `main/v2/origin`, commits, branches, PRs, worktrees, stashes e trabalhos exclusivos preservados;
10. `staging.md` — URL real **se G-STAGING autorizado e implantado**, read-back, separação V1 e instruções para eu testar; caso contrário, `BLOCKED_G-STAGING` com instrução precisa;
11. `revisao-independente.md` — achados materiais, correções e riscos residuais;
12. `SHA256SUMS.txt` — hashes verificáveis dos artefatos do ZIP.

Se o ZIP crescer demais, incluir logs resumidos mais evidências centrais com caminhos locais verificáveis, evitando segredos, conteúdo acadêmico pessoal, `node_modules`, builds volumosos e tokens. **Verificar que o ZIP abre, tem os arquivos e que seus hashes correspondem ao manifesto.** Disponibilizar caminho absoluto e link quando o ambiente suportar, sem inventar acesso.

**Relatório final no chat do Codex:**
- Status: `F7_LOCAL_CODE_COMPLETE`, `F7_BLOCKED`, `F7_READY_FOR_HUMAN_REVIEW` ou `F7_ACCEPTED` **somente se houver meu aceite posterior**;
- `v2` HEAD local/remoto, `main` confirmada intacta, commits e push;
- T01–T27 e S01–S25: PASS/FAIL/NOT_RUN, quatro HIGH;
- Firebase/Cloudflare: emulador, real isolado, quotas e autorização;
- URL de avaliação V2 se publicada; nenhuma URL fictícia;
- Backup/rollback e preservações Git, pendências, gate humano requerido;
- ZIP entregue com local e SHA-256;
- **Próxima ação única**, sem iniciar F8.

## J. Critérios de aceite e parada

A F7 **não** está concluída apenas porque o código compilou ou os mocks passaram. `F7_READY_FOR_HUMAN_REVIEW` exige V2 funcional integral, testes críticos comprovados, riscos tratados, integração Git segura e **ambiente isolado de avaliação acessível após G-STAGING**, com documentação para minha experiência real. `F7_ACCEPTED` exige meu aceite **depois** de experimentar a V2.

Se a autorização de serviços reais ou de staging não for concedida, entregue o máximo local verificável e declare **precisamente** `F7_BLOCKED_G-EXT` ou `F7_BLOCKED_G-STAGING` com itens prontos e uma intervenção humana consolidada. Não ultrapasse gate, não invente resultado e não substitua a V1.

**A transição V1 → V2 (F8/G5) só será decidida por mim posteriormente. Não iniciar cutover, não aposentar V1 e não ativar coexistência produtiva bidirecional no âmbito deste GOAL.**

**FIM DO GOAL — documentação preparada para execução futura, não executada nesta conversa.**
