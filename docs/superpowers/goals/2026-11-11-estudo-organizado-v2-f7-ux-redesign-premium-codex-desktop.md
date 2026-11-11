# GOAL ÚNICO — CODEX DESKTOP
## Estudo Organizado V2 | F7-UX — Implementação do Redesign Premium aprovado

**Data:** 11/11/2026  
**Repositório:** `matheussilva421/estudo-organizado`  
**Checkout candidato histórico:** `C:\Projetos\estudo-organizado\_v2-candidate` — descobrir/confirmar no computador; não supor que seja o caminho ativo.  
**Branch de desenvolvimento V2:** `v2` — `main` hospeda a V1 e **não é destino autorizado de integração deste GOAL**.  
**Fase:** F7-UX Redesign Premium, **delta visual incremental**, sem refazer F7-UX original, F2–F7 ou V1.  
**Autorização deste GOAL quando enviado pelo proprietário ao Codex:** implementar localmente as tarefas aprovadas RP-00–RP-15, corrigir regressões materiais do escopo, executar testes locais, gerar documentação/evidências e ZIP, e produzir commits locais coesos. **Não** autoriza push de código, merge com `main`, deploy, alteração de serviços externos ou operações destrutivas. A publicação *documental* anterior neste chat foi autorizada separadamente, e não autoriza publicação do código novo.

## 0. Fontes canônicas, hierarquia e entregável

Ler antes de editar, nesta ordem:

1. `AGENTS.md`, regras reais do checkout, `docs/superpowers/v2/ROADMAP.md` e último registro de estado.
2. **Spec complementar premium aprovada em 11/11/2026:** `docs/superpowers/specs/2026-11-11-estudo-organizado-v2-f7-ux-redesign-premium-design.md` — **DV-01–DV-18 e VA-01–VA-20**. O cabeçalho de proposta é histórico: o usuário aprovou expressamente a v1.0 em 11/11/2026.
3. **Writing Plans premium aprovado em 11/11/2026:** `docs/superpowers/plans/2026-11-11-estudo-organizado-v2-f7-ux-redesign-premium-writing-plans.md` — **RP-00–RP-15**. Cabeçalho histórico de proposta não invalida aceite.
4. Spec-base aprovada: `docs/superpowers/specs/2026-11-05-estudo-organizado-v2-f7-ux-design.md` — **D01–D71**, inclusive D30 (posteriormente aprovada), e **AC-01–AC-24**.
5. Plano F7-UX histórico: `docs/superpowers/plans/2026-11-05-estudo-organizado-v2-f7-ux-writing-plans.md` — UX-01–UX-31; **NÃO executar tudo novamente**.
6. Transcrição histórica original, documentos F2–F7, spec funcional de sync/backup, relatos e evidências reais da implementação local. Não republicar transcrições com dados pessoais.
7. Pacotes de auditoria de 10/11/2026, **se disponíveis**: `ESTUDO-ORGANIZADO-V2-F7-UX-HUMAN-REVIEW-READY-29d35c2c.zip`, `F7-UX-REVIEW-2026-11-10.zip`, com `GIT-STATE.md`, matriz de reaproveitamento, capturas e relatórios. Ausência dos ZIPs não é autorização para inventar seus conteúdos; use os documentos correspondentes do checkout.
8. Mockups aprovados dos temas Neon Teal, Esmeralda e Dourado, Azul e Âmbar, Azul Glacial/Prata. São referências conceituais, **não** screenshots implementadas nem contrato pixel-perfect.

**Hierarquia:** aprovações explícitas D01–D71/DV-01–DV-18 → specs aprovadas → Writing Plans aprovados → contratos funcionais F2–F7 → código e auditorias conforme evidência atual. Em choque material não resolvível, interromper só a decisão afetada e reportar, sem reabrir decisões por preferência pessoal.

**Resultado pretendido:** um único Redesign Premium integrado à implementação F7-UX existente, funcional localmente e com evidências de teste, demonstrável ao proprietário, 12 temas e UX premium conforme critérios VA-01–VA-20. **Não confundir TESTED_LOCAL com INTEGRATED_V2_REMOTE, UX_HUMAN_ACCEPTED, G-EXT/G-STAGING ou DEPLOYED.**

## 1. Preflight e resgate obrigatórios — RP-00 (antes de qualquer edição)

