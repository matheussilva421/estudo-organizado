# Estudo Organizado V1 — Sincronização definitiva e independente

**Especificação de arquitetura (Superpowers) — PROPOSTA v1.0**  
**Data:** 23/11/2026  
**Estado:** `SPEC_PROPOSTA / AGUARDANDO_APROVACAO / SEM_IMPLEMENTACAO`  
**Repositório de referência:** `matheussilva421/estudo-organizado`, exclusivamente a V1 em `main`; a V2 é projeto isolado e fora de escopo.

> Este documento é uma proposta de design, **não** autorização para programar, criar branches/PRs, executar migrações, modificar o Firebase, publicar regras ou fazer deploy. As escolhas técnicas aqui propostas só ficam aprovadas após aceite da SPEC. O GOAL e o plano de execução são etapas posteriores.

## 1. Intenção e experiência pretendida

A sincronização da V1 deve tornar-se **automática, confiável, offline-first e praticamente invisível**, para um usuário que normalmente utiliza um dispositivo por vez e alterna entre computador, celular e tablet. O app deve abrir de imediato com dados locais já pertencentes à **geração atual**, sincronizar em segundo plano e avisar apenas quando houver escrita pendente relevante, falha persistente ou conflito genuíno.

O problema atual não pode ser tratado exclusivamente por novos hotfixes: o mecanismo existente inclui snapshots globais, envio por entidade em modos distintos, polling, outboxes antigas, comandos manuais e múltiplos canais. O objetivo é simplificar **o caminho de dados**, não apenas esconder sua interface.

### Requisitos essenciais

- **N1:** nenhuma ação de estudo depende de conexão disponível ou de confirmação do Firestore para ser gravada localmente.
- **N2:** operações confirmadas pelo servidor aparecem em outro dispositivo após sua abertura/conexão, sem botões de enviar/baixar/mesclar no uso normal.
- **N3:** dispositivo desatualizado não sobrepõe a geração oficial.
- **N4:** alterações locais pendentes sobrevivem a reload/crash/fechamento e não recebem confirmação falsa.
- **N5:** divergência incompatível nunca elimina silenciosamente uma versão recuperável.
- **N6:** a migração parte **somente** do backup canônico fornecido; não incorpora estados legados de outros dispositivos.
- **N7:** a V2, seus diretórios, branches, Firestore e deploys não são tocados.
- **N8:** Cloudflare, Google Drive e exportação JSON são mecanismos de backup/recuperação, não sincronizadores concorrentes.

## 2. Decisões do brainstorming — congeladas

| ID | Decisão aprovada | Consequência |
|---|---|---|
| S01-A | Abrir imediatamente com dados locais e sincronizar em segundo plano | Permitir renderização local apenas para dispositivos já inscritos na geração atual; não aguardar rede normalmente |
| S02 | Utilizar o backup fornecido como fonte de migração | Converter seu conteúdo, sem inferir ou inventar dados |
| S03-B | O backup é a **única** fonte da base inicial | Não integrar dados exclusivos de caches antigos, outros dispositivos ou legado remoto |
| S04-A | Criar espaço de dados Firestore isolado | Não sobrescrever o namespace/snapshot legado no staging, validação ou bootstrap |
| S05-B | Primeiro acesso em dispositivo antigo recupera a nova base | Se não houver cache válido da geração atual e estiver offline, bloquear **somente** o primeiro uso com explicação, sem expor dados antigos como atuais |
| S06-A | Alerta preventivo quando houver operações não enviadas | Fazer alerta quando a plataforma permitir, sem prometer entrega em `beforeunload` |

Não reabrir as decisões sem evidência técnica nova. Política de concorrência sugerida abaixo é uma decisão de implementação a confirmar com a aprovação desta SPEC, não uma aprovação pretérita.

## 3. Fontes e diagnóstico técnico

**Código V1 consultado:** `src/js/store.js`, `src/js/sync/sync-coordinator.js`, `src/js/sync/firestore-sync-engine.js`, `src/js/sync/firestore-schema.js`, `src/js/backup-restore.js`, `firestore.rules`, `docs/architecture/data-flow.md`, `docs/plans/2026-05-01-sync-sem-dor-para-usuario.md`, `docs/reports/relatorio-v1-firestore-sync-2026-11-21.md`.

