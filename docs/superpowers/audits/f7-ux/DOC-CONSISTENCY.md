# Consistência documental — antes/depois

Data: 11/11/2026. Somente documentos foram alterados; nenhum código, teste ou configuração.

| Documento | Correção | Evidência |
|---|---|---|
| ACCEPTANCE-MATRIX.md | UX-16..21 atualizados; P-04/R-02 não são mais P1; histórico preservado | FIXES-AND-TDD.md; HEAD 0c31e6ef |
| UX-ACCEPTANCE-MATRIX.md | mesma atualização, com tabela P/E/R vigente | testes citados na matriz |
| GATES-AND-RISKS.md | riscos 10/11 marcados HISTÓRICO; incluídos Rules, migração V1, consentimento, Java e a11y manual | G0/G1 |
| TEST-RESULTS.md | caminhos logs-final/ trocados por logs/ do pacote; nota de origem externa | pacote 0b8fcfdc |
| GIT-STATE.md | 91→92 commits; HEAD documental x código explícitos | git rev-list/rev-parse |
| SUMMARY.md | seções antigas marcadas como histórico; estado vigente com HEAD 0b8fcfdc | rodada integrada |
| UX16-UX21-TRACEABILITY.md | tabela antiga marcada como histórica; atualização integrada é a fonte corrente | seção final |

## Novos documentos

- PREFLIGHT.md, DOC-CONSISTENCY.md, UX-H-START.md, UX-H-CHECKLIST.md, UX-H-DECISION.md, PUBLISH-HANDOFF.md, BUNDLE-VERIFY.md.

## Verificações

- Links Markdown locais: 0 ausentes.
- git diff --check: PASS.
- Manifesto do ZIP de entrada: 99/99.
- HEAD documental 0b8fcfdc; código validado 0c31e6ef; diff entre eles somente em docs/superpowers/audits/f7-ux/.

## Inconsistências remanescentes

- P2 técnicos continuam PARTIAL e dependem de decisão humana; ver UX-H-CHECKLIST.md.
- Logs brutos permanecem fora do checkout; no ZIP aparecem em logs/.
- Firestore Rules, migração V1, consentimento remoto e acessibilidade manual continuam gates externos.