O último pacote histórico informou: `main@9046cfa2283cd293b38df9d52fabfcd5de9ac67c`; `origin/v2@7a7df0f2f9911a0d5956cb9b94ffa03659d24905`; HEAD local de código testado `0c31e6ef`; HEAD local documental `29d35c2c`; **94 commits locais à frente do remoto**; 876 unitários PASS, 201 E2E PASS + 3 SKIP, typecheck/lint/build PASS. Tudo isso é **histórico**, não prova atual. O GitHub foi atualizado documentalmente após aquele relatório; portanto **o remoto pode ter avançado e ter divergido do histórico local**. Não confiar em contagem de commits antiga nem usar `git pull` automático.

Inicialmente, somente leitura/diagnóstico, em PowerShell ou shell equivalente:

```bash
git rev-parse --show-toplevel
git status --short --branch
git rev-parse HEAD
git remote -v
git branch -vv
git branch -a
git worktree list --porcelain
git stash list
git log --oneline --decorate -30
git status --porcelain=v2
git diff --stat
git diff --cached --stat
git fetch --no-prune origin
git rev-parse origin/main origin/v2
git merge-base HEAD origin/v2
git rev-list --left-right --count origin/v2...HEAD
git log --left-right --cherry-pick --oneline origin/v2...HEAD
# Se gh estiver disponível e autenticado:
gh pr list --repo matheussilva421/estudo-organizado --state open
```

Verificar nomes, caminhos, autores e exclusividade dos commits locais; arquivos modificados/untracked, stashes, branches/worktrees (inclusive remotos antigos), proteções, alterações recentes e documentos aprovados. **Documentar** diferenças entre HEAD local, `v2` local e `origin/v2` após o commit documental publicado por este chat. **Proteger primeiro** trabalho exclusivo e arquivos não rastreados, com cópia fora do checkout (idealmente `git bundle` verificado por `git bundle verify` + SHA-256, e cópia sanitizada de untracked relevantes). Não colocar credenciais no ZIP. Não assumir que `git bundle` inclui untracked.

**Reconciliação de branch:** se o novo commit remoto for **somente documental** e o trabalho local contiver os commits funcionais exclusivos, preservar os dois lados e então fazer a menor reconciliação **não destrutiva**, após inspecionar ancestralidade e diffs: por exemplo, merge local convencional de `origin/v2` em `v2` para conservar ambos os pais, somente se não houver sobreposição/perda nem problemas na árvore. Preferir resolver os conflitos locais de documentação conservando conteúdo aprovado. Nenhum rebase que reescreva commits locais, force push ou reset de branch. Se houver incerteza material, conflito irredutível ou impossibilidade de backup, bloquear só a operação Git perigosa, registrar diagnóstico e seguir apenas com o que for seguro.

**Vedações absolutas sem nova autorização:** `reset --hard`, `clean -fd`, `push --force`, excluir branch/stash/worktree com alterações únicas, mover `main`, modificar V1, sobrescrever banco ou restaurar dados reais. Não criar branch/PR/worktree salvo isolamento indispensável e documentado; se excepcional, assegurar convergência posterior e higiene.

**Saída RP-00:** estado Git real e SHA de cada referência, cópia de segurança validada, relação exata de commits/arquivos exclusivos, plano de reconciliação executado com segurança ou bloqueio preciso. Antes de editar código, conferir que o checkout alvo realmente representa **a melhor base funcional local preservada**.

## 2. Escopo vinculante e não escopo

**Implementar:** RP-01–RP-15 da spec/plano aprovados, sempre reaproveitando a apresentação atual. Garantir catálogo de **12 temas** (oito existentes: Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex, Plasma; quatro novos: Neon Teal, Esmeralda e Dourado, Azul e Âmbar, Azul Glacial/Prata); galeria e controles por tema; acabamento `Layered Premium`; Home contextual e onboarding progressivo; `Progressive Workspace`; Modo Foco opt-in reutilizando a mesma sessão; Planning Studio; Review Studio; Insights Studio; Knowledge Studio; Command Center; Settings Studio; Mobile Layers; motion/feedback semanticamente corretos; compatibilidade com responsividade e a11y.

**Não implementar:** segundo sistema de domínio/sync/clock/backup, substituição de V1, F8, Cloudflare/Firebase externos reais, migração real V1, Rules remotas, mudanças em billing, staging público, novos serviços pagos, nova stack/framework ou novas GitHub Actions/CI. Não reabrir D01–D71 e DV-01–DV-18; não duplicar UX-01–UX-31 se comprovadamente implementados.

