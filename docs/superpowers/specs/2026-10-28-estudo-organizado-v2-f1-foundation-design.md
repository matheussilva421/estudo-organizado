# Estudo Organizado V2 — F1 Fundação Técnica e Primeira Fatia Vertical

**Data:** 2026-10-28  
**Status:** **ESPECIFICAÇÃO FORMAL F1 APROVADA PELO USUÁRIO EM 2026-10-28** — [referência humana](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470639550). **G2/F1 writing-plans em elaboração; implementação F1 NÃO autorizada.**  
**Branch alvo futura:** `v2`; **`main` = V1 em produção, intocada.**  
**Predecessora:** F0 — auditoria aceita com ressalvas em [registro humano #108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470404279).  
**Arquitetura aprovada:** [spec mestra D01–D27 + A-01 + A-02](2026-10-19-estudo-organizado-v2-design.md).  
**Decisões técnicas ratificadas junto com esta spec:** [ADR-F1-01 a 05](2026-10-28-v2-f1-architecture-decisions.md), com implementação de detalhes físicos dependente de avaliações e testes futuros.  
**Contrato base de integração:** [A-02 — pré-contratos de sincronização](2026-10-28-v2-multidevice-sync-f1-contracts.md).  
**Próximo gate:** produzir e revisar **writing-plans F1** (G2) somente como documentação. **Nenhum código, instalação, teste, merge para main ou deploy autorizado por esta aprovação.**

## 1. Problema, intenção e resultado observável

A V1 é um app Vanilla JS/PWA que continua sendo usado. A F0 levantou 46 funcionalidades, 37 registros de esquemas, quatro riscos HIGH de dados/sync, inconsistências de documentação e baseline E2E com 107 falhas no mock. Implementar de uma vez a V2 sem verificar persistência, isolamento e fronteiras de domínio repetiria fragilidades.

A F1 deve entregar, **após futura autorização**, uma aplicação React + TypeScript + Vite **mínima e genuinamente funcional**, em ambiente isolado, demonstrando uma pequena jornada completa: inserir/renomear/consultar uma **disciplina de estudo** local, reiniciar/reabrir e encontrar o registro intacto. A disciplina é uma capacidade já identificada da V1; relacionamento completo com editais e outras funções pertence à F2.

O núcleo deve provar as bases de **integridade local, contratos versionados, outbox, independência de plataforma, UI acessível e primeira rodada de QA Impeccable**, preparando a futura sincronização multi-dispositivo sem realizar transações contra produção.

**Ponto de parada F1:** primeira fatia local comprovada com portas de sincronização testadas via stubs/fakes/emuladores sintéticos, sem afirmar que Google login e Firestore em dispositivos reais já estejam homologados.

## 2. Escopo estrito, exclusões e antiobjetivos

### IN para F1 (proposto)
- Isolar código V2 na própria branch `v2` sob diretório independente sugerido `apps/v2/` (**a raiz ainda não tem `apps/` no preflight**); preservar `src/` da V1, root scripts, regras, secrets e deploy.
- Preparar React + TypeScript + Vite e PWA mínima, sem usar a origem de produção nem Service Worker da V1.
- Criar monólito modular por domínios e regras independentes de React, com portas para repositório local, relógio, identidade, backup e sync.
- Implementar domínio mínimo de disciplina com ID estável, nome obrigatório, registro de revisão e criar/listar/renomear; sem extrapolar para edições completas de edital.
- IndexedDB exclusivo, commit transacional de dados + outbox, consultas locais, recuperação de reload e erro de quota sem falso sucesso.
- Versionamento independente do estado V2, esquema IDB, formato de backup e protocolo de sync.
- Registrar a forma e o comportamento dos contratos A-02: estados de sync, operação idempotente, ACK, conflitos, isolamento de UID, tombstones, cursor/rebaseline e limites remotos.
- Validar alternativas de layout/limites Firestore **sem acesso à produção** e com orçamento sintético de 1–3 dispositivos; contratos e testes negativos obrigatórios, implementação remota real somente mediante spec/plano de fatia apropriada.
- Primeiros tokens e componentes de UI com Impeccable, baselines visuais para 8 temas e viewports.
- Testes locais TDD e uma triagem **delimitada** do harness E2E V1 usando evidência F0, sem consertar V1.

### OUT para F1
- Reimplementação de planejamento/ciclo/reta final, cronômetro, sessões, revisões, dashboards ou importador completo de edital (F2–F6).
- Transferência ou sincronização **de dados reais** V1; Firebase/Cloudflare/Google Drive de produção; configurar login Google em projetos reais sem autorização separada.
- Login obrigatório para uso local. A autenticação Google real e sincronização entre dispositivos serão qualificadas posteriormente em ambiente isolado, especialmente F7.
- Criar Cloud Functions, backend extra, serviço pago, faturamento, CI/CD ou GitHub Actions.
- Corrigir a V1 por efeito colateral, alterar `src/` ou `firestore.rules` da V1, ativar deploy V2 ou integrar `v2` à `main`.
- Laboratório visual de layout: seu **adiamento foi aprovado**; destino permanece `UNDECIDED`, explicitamente fora da F1.

**Antiobjetivos:** base genérica gigante sem fluxo real; copiar estado global e sync monolítico V1; múltiplas filas autoritativas; falsas confirmações de gravação; resolver erros com último timestamp; complexidade para atender serviços pagos.

## 3. Fontes, premissas e decisões a ratificar

**Fontes primárias:** [aceite F0](../audits/2026-10-19-f0-acceptance.md), [inventário funcional](../audits/2026-10-19-v1-feature-inventory.json) e [matriz de esquemas](../audits/2026-10-19-v1-schema-matrix.json), [riscos](../audits/2026-10-19-v1-risk-matrix.json), [baseline QA](../audits/2026-10-19-v1-qa-baseline.json), [relatório Impeccable](../audits/2026-10-19-v1-design-baseline.md), [contratos A-02](2026-10-28-v2-multidevice-sync-f1-contracts.md).

**Decisões prévias já aprovadas:** React/TS/Vite; monólito modular; local-first IndexedDB; Google Sign-In/Firebase Authentication + Firestore Spark gratuito; sync automático após primeira ativação consentida, enquanto o app pode executar; dados sem perda silenciosa; A-01 Impeccable; homologação progressiva com aprovação humana.

**Escolhas técnicas que esta spec propõe, não declara aprovadas de antemão:** `apps/v2/` como limite físico; criar/listar/renomear disciplina como primeira fatia vertical; estrutura por entidade/agregado remoto delimitado; Web Locks + idempotência/CAS; especificação independente de backup e tombstones; importador read-only de legado. Alternativas e trade-offs estão nos ADRs vinculados.

Se o pacote da fase exigir decisão arquitetural não abrangida pelos ADRs, **STOP e nova aprovação**. Escolhas rotineiras de biblioteca/componentes permanecem para o writing-plans após a aprovação desta spec.

## 4. Arquitetura modular proposta e fronteira V1

    apps/v2/  (aplicação e build independentes da V1)
      presentation/  -> application/  -> domain/ports
                            |                ^
                            v                |
                       adapters/            |
                indexeddb, clock, ids, sync (fake/emulator), backup

A árvore física definitiva pode ser refinada no plano sem criar monorepo. Domínio **não** depende de React, Firebase, IndexedDB ou browser. Aplicação coordena comandos/consultas, validação e transações. Adaptadores implementam portas; UI apenas envia comandos e observa projeções; testes de importação arquitetural proíbem circularidade e acesso direto da apresentação ao banco.

`src/` permanece a V1 intacta. `apps/v2/` deve usar sua própria configuração de app, build, SW, manifest, base URL, origin e armazenamento, sem ser incluído automaticamente em comandos `wrangler deploy` existentes. Não alterar automaticamente root `package.json` nem lockfile V1 para fazer scaffolding; plano aprovado tratará configuração restrita da V2.

**Origem isolada:** portas distintas de `localhost` geram origens diferentes; não usar o mesmo host/origin de produção mesmo com outra rota se puder compartilhar IndexedDB/SW. Testar simultaneamente V1 mock e V2 local e verificar nomes de DB, SW scope e storage.

`AGENTS.md` da raiz descreve padrões Vanilla para **V1**. Para a F1, normas de React/TS devem ficar no escopo da V2/planos; não adulterar as convenções do legado. No início de cada execução futura: inventário local/remote de `main`, `v2`, worktrees, branches e PRs; status de build; commits não integrados; nenhuma limpeza destrutiva sem autorização.

## 5. Entidade mínima e comandos demonstráveis

**Disciplina inicial (proposta):** `StudySubject` com `id` opaco estável, `title` validado/normalizado na entrada, escopo de `profileId`, versão/revisão e metadados temporais explícitos. Relações com edital, categorização, exclusão/arquivo e importação de conteúdo ficam para F2; não assumir que o nome é ID nem impor globalmente unicidade por título sem evidência do domínio.

**Casos de uso:** criar disciplina; listar disciplinas do perfil local; renomear disciplina existente; consultar por ID. Criar novamente após retry com o mesmo `operationId` não duplica registro; referências a perfil errado não aparecem. Os comandos retornam resultado tipado de sucesso **somente após commit IDB**. Falha de validação/quota é explícita e deixa estado canônico anterior preservado.

**Estados de UX:** vazio, lista com dados, edição pendente, commit confirmado, erro de persistência, offline e preferências de sync desabilitadas. Sem login necessário para essas operações. `updatedAt` não é token causal e não decide vencedor de conflito.

**Não extrapolar** esta disciplina inicial para uma entidade final de edital. A F2 integrará relações canônicas com base na F0.

## 6. Persistência local, atomicidade e recuperação

- IndexedDB V2 com stores/índices mínimos para entidade, perfil, metadados de versão e outbox. Caches derivados separados. Versão V2 própria; compatibilidade legacy somente por futura importação com manifest.
- Transação atômica garante `entidade atualizada + intenção de sync`; quando sync desativado, registrar metadados consistentes sem produzir fila órfã nem forçar login. A estratégia precisa evitar criar operações remotas com UID inexistente, mas preservar capacidade de vínculo posterior.
- Falha IDB/`QuotaExceededError`: não mostrar sucesso; preservar conteúdo editado ainda não confirmado de modo explícito para recuperação assistida (sem prometer persistência se quota insuficiente).
- Reload e múltiplas abas: ler estado canônico, invalidar caches e não aplicar transições concorrentes sem revisão/coordenação. Sem supor que `setInterval` ou Service Worker se manterão ativos em segundo plano.
- Não apagar automaticamente registros essenciais, histórico, operações pendentes e tombstones para liberar espaço. Solicitação de armazenamento persistente quando possível, com limites explicados.

**Aceite:** três cenários sintéticos: criação/reload, crash entre dados e fila (nenhum commit parcial) e quota cheia (nenhum falso ACK). Múltiplas abas não duplicam comando com mesmo ID.

## 7. Identidade Google e contratos da A-02

A F1 define interfaces, invariantes e testes de contrato para:
- Modo `LOCAL_ONLY` sem conta. Primeira ativação remota exige Google Sign-In e **prévia/consentimento de vínculo** entre perfil e UID; nunca associar duas contas silenciosamente.
- Depois da ativação, sync **automático enquanto o app pode executar**. Manual é opção de diagnóstico; app fechado/offline não promete atualização de outros dispositivos.
- Separar estados `LOCAL_COMMITTED`, `REMOTE_COMMITTED` e `CONVERGED`; divergência de contas, cota ou origem gera `PAUSED_AUTH`, `PAUSED_QUOTA` ou `RECOVERY_REQUIRED` e informação visível.
- Um coordenador de outbox e uma fonte de operações. Evitar escrita concorrente do buffer offline padrão do SDK para os mesmos registros; fakes/emulador em F1, Firestore real apenas em ambiente isolado e com gate futuro.
- `operationId` imutável + `baseRevision`, CAS/transação remota, ACK condicionado e replay idempotente; não usar timestamp como decisão de vencedor.
- Coordenação interabas segura, com Web Locks e fallback verificável ou suspensão de flush. `BroadcastChannel` apenas notifica.
- Cursor incremental/rebaseline, consultas paginadas, documentos por entidade/agregado com tamanho limitado, sem snapshot monolítico; medir estimativas de operações para 1/2/3 dispositivos e cota Spark sem faturamento.
- Conflito material preserva ambos os lados; operações independentes convergem automaticamente. Tombstones e retenção causal impedem ressurreição; clientes antigos precisam rebaseline.

**Limite F1:** o contrato deve ser demonstrado por testes determinísticos com mocks e, se adotado no plano aprovado, emulador local. **Não exigir Firebase remoto produtivo nem homologar real multi-dispositivo nesta fase.** A F7 mantém o gate integrado para Google Auth, Firestore Rules, read-back, quota e PC→mobile→tablet.

## 8. Backup, legados e dados de exclusão

**Contrato F1:** exportação do domínio mínimo com formato próprio versionado, manifesto de integridade, prévia de restauração e exclusão de credenciais; não precisa construir UI completa de import/export. Regras de preservação de tombstones definidas antes de ativar sync. Se snapshot antigo não contém histórico de exclusão suficiente, só rebaseline/preview, nunca overwrite remoto automático.

**Importação V1:** F1 inventaria e especifica transformadores para as variantes encontradas (schema 12/11/9/7, DB 7/6, backup antigo); pequenos testes sintéticos de reconhecimento de formato são permitidos após plano, mas nenhuma importação de acervo real, modificação da origem ou migração de produção. O caso #107 exige comparação semântica de planos legados (180 blocos equivalentes vs divergentes) antes de assumir ausência ou realizar escrita.

**Separação:** sync mantém convergência; backup externo mantém recuperação independente. Nem Firebase nem restore de dados antigos podem produzir perda silenciosa.

## 9. Design System, UX e Impeccable (A-01)

Baseline obrigatório: `PRODUCT.md`, `DESIGN.md`, `.impeccable/`, 8 temas (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex, Plasma), steel-blue, Plus Jakarta Sans + DM Mono, densidade útil e linguagem objetiva.

**F1 não redesenha toda a V1.** Primeiro passo é definição de tokens tipográficos, cores, superfícies, botões, formulário de disciplina e estados vazio/erro/sync. Revisão Impeccable em concepção e QA, sem init/hook mutante ou cópia destrutiva de arquivos V1 sem gate específico.

Critérios de visualização: layout mínimo desktop/tablet/mobile; foco e teclado; área de toque em coarse, reduced motion; contraste WCAG AA em todos os oito temas, incluindo estados; nenhum toast bloqueia ação primária. O P1 de toasts empilhados encontrado na F0 vira teste de regressão do componente novo, **não** autorização para alterar a V1. Detector estático não substitui Playwright/accessibility e revisão independente.

## 10. Segurança, privacidade e custo

- Firebase Authentication + Google Sign-In como única identidade remota aprovada; **não usar tokens reais na F1**, salvo eventual autorização explícita de ambiente de homologação futuro. Sem mistura de UID, sem dados reais nos testes e sem logs com credenciais.
- Dados importados e nomes de disciplina exibidos como texto seguro, sem HTML executável. CSP e validação de entradas são verificáveis localmente.
- Firestore Security Rules por UID e operações restritas são definidos como contrato e, quando apropriado, ensaiados no emulator; `firestore.rules` da V1 **não** é alterado.
- Custo obrigatório R$ 0: nenhum billing, Cloud Functions, serviço pago, GitHub Actions ou pipeline novo. O plano subsequente tem de comparar padrões de leitura/write/listeners e impedir custo incompatível com Spark.
- Diagnósticos limitados, sanitizados e exportáveis; estados de falha são transparentes.

## 11. QA local e regressão: baseline V1 ≠ conformidade V2

**Evidência da F0:** 66 testes dos validadores PASS; 3048 unitários PASS; lint 0 erros/3075 warnings; 45 testes de contraste PASS; Impeccable executado; `npm run test:e2e:mock` FAIL por seleção de testes; `npm run test:e2e:mock:all` 59 PASS/107 FAIL em 166 casos. Acessibilidade completa, migração real, emulador/rules e sincronização real são NOT_RUN/INCONCLUSIVE.

A F1 deve manter essas falhas registradas e **triar de forma limitada o harness mock**: seleção ignorada, seed sintético divergente e SW offline como classes de causas; sem transformar `107 FAIL` em bugs V2, sem correções na V1 e sem declarar causa de todos os casos. Criar suíte E2E **própria da V2**, com seed determinístico, origem V2, sem SW compartilhado.

### Matriz de teste e condições de aprovação F1

| Requisito | Teste mínimo exigido na execução futura | Estado atual |
| --- | --- | --- |
| Isolamento V1/V2 | origens/IDB/SW diferentes; `src/` V1 sem alterações | NÃO EXECUTADO |
| Disciplina local | criar, listar, renomear, reload, duplicidade de operação | NÃO EXECUTADO |
| Atomicidade | falha no meio da transação não salva metade | NÃO EXECUTADO |
| Quota | rejeição + mensagem; sem sucesso falso | NÃO EXECUTADO |
| Outbox | replay, timeout pós-commit, ACK, crash e dupla aba sintéticos | NÃO EXECUTADO |
| Auth/UID | perfis sintéticos; troca de identidade não mistura acervos | NÃO EXECUTADO |
| Conflitos | concurrent edit e delete vs edit preservam alternativas | NÃO EXECUTADO |
| Payload | estrutura candidata rejeita >1 MiB sem truncar estudo | NÃO EXECUTADO |
| Legado #107 | equivalência/ambiguidade sintética, sem write destrutivo | NÃO EXECUTADO |
| Backup/tombstones | delete→export→restore→merge sem ressurreição | NÃO EXECUTADO |
| Impeccable | 8 temas x desktop/tablet/mobile, teclado, AA, toasts | NÃO EXECUTADO |
| E2E V2 | jornada mínima e reload/offline em mock isolado | NÃO EXECUTADO |
| Spark grátis | estimativa de leituras/escritas/indexação e margem; nunca billing | NÃO AFERIDO |
| Revisão | evidências por teste, revisão independente e gate humano | PENDENTE |

**Riscos HIGH que ficam abertos (`UNVERIFIED`) após a escrita desta spec:** `R-V1-LEGACY-REMOTE-PLAN`, `R-V1-FIRESTORE-DOCUMENT-1MIB`, `R-V1-MULTITAB-OUTBOX-RACE` e `R-V1-BACKUP-TOMBSTONE-LOSS`. Mesmo após testes de contrato F1, só reclassificar por evidência e homologação do escopo pertinente (F7 quando exigir emulador ou ambiente remoto isolado).

**Critérios de parada:** falha material, importações arquiteturais proibidas, dados corrompidos, isolamento incompleto, plano que implique billing, servidor pago ou conflito com V1. Não mascarar NOT_RUN/FAIL. Diagnóstico de causa raiz e tentativas limitadas; revisão humana se precisar nova decisão.

## 12. Critérios de aceite da F1 como entrega (não como autorização atual)

1. Aplicação V2 independente criada no diretório próprio, iniciável em origem distinta; V1 e `main` não alteradas nem publicadas pela F1.
2. Uma jornada real local de disciplina concluída com tipagem, invariantes, persistência atomicamente validada, reload/offline e estados de erro.
3. Módulos isolados com testes automáticos de fronteiras e contratos; sem store global ou código React no domínio.
4. Esquema/versões V2 separados; compatibilidade legada apenas por adaptadores explicitamente testados, sem efeitos colaterais.
5. Outbox idempotente e sem sucesso falso testada com falhas sintéticas; segurança de identidade/UID modelada.
6. ADRs-F1 ratificadas com resultados de avaliações exigidas, especificações de persistência/sync/backup e riscos ainda corretamente classificados.
7. Design inicial Impeccable, oito temas, responsividade e acessibilidade verificadas na amostra planejada.
8. Testes Vitest/integração/E2E V2 executados com logs e ambiente registrado; 107 falhas E2E da V1 mantidas em triagem, sem obrigação de corrigir V1.
9. Commit(s) e revisão na `v2` conforme autorização, sem PR proliferado, nenhuma Action nova e nenhum deploy.
10. Aprovação humana específica de encerramento da F1, incluindo inventário Git e relatório de evidências; **não** inicia F2 automaticamente.

## 13. Gates, dependências e próximos passos

**F0:** auditoria **aceita com ressalvas** em 2026-10-28; 35 `PRESERVE`, 10 `REFORMULATE` ratificados como diretrizes; laboratório visual `UNDECIDED` com postergação aprovada e excluído da F1. Quatro HIGH `UNVERIFIED`; E2E V1 107 FAIL mantidos.

**F1/G1 local:** este documento e [ADR-F1-01..05](2026-10-28-v2-f1-architecture-decisions.md) foram **APROVADOS EM 2026-10-28** ([aceite](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470639550)). Essa aprovação autoriza somente writing-plans F1; **sem escrita de código**.

**F1/G2:** **autorizada a elaboração e publicação** do Superpowers writing-plans para revisão humana. O plano publicado é **PROPOSTO**, não aprovado; sua redação não autoriza execução.

**F1/G3:** aprovação específica do plano, método e autorização de execução antes de qualquer instalação, scaffold, alterações em repo/code ou uso de emuladores. Respeitar isolamento, worktrees e regras de `AGENTS.md`.

**F1/G4:** homologação do escopo da fase com evidências reais e revisão independente; F7 mantém homologação integrada multi-dispositivo. F8/G5 (cutover) continua bloqueada.

**Pendências técnicas que o plano precisa explicitar depois da aprovação:** biblioteca/router concreta, árvore exata de módulos, versão de dependências, contratos finais de IndexedDB e Firebase, escolha de fallback de Web Locks, orçamento de payload/indexação Spark, estratégia de isolamento de serviço worker e forma de testes browser. Essas são decisões implementacionais derivadas das ADRs; escolhas que mudem os princípios exigem novo gate humano.

## 14. Alternativas e justificativa

- **Migração dentro da V1 vs aplicativo separado:** separado, conforme D01/D11 e ADR-F1-01, porque evita alterar produção.
- **Snapshot monolítico vs entidades/agregados limitados:** contratos por entidade/agregado (A-02, ADR-F1-02), porque o snapshot V1 falhou em >1 MiB e amplia conflito.
- **Sync manual vs automático após ativação:** A-02 escolheu automático quando ativo, mantendo o modo local sem conta e opção de pausa.
- **Primeira implementação genérica vs fatia mínima de disciplina:** fatia mínima, pois exercita os contratos essenciais com um fluxo já existente no inventário e sem implementar F2 inteira.
- **UI redesenhada integralmente na F1 vs base de design system:** tokens e fluxo mínimo com Impeccable agora; UX completa é F6 e exige gate próprio.
- **Resolver 107 falhas da V1 vs harness V2 determinístico e triagem focada:** F1 usa testes próprios e preserva as falhas legadas para estudo sem mexer no produto em funcionamento.

**Registro de aprovação humana:** desenho da fundação F1 e ADR-F1-01..05 **ratificados** em 2026-10-28 ([comentário #108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470639550)); próximo passo é revisar o writing-plans F1. **Ainda não há autorização de execução.**