**Referência comparativa:** MyBacklogV2, especialmente `mybacklog-app/src/repositories/firestoreRepository.ts`, `src/services/syncService.ts` e `src/context/AppContext.tsx`. O MyBacklogV2 utiliza listeners `onSnapshot` e deltas `docChanges()`, além de uma fila para retry. **Não copiar sem análise**: a fila de `createSyncQueue` do MyBacklogV2 é mantida em memória, insuficiente para o requisito N4.

**Constatações da V1:** `globalSyncPaused: true` aparece como valor padrão no `store.js`; o `firestore-sync-engine.js` explicita polling substituindo `onSnapshot`, com intervalo padrão de 30 s; os snapshots completos seguem presentes e podem se aproximar do limite de documento Firestore. O relatório da V1 de 23/11 informa recuperação pontual do sincronismo em produção, mas isso não demonstra a robustez multidispositivo do desenho novo.

## 4. Auditoria real do backup fornecido

**Arquivo de origem:** `estudo-organizado-backup-2026-11-23......json` (upload privado de 23/11/2026).  
**Tamanho:** 1.653.120 bytes.  
**SHA-256 do arquivo byte a byte:** `f4f9af2923d3b0da9599de32e1c897ae4ef4690339b63ba1a5a9ba0059844127`.  
**Formato:** JSON parseável, objeto raiz, `schemaVersion: 12`.

| Coleção/estrutura | Quantidade observada |
|---|---:|
| Editais | 4 |
| Disciplinas (aninhadas) | 49 |
| Aulas (aninhadas) | 792 |
| Assuntos (aninhados) | 1.825 |
| Eventos | 360 |
| Questões (hábitos) | 87 |
| Revisões registradas como hábito | 1 |
| Leituras | 54 |
| Videoaulas | 26 |
| Páginas | 54 |
| Total de registros de hábitos | 222 |
| Blocos de Reta Final ativa | 140 |
| Tombstones no campo raiz | 3 |
| Tombstones em `config.entityTombstones` | 2 |
| Planejamento arquivado | 1 plano do tipo `ciclo` |

**Estado do planejamento:** Reta Final TJPB/FGV + DPE-PB/FCC; período dos blocos **23/11/2026 a 26/02/2027**, 140 IDs únicos, ordens 0–139 únicas; 140 `status: pendente`. O prazo geral do planejamento está configurado até 28/02/2027. O edital consolidado ativo é um plano interno, expressamente identificado no próprio arquivo como **não oficial**.

**Verificações estáticas realizadas:** IDs únicos nos eventos, editais, disciplinas, aulas, assuntos, blocos e hábitos por coleção; 140 referências dos blocos às disciplinas existentes; nenhuma referência a assunto ou aula ausente nos tópicos da Reta Final ativa; 222 referências de hábitos a eventos existentes; ausência de tombstones coincidentes com registros ativos nos casos observados.

**Anomalias históricas que NÃO justificam descarte:**

- **57 eventos** têm `aulaId` sem correspondência na lista atual de aulas dos editais. Os casos inspecionados pertencem a uma importação antiga associada à PGE-RN e têm campos de vínculo de disciplina/assunto ausentes. **Preservar o evento e o ID original**; registrar referência histórica não resolvida, sem construir aula artificial.
- **86 eventos**, dentre 226 com `rfBlocoId`, apontam para blocos ausentes dos 140 blocos atualmente ativos. O contexto é compatível com planejamento de gerações anteriores, mas isso **não prova** que todos são históricos válidos; classificar sem modificar e manter sua identidade. Não vincular a um bloco atual apenas pela data.
- A estrutura `config` inclui histórico técnico de sincronização e um `cfTokenDraft` não vazio. **Campo potencialmente sensível: jamais copiar para o novo banco, registrar valor em logs, anexar a issue ou versionar em Git.** Configurações remotas antigas não se tornam autoridade sobre a nova geração.
- `config.firestoreSync` encontra-se `enabled: false`, `mode: shadow`, sem UID ou operação pendente declarada; `globalSyncPaused` aparece como verdadeiro. Esses flags refletem a exportação e **não devem ser usados** como padrão do novo sincronizador automático.

