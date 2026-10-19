# Editor Inteligente da Reta Final — especificação formal

**Data:** 2026-10-19  
**Repositório:** matheussilva421/estudo-organizado  
**Base examinada:** main @ eb8cc6cfcc443bbd8bf8272f736447929272d183  
**Processo:** Superpowers / brainstorming arquitetural  
**Estado:** PROPOSTA DE DESIGN — AGUARDANDO ACEITE HUMANO  
**Efeito:** somente documentação; não autoriza writing-plans, migração, código ou merge

> A aprovação das 13 decisões e das sete seções consolidadas autorizou exclusivamente a escrita e revisão deste documento. A aprovação desta especificação autorizará apenas a elaboração do plano de implementação, sujeito a aprovação separada.

## 1. Objetivo, usuário e sucesso

Transformar a Reta Final de cronograma importado em ambiente editável e seguro, mantendo integrado Calendário, Histórico, Cronômetro, editais, aulas, assuntos, revisões e indicadores. O usuário deve clicar em um assunto e ver o texto **integral**, mesmo quando o card apresentar elipse, e poder editar datas, duração, conteúdo, ordem, prioridade e carga semanal, individualmente ou em massa, sem reimportar JSON.

Critérios de sucesso: consulta com um clique; edição em rascunho recuperável; comparação antes de aplicar; distribuição explicável; estudos passados imutáveis por padrão; convergência de edições não conflitantes entre dispositivos; conflitos explícitos; JSON legado aceito; recuperação de versões e acessibilidade em desktop/tablet/celular.

**Não objetivos:** reescrever todos os tipos de planejamento; reestruturar o banco de editais; alterar registros históricos por inferência; transformar Google Drive/Cloudflare em sync primário; exigir IA remota, novas despesas ou framework frontend; colaboração multiusuário; mudança da data oficial da prova.

## 2. Decisões vinculantes e escopo

Estas decisões foram aprovadas individualmente em 2026-10-19:

| ID | Decisão | Requisito |
|---|---|---|
| D01 | Editor completo, C | Criar, consultar, alterar, mover, duplicar e remover blocos |
| D02 | Interface híbrida, C | Consulta + painel lateral + Modo Planejamento |
| D03 | Histórico protegido, C | Sessões, questões, revisões e tempo permanecem íntegros |
| D04 | Redistribuição assistida, C | Simular, comparar e confirmar; não aplicar automaticamente |
| D05 | Capacidade inteligente, C | Horas/dia, folgas, exceções e fixações |
| D06 | Prioridade híbrida, C | Intenção manual, peso edital e desempenho confiável |
| D07 | Catálogo integrado, C | Vincular existentes e criar novos sem duplicação silenciosa |
| D08 | Sync granular, C | Mesclagem compatível e conflitos explícitos |
| D09 | Versões completas, C | Undo/redo, checkpoints, restauração seletiva |
| D10 | Importação supervisionada, C | Comparação de JSON e aprovação das diferenças |
| D11 | Rascunho transacional, C | Isolamento, durabilidade e commit confirmado |
| D12 | Operações em massa, C | Seleção, prévia, segurança e tudo-ou-nada |
| D13 | Gestão temporal híbrida, C | Atrasos, rolagem protegida e limite de prazo |

As sete seções aprovadas incluem interface, domínio e integridade, rascunhos/commit, motor de planejamento, sincronização, interoperabilidade/recuperação e validação.

## 3. Estado atual e pontos de integração

O projeto é SPA/PWA local-first em HTML/CSS/JavaScript ES modules, sem framework. IndexedDB é fonte de verdade local; Firestore é canal remoto primário quando habilitado; Cloudflare e Google Drive são backup/restore secundário manual.

Arquivos existentes diretamente envolvidos:

