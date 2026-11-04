# Estudo Organizado V2 — F7: Especificação formal proposta

**Versão:** 1.0 · **Data:** 04/11/2026  
**Estado:** `F7_SPEC_PROPOSED_NOT_APPROVED`  
**Repositório:** `matheussilva421/estudo-organizado`  
**Baseline remoto verificado:** `origin/v2` em `53553f291678f943bb6d96a0de56a511d4d5c369`; `origin/main` (V1) em `9046cfa2283cd293b38df9d52fabfcd5de9ac67c`; zero PRs abertos.  
**Natureza:** documento de especificação para aprovação, não autorização de implementação, uso de serviços externos, deploy, migração, alteração em GitHub ou faturamento.

## 1. Objetivo e definição de sucesso

Entregar uma **V2 integralmente funcional**, com os módulos acadêmicos F1–F6 integrados à sincronização confiável, autenticação, backup e restauração, migração compatível, PWA offline e proteção dos dados. Após implementação e testes, disponibilizar um **ambiente de avaliação independente**, com URL própria, para o proprietário usar a V2 no computador, celular e tablet **antes de decidir se a V1 deve ser substituída**.

O produto é **pessoal**, simples, **local-first** e deve operar com **custo obrigatório de R$ 0**. A V1 permanece em produção, e a `main` não é alterada na F7. A V2 poderá ser utilizada localmente sem conta Google; a sincronização remota só será ativada com login e consentimento. Não há promessa de sincronização com o app fechado nem de armazenamento local indestrutível.

**Sucesso de F7:** a V2 está implementada, testada e verificada nas jornadas essenciais, com ambiente de teste isolado efetivamente acessível, evidências e pendências transparentes, pronta para **avaliação humana**. **F7 não é F8/cutover**, e sua aprovação não autoriza migração real, publicação substitutiva nem aposentadoria da V1.

## 2. Rastreabilidade das 17 decisões aprovadas

| Decisão | Opção | Regra |
|---|---|---|
| D-F7-01 | B | Primeiro emulador Firebase e dados sintéticos; serviços reais apenas isolados, após gate. |
| D-F7-02 | B | Vínculo `profileId`/Google `uid`/`remoteLibraryId` explícito e consentido. |
| D-F7-03 | B | Documentos versionados pequenos e IDs estáveis, sem snapshot global. |
| D-F7-04 | B | Mesclagem somente de alterações independentes; conflitos incompatíveis persistidos. |
| D-F7-05 | B | Web Locks + outbox durável + CAS/idempotência remota. |
| D-F7-06 | B | Cursores, epochs e tombstones; rebaseline não destrutivo. |
| D-F7-07 | B | Sincronização automática adaptativa, com orçamento de quotas. |
| D-F7-08 | B revisada | Manual + automático + Workers KV Free; R2 opcional desabilitado. |
| D-F7-09 | B | Migração/restauração em isolamento, com prévia e incorporação segura. |
| D-F7-10 | B simplificada | Criptografia local e recuperação independente, com automação sem senha repetida. |
| D-F7-11 | B | Cópia automática no máximo uma vez por 24 h se houver alterações; até sete versões; exportação manual. |
| D-F7-12 | B | Estado discreto de sincronização e backup; detalhes sob demanda. |
| D-F7-13 | B | PWA offline e atualização somente quando segura. |
| D-F7-14 | B | IndexedDB protegido e recuperação pelos backups existentes. |
| D-F7-15 | B | Testes locais, emuladores, piloto isolado e dispositivos disponíveis. |
| D-F7-16 | B | Aceite por risco, evidências e pendências não críticas controladas. |
| D-F7-17 | C | Possibilidade de V1/V2 coexistirem produtivamente com sincronização bidirecional. |

