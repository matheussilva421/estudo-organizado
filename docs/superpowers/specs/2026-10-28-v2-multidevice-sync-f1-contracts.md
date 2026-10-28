# Estudo Organizado V2 — Pré-contratos de sincronização multi-dispositivo para F1 (A-02)

**Data:** 2026-10-28  
**Status:** PROPOSTA TÉCNICA PARA A SPEC F1 — **NÃO É A SPEC F1 APROVADA**  
**Decisão autorizadora:** Emenda arquitetural A-02 aprovada pelo usuário em 2026-10-28  
**Rastreabilidade:** D04, D05, D06 (com política operacional atualizada por A-02), D07, D08, D17, D18, D19, D22, D24, D26, A-02; auditoria F0 em \`docs/superpowers/audits/2026-10-19-f0-acceptance.md\`.  
**Gate:** F0 = \`READY_FOR_HUMAN_REVIEW\`; 46 destinos funcionais ainda \`PROPOSED\`; quatro riscos HIGH \`UNVERIFIED\`; F1 e implementação **NÃO AUTORIZADAS**.  
**Escopo:** contratos esperados, testes de aceite e decisões que faltam detalhar. Sem instalação, código, acesso à produção, billing ou deploy.

## 1. Intenção de produto e semântica de sucesso

Um estudante usa a **mesma conta Google** no computador, celular e tablet; salva conteúdo localmente mesmo sem internet; quando o aplicativo está ativo e a conexão/autenticação permitem, os dispositivos convergem automaticamente, sem comandos manuais no uso comum. Não garantir sincronização com a PWA fechada, convergência instantânea ou imunidade a falhas de rede. A prioridade é **nenhuma perda ou sobrescrita silenciosa**.

**Mudança explícita em D06 por A-02:** uso local sem login permanece permitido. O primeiro vínculo de um acervo local com Google e a ativação de sync exigem consentimento informado; após essa ativação, sync é automático **por padrão** e pode ser pausado/desativado, independentemente do modo local. A opção manual permanece como ação de diagnóstico/forçar checagem, não como passo cotidiano. Guardar a preferência por perfil local sem revelar conta ou dados de outros perfis.

**Três confirmações separadas:** (1) \`LOCAL_COMMITTED\` significa commit durável do dado e de sua intenção de envio; (2) \`REMOTE_COMMITTED\` exige confirmação da escrita remota condicionada, vinculada ao ID da operação/revisão; (3) \`CONVERGED\` exige reconciliação/read-back ou cursor remoto verificado e aplicação local das mudanças remotas. Não equiparar êxito de transporte ou ACK de timeout a convergência.

## 2. Fronteiras e fonte de verdade

- IndexedDB **exclusivo da V2 e de sua origem**, em ambiente/host/porta distintos da V1; fonte de verdade para **commits locais**. Dados essenciais, outbox e tombstones nunca são apagados como cache.
- Firebase Authentication com **Google Sign-In** para identidade; Firestore do plano **Spark** como único backend de sincronização. Firestore é fonte de mudanças remotas confirmadas; não substitui os commits locais enquanto offline.
- Sem Cloudflare KV/Google Drive atuando como segundo peer autoritativo de sync. Backup é exportação/restauração independente.
- Apenas **um coordenador durável de outbox** para mutações próprias da aplicação. Não habilitar uma segunda fila concorrente de writes offline do SDK Firestore para os mesmos registros; o SDK pode ser usado para operações remotas explicitamente coordenadas.
- Cloud Firestore não armazena um snapshot inteiro do estado em documento único. A arquitetura remota se baseará em **entidades ou agregados com limites por documento**, identificação estável, separação de dados acadêmicos de telemetria operacional e consultas incrementais. Coleções, índices e granularidade exatos serão decididos por spec F1 a partir de estimativas de leituras, escritas, tamanho e segurança.
- Não criar servidor, Cloud Functions, billing, Actions, automação remota paga ou multi-cloud obrigatório.

## 3. Contratos públicos preliminares

As assinaturas abaixo são **contratos conceituais para revisão**, não interfaces de código aprovadas nem indicação de que os módulos existem.

| Porta / caso de uso | Pré-condições | Pós-condição verificável |
| --- | --- | --- |
| \`commitLocal(command, baseRevision)\` | Dados válidos; perfil local ativo; transação IndexedDB disponível | Entidade + registro durável de operação na **mesma transação**, com \`operationId\` imutável; erro se falhar |
| \`activateGoogleSync(profile, uid, consent)\` | Login Google válido, prévia dos conjuntos local/remoto e decisão explícita de vincular | Binding perfil↔UID sem mescla destrutiva; sync automático habilitado para esse perfil |
| \`requestSync(reason)\` | Sync habilitado, usuário autenticado, app ativo e conexão disponível | Agenda trabalho limitado/deduplicado; não inventa sucesso quando bloqueado |
| \`processOutbox(leaseOrLock, budget)\` | Uma coordenação cross-tab válida, operações pendentes e revisão-base | Tentativa idempotente com pré-condição remota; ACK somente de operação confirmada |
| \`pullChanges(cursor, uid)\` | UID vinculado, cursor/versionamento compatíveis, rules autorizando | Aplicação transacional local das mudanças válidas e cursor de leitura correspondente |
| \`resolveConflict(conflictId, choice)\` | Duas versões/proveniências preservadas, autorização e revisão atual | Nova intenção local com origem registrada; nenhuma das versões some sem trilha |
| \`restoreBackupSafely(manifest, preview, consent)\` | Backup versionado íntegro e compatível, preview e aceite específicos | Commit/recuperação controlada; rebaseline/reconciliação antes de escrever remoto |
| \`getSyncHealth()\` | Qualquer estado | Estado local/remoto, pendências, último sucesso verificável, erros sanitizados e ações seguras |

**Envelope lógico da operação**, a confirmar e versionar na F1: \`operationId\`, \`profileId\`, \`entityType\`, \`entityId\`, \`mutationKind\`, \`baseRevision\`, \`schemaVersion\`, \`payload\` (ou diff validado), \`createdAt\` apenas para diagnóstico, \`status\`, \`attempts\`. Não persistir token OAuth, credenciais nem dados de outro UID no envelope. Timestamp não substitui causalidade. IDs de operação não podem ser reciclados entre sessões.

**Entrega efetivamente única:** admitir transporte *at least once*; alcançar efeito idempotente mediante ID, deduplicação transacional e revisão causal. Não afirmar *exactly-once transport*. Um timeout após commit remoto exige leitura/reconciliação antes de repetir o efeito.

## 4. Estados mínimos de identidade e sincronização

- \`LOCAL_ONLY\`: dados locais disponíveis sem conta; sem chamadas remotas.
- \`LINKING\`: prévia dos acervos e associação explícita à conta; **não** mesclar implicitamente na primeira autenticação.
- \`READY\`: conta e preferência habilitadas, aguardando condições adequadas.
- \`SYNCING\`: operações limitadas e coordenadas em andamento.
- \`PENDING_OFFLINE\`: local salvo, rede indisponível; fila retida.
- \`PAUSED_AUTH\` / \`PAUSED_QUOTA\`: não insistir sem limites, dados locais preservados.
- \`CONFLICT\`: alternativas e evidências duráveis, com ações de reconciliação; sync não bloqueia domínios não relacionados.
- \`RECOVERY_REQUIRED\`: esquema/cursor/retenção/backup incompatíveis; proibir escrita remota insegura até rebaseline/aceite.

A UI mostra, separadamente, \`salvo neste dispositivo\`, \`pendente de sincronização\`, \`sincronizado com a nuvem\`, \`outros dispositivos atualizados até ...\` **apenas quando verificado**, \`conflito\`, \`atenção necessária\`. Não prometer que dispositivos offline estão atualizados.

Ao sair/entrar em conta diferente, não reatribuir acervo silenciosamente. Manter isolamento por perfil/UID, interromper processos e invalidar credenciais/cursor de sessão anterior. A decisão de vincular dados existentes a outra identidade depende de preview e consentimento.

## 5. Fluxo de escrita, leitura e reconciliação

1. UI emite comando; domínio valida invariantes e relacionamento; IndexedDB confirma **atômica** alteração + intenção de outbox. Falha/quota: sem falso indicador de sucesso.
2. Coordenador automático acorda em boot, commit local, retorno da rede e recuperação de autenticação, **somente enquanto o app puder executar**; usa batch pequeno, backoff exponencial com jitter e teto de tentativas até mudança de condição. Não fazer busy loop.
3. Antes do flush, coordenação interabas por Web Locks quando suportado, mais prevenção durável de replay. BroadcastChannel apenas notifica; não é garantia de exclusão. Estratégia de fallback segura (IDB lease + fencing/revisão ou suspender flush concorrente) será especificada e testada antes de habilitar sync.
4. Operação remota usa transação/CAS e identidade de operação com deduplicação; revisar *read/write amplification* da estrutura escolhida. Em conflito real, não usar last-write-wins silencioso; manter cópias para revisão.
5. ACK e avanço da outbox ocorrem somente após confirmação remota ou leitura que prove aplicação anterior. Em seguida, obter mudanças incrementais por cursor/revisão; validar versões, UID, tipos e invariantes; aplicar localmente de forma transacional.
6. Escolher estratégia de escuta de mudanças remotas (listener limitado, pull incremental ou híbrido), com suspensão quando a tela estiver inativa e prova de rebaseline após desconexão prolongada. **Sem listener irrestrito no histórico**; custos devem ser medidos, não presumidos.
7. Clientes com cursores antigos ou exclusões além da janela segura entram em \`RECOVERY_REQUIRED\` e fazem snapshot/rebaseline não destrutivo após exame de mudanças locais pendentes.

## 6. Conflitos e exclusões

- Entidades distintas e operações comprovadamente comutativas convergem automaticamente.
- Mesmo campo alterado em paralelo, exclusão vs edição, revisão-base desconhecida, violação de relacionamento e plano legado ambíguo geram conflito **persistido**. Preservar os dois lados e origem até resolução.
- Para o plano de Reta Final legado (issue #107), **não** deduzir inexistência a partir de campos v2 ausentes. Normalizar formato legado, comparar intenção material; equivalência demonstrada permite vínculo/adoção condicionada e sem perda; divergência exige revisão humana. O adaptador não deve gravar na V1.
- Tombstones contêm ao menos entidade, ID, revisão causal, ID da exclusão, proveniência e política de retenção. Backup V2 preserva histórico mínimo para impedir ressurreição; um backup antigo sem piso/época suficientes precisa de rebaseline seguro antes de reativar envio.
- Compactação de tombstones não é TTL arbitrário. Requer protocolo de epoch/ack de dispositivos ou mecanismo equivalente que force clientes antigos a rebaseline. Granularidade final e política de remoção: decisão aberta da spec F1.

## 7. Custo gratuito, segurança e ambientes

- **Custo recorrente obrigatório R$ 0**: usar Google Sign-In via Firebase Authentication e Firestore Spark. Antes da F1/F7, confirmar documentação **atual** de cotas/limites e elegibilidade dos serviços; não extrapolar cota gratuita, habilitar faturamento ou criar Cloud Functions.
- Definir orçamento por operação (leituras, escritas, tamanhos, reconexões, listeners e índices); simular o perfil de uso em 1, 2 e 3 dispositivos, testes de histórico grande, offline prolongado e reconexões repetidas. Preferir limite conservador e diagnóstico em vez de sobrecarga.
- Falta de rede, quota, rate limit e suspensão do navegador geram \`PENDING_OFFLINE\` ou \`PAUSED_QUOTA\`, sem descarte de outbox e sem prometer data/hora exata de convergência.
- Regras Firestore estritas por \`request.auth.uid == uid\`, esquemas/tamanhos permitidos e permissões mínimas; emulador para cenários multiusuário; Google Sign-In em desktop e mobile. Não acessar projeto de produção para homologação.
- Firebase Emulator Suite e dados sintéticos para testes; homologação remota em projeto **isolado**, sem dados reais e com autorização específica. Sem publicações na V1.

## 8. Matriz de testes vinculada aos quatro HIGH — nenhuma mitigação comprovada ainda

| ID F0 | Contrato/mitigação proposta | Teste obrigatório | Momento |
| --- | --- | --- | --- |
| \`R-V1-LEGACY-REMOTE-PLAN\` | Adaptador de legado + equivalência semântica + CAS | Fixture com 180 blocos equivalentes/divergentes, nota diferente, read-back, idempotência e ausência de overwrite | F1 contrato; F7 emulador |
| \`R-V1-FIRESTORE-DOCUMENT-1MIB\` | Documentos/agrupamentos remotos delimitados, histórico operacional fora de payload acadêmico | Fixtures >1 MiB, payload válido, limite real e margem de segurança, contagem de operações/índices, sem truncar estudo | F1 orçamento; F7 emulador |
| \`R-V1-MULTITAB-OUTBOX-RACE\` | Web Locks + ACK idempotente + CAS; fallback seguro | Duas abas sincronizando simultaneamente; retry após timeout de ACK; uma aplicação lógica e fila íntegra | F1 simulação; F7 E2E/emulador |
| \`R-V1-BACKUP-TOMBSTONE-LOSS\` | Tombstone durável + backup versionado + rebaseline seguro | Excluir→backup→restore antigo→sincronizar; nenhuma ressurreição silenciosa; dispositivo desatualizado | F1 contrato; F7 emulador/restore |

**Status desses quatro riscos permanece \`HIGH / UNVERIFIED\`.** A aprovação de A-02 aceita o plano de prevenção, **não** muda severidade, não valida os cenários nem mitiga riscos da V1.

Testes adicionais: PC→celular→tablet; offline em dois dispositivos; edição concorrente da mesma entidade; app fechado e reaberto; logout/login com UID distinto; duplicação de eventos; Service Worker antigo; quotas; migração V1↔V2 somente em cópia sintética; restauração com operações locais pendentes; regras Firestore para UID indevido.

## 9. Decisões ainda abertas para detalhamento em F1

1. Estrutura física Firestore (entidade vs agregado, índices, cursor e estratégia híbrida de leitura). Comparar pelo menos duas alternativas com estimativa de custos e escala.
2. Formato físico do IndexedDB V2, relação outbox/entidade, transações e versão de esquema V2 independente da versão 12 legada.
3. Protocolo de deduplicação remota e tombstones, epoch/GC, clientes desatualizados e limites de armazenamento operacional.
4. Fallback cross-tab para navegadores sem Web Locks e governança de locks vencidos.
5. Orçamento mensurado de leituras/escritas/conexões, tamanhos máximos de documento/lote, tolerância a quota e ritmo de retry.
6. Políticas de UX para conflitos reais, onboarding Google e vínculo a conjuntos de dados locais.
7. Versão independente do formato de backup e mecanismos de validação/restauração.
8. Triagem dos 107 FAIL E2E do mock V1: distinguir falhas de harness/fixture de regressões reais, sem alterar V1 na F1.
9. Reconciliação documental dos schemas V1 12/11/9/7, IndexedDB 7/6, backup legado e tombstones; transformar em ADRs sucintas antes da implementação correspondente.

Estas decisões devem aparecer na **spec F1 a submeter à revisão humana**; só depois do aceite será redigido o writing-plans executável e solicitado G3/F1. **Não iniciar código ou serviços apenas por este documento.**

## 10. Critérios de aceitação futuros e gates

- Google Auth vincula a identidade de forma explícita; V2 opera sem login e sem internet.
- Sync é automático após opt-in, sem botão manual como requisito de uso diário, e respeita pausa/disable.
- Todo dado salvo localmente sobrevive a reload e se torna sincronizável quando a condição permitir.
- Nenhuma atualização ou exclusão silenciosa em concorrência, recuperação, rebaseline ou backup.
- Operações e ACK são idempotentes; erros de quota/rede mostram estado verdadeiro.
- Testes multiaba/multidispositivo, isolamento por UID, matriz de FAIL/NOT_RUN, custo e performance são comprovados antes de homologação.
- A F0 continua \`READY_FOR_HUMAN_REVIEW\`: aprovação da A-02 **não aprova os 46 destinos funcionais nem altera o gate F0**.
- F1 continua **não autorizada**: este documento é subsídio para sua futura spec, não um GOAL, plano ou implementação.