- src/js/views/reta-final-view.js: cards, filtro, foco do dia e KPIs; no render chama syncRetaFinalToEventos.
- src/js/views/reta-final-import.js: parse/validação/prévia/ativação de JSON v1.
- src/js/logic/reta-final-core.js: matching, cálculo de métricas, rolagem e reconciliação.
- src/js/logic/reta-final.js: importação, materialização de eventos, quick-mark e associação a sessões.
- src/js/ui/actions/reta-final.js: dispatcher de ações.
- src/js/registro-sessao/session-topics.js: integração multiassunto com registro.
- src/js/sync/sync-center.js: planejamento singleton sob LWW por updatedAt; merge de eventos e reconcile.
- src/js/store/indexeddb.js: EstudoOrganizadoDB v6, estado atual/anterior, outbox e conflitos.
- src/js/sync/firestore-schema.js, firestore-sync-engine.js e sync-coordinator.js: envelope, revisão e envio remoto.
- docs/api/sync-contract.md: snapshot de fallback e modelo entity-primary.

**Compatibilidade obrigatória:** preservar contratos de eventos rfBlocoId, assId e aulaId, sem criar uma segunda fonte de verdade para sessões. A view, o motor puro de domínio, a orquestração e a camada de persistência continuam separados. Não incorporar toda a feature a um único módulo extenso. Manter ações delegadas por data-action.

## 4. Domínio, identidades e campos

### 4.1 Planejamento e blocos

Permanece o singleton state.planejamento com tipo reta_final e retaFinal.blocos. O novo domínio distingue a identidade do plano e a identidade imutável do bloco.

**Plano:** planId imutável por linhagem, schemaVersionRetaFinal=2, revision de alteração humana monotônica, updatedAt de autoria, nome, dataFinal, minutosPadrao, capacidade/folgas/exceções, regras de prioridade, blocos e metadados de proveniência.

**Bloco:** id estável já vinculado a eventos via rfBlocoId; discId; lista ordenada topicos de assId/aulaId; minutos positivo inteiro; posição/ordem estável; prioridade opcional; observação contextual; fixação; dataOriginal; **dataPlanejada** (intenção humana canônica); metadata de revisão; estado de arquivamento.

**Projeção temporal e acadêmica:** dataEfetiva, atraso/rolagem, não alocado, não coberto, concluído e métricas são derivados, sem autoridade para incrementar revisão. Campo legado data pode subsistir como projeção compatível. dataEstudo de eventos estudados permanece independente.

**Registros adicionais:** RetaFinalDraft (draftId, planId, baseRevision/digest, operações, estado), Operation (operationId, target, antes/depois, baseRevision, deviceId, timestamp), Checkpoint (versão recuperável, integridade, origem, retenção), Conflict (base/local/remoto, campo, causa e resolução).

Identidades não dependem de posição ou título. Datas civis são YYYY-MM-DD em calendário local (sem interpretação UTC que mude o dia); timestamps de revisão UTC.

### 4.2 Invariantes obrigatórias

- **INV01:** status concluído é reconciliado da evidência de evento estudado. Edição do planejamento não equivale a estudar.
- **INV02:** editar, mover, arquivar, duplicar, importar ou restaurar um bloco não altera silenciosamente dataEstudo, tempoAcumulado, questões, páginas, revisões ou dados históricos.
- **INV03:** eventos históricos e preservados mantêm rfBlocoId e dados próprios; exclusão de bloco referenciado preserva alvo lógico recuperável.
- **INV04:** MOVE conserva id; DUPLICATE emite id novo e nenhum evento/tempo/questão clonado.
- **INV05:** desvincular assunto/aula de um bloco não apaga a entidade do edital. Anotação de bloco não renomeia entidade compartilhada.
- **INV06:** evento estudado não é retitulado, transferido de disciplina ou reclassificado automaticamente por mudança futura de bloco.
- **INV07:** bloco com cronômetro ativo não aceita operação estrutural incompatível até a pausa/encerramento do timer; bloco com tempo registrado exige revisão explícita.
- **INV08:** rascunhos não alteram eventos, KPIs oficiais ou state.planejamento.
- **INV09:** rolagem, reconcile e métricas não alteram revision ou updatedAt da intenção.
- **INV10:** matching ambíguo não seleciona a primeira entidade homônima automaticamente.
- **INV11:** ações de risco exibem preview; operações em massa são atômicas no draft e no commit.
- **INV12:** toda restauração é nova operação versionada, sujeita às mesmas regras de conflito e histórico.

