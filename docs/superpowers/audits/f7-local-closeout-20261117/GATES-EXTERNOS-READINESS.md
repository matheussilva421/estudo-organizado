# Prontidão para gates externos

Este documento prepara G-EXT/G-STAGING e não autoriza nenhum deles. Nenhum projeto, conta, Worker, KV ou URL foi criado ou acessado nesta rodada.

## Recursos isolados propostos

| Recurso | Requisito |
|---|---|
| Firebase | projeto Spark novo, separado de `app-de-estudos-14564`; Firestore Standard + Google Auth; sem Blaze, TTL/PITR/backup gerenciado ou Functions pagas |
| Contas | duas contas Google sintéticas A/B; nenhum dado acadêmico real |
| Worker/KV | Worker separado, namespace KV Free, sem R2; JWKS Google; AES-GCM aplicado antes do upload |
| Staging | build V2 em origem diferente da V1, HTTPS, dados sintéticos, cache `estudo-organizado-v2-*` |
| Configuração | `VITE_V2_*` em `.env.local` não versionado; `VITE_V2_APPROVED_PROJECT_ID` e allowlist só após G-EXT |

## Matriz executável S01–S25

| ID | Pré-requisito e fixture | Cliente/dispositivo | Evidência esperada | Resultado esperado | Orçamento máximo | Status atual |
|---|---|---|---|---|---|---|
| S01 | dois perfis sintéticos e uma entidade compartilhada | PC + celular + tablet | revisor, revisão, head e hashes iguais | sem duplicação e convergência | 3 clientes; <90% da cota diária | BLOCKED_GATE |
| S02 | duas criações offline independentes | 2 clientes | outbox e receipts dos dois UIDs | ambas preservadas e aplicadas | 2 writes + 4 reads | PARTIAL |
| S03 | mesma entidade/campo editada offline | 2 clientes | conflito com duas versões | decisão explícita, sem LWW | 2 writes + 2 reads | PARTIAL |
| S04 | tombstone remoto + cliente com cursor antigo | cliente A/B | cursor inválido e rebaseline | sem ressurreição; fila preservada | 1 write + 4 reads | PARTIAL |
| S05 | timeout após commit/lost ACK | 1 cliente | receipt, read-back e tentativa | `ALREADY_APPLIED`, ACK somente com prova | 1 write + 2 reads | PARTIAL |
| S06 | duas abas, mesma outbox | 2 abas | lock, receipt e efeito único | uma aplicação lógica | 1 write + 2 reads | PASS_LOCAL |
| S07 | conta A, troca para B e resposta tardia | 2 UIDs | Rules e estado de sessão | negação cruzada e descarte tardio | 0 writes cruzadas | PARTIAL |
| S08 | payload >1 MiB/multibyte | 1 cliente | erro local e doc intacto | rejeição sem truncar | nenhuma write remota inválida | PASS_LOCAL |
| S09 | reconexões repetidas | 2/3 clientes | ledger de reads/writes por 24 h | medir e pausar antes de 90% | conforme Free; sem teste de carga | BLOCKED_GATE |
| S10 | quota, Auth expirado e offline | 1 cliente | fila persistida e estado UI | status honesto, outbox mantida | 48 h de observação | PARTIAL |
| S11 | backup antigo + tombstone recente | 2 backups | preview, epoch e conflito | rebaseline, sem ressurreição | 1 restore isolado | PARTIAL |
| S12 | fixtures V1 12/11/9/7 e #107 | ambiente local | contagens e relações | sem perda/quarentena explícita | 180 blocos/F2-F3 sintéticos | PASS_LOCAL |
| S13 | SW waiting + sessão/draft/recovery | 1/2 abas | banner, decisão e reload | update adiado até estado seguro | 1 update controlado | PASS_LOCAL |
| S14 | site data V2 limpo; origem V1 presente | 1 origem V2 | storage/cache V2 e V1 intacto | só V2 limpo após consentimento | 1 ciclo manual | PARTIAL |
| S15 | UID hostil, tipo inválido, revisão forjada | Emulator + real | 37/37 local e logs sanitizados | negação, sem tokens em log | 37 cenários | PASS_EMULATOR |
| S16 | snapshot F2–F6 + relações + tombstones | 1 cliente | arquivo portátil e read-back | restauração íntegra | <1 MiB sintético | PASS_LOCAL |
| S17 | matriz histórica V1/V2 | documental | nenhuma conversão de FAIL em PASS | baseline preservada | — | PASS_LOCAL |
| S18 | IndexedDB V2 removido | 1 navegador | recovery por backup | sem sobrescrever automação | 1 ciclo | PASS_LOCAL |
| S19 | Worker/KV real + JWT A/B | 2 clientes | UID, ciphertext, read-back e 413/429 | isolamento e falha fechada | 7 writes/teste; <25 MiB/valor | BLOCKED_GATE |
| S20 | sete versões e falha de poda | Worker/KV | lista ordenada e hashes | nunca apagar última cópia íntegra | 8 writes controladas | PASS_LOCAL |
| S21 | senha errada, chave perdida e ciphertext alterado | 1 cliente | erro criptográfico | sem exposição ou escrita | 4 tentativas | PASS_LOCAL |
| S22 | URL V2 em origem independente | PC/celular/tablet | HTTP read-back, manifest, SW | V1 intocada | 1 URL, 3 acessos | BLOCKED_GATE |
| S23 | backup sintético >25 MiB | 1 cliente | export local e 413 KV | exportação íntegra, sem truncar | 26 MiB de fixture | PASS_LOCAL |
| S24 | um registro de cada tipo F2–F6 e relações | 1 cliente | cobertura de tipos e restore | roundtrip sem perda | 17 tipos / 27 stores | PASS_LOCAL |
| S25 | aparelhos realmente disponíveis | inventário humano | screenshots e notas | PASS_HUMAN_UX ou NOT_RUN | sem carga irrestrita | PARTIAL |

## Procedimento externo, somente após consentimento

1. Registrar project ID, região, quota e ausência de billing/Blaze.
2. Publicar Rules/índices em projeto isolado e verificar login A, negação B e consentimento.
3. Criar Worker/KV Free, verificar UID/JWKS, read-back, tamanho e retenção.
4. Gerar build e publicar somente em origem independente; registrar commit/SHA dos assets.
5. Executar S01–S25 com dados sintéticos e ledger de quota; interromper em cruzamento de UID, perda, ACK falso, billing, R2 ou toque na V1.
6. Preservar screenshots, logs sanitizados e URL/commit; só então pedir UX-H/G-F7.

## Rollback externo

- Worker: republicar a versão anterior; não apagar KV.
- Firestore: reverter Rules/índices versionados; não usar dados V1.
- Staging: despublicar a página; preservar build/commit.
- Falha material: parar, exportar evidências sanitizadas e não continuar o piloto.

## Pedido humano consolidado

Autorizar, em uma única decisão, (a) G-EXT para projeto Firebase Spark isolado + Worker/KV Free sem billing; (b) G-STAGING para URL gratuita em origem distinta da V1; (c) duas contas Google sintéticas; e (d) informar os aparelhos/navegadores realmente disponíveis. Push, merge, F8/G5 e uso de dados reais permanecem decisões separadas.
