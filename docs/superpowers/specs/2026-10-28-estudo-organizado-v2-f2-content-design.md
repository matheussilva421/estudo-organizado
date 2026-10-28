# Estudo Organizado V2 — F2: Editais e conteúdo canônico

**Estado:** ESPECIFICAÇÃO F2 EM REVISÃO — **NÃO APROVADA** (revisão de 2026-10-28).  
**Fase:** F2 / edição e organização de conteúdo; **não autoriza writing-plans, código, instalação, backend ou merge**.  
**F1 de referência:** aceite humano com ressalvas em 2026-10-28, no commit `85ce1e3`; os quatro riscos HIGH continuam `UNVERIFIED`, e Firebase/sync multi-dispositivo real **não** foram homologados.  
**Base obrigatória:** [spec mestra D01–D27 + A-01/A-02](2026-10-19-estudo-organizado-v2-design.md), [spec F1](2026-10-28-estudo-organizado-v2-f1-foundation-design.md), [relatório de aceite F1](../audits/2026-10-28-v2-f1-acceptance.md), [inventário F0](../audits/2026-10-19-v1-feature-inventory.json), [ADRs F1](2026-10-28-v2-f1-architecture-decisions.md) e [roadmap](../v2/ROADMAP.md).  
**Pré-condição:** F1 aceita com ressalvas; F2 só poderá iniciar após aprovação humana desta spec revisada, writing-plans F2 próprio e GOAL F2.  
**Status dos riscos:** 4 HIGH F0 `UNVERIFIED` até testes efetivos; 107 E2E FAIL legados não mudam por esta redação.

## 1. Resultado de produto e escopo

Construir o acervo canônico de **editais → disciplinas → assuntos → aulas**, com contexto de edital principal, arquivamento, verticalização, importação JSON conservadora e mapeamento de aulas. O usuário deve conseguir começar com dados locais, organizar vários concursos e reutilizar conteúdo sem perder histórico. Esta fase ainda não implementa ciclo/cronograma/sessões; entrega os dados e contratos que F3–F5 exigem.

**Features principais do inventário F0 (6):**
- `F-V1-EDITALS-CRUD` — criar/editar/arquivar objetos, organização por árvore, edição inline, reordenação, lotes pequenos de aulas, metadados de cor/ícone sem impor regra no domínio;
- `F-V1-PRINCIPAL-EDITAL` — selecionar explicitamente principal ativo; alterá-lo não deleta nem reescopa registros históricos;
- `F-V1-ARCHIVED-EDITALS` — preservar editais anteriores para consulta, reativação consentida e rastreabilidade;
- `F-V1-VERTICAL-EDITAL` — hierarquia verticalizada e progresso calculado, não cache como fonte primária;
- `F-V1-EDITAL-IMPORT` — importar JSON versionado com preview, matching conservador, plano de importação e confirmação;
- `F-V1-LESSON-MAPPER` — mapear aulas para um ou mais assuntos, com exclusões/alterações sem apagar fatos dependentes.

## 2. Domínio, identidade, relações e temporalidade

**Entidades lógicas propostas:** `Edital` (id, title, status, source/provenance, primaryChoice), `Disciplina` (id, editalId?, canonicalSubjectId?, title, order), `Assunto` (id, disciplinaId, title, order, parentId?), `Aula` (id, title, order, source/provenance) e `LessonTopicLink` (aulaId, assuntoId). Os campos físicos e cardinalidades finais precisam ser confrontados com a F0 e a disciplina mínima da F1, sem duplicar duas entidades "disciplina" com significados conflitantes.

**Invariantes obrigatórios:** IDs opacos e estáveis, não título; escopo de proprietário/perfil; relações bidirecionais coerentes e validáveis; sem exclusão em cascata destrutiva do histórico; referências órfãs em quarentena; mudanças de nome/ordem não reescrevem estatísticas; arquivamento preserva as ligações; seleção de principal é uma preferência explícita por perfil com comportamento determinístico ao trocar de edital.

**Dados de apresentação:** cores, ícones, ordem e expansão de árvore não contaminam regras de estudo. Mudanças sensíveis são operações idempotentes gravadas atomicamente com outbox local quando sync estiver ativado; toda entidade remota precisa de envelope/campo de revisão e escopo UID segundo A-02, embora F2 não possa presumir Firestore real homologado.

**Versionamento:** `domainSchemaVersion` próprio; importação tem `sourceFormatVersion`/proveniência sem reusar às cegas os números 12/11/9/7 da V1. Múltiplos editais podem conter disciplinas homônimas: matching por nome isolado é insuficiente.

