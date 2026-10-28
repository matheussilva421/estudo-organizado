# Estudo Organizado V2 — F7: Homologação integrada, sincronização multi-dispositivo, migração e recuperação

**Status:** **SPEC PROPOSTA / NÃO APROVADA**. Este arquivo **não** concede autorização para Firebase real, acesso a dados reais, deployment, writing-plans ou implementação.  
**Pré-condições:** F1–F6 executadas/aceitas e integradas à `v2`; contratos A-02 e segurança local comprovados; spec e plano F7 revisados; autorização específica para cada uso de projeto Firebase de homologação isolado.  
**Objetivo:** qualificar o produto como sistema multi-dispositivo confiável antes de qualquer migração/cutover real. **F7 não coloca a V2 em produção.**

## 1. Sete funcionalidades F0 sob homologação final

| ID | Reformulação ou preservação exigida |
| --- | --- |
| `F-V1-FIRESTORE-SYNC` | **Reformular** snapshot legado para sincronização incremental controlada em Firestore Spark |
| `F-V1-CLOUDFLARE-SYNC` | **Reformular**: Cloudflare não deve atuar como peer autoritativo concorrente; preservar requisito de portabilidade/recuperação se aprovado |
| `F-V1-DRIVE-SYNC` | **Reformular**: Drive não deve atuar como segundo peer autoritativo; backup/export externo opcional apenas com gate próprio |
| `F-V1-SYNC-CENTER` | **Reformular** centro único de status/pendências/conflitos/ações |
| `F-V1-SYNC-DIAGNOSTICS` | **Reformular** diagnósticos sanitizados, explicáveis e portáveis |
| `F-V1-BACKUP-EXPORT-IMPORT` | Preservar exportação/restauração versionada, íntegra e independentes do sync |
| `F-V1-DATA-MANAGEMENT` | Preservar arquivamento, limpeza supervisionada e gerenciamento por perfil |

**Decisão humana reservada:** "REFORMULATE" não significa automaticamente remover Cloudflare/Drive como opções de exportação. O projeto aprovado mantém **Firestore como único sistema de sincronização remoto**; adaptadores opcionais de backup externo serão definidos apenas se comprovadamente gratuitos, seguros e autorizados. Nenhum upload/escopo Drive é autorizado por esta spec.

## 2. Subgates de homologação F7-A a F7-F

**F7-A — Auth Google, segurança e isolamento:** Firebase Auth Google Sign-In em **projeto de teste distinto**, credenciais de teste, desktop e navegadores mobile suportados. Primeiro vínculo do perfil com UID exige preview e consentimento; troca de conta ou logout bloqueia leituras/flush de UID anterior e não mostra dados cruzados. Rules no emulador e no ambiente **isolado** validam `request.auth.uid`, ownership, tipos, limites de tamanho, indexes, audit logging, leitura/gravação negadas a UID errado; nenhuma regra V1 de produção editada.

**F7-B — Sync incremental real:** esquema remoto com documentos por entidade/agregado limitado, cursor/versão/epoch, outbox IndexedDB transacional, operação ID imutável, CAS/transactions, ACK baseado em prova, rebaseline se cursor velho, conflito persistido e tombstone. `LOCAL_COMMITTED` → `REMOTE_COMMITTED` → `CONVERGED` somente quando cada etapa tem evidência. O SDK Firestore **não** mantém outra outbox autoritativa das mesmas gravações. Hooks automáticos após opt-in e enquanto app executa; app fechado não sincroniza por promessa fictícia.

**F7-C — Quotas Spark e custo zero:** estudo de leituras, escritas, deletes, index reads, reconexões, listeners, tamanhos, storage e bandwidth com 1/2/3 aparelhos e crescimento do acervo. Confirmar a documentação **na data do ensaio**, sem usar billing: hoje a edição Standard oferece 1 GiB, 50k reads/dia, 20k writes/dia, 20k deletes/dia e 10 GiB outbound/mês; há apenas **um banco gratuito por projeto**. TTL gerenciado, PITR e backup/restore gerenciados exigem faturamento e são proibidos. Definir margem de segurança aprovada e throttle/backoff; se a quota acabar, preservar dados locais e bloquear o flush com status honesto.