**Compatibilização de D-F7-17/C com a instrução posterior do proprietário:** na F7, V1 produtiva e V2 de testes funcionam **separadamente**. A possibilidade de coexistência **com dados compartilhados** permanece aprovada, mas sua **ativação é condicional** à decisão tomada após o usuário experimentar a V2. Caso escolhida, exige contrato, teste, proteção contra loops/duplicações, aprovação e gate próprios na F8 ou etapa específica anterior à ativação. **A F7 não implementará nem habilitará ponte bidirecional produtiva por inferência.** Não considerar a ponte entregue apenas por aprovar a opção C; tampouco ignorá-la na avaliação futura. O corte definitivo também não é automático.

## 3. Arquitetura e invariantes transversais

- **Persistência local única:** IndexedDB V2 é a autoridade de commits locais. Gravação de entidade e operação de outbox na mesma transação; nunca confirmar gravado antes do commit.
- **Remoto V2 único:** Firestore Spark confirma alterações entre dispositivos. Cloudflare KV é **backup**, não outro peer de sincronização. Nenhuma fila remota concorrente para as mesmas mutações.
- **Causalidade, não relógios:** IDs imutáveis de operação, revisão-base, CAS, deduplicação e ACK somente com prova; operações podem trafegar mais de uma vez, mas seu efeito deve ser idempotente.
- **Sem perda silenciosa:** não descartar alterações offline, conflitos, exclusões, anotações, tempo de estudo, sessões ou relações; estados ambíguos devem ser diagnosticáveis.
- **Segurança por identidade:** isolamento de perfis locais, UIDs e bibliotecas remotas; não mesclar contas automaticamente; Rules no backend são obrigatórias.
- **Custo R$ 0 absoluto:** nenhum serviço pago, Blaze, assinatura R2, upgrade automático, Cloud Functions pagas, Actions novas ou cobrança por excesso de quota.
- **V1 preservada:** nenhuma leitura/escrita em acervo real V1, migração efetiva, mudança de regras/domínio/cache da V1 nem merge `v2`→`main` sem novo gate.
- **Simplicidade:** reusar código F1–F6 e contratos A-02; evitar backend, painel ou ferramenta extra sem necessidade demonstrada.

## 4. Escopo funcional vinculante

### F7-A — Identidade, autorização e segurança

1. Login Google via Firebase Authentication em projeto **Spark isolado**, sem exigir login para estudo local.
2. Primeiro vínculo entre `profileId`, `uid` e `remoteLibraryId` exige prévia de acervos, comparação e consentimento explícito. Logout/troca de UID bloqueia fluxos anteriores e não expõe acervo de outro perfil.
3. Firestore Rules aplicam ownership por UID, validam entidades/limites/tipos e recusam leituras/escritas de conta errada. Provar em emulador e, após autorização, no Spark isolado.
4. Tokens de autenticação não aparecem em backups, logs, URLs ou arquivos de evidência.

### F7-B — Sincronização incremental

1. Modelo remoto em entidades/agregados limitados; validar tamanhos, índices e orçamento de operações. Sem documento global que concentre todo o histórico.
2. Envelope lógico mínimo de mutação: `operationId`, `profileId`, `uid`/biblioteca de entrega, tipo/ID da entidade, operação, schema, revisão-base, payload validado, tentativas e estado.
3. Disparar sincronização após commit local, abertura/retomada, reconexão e verificações econômicas, apenas quando autorizado e durante execução possível do app.
4. Exclusão mútua cross-tab por Web Locks; `BroadcastChannel` só para avisos. Sem lock ou fallback efetivamente seguro, pausar envio e preservar operações.
5. Aplicar escrita remota condicionada sob revisão-base/CAS, com `operationId` deduplicado. Timeout após commit → consulta/read-back antes de ACK ou retry. Estados `LOCAL_COMMITTED`, `REMOTE_COMMITTED` e `CONVERGED` não são intercambiáveis.
6. Pull incremental por cursor. Alterações independentes convergem; mesma entidade/campo conflitante preserva alternativas. Exclusão × edição gera conflito explícito, não LWW silencioso.
7. Tombstones, epoch e protocolo de rebaseline: cliente antigo com cursor inválido entra em `RECOVERY_REQUIRED`, sem reenvio destrutivo. Não compactar exclusões por prazo arbitrário.
8. Quotas, token expirado e falhas de rede mantêm outbox durável, retry com backoff e estado honesto. Não prometer sync instantâneo nem executado com PWA fechada.