**Limite desta auditoria:** foram verificadas estrutura, cardinalidades, IDs e vínculos por leitura estática do JSON. O validador JavaScript do aplicativo, a reimportação no navegador, as regras Firestore e o round-trip da conversão **ainda não foram executados**; são gates necessários antes da ativação. O arquivo não foi modificado.

## 5. Abordagens avaliadas

1. **Continuar com snapshot completo:** exige menos mudança estrutural, mas mantém escrita e reconciliação de grande parte do estado, pode crescer além do limite do documento e perpetua os pontos de falha. **Descartada** para o sync cotidiano.
2. **Um documento Firestore por menor item, incluindo as 1.825 entradas de assuntos e 792 aulas:** conflitos finos, porém muitas leituras iniciais, listeners e complexidade operacional em dados relativamente estáticos. **Descartada como padrão geral**, salvo necessidade demonstrada por benchmark.
3. **Modelo híbrido incremental** — **recomendação técnica desta SPEC**: documentos por evento, hábito e bloco; editais de metadados separados; um documento por disciplina, contendo suas aulas e assuntos, com controle de revisão; registros de configuração acadêmica e de planejamento isolados. O maior documento de disciplina observado no backup tem aproximadamente 31,7 KB em JSON compacto, compatível com o modelo proposto no baseline. Permite menos documentos iniciais do que a opção 2 e evita snapshots monolíticos.

O formato exato deve ser provado por protótipo/benchmarks na fase de planejamento. Crescimento atípico de uma disciplina deve disparar segmentação controlada, não novo snapshot global.

## 6. Modelo remoto proposto

**Namespace ilustrativo, não implementado:**

```text
users/{uid}/v1SyncNamespaces/{generationId}                 [manifest/commit de geração]
users/{uid}/v1SyncNamespaces/{generationId}/editais/{editalId}
users/{uid}/v1SyncNamespaces/{generationId}/disciplinas/{discId}
users/{uid}/v1SyncNamespaces/{generationId}/eventos/{eventoId}
users/{uid}/v1SyncNamespaces/{generationId}/habitos/{tipo}_{habitoId}
users/{uid}/v1SyncNamespaces/{generationId}/retaFinalBlocos/{blocoId}
users/{uid}/v1SyncNamespaces/{generationId}/meta/{docId}
users/{uid}/v1SyncNamespaces/{generationId}/tombstones/{chaveEstavel}
users/{uid}/v1SyncControl/current                          [ponteiro da geração ativa]
```

Cada caminho acima deve ser validado quanto à paridade de segmentos do Firestore, nomes de coleção, índices e regras. A estrutura foi escolhida por legibilidade, não como compromisso de API já publicada.

- **Manifest:** `generationId` imutável, `schemaVersion`, `migrationId`, SHA-256 da fonte, contagens esperadas, digest canônico, estado `staging|verified|active|retired` e carimbos do servidor. O manifest não pode ser considerado pronto quando ainda há documentos faltando.
- **Entidades:** preservar IDs legados; `docId`, `logicalType`, `generationId`, `revision`, `updatedAt` pelo servidor (onde aplicável), `deleted`/tombstone, dados de negócio. Não confiar em relógio de dispositivo para decidir concorrência.
- **Disciplinas:** preservar a estrutura `aulas`/`assuntos` e a ordem; associar por `editalId`, com IDs de conteúdo mantidos. Aplicar serialização canônica e controle de versão por disciplina.
- **Metadados:** separar plano ativo e arquivado; preferências acadêmicas permitidas; estado do cronômetro e configuração de UI conforme classificação do schema. Não sincronizar `_timerStart` efêmero como sessão em execução compartilhada. Dados de desempenho e notas devem ser persistidos como dados de negócio, não confundidos com telemetria.
- **Exclusões:** tombstones por identidade, sem reaparecimento de registros excluídos por um cliente defasado; preservar os cinco tombstones históricos identificados, depois de normalizar as duas formas do backup sem perder semântica.
- **Reta Final:** preservar `planId`, tipo, revisão, ordem, notas, `dataOriginal`, `dataPlanejada`, vínculos, `operations` e demais propriedades com significado de negócio. Não reinterpretar a semântica da Reta Final v2 apenas porque o motor de sync recebe versão nova.