### 4.3 Migração legado → v2

Gerar planId de forma persistente e idempotente para planos legados, conservar TODOS os id/rfBlocoId e vínculos assId/aulaId. Para blocos sem dataPlanejada: quando rolagens>0 e dataOriginal válida difere de data, tratar dataOriginal como intenção conhecida e data atual como derivação; nos demais casos, dataPlanejada=data. Guardar dataOriginal sem alteração. Estados irrecuperavelmente ambíguos permanecem intactos e são sinalizados para reparo humano, sem descartes.

Migração local deve ter backup/rollback, checksum, não mudar estudos históricos, não contar normalização derivada como edição humana e não executar uma nova ativação/importação. Um segundo carregamento ou atualização de app não poderá gerar nova identidade do mesmo plano.

## 5. Interface e interações

### 5.1 Consulta

Clique, Enter ou espaço no título abre um painel de **visualização integral**, preservando todas as linhas, sem truncamento, com disciplina, tópicos, aulas, datas original/planejada/efetiva, duração, prioridade, status e associações de estudos. A consulta padrão é somente leitura; botão Editar entra em rascunho.

### 5.2 Edição individual e planejamento

Painel lateral no desktop; disposição adaptativa no tablet; sheet/tela cheia no celular. Modo Planejamento: calendário dia/semana, filtros, seleção múltipla, drag-and-drop e alternativas equivalentes por teclado/toque (mover para data, alterar ordem). Pode editar disciplina, conteúdos, duração, data, prioridades, notas e fixações. Buscar e criar assuntos/aulas no catálogo respeita nomes normalizados, IDs e ambiguidades. Novas entidades só são materializadas no commit.

Ações coletivas: MOVE, DUPLICATE, SET_DURATION, SET_PRIORITY, REDISTRIBUTE, ARCHIVE. Selecionar tudo diferencia resultados filtrados de todos os blocos do plano. Antes de executar, informar quantidade, datas, horas, status protegidos, conflitos e eventual falha total. O comando coletivo produz alterações no rascunho, jamais alterações oficiais parciais.

### 5.3 KPIs e status

Exibir distintamente números **oficiais** (estado aplicado e eventos reais) e **simulados** (resultado do draft). Indicar rascunho salvo, pendência, validação, conflito, aplicado localmente, aguardando nuvem e sincronizado. Não afirmar sync após simples gravação local.

Preservar identidade visual de PRODUCT.md/DESIGN.md, oito temas, contraste WCAG AA, foco visível, alvos de toque ≥44px, navegação completa por teclado e prefers-reduced-motion. Fechar detalhes não interrompe cronômetro.

## 6. Comandos puros e ciclo transacional

### 6.1 Contratos

Serviços de domínio sem DOM/store/rede receberão plano imutável, contexto, operação e data de referência e retornarão {proposal, diff, diagnostics, valid}. Comandos conceituais: createBlock, updateBlock, moveBlocks, duplicateBlocks, archiveBlocks, setCapacity, setPriority, proposeRedistribution, compareImport, restoreCheckpoint e validateProposedPlan. Nomes não impõem arquivos específicos. Todas as operações usam operationId estável para deduplicação e geram diff reproduzível.

### 6.2 Máquina de estados do draft

Estados válidos: **editing → validating → ready → applying → applied**. A partir de editing/validating/ready pode surgir **stale/conflict** se base divergir; erro recuperável volta a editing; descarte explícito passa a **discarded**. Draft persistido ao editar; recarga restaura editing e NUNCA aplica automaticamente. Não aplicar um draft sobre planId diferente.

Antes de publicar: verificar planId, baseRevision/baseDigest, versão de calendário/data civil, invariantes, operações protegidas, disponibilidade de IDs, capacidade, importação e status de timer. Um draft criado segunda e aplicado quarta é revalidado com a data vigente; datas passadas inválidas são resolvidas pelo usuário.

### 6.3 Durabilidade e commit

