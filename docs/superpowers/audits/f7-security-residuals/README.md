# F7 Security Residuals — fechamento local

Data: 17/11/2026. Branch `v2`, checkout `C:\Projetos\estudo-organizado\_v2-candidate`.

Código final: `48de3ac01ab46d40a9d8776e6ebf2151b935afb1`. Documentação: commit desta pasta, registrado no `BUNDLE.txt` do pacote.

Status: `F7_SECURITY_RESIDUALS_LOCAL_VERIFIED` / `F7_EXTERNAL_PENDING` / `UX_HUMAN_PENDING` / `REMOTE_PUSH_NOT_AUTHORIZED` / `MAIN_UNCHANGED`. Os pareceres finais estão em `INDEPENDENT-REVIEWS.md`; nenhum P0/P1 ficou aberto.

## Escopo

Uma rodada local para reproduzir e fechar os resíduos R1–R4 do pacote anterior:

- R1: mutação isolada de entidade sem operation/change/head.
- R2: concorrência do mesmo operationId e recuperação de falha ambígua.
- R3: vínculo/allowlist de entityType e consistência com o store map.
- R4: escrita no documento pai da biblioteca.

Não é F7 externa, UX-H, F8, redesign, migração produtiva ou homologação de serviço real.

## Decisões

1. A criação/atualização de entidade agora exige causalidade auditável no mesmo batch: head avança exatamente uma sequência, change e receipt são criados no batch e todos os campos coincidem com a entidade; cada change também exige que a entidade tenha avançado de revisão no mesmo batch.
2. `FirebaseRemotePort.apply` reconcilia falha ambígua lendo o receipt; só retorna `ALREADY_APPLIED` se entityId e digest coincidem. Há no máximo duas tentativas.
3. O entityType passou a usar allowlist fechada nas Rules e no validador do cliente; tipos desconhecidos falham fechado.
4. O documento pai da biblioteca é somente leitura; create/update/delete são negados. Subcoleções continuam independentes.

## Limites

G-EXT, quotas, billing, Auth real, multi-dispositivo, restauração produtiva, UX-H, staging e F8 permanecem fora. Nenhum PNG F4 foi commitado.
