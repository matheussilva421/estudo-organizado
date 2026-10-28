# Relatório de aceitação F1 — Estudo Organizado V2

**Data:** 2026-10-28 (America/Fortaleza)
**Branch:** `v2`
**Base inicial:** `b15226d` (após G2/F1)
**Gate:** `F1_READY_FOR_HUMAN_REVIEW` — não aprovado automaticamente
**Escopo:** fundação React/TS/Vite e primeira fatia vertical de disciplinas, apenas em `apps/v2/`.

## 1. Preflight e autorização

- `main` e `origin/main`: `9046cfa`, intocadas durante toda a execução.
- `v2` local e `origin/v2` no início da rodada corretiva: `abd04d3`, árvore limpa, sem stashes.
- Único worktree adicional: o da V2; nenhum PR aberto.
- G1/F1 confirmado no comentário `6470639550`; G2/F1 confirmado em `6470870847`; ambos do proprietário.
- Nenhum login, escrita ou leitura em Firebase, Cloudflare ou Google Drive reais.
- Servidor da V2: `127.0.0.1:18431`; IndexedDB `estudo-organizado-v2`; Service Worker com escopo `/` nessa origem.

## 2. O que foi implementado

Aplicação isolada em `apps/v2/` com React, TypeScript strict, Vite, Vitest, Playwright e PWA própria. O código está separado em domínio puro, aplicação, adapters de plataforma e apresentação:

| Área | Arquivos principais | Evidência |
| --- | --- | --- |
| Domínio | `src/domain/subject.ts`, `versions.ts` | criação, rename, revisão e erros tipados |
| Persistência | `src/platform/indexeddb.ts`, `local-subject-repository.ts` | entidade + operação + outbox na mesma transação |
| Recuperação local | `local-events.ts`, erros `QUOTA`/`ABORT` | notificação só após commit; rollback em falha |
| Contratos A-02 | `sync-types.ts`, `sync-policy.ts`, `fake-remote.ts`, `flush.ts`, `coordination.ts` | consentimento, CAS, read-back, conflitos, Web Locks |
| Limites/custo | `document-budget.ts` | margem de 900 KB e premissas para 1–3 dispositivos |
| Backup/legado | `backup/format.ts`, `backup/restore.ts`, `legacy/recognize.ts` | manifesto/checksum/tombstones e fixtures #107 |
| UI | `presentation/App.tsx`, `components/*`, `tokens.css`, `styles.css` | criar/listar/renomear, estados e 8 temas |
| PWA | `public/manifest.webmanifest`, `public/sw.js`, `sw-update.ts` | cache isolado e atualização sem reload automático |

O root `package.json`, o lockfile da V1, `src/`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, `.impeccable/`, `firestore.rules` e `.github/workflows/` não foram alterados. Fora de `apps/v2/`, mudaram apenas a exceção `!/apps/v2/**` no `.gitignore` raiz (o repositório usa allowlist e ignorava todo `apps/`), este relatório, o roadmap e o handoff; nenhuma dessas mudanças afeta runtime, build ou deploy da V1.

## 3. Status reais

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Typecheck | `npm --prefix apps/v2 run typecheck` | **PASS** |
| Lint | `npm --prefix apps/v2 run lint` | **PASS** (0 erros) |
| Unit | `npm --prefix apps/v2 run test:unit` | **PASS** — 15 arquivos, 84 testes |
| E2E | `npm --prefix apps/v2 run test:e2e` | **PASS** — 20 testes em Chromium |
| Build | `npm --prefix apps/v2 run build` | **PASS** — bundle 231,55 kB / 72,62 kB gzip |
| Firebase/Google real | — | **NOT_RUN** |
| Firestore Emulator/Rules | — | **NOT_RUN** |
| Quota física real | — | **NOT_RUN**; quota é simulada |
| Multi-dispositivo real | — | **NOT_RUN** |
| Leitor de tela/zoom 200% | — | **NOT_RUN** |

Logs preservados em `docs/superpowers/audits/evidence/2026-10-28-v2-f1-*.txt`.

## 4. Contratos A-02 demonstrados