Commit local é **atômico** em IndexedDB e inclui checkpoint de antes, nova revisão do plano, operações e intenção de sincronização. O mecanismo deve usar uma transação readwrite adequada; se o armazenamento atual exigir mudanças, introduzir journal de prepare/commit e recuperação determinística em vez de presumir atomicidade de scheduleSave assíncronos. Conflito interabas requer revisão comparada e bloqueio de segunda publicação incompatível.

Falha antes do commit mantém versão anterior e rascunho recuperável; nenhuma mensagem de sucesso. Após commit local durável, reconstruir eventos automáticos elegíveis e recalcular métricas, sem tocar eventos estudados/tempo preservado. Enfileirar sync pelo coordenador existente: **aplicado localmente** e **sincronizado remotamente** são estados diferentes. Offline nunca perde alterações nem bloqueia estudo local.

## 7. Motor de calendário e redistribuição

### 7.1 Datas e rolagem

Separar dataOriginal (importação), dataPlanejada (intenção) e dataEfetiva (projeção calculada). Pendente atrasado e elegível pode aparecer hoje sem alterar dataPlanejada/revision. Fixação ou reagendamento explícito impedem rollover contrário à escolha humana. Concluído mantém histórico. Conteúdo não alocado por falta de capacidade é diferente de não coberto por prazo transcorrido.

Após dataFinal, marcar elegíveis não cobertos na projeção sem apagar bloco ou histórico. Reorganização nunca ultrapassa a dataFinal automaticamente; prorrogação exige confirmação separada e não modifica config.dataProva.

### 7.2 Capacidade e prioridade

Configurar minutos por dia da semana, exceções por data, dias de folga/revisão, máximos de carga e blocos fixados. Capacidade zero exclui o dia da distribuição. Restrições obrigatórias: integridade do histórico, fixações, prazo, capacidade máxima e referências válidas. Preferências otimizáveis: prioridade e desempenho, equilíbrio de horas e mínimo de movimentos.

Para ordenação determinística da proposta, definir score normalizado em [0,1]: **0,50 × prioridade manual + 0,30 × peso do edital + 0,20 × dificuldade demonstrada**. Manual: escala 1–5 normalizada; edital: pesos explícitos normalizados pelo maior valor positivo da prova; dificuldade: 1 − (acertos/total), com pelo menos 20 questões válidas. Se fonte faltar ou amostra não atingir 20, contribuição neutra 0,5, nunca inventar desempenho ou peso. Para múltiplos assuntos usar a maior dificuldade confiável, com justificativa da origem. Empate: dataPlanejada, ordem estável e id. Pesos do motor são parâmetros de decisão, não pesos oficiais presumidos.

Saída inclui operações propostas, diff, explicações, carga por dia, impacto nos KPIs, alertas e lista de blocos sem espaço. Se inviável, mostrar alternativas e não movimentar, encurtar ou excluir automaticamente conteúdos para fingir viabilidade. O motor funciona localmente, sem IA externa.

## 8. JSON, catálogo, histórico e recuperação

**JSON v1** permanece válido conforme o importador atual: versao=1, nome, dataFinal, minutosPadrao, dias[].data, blocos[].disciplina, topicos/aula, minutos. **JSON v2** portátil terá versao=2, tipo=reta_final, planId, exportRevision, sourceRevision/proveniência opcional, metadados de calendário e blocos com IDs, vínculos, datas e prioridades. Não levará sessões, credenciais ou backup integral. A exportação de backup geral permanece fluxo distinto.

Importar valida schema, datas, minutos, duplicações de IDs, referências; jamais executa HTML/código. Matching: planId+id compatível é mais forte; depois proveniência e base conhecida; depois sinais conservadores de nome, disciplina, assuntos, aula e posição. Conteúdos repetidos sem ID são **ambíguos** e não devem ser associados à primeira ocorrência silenciosamente. Nome semelhante sugere, não autoriza. Entidades novas entram no catálogo somente após aprovação da operação.

Compare classifica CREATE, UNCHANGED, UPDATE, MOVE, ARCHIVE_CANDIDATE e CONFLICT. Ausência no arquivo não implica deletar. Usuário seleciona alterações a incorporar ao rascunho, revalida e aplica como qualquer edição. Reimportar mesmo v2 e mesma revisão no mesmo destino não duplica IDs nem operações.