**Contratos sem exceção:**
- Fonte de verdade: Conteúdo/Planejamento/Sessões/Revisões; Home/Busca/Atenção/Analytics read-only nas projeções.
- `LOCAL_COMMITTED` ≠ outbox pendente ≠ ACK ≠ convergência ≠ backup verificadamente recuperável; `SAFE` de prévia de backup **não** é restauração executada; `STALE`/`PARTIAL`/`INSUFFICIENT_DATA` não são zero.
- Vínculo de bloco a sessão ≠ bloco conciliado/cumprido; múltiplos concursos não duplicam horas.
- Modo Foco é camada de UI da **mesma sessão/clock/controlador**, sem persistência paralela; pausas, checkpoint, precisão, intervalo, tempo manual e recuperação preservados.
- Ações críticas (conflito, perda, restauração, migração bloqueada, quota) permanecem acessíveis, inclusive com densidade compacta ou Modo Foco.
- Mobile D33 mantém **Início · Plano · Estudar · Revisões · Mais**, com outros destinos alcançáveis.
- View Dia do Planejamento continua acessível apesar do protagonismo de Semana/Mês/Lista; estados, rascunhos, filtros, identidade, deep links e retorno preservados.
- 12 temas devem respeitar contraste, foco visível, `prefers-reduced-motion`, teclado, toque e 320 px. Fontes e identidade existentes preservadas. A estética não pode redefinir fatos, prioridades, prazos ou políticas.

## 3. Execução autônoma — plano RP-01–RP-15

**Princípio de eficiência:** inspecionar o que já existe; marcar `REUSE`, `PARTIAL`, `MISSING` ou `BLOCKED`; modificar somente o delta. Superpowers `executing-plans`/`subagent-driven-development` quando disponíveis e oportunos, com divisão de arquivos para evitar edições concorrentes. Cada requisito não implementado deve ter teste relevante **RED → GREEN → REFACTOR**; requisito já coberto por teste PASS não requer falha artificial. Após cada cluster: regressão local, revisão do diff, correção e commit local coeso. Não abrir PR por tarefa.

### Etapa 0 — RP-01 | Baseline e matriz de aderência

Ler matrizes prévias, mapear os **18 DVs, 20 VAs e 24 ACs**, com `REUSE/PARTIAL/MISSING/BLOCKED`, localização no HEAD real e teste/evidência. Capturar base com fixtures sintéticas: Home vazia, rotina normal, reta final, amostra insuficiente, aviso crítico e sessão ativa. Inspecionar páginas de todos os módulos em desktop/tablet/mobile 390 e 320 px e com zoom 200%, sem inferir comportamento por screenshots. Diagnosticar P2 antigos, sem apagar histórico. Essa tarefa não precisa alterar produto.

### Etapa I — RP-02 e RP-03 | Fundação e design system premium

**RP-02:** estender tokens/componentes e persistência do seletor para 12 temas, com galeria visual, prévia, seleção, personalização por tema de glow (off/sutil/moderado/alto), animação (off/sutil/completa), densidade (compacta/confortável/espaçosa) e aparência dos cards, reset seguro, valor desconhecido com fallback e preferências acadêmicas intactas. Respeitar movimento reduzido e contraste. Aplicação sem reload. Não clonar CSS por tema.

**RP-03:** implementar `Layered Premium` com superfícies sólidas legíveis e gradientes/vidro/glow só onde significativos; feedback inline, transições sutis e avisos persistentes quando críticos. Validar UI para os estados de persistência/sync/backup/erro, sem relatórios falsos de sucesso. Reusar componentes, serviços e estado de UI existentes, sem inventar uma abstração universal nova.

### Etapa II — RP-04 e RP-05 | Shell, busca, atenção e Home

**RP-04:** preservar rotas legadas, identidade e deep links; compor cabeçalho discreto e `Contextual Command Center` para busca/comandos/navegação reais, com controle por teclado (incluindo atalho de busca sem capturar input indevidamente), foco/retorno/rascunhos preservados. Central de Atenção deduplicada, com acesso a detalhes reais; cinco destinos mobile D33.

**RP-05:** Home Bento com hero e próximo passo real; onboarding premium progressivo sem cartões de zeros, contextos primeiro uso/estudo diário/reta final/desempenho; transição progressiva sem apagar layout escolhido. Rearranjo estrutural só com aprovação explícita, preferências fixadas e sessão ativa têm precedência. Preservar editor de widgets/fórmulas, filtros, prioridades explicáveis e projeções existentes.

### Etapa III — RP-06–RP-09 | Workspaces acadêmicos

**RP-06 Conteúdo:** biblioteca visual + árvore acadêmica + inspeção lateral, IDs/perfil preservados; árvores extensas, homônimos, reordenação sem ciclos, opção acessível sem drag-and-drop, vínculos com aulas protegidos; não reinterpretar progresso.

