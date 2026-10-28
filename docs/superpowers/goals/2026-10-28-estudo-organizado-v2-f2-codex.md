# GOAL ÚNICO — ESTUDO ORGANIZADO V2 — F2 COMPLETA
## Execução prolongada, TDD, revisão independente, integração v2 e pacote de evidências

**Destinatário:** Codex Desktop (executor do plano previamente escrito por ChatGPT + Superpowers).  
**Repositório:** `matheussilva421/estudo-organizado`  
**Branch-alvo:** `v2` (NUNCA `main` nesta etapa).  
**Escopo autorizado pelo proprietário:** a especificação F2 com D-F2-01..06 e E-F2-01..08; o writing-plans F2 com 16 tarefas, 123 passos, matriz F2-T01..T40; **a execução F2 começa quando o proprietário enviar este GOAL ao Codex junto com o plano anexado**.  
**Não autorizado:** F3–F8, Firebase Emulator/SDK/CLI/Rules reais, cloud services, dados reais, migração produtiva, mudanças V1, GitHub Actions, deploy, corte para `main`, operações destrutivas.

## 0. Contrato fundamental: Codex executa, não planeja

1. **Você NÃO é responsável por elaborar ou redesenhar o plano.** A spec e o writing-plans foram produzidos pelo ChatGPT usando Superpowers e aprovados pelo proprietário. Execute-os na ordem, usando as decisões e assinaturas neles fixadas. Não crie specs, ADRs ou writing-plans paralelos nem modifique decisões aprovadas por conveniência.
2. Leia primeiro `docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f2-content-design.md` e o arquivo anexo `docs/superpowers/plans/2026-10-28-estudo-organizado-v2-f2-editais-conteudo.md` (ou o arquivo fornecido `2026-10-28-estudo-organizado-v2-f2-writing-plans.md` quando ainda não estiver no repo). Confira **16 tarefas, 123 passos e 40 IDs F2-T01..T40**. Respeite também o plano F1, ADRs, A-01 e A-02 e o relatório de prontidão F2. Em caso de divergência material, pare **na decisão afetada** e reporte ao proprietário para revisão do ChatGPT; não invente nova arquitetura.
3. **Aprovações já expressas em chat:** a spec F2 com D-F2-01..06 e E-F2-01..08; o writing-plans F2; e, pelo envio deste GOAL, a implementação F2 delimitada abaixo. A aprovação documental remota do design/plano ainda não foi gravada na última conferência. Você pode registrar fielmente o aceite informado em `v2`/issue #108 como parte do preflight, com referência ao texto autorizado, sem afirmar que o próprio proprietário publicou o comentário. Não marcar F2 como concluída ou homologada.
4. **Método preferido:** `superpowers:subagent-driven-development`, com implementador e revisor independentes a cada tarefa ou grupo crítico e revisão holística final. Se subagentes não estiverem disponíveis, execute nativamente conforme o plano, utilize a revisão independente disponível ou registre precisamente a limitação; não invente aprovação de revisor. Não interrompa por escolhas rotineiras de implementação. Priorize qualidade, testes reais e economia de contexto/tokens.
5. O plano é a referência normativa. Se este GOAL e o plano diferirem, adote o requisito **mais restritivo de segurança e gates** e reporte a discrepância; não altere a spec por conta própria.

## 1. Preflight obrigatório antes de qualquer modificação

