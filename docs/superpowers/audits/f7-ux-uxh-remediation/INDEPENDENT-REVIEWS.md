# Revisões independentes

Duas rodadas, quatro revisores, nenhum deles o autor das correções.

## Rodada 1 — candidato 2b63a179

### Visual/UX (agente Russell)

Veredito: melhoria local real, sem P0, mas **não recomendou UX-H**. Seis P1:

1. Studios ainda como dashboard genérico, com buracos.
2. Fila de Revisões enterrada atrás de política e ajustes.
3. Capacidade escondia sobrecarga com `max(0)`.
4. Comparação de checkpoints não correspondia ao alvo restaurado.
5. Prévia de encerramento da Reta Final sem foco e com `role=status` em região com botões.
6. Contexto de hábitos podia atribuir hábito atual a sessão antiga.

P2: UUID cru em F4/F5, códigos internos, atalhos de 11,84 px, CTA mobile coberto, tema só com glifo, Home idêntica ao baseline, capturas sem manifesto.

### Integridade (agente Euclid)

Veredito: `NÃO_GO` para fechar, sem P0, com um P1 de regressão: o `.table-grid` de Análises ficou sem `grid-column` e ocupava 1/12. Confirmou que `application/`, `domain/`, `platform/`, IndexedDB, outbox, sync, backup, recovery, senha e clock não foram tocados; `main` e `origin/v2` intactos; bundle T0 verificado.

## Rodada 2 — delta em 454f27e5

As duas primeiras tentativas de revisor delta falharam por `429 Too Many Requests`; a revisão foi refeita com outros dois agentes.

### Visual delta (agente Ampere)

- 5 dos 6 P1: **RESOLVED** (fila, capacidade, checkpoints, foco, hábitos).
- Studios: **PARTIAL** apenas pelo painel vazio "Série por dia" alto em Análises (P2).
- Nenhum P0/P1 novo; CTAs dentro do cartão; sem overflow nos recortes.
- Recomendou manter `UX_H_RE_REVIEW_PENDING`.
- Correção aplicada após o parecer: `align-items: start` no `.table-grid` de Análises; captura regerada.
- Testes: `NOT_RUN` pelo revisor; validação executada pelo autor.

### Integridade delta (agente Volta)

- Nenhum P0.
- P1: DV-14/VA-14 estavam `PASS_LOCAL` com inspetor básico; **corrigido** para `PARTIAL_JUSTIFIED`.
- P2: manifesto misturava HEAD documental e de código; **corrigido** (`codeHead` 454f27e5, `documentationHead` do commit documental).
- P2: `SHA256SUMS.txt` listava `_manifest.ps1` ausente; **corrigido** na regeração.
- Confirmou diff sem alterações em `application/`, `domain/` e `platform/`; sem push; `origin/v2` ainda em `02b950cd`.
- Testes: `NOT_RUN` pelo revisor; números do pacote são declarados, não reexecutados por ele.

## O que os revisores não fizeram

Nenhum usou NVDA/Narrator, toque físico, hardware modesto, Firebase/Cloudflare/Drive reais ou staging. Nenhum aprovou UX-H; a decisão continua humana.

