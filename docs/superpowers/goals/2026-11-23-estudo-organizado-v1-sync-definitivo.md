# GOAL ÚNICO — CODEX | ESTUDO ORGANIZADO V1 — SINCRONIZAÇÃO DEFINITIVA

**Data de aprovação:** 23/11/2026  
**Estado da autorização:** implementação local aprovada a partir da SPEC v1.0 e do Plano Superpowers v1.0; **produção, deploy, alteração de Firebase real, push/merge remoto e cutover NÃO autorizados por este GOAL**.  
**Repositório:** `https://github.com/matheussilva421/estudo-organizado` — apenas a **V1**, preferencialmente `main` quando houver condições seguras.  
**Objetivo:** implementar, testar, revisar e preparar para integração um sincronizador definitivo, incremental e offline-first, sem perder dados, com conversão fiel do backup canônico, uso local e Firestore Emulator homologados, sem executar a ativação produtiva.

---

## INSTRUÇÃO EXECUTIVA AO CODEX

Você atua como Tech Lead, executor e revisor técnico autônomo do **Estudo Organizado V1**. Execute **o plano aprovado inteiro, T0–T12**, na ordem das dependências, utilizando Superpowers com TDD RED → GREEN → regressão, sem paradas desnecessárias para opções técnicas rotineiras. Preserve integralmente as decisões e os gates humanos descritos abaixo. Corrija os problemas materiais encontrados na **mesma estrutura de trabalho** e reteste, sem multiplicar GOALs, branches, PRs, documentação ou mecanismos de sincronização. Não apresente relatórios intermediários como se fossem fechamento do projeto. No final, entregue provas executáveis, diagnóstico preciso e **um ZIP** com os documentos principais.

Este GOAL **autoriza codificação, testes, configuração e uso exclusivo de ambientes locais/Emulator, commits locais seguros e preparação de integração**. Não autoriza operação sobre dados reais do Firebase, importação ou escrita em produção, publicação de regras, deploy do site/PWA, nem push/merge remoto. Não interprete o aceite do plano como autorização produtiva. Se uma proteção de branch ou condição do ambiente exigir outro gate, preserve-o.

### Fontes normativas do trabalho — leitura integral obrigatória

1. **SPEC aprovada v1.0:** `2026-11-23-ESTUDO-ORGANIZADO-V1-SYNC-SPEC-PROPOSTA-v1.0.md`; destino de trabalho, depois do preflight: `docs/superpowers/specs/2026-11-23-estudo-organizado-v1-sync-definitivo.md`.
2. **Plano Superpowers aprovado v1.0:** `2026-11-23-ESTUDO-ORGANIZADO-V1-SYNC-PLANO-SUPERPOWERS-v1.0.md`; destino de trabalho: `docs/superpowers/plans/2026-11-23-estudo-organizado-v1-sync-definitivo.md`.
3. **Backup canônico PRIVADO:** `estudo-organizado-backup-2026-11-23......json`, fornecido separadamente ou por um caminho local indicado no ambiente do Codex. Localizar sem adivinhar. Definir **localmente** `ESTUDO_V1_BACKUP_PATH` para apontar ao arquivo real; nunca incorporá-lo ao Git, à documentação pública ou ao ZIP de entrega.
4. **Código existente e documentação real no repositório**, incluindo `src/js/store/indexeddb.js`, `src/js/store/reta-final-commit.js`, `src/js/sync/sync-coordinator.js`, `src/js/sync/firestore-sync-engine.js`, `src/js/sync/sync-center.js`, `src/js/views/config/sync-center.js`, `src/js/backup-restore.js`, `src/js/store/export-state.js`, `firestore.rules`, `firebase.json`, testes e relatórios anteriores. Consulte HEAD atual, não suponha que o código seja idêntico ao examinado em 23/11/2026.

**Proveniência dos documentos aprovados (SHA-256):**
- SPEC: `e9544576aa83e4c0ea26bd8c03a4c5b8b60c935c5c7ea90e7ac5a8adc0aa8028`.
- Plano: `a7976117787b25270b4f6d9875c19a907f6c8d116d8c58291b1902f72161f079`.
- Backup original: **1.653.120 bytes**; SHA-256 **`f4f9af2923d3b0da9599de32e1c897ae4ef4690339b63ba1a5a9ba0059844127`**.