**RP-07 Planejamento:** calendário/agenda com Semana, Mês, Lista e acesso Dia; preferências persistentes, painel contextual e capacidade/conflitos; preservar cenários, prévias, CAS, checkpoints e consentimento no replanejamento. Não contar sessão vinculada como cumprimento.

**RP-08 Sessões — máximo cuidado:** introduzir Modo Foco opcional, com **um único clock** e uma entidade de sessão, materiais/anotações sem abandonar contexto. Testar iniciar→Foco→pausar→retornar→continuar→concluir em relógio controlado; read-back deve confirmar um único evento e mesmo tempo verificado. Proteger duas abas, offline, recuperação, rascunhos, alertas críticos e ausência de writes extras. Revisão independente específica dessa etapa.

**RP-09 Revisões:** fila contextual explicável, execução focada, histórico visual auditável; estado `STARTED`, política versionada, avaliações e links preservados; visualização não conclui automaticamente revisão nem reescreve histórico. Filtros e contador coerentes.

### Etapa IV — RP-10 e RP-11 | Insights e Configurações

**RP-10:** dashboard analítico visual + exploração detalhada (gráfico/tabela), mesma fonte/método/unidades/denominadores, amostra insuficiente e dados stale/partial explicitados; sem dupla contagem entre concursos, exportação segura e snapshots preservados.

**RP-11:** categorias de Configurações, aparência premium (integrar RP-02), perfil/dados/sync/backup/privacidade organizados em camadas sem ocultar recuperação. Fluxos críticos com confirmação, sem ação destrutiva introduzida por UI cosmética. Comportamento offline intacto.

### Etapa V — RP-12 e RP-13 | Mobile, acessibilidade e desempenho

**RP-12:** bottom sheets para tarefas breves, telas dedicadas para operações longas/protegidas, painéis laterais no desktop, mas **um único estado de formulário**. Gestão de foco/Escape/voltar, resize/rotação/zoom, teclado virtual e 320 px; não descartar rascunhos ou trocar sessão.

**RP-13:** auditar contraste nos 12 temas, nomes acessíveis, leitor de tela se disponível, foco, movimento reduzido, semântica de gráficos, alertas em foco e viewports 320/390/720/721/1023/1024 px, zoom 200% e janela baixa. Medir desempenho antes/depois sem inventar métricas; efeitos leves ou desligados em hardware modesto com evidência. Se leitor físico/NVDA/Narrator ausente, marcar `NOT_RUN_ENVIRONMENT` e explicar.

### Etapa VI — RP-14 e RP-15 | Revisão, evidência e fechamento seguro

**RP-14:** rodar regressão V2 efetivamente disponível, typecheck, lint, build, unit e E2E; offline/refresh/fixtures, guards, precisão do timer, identidade e backup em testes **isolados**; revisar CSS redundante e dependências. Uma revisão independente técnica de riscos reais, corrigir problemas materiais e repetir testes proporcionais. Matrix de **VA-01–VA-20** e **AC-01–AC-24** com `PASS_VERIFIED/PARTIAL/FAIL/BLOCKED_EXTERNAL/NOT_RUN/NOT_APPLICABLE_JUSTIFIED` e referência direta à evidência. Fazer revisão visual humana com capturas e checklist, **não autodeclarar UX-H aprovado**.

Comandos candidatos (verificar `apps/v2/package.json` primeiro):

```bash
cd apps/v2
npm ci
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run test:e2e
```

Use Node/npm/Playwright do ambiente efetivo, ambiente isolado de teste e diretório de dados sintéticos; `npm ci` somente se o lockfile e a instalação puderem ser preservados. Sem modificar pipelines existentes. Falha ambiental recebe `NOT_RUN_ENVIRONMENT`, não PASS. Não silenciar falhas por `skip`.

**RP-15:** atualizar preferencialmente o ROADMAP/registro de estado **na cópia local correta após reconciliação**, preservando documentos históricos. Gerar commits coesos na `v2` local quando seguro; não fazer push remoto de implementação nem integrar `main` sem autorização futura específica. Inventariar e, **somente se previamente autorizado e provadamente integrados**, limpar branches, PRs, worktrees e stashes obsoletos. Com trabalho exclusivo, não apagar: detalhar item e risco.

## 4. Gates de qualidade e parada