Não é objetivo transpor o `firestoreSync`, `entitySync`, `syncHealth`, `manualSyncHistory`, `syncPerformance`, `cfTokenDraft`, credenciais, URLs/tokens ou metadados de dispositivos antigos para a autoridade remota nova.

## 7. Armazenamento local e outbox única

O IndexedDB é a fonte do **commit imediato** no dispositivo. Cada mutação relevante deve registrar **no mesmo limite transacional local** (ou com recuperação comprovada equivalente) o estado acadêmico e a operação pendente, para não existir mudança salva sem outbox correspondente.

Uma outbox persistente por `generationId + uid`, com `opId` único, `entityType`, `entityId`, `action`, `baseRevision`, patch/payload, estado, tentativas, último erro e confirmação. Coalescing permitido apenas se preservar a ordem e semântica (create→update, várias edições de campos etc.). Exclusões têm precedência e não podem ser acidentalmente revertidas por retries. ACK confirmado somente pelo servidor mediante leitura/escrita verificável; reprocessar um `opId` não duplica registros.

Nenhum listener, polling, migração ou operação de outra geração pode limpar a outbox local atual. Logout e troca de conta interrompem listeners, guardam as operações no espaço isolado do UID anterior e impedem upload cruzado.

## 8. Fluxos funcionais

### 8.1 Abertura recorrente (S01-A)

1. Verificar se existe **cache local já vinculado à geração ativa** e ao UID correspondente.
2. Se sim, renderizar imediatamente com status preciso (local, pendente, remoto confirmado).
3. Iniciar listeners `onSnapshot` depois da restauração de Auth; receber mudanças incrementais e aplicar sem sobrescrever operações locais pendentes.
4. Drenar a outbox com backoff e confirmação. Não depender de polling a cada 30 s para receber alterações.
5. Atualizar UI por alterações pertinentes, sem rerenderização integral desnecessária.

### 8.2 Primeiro acesso de dispositivo legado (S05-B)

- Preservar IndexedDB antigo como cópia isolada legível apenas por recuperação excepcional.
- **Sem cache válido da nova geração:** se offline, apresentar tela breve de primeiro preparo e não permitir estudar em base antiga pensando ser atual; se online, obter geração ativa, baixar baseline completo, validar digest e liberar edição só quando o cache novo estiver consistente.
- Depois da primeira recuperação, o usuário volta ao comportamento S01-A e pode trabalhar offline normalmente.
- Nunca executar import de dados do IndexedDB legado para o namespace novo.

### 8.3 Edição / queda de conexão / retorno

- Commit IndexedDB → outbox persistente → notificação de estado local → envio assim que possível.
- `offline`, reload, perda de conexão, navegador suspenso, retries repetidos e interrupção entre escrita e ACK não provocam perda ou duplicação.
- Listener com eco da própria escrita deve ser aplicado de maneira idempotente (não gerar operação nova).
- `beforeunload` pode avisar se pendências existirem, conforme S06-A, mas não garante sincronização; jamais rotular pendente como "sincronizado".

### 8.4 Concorrência rara, mas protegida

- Operações sobre entidades distintas convergem automaticamente.
- Repetição da mesma operação reconhecida pelo `opId` é idempotente.
- Mudanças em campos distintos só são mescladas quando a semântica for comprovadamente independente.
- Atualização concorrente incompatível sobre a mesma entidade deve **preservar as duas versões e suspender apenas aquela entidade**, com explicação concisa. Não bloquear toda a base ou aplicar `last write wins` silenciosamente.
- Dispositivo antigo deve verificar geração/versão antes de escrever; geração divergente significa bloqueio seguro.
- Operações estruturais de planejamento (alterar/remover/reordenar blocos) exigem revisão por lote/versão de plano, preservando integridade de ordem e referências. Usar transações online e/ou protocolo de versão apropriado, nunca CAS baseado exclusivamente no relógio do cliente.

## 9. Reta Final e vínculos históricos

A Reta Final é uma estrutura de negócio **consistente**, não um saco de blocos independentes. Deve manter identidade de plano, ordenação 0–139 no baseline, calendário, minutos, tópicos, notas, mudanças futuras e dependências com eventos/edital.