Os títulos originais contêm “PROPOSTA”/“PENDENTE” porque os arquivos foram gerados antes da aprovação. **O usuário aprovou expressamente a SPEC e o plano em 23/11/2026.** Registre esse aceite no handoff/estado, sem reabrir o conteúdo ou alterar decisões por preferência própria.

Se os arquivos não estiverem no ambiente do Codex, obtenha-os dos anexos/arquivos fornecidos. Não invente seu conteúdo, não use cópia substituta silenciosa e não publique artefatos privados. Em caso de falta de um insumo, continue **apenas** as tarefas comprovadamente independentes, relate a limitação e não certifique gates que dependam dele.

---

## 1. DECISÕES APROVADAS, ESCOPO E ACEITE

**Preservar sem reabrir, salvo evidência material nova:**

- **S01-A:** com cache válido da geração atual, abrir imediatamente com IndexedDB e sincronizar automaticamente em segundo plano via Firestore.
- **S02:** converter o backup fornecido para o novo modelo de dados.
- **S03-B:** o backup é a **única fonte inicial**; não incorporar dados exclusivos de dispositivos, caches, outboxes antigas ou remoto legado.
- **S04-A:** namespace Firestore da V1 novo e isolado, sem sobrescrever o legado; o projeto Firebase existente só poderá ser aproveitado mediante isolamento e regras comprovados.
- **S05-B:** dispositivo antigo sem cache validado da nova geração deve recuperar a nova base online antes do primeiro uso; offline, bloquear apenas essa primeira configuração, sem exibir legado como atual.
- **S06-A:** alterações locais ainda não confirmadas pela nuvem podem gerar alerta preventivo de fechamento quando o navegador permitir; não prometer entrega durante `beforeunload`.

**Resultado funcional buscado:** uma pessoa normalmente estuda em um dispositivo por vez e mais tarde abre outro; as informações convergem automaticamente, sem botões de enviar, baixar ou mesclar. O uso offline é íntegro; status “salvo neste dispositivo” não equivale a “sincronizado”. Conflitos raros devem preservar ambas as versões sem sobrescrita silenciosa.

**Arquitetura aprovada:** JavaScript ES modules e estrutura atuais; IndexedDB local-first com outbox **persistente e atomicamente gravada com a mutação**; um único motor efetivo; Firebase Firestore com `onSnapshot`/`docChanges`, operações idempotentes com `opId`, recibo remoto e controle de revisão por entidade; documentos por evento/hábito/bloco, metadados de edital e disciplina com aulas/assuntos agrupados, planejamento/revisões e tombstones protegidos. Cloudflare, Drive e exportação JSON serão **backups**, não canais de sincronização automática simultâneos.

**Não fazer:** reconstruir a V2; reescrever o app em outro framework; modificar cronograma/edital; usar snapshots globais como mecanismo cotidiano novo; reativar `force overwrite`; adicionar GitHub Actions/CI/CD, dependências gratuitas desnecessárias, pipelines, bots ou PRs de rotina; reimportar dados legados; fazer reset destrutivo; desabilitar proteções; alegar homologação produtiva sem testes reais.

**Dados esperados após conversão fiel do backup** (contagens de negócio, sem duplicação): 4 editais; 49 disciplinas; 792 aulas; 1.825 assuntos; 360 eventos; 222 hábitos; 140 blocos da Reta Final ativa; 5 tombstones históricos normalizados (3 no campo raiz, 2 em `config.entityTombstones`); 1 planejamento arquivado. Preservar as **57 referências históricas a `aulaId`** e as **86 referências a `rfBlocoId`** sem correspondência atual: não apagar, não reinterpretar e não criar objetos fictícios. Plano atual TJPB/FGV + DPE-PB/FCC: blocos de 23/11/2026 a 26/02/2027, ordens 0–139, estado pendente; configuração geral até 28/02/2027.

Nenhum campo de negócio poderá desaparecer silenciosamente. Não migrar `cfTokenDraft`, `firestoreSync` antigo, configurações de sessões/autenticação, tokens, URLs de credenciais, telemetria de sincronização ou dados efêmeros; **classificar campos desconhecidos**, preservar os que possam representar negócio e documentar exclusões técnicas apenas pelo nome/caminho, sem valores sensíveis.

---

## 2. PREFLIGHT OBRIGATÓRIO (T0) — INVENTÁRIO E RISCOS

Antes de editar código, identificar repositório/checkout V1 correto, SPEC e plano aprovados, arquivos existentes, conflitos e estado Git/GitHub. Executar, ajustando sintaxe ao shell sem trocar os significados:

