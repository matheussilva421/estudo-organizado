# GOAL ÚNICO — CODEX DESKTOP — ESTUDO ORGANIZADO V2 / F7-UX

**Estado documental:** F7_UX_GOAL_PREPARED_NOT_EXECUTED. Preparado após aprovação expressa do Writing Plans em 05/11/2026. A publicação deste arquivo no GitHub **não autoriza nem executa código**. O início depende de comando futuro explícito do proprietário para EXECUTAR este GOAL.

**Repositório:** matheussilva421/estudo-organizado.
**Destino de desenvolvimento da V2:** branch v2. **main permanece V1 produtiva, intocável por este GOAL.**
**HEAD remoto documental de entrada:** origin/v2 = 077de1606ccdf84394753ea0ffbf6a24618b8e1a, sujeito a atualização e revalidação no preflight; origin/main = 9046cfa2283cd293b38df9d52fabfcd5de9ac67c.
**Estado de referência remoto:** zero PRs abertos no momento da elaboração. Estado de Git, worktrees, arquivos e commits locais **não verificado nesta sessão**.
**Objetivo:** implementar, testar e revisar integralmente o redesign F7-UX aprovado (D01–D71; critérios AC-01–AC-24), aproveitando a F6 e a implementação local da F7, sem duplicar funcionalidades, perder dados, violar gates externos ou criar complexidade desnecessária.

## 0. Autoridade, documentos e como usar este GOAL

Quando eu, proprietário, enviar este documento ao Codex Desktop acompanhado de uma ordem explícita "EXECUTE o GOAL F7-UX", essa ordem autorizará o desenvolvimento LOCAL da F7-UX na estrutura segura da V2: leitura, alteração de código e testes, instalação de dependências gratuitas estritamente necessárias, testes locais/emuladores, revisão, commits locais e preparação de integração. Publicação de código em origin/v2 pode ser efetuada apenas com autorização expressa de integração, ausência de risco novo, estado sincronizado e push fast-forward comprovável; na dúvida, entregar commits locais validados e a instrução exata de integração. **Nunca** integrar à main, ativar serviços reais ou publicar staging por implicação. Sem ordem explícita, este documento é somente referência.

Ler integralmente, antes de qualquer alteração, nesta ordem:
1. docs/superpowers/v2/ROADMAP.md — status e gates posteriores ao texto histórico.
2. docs/superpowers/specs/2026-11-05-estudo-organizado-v2-f7-ux-design.md — **especificação formal aprovada, fonte vinculante**; não alterá-la silenciosamente.
3. docs/superpowers/plans/2026-11-05-estudo-organizado-v2-f7-ux-writing-plans.md — **Writing Plans aprovado, UX-01–UX-31**; usar todos os ciclos e critérios.
4. docs/superpowers/v2/transcripts/2026-11-05-f7-ux-conversa-completa.md — evidência histórica literal D01–D71, inclusive ressalvas e escolhas subsequentes; arquivo público, não duplicar.
5. docs/superpowers/specs/2026-11-04-estudo-organizado-v2-f7-design.md; docs/superpowers/plans/2026-11-04-estudo-organizado-v2-f7-writing-plans.md; docs/superpowers/goals/2026-11-04-estudo-organizado-v2-f7-codex-desktop.md — baseline funcional F7 T01–T27, contratos, restrições e gates independentes.
6. Documentos F6 e de domínio F2–F5, AGENTS.md, os contratos A-02, os testes e o código efetivos. Não assumir que cabeçalhos antigos PROPOSTA alterem aceites registrados posteriormente.

**Normas de precedência:** decisão expressa do proprietário > spec F7-UX aprovada para experiência > plano F7-UX aprovado > baseline F7 funcional para Auth/sync/backup > documentação histórica, sem alterar a semântica dos contratos já aceitos. A F7-UX **complementa**, não substitui, a F7. Não renumerar D01–D71 nem T01–T27; D30 integra Análises após seu adiamento histórico. A busca aprovada em D35 recebe esforço proporcional à preferência posterior de não priorizá-la.

## 1. Preflight obrigatório — diagnóstico antes da primeira edição