- Replanejamento que modifica diversos blocos precisa de operação lógica indivisível para os leitores, usando staging/manifest por revisão quando necessário. Nunca exibir metade de uma versão como planejamento definitivo.
- Ações automáticas que geram eventos a partir de blocos devem ser **idempotentes** e respeitar registros manuais, tombstones e históricos já existentes. Não recriar os 86 vínculos históricos desconhecidos como blocos atuais.
- 57 referências antigas a aulas não devem impedir a migração, mas devem ser inventariadas como `historicalUnresolvedReference`, sem alterar o ID original ou criar aula fictícia.

## 10. Backup, migração e ativação (S02/S03-B/S04-A)

### Fase de preparação — sem escrita produtiva

1. Congelar a identidade da fonte pelo SHA acima; manter cópia original imutável, fora do Git e de logs públicos.
2. Rodar o validador **real** `validateBackupPayload()` e regras complementares de schema, vínculos, credenciais e campos desconhecidos. Não presumir que o validador antigo detecta `cfTokenDraft`: remover o campo explicitamente.
3. Gerar transformação determinística e **sem perdas de negócio**, inclusive campos desconhecidos (preservá-los em payload de negócio ou manifestar/justificar cada exclusão operacional).
4. Criar manifesto de contagem, digests semânticos por registro/coleção, lista de exceções históricas e prova de conversão inversa/reconstituição para comparação.
5. Testar importação e round-trip em ambiente isolado com Firestore Emulator e navegadores distintos, usando dados sintéticos ou cópia privada com rede externa bloqueada.

### Staging em Firestore separado

1. Usar o mesmo projeto Firebase **somente se** o isolamento de namespace, regras e permissões for comprovado. Não assumir que regras legadas já autorizam os novos caminhos.
2. Escrever os registros em `staging`, em lotes idempotentes e retomáveis. Não publicar ponteiro ativo no início.
3. Recontar, fazer read-back de **todos** os registros e validar SHA/digests e invariantes de negócio; testar redução de rede, erro em lote, retomada, falha de autenticação e quota.
4. Só depois publicar o ponteiro de geração ativa em operação protegida contra concorrência, com `manifest.state = active` e prova de que o conjunto já foi verificado. Essa ativação **exige autorização específica**, não incluída nesta SPEC.

### Convivência e rollback

- A V1 antiga fica disponível enquanto a migração não for homologada; novo cliente só escreve no namespace da nova geração. Clientes antigos não têm permissão para contaminar esse namespace.
- Preservar snapshots anteriores, índices locais e backup original, sem executar `clearData` ou restauração sobre estados pessoais.
- Um rollback de código não deve causar escrita de clientes antigos na nova base. Um rollback **de dados** não pode apagar operações criadas após a ativação; isso requer export/checkpoint e decisão específica.
- Se houver novas atividades após a data do arquivo enviado e antes do cutover, **este backup continuará sendo a única fonte inicial** pela S03-B. Antes de ativar, apontar claramente o intervalo não contemplado. Uma substituição por backup canônico mais recente exige identificação do novo SHA e aceite, não mescla silenciosa de dados legados.

## 11. Segurança e privacidade

- Regras Firestore `uid`-scoped para leitura/escrita do namespace, isolamento por `generationId`, validação de formatos, campos editáveis e limites por documento.
- Segregação por UID e por geração testada com allow/deny no Firebase Emulator.
- Tokens, rascunhos de token, credenciais, configuração de Auth, informações de sessão e payload integral do backup **não entram em commits, issues, PRs, fixtures versionadas, screenshots de logs ou relatórios compartilhados**.
- O plano de migração documentará as credenciais estritamente necessárias e o menor privilégio, com aquisição local segura e sem imprimir segredos.
- Sanitização de logs com IDs opacos quando possível; diagnósticos suficientes para erros sem exposição de notas pessoais ou dados de estudo.
- Código do cliente nunca pode autoconceder privilégios por declarar `isAdmin`, `migration` ou `generation` no payload; regras e controle remoto verificam a autoridade.

## 12. Desempenho, custos e observabilidade

