# Estudo Organizado V2 — Registro de ADRs propostas para F1

**Data:** 2026-10-28  
**Status:** **PROPOSTO PARA REVISÃO HUMANA DA SPEC F1**. Nenhuma ADR-F1 deste documento foi individualmente ratificada, exceto os princípios já cobertos por D01–D27, A-01 e A-02.  
**Origem:** [F0 com aceite humano e ressalvas](../audits/2026-10-19-f0-acceptance.md); [A-02 — pré-contratos](2026-10-28-v2-multidevice-sync-f1-contracts.md); [issue #108 / aceite](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470404279).  
**Proibição:** este documento não autoriza instalar dependências, escrever código, mudar a V1, executar writing-plans, integrar à main, publicar ou acessar projetos/dados reais.

## ADR-F1-01 — Isolamento da aplicação e versionamento independente

**Situação:** proposta fundamentada em D01/D03/D04/D09/D17/D19/D26.

**Problema e evidência:** V1 publicada continua sendo a aplicação de estudos operacional. A F0 encontrou esquema acadêmico declarado 12 vs referências 11/9/7, IndexedDB 7 vs documentação 6 e backup com versionamento insuficiente. Reutilizar a mesma origem, IndexedDB ou service worker exporia a V1 a migrações e caches V2.

**Alternativas:** (A) evoluir os stores/Service Worker da V1 no mesmo origin (descartar: risco de interferência); (B) aplicação V2 com origem, SW e IndexedDB separados, contrato de importação legada read-only (recomendado); (C) outro repositório/backend inteiro (rejeitado por burocracia desnecessária).

**Decisão recomendada:** desenvolver em \`v2\` e checkout/worktree isolado; servir V2 em **origem diferente** (host/porta em dev; origem explícita em homologação). Nomes e versões **independentes** para \`appVersion\`, \`localSchemaVersion\`, \`backupFormatVersion\`, \`syncProtocolVersion\`, \`domainSchemaVersion\`. Nunca reutilizar número 12 ou 7 por hábito: novas versões partem de contrato próprio; o importador lê formatos antigos de forma explicitamente versionada e validada.

**Consequências:** proteção da V1 e capacidade de ensaiar migração em cópia sintética; custo de manter compatibilidade de origens e versões; não há downgrade automático do IndexedDB. Referências V1 não são importações diretas de módulos da V2.

**Aceite em F1:** teste V1/V2 em origens distintas; nenhum SW ou IDB compartilhado; reinicialização/upgrade com versão incompatível falha de modo seguro; nenhuma modificação em \`src/\` e dados de produção V1.

## ADR-F1-02 — Firestore incremental, identidade Google e orçamento gratuito

**Situação:** A-02 **já aprovada** para objetivo de produto e serviços; o **formato físico** deste ADR ainda é proposta.

**Problema e evidência:** envelope legado de 1.210.602 bytes acima do limite de documento Firestore; snapshot único eleva acoplamento, custo de atualização e risco de conflito. Requisito A-02: PC/celular/tablet com mesma conta Google, sync automático após primeiro vínculo consentido, sem precisar intervenção cotidiana.

**Alternativas:** (A) snapshot global grande (rejeitado); (B) documento por entidade/agregado delimitado e metadados separados com consultas incrementais (recomendado); (C) evento por operação retido indefinidamente (risco de amplificação/custo e GC complexo, não aprovado).

**Decisão recomendada:** Firestore Spark com Google Sign-In/Firebase Auth e Security Rules por UID. Cada entidade/agregado remoto tem ID/revisão e orçamento de tamanho estrito, metadados de sync separados da matéria acadêmica, índice e cursor de mudança verificável; nenhuma gravação remove automaticamente dados importantes para caber no limite. A granularidade definitiva e política de índices/listeners **dependem de simulação sintética de quotas, leituras e escritas**; não fixar esquema físico sem essa prova.

**Consequências:** atualizações finas e menor risco de atingir 1 MiB; mais documentos/consultas e necessidade de controlar custos/cursors. Sem billing, Cloud Functions, servidor próprio ou segundo canal remoto autoritativo.

**Aceite em F1:** contrato/fixture que ultrapassa 1 MiB falha fechado; duas alternativas remotas comparadas por tamanho/leituras/escritas/índices para 1–3 dispositivos; segurança de UID e autenticação simuladas; **não** declarar integração real com Spark concluída sem emulador/homologação posterior.

## ADR-F1-03 — Outbox idempotente e concorrência entre abas/dispositivos

**Situação:** proposta alinhada à A-02, D08 e risco HIGH \`R-V1-MULTITAB-OUTBOX-RACE\`.

**Problema e evidência:** V1 usa SyncLock em memória; duas abas podem enviar a mesma intenção. A conexão pode cair após commit remoto, antes de o cliente receber confirmação.

**Alternativas:** (A) lock de módulo/BroadcastChannel somente (rejeitado: não garante exclusão); (B) Web Locks para coordenação local + identidade imutável de operação, deduplicação e CAS remoto (recomendado); (C) arquitetura de servidor/workers pagos (desnecessária e fora do Spark).

**Decisão recomendada:** na gravação local, persistir entidade + intenção de outbox atomicamente. Coordenador único por perfil, Web Locks onde suportado; fallback **comprovável** com lease/fencing e revisão no IndexedDB ou suspensão de flush concorrente, nunca fingir lock. No remoto, IDs de operação/revisões condicionadas tornam replays sem efeito adicional. A garantia é **entrega pelo menos uma vez e efeito idempotente**, não transporte exatamente uma vez. ACK só após commit ou read-back que confirme a operação. \`BroadcastChannel\` apenas notifica abas. Múltiplos dispositivos convergem por alterações independentes; conflitos materiais preservam as duas versões.

**Consequências:** estados de sync mais explícitos e testes adversariais, sem necessidade de infraestrutura paga. Exige lidar com aba fechada, timeout, owner antigo, revisão remota ultrapassada e ausência de Web Locks.

**Aceite em F1:** simulação determinística de crash, timeout após confirmação, replay, dupla aba e conflito; um resultado lógico por operação; ACK não pode ultrapassar operação efetivamente confirmada. E2E/emulador em F7 antes de declarar risco mitigado.

## ADR-F1-04 — Backup versionado, tombstones e restauração supervisionada

**Situação:** proposta alinhada à D18/D26/A-02 e ao risco HIGH \`R-V1-BACKUP-TOMBSTONE-LOSS\`.

**Problema:** export V1 perde \`removedBlocks\` / \`minRetainedRevision\`, possibilitando ressurreição de exclusões após restauração e merge. Backups antigos também podem carregar metadados de sync incompatíveis ou credenciais.

**Alternativas:** (A) backup do snapshot acadêmico ignorando exclusões (rejeitado); (B) backup canônico versionado com manifesto, dados acadêmicos, tombstones causais mínimos e restauração com preview + rebaseline (recomendado); (C) exportação bruta de todos os dados operacionais/tokens (rejeitada por risco e acoplamento).

**Decisão recomendada:** excluir tokens, segredos e cache operacional dos backups; **incluir a informação causal de exclusões suficiente** (IDs, operação, revisão/epoch e proveniência) ou, se impossível, exigir reconciliação segura antes de sincronizar. Manifesto com formato próprio, contagem, integridade e esquema. Preview read-only + checkpoint antes de qualquer restauração destrutiva. Compactação de tombstones **nunca por TTL arbitrário**; usar convergência/epoch e rebaseline forçado em clientes antigos, sob contrato a detalhar.

**Consequências:** backup portátil e durável, com custos de metadados de exclusão, testes de múltiplos clientes e manutenção de migrações por formato. Sincronização continua **não sendo backup**.

**Aceite em F1:** contrato/testes sintéticos de export/import/truncamento, exclusão→backup→restore antigo→sync e tentativa de restaurar tokens; nunca confirmar sucesso nem enviar remoto sem contexto causal válido. Ensaios reais controlados em fases posteriores.

## ADR-F1-05 — Interpretação e reconciliação de dados legados (issue #107)

**Situação:** proposta, condicionada à auditoria das variantes V1; não é correção da V1.

**Problema:** ausência de \`schemaVersionRetaFinal\`/\`planId\`/\`revision\` no plano remoto legado pode ser confundida com ausência do plano; schema 12/11/9/7 e IndexedDB 7/6 não têm um contrato único de migração.

**Alternativas:** (A) adotar remoto como vencedor ou criar estado vazio (rejeitado, perda silenciosa); (B) importador isolado read-only com proveniência, validação de versão e comparação semântica conservadora (recomendado); (C) alterar banco V1 em produção previamente (rejeitado sem gate separado).

**Decisão recomendada:** tratar **presença de dados acadêmicos** independentemente da presença de metadados v2. Transformar cópias imutáveis de fixtures/snapshots, preservar IDs/proveniência, comparar intenção (blocos, notas, vínculos), aceitar somente equivalência comprovada; mismatch vai para conflito supervisionado. Nunca fazer escrita destrutiva remota só para migrar versão. F1 documenta formatos/transformadores; testes de migração de dados reais exigem autorização futura específica e não pertencem a F1.

**Consequências:** mais validação no primeiro vínculo e no cutover, mas impede perda de linhagem e as sobregravações relatadas na V1.

**Aceite em F1:** 180 blocos equivalentes adotados de forma idempotente; variante divergente mantida em quarentena/conflict; nenhuma operação remota enviada durante uma comparação ambígua; F7 ensaia emulador e backup completo.

## Limitações, bloqueios e aprovação

**Riscos HIGH ainda \`UNVERIFIED\`:** \`R-V1-LEGACY-REMOTE-PLAN\`, \`R-V1-FIRESTORE-DOCUMENT-1MIB\`, \`R-V1-MULTITAB-OUTBOX-RACE\`, \`R-V1-BACKUP-TOMBSTONE-LOSS\`. Aprovar ADR **não** mitiga nenhum desses riscos sem testes.

**F0 aceita com ressalvas:** 35 \`PRESERVE\`, 10 \`REFORMULATE\`; laboratório \`F-V1-VISUAL-LAYOUT-LAB\` permanece \`UNDECIDED\` e excluído da F1, com aprovação do **adiamento**, não do destino. Baseline V1 E2E segue 59 PASS / 107 FAIL e necessita triagem; Impeccable A-01 e 8 temas permanecem obrigatórios.

**Gate seguinte:** revisar este conjunto de ADRs e [spec F1](2026-10-28-estudo-organizado-v2-f1-foundation-design.md). **Aprovação da spec/ADRs autorizará apenas a elaboração do writing-plans F1**, não a implementação.