Fontes oficiais (verificar antes de executar): `https://firebase.google.com/docs/firestore/quotas`, `https://firebase.google.com/docs/firestore/pricing`, `https://firebase.google.com/pricing`, `https://firebase.google.com/docs/auth/limits`, `https://firebase.google.com/docs/firestore/manage-data/enable-offline`. **O cache offline padrão do Firestore é last-write-wins no mesmo documento; não substitui CAS e conflito conservador A-02.**

**F7-D — Backup, restore e migração:** exportação externa com formato próprio/versionamento, inventário e integridade, sem tokens, com tombstones/epoch; read-back real de backup sintético; preview antes de importar; restaurar em namespace isolado; auditoria de relacionamento e contagens. Fixture V1 schemas 12/11/9/7, DB 7/6, importação de edital/Reta Final portátil v1/v2, draft/journal, plano legado #107. Acesso a **dados reais V1 apenas mediante autorização futura específica**, preferindo cópia exportada voluntariamente e sanitizada; nenhuma escrita na V1 real. Migração falha fechado em perda ou ambiguidade.

**F7-E — PWA, armazenamento e segurança:** multiabas, sw update com formulário/timer em andamento, dois clientes de versões diferentes, storage quota, persistência do browser negada, XSS de texto importado, UID isolation, CSR/cookies/OAuth flows, nenhum segredo em logs/backup. Sem afirmar funcionamento offline indefinido: navegadores podem limpar armazenamento.

**F7-F — Piloto operacional isolado:** dados **sintéticos ou dados de teste expressamente autorizados**, PC/celular/tablet, duas abas, uma conta Google de teste; executar jornadas completas editar edital→planejar→estudar→revisar→dashboard→sync→backup→restore, coletando evidências. Sem apontar domínio/Firestore produtivo, sem publicação da V2 no endereço V1.

## 3. Contrato de sincronização A-02 e casos adversariais

- **Uma fonte de commit local:** IndexedDB V2; gravação de entidade/outbox atomizada. Commit local pode existir sem token Google, mas não deve ser enviado a UID sem vínculo.
- **Um backend remoto:** Firestore Spark, documentos/aggregados pequenos e versionados; nenhum snapshot global. Op ID + revisão de base + dedup segura contra replay; transações/CAS remotos falham offline, portanto fila é local e só envia quando possível.
- **Conflito conservador:** operações comutativas em entidades distintas mesclam, edições incompatíveis preservam versões, exclusão vs edição gera resolução humana, não LWW silencioso.
- **Cross-tab:** Web Locks/fallback comprovadamente seguro; se indisponível, sync pausa sem arriscar corrida. BroadcastChannel não é mutex.
- **Dispositivo antigo:** cursor/epoch abaixo da retenção segura → `RECOVERY_REQUIRED` e rebaseline **não destrutivo** com preview. Tombstones só compactados após protocolo seguro para clientes antigos.
- **Quota, rede, OAuth expirado e boot:** fila durável, retry limitado/backoff, status visível e nenhum ACK fictício. Contadores de pending/converged são auditáveis com read-back/cursor.
- **Privacidade:** perfil/UID isolados por Rules e por IndexedDB; logout ou troca de UID invalida listeners/operações do perfil anterior; logs não contêm conteúdo de estudos nem tokens.

## 4. Matriz de testes que impede a homologação prematura

| ID | Cenário isolado verificável | Exigência |
| --- | --- | --- |
| S01 | PC cria sessão, celular consulta, tablet confirma | Mesmo ID/fato, sem dupla contabilização, convergência verificada |
| S02 | PC e celular offline criam dados diferentes | Ambas as alterações sobrevivem e convergem |
| S03 | Mesmo bloco Reta Final editado offline em dois aparelhos | Duas versões persistidas, conflito claro, nenhuma perda |
| S04 | Deleção com tombstone vs cliente há meses offline | Registro não reaparece; cliente antigo força rebaseline |
| S05 | Timeout após commit remoto antes do ACK local | Read-back detecta efeito; replay não duplica |
| S06 | Duas abas tentam enviar mesma outbox | Uma aplicação lógica, ACK e revisions coerentes |
| S07 | Usuário A/B ou conta Google trocada | Nenhuma leitura/escrita/visualização entre UIDs |
| S08 | Documento >1 MiB / import com payload enorme | Rejeição sem truncar dados; esquema menor validado |
| S09 | 2/3 dispositivos com reconexões repetidas | Contagem e custo de operações conhecidos, orçamento Spark preservado |
| S10 | Quota excedida, Auth expirado, app fechado | Status verdadeiro, fila intacta, recuperação ao voltar |
| S11 | Backup com exclusão → restore antigo → sync | Não ressuscitar dados, recovery/preview correto |
| S12 | Snapshot V1 schemas/drafts/plano #107 | Contagens/IDs/proveniência reconciliados; ambiguidades bloqueadas |
| S13 | SW atualiza durante sessão/formulário | Sem perda de commit, prompts e versão compatíveis |
| S14 | Clear Data no perfil V2 com drafts/journal | Depois do consentimento, limpeza completa e verificável, sem tocar V1 |
| S15 | Rules negam leitura/escrita hostil/UID inválido | Falhas e rastros sanitizados; nenhum vazamento |
| S16 | Export/restore sem credenciais e sem Cloudflare/Drive como sync peers | Backup portátil, íntegro, read-back comprovado |
| S17 | Aplicação com parte dos testes E2E V1 falhos | Explicar cobertura substituta V2, não declarar que 107 FAIL viraram PASS |
| S18 | Storage local removido pelo navegador | Restaurar backup/import seguro e reconciliar remoto sem sobrescrever |

