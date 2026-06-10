# Handoff — Pacote de design para o Claude Design (2026-06-10)

## Objetivo

O usuário quer usar a ferramenta **Claude Design** da Anthropic, que pede para arrastar a codebase ("for large codebases, drop the frontend or design system folder"), sem subir o repositório inteiro. Foi montada uma pasta mínima, fora do repo, só com o frontend/design.

## O que foi feito

Criada a pasta `C:\Users\slvma\Downloads\estudo-organizado-design\` (45 arquivos, ~260 KB) com **cópias** de:

| Origem (repo) | Destino (pacote) |
| --- | --- |
| `src/index.html` | `index.html` |
| `src/css/**` (38 arquivos: tokens, base/, components/, views/, agregadores) | `css/**` |
| `src/assets/icons/*.svg` (3 SVGs) | `assets/icons/` |
| `src/js/app/themes.js` (theme switcher) | `js/app/themes.js` |
| `src/docs/paleta-temas.md` | `paleta-temas.md` |
| — (novo) | `README-DESIGN.md` (explica o pacote para a ferramenta) |

Os caminhos relativos do `index.html` para `css/...` continuam válidos na estrutura copiada.

## Decisões

- **Design puro** (escolha do usuário via pergunta): sem `src/js/views/`, sem `components.js`, sem firebase/sync/store.
- **Pasta única, sem script reutilizável** (escolha do usuário): geração manual, documentada abaixo para regerar.
- Cópia feita com `Copy-Item` (bytes), nunca `Get/Set-Content` — evita corrupção de UTF-8 no PowerShell (armadilha conhecida do projeto).

## Validações

- Contagem/tamanho: 44 arquivos copiados + README = 45, ~260 KB. ✅
- Grep por `apiKey|authDomain|firebase|workers.dev` no pacote: só a meta tag de CSP do `index.html` (domínios públicos) e uma referência `<script src>` a arquivo não incluído. **Nenhuma credencial.** ✅
- Sem testes automatizados: nenhuma mudança de comportamento no app (somente cópia externa + este handoff).

## Repositório

- **Nenhum arquivo de código foi alterado.** Sync, store, dados: intocados.
- Único arquivo novo no repo: este handoff.

## Como regerar o pacote (PowerShell)

```powershell
$src = "C:\Users\slvma\Downloads\Github\estudo-organizado\src"
$dst = "C:\Users\slvma\Downloads\estudo-organizado-design"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Force "$dst\assets", "$dst\js\app" | Out-Null
Copy-Item -Recurse "$src\css" "$dst\css"
Copy-Item -Recurse "$src\assets\icons" "$dst\assets\icons"
Copy-Item "$src\index.html" "$dst\index.html"
Copy-Item "$src\js\app\themes.js" "$dst\js\app\themes.js"
Copy-Item "$src\docs\paleta-temas.md" "$dst\paleta-temas.md"
# README-DESIGN.md é mantido à mão; recriar se a pasta for apagada.
```

## Pendências / próximos passos

- Usuário: arrastar a pasta `estudo-organizado-design` no Claude Design.
- Se o Claude Design precisar entender o markup dinâmico das telas (cards do dashboard, calendário etc.), adicionar `src/js/views/` e `src/js/components.js` ao pacote (opção descartada nesta sessão por escolha do usuário).
- Se o pacote for usado com frequência, considerar transformar em script `scripts/export-design.mjs` + `npm run export:design`.