No checkout local, antes de gerar branch/worktree/arquivo:
- Identificar raiz real, remotos, branch atual, HEAD, git status --short, diferenças staged/unstaged/untracked, git log --all --oneline --decorate, git branch -vv, git remote -v, git worktree list, git stash list e git fsck --no-reflogs (se suportado).
- git fetch apenas quando rede e estado permitirem, sem modificar árvore de trabalho; comparar origin/v2 e v2 local, origin/main e main local, commits exclusivos pela dupla contagem e git log --left-right --cherry-pick, divergência e proteção/rulesets. Listar PRs abertos, ramas remotas, Actions existentes sem criar/executar outras.
- Confrontar relato histórico **F7_LOCAL_CODE_COMPLETE / F7_BLOCKED_G-EXT_G-STAGING**, v2 local em 9b2f0f5, 31 commits sobre origin/v2@6c70fef, sem push, com o estado real. Esse relato pode estar obsoleto: **confirmar**. O commit documental 077de16 pode estar do outro lado de uma divergência; preservar e integrar sem reset nem descarte. Verificar código funcional T01–T25 antes de iniciar UX.
- Inventariar e preservar commits/branches/worktrees com trabalho exclusivo, particularmente preservação da F5 e capturas/evidências F4. Não apagar nem fechar itens com código único. Identificar mudanças locais não salvas e criar cópia verificável antes de operações que as exponham.
- Verificar arquivos existentes, padrões de testes, versões de ferramentas, e quais contratos UX já foram parcialmente implementados na F7 local. O plano contém caminhos de arquivos candidatos e placeholders explicativos, não caminhos para criar literalmente. Corrigir **comandos de teste obviamente inadequados no momento de executar**: .spec.ts usa Playwright; .test.ts usa Vitest; Markdown/README não é arquivo de teste e nunca deve ser passado diretamente a npm test. Registrar esses ajustes técnicos sem alterar as decisões do plano.
- Montar quadro "já feito / a implementar / conflito / bloqueado externo", vinculado a UX-01–UX-31, AC-01–AC-24 e F7 T01–T27. Evitar duplicar código e refazer testes reais inexistentes como se fossem concluídos.
- Gate G0: se não for possível preservar com segurança trabalho exclusivo ou se houver divergência Git não conciliável sem destruição, **não editar o material em risco**. Fazer inventário preciso, conservar tudo e continuar em atividades independentes e seguras.

Comandos de diagnóstico sugeridos, adaptáveis a PowerShell/Windows e ao checkout real:
~~~
git status --short --branch
git branch -vv
git remote -v
git worktree list
git stash list
git log --all --oneline --decorate -30
git log --left-right --cherry-pick --oneline origin/v2...v2
git diff --stat
git diff --cached --stat
~~~

## 2. Escopo e invariantes vinculantes

Realizar as **31 tarefas UX-01–UX-31 do Writing Plans**, sem desmembrá-las em 31 PRs ou branches. Preservar integralmente F2 Conteúdo, F3 Planejamento, F4 Sessões, F5 Revisões, F6 Shell, F7 Auth/sync/backup local implementado, banco IndexedDB, dados e invariantes de domínio.

Invariantes obrigatórias:
- **R$ 0** de custo obrigatório; nenhuma nova infraestrutura paga, billing, Blaze, R2 pago, CI/CD, GitHub Actions ou dependência pesada sem justificativa técnica e autorização adicional quando envolver custo.
- **Local-first e offline-first:** operações acadêmicas úteis offline; sem exigir login Google para usar dados locais. Jamais prometer sincronização no app fechado, ou disponibilidade remota sem evidência.
- **V1/main intocáveis:** não mudar root src/, regras produtivas, domínio, deploy V1, dados ou Service Worker produtivos; sem F8/cutover.
- **Fatos só nos módulos de origem:** widgets, Home, Central de Atenção, Busca e Análises não escrevem fatos acadêmicos ao renderizar. Nenhum segundo backend, banco canônico, outbox ou mecanismo de revisão/planejamento.
- **Estados por evidência:** LOCAL_COMMITTED não equivale a ACK ou convergência; prévia SAFE não equivale a restauração; ausência de dados não equivale a zero; conflito parcial não equivale a conciliação completa.
- **Proveniência e integridade:** sessão concluída e ligada ao bloco não implica bloco cumprido; não duplicar tempo de concursos compartilhados; preservar metas, denominadores e versões históricas; respeitar anotações, rascunhos, intervalos, tombstones, epochs, outbox e backups antes de ações potencialmente destrutivas.
- **Identidade e segurança:** profileId, uid Google e remoteLibraryId separados; sem troca de conta, desvinculação, merge ou restauração involuntária; links profundos devem validar entidade e perfil.
- **Widgets e fórmulas:** apenas linguagem controlada de leitura, sem eval/JavaScript arbitrário, importação de dados perigosos ou ações de escrita tácitas. As operações de alteração passam por comandos validados e proteções proporcionais.
- **Acessibilidade:** teclado, foco, leitores de tela, contraste nos oito temas, zoom 200%, movimento reduzido, gestos não obrigatórios e alternativa tabular acessível. Densidade compacta não oculta alertas ou reduz alvos críticos.
- **Governança:** não reabrir D01–D71 por preferência; apenas evidência material nova autoriza escalar decisão arquitetural. Não entrar em loops de reescrita visual subjetiva.