Os testes precisam demonstrar **evidência completa**, não só PASS de mocks. Se um cenário relevante não puder ser executado de verdade, marcar `NOT_RUN` ou `INCONCLUSIVE` e bloquear gate correspondente. Não adotar métricas de latência/consumo sem baseline medido; aceitação de custo inclui margem conservadora explícita.

## 5. Matriz de riscos F0 e critérios de mitigação

| Risco | Status inicial | Mitigação aceita somente após |
| --- | --- | --- |
| `R-V1-LEGACY-REMOTE-PLAN` | HIGH / UNVERIFIED | Fixtures legadas, transação condicionada, equivalência/ambiguidades, read-back real isolado e relatório |
| `R-V1-FIRESTORE-DOCUMENT-1MIB` | HIGH / UNVERIFIED | Limite real em SDK/emulador, fixtures grandes, custos e esquema delimitado sem perda |
| `R-V1-MULTITAB-OUTBOX-RACE` | HIGH / UNVERIFIED | Teste browser duas abas + coordenação/ACK real e reação a crash |
| `R-V1-BACKUP-TOMBSTONE-LOSS` | HIGH / UNVERIFIED | Backup→restore→cliente obsoleto→sync isolado sem ressurreição |

Riscos MEDIUM da F0: resíduos de drafts `clearData`, XSS via innerHTML, import JSON ilimitado, SW stale shell, quota local, timer refresh e drift de Rules; todos devem ter owner de teste e evidência no F2–F7. O status não é alterado automaticamente no inventário histórico V1; relatório de mitigação V2 diferencia risco legado de correção comprovada na V2.

## 6. Condições de aprovação e próximos gates

- Quatro HIGH têm resolução efetivamente testada **no contexto V2** ou bloqueio formal que impeça uso inseguro; nenhuma condição crítica ocultada.
- Funcionalidades de sync/backup/gestão de dados do inventário têm equivalência de capacidade e contratos de reforma aprovados.
- Regras por UID/Google Auth testadas, quota Spark medida, backup/restauração íntegros, teste de migração por schemas, navegador/dispositivos reais em piloto isolado, PWA compatível.
- Mapa de cobertura de 45 capacidades está reconciliado com testes F1–F7, com laboratório visual ainda `UNDECIDED` e exclusão validada da V2 inicial.
- Segurança/QA Impeccable e auditoria independente, nenhum FAIL material não aprovado, relatório de readiness e rollback/contingência para G5 preparados.
- F7 é **homologação**, não release. Não executar migração final, não apontar Cloudflare de produção, não habilitar billing, não fazer merge V2→main sem gate futuro.

**Decisões humanas pré-F7:** identificação/provisionamento de projeto Firebase Spark realmente **isolado**, regras de autorização e conta(s) Google de teste; critérios quantitativos após medição; limiar de amostras de migração e eventual teste com cópia real; políticas de backup/export Cloudflare/Drive (se desejadas). O plano F7 deverá ter gate explícito antes de qualquer chamada externa real.

**Gate:** `F7_SPEC_PROPOSED` → aprovação humana → writing-plans F7 → método/execução autorizados → emulador e testes isolados (dados sintéticos) → relatório → **F7_READY_FOR_HUMAN_REVIEW** → aceite humano. F7 aprovada **não** autoriza F8 ou G5.