- **G0 Git:** nenhuma edição antes de backup/reconciliação não destrutiva dos commits exclusivos; se bloqueada a integração Git, não arriscar conteúdo. Preservar todo trabalho.
- **G-Q testes:** não declarar pronto com P0/P1 aberto em integridade, sessão, perfil, backup, recuperação, a11y impeditiva ou falsa confirmação. Testes que não rodaram impedem alegações totais.
- **G-H UX:** a avaliação e aprovação do usuário são necessárias separadamente após demonstração dos 12 temas e workspaces. Quatro temas adicionais devem poder ser selecionados, não só mockups.
- **G-EXT e G-STAGING:** não ativar/autenticar serviços remotos nem prometer sync multi-dispositivo real. F8 e cutover V1 continuam proibidos.
- **G-MAIN:** a `main` pertence à V1; não criar integração V2→main. O push para `origin/v2` do **código** depende de autorização específica posterior. Caso não autorizado, preparar estado reproduzível sem publicar.
- **Bloqueios humanos novos:** decisões arquiteturais materiais, operações destrutivas, alteração de conta real, uso de dados pessoais, custos ou segurança fora do escopo → documentar e bloquear apenas esse trecho, continuar tarefas seguras e apresentar ação mínima requerida.

## 5. Relatório final, GitHub Hygiene e ZIP obrigatório

Produzir **um único ZIP de revisão**, com nome `ESTUDO-ORGANIZADO-V2-F7-UX-PREMIUM-IMPLEMENTATION-REVIEW-YYYYMMDD.zip`, em diretório de saída conhecido e acessível, contendo ao menos:

- `SUMMARY.md`: delta efetivamente implementado e o reaproveitado, módulos e comparação antes/depois, limitações.
- `ACCEPTANCE-MATRIX.md`: D01–D71 preservadas, DV-01–DV-18, VA-01–VA-20, AC-01–AC-24 e referência ao histórico UX-01–UX-31, com status e provas.
- `TEST-RESULTS.md`: comandos, versões, duração quando medida, exit codes, PASS/FAIL/SKIP/NOT_RUN, ambiente e logs sanitizados.
- `VISUAL-REVIEW.md`: screenshot index por módulo, 12 temas, 320/390/desktop/tablet, Home vazia, Foco, alertas e visualização analítica; comparação com mockups **sem exigir pixel-perfect**.
- `GIT-STATE.md`: refs completas antes/depois, bundle/hash, alterações, commits locais, remoto, main, ancestrais, branches/PRs/stashes/worktrees e exclusividades.
- `RISKS-GATES-P2.md`: pendências antigas e novas, G-EXT, G-STAGING, UX-H, risco de sync/Firestore, bloqueios e próxima ação.
- `REPRODUCE.md`: como executar o candidato local sem acessar dados reais, ambiente e scripts.
- Cópias ou links das **specs/planos aprovados**, somente o estritamente necessário, e `SHA256SUMS.txt`.

Evitar `node_modules`, builds, caches, segredos, prints com dados pessoais e pacotes gigantes de logs. **Verificar ZIP por listagem, teste de extração/read-back e SHA-256** e reportar tamanho, caminho real e hash. Gerar provas independentes dos screenshots (assertions de DOM/IDB para funções de domínio). Não declarar package entregue sem confirmar arquivo no sistema real.

**Relatório ao proprietário, ao final, em português:** tabela de tarefas RP-00–RP-15, critérios VA/AC, testes e ressalvas, código e commits, situação exata de `v2` local e remoto, `main`, branch/PR/worktree/stash pendentes, arquivos chave, ZIP + hash, gates ainda fechados, proposta de próximo passo. Usar as categorias distintas `IMPLEMENTED_LOCAL`, `TESTED_LOCAL`, `COMMITTED_V2_LOCAL`, `PUSHED_ORIGIN_V2`, `MERGED_MAIN`, `DEPLOYED`, `UX_HUMAN_ACCEPTED` — somente marcar as comprovadas.

**Critério de encerramento:** entrega técnica preparada para UX-H **não** é integração remota ou homologação humana. Caso falte push autorizado, fechar como `LOCAL_REDESIGN_READY_FOR_HUMAN_REVIEW / REMOTE_PUSH_NOT_AUTHORIZED`, com zero perda e instrução precisa de integração posterior. Não pedir confirmação para escolhas técnicas rotineiras cobertas pelo plano, mas **nunca contornar** gates acima.

---

**COMECE POR RP-00.** Não aplique o plano antigo UX-01–UX-31 do zero, não execute ações externas e não suprima trabalho não publicado. Entregue máximo de resultado local verificável no escopo aprovado.