## 3. Execução por ondas, com TDD e aceites independentes

**Método obrigatório em cada tarefa UX-01–UX-31:** localizar contratos reais, escrever teste de comportamento que falhe no estado atual quando o requisito não estiver atendido, verificar a falha (RED), fazer menor mudança adequada (GREEN), executar o teste-alvo e regressões relacionadas, revisar a diferença, validar acessibilidade e dados preservados, agrupar commits coerentes. Se requisito já implementado e passando, registrar evidência e **não duplicar**. Se dependência externa faltar, usar emulador/fixture para os contratos locais e marcar separadamente teste real NOT_RUN/BLOCKED. Não disfarçar testes omitidos como PASS.

### Onda 0 — inventário, verdade e navegação (UX-01–UX-05)
- UX-01: preservar baseline real, rotas históricas, screenshots sintéticas e inventário.
- UX-02: padronizar apresentação de persistência, outbox, ACK, convergência, backup, leitura parcial, erro, quota e conflitos, usando estados existentes.
- UX-03: corrigir inferência de bloco cumprido por mero vínculo e saúde local baseada apenas em editais/disciplinas; testes negativos antes do ajuste.
- UX-04: rotas tipadas profundas com ID real, perfil verificado, arquivamento e retorno contextual seguro.
- UX-05: proteger rascunhos, sessões em andamento, mudanças de rota/perfil/viewport e foco em diálogos.

### Onda 1 — Shell e atenção (UX-06–UX-08)
- UX-06: navegação D31–D34 em desktop/sidebar, tablet/rail e celular/barra inferior; ação Estudar contextual **não inicia sessão automaticamente**; preservar legacy overview.
- UX-07: Central de Atenção com identidade causal única, prioridades explicáveis, badges coerentes e encaminhamento ao registro certo; dispensar aviso nunca altera fato.
- UX-08: Busca rápida e página completa com mecanismo local existente, agrupamentos e atalhos apenas onde úteis; prioridade secundária e nenhuma IA/serviço novo.

### Onda 2 — Home e widgets (UX-09–UX-13)
- UX-09: layouts prontos personalizáveis, grade responsiva com ajuste por dispositivo e proteção de preferências.
- UX-10: catálogo e editor de widgets, fontes internas compatíveis, tipo/filtro/estado com indicadores de procedência.
- UX-11: parser controlado de fórmulas/condições, denominadores, unidades e agregações corretas; rejeitar operações inseguras.
- UX-12: filtros globais, por widget e grupos conectados, detalhes contextuais e navegação por camadas; sem estado global mutável de fatos.
- UX-13: ações rápidas com proteção proporcional e estados semânticos; visualização não grava dados.

### Onda 3 — módulos acadêmicos (UX-14–UX-21)
- UX-14–15, Conteúdo: explorador hierárquico, seleção por edital/disciplina, detalhes, edição, reordenação e vínculos, respeitando identidades canônicas.
- UX-16–17, Planejamento: cenários, calendário, capacidade, assistente, ciclos, reta final e replanejamento com simulação/commit e histórico.
- UX-18–19, Sessões: cronômetro, registros manuais, histórico, hábitos, recuperação, tempos verificados/incertos separados; nenhuma perda em navegação.
- UX-20–21, Revisões: fila, execução, políticas, evidências, agenda e histórico, sem transformar avaliações subjetivas em retenção cientificamente medida.