```bash
git status --short
git rev-parse --show-toplevel
git rev-parse HEAD
git rev-parse main
git log -1 --format='%H %s'
git branch -avv
git worktree list --porcelain
git remote -v
```

Consultar também PRs abertos, diferenças entre branches, commits exclusivos, untracked files e worktrees locais/remotas, especialmente os ramos V2 existentes. **Não apagar, resetar, forçar push, fechar PR ou perder alterações exclusivas**. Se houver acúmulo relevante que comprometa o trabalho, inventariar e sanear de forma **não destrutiva** antes de abrir novas estruturas; solicitar autorização somente para ações realmente destrutivas.

Verificar versões Node/npm/Java/Firebase CLI e ambiente de teste, scripts e regras. Executar baseline quando viável:

```bash
npm ci
npm run test:sync
npm run test:unit
npm run bump:check
```

Registrar `preflight.json`/relatório sanitizado com HEAD, árvore, scripts, testes inicialmente falhando, dependências e inventário de gravações de estado (`saveStateToDB`, `stateSaved`, `setState`, `reta-final-commit`, cloud/Drive, outboxes). **Não atribuir falha preexistente ao novo código**. Consultar a configuração real dos Emulators: na leitura anterior, Firestore `8085`, Auth `9099`, UI `4000` (confirmar).

Confirmar hashes e estrutura dos três insumos. Nunca inserir backup privado em `src/`, `tests/fixtures/`, `docs/`, commits, PRs, relatórios ou ZIP. Se for necessário duplicar temporariamente em área privada, manter fora do checkout, proteger acesso e apagar somente cópias próprias comprovadamente dispensáveis; **nunca** excluir a fonte original.

A `main` é preferida **somente se estiver limpa, segura e autorizada**. Se precisar de isolamento técnico, usar **uma** branch/worktree temporária identificada, sem PR automático, e terminar com trabalho preservado. Não tocar branches da V2 para “limpeza” oportunista.

---

## 3. EXECUÇÃO AUTÔNOMA — IMPLEMENTAR T0–T12 SEM PERDER O ESCOPO

Use `superpowers:subagent-driven-development` com revisão por tarefa, quando estiver disponível; em caso contrário, `superpowers:executing-plans` com revisão independente final. Para cada tarefa: **escreva teste RED → execute para constatar a falha → implemente o mínimo → obtenha GREEN → rode regressão aplicável → revise e faça commit local pequeno e rastreável**. Nunca enfraqueça testes ou regras de segurança para obter resultado verde. Atualize o checklist do plano e um único documento de estado existente, quando pertinente.

### G0 — T0: baseline e prevenção de perda

Executar o preflight acima, classificar alterações e dependências, registrar os arquivos que serão modificados e provar que o trabalho permanece estritamente na V1. Se HEAD mudou desde os documentos, adaptar apenas os pontos de integração sem reabrir decisões aprovadas. Bloquear caso seja necessário desfigurar o escopo ou violar segurança.

### G1 — T1/T2: codec de backup e regras Firestore

**T1:** implementar `src/js/sync/v1-next/backup-codec.js` com `convertBackupV12`, `reconstituteBackupV12` e `auditBusinessEquivalence`. Testar com fixtures **sintéticas** e, em ambiente privado isolado, com o backup de SHA aprovado. Preservar IDs, conteúdos, ordem, notas, data, hábitos, 140 blocos, histórico, tombstones e campos de negócio desconhecidos. Gerar manifesto com contagens/digests e inventário dos 57/86 vínculos históricos, sem copiar registros pessoais. Executar o validador real `validateBackupPayload` e validações novas; fazer round-trip **sem perda semântica**.

**T2:** implementar contratos e regras locais em `src/js/sync/v1-next/contracts.js`, `firestore.rules` e testes reais no **Firestore + Auth Emulators**, com separação de UID, geração, tipos e tamanhos, revisão válida, escrita condicionada à autoridade, recibos imutáveis e negação de promoção do manifest/ponteiro por cliente comum. Garantir que o novo namespace permaneça inacessível a clientes legados, **sem publicar regras em produção**. Testes positivos e negativos são obrigatórios.

### G2 — T3/T4/T5/T6/T7: persistência, nuvem, bootstrap, worker e conflitos