### F7-C — Orçamento gratuito e limites

- Firebase **Spark sem billing**. Cotas Firestore Standard de referência em 04/11/2026: 1 GiB armazenado, 50.000 reads/dia, 20.000 writes/dia, 20.000 deletes/dia, 10 GiB outbound/mês e apenas um database com franquia gratuita por projeto. Verificar novamente antes do piloto. TTL, PITR, backup e restore **gerenciados pelo Firestore** exigem billing e são proibidos.
- Medir custo real de reconexões, listeners, índices, perfil acadêmico com 1/2/3 dispositivos e históricos extensos; definir margens e suspensão de operações quando necessário. Limite de cliente não substitui barreira financeira do Spark.
- Workers KV **Free**: como referência, 1 GiB de armazenamento, 25 MiB por valor e 1.000 gravações por dia. Não habilitar plano pago, truncar backup nem usar KV como base transacional de sincronização. Cloudflare R2 tem subscrição/uso excedente faturável, portanto o adaptador permanece desabilitado.
- Hospedagem de avaliação: usar solução de assets estáticos gratuita e isolada, preferencialmente **Cloudflare Pages Free**, condicionada a conferência das regras e a gate expresso de publicação de testes. Nada de CI/GitHub Actions novo.

### F7-D — Backups, criptografia, migração e restauração

**Formato portátil:** arquivo versionado com manifesto, contagens, inventário, checksum, relações, tombstones/epoch e material para recuperar todos os dados acadêmicos F2–F6, inclusive drafts e operações relevantes. Os formatos F1/F2 existentes devem ser preservados para leitura compatível; não presumir que já cobrem F3–F6. Excluir credenciais, cookies, tokens e dados de outro perfil.

**Backup manual:** exportação local a qualquer momento, inclusive offline. **Automático:** gerar uma cópia ao usar/abrir app se houve alterações e não há cópia íntegra recente nas últimas 24 h. Máximo sete versões válidas em destino remoto. Sem promessa de execução com PWA fechada.

**Cloudflare:** Worker mínimo no plano Free, validando Firebase ID token (assinatura, issuer, audience, expiração e UID); namespace de backup por UID/biblioteca autorizados. Criptografia **antes** do upload; Worker e KV não recebem chave para ler o conteúdo. Cada backup tem chave imutável por versão; KV é eventualmente consistente, logo a versão só fica marcada recuperável após read-back validado. Nunca excluir a última cópia boa para criar a nova. Limite de 25 MiB/valor ou quota excedida → falha segura e exportação local.

**Criptografia simples:** Web Crypto, AES-GCM com nonce único e chave de conteúdo aleatória. Chave utilizável localmente no dispositivo autorizado; cópia da chave protegida por senha/chave de recuperação para restaurar em outro dispositivo. A solução não deve guardar senha simples ou chave decriptadora na Cloudflare. Perda da chave de recuperação pode tornar os dados inacessíveis; avisar uma única vez ao configurar. Verificar tag criptográfica além do checksum do manifesto.

**Restauração:** inspecionar, verificar, preparar em namespace isolado, apresentar preview e riscos, exigir consentimento, aplicar por mecanismo transacional/recuperável, reconciliar IDs e relações, conferir leitura de volta. Backups com epoch velho entram em rebaseline, sem reintroduzir exclusões nem reativar outbox antiga automaticamente.

