# Estudo Organizado V2 — F8: Migração final, cutover, estabilização e encerramento

**Status:** **ESPECIFICAÇÃO PROPOSTA / NÃO APROVADA.** Nenhuma execução autorizada; este documento **não concede o G5**, não autoriza alterar `main`, Firebase, Cloudflare, domínio, banco, credenciais ou dados reais.  
**Pré-condição obrigatória:** F1–F7 com evidências revisadas, código integrado à branch `v2` e F7 homologada em ambiente isolado; procedimentos de backup/restore e migração ensaiados.  
**Objetivo:** colocar V2 em funcionamento principal **sem perder estudos**, preservar contingência e encerrar o trabalho após integração/limpeza/documentação comprovadas.

## 1. Estados e fronteiras da migração

- **PREPARED:** pacote V2 e plano de release com proveniência/commit, hashes e testes; V1 permanece autoritativa e ativa.
- **G5_WAITING:** checklist completo, risco residual explícito e autorização humana pendente. **Não** iniciar freeze, escrita real, deploy ou cutover.
- **FROZEN_V1:** após G5, impedir novas gravações V1 por mecanismo **verificado** e coordenado entre abas/dispositivos, ou impor janela de manutenção com backup + confirmação humana. Não confiar apenas em desativar botão UI. Controle deve cobrir origin, Firestore e outbox V1; se não for possível garantir, STOP e reformular procedimento.
- **SNAPSHOT_VERIFIED:** backup externo V1 versionado e verificado por read-back e restauração isolada, com manifesto/contagens; dados privados não enviados a ferramenta externa não autorizada.
- **MIGRATED_V2:** cópia V1 → transformadores aprovados → base V2 separada, com reconciliação de IDs/relacionamentos/tempos/tombstones/históricos e relatórios de perdas/ambiguidades.
- **V2_SINGLE_WRITER:** somente V2 aceita novas gravações oficiais após autorização, com leitura remota correta da conta Google; V1 não pode continuar enviando snapshots antigos à mesma linhagem.
- **STABILIZING:** piloto real autorizado e monitoramento de integridade/status, backups e indicadores em PC/celular/tablet; rollback/contingência prontos, sem apagar dados criados após o corte.
- **CLOSED:** aceite humano de produção, integração na `main` conforme política e proteção, publicação efetivamente validada, saneamento Git seguro e documentação final concisa.

**Distinção:** `MAIN_MERGED`, `PRODUCTION_DEPLOYED`, `DATA_MIGRATED` e `CUTOVER_ACCEPTED` são fatos **independentes**, não gatilhos automáticos entre si.

## 2. Pré-flight G5 — evidências que o usuário deverá aprovar

| Área | Condição de entrada obrigatória |
| --- | --- |
| Funcionalidades | 45 destinos aprovados entregues/dispensas formalizadas; `F-V1-VISUAL-LAYOUT-LAB` `UNDECIDED` fora da V2 inicial por adiamento aceito |
| Integridade | 4 HIGH F0 com provas de defesa V2 e sem cenário crítico pendente; status de riscos V1 não reclassificado sem evidência |
| Testes | Unitários, integração, E2E, mobile/desktop/tablet, offline, duas abas, dois aparelhos, idempotência, backup e restore, QA A-01 |
| Google/Firestore | Google Sign-In e Rules por UID, Firestore Spark sem billing, índice/payload/cursor/ACK/read-back, orçamento e quotas com margem |
| Migração | Todos os formatos V1 efetivamente encontrados cobertos ou exceções explícitas; ensaio em cópia isolada e relatório reconciliado |
| Segurança | Credentials, XSS, CSP, sanitização de logs, isolamento conta e dispositivos, SW/IDB incompatíveis e storage removido testados |
| Reversão | Backups V1 testados, rollback/retorno documentado sem assumir downgrade de IDB; preservar trabalho criado na V2 |
| Publicação | Destino de Cloudflare/dominios, rotas, URLs, cache, SW, secrets e gatilhos externos auditados; não criar GitHub Actions novas |
| GitHub | HEAD `main`/`v2`, commits exclusivos, worktrees, PRs/branches, diff/arquivos de produção, evidências de testes e gate humano |
| Consentimento | Identidade do acervo e conta Google, uso de dados reais, janela/freeze, plano de comunicação, ação humana de cutover explícita |

**Critério inegociável:** nenhuma perda silenciosa, nenhum duplo escritor produtivo e nenhum corte com backup não restaurável.

## 3. Procedimento transacional de cutover — proposta