### Onda 4 — Análises (UX-22–UX-24)
- UX-22: métricas auditáveis, períodos, scopes, proveniência, denominadores e fingerprint/cache com cobertura de medições e alocações; corrigir dados stale.
- UX-23: gráficos apropriados à métrica, editor avançado, séries/legendas/formatos e tabelas equivalentes, sem combinar unidades incompatíveis nem fazer médias indevidas.
- UX-24: snapshots históricos imutáveis, versões metodológicas e exportação segura, sem atualizar arquivos históricos ao mudar os dados de origem.

### Onda 5 — Configurações (UX-25–UX-27)
- UX-25: perfil, preferências por dispositivo, vínculo consentido e informação precisa sobre local/remoto/convergido, autenticação/cota/conflitos; manter F7 real separada das simulações.
- UX-26: backup integral, cobertura por domínio, exportação, verificação e restauração protegida, compatíveis com contratos F7 já implementados; backup não validado nunca vira recuperabilidade comprovada.
- UX-27: IndexedDB/upgrade/quota, caches regeneráveis, diagnósticos e limpeza segura; rascunhos e sessões sempre protegidos; reset/desvinculação/exclusão exigem prévia, proteção e consentimento.

### Onda 6 — consistência, E2E e revisão final (UX-28–UX-31)
- UX-28: design system incremental, 8 temas, fontes existentes, tokens, contraste/foco, padrões comuns e componentes especializados. Corrigir inconsistente --text-primary se realmente presente. Não trocar UI toolkit sem necessidade.
- UX-29: jornadas F2→F3→F4→F5→Análises→Configurações, navegando por IDs, duas abas, offline, refresh e contextos de perfil.
- UX-30: typecheck, lint, build, unit, E2E, screenshots e verificações acessíveis em 320/390 px, tablet, desktop, zoom 200%, oito temas, teclado e leitor de tela quando realmente disponível.
- UX-31: revisão independente crítica de segurança dos dados, UX e aderência a AC-01–AC-24; correções materiais limitadas, integração apenas autorizada, higiene de branches/PRs/worktrees, read-back e relatório final.

## 4. Comandos de teste e prova local

Na raiz REAL de apps/v2, confirmar scripts e ambiente antes de executar:
~~~
npm ci
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run test:e2e
~~~
Para RED/GREEN: usar npm run test:unit -- tests/unit/ARQUIVO.test.ts ou npm run test:e2e -- tests/e2e/ARQUIVO.spec.ts. Nunca passar arquivo Markdown ou caminho ilustrativo ao test runner; os caminhos de UX-31 e prefixos duplicados no plano são indicações documentais que precisam ser normalizadas ao checkout, **não novas funcionalidades**.

Quando houver falha de ambiente, distinguir erro de ferramenta, falha de assertiva, flakiness e bloqueio externo. Não corrigir indiscriminadamente suíte histórica; preservar screenshots e testes baseline F4/F5/F6. Reexecutar seletivamente após correção e todo conjunto relevante antes de marcar pronto.

Cada item de AC-01 a AC-24 deve conter: status PASS/FAIL/BLOCKED/NOT_RUN, teste, comando, log resumido, screenshot/evidência quando aplicável, commit e responsável pelo gate. Sem afirmações não verificadas. Testes manuais de NVDA/Narrator/hardware que não ocorrerem permanecem NOT_RUN.

## 5. Pontos críticos de revisão, aceitabilidade e gates

Revisar particularmente:
1. Vínculo de sessão ≠ conclusão comprovada de bloco; Home/Atenção/Plano/Análises concordam.
2. Sessão ou revisão existente sem edital não é banco vazio; commit é transacional e local.
3. Filtros, séries, percentuais e exportações com mesma metodologia e ausência explícita de dados.
4. Comportamentos offline, cota, IndexedDB BLOCKED_UPGRADE, stale/cache, pausas de Auth, outbox e ACK incerto, sem falsos sucessos nem perda de rascunho.
5. Troca de perfil, edição concorrente, exclusões, tombstones e restore SAFE/REBASELINE_REQUIRED protegidos.
6. Acessibilidade e responsividade com capturas dos oito temas, sem truncar ações essenciais ou ocultar avisos.