1. Localize o repositório e confirme sua identidade (`git remote -v`, `git rev-parse --show-toplevel`), worktree ativo, `HEAD`, `git status --porcelain=v1`, `git branch -avv`, `git worktree list --porcelain`, `git stash list`, commits exclusivos e branches remotas. Consulte issues/PRs (`gh pr list` ou API disponível), sem abrir PR. **Última referência remota de ChatGPT em 2026-10-28:** `main`/`origin/main` `9046cfa2283cd293b38df9d52fabfcd5de9ac67c`; `v2`/`origin/v2` `b1fbd2784c9b1cbd19326ccba5f4d47a3f9ee598`; zero PR aberto. Estes SHAs são baseline histórico, NÃO comandos para reset.
2. Faça inventário e backup não destrutivo de eventuais alterações locais não integradas. Se houver alteração inesperada de outro operador, não sobrescreva, descarte ou faça reset. Se houver conflito entre worktrees ou ponteiros, reconcilie conservadoramente e preserve commits exclusivos antes de prosseguir.
3. Confirme que `main` hospeda a V1 e deve permanecer intacta; audite scripts de build, preview, pre-push, deploy triggers, Cloudflare, Firebase e automações existentes **somente leitura**. Não criar/desativar Actions. Testar e executar estritamente a V2 em `apps/v2/` na origem `http://127.0.0.1:18431` e IndexedDB `estudo-organizado-v2`; não tocar banco/browser storage real da V1.
4. Confira se a versão da spec no repo já contém D-F2-01..06, E-F2-01..08 e a matriz F2-T01..T40. Compare o plano fornecido com eventual plano já presente, **sem sobrescrever uma versão mais recente sem diff**. Registre a aprovação humana desta conversa na spec/roadmap/issue #108 e coloque o writing-plans fornecido no caminho canônico `docs/superpowers/plans/2026-10-28-estudo-organizado-v2-f2-editais-conteudo.md`. Documento com gate `F2_SPEC_APPROVED` e `F2_PLAN_APPROVED_FOR_EXECUTION`; não alegar F2_IMPLEMENTED antes dos testes. Não reescreva o conteúdo aprovado, salvo inconsistência documental trivial ou bloqueio reportado.
5. Verifique Node/npm e `apps/v2/package-lock.json`; use instalação local **somente de dependências já fixadas no lockfile** se necessária, sem `npm update`, SDK Firebase, instalações globais ou geração de workflows. Se qualquer dependência nova parecer necessária, justificar e só adicionar se já estiver dentro do escopo/sem custo; instalação de Firebase continua proibida.
6. Execute uma baseline local **antes de implementar**: `npm --prefix apps/v2 run typecheck`, `npm --prefix apps/v2 run lint`, `npm --prefix apps/v2 run test:unit`, `npm --prefix apps/v2 run test:e2e`, `npm --prefix apps/v2 run build`. Registrar stdout/stderr, exit codes, número de testes e ambiente. Baseline histórica F1: **84 unitários, 20 E2E**; não fingir que isso foi reexecutado nesta sessão.
7. Verifique que o pacote anexo está completo. Caso o **writing-plans integral não esteja acessível**, NÃO improvise as 16 tarefas: reporte o bloqueio objetivo e peça apenas o arquivo necessário ao proprietário.

## 2. Execução da F2 — siga integralmente o writing-plans, tarefas 1–16

**Grupo A — fundação e persistência (Tasks 1–3)**
- Task 1: upgrade IndexedDB F1→F2, novos stores/índices e tratamento real de `onblocked`/`versionchange`, sem recriar database nem perder subjects, outbox ou operations.
- Task 2: domínio `Edital` + `EditalDiscipline` ligado ao `StudySubject` canônico; `displayAlias` contextual; duas disciplinas homônimas não se fundem.
- Task 3: serviço único de commit `LOCAL_COMMITTED|INVALID|CONFLICT|FAILED`; transação atômica dados+operação+outbox; idempotência forte com erro para operação duplicada divergente. Reutilizar componentes da F1, não criar segundo motor.

**Grupo B — conteúdo canônico e integridade (Tasks 4–7)**
- Task 4: único `primaryEditalId` por perfil, escolha/remoção explícita, arquivamento e controle de corrida entre abas.
- Task 5: árvore `Assunto`/`Aula`, vínculos N:N em contexto único `EditalDiscipline`, ordem determinística, validação de parentId/ciclos e links cruzados, com proveniência.
- Task 6: migração de `StudySubject` F1 conservadora: lista não vinculada, decisões `LINK_EXISTING`, `CREATE_EDITAL_AND_LINK`, `LEAVE_UNASSIGNED` com consentimento, IDs/revisões preservados, upgrade não destrutivo.
- Task 7: arquivamento reversível e soft-delete com tombstone/epoch, bloqueio de referências dependentes, restauração explícita e nenhuma exclusão física/purge de históricos.