| Requisito | Evidência | Limite |
| --- | --- | --- |
| Operação idempotente | `remote-contract.test.ts` e `outbox-flush.test.ts`: replay retorna `ALREADY_APPLIED` | fake em memória |
| CAS por revisão | baseRevision divergente retorna `CONFLICT` sem write | fake, não Firestore |
| Timeout pós-commit | `TimeoutError` + `lookup APPLIED` + ACK idempotente | sem SDK real |
| ACK condicionado | `markConfirmed` rejeita operação ausente/futura | transação IDB real no navegador/fake-indexeddb |
| Conflito preservado | `markConflict` mantém payload local e revisão remota | UI completa de resolução fica para fase posterior |
| Duas abas | `withSafeFlushLock` com Web Locks; E2E real de duas abas processando uma operação | remoto compartilhado é fake em localStorage |
| Sem Web Locks | retorno `BLOCKED`, sem flush; BroadcastChannel não concede lock | fallback de lease/fencing não implementado |
| Perfil/UID | `RemoteScopeError` e `assertProfileMatches` | login Google real não executado |
| Orçamento | `validateRemoteDocument` rejeita >900 KB sem truncar | 1 MiB real/emulador não testado |
| Backup/tombstones | checksum, exclusão de tokens, `REBASELINE_REQUIRED` para backup velho | restauração completa não implementada |
| Legado #107 | 180 blocos equivalentes vs divergentes e schemas 7/9/11/12 | sem migração/read-back real |

Os estados `LOCAL_COMMITTED`, `REMOTE_COMMITTED` e `CONVERGED` são exibidos separadamente. A UI nunca chama o estado local de “sincronizado com a nuvem”; `CONVERGED` exige cursor verificado.

## 5. Impeccable e acessibilidade

- Impeccable 3.9.1 verificado; nenhum hook mutante ou init foi executado.
- Detector final: **0 achados** após alinhar `h1` a 28 px e o rótulo de seção a 13,5 px. A primeira passada tinha 2 advisories de tamanho fora do ramp.
- 24 capturas sintéticas (8 temas × 1440/834/390), sem erros de página.
- E2E confirma AA de texto/card nos 8 temas, foco visível por teclado, ausência de overflow em 3 viewports e ausência de toasts sobre a ação primária.
- Alvos de toque usam 44 px em `pointer: coarse`; `prefers-reduced-motion` está no CSS.
- Capturas preservadas com SHA-256:

| Arquivo | SHA-256 |
| --- | --- |
| `2026-10-28-v2-f1-desktop-grafite.png` | `E154E43F9D805A7894E304EE91BE772DDBCA3F220CBB1C294BA5ADF21CABBA54` |
| `2026-10-28-v2-f1-desktop-plasma.png` | `BEF530FEB2BAC4D263F93B7762CC083767D651DA4642A578C75DC63C5B7E8FA8` |
| `2026-10-28-v2-f1-tablet-ardosia.png` | `D56844924C8C355B166BFEEF622FA7CA3C8474E702460041F5062AF6802C8478` |
| `2026-10-28-v2-f1-mobile-grafite.png` | `FCACF9D7BE3B9B022DCD6AB9BABEB976AD74D9DCE5E441BADC28A33DBD08CCA6` |

## 6. Quatro riscos HIGH da F0

Todos continuam **UNVERIFIED**; os testes F1 são de contrato e não homologam serviços reais.

| Risco | Prova F1 | O que falta |
| --- | --- | --- |
| `R-V1-LEGACY-REMOTE-PLAN` | fixtures equivalentes/divergentes e schemas 7/9/11/12 | migração/read-back isolado |
| `R-V1-FIRESTORE-DOCUMENT-1MIB` | rejeição >900 KB sem truncamento | SDK/emulador e schema físico |
| `R-V1-MULTITAB-OUTBOX-RACE` | lock e teste de exclusão | duas abas reais + dispositivo F7 |
| `R-V1-BACKUP-TOMBSTONE-LOSS` | checksum/tombstones/rebaseline | restore completo e merge F7 |

## 7. Triagem dos 107 FAIL E2E da V1

A configuração da V1 continua apontando `test:e2e:mock` para uma spec ignorada pelo projeto `mock`; a suíte `mock:all` tinha 59 PASS e 107 FAIL na F0. A triagem desta F1 é amostral e somente leitura, sem correção da V1: valores de seed divergentes (tempo `61:02:00` vs `01:30:00`), contagens de grupos diferentes, controles ausentes, timeout de Service Worker e expectativas fixas incompatíveis com o mock. Não há causa raiz única comprovada para os 107.

## 8. Limitações e riscos residuais

- Fake remoto não prova Firestore, Rules, autenticação Google, índice ou custo real.
- Quota é simulada; não houve disco cheio real.
- Backup tem contrato e testes, mas não uma UI completa de restauração.
- Web Locks foram testados em duas abas reais do Chromium; dois dispositivos reais continuam fora da F1.
- O Service Worker é mínimo; atualização/rollback de versão incompatível exige F7.
- A CSP restritiva é aplicada no servidor de preview; o header de produção depende da hospedagem futura.
- O `.gitignore` raiz ganhou a exceção de allowlist para `apps/v2`.
- Um `eslint-disable` pontual documenta a hidratação inicial do IndexedDB; não silencia outras regras.