Undo/redo persistente usa comandos inversos sujeitos a validação da revisão atual. Checkpoints manuais ficam até exclusão explícita. Manter até 20 checkpoints automáticos por plano, sem compactar única evidência recuperável ou operações não sincronizadas/conflituosas. Restauração seletiva de blocos ou total produz **nova revisão**, com diff prévio; não restaura sessões realizadas no intervalo. Histórico mínimo de operações/revisões necessário ao merge é sincronizado; checkpoints locais completos podem não existir em todo dispositivo: a interface informa indisponibilidade em vez de prometer recuperar o que não tem.

## 9. Sincronização granular, conflitos e canais

### 9.1 Unidade de merge

O planejamento continua singleton no estado, mas uma reta_final v2 com **planId comum** passa a reconciliar blocos por ID, operações e base comprovável, em vez de selecionar o planejamento inteiro pelo maior updatedAt. Mudanças derivadas (reconcile, rollover, KPIs) não geram updatedAt de autoria. Planos diferentes ou substituições concorrentes do plano ativo geram conflito de identidade, não mescla automática. Arquivar/restaurar plano anterior continua operação logicamente atômica com a troca.

### 9.2 Três versões

Comparar B (base), L (local), R (remoto):

- só um lado alterou campo → preservar mudança;
- ambos alteraram campos independentes → combinar e revalidar todo plano;
- mesmo campo com valores distintos → conflito explícito;
- exclusão versus edição → conflito explícito;
- alterações distintas gerando incapacidade, posições incompatíveis ou referências quebradas → conflito;
- operationId repetido → deduplicar;
- base indisponível/não verificável → preservar variantes e exigir escolha, jamais adivinhar;
- escolha humana local/remoto/manual → nova operação com audit trail e checkpoint.

A UI apresenta diferenças e consequências antes de escolher. Estados em conflito não são enviados automaticamente sobre dados remotos.

### 9.3 Tombstones e clientes incompatíveis

O merge geral atual tem limites de 180 dias/2.000 tombstones e a sync de entidades tem seus limites próprios; isso isoladamente não protege clientes offline por períodos maiores. Requer geração/revision e marcadores duráveis por linhagem de plano; clientes além da janela necessária devem atualizar a base ou restaurar uma versão íntegra com confirmação, não reintroduzir blocos apagados.

Exigir gate de compatibilidade: cliente antigo que não entende v2 não poderá sobrescrever silenciosamente as novas revisões. A garantia depende de validação no canal remoto (regras/protocolo), não apenas de clientes novos. Se não houver prova dessa proteção, o lançamento multi-dispositivo fica bloqueado ou modo seguro sem gravação arriscada. Firestore segue primário; snapshots preservados como fallback; Cloudflare/Drive continuam backup/restore manuais. Não exigir infraestrutura paga adicional.

## 10. Tratamento de erros, privacidade e recuperação

| Evento | Comportamento |
|---|---|
| Quota ou falha no IndexedDB | abortar publicação; manter estado confirmado; oferecer recuperação/exportação |
| Offline/falha do Firestore | persistir local e outbox; indicar pendência e permitir continuar |
| Draft em versão antiga | impedir apply até comparar/rebasear |
| Duas abas publicando | comparação de revisão/transação impedem perda silenciosa |
| Timer ativo afetado | bloquear estrutura incompatível e oferecer pausa/encerramento |
| Nome/ID ambíguo em importação | conflito explícito; sem matching arbitrário |
| Evento com tempo/concluído | preservar evento e vínculo; operação destrutiva exige caminho protegido |
| Operação remota duplicada | idempotência por operationId |
| Prazo/capacidade impossível | mostrar faltas, sem extrapolar silenciosamente |
| Restore/undo concorrente | revalidar base e resolver conflito antes de confirmar |
| Cliente remoto obsoleto | manter dados seguros e exigir atualização/reconciliação |