**Grupo C — contratos de sincronização em fake (Tasks 8–10)**
- Task 8: conflito persistente com os dois payloads/revisões, `ResolveConflict`, fake CAS/read-back conservador, proibir last-write-wins silencioso.
- Task 9: perfil local distinto de UID Google e `remoteLibraryId` simulados; `LOCAL_ONLY` não envia, consentimento explícito permite atribuição de entrega sem mutar comando/opID histórico; logout/rebind não transfere outbox a outra conta.
- Task 10: retry durável, idempotente e seguro; backoff base 1s, teto 5min, jitter 0–20%; após quinta falha transitória, cooldown e retomada automática enquanto app ativo, **não** descarte nem retry infinito; auth/quota/conflito têm estados próprios.

**Grupo D — importação e recuperação (Tasks 11–13)**
- Task 11: parser JSON V1/versionado, identidade `centralId`/`sourceRef` somente em namespace confiável, nome como sugestão e não dedup; fingerprint canônico sem timestamps voláteis; preview e quarentena.
- Task 12: importação por `importId` e assinatura/revisão do destino; revalidar preview antes de commit; pré-validar todos os registros, então uma **única transação IDB** de entidades+recibo+outbox. Tetos candidatos: arquivo 2 MiB, profundidade 20, até 5.000 entidades, título 120, matching key 200; medir performance, **reduzir o limite se a atomicidade falhar em ambiente modesto**. Acima dos limites: rejeição explícita. Não introduzir `import_jobs`/staging persistente ou publicação multitransação sem nova aprovação arquitetural.
- Task 13: leitura/preview sintéticos de backup F1→F2, checksums, tombstones, histórico de exclusão completo e `REBASELINE_REQUIRED` conservador; **não** criar UI completa de restauração nem usar dados reais.

**Grupo E — produto, custo e fechamento (Tasks 14–16)**
- Task 14: UI React para criar/listar/renomear/arquivar editais, principal, associação de disciplina, assuntos, aulas N:N, importação com preview e confirmação. Reusar oito temas F1, tokens, foco, teclado, toque ≥44px, reduced motion e visual Impeccable. Mostrar `SEM_DADOS_DE_EXECUCAO` sem inventar sessões F4; estados de sync distinguem local de remoto.
- Task 15: modelo sintético de custo Firestore para 1–3 clientes, limite de payload de 900.000 bytes e cenário 3×7.840=23.520 escritas (> premissa Spark 20.000/dia). Não ligar SDK nem emulador. F2-T22 = `NOT_RUN` por gate específico; a simulação não comprova cota ou Google Auth real.
- Task 16: regressão holística, review, correções materiais, testes completos, Git hygiene, relatório de aceite, integração segura em `v2`, gate `F2_READY_FOR_HUMAN_REVIEW` ou `F2_BLOCKED`. Não declarar F2 aprovada nem iniciar F3.

As descrições acima são **índice**, não substituem assinaturas, testes, passos e arquivos de cada Task do writing-plans. Executar os **123 passos** do anexo, sem ignorar TDD ou revisão.

## 3. Disciplina de TDD, revisões e checkpoints

