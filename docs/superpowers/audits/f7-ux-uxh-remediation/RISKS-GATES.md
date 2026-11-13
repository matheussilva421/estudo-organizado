# Riscos e gates

## Riscos residuais

| Risco | Impacto | Mitigação |
|---|---|---|
| Home ainda difere do mock nas ilustrações | percepção de fidelidade | registrado como PARTIAL; herói usa a arte original |
| F5 sem tela própria | drill-down parcial | referência de auditoria exibida; F4 abre a sessão |
| CTA secundário em 320×568 exige rolagem | descoberta no mobile curto | CTA principal sempre visível; registrado |
| Estados vazios altos em Análises | área branca em período sem dados | dados reais; sem invenção de série |
| Zoom do teste é emulado com `body.zoom` | não é zoom nativo | viewport 640 + zoom 200%; zoom nativo manual NOT_RUN |
| Firebase/Cloudflare/Drive não executados | sync real não validado | gates externos separados; nada foi habilitado |

## Gates

- `LOCAL_UXH_REMEDIATION`: concluído neste pacote.
- `UX_H_RE_REVIEW_PENDING`: aguarda decisão humana.
- `REMOTE_PUSH_NOT_AUTHORIZED`: push, PR, merge, deploy e staging fora de escopo.
- `G-EXT`, `G-STAGING`, `F8`: não iniciados.
- Acessibilidade manual (NVDA/Narrator/toque/hardware): `NOT_RUN_ENVIRONMENT`.

