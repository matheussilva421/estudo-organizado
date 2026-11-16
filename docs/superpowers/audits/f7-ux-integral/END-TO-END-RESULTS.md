# Jornada transversal — resultados

Cadeia coberta por testes sintéticos independentes, sem um teste-monstro frágil.

| Etapa | Prova | Estado |
|---|---|---|
| 1. Perfil, edital, disciplina, assunto/aula | `f7-ux-integrated-journey`, `f2-inspector` | PASS |
| 2. Cenários A/B, capacidade, prévia e cancelamento | `f7-ux-integrated-journey`, `f3-capacity.test.ts` | PASS |
| 3. Sessão única, pausa/retomada e medições | `f4-timer-journey`, `f7-ux-premium-focus` | PASS |
| 4. Planejado versus realizado sem dupla contagem | jornada + `f7-ux-attention-analytics` | PASS |
| 5. Compromisso, execução e prévia de política | `f5-review-journey`, jornada | PASS |
| 6. Prioridade → ponto fraco → F5 → F4; sem amostra | `f5-review-journey` (duas prioridades) | PASS |
| 7. Home, Atenção e Insights; exportação | jornada + `f7-ux-command-center` | PASS |
| 8. Outro perfil, backup e importação | `f5-portability`, `f7-ux-backup-restore`, `isolation` | PASS em fake |
| 9. Refresh/offline e duas abas | `pwa-offline`, `f4-two-tabs`, `f2-two-tabs` | PASS |
| 10. 320/390/tablet/desktop, tema e teclado | `visual-a11y`, `f7-ux-review-sheet`, `f6-accessibility-states` | PASS automático; manual NOT_RUN |

## Fatos, projeções e previews

- Planejado e executado são lidos de fontes distintas; a sessão manual de 30 min não cumpre automaticamente o bloco de 60 min.
- Política v1 permanece após prévia de v2 não aplicada.
- Execução F5 e sessão F4 mantêm IDs próprios; prioridade abre o ponto fraco exato.
- Importação compatível/inválida/outro perfil não grava sem ação explícita.
- Capacidade de dois editais é somada uma vez; cenário inativo não reserva.

## Limites

Serviços remotos, restauração real e migração de dados V1 não foram executados. As etapas 8/9 usam fakes/fixtures.