- **Cada Task:** criar teste que falha pelo comportamento ausente (RED, não erro de harness), executar e registrar falha, implementar mínimo, executar GREEN, typecheck/regressões relacionadas, revisar e corrigir P0/P1/P2, commitar mudança focada. Não usar testes novos que passam imediatamente como falsa evidência de TDD. Para Task 15/F2-T22 e Task 16/verificação final, o passo de verificação/NOT_RUN **não exige criar um falso RED**; a condição do plano é prova real do cenário, não um ritual.
- **Checkpoint após grupos A/B/C/D/E:** registrar `git status`, SHA, testes, regressões e riscos de migração, sem criar relatórios repetitivos. A atualização incremental fica no **mesmo relatório F2** de aceite, preferencialmente só ao final.
- **Revisão independente:** após cada Task quando houver recursos; obrigatória revisão profunda nos contratos de upgrade, commit, soft-delete, UID/outbox, importação e backup (Tasks 1,3,7,9,12,13). Revisor deve ler diff/testes e tentar refutar a correção com casos adversariais reais. Se não houver subagente/revisor independente, **não atestar revisão independente**; registrar limitação e realizar auto-revisão estruturada, sem pedir confirmações rotineiras.
- **Não replanejar**: nenhuma introdução de Redux/ORM/CRDT/event sourcing integral/backend extra/fila paralela/novo login, novas specs/ADRs ou redesign do shell. Sem GitHub Actions, dependências externas pagas ou cloud, sem alterar planejamento F3–F8.
- **Não presumir limites de tempo:** prossiga autonomamente pelas tarefas, testes e correções autorizadas; não prolongar trabalho artificialmente. Parar apenas em gate humano real, risco de perda de dados, divergência arquitetural, acesso a serviço não autorizado ou bloqueio não contornável sem ação destrutiva.

## 4. Matriz de aceitação obrigatória — F2-T01..F2-T40

- Manter a matriz integral do writing-plans com **dono da tarefa, nome de teste, comando, resultado e evidência** para os 40 IDs. Não marcar PASS quando existir somente teste de fake com nome semelhante ao teste de emulador.
- Cobertura mínima: hierarquia/alias/homônimos, IDs, principal único, import legado e JSON hostil, import repetido e diferente, preview stale, abort/quota em uma transação, duas abas reais, migração F1 preservada, tombstones e backup antigo, conflito/resolução, UID/perfis/consentimento, retry automático, oito temas e acessibilidade, PWA/offline, desempenho da carga máxima aceita.
- **F2-T22 (`Firebase Emulator`) permanece `NOT_RUN`**; não configurar, instalar, criar projeto ou executar emulador. Cenários de múltiplos dispositivos F2-T16/T36 com fake são **SIMULATED**, e **não** comprovam Google Sign-In/Firestore/Rules. Os 4 riscos HIGH F0 continuam `UNVERIFIED`, salvo evidência posterior aprovada em F7. Os 107 FAIL E2E da V1 permanecem baseline histórico.
- Registre desempenho/limite de importação efetivamente testados no Chromium/browser local; nunca usar cota diária Firestore como comprovada apenas por estimativa. Se limite proposto for inseguro, reduzir o máximo admitido, testar rejection clara e reportar a limitação — **não** escolher staging novo por conta própria.
- Revisar UX A-01 com Impeccable quando disponível, screenshots sintéticos em 8 temas × desktop/tablet/mobile e teclado/touch; se ferramenta não estiver disponível, registrar NOT_RUN e revisar acessibilidade com os testes existentes, sem alegar detector 0 se não rodou.

## 5. Integração autorizada e limites absolutos