Logs contêm operação, IDs, revisões, resultado e motivo sem registrar tokens/credenciais ou conteúdos privados desnecessários. Renderização e cálculo derivado não disparam escrita remota autoritativa. Corrigir potenciais loops save → sync → reconcile → save preservando separação intenção/derivação.

## 11. Critérios de aceitação verificáveis

| ID | Cenário de aceite |
|---|---|
| AC01 | Assunto longo abre completo por clique, toque e teclado, sem truncamento no detalhe |
| AC02 | Edição em draft persiste após reload sem afetar KPIs oficiais ou Histórico |
| AC03 | Apply válido cria uma revisão única local durável; persistência sobrevive a reload |
| AC04 | Falha de transação não publica estado parcialmente editado nem indica sucesso |
| AC05 | Mover mantém ID; duplicar cria ID novo e não clona sessões |
| AC06 | Arquivar bloco estudado preserva rfBlocoId, tempo, questões e revisões |
| AC07 | Lote de 30 blocos com conflito não é aplicado parcialmente |
| AC08 | Motor respeita folga 0h, capacidade máxima, fixações e dataFinal |
| AC09 | Excesso aparece como não alocado, sem criação de estudo fictício |
| AC10 | Rolagem não altera autoria nem desfaz reagendamento explícito |
| AC11 | Dois dispositivos editando campos independentes convergem sem perda |
| AC12 | Dois dispositivos editando o mesmo campo abrem conflito humano |
| AC13 | Replay de operationId não cria alteração duplicada |
| AC14 | Migração v1 conserva IDs, sessões e eventos existentes |
| AC15 | Reimportação v2 idêntica é idempotente; v1 ambíguo exige revisão |
| AC16 | Checkpoint restaura cronograma sem reverter estudo posterior |
| AC17 | Offline permite commit local e indica sync pendente corretamente |
| AC18 | Cliente incompatível não substitui silenciosamente plano v2 |
| AC19 | Timer, Histórico, calendário, quick-mark, associação e restauração de planejamento arquivado não sofrem regressão |
| AC20 | Oito temas WCAG AA; toque ≥44px; movimentação sem drag-and-drop; movimento reduzido |
| AC21 | Datas civis, duração, prioridade e referência inválida geram diagnósticos legíveis |
| AC22 | Undo/redo usa verificação de revisão e respeita conflitos |

Cobertura exigida no futuro: testes unitários de regras puras e algoritmos; integração com IndexedDB real e falhas; E2E em Chromium desktop/mobile; cenários offline, concorrência em duas abas, duplicação de operações, duas instalações/dispositivos e migração; auditoria visual/contraste dos oito temas. Comparar com baseline real da branch antes de alegar ausência de regressões; mocks não substituem testes de persistência. Respeitar a cota gratuita do Firestore e o princípio local-first nos testes.

## 12. Riscos, limites e gates

Riscos prioritários: singleton LWW perder edições; rollover disputar autoria; migração quebrar IDs; outbox guardar snapshot parcial; cliente antigo ressuscitar exclusão; checkpoints crescerem acima da quota; timer ativo sofrer edição; matcher associar assunto repetido incorretamente.

Mitigações: domínio puro e determinístico, migração idempotente com backup, transação local, conflito explícito, preservação de eventos, compatibilidade de protocolo, checkpoints e testes de falha. Refatoração apenas das integrações diretamente necessárias; sem ampliar escopo para demais tipos de plano ou novos serviços.

**Gate G0 — Design (ATUAL):** usuário revisa esta especificação formal e pede correções ou a aprova explicitamente.  
**Gate G1 — Plano (BLOQUEADO):** somente após aceite de G0, invocar Superpowers/writing-plans, criar plano de execução e submeter plano e método de trabalho ao usuário.  
**Gate G2 — Implementação (BLOQUEADO):** somente após aceite explícito do plano e forma de execução, alterar código via testes e revisões.  
**Gate G3 — Integração/Release (BLOQUEADO):** revisão independente, evidência de integridade/sync, aceite humano antes de merge/deploy.

Este documento é uma **especificação de design**, não um plano de tarefas nem autorização de implementação. Seu PR deve conter apenas este arquivo, permanecer aberto e não ser mesclado automaticamente.