1. **Pré-corte (somente leitura):** fotografar HEADs e ambientes; inventariar V1+V2, abrir checklists e relatório de readiness; conferir quota/billing, auth domains, Rules/índices, permissões de release, dados não integrados, processos em execução e área de rollback. Nada de limpeza Git nessa etapa.
2. **Gate humano G5:** aprovação específica do checklist, fonte/destino real de dados, janela, plano de freeze, backup, migração, infraestrutura/URLs e possibilidade de parada; se faltar dado material, adiar.
3. **Congelar V1:** informar manutenção; impedir novos writes e sincronizações pendentes da V1 de maneira verificável **em todas as origens/dispositivos**, ou interromper se impossibilidade; registrar último estado consistente e outbox com IDs/ACKs.
4. **Backup V1:** exportação autorizada do acervo real, manifesto e hash, cópia fora do browser em local controlado, teste de restauração read-only em ambiente isolado; preservar token OAuth fora do arquivo. Não deletar banco/cloud V1.
5. **Migração em staging:** aplicar transformadores por schema verificado, detectar IDs duplicados, referências órfãs, conflitos de plano #107, tombstones e revisões/medidas. Compare contagens de editais, disciplinas, assuntos, aulas, planos, blocos, sessões, tempos válidos, questões, hábitos, revisões e preferências; todos os desvios são itens explícitos de relatório.
6. **Validação humana da reconciliação:** o usuário aprova exceções materiais antes de ativar escrita V2 real; casos indecidíveis ficam em quarentena acessível e não são silenciosamente descartados.
7. **Ativar V2 como autoridade:** publicar/configurar domínio após gate, checar asset manifest/SW, autenticação Google, conta/UID, índices/Rules, sync read-back, abrir em dispositivos controlados; não habilitar escrita simultânea V1. Registrar momento exato do corte e versão.
8. **Estabilização:** monitorar indicadores locais de status/pendências/erro por dispositivo, consumo Spark, novos registros e backups, repetir testes de ponta a ponta e conferir divergências com amostra do acervo V1. Atualizar usuário com estado factual.
9. **Encerramento:** integrar mudanças validadas à `main` somente se autorizado e proteções permitirem, verificar a aplicação publicada e recibo de migração/backup; sanear branches/worktrees/PRs sem apagar commits únicos; preservar V1 histórico e eventuais métodos de retorno documentados. Encerrar a issue #108 apenas quando critérios de produção estiverem realmente demonstrados.

## 4. Contingência e retorno seguro

- **Antes de ativar V2 real:** se migração/QA falhar, V1 permanece congelada até decisão humana, backups íntegros; restabelecer V1 somente quando não houver perda de alterações já confirmadas no corte.
- **Depois de registrar novas sessões na V2:** rollback para V1 **não** é trocar URL ou baixar versão do app. Preservar primeiro export/backup V2, registrar deltas pós-corte e testar compatibilidade; não sobrescrever V1 com snapshot antigo ou permitir que outbox V1 antiga apague conteúdo novo.
- Retorno pode ser read-only/maintenance, restauração supervisionada ou plano de compensação; exigir análise de diferença de esquemas e autorização para operação destrutiva. Se não houver retorno seguro, priorizar manutenção V2 e recuperação do acervo.
- Não usar `git reset --hard`, force push, apagar banco remoto ou deletar backup como "rollback". Não permitir "limpar dados" em perfis/UIDs inadvertidos.

**Cenário de perda de conexão durante corte:** stop no último ponto verificável, revalidar IDs de operações, backups, estado de escrita e cursores; não repetir migração em modo append sem idempotência.

## 5. Ensaios finais e monitoramento

**Ensaios obrigatórios pré-G5:** simular freeze de dois dispositivos e aba antiga, backup/restauração V1 real somente se autorizada e isolada, migração com interrupção após cada checkpoint, destino com quota insuficiente, Firestore Rules negando escrita, OAuth expirado, SW antigo ainda aberto, edição em dois aparelhos, botão "voltar V1", ressurreição por tombstone e backup incompleto. Demonstrar que cada falha preserva dados e bloqueia publicação incorreta.

**Readiness técnico:** sem FAIL material crítico, sem dependências externas pagas, sem diferença de dados não explicada, manual de recuperação testado, usuário consegue executar as jornadas principais offline e retomar online. Não prometer convergência com app fechado.

**Verificação pós-corte:** login Google nos dispositivos, fluxo edital→plano→sessão→revisão→dashboard, sincronização A-02 e restauração independente, quota Spark e logs sanitizados. Falha de produção exige registro e triagem; "deploy successful" não significa "dados migrados".

## 6. Autorizações humanas específicas e gates

**G5 é humano e posterior a F7**. O usuário deverá autorizar:
- acesso ao acervo/backup real e conta Google adequada;
- escolha do destino de produção e janela de freeze;
- migração final com prévia e plano de backup/contingência;
- mudanças Cloudflare/Firestore e integração/publicação na `main` conforme proteções;
- qualquer exclusão, fechamento de estruturas com trabalho exclusivo ou operação destrutiva.

A autorização para implementar F1–F7 não concede autorização G5. A publicação desta spec também não. As escolhas de URLs, formatos exatos, responsável pelas operações, janela de corte e plano de retorno serão detalhadas com evidência no writing-plans F8 **após o aceite da spec e da F7**.

## 7. Definição de projeto concluído

A V2 só pode ser declarada **PROJETO CONCLUÍDO** se houver:
1. registro de aceite de todas as fases F0–F8 e dispensa explícita de eventuais funcionalidades fora de escopo;
2. matriz de 45 features atendidas ou justificadas, único laboratório visual com decisão adiada e visibilidade de seu backlog;
3. dados reais migrados com reconciliação e backup externo restaurável;
4. Google Auth/Firestore Spark real, offline, conflito/convergência, PWA e segurança homologados sem custo recorrente e sem perda silenciosa;
5. UI final testada com A-01 em oito temas e dispositivos;
6. evidência de versão/commit integrada na `main` com autorização e produção realmente publicada;
7. higiene Git concluída com zero trabalho exclusivo descartado, PRs/worktrees obsoletos tratados e sem Actions novas;
8. documentação de manutenção mínima (estado, backup, recovery, limites do Spark, como atualizar) e issue #108 encerrada **somente após prova final**;
9. decisão expressa do usuário aceitando a V2 como aplicação principal.

Se um gate ficar bloqueado, registrar exatamente motivo, risco, evidência e próxima ação; não relatar fase concluída por teste verde isolado.

**Estado ao criar esta spec:** F1 writing-plans aprovado, GOAL preparado, G3/F1 ainda sem execução; F2–F8 specs são **propostas**, não autorizam writing-plans nem instalação/código. A V1 segue intacta em `main`.