### 2.1 Contratos efetivamente entregues pela F1

Esta revisão usa como fonte o código e os testes de `apps/v2/` no aceite `85ce1e3`, não apenas a intenção da spec F1.

| Contrato F1 | Forma entregue | Regra para F2 |
| --- | --- | --- |
| Isolamento | `apps/v2/`, origem `127.0.0.1:18431`, IndexedDB `estudo-organizado-v2`, SW próprio | Reutilizar; não criar segunda origem, DB ou SW |
| Versões | `DOMAIN_SCHEMA_VERSION=1`, `LOCAL_DB_VERSION=1`, `BACKUP_FORMAT_VERSION=1`, `SYNC_PROTOCOL_VERSION=1` | Incrementar somente com migração explícita; não reutilizar 12/11/9/7 da V1 |
| Entidade | `StudySubject {id, profileId, title, localRevision}` com ID opaco | Resolver a relação com `Disciplina` de edital antes de duplicar o conceito |
| Comandos | create/rename com `operationId`; título normalizado; replay exato idempotente; payload divergente rejeitado | Estender o envelope sem reutilizar ID com conteúdo diferente |
| IndexedDB | stores `subjects`, `outbox`, `operations`, `profiles`, `meta`, `conflicts`; chave composta perfil+entidade | Adicionar entidades/índices por migração; não criar outra fila |
| Atomicidade | disciplina + operação + intenção de outbox na mesma transação; abort/quota sem commit parcial | Toda mutação F2 segue o mesmo padrão |
| Outbox | status `PENDING`/`CONFIRMED`/`CONFLICT`; `baseRevision`; ACK exige operação persistida e revisão comprovada | F2 adiciona `entityType`/`kind` e validação, sem nova outbox |
| Sync A-02 | CAS/idempotência via fake; read-back após timeout; `conflictRevisions`; Web Locks com `BLOCKED` sem lock | Contratos fake continuam; emulador é ensaio separado, não homologação |
| Consentimento | `ProfileBinding`, estados de sync, prévia com perfil/UID/contagem/emissão/expiração | F2 preserva a prévia; não vincular acervo sem consentimento |
| Convergência | exige commit local, remoto e cursor verificado **e** zero pendências | Nunca inferir convergência por timestamp ou UI |
| Orçamento | margem conservadora de 900.000 bytes por payload; fake rejeita excesso | F2 mede agregados/documentos antes de fixar schema remoto |
| Backup | manifesto/checksum, tokens removidos, `deletionHistoryComplete`, `SAFE`/`INVALID`/`REBASELINE_REQUIRED` | F2 não adiciona restauração destrutiva sem preview |
| Legado | reconhece schemas 7/9/11/12 e `retaFinal`; comparação de 180 blocos sem overwrite | Importação F2 mantém quarentena e proveniência |
| UI/PWA | 8 temas, tokens, foco, 44 px coarse, toasts não bloqueantes, SW isolado | F2 reutiliza componentes/tokens; não redesenha a fundação |
| Testes | 84 unitários e 20 E2E; harness somente no build `e2e`; duas abas/IDB/retry cobertos | F2 adiciona testes próprios; não reaproveitar PASS de fake como homologação real |

**Lacunas explícitas deixadas para F2:** `StudySubject` não possui `editalId` nem relação canônica com disciplina; o store `profiles` existe, mas persistência/UI de vínculo não foi entregue; o outbox só cobre `subject`; não há UI de backup/importação; `delete` é um tipo previsto, sem fluxo F2; e o Firebase real não foi executado. Essas lacunas precisam de decisão na aprovação F2, não de suposição no código.

### 2.2 Regras de extensão para F2

- Estender os contratos F1 por migração versionada e testes de compatibilidade; não duplicar `Disciplina` como uma segunda entidade com o mesmo significado.
- Definir o mapa `StudySubject ↔ Disciplina(edital)` com proveniência e uma política explícita para dados F1 existentes.
- Toda operação F2 usa a única outbox/serviço de commit; nenhuma fila paralela ou escrita direta da UI no IndexedDB.
- Importação e backup F2 continuam read-only na origem V1 e usam apenas fixtures sintéticas.
- Qualquer documento remoto F2 precisa de orçamento, revisão e escopo de UID compatíveis com A-02.

## 3. Jornadas UX mínimas e estados