## 9. Git, integração e publicação

- `main`: `9046cfa`, não alterada.
- `v2` inicial: `b15226d`; os commits F1 desta execução estão em `git log b15226d..HEAD` e este relatório é o commit documental final.
- Todo o código está integrado à `v2`; `origin/v2` estava em `abd04d3` antes desta rodada corretiva e o HEAD final é informado no comentário da issue #108.
- O push foi concluído após aprovação humana explícita, sem force push e sem workaround do bloqueio automático anterior.
- Nenhum PR, Action, deploy, publicação ou migração real.
- Branches documentais antigas preservadas; nenhum worktree temporário criado além do já existente da V2.

**Implementado:** sim, em `apps/v2/`. **Testado:** sim, localmente. **Integrado à v2:** sim, por commits locais. **Publicado:** não.

## 10. Critérios de aceite da spec F1

| # | Critério | Situação |
| --- | --- | --- |
| 1 | App V2 independente e origem distinta | PASS |
| 2 | Jornada de disciplina com IDB/reload/erros | PASS local |
| 3 | Fronteiras e contratos testados | PASS |
| 4 | Versões V2 e legado read-only | PASS |
| 5 | Outbox idempotente, ACK e UID | PASS por fake |
| 6 | ADRs com avaliações e riscos corretos | PASS documental; 4 HIGH UNVERIFIED |
| 7 | Impeccable, 8 temas, responsivo e AA | PASS na amostra |
| 8 | Testes V2 e triagem V1 | PASS local; 107 FAIL preservados |
| 9 | Commits na v2, sem PR/Action/deploy | PASS |
| 10 | Aprovação humana específica | **PENDENTE** |

## 11. Correções após a revisão independente

A primeira revisão final encontrou cinco P1. Todos foram corrigidos com testes novos:

1. `recognizeLegacyFormat` agora reconhece `retaFinal` de topo e rejeita `planejamento` vazio.
2. `lookup`/`lookupRevision` do fake validam UID ativo; payload com perfil estrangeiro é rejeitado.
3. ACK sem revisão comprovada permanece pendente; não há mais revisão inferida por `baseRevision + 1`.
4. `FlushResult.conflictRevisions` preserva a revisão remota real usada por `markConflict`.
5. `CONSENT_LINK` exige `previewId` e não troca UID existente sem logout; `assertProfileMatches` também compara UID.

Também foram endurecidos: `markConfirmed` exige `PENDING`, `markConflict` recusa `CONFIRMED`, operação local reutilizada com outro comando falha, listener de evento não transforma commit em erro, fake aplica o orçamento de documento, o SW só cacheia respostas OK e o teste de toast verifica o elemento no ponto central do botão.

Após as correções: typecheck/lint/build PASS, 77 testes unitários e 16 E2E PASS.

### Rodada corretiva final (C1–C5)

| Correção | Resultado verificável |
| --- | --- |
| C1 convergência | operação pendente impede `CONVERGED` mesmo com cursor verificado |
| C2 conflito/ACK | `markConflict` lê o registro persistido na transação; objeto defasado não rebaixa `CONFIRMED` |
| C3 consentimento | prévia vinculada a perfil, UID, contagem, emissão e expiração; ID arbitrário ou de outra identidade é rejeitado |
| C4 idempotência | mesmo `operationId` com título divergente falha; replay exato devolve a mesma entidade/revisão |
| C5 backup | histórico completo sem tombstones é `SAFE`; histórico incompleto/antigo exige `REBASELINE_REQUIRED` |

Os quatro cenários browser obrigatórios também passaram:

- `two_real_tabs_share_one_flush_lock`: duas abas Chromium disputam a mesma operação; apenas um efeito lógico, com Web Locks.
- `real_indexeddb_abort_rolls_back_entity_and_outbox`: abort real no IndexedDB deixa `subjects=0`, `outbox=0`, `operations=0`.
- `quota_failure_keeps_form_open_and_preserves_text`: falha de quota mostra erro correto, mantém o formulário e o texto.
- `reload_and_retry_after_confirmed_operation_do_not_duplicate`: reload e replay de operação confirmada mantêm uma única disciplina/revisão.

Impeccable não foi reexecutado nesta rodada porque não houve alteração visual; a última evidência visual continua válida. Verificação final: typecheck/lint/build PASS, **84 testes unitários** e **20 E2E** PASS.

## 12. Gate

**`F1_READY_FOR_HUMAN_REVIEW`**. A F1 não está aprovada e a F2 não está autorizada. O aceite humano deve considerar: 84 testes unitários, 20 E2E, typecheck/lint/build, 4 riscos HIGH ainda UNVERIFIED, ausência de Firebase real e os limites de fake/quota/multi-dispositivo.