**T3:** realizar upgrade IndexedDB **não destrutivo**, preservar os stores existentes e implementar `src/js/sync/v1-next/local.js` com isolamento por `uid + generationId`, `commitLocalChange`, `getPendingOperations`, `ackLocalOperation`, `readLocalGeneration`. Estado acadêmico + outbox devem ser gravados em uma transação local comprovada; falha deve reverter ambos. Instrumentar o caminho de persistência existente, sem criar segundo save concorrente. Respeitar commits especiais da Reta Final.

**T4:** implementar `src/js/sync/v1-next/remote.js` e testes no Emulator. Operação + recibo `/operations/{opId}` na mesma transação Firestore; CAS por entidade com revisões do servidor; replay não pode duplicar efeito; timeout após commit deve terminar em ACK recuperável, não duplicação. Implementar `onSnapshot`/`docChanges` com unsubscribe, tratamento de baseline antes de deltas, isolamento de geração e evidência de escrita incremental (editar evento **não** reenvia edital, disciplinas, plano ou snapshot).

**T5:** implementar `src/js/sync/v1-next/bootstrap.js`: cache previamente verificado da geração/UID corrente abre imediatamente; dispositivo com apenas cache legado, sem conexão, apresenta primeiro preparo e não edita base antiga; online, carregar nova geração em área temporária, conferir manifest/contagens/digest e fazer swap local **somente após validação**. Download interrompido deve ser retomável e nunca expor base parcial como atual. Não aceitar cache de outra conta/geração.

**T6:** implementar `src/js/sync/v1-next/worker.js`, acoplado ao coordenador atual por roteamento mínimo. Um único worker efetivo, fila durável, backoff, listeners, recuperação ao reconectar, foco/visibilidade, bloqueio contra duas abas causarem envio concorrente indevido; listener próprio não gera nova operação. Quando novo motor efetivo, **desligar escrita automática legada** (snapshot, polling, entity shadow/primary e Cloudflare/Drive automáticos). Enquanto não há cutover, manter comportamento legado e flag nova **desligada na produção**, sem dois escritores simultâneos.

**T7:** cobrir conflitos de revisão, merge de campos comprovadamente independentes, edição concorrente incompatível preservando versões, isolamento de conflito por entidade, exclusões/tombstones sem ressurreição, rejeição de cliente antigo e isolamento por UID. Não resolver conflitos reais por `last write wins` silencioso.

### G3 — T8/T9: integridade do domínio e UX

**T8:** implementar `src/js/sync/v1-next/reta-final.js` e adaptar pontualmente `src/js/store/reta-final-commit.js` para transação IndexedDB com outbox, operação lógica com revisão completa e ponteiro remoto atualizado só após conjunto validado. **Leitores não podem observar metade de um replanejamento.** Preservar histórico, notas, vínculos, exclusões, regras de eventos automáticos e a semântica de Reta Final v2. Não alterar cronograma.

**T9:** adicionar somente a UX necessária, reutilizando `src/js/sync/sync-center.js` e `src/js/views/config/sync-center.js`. Estados acessíveis e verificáveis: `sincronizado`, `sincronizando`, `salvo neste dispositivo`, `atenção necessária`; ACK remoto obrigatório para “sincronizado”; first-use seguro; alerta `beforeunload` apenas se houver pendências e o navegador permitir; manter exportação JSON/backups, sem botões manuais obrigatórios para sync.

### G4 — T10/T11: migração de ensaio, E2E e regressão

**T10:** criar `scripts/v1-sync-migration.mjs` com comandos `audit`, `prepare --target emulator`, `verify --target emulator` e proteção rígida de `activate`. Staging `staging → verified` com lotes retomáveis, idempotência e manifesto. Rodar auditoria privada do backup real (SHA exato), read-back de **todos** os documentos no Emulator, comparação semântica 1:1 e detecção de falha/lote ausente. **Este GOAL exige que `activate --target production` falhe SEM EFEITO.** Não criar bypass por flag CLI, env var ou credencial disponível. A ferramenta deve ser *future-ready*, não executável contra a produção por esta autorização.

**T11:** executar Vitest, Playwright com **dois contextos independentes**, Firestore/Auth Emulators reais, regressão de Reta Final, segurança e PWA. Casos necessários: computador A → grava + ACK → fecha → B abre e recebe automaticamente; B→A; offline + reload + reconexão; crash após write remoto antes do ACK; duas abas; duas contas; perda de Auth; várias gerações; conflito na mesma entidade; tombstones; migração interrompida; 57/86 referências históricas; replanejamento atômico; falha no meio do lote; status de sync corretos. Medir reads/writes/bytes/latência até ACK/duração de bootstrap e comparar com baseline mensurado. Não inventar métricas, não substituir Emulator por mocks como evidência final.