**Migração V1:** somente fixtures sintéticas de schemas V1 12/11/9/7, IndexedDB 7/6 e formatos de exportação. Cobrir explicitamente plano legado da issue #107 e diferença de semântica entre snapshot legado e Reta Final nova; nunca assumir equivalência por contagens. Dados V1 reais exigem autorização futura independente, preferencialmente cópia exportada pelo proprietário. Nunca tocar produção V1 durante F7.

### F7-E — PWA, integridade local e UX

- Reutilizar o Service Worker, `sw-update.ts` e coordenação de sessões. Adiar atualização se sessão ativa, formulário não salvo, recuperação pendente, outra aba insegura ou migração de schema incompatível.
- Offline com recursos previamente armazenados, sem garantia de persistência indefinida; reconciliar temporizador com tempo persistido, não depender exclusivamente de intervalo em execução.
- Solicitar `navigator.storage.persist()` quando disponível, sem exigir sucesso. `storage.estimate()` é estimativo; sempre tratar `QuotaExceededError`, abortos e bloqueio de upgrade corretamente. Não apagar IndexedDB para liberar cache.
- Interface discreta: **Salvo neste dispositivo**, **Sincronizando**, **Sincronizado**, **Pendente/Offline**, **Conflito**, **Recuperação necessária** e **Backup confirmado** como estados independentes. Não apresentar sucesso falso e não interromper atividades por erros transitórios.
- Segurança: conteúdo importado, XSS, versionamento de caches, isolamento por UID, logs sanitizados, acessibilidade e comportamento mobile.

### F7-F — Testes e piloto operacional isolado

1. Unitários, integração, Playwright e Firebase Emulator Suite, com dados sintéticos, reutilizando testes F1–F6.
2. Falhas adversariais: duas abas, dois dispositivos offline, revisão concorrente, timeout pós-commit, schema grande, tombstones, quota, Auth, SW e armazenamento local removido.
3. **Após autorização específica:** ambiente real Firebase Spark isolado e Workers KV Free de homologação, com contas/testes autorizados. Não apontar para V1, seu Firestore, domínio, cache ou backups produtivos.
4. Jornada completa: criar/importar edital → planejar → estudar → revisar → dashboard/busca → sincronizar PC/celular/tablet → exportar → restaurar e reconciliar.
5. Revisão independente proporcional aos riscos; evidências de `PASS`, `FAIL`, `NOT_RUN`, `INCONCLUSIVE` e métricas medidas. Não considerar PASS em fake-remote como prova de funcionamento remoto.

### F7-G — Ambiente de avaliação humana da V2 (adição posterior aprovada)

**Pré-condição:** V2 candidata funcionalmente completa, testes críticos revisados, ambiente externo de homologação autorizado. Não publicar protótipo parcial como se fosse aplicativo final.

**Entrega:** endereço próprio da V2, fora da origem V1, em hospedagem gratuita, preferencialmente Pages Free; projeto Firebase de testes separado; URL acessível por PC, celular e tablet; dados sintéticos inicialmente; instalação PWA opcional. Nenhum dado produtivo importado sem consentimento.

**Aceite:** o proprietário testa navegação, planejamento, cronômetro, revisões, analytics, offline, sincronização, backups e restauração. Corrigir falhas materiais na mesma linha `v2` e revalidar. Só depois solicitar avaliação formal da F7. **Aposentadoria da V1 não faz parte desse aceite.**

## 5. Matriz de homologação e evidências

Conservar os cenários históricos **S01–S18**, acrescentando os necessários às decisões novas; é permitido reutilizar uma prova para vários casos, evitando repetição de testes.

