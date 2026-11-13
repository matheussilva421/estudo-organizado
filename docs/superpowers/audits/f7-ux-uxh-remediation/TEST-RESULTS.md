# Resultados de teste

Execução em `apps/v2` no HEAD `92745e0a`, Windows, Chromium do Playwright.

| Comando | Resultado |
|---|---|
| `npm run typecheck` | PASS (exit 0) |
| `npm run lint` | PASS (exit 0) |
| `npm run build:e2e` | PASS; `index.esm` 580,47 KB e principal 659,87 KB; aviso >500 KB mantido |
| `npm run test:unit` | PASS — 880/880 em 129 arquivos |
| `npx playwright test --project=chromium` | PASS — 241 testes, 5 skips, 0 falhas em 246 (1,6 min) |

## Skips (5)

1. F3-T40 evidence (condicional).
2. F6 evidence (condicional).
3. F7-UX evidence (condicional).
4. Duas capturas premium condicionais.

Nenhum skip mascara falha; todos dependem de variável de ambiente de evidência.

## Contraste

`contrast/content-guide-contrast.json`: 36 amostras, 12 temas, viewport 1586×992.
Mínimo 7,02:1, máximo 13,56:1. Hover e foco verificados; foco com outline visível.

## Estados funcionais cobertos

- Capacidade com sobrecarga: 400% da janela e excesso de 90 min.
- Histórico: alvo `-1` revisão e `-1` bloco contra a revisão atual; confirmação restaura.
- Reta Final: prévia focável, cancelamento devolve foco, nada é gravado antes da confirmação.
- Hábitos: sessão de hoje = `CURRENT`; sessão de ontem = `UNDEMONSTRATED`.
- Evidência F4: data, estado e medições por sessão.

## Zoom e responsividade

O teste de zoom passou a emular 200% com viewport CSS de 640×720 (como o zoom real do navegador) e `zoom` de 200%. PASS. Viewports 320/390/720/1024/1440/1586 cobertos pelas suítes.

## NOT_RUN

NVDA/Narrator, toque físico, hardware modesto, Firebase/Firestore/Auth reais, Cloudflare, Drive e staging. Nenhum desses foi declarado aprovado.

