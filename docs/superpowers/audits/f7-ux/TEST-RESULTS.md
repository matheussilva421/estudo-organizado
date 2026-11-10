# Resultados de teste F7-UX

**Ambiente:** Windows, Node `v26.13.0`, npm `12.2.2`, Playwright `1.64.1`, Vite `8.3.5`.
**HEAD de entrada:** `3145e95440f0c38178a205f4247b67a180564214`.

| Comando | Resultado | Log |
|---|---|---|
| `npm run typecheck` | PASS, exit 0 | `logs/typecheck.log` |
| `npm run lint` | PASS, exit 0 | `logs/lint.log` |
| `npm run test:unit` | PASS, 849 testes / 121 arquivos | `logs/unit.log` |
| `npm run build` | PASS; aviso de chunks >500 kB | `logs/build.log` |
| `npm run test:e2e` | PASS, 190 + 3 skips conhecidos / 193 | `logs/final-e2e.log` |
| Firebase Emulator | PASS, 12 testes / 2 arquivos, projeto demo | `logs/firebase.log` |

## Evidência F7-UX

- Contratos de evidência: commit local ≠ ACK ≠ convergência ≠ backup restaurável.
- Bloco cumprido: vínculo de sessão não cumpre bloco; somente conciliação `CONCLUDED` remove o atraso.
- Analytics: ausência não vira zero; medições e alocações invalidam fingerprint; snapshot é congelado em profundidade.
- Home/widgets: fórmulas sem `eval`, unidade/denominador validados, fallback sem perda.
- Rotas: URL sanitizada, ID exato, perfil e arquivo verificados.
- Navegação: cinco destinos móveis; ação Estudar não inicia timer; foco preservado na troca de layout.
- Atenção: mesma projeção alimenta fila e badge; dispensa não resolve fato.
- Configurações: diagnóstico redigido; sem botão de exclusão de banco; `navigator.storage` é somente leitura de estimativa.
- Recovery: diálogo modal inicia no botão de confirmação, Escape cancela e devolve foco ao gatilho.
- Visual: screenshots em 8 temas × 3 viewports e módulos em desktop/tablet/mobile/320 px.

## Interpretação

`PASS` local não significa homologação de Firebase/KV/Cloudflare, staging, multi-dispositivo físico, quota real, leitor de tela ou hardware modesto. Esses itens permanecem fora deste resultado.