| ID | Caso | Critério de aceite |
|---|---|---|
| S01 | PC → celular → tablet | Mesmo ID/fato; sem duplicação; convergência verificada |
| S02 | Dois dispositivos criam alterações offline | Preservação integral e convergência |
| S03 | Mesmo bloco modificado offline em dois dispositivos | Versões persistidas e conflito explícito |
| S04 | Exclusão remota e cliente antigo | Tombstone, sem ressurreição, rebaseline |
| S05 | Timeout após commit antes do ACK | Consulta de prova; efeito remoto idempotente |
| S06 | Duas abas enviam a mesma outbox | Um efeito lógico, revisões/ACK coerentes |
| S07 | Troca de conta/UID | Nenhuma leitura ou escrita cruzada |
| S08 | Payload acima de 1 MiB | Rejeição segura, sem truncar dados |
| S09 | Reconexões repetidas em 2/3 aparelhos | Consumo medido e margem gratuita |
| S10 | Quota, Auth, fechamento e offline | Status verdadeiro, fila preservada |
| S11 | Backup antigo e exclusão recente | Preview/rebaseline, sem ressurreição |
| S12 | Schemas V1 e issue #107 sintética | Relações, IDs, contagens e diferenças semânticas |
| S13 | Service Worker com sessão/formulário | Adiar update; não perder dados |
| S14 | Clear Data do perfil V2 | Consentimento, limpeza V2 e V1 intocada |
| S15 | Rules hostis/UID inválido | Acesso recusado e logs sanitizados |
| S16 | Backup/export/restore | Arquivo portátil e read-back completo sem credenciais |
| S17 | Cobertura histórica V1/V2 | Não converter 107 FAIL V1 em PASS fictícios |
| S18 | IndexedDB/site data removido | Recuperação disponível sem sobrescrever |
| S19 | KV Free com Worker/Auth | UID isolado, cifra e read-back verificados |
| S20 | Backup diário e retenção sete versões | Não duplicar ou excluir última cópia íntegra |
| S21 | Senha incorreta/chave perdida/arquivo adulterado | Falha segura, nenhuma exposição ou escrita |
| S22 | URL V2 isolada | App funcional, V1 e produção intocadas |
| S23 | Backup maior que 25 MiB/limite KV | Exportação local, sem truncar e R2 desabilitada |
| S24 | Todos os tipos acadêmicos F2–F6 | Roundtrip e integridade de relações/operações |
| S25 | Experiência em aparelhos disponíveis | Evidência real ou `NOT_RUN` fundamentado |

Os quatro riscos históricos `HIGH / UNVERIFIED` exigem prova específica: `R-V1-LEGACY-REMOTE-PLAN`, `R-V1-FIRESTORE-DOCUMENT-1MIB`, `R-V1-MULTITAB-OUTBOX-RACE` e `R-V1-BACKUP-TOMBSTONE-LOSS`. Mitigação V2 comprovada não significa correção automática da V1.

Reavaliar ressalvas F6: H-02 (leitor de tela), H-16 (hardware modesto), H-03/H-06/H-17 (verificações humanas), AC24 `DEFERRED_F7`, RF04/06/13/15/25/28/30/31 parciais, F4-T13 `NOT_RUN` e histórico INCOMING parcial. Não convertê-las automaticamente em PASS; classificá-las por criticidade e dependência.

## 6. Critérios de aceite, estados e gates

**Aceite pleno:** fluxo F2–F6 funcional, dados locais íntegros, sync real segura em projeto isolado, conflitos/tombstones e Auth comprovados, backup criptografado restaurável, migração sintética segura, PWA/offline confiável nos cenários acordados, limites gratuitos verificados, quatro HIGH mitigados ou funcionalidade arriscada explicitamente desabilitada, revisão independente, URL de homologação acessível e aceite humano.

**Aceite com ressalvas:** apenas limitações secundárias sem risco material de segurança, perda de dados ou violação de custo zero. Falha crítica implica `F7_BLOCKED`; teste obrigatório não realizado é `NOT_RUN` ou `INCONCLUSIVE`, nunca PASS presumido.