**G-EXT:** não configurar nem usar projetos Google/Firebase/Cloudflare reais sem autorização separada. Simuladores e serviços locais gratuitos podem ser usados quando apropriados e sem efeitos no ambiente real.
**G-STAGING:** sem URL publicada ou deploy antes do consentimento específico.
**G-F7/UX-H:** homologação humana não substituída por E2E.
**F8/G-MAIN:** não modificar main, regras, deploy, produção ou V1. Merge v2→main requer aprovação própria posterior.
**Destrutivo:** exclusões não recuperáveis, reset, force push, perda de commits únicos, alteração de dado real ou fechamento de PR com trabalho exclusivo requerem inventário e aprovação expressa; interromper apenas a ação proibida, não tarefas locais independentes.
**Gate de qualidade UX:** não declarar READY se houver defeito crítico de perda de dados, confiança das métricas, identidade ou acessibilidade impeditiva. Não chamar sucesso local de homologação remota.

## 6. Integração e higiene Git

Preferir um único fluxo na branch v2 já existente. Não criar PRs/worktrees/branches por tarefa. Se for necessário isolamento para preservar trabalho local, justificar e usar branch/worktree temporário inventariado, integrando-o e eliminando-o apenas após verificação, autorização e ausência de commits exclusivos.

Fazer commits pequenos por grupo de entregas validadas, nunca por puro ritual. Antes de push autorizado: verificar Git status, base ancestry, diff com origin/v2, hashes, tests e conflitos; somente fast-forward, sem force. Após push, consultar remoto e confirmar HEAD/read-back. Se a publicação não estiver autorizada ou for insegura, manter commits íntegros e entregar comandos exatos para finalizar; registrar status CODE_COMPLETE_LOCAL / TESTED / INTEGRATED_V2 separadamente. **Nunca declarar integração à main.**

Atualizar preferencialmente o registro de estado existente (ROADMAP) e não produzir múltiplos relatórios redundantes. Nenhuma GitHub Action/CI nova.

## 7. Entrega obrigatória e ZIP de revisão

Ao finalizar, gerar **um ZIP** de auditoria, sem credenciais ou dados pessoais e sem node_modules/builds/cache. Sugestão de nome: F7-UX-REVIEW-YYYY-MM-DD.zip.

Conteúdo mínimo:
- SUMMARY.md: realizado, comparativo antes/depois, módulos, decisões, screenshots relevantes.
- ACCEPTANCE-MATRIX.md: UX-01–UX-31 e AC-01–AC-24, cada um com resultado e evidência verificável.
- TEST-RESULTS.md: comandos exatos, versões, PASS/FAIL/SKIP/BLOCKED/NOT_RUN, logs e limites.
- GIT-STATE.md: HEADs v2 local/origin, main, commits, diff, branches, PRs, worktrees, stashes e itens com código exclusivo.
- GATES-AND-RISKS.md: G-EXT, G-STAGING, G-F7/UX-H, riscos, medidas de proteção, backup e rollback quando cabível.
- Docs aprovados pertinentes: spec e plano F7-UX, e índices/links ao histórico público sem replicar necessariamente a transcrição inteira.
- Screenshots/evidências em tamanho razoável, sanitizados, organizados por módulo e viewport; hashes SHA-256 do ZIP e arquivos importantes.

Enviar resumo objetivo com: implementado, testado, integração autorizada realizada ou não, bloqueios externos reais, evidências, linhas/commits alterados, links e ZIP local verificável. Relatar se a fase está ACEITÁVEL_PARA_REVISÃO, BLOQUEADA_EM_GATES_EXTERNOS ou apenas LOCAL_CODE_COMPLETE; nunca declarar aceita sem homologação humana e integração/limpeza adequadas.

## 8. Critério de parada e interpretação

Se alguma tarefa demandar nova decisão arquitetural material ou ação de risco fora da autorização, parar **somente essa ação**, fornecer evidências e continuar o restante seguro. Não interromper o GOAL por dúvidas de nomenclatura, preferências de design já aprovadas, escolhas técnicas triviais ou ausência de serviços remotos que possam ser simulados legitimamente. Sem ciclos infinitos: uma revisão crítica completa e uma rodada de correções materiais, seguidas de revalidação proporcional.

O resultado esperado é **código F7-UX local testável e demonstrável**, preparado para revisão, com o trabalho F7 preexistente intacto, sem prometer homologação de APIs externas, staging, aceite humano ou F8. A validação dos gates externos será uma atividade posterior explicitamente autorizada.