- Primeiro carregamento recorrente com cache local **sem esperar rede**.
- Sync de uma alteração de evento/hábito/bloco não deve reenviar `editais`, plano completo ou todo o histórico.
- Leitura remota inicial dos documentos necessários, uso incremental por `docChanges`, remoção de listeners em logout/troca de usuário e prevenção de assinaturas duplicadas.
- Disciplinas estáticas aninhadas terão atualização por revisão atômica da disciplina; validar especialmente alterações em assuntos e aulas e tamanho máximo de documento.
- Medir reads/writes por ação, bytes transferidos, latência, tempo até ACK e reconciliação, comportamento em retomada, consumo de quota Free e cache local; definir metas quantitativas com baseline real no plano, sem inventar métricas.
- Estado observável mínimo: `sincronizado`, `sincronizando`, `salvo neste dispositivo`, `atenção necessária`. Nunca considerar ausência de erro como prova de ACK remoto.

## 13. Critérios objetivos de aceite

**Dados:**

- Mesmas cardinalidades observadas: 4 editais, 49 disciplinas, 792 aulas, 1.825 assuntos, 360 eventos, 222 hábitos, 140 blocos e 5 tombstones (após normalização sem duplicação), 1 plano arquivado. Divergência só com justificativa documental explícita e autorização quando material.
- Preservação de todos os campos de negócio, incluindo notas, duração, datas, estados, questões, páginas, tempos, links, planos atuais e arquivados. SHA do original verificado antes da conversão.
- Os 57 `aulaId` e 86 `rfBlocoId` historicamente sem correspondência preservados e auditados, sem perdas nem criação fictícia.
- Round-trip sem diferença semântica nos dados de negócio; nenhum token/credencial/metadado técnico legado em remoto.

**Sincronização:**

- Teste real (emulador e dois contextos independentes): editar no computador → fechar → abrir no segundo → dado atualizado sem clique, com confirmação remota.
- Sem conexão: editar → fechar/reabrir → persistir; ao reconectar, aplicar exatamente uma vez, inclusive se a rede cair entre write e ACK.
- Primeiro acesso em dispositivo antigo offline não oferece edição sobre a geração anterior; primeiro acesso online recupera exatamente a geração canônica.
- Duas abas, mesmo UID, UIDs diferentes, clientes de gerações diferentes, reload durante flush, migração interrompida e lote incompleto.
- Mesmo registro editado em dois dispositivos offline: não perder nenhuma versão e não corromper a base.
- Delete/tombstone não ressuscita registros; replanejamento não apresenta metade de uma geração; duplicação de eventos automáticos proibida.
- Interface acessível, com status fidedigno e aviso de saída nos limites do navegador.

**Operação:**

- Testes Vitest + Playwright + Firestore Emulator executados localmente com evidências; revisão crítica independente quando disponível. Não alegar aprovação só com mocks.
- Publicação somente após gate explícito; pós-deploy conferir dois dispositivos reais, read-back, segurança, métricas e rollback pronto.
- Higiene Git: V1 exclusivamente, preservar V2; sem Actions novas, sem PRs/branches desnecessários; integração à `main` somente após autorização e proteções atendidas.

## 14. Responsabilidades e fora de escopo

**Incluído:** redesign do motor de sync da V1; migração de dados; governança da geração; segurança de sync; UX mínima de status; testes, integração segura, backup/rollback.

**Excluído:** reconstrução da V2, mudanças de interface geral do app, cronograma de estudos, mudança de framework, alteração da identidade Google/Firebase sem necessidade provada, integração de dados de outros dispositivos legados, sincronização bidirecional ativa de Cloudflare/Drive, automações GitHub Actions, publicação imediata.

## 15. Gate de aprovação e próxima etapa

1. **Agora:** aprovar ou corrigir esta SPEC (incluindo a escolha técnica do modelo híbrido); nenhuma implementação.
2. **Depois:** Superpowers writing-plans com preflight real de Git/GitHub, diff e riscos, tarefas TDD com critérios de aceite e gates de corte.
3. **Somente após aprovação do plano/GOAL:** Codex executa localmente em isolamento mínimo e entrega relatórios + ZIP de evidências. Deploy/migração produtiva dependem da autorização de ativação.

**Estado final deste documento:** `PROPOSTA_VERIFICADA_ESTATICAMENTE / APP_VALIDATOR_PENDENTE / EMULATOR_PENDENTE / IMPLEMENTACAO_NAO_AUTORIZADA`.