Executar, respeitando scripts existentes:

```bash
npm run test:sync
npm run test:unit
npm run test:e2e:release
npm run lint
npm run bump:check
```

Rodar a suíte Auth/Firestore Emulator com comando **realmente existente**, apurado no preflight, e registrar invocação/resultado. Se dependência local faltar, instalar/configurar alternativa compatível somente quando segura e dentro do escopo; se impossível, relatar gate concreto como pendente, sem falsificar PASS. Sem GitHub Actions.

### G5 — T12: revisão crítica, integração preparada, GitHub Hygiene

1. Conferir a SPEC por requisito N1–N8, decisões S01–S06, plano T0–T12 e testes executados. Revisão independente se recurso disponível; corrigir falhas P0/P1 e regressões na **mesma branch/estrutura**, repetir testes necessários; não abrir rodada infinita de revisão.
2. Verificar pontos de escrita e eliminar **uso simultâneo** de motores; preservar legado para rollback/recuperação enquanto necessário. Remover apenas código efetivamente morto e **comprovadamente dispensável**, sem excluir ferramentas de backup.
3. Identificar worktrees, PRs, branches, commits exclusivos e alterações untracked **antes e depois**. Não criar Actions novas; não criar PR sem exigência real; evitar novas branches. Não apagar nenhum item com trabalho exclusivo. Se algum objeto antigo já estiver seguramente integrado e sua remoção for autorizada, saneá-lo; caso contrário documentar o motivo para manutenção. Não confundir branches preexistentes da V2 com lixo deste GOAL.
4. Efetuar commits locais seguros. **Não fazer push/merge no GitHub remoto e não alegar “integrado à main remota”** sem autorização adicional. Se já estiver trabalhando diretamente na `main` local limpa, manter commits locais e informar divergência com `origin/main`; se houver branch temporária, preparar a integração para a `main`, sem executar operação não autorizada.
5. Preparar checklist de cutover, rollback e checklist de homologação em **dois dispositivos físicos reais**, que ocorrerá após liberação produtiva. Gerar ZIP sem segredos e sem backup.

---

## 4. GATES OBJETIVOS E POLÍTICA DE FALHAS

**G0 (T0):** repositório e baseline identificados, dados/árvore preservados.  
**G1 (T1–T2):** conversão com round-trip íntegro, segurança no Emulator e nenhum segredo exposto.  
**G2 (T3–T7):** commits locais duráveis, sync incremental e idempotência demonstrados, conflitos preservados.  
**G3 (T8–T9):** Reta Final atômica e UX/ACK corretos.  
**G4 (T10–T11):** backup real reconvertido sem perda; E2E de duas instâncias no Emulator e regressões materiais verificadas.  
**G5 (T12):** revisão concluída, código testado e preparado para integração/entrega, com status de Git real.  
**G6 (PRODUÇÃO): NÃO FAZER NESTE GOAL.** Deploy de regras, preparação em Firebase real, ativação do namespace, alteração do ponteiro `v1SyncControl/current`, distribuição da versão para usuários e testes de dois dispositivos reais são posteriores e exigem autorização específica.

Não “resolver” bloqueio de segurança diminuindo validação, mudando contagens ou desviando de testes. Falhas locais rotineiras devem ser tratadas autonomamente; preferir comandos e ferramentas já instaladas, sem loops intermináveis. Em caso de evidência de perda de dados, alteração de arquitetura aprovada, credencial/corte de produção, operação destrutiva ou risco de sobrescrever trabalho alheio, **parar a ação de risco**, conservar todo o trabalho concluído e solicitar decisão objetiva. Tarefas independentes podem continuar, mas gates não homologados permanecem abertos.

**Risco explícito de defasagem do backup:** qualquer estudo registrado após 23/11/2026 fora do arquivo não fará parte da geração inicial por S03-B. Antes de um GOAL produtivo futuro, apresentar diferenças temporais e oferecer substituição *expressamente autorizada* por backup canônico novo — **não** realizar mescla automática de dispositivos legados.

---

## 5. CRITÉRIOS FINAIS DE ACEITE

Só classificar `LOCAL_VERIFIED` quando houver evidência executada de:

- SHA-256 do arquivo original conferido; esquema v12 válido no validador real; 4/49/792/1825/360/222/140/5/1 preservados; 57 e 86 vínculos históricos preservados, sem correção inventada; zero segredos publicados; equivalência semântica de negócios no round-trip.
- Operações acadêmicas e outbox juntas em persistência atômica IndexedDB; gravação offline sobrevive a crash/reload; ACK remoto é verificável e repetição de opId não duplica efeitos.
- UID/geração isolados em regras, IndexedDB, listeners e recibos; cliente legado não contamina geração atual; tombstone não ressuscita evento.
- `onSnapshot` recebe deltas sem escrita de snapshot global por evento; nenhuma duplicidade de motor ou loop de feedback; leitura inicial e atualização incremental controladas.
- Reta Final replanejada atomicamente; sem recriar eventos apagados ou referências antigas; bootstrap protegido; status de sincronização honestos.
- Vitest, Playwright, Firestore/Auth Emulator, regras e regressões locais com comandos, resultados, logs sanitizados e testes de falha; sem P0/P1 abertos.
- Código pronto para integração, diff revisado, branches/worktrees/PRs inventariados, nenhum trabalho exclusivo perdido; **nenhuma escrita em produção**.

Se algum item falhar, classificar precisamente `IMPLEMENTADO_NAO_HOMOLOGADO`, `TESTES_PARCIAIS`, `INTEGRACAO_PENDENTE` ou outro estado fiel. “Código compilou” não é prova de sincronização real. “Testado localmente” não é “integrado à main remota”, muito menos “publicado”.

---

## 6. RELATÓRIO FINAL OBRIGATÓRIO

Entregar em português brasileiro, de maneira objetiva, com:

1. **Contexto e Git:** repo exato, `HEAD` antes/depois, branch, working tree, commits criados, `main` local/remota, diferenças pendentes, PRs, worktrees, branches e itens preservados por risco.
2. **Matriz T0–T12 e G0–G6:** `implementado`, `testado`, `integrado`, `não iniciado`, `bloqueado`, com evidência real para cada etapa.
3. **Dados/migração:** SHA do backup, cardinalidades, equivalência/round-trip, 57/86 referências, campos operacionais excluídos, read-back completo, erros e exceções; sem dados pessoais.
4. **Funcionalidades:** arquitetura e módulos finais, listener, outbox, tombstones, versionamento, UX, concorrência, Reta Final; código removido ou legado retido e justificativa.
5. **Testes e métricas:** comandos exatos, PASS/FAIL, ambiente, casos E2E e rules, métricas reais, regressões, revisão independente e correções materiais efetuadas.
6. **Segurança e rollback:** isolamento por UID/geração, ausência de dados sensíveis, necessidade futura de publicação de regras, passos de reversão **sem perda de novas operações**.
7. **Estado final explícito:** diferenciar `IMPLEMENTADO`, `TESTADO_LOCALMENTE`, `MAIN_LOCAL`, `MAIN_REMOTA`, `DEPLOY`, `FIRESTORE_PRODUCAO`, `CUTOVER` e `HOMOLOGACAO_FISICA`.
8. **Próxima ação e intervenção humana única necessária:** idealmente autorização futura para integração remota e, **depois**, autorização específica para preparação/ativação produtiva, sem misturar gates.

**ZIP final obrigatório:** criar `ESTUDO-ORGANIZADO-V1-SYNC-CODEX-YYYYMMDD-<HEADcurto>.zip` com SPEC, plano, versão deste GOAL, resumo executivo, matriz de aceite, relatórios de testes, hashes, inventário Git/GitHub, revisão de segurança, diff/patch resumido e checklist de implantação/rollback. Fazer verificação de listagem, integridade (CRC/teste de unzip) e SHA-256 do ZIP. Anexar ou indicar caminho local preciso. **Não incluir o backup original/convertido, dados pessoais, credenciais, notas, exports do Firebase, tokens ou logs brutos que possam contê-los.**

## 7. CONDIÇÃO DE ENCERRAMENTO

O GOAL termina com software local revisado/testado e integrável, ou com impedimentos individualizados e comprovados, **sem tocar produção**. Não declare `V1_SYNC_FINALIZADO_EM_PRODUCAO` enquanto o G6 não for aprovado e homologado em execução futura.

**Execute agora o trabalho técnico local aprovado, de forma autônoma e disciplinada. Preserve os dados e as decisões; não crie novos GOALs só para continuar tarefas previstas neste mesmo plano.**
