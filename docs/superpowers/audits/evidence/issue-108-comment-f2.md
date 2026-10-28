## F2 — implementação concluída, gate `F2_READY_FOR_HUMAN_REVIEW`

A F2 foi executada na branch `v2` conforme o [writing-plans](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/plans/2026-10-28-estudo-organizado-v2-f2-editais-conteudo.md) e o GOAL aprovados. HEAD publicado: `cca624b` (fast-forward de `f5b114a`). `main` permanece em `9046cfa`.

### Estado real dos gates

| Gate | Resultado |
| --- | --- |
| typecheck | PASS |
| lint | PASS |
| unit | PASS 168/168 (29 arquivos) |
| E2E | PASS 45/45 (20 da F1 + 25 novos da F2) |
| build | PASS (292,30 kB / 87,22 kB gzip) |

### Matriz F2-T01..T40

36 cenários `PASS` com teste real, `F2-T16`/`F2-T36` `SIMULATED` (fake remoto, sem Firestore), `F2-T34` exercitado com ~360 entidades (não o teto de 5.000) e `F2-T22` **`NOT_RUN`** por `F2_EMULATOR_NOT_AUTHORIZED` — nenhum emulador, SDK, CLI ou Rules foi instalado ou executado. Detalhes na tabela do [relatório de aceite](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/audits/2026-10-28-v2-f2-acceptance.md).

### O que foi entregue

- Domínio de `Edital`/`EditalDiscipline` com alias apenas contextual e `StudySubject` canônico (sem clone, sem merge por nome).
- Upgrade IndexedDB aditivo v1→v2 com `versionchange`/`onblocked`, sem `deleteDatabase` e sem perder `subjects`/`operations`/`outbox`.
- Serviço único de commit (`LOCAL_COMMITTED|INVALID|CONFLICT|FAILED`) com entidade + operação + outbox na mesma transação e idempotência forte.
- `primaryEditalId` único por perfil; arquivar o principal exige decisão explícita.
- Árvore `Assunto`/`Aula` com `parentKey`, detecção de ciclo/escopo cruzado e ordem determinística.
- Adoção explícita das disciplinas F1 (`LINK_EXISTING`, `CREATE_EDITAL_AND_LINK`, `LEAVE_UNASSIGNED`), sem auto-vínculo.
- Soft delete com tombstone/epoch, bloqueio de dependentes e restauração validada contra órfãos.
- Conflitos persistindo os dois payloads; `KEEP_LOCAL`/`ACCEPT_REMOTE` explícitos.
- Identidade de entrega separada (`profileId` local ≠ `uid` ≠ `remoteLibraryId`) com gate fail-closed: sem consentimento nada é enviado.
- Retry com base 1 s, teto 5 min, jitter 0–20% e cooldown após a quinta falha transitória, sem descartar operação.
- Importação com tetos (2 MiB, profundidade 20, 5.000 entidades, título 120, chave 200), quarentena, fingerprint canônico, prévia com `targetSignature` e commit atômico + recibo idempotente.
- Backup F2 próprio com leitor explícito do envelope F1 (nunca `SAFE` por acidente).
- UI React com criação/renomeação/arquivamento/reativação, verticalização, mapeamento aula↔assunto e importação com prévia, reusando os oito temas da F1 e expondo `SEM_DADOS_DE_EXECUCAO`.
- Orçamento sintético: 3 × 7.840 = 23.520 escritas/dia > premissa Spark de 20.000, com recomendação de seed único; não é medição de billing.

### Revisões independentes

Cinco rodadas read-only (Tasks 1; 2–5; 7; 9–10; holística final) apontaram 1 P0 (`canDeliver` não ligado ao envio), 13 P1 e dezenas de P2/P3. Todos os P0/P1 e os P2 materiais foram corrigidos, com teste focal reexecutado a cada correção. A revisão holística final encontrou, entre outros: `targetSignature` sensível à ordem dos arrays (segunda importação era recusada), reuso de disciplina por nome, IDs colidindo em irmãos homônimos, edital arquivado não consultável e prova de consentimento sem vínculo com o `uid`. Todos corrigidos com teste novo.

### Limitações que permanecem

Quatro riscos HIGH da F0 continuam `UNVERIFIED`; Firebase/Google Auth/Rules/quota real não foram exercitados; T16/T36 são simulados; a retomada automática é API com relógio injetado, sem timer de background; Impeccable 3.9.1 não rodou como ferramenta (a evidência visual são 24 capturas 8 temas × 3 viewports, overflow, foco e alvo de 44 px); vínculo aula↔assunto desfeito usa delete físico; três motores de commit ainda coexistem.

**F2 não está aprovada, publicada ou homologada.** O aceite é humano e a F3 não foi iniciada.