**Estados de processo:** `F7_SPEC_PROPOSED_NOT_APPROVED` → `F7_SPEC_APPROVED` → `F7_PLAN_APPROVED` → `F7_IMPLEMENTATION_AUTHORIZED` → `F7_READY_FOR_HUMAN_REVIEW` → `F7_ACCEPTED` ou `F7_BLOCKED`. Cada gate depende da autorização correspondente; aprovação da spec não concede autorização implícita para a etapa seguinte.

**G-SPEC:** proprietário aprova esta especificação. **G-PLAN:** aprova writing-plans Superpowers. **G-EXEC:** autoriza GOAL/implementação. **G-EXT:** autorização separada para Firebase Spark de homologação, Worker/KV Free e contas de teste. **G-STAGING:** autorização de publicação do ambiente isolado da V2. **G-F7:** avaliação e aceite humano da V2 demonstrada. **G5/F8:** decisão posterior sobre substituir a V1, prolongar avaliação ou habilitar coexistência produtiva bidirecional (esta última exige contrato/testes/gate próprios antes de escrita compartilhada).

## 7. GitHub, preservação e documentação

- Desenvolver futuramente na `v2`; preservar `main` como V1 até o G5. Não abrir Actions, PRs ou branches por ajuste rotineiro.
- Antes de qualquer GOAL: conferir HEADs, working tree, commits exclusivos, branches, PRs, worktrees, testes e specs reais; inventariar sem apagar trabalho.
- Preservar a branch `codex/f5-local-preserved-20261102`, com quatro commits exclusivos, e as três capturas F4 locais modificadas até que haja inventário e decisão segura.
- Consolidar estado no `ROADMAP.md` e na issue mãe #108, **apenas depois de autorização para modificar o repositório**. Evitar relatórios redundantes.
- Distinguir: **implementado**, **testado**, **integrado à `v2`**, **disponível no ambiente de homologação** e **publicado em produção**.
- Preparar zip de evidências na fase de execução futura conforme padrão de GOAL; não produzir pacote fictício de execução agora.

## 8. Exclusões expressas

Sem escrita na V1 real; sem migração produtiva; sem merge `v2`→`main`; sem Cloudflare R2 ativa, billing, Blaze, Cloud Functions pagas ou Actions novas; sem ponte bidirecional produtiva na F7; sem acesso a acervo real do proprietário sem consentimento independente; sem afirmar que o app fechado sincroniza; sem publicar preview sem gate; sem destruir caches/IndexedDB como solução de erros; sem reescrever arquitetura F1–F6 sem evidência material.

## 9. Próxima etapa (somente após aprovação humana)

Produzir o **writing-plans do Superpowers** com tarefas, TDD, gates, testes locais, simulação Firebase, piloto isolado autorizado, revisão, recuperação, evidências, higiene Git e entrega de ambiente de avaliação. A futura execução terá GOAL separado, completo e aprovado. **Esta especificação não é um plano executável.**

## 10. Fontes de verdade

- [Roadmap mestre F0–F8](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/v2/ROADMAP.md)
- [Contrato A-02](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-v2-multidevice-sync-f1-contracts.md)
- [Spec histórica F7 (proposta, não aprovada)](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f7-integration-design.md)
- [Aceite F6](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/audits/2026-11-04-v2-f6-acceptance.md)
- [Issue mãe #108](https://github.com/matheussilva421/estudo-organizado/issues/108)
- [Issue legado #107](https://github.com/matheussilva421/estudo-organizado/issues/107)
- [Firebase Spark — quotas](https://firebase.google.com/docs/firestore/pricing)
- [Firebase Spark — planos](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Workers KV Free — limites](https://developers.cloudflare.com/kv/platform/limits/)
- [Cloudflare R2 — requisito de assinatura](https://developers.cloudflare.com/r2/get-started/)
- [Cloudflare Pages Free — limites](https://developers.cloudflare.com/pages/platform/limits/)

---

**Status desta entrega:** `F7_SPEC_PROPOSED_NOT_APPROVED`. Documento independente para revisão; sem modificações no repositório, serviços ou dados reais.
