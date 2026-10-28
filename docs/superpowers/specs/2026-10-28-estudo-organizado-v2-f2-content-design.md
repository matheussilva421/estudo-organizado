# Estudo Organizado V2 — F2: Editais e conteúdo canônico

**Estado:** ESPECIFICAÇÃO PROPOSTA PARA REVISÃO — **NÃO APROVADA**  
**Fase:** F2 / edição e organização de conteúdo; **não autoriza writing-plans, código, instalação, backend ou merge**.  
**Base obrigatória:** [spec mestra D01–D27 + A-01/A-02](2026-10-19-estudo-organizado-v2-design.md), [spec F1 aprovada](2026-10-28-estudo-organizado-v2-f1-foundation-design.md), [inventário F0](../audits/2026-10-19-v1-feature-inventory.json), [ADRs F1](2026-10-28-v2-f1-architecture-decisions.md) e [roadmap](../v2/ROADMAP.md).  
**Pré-condição:** F1 executada, evidências revisadas, código integrado à `v2` e aceite F1; F2 só poderá iniciar após aprovação própria de spec, writing-plans e GOAL.  
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

**Proposta para discussão, não autorização automática:** introduzir nesta fase uma **qualificação antecipada mínima de sync** (Google Auth + Firestore em emulador local e projeto Spark isolado somente com autorização específica) com a entidade `Disciplina`; critérios: um fluxo completo local→remoto→outro cliente, Rules por UID, ACK/replay, orçamento e ausência de conflitos ocultos. Isso reduz risco de encontrar problemas estruturais somente na F7. Não introduzir Firebase produtivo no plano F2 sem gate humano e revisão da A-02. Se a proposta não for aprovada, a qualificação real permanece no F7 como originalmente previsto; registrar risco de integração tardia.

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

**Decisões a confirmar depois da F1:** relação exata entre `StudySubject` F1 e disciplina por edital; se aulas podem pertencer a mais de um edital; política de arquivamento/exclusão, matches de importação, limites concretos do parser, escopo da qualificação antecipada de sync. A spec F2 proposta não substitui aprovação humana dessas escolhas.

**Gate:** `F2_SPEC_PROPOSED` → aprovação específica → writing-plans F2 → aprovação do plano/método → GOAL F2 → TDD/revisão/evidências → aceite humano F2. **Nenhuma dessas transições ocorre pela publicação deste documento.**