1. **Apenas `v2`:** trabalhar diretamente na `v2` se seguro; usar branch/worktree temporário somente para isolamento necessário e reconciliar/encerrar sem perder commits. Não abrir PR salvo proteção ou pedido. Nada de alterar `main`, root `src/**`, `firestore.rules`, `.github/workflows/**`, raiz `package*.json`, V1/service-worker/dados reais, Cloudflare ou domínio de produção.
2. A implementação pode modificar **somente** `apps/v2/**` e documentação existente relacionada F2 (`docs/superpowers/specs/...f2...`, `docs/superpowers/plans/...f2...`, `docs/superpowers/audits/...f2...`, roadmap, handoff, issue #108), com cuidado com as provas históricas da F1. Não criar relatórios redundantes, CI/CD ou scripts transitórios persistentes.
3. Depois de testes e revisão, conferir o diff completo contra `origin/v2` e contra as fronteiras V1; verificar que push em `v2` **não dispara publicação**. Se gatilho de deploy ou regra de proteção impedir push seguro, manter commit(s) locais sem perda e informar exatamente como resolver. Se seguro, enviar somente `v2` a `origin/v2` e confirmar SHA por read-back. **Não fazer merge para `main`.**
4. Higiene Git: inventariar duas branches documentais antigas, PRs, worktrees, stashes e commits exclusivos; identificar duplicados/integrados; **não excluir** nada sem comprovação + autorização. Não fazer `reset --hard`, force push, deleção de commits ou fechamento de PR contendo trabalho único.
5. F2 implementada e integrada a `v2` não é F2 aprovada, publicada ou homologada. Marcar `F2_READY_FOR_HUMAN_REVIEW` apenas com evidência substancial. Se algo crítico ficar sem teste/integração, status `F2_BLOCKED` com bloqueio exato.

## 6. Pacote final de evidências para revisão do ChatGPT

Entregue **um pacote compacto, fiel e revisável**, sem arquivos redundantes, de preferência `docs/superpowers/audits/2026-10-28-v2-f2-acceptance.md` + diretório de evidências já existente e um arquivo ZIP/export sob `release/` ou pasta temporária **fora do Git** se for preciso transferir logs/capturas. Inclua:

- **Resumo executivo:** seis capacidades entregues e demonstradas; exclusões e restrições.
- **Inventário de código:** arquivos/commits/SHAs, dados/schemas/indices, migração F1, UI, fixes pós-revisão.
- **Tabela F2-T01..T40:** PASS/FAIL/BLOCKED/INCONCLUSIVE/NOT_RUN/SIMULATED + comando, ambiente, hash/log/evidência; T22 explicitamente NOT_RUN.
- **Logs:** typecheck, lint, build, Vitest, Playwright (número PASS/FAIL), erros de quota/abort e duas abas, backup/import retry, resultados Impeccable e screenshots; origem/porta do teste e dados exclusivamente sintéticos.
- **Auditoria A-02:** uma outbox, imutabilidade dos comandos, perfil/UID/biblioteca, consentimento, retry, conflito/read-back, tombstone/epoch, limite de doc e custo sintético com premissas.
- **Revisões:** reviewer initial P0/P1/P2/P3, correções, testes RED→GREEN, reviewer final; limitações se não houve revisão independente.
- **Riscos:** quatro HIGH `UNVERIFIED`, firebase/Rules/quotas/multidispositivo real `NOT_RUN`, 107 FAIL E2E V1 histórico; fragilidades não resolvidas e proposta de próximo GOAL corretivo, se cabível.
- **Higiene:** `main`/`origin/main` antes/depois; `v2`/`origin/v2` antes/depois; árvore de trabalho, branches/worktrees/PRs restantes e seus commits exclusivos; prova de ausência de deploy/Actions novas, local vs remoto, bloqueios, issue #108 atualizada.
- **Próxima ação humana:** entregar links/caminhos dos documentos, commit(s) e pacote de evidências para o proprietário encaminhar ao ChatGPT. **Parar no gate humano; não iniciar F3.**

## 7. Condições únicas de STOP

Interrompa o trecho afetado e reporte **sem destruir trabalho** somente se: (a) spec/plano aprovado indisponível ou divergente de modo material; (b) mudança arquitetural indispensável não prevista; (c) risco de perda de dados V1/F1 ou worktree com commits exclusivos não conciliáveis; (d) necessidade de instalar/executar Firebase, autenticar conta real, acessar dados pessoais, serviço cloud, pagamento, deploy, `main` ou purge físico; (e) falha material que não possa ser corrigida dentro dos contratos aceitos; (f) gate de proteção exige aprovação ou publicação involuntária. Rotinas de TDD, refatoração local pequena, revisão e correção dentro da spec **já estão autorizadas pelo GOAL** e não exigem perguntas repetidas.

**Resultado esperado:** F2 totalmente implementada no escopo local-first, revisada, testada, integrada à `v2` se seguro e formalmente **`F2_READY_FOR_HUMAN_REVIEW`**, com pacote de evidências para a auditoria do ChatGPT. A decisão de **aceitar F2** permanece exclusivamente humana.
