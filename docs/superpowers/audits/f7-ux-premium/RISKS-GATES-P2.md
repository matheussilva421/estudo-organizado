# Gates e riscos remanescentes

| Gate | Estado |
|---|---|
| P0/P1 locais conhecidos | NENHUM |
| UX-H | PENDING_HUMAN |
| push origin/v2 | NOT_AUTHORIZED |
| G-EXT / G-STAGING | BLOCKED |
| F8 / main / V1 | NÃO INICIADO |
| NVDA/Narrator, hardware, toque físico | NOT_RUN_ENVIRONMENT |

## Parciais assumidos

- Ilustração vetorial e cartões com menos gráficos que os mockups; fidelidade substancial, não pixel-perfect.
- Knowledge/Review/Insights mantêm inspetor e painéis existentes; sem reengenharia profunda.
- Sem sistema geral de bottom sheets; apenas filtros de Revisões.
- Fixação de layout e contexto de desempenho sem teste dirigido; drill-down por entidade pendente.
- INCOMING de SessionConflict dedicado sem autoridade: caminho latente, genérico validado.
- Chunks JS de 580/624 kB mantêm aviso Vite; sem lazy loading para não introduzir regressão sem medição conclusiva.
- Backup em bundle no mesmo volume C: e cópia em D: (discos distintos, mesma máquina); sem mídia externa.