1. Estado vazio → criar edital local → adicionar disciplinas/assuntos/aulas → editar e reordenar → reload confirma dados.
2. Escolher edital principal e arquivar outro → ver apenas seu contexto ativo nos fluxos apropriados, mas manter acesso explícito ao histórico arquivado.
3. Importar JSON: selecionar arquivo → validar tipo/tamanho/versão/segurança → comparar com acervo → prévia de criação/reuso/conflito → confirmação por operação → read-back e relatório de importação. Em caso de erro, nenhuma confirmação parcial disfarçada de sucesso.
4. Mapear aulas a assuntos: sugerir vínculos quando possível, permitir revisão humana em matches ambíguos; desfazer um vínculo não remove aulas/sessões existentes.
5. Responsividade desktop/tablet/mobile e temas A-01; foco, teclado e tela de erro/sem rede; não mostrar "sincronizado" apenas porque IndexedDB foi gravado.

## 4. Operações públicas e contratos de dados

**Comandos propostos:** `CreateEdital`, `EditEditalMetadata`, `SetPrimaryEdital`, `ArchiveEdital`, `UpsertDisciplina`, `UpsertAssunto`, `UpsertAula`, `LinkLessonTopic`, `UnlinkLessonTopic`, `PreviewEditalImport` e `ApplyEditalImport`; todos com `operationId`, `profileId`, `baseRevision` quando pertinente, validação de relacionamento e retorno discriminado `LOCAL_COMMITTED|CONFLICT|INVALID|FAILED`.

**Consultas:** `GetEditalTree`, `ListActiveEditais`, `ListArchivedEditais`, `GetPrimaryEdital`, `ListLessonTopicLinks` e `GetImportPreview`; paginação e consultas indexadas nas listas grandes, sem load completo desnecessário. Projeções são descartáveis/recalculáveis.

**Importação:** parser com limites de tamanho/profundidade/quantidade definidos após testes; aceitar somente estruturas reconhecidas, sanitizar texto e nunca executar HTML/script. Importação repetida por `importId` e identidade de fonte deve ser idempotente, não duplicar a árvore. Caso de relação externa ausente ou conflitante: quarentena/revisão; nunca silenciosamente reutilizar outra disciplina.

**Migração V1:** primeira conversão testada apenas com fixtures sintéticas da matriz F0; IDs/proveniência explícitos, contagens por entidade, vínculos preservados, relatório de divergência. Não tocar perfis V1 reais ou origem produtiva.

## 5. Integração e sincronização A-02

F2 usa o **IndexedDB V2** e a única outbox da F1, sem introduzir fila paralela. Operações independentes em editais distintos podem convergir; concorrência na mesma entidade ou em exclusões/vínculos exige revisão-base/CAS e resolução conservadora.

**Ensaio antecipado:** a spec propõe, como gate separado e não automático, um ensaio local com Firebase Emulator (§5.1). Ele não homologa produção, não autoriza projeto Firebase real e não inicia código F2. Se não for aprovado, a homologação real permanece no F7 e o risco de integração tardia fica registrado.

### 5.1 Proposta de ensaio antecipado com Firebase Emulator (não executado)

**Objetivo:** reduzir o risco de descobrir problemas estruturais de sync apenas no F7, exercitando os contratos F1/F2 contra Auth e Firestore emulados, com dados sintéticos e custo zero.

**Autorização separada:** este ensaio só ocorre após aprovação explícita de `F2_EMULATOR_REHEARSAL`. A aprovação da spec F2 não o autoriza automaticamente; a execução exige plano curto, entradas/saídas e confirmação de que nenhum projeto real será tocado.

**Ambiente e pré-condições:**

- Firebase CLI e Java compatíveis verificados antes da instalação; nenhuma dependência paga.
- Projeto de emulador com prefixo `demo-` (por exemplo `demo-estudo-organizado-v2`), Auth Emulator e Firestore Emulator em portas locais documentadas.
- Rules V2 em arquivo próprio sob `apps/v2/firebase/` (criado somente no ensaio autorizado); `firestore.rules` da V1 permanece intocado.
- UIDs sintéticos, fixtures sintéticas e nenhuma credencial/produção; o Auth Emulator simula identidade, não o Google Sign-In real.
- Nenhum billing, Cloud Function, deploy ou tráfego para Firebase real.

**Escopo mínimo do ensaio:**

1. Rules por UID: dono lê/escreve; UID estranho é negado; `delete` segue a política aprovada.
2. Entidade disciplinar F1 e uma entidade F2 mínima (disciplina/edital sintético) com documento limitado e revisão.
3. Fluxo `LOCAL_COMMITTED → REMOTE_COMMITTED → CONVERGED`, com ACK/read-back, replay idempotente e conflito preservado.
4. Um cliente sintético A escreve; cliente B lê e converge; conflito concorrente não é sobrescrito.
5. Orçamento de documento abaixo da margem de 900 KB, estimativa de leituras/escritas/índices para 1–3 clientes e evidência de ausência de snapshot monolítico.
6. Teste de cursor/rebaseline e de documento acima do limite rejeitado sem truncamento.

