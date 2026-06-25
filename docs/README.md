# Documentação — Estudo Organizado

Esta pasta concentra **toda** a documentação do projeto. A raiz `src/` contém
apenas o código da aplicação; nada de documentação vive lá dentro.

> Exceções que ficam na **raiz do repositório** por serem lidas por tooling/agentes:
> `README.md`, `README_DEV.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`,
> `PRODUCT.md`, `DESIGN.md` e `.impeccable/`.

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| [`architecture/`](architecture/) | Visão geral da arquitetura e fluxo de dados |
| [`api/`](api/) | Contratos internos (ex.: contrato de sync) |
| [`security/`](security/) | Modelo de ameaças, checklist operacional e `SECURITY.md` |
| [`qa/`](qa/) | Checklists de regressão manual e handoffs de QA |
| [`releases/`](releases/) | Checklist de release e changelogs de versão |
| [`guides/`](guides/) | Guias práticos: setup Firebase, paleta de temas, playbook de contexto, template de handoff |
| [`plans/`](plans/) | Planos de implementação e specs (histórico de evolução) |
| [`specs/`](specs/) | Especificações de design técnico |
| [`sync-hardening/`](sync-hardening/) | Trilha de hardening do sync (exploração → design → implementação) |
| [`handoffs/`](handoffs/) | Handoffs de sessões de desenvolvimento (um por sessão) |
| [`reports/`](reports/) | Relatórios e resumos pontuais de trabalho |
| [`context-map.json`](context-map.json) | Mapa de exports/imports gerado por `npm run context:map` |

## Convenções

- **Handoff por sessão:** ao encerrar um bloco de trabalho, crie
  `handoffs/handoff-AAAA-MM-DD-escopo.md`. Use
  [`guides/ai-handoff-template.md`](guides/ai-handoff-template.md) como base.
- **Datas absolutas:** sempre `AAAA-MM-DD` no nome e no corpo dos arquivos.
- **Documentos vivos vs. histórico:** `architecture/`, `api/`, `security/`,
  `qa/`, `releases/` e `guides/` são mantidos atualizados. `handoffs/`,
  `reports/`, `plans/` e `sync-hardening/` são registros datados — não reescreva
  o passado, adicione um novo arquivo.