**Entregáveis:** configuração de emulador, rules V2, fixtures, testes automatizados locais, log/JSON de evidência, relatório com PASS/FAIL/BLOCKED/INCONCLUSIVE/NOT_RUN e riscos residuais. Nada é promovido a produção.

**Critérios de saída:** testes de Rules e CAS passam no emulador; uma única operação lógica por replay; UID errado negado; conflito preservado; limite de documento rejeitado de forma fechada; o ensaio é reproduzível localmente. Falha material bloqueia a etapa e é registrada, não mascarada.

**Limites:** emulador não prova quotas Spark reais, latência, App Check, OAuth Google real, listeners em produção, Rules publicadas ou convergência entre dispositivos físicos. Os quatro riscos HIGH continuam `UNVERIFIED` até a homologação F7 pertinente. O ensaio pode reduzir incerteza, mas não autoriza declarar Firebase homologado.

**Gate:** `F2_SPEC_REVISED` (aprovação da spec) → autorização específica do ensaio → execução local → evidências. O ensaio não substitui writing-plans nem GOAL F2.

## 6. TDD, casos adversariais e evidências

| Caso | Evidência exigida |
| --- | --- |
| Criar/renomear hierarquia e reiniciar app | Mesmo ID e relações restauradas do IndexedDB |
| Duas disciplinas com mesmo nome em editais diferentes | Nenhum merge baseado apenas no título |
| Importar o mesmo JSON duas vezes | Sem duplicação; relatório consistente e idempotência |
| JSON inválido, enorme, profundo ou com HTML hostil | Validação segura, sem XSS, sem travamento ou commit parcial |
| Arquivar/trocar edital principal | Histórico de sessões/revisões intacto; nenhuma exclusão automática |
| Deletar assunto com aulas/sessões relacionadas | Referências preservadas, bloqueio ou quarentena explícita |
| Offline, reload, quota e dois tabs | Salvamento local atômico, status sincero, retries idempotentes |
| Alterações paralelas em conteúdo vinculado | Conflito registrado; não sobrescrever silenciosamente |
| Importação legado (fixtures V1) | Contagens e mapa de IDs reconciliados; desconhecidos não descartados |
| Testes visuais Impeccable | Oito temas, mobile/tablet/desktop, foco e contraste com evidência |

**Critério de aceite F2:** todas as seis funcionalidades principais entregues ou exceções formalmente aprovadas; integridade de hierarquia e importação, UI acessível, testes RED→GREEN/integração/E2E locais com resultados reais, dados sintéticos, nenhuma alteração V1; código integrado à `v2`, revisão independente, relatório na issue #108 e **aceite humano específico**.

## 7. Fora do escopo e decisões em aberto

F3 assume planejamento e Reta Final; F4 assume sessões; F5 inteligência; F6 dashboard; F7 homologa sync/backup/migração completa; F8 cutover. Não construir essas features inteiras em F2.

**Decisões a confirmar na aprovação F2:** relação exata entre `StudySubject` F1 e disciplina por edital; migração/mapeamento dos dados F1; se aulas podem pertencer a mais de um edital; política de arquivamento/exclusão e tombstones; matches de importação; limites concretos do parser; uso do store `profiles`; e autorização do ensaio com emulador. A spec revisada não substitui aprovação humana dessas escolhas.

**Gate:** `F2_SPEC_REVISED` (esta revisão) → aprovação humana específica → autorização separada do ensaio com emulador → writing-plans F2 → aprovação do plano/método → GOAL F2 → TDD/revisão/evidências → aceite humano F2. **Nenhuma dessas transições ocorre pela publicação deste documento.**

## 8. Registro desta revisão

- **2026-10-28:** F1 aceita pelo proprietário com ressalvas no commit `85ce1e3`; quatro HIGH continuam `UNVERIFIED` e Firebase/multi-dispositivo não foram homologados.
- Contratos efetivamente entregues pela F1 foram incorporados em §2.1–2.2; lacunas de `StudySubject`/`Disciplina`, perfil e outbox ficam explícitas.
- A proposta de ensaio antecipado com Firebase Emulator foi consolidada em §5.1, sem execução e sujeita a autorização separada.
- Nenhum código F2, writing-plans, instalação de emulador, Firebase real ou deploy foi iniciado por esta revisão.
