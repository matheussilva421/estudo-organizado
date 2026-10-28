# Estudo Organizado V2 — Especificação arquitetural formal (Superpowers)

**Data:** 2026-10-19
**Status:** APROVADA PELO USUÁRIO EM 2026-10-19 (G1) — IMPLEMENTAÇÃO NÃO AUTORIZADA
**Projeto:** matheussilva421/estudo-organizado
**Natureza:** desenho arquitetural e contratos de aceitação; nenhuma implementação autorizada
**Origem:** brainstorming Superpowers, Decisões Arquiteturais 01–27 aprovadas em 2026-10-19; Emenda A-01 Impeccable aprovada em 2026-10-19; **Emenda A-02 (sync multi-dispositivo/Google/Firestore Spark) aprovada em 2026-10-28**.
**Gate atual:** **F0 aceita com ressalvas** em 2026-10-28 ([aceite humano #108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470404279)); gate F0 recalculado `APPROVED`, sem homologar V1. Quatro riscos HIGH `UNVERIFIED`, 107 E2E FAIL, laboratório de layout `UNDECIDED` e fora da F1. **Spec e ADRs F1 em revisão, implementação não autorizada.** Consultar [roadmap V2](../v2/ROADMAP.md).
**Próximo gate condicionado:** revisão humana da [spec F1 proposta](2026-10-28-estudo-organizado-v2-f1-foundation-design.md) e das [cinco ADRs propostas](2026-10-28-v2-f1-architecture-decisions.md). Só depois da aprovação dessa spec produzir writing-plans; implementação exigirá aprovação adicional do plano e autorização específica.

## 1. Objetivo, usuários, resultados e regras inegociáveis

Reconstruir o Estudo Organizado V1 como uma aplicação V2 web/PWA, independente e integrável futuramente, destinada a concurseiros brasileiros que precisam organizar editais e materiais, planejar, executar, revisar, medir e corrigir os estudos. A proposta mantém o ciclo PDCA (planejar → executar → medir → corrigir).

O sucesso do produto será avaliado pela capacidade de o estudante (i) saber o próximo passo, (ii) registrar com precisão tempo e resultados, (iii) confiar em dados e estatísticas, (iv) usar o aplicativo offline, (v) recuperar seus registros, (vi) alternar dispositivos sem perda silenciosa e (vii) compreender claramente o estado de gravação e sincronização.

Invariantes globais:

- **Local-first:** o commit local concluído não depende da rede ou do Firebase. Falha de sincronização não deve impedir operações locais seguras.
- **Uma fonte canônica por entidade:** projeções de calendário, revisões e dashboard são derivadas, não réplicas autoritativas de estado.
- **Nenhuma perda silenciosa:** exclusão, overwrite, migração, conflito e restauração têm controles explícitos. Nenhuma operação não confirmada aparece como salva.
- **V1 preservada:** reconstrução independente, sem aplicar refatorações, scripts de migração ou alterações de esquema diretamente à produção V1 nesta iniciativa.
- **Governança humana:** aprovações são específicas por artefato/gate; não implicam aprovação automática de implementação, merge ou cutover.
- **Custo recorrente obrigatório R$ 0:** soluções que exigirem billing ou serviços pagos são inelegíveis sem nova decisão arquitetural humana.
- **Segurança por padrão:** não tratar dados importados nem dados de outros dispositivos como confiáveis; evitar XSS, vazamento de credenciais e associação incorreta de contas.
- **Identidade visual própria:** preservar a essência precisa, técnica, escura e informacional registrada em PRODUCT.md e DESIGN.md, sem reproduzir os problemas de UX da V1.
- **Anti-loop de correções:** registrar evidências, formular hipótese de causa raiz, limitar remediação, revalidar e interromper após falha material persistente.

## 2. Escopo, sistema legado e decomposição

### 2.1 V1 como referência, não como implementação reaproveitada cegamente

Referências existentes no repositório na data do desenho: PRODUCT.md, DESIGN.md, AGENTS.md, docs/architecture/app-overview.md, docs/api/sync-contract.md, docs/security/sync-threat-model.md, src/js/store.js, src/js/store/indexeddb.js, src/js/store/migrations.js, src/js/sync/, src/js/views/, testes Vitest/Playwright e os arquivos .impeccable/.

A V1 é uma SPA/PWA Vanilla JavaScript com IndexedDB primário, Firestore como canal remoto principal e Cloudflare KV/Google Drive como backup legado. Contém funcionalidades de editais, disciplinas, aulas/assuntos, Study Organizer, calendário, ciclo, cronômetro, Pomodoro, revisões, histórico, hábitos, dashboards, reta final, pontos fracos e inteligência de banca, entre outras. Os arquivos e contratos acima são evidências para auditoria, não fonte automática de requisitos V2.

**Atenção de compatibilidade documental:** AGENTS.md e outras diretrizes existentes exigem Vanilla JS para a V1. A V2 terá React + TypeScript + Vite por aprovação específica (D11). Os planos deverão separar fisicamente o desenvolvimento V2, registrar instruções específicas para a nova árvore e não alterar as convenções da V1 sem necessidade e nova autorização.

### 2.2 Inventário funcional obrigatório (F0)

A auditoria read-only deverá produzir matriz com ID de requisito, comportamento V1 reproduzível, arquivos/testes responsáveis, dados usados, risco, dependências, tipo de migração, destino e critério de aceitação. Destinos permitidos: PRESERVAR, REFORMULAR, UNIFICAR, ADICIONAR, DESCONTINUAR. Qualquer descontinuação exige aprovação explícita e retenção histórica apropriada.

Proibir escopo implícito: sugestões de agentes e descobertas durante implementação entram primeiro como propostas; alterações materiais de uma spec aprovada exigem análise de impacto e aceite humano.

### 2.3 Subsistemas e ordem de detalhamento

Esta é a **spec-mestra**. O escopo é grande demais para um único plano de implementação. Specs e planos subordinados deverão existir para F0 auditoria; F1 fundação mínima; F2 conteúdo/editais; F3 planejamento; F4 execução/sessões; F5 revisões/inteligência; F6 indicadores/experiência; F7 convergência e homologação; F8 cutover. As fatias F2–F6 podem ser repartidas onde a auditoria provar dependências menores. A ordenação definitiva é condicionada ao resultado de F0.

Migração, segurança, recuperação e sincronização são preocupações transversais desde F1: não são desenvolvidas apenas em F7. F7 consolida e homologa funcionalidades já construídas incrementalmente.

## 3. Estrutura lógica e fronteiras

### 3.1 Stack aprovada

- Interface: React + TypeScript + Vite, PWA responsiva.
- Domínio e casos de uso: TypeScript independente de React, Firestore, IndexedDB e APIs de browser específicas.
- Persistência canônica local: IndexedDB por adaptadores e transações tipadas.
- Sincronização remota opcional: Firebase Authentication e Cloud Firestore no plano Spark, encapsulados por interfaces; backup não é sync.
- Testes: tipagem estrita, unitários, contratos, integração e E2E com ferramentas adequadas; reutilizar conceitos úteis da suíte V1 sem presumir compatibilidade ou resultados de execução.

### 3.2 Dependências permitidas

    Presentation (React/PWA) -> Application commands/queries -> Domain contracts
                                      |                       ^
                                      v                       |
                         Ports (repository, clock, id, sync) |
                                      |                       |
                                      v                       |
                  Infrastructure adapters: IndexedDB / Firebase / backup

Domínio define invariantes e nunca importa React ou adaptadores. Casos de uso coordenam validação, transações e notificações. Infraestrutura concretiza portas. Interface chama comandos e lê consultas; não muta IndexedDB nem Firestore diretamente.

Domínios propostos: Conteúdo/Editais; Planejamento; Execução/Sessões; Revisões; Desempenho/Inteligência; Hábitos; Preferências e Configuração. Integração, Backup, Migração, Diagnóstico e Atualização são serviços de plataforma com contratos delimitados, não domínios que possam violar invariantes dos demais.

Cada domínio apresenta API pública versionável (entidades, comandos, consultas e eventos internos de notificação), invariantes, dados persistidos, dependências permitidas, testes de contrato e matriz de riscos. Importações circulares e imports de módulos privados entre domínios falham no gate automatizado.

### 3.3 Estado da UI e projeções

O IndexedDB é a fonte durável local; stores pequenos e estado React local atendem apenas à apresentação e aos estados transitórios. Cache de consultas e métricas são derivados regeneráveis. Proibido um state global gigantesco contendo múltiplas cópias editáveis das mesmas entidades. Atualizações reativas são emitidas somente após commit bem-sucedido, invalidadas por dependências conhecidas.

Fluxo de comando local: intenção da UI -> validação do caso de uso/domínio -> transação atômica para entidades + metadados/intent de sync -> sucesso local -> atualização das projeções e sinalização de sync pendente. Se a transação falha, não emitir confirmação de persistência.

## 4. Modelo canônico, relações e contratos temporais

### 4.1 Identidade e dados

Entidades possuem identidade estável opaca, versão de esquema, escopo de propriedade/proveniência e dados suficientes para reconciliar alterações. Relações entre edital, disciplina, assunto/aula, atividade planejada, sessão, revisão e métricas são tipadas. Não equiparar automaticamente entidades por nome normalizado. Referências órfãs ou ambíguas vão para diagnóstico/quarentena, não para correção destrutiva.

O histórico de execução é fonte para métricas de desempenho, progresso e revisão; projeções não são fontes de verdade. Correção de registro histórico é ação explicitamente rastreada. Eventos de auditoria seletivos são permitidos sem impor event sourcing integral a todos os domínios.

### 4.2 Tempo

Definir semanticamente:
- Data civil (AAAA-MM-DD) para dia de prova/revisão sem horário.
- Hora local + identificador de zona IANA para compromisso de calendário quando necessário.
- Instante absoluto para auditoria e ordenação técnica, sem depender apenas dele para inferir causalidade.
- Duração como intervalo mensurado validado; não como diferença simples entre datas de calendário.
- Prazo com granularidade/fuso explicitamente fornecidos pela fonte; nunca inventar horário de encerramento.
- Recorrência por regras de calendário no fuso de referência.

Blocos passados permanecem rastreáveis. Remarcação gera operação explícita com proveniência; não desloca silenciosamente atividade vencida. Testes incluem fusos divergentes, alteração do fuso do dispositivo, transições de horário de verão e relógio incorreto.

## 5. Execução e cronômetro

Sessão é entidade durável com transições de estado válidas: iniciar, pausar, retomar, concluir, cancelar e encaminhar à recuperação. Uma identidade de operação protege contra duplo clique ou repetição após falha. A medição durante execução privilegia relógio monotônico; checkpoints duráveis permitem recuperação, mas gaps após suspensão/crash não são automaticamente assumidos como tempo estudado.

Uma aba por vez tem autoridade de controle de determinada sessão no dispositivo, garantida por coordenação e validação no armazenamento, não exclusivamente por mensagens de broadcast. Outra aba pode observar, mas não executar transições conflitantes. Offline em dispositivos distintos pode produzir sessões sobrepostas legítimas ou conflitantes: preservar, sinalizar e resolver conforme D08. Duração consolidada e projeções são calculadas de intervalos válidos e não de callbacks de setInterval.

Critérios mínimos: pausar/retomar não duplica intervalo; conclusão repetida é idempotente; fechar/reabrir mantém checkpoints confirmados; suspensão não cria horas fictícias; duas abas não concluem a mesma sessão duas vezes; transição inválida falha de modo seguro.

## 6. Persistência, sincronização e conflitos

### 6.1 Armazenamento local

IndexedDB mantém registros canônicos, metadados de versão, índices de consulta e uma outbox durável. Gravação de dado e respectiva intenção remota são atômicas no limite do IndexedDB. Caches regeneráveis são segregados de registros essenciais; jamais apagar dados essenciais, histórico, operações pendentes ou tombstones necessários automaticamente para obter espaço.

Usar paginação/consultas indexadas e agregações derivadas para desempenho; orçamentos de capacidade e latência serão medidos na F0/F1 e estabelecidos nos contratos de cada módulo. Quota excedida significa falha de commit e feedback explícito, não sucesso presumido. Armazenamento persistente do navegador poderá ser solicitado quando disponível, mas não é garantia de proteção contra limpeza, perda de perfil ou dispositivo.

### 6.2 Sync automático após ativação explícita com Google — Emenda A-02 (substitui a regra operacional D06)

- Operações locais sempre podem ser confirmadas independentemente da nuvem quando o IndexedDB está íntegro.
- Modo local sem login permanece válido. Sync remoto depende de Google Sign-In no Firebase Auth, vinculação explícita do acervo local à conta e ativação consentida uma vez. **Após ativado, automático é o padrão enquanto habilitado**, sem obrigar o usuário a apertar sincronizar, com opção de pausa/desativação e diagnóstico manual.
- O coordenador automático é oportunista enquanto o aplicativo pode executar (boot, commit local, reconnect, retorno do foco/autenticação); não presume tarefas em segundo plano com PWA fechada. Opera com lotes, limites, backoff, budget Spark e fila local durável.
- Outbox mantém ID idempotente, entidade/escopo, revisão-base, mutação e estado de tentativa; retries não duplicam efeito remoto. O ACK remoto requer commit confirmado ou read-back que comprove aplicação; timeout não equivale a ACK. É vedada uma segunda fila de writes offline do SDK para as mesmas mutações.
- Envio remoto usa precondições transacionais/comparação de revisão para evitar overwrite cego. Confirmação remota é separada da confirmação local.
- Recebimento remoto valida esquema, identidade e invariantes antes da aplicação transacional local.
- Cloudflare KV e Google Drive da V1 não participarão como peers do sync canônico V2. Importação/exportação e backup remoto opcional são decisões separadas.
- Não pressupor execução contínua com a PWA fechada, nem usar timestamps isolados para detectar concorrência.

### 6.3 Política conservadora de conflitos

Alterações com IDs diferentes e sem violar invariantes podem convergir. Alterações no mesmo objeto somente mesclam automaticamente quando houver prova de independência/commutatividade baseada em versão-base e regras do domínio. Concorrência ambígua, exclusão contra modificação, relacionamento afetado e falha de causalidade ficam em estado CONFLICT; preservar ambas versões/evidências e exigir resolução explícita.

Tombstones precisam sobreviver ao tempo necessário para evitar ressurreição por dispositivo antigo; a compactação exige regra de convergência/epoch e recuperação para clientes excessivamente desatualizados. Nunca definir TTL arbitrário como única proteção. Resolução humana é ato auditado, idempotente e, se aplicável, gera nova mutação condicionada.

Falha remota/cota esgotada -> fila pendente + estado visível + tentativas limitadas; não apagar nem forçar merge. Estados exibidos na interface: salvo local, sincronização pendente, sincronizando, sincronizado, conflito, erro remoto e recuperação necessária. Diferenciar de forma verificável commit local, commit remoto e convergência observada; não prometer que outro dispositivo offline está atualizado.

### 6.4 Contrato de multi-dispositivo e critérios de não regressão (A-02)

**Referência técnica para a futura F1:** [Pré-contratos de sincronização multi-dispositivo](2026-10-28-v2-multidevice-sync-f1-contracts.md) — PROPOSTA PARA REVISÃO, não plano ou código aprovado.

- **Transporte remoto de alterações incrementais por entidade/agregado delimitado**, com IDs estáveis, versionamento, estratégia de leitura incremental e orçamento de leituras/escritas; não repetir um documento único com todo o estado da V1. O formato físico exato exige spec, benchmarks sintéticos e gate de custo.
- **Concorrência**: idempotência de operações, precondições remotas, coordenação cross-tab comprovada (Web Locks e fallback seguro) e resolução conservadora de conflitos. BroadcastChannel não substitui lock.
- **Backup/tombstones**: exclusões semanticamente duráveis; backup versionado, preview e reconciliação segura de snapshots antigos e dispositivos desatualizados.
- **Legado Reta Final (#107)**: ausência de campos v2 não equivale a plano inexistente; migração/comparação de intenção antes de qualquer escrita remota.
- **Riscos HIGH da F0**: `R-V1-LEGACY-REMOTE-PLAN`, `R-V1-FIRESTORE-DOCUMENT-1MIB`, `R-V1-MULTITAB-OUTBOX-RACE` e `R-V1-BACKUP-TOMBSTONE-LOSS` permanecem **UNVERIFIED**, mesmo com A-02 aprovada. Contratos/testes negativos na F1 e provas com Firebase Emulator/ambiente isolado na F7; não afirmar riscos mitigados antecipadamente.

## 7. Identidade, segurança e privacidade

Modo local não exige login. **Google Sign-In pelo Firebase Authentication** é o método de entrada remoto aprovado (A-02); o Firestore Spark é o backend único de sync remoto, e os documentos são isolados por UID autenticado em Firestore Security Rules. Vinculação de acervo local a conta exige procedimento explícito: preview das origens/contagens, riscos de mesclagem, conflitos e autorização humana. Trocar conta/logout não apaga acervo local silenciosamente e não mistura identidades.

Requisitos: CSP restritiva, DOM seguro/escape apropriado e proteção contra XSS, validação de todos os dados importados/remotos, isolamento de credenciais fora de exportações, acesso mínimo às integrações, controle de ações destrutivas, audibilidade e revisão de regras de autenticação/autorização no emulador e em homologação isolada. A chave pública de configuração Firebase não é segredo privado, mas sua exposição não substitui Rules corretas. Não prometer proteção criptográfica do IndexedDB por padrão, nem E2EE não aprovada.

Nenhuma credencial, exportação real ou dado identificável poderá ser utilizado nos testes ou incluído em logs e evidências do GitHub. Em dispositivos compartilhados, explicar limites de privacidade do perfil de navegador.

## 8. Backup, migração e recuperação

### 8.1 Backup separado de sincronização

Checkpoints locais versionados para operações críticas, backups externos portáteis (formato versionado + manifesto + integridade) e restauração supervisionada. Checkpoint local não protege contra perda total dos dados do navegador. Verificação de integridade de arquivo (por exemplo hash/checksum) detecta alteração acidental, mas não equivale a assinatura/autenticidade; requisitos de criptografia e proveniência de backups serão especificados conforme ameaça real sem assumir recurso pago.

Fluxo restauração: selecionar fonte -> analisar sem mutar -> validar esquema/manif./referências -> visualizar diferenças -> proteger estado atual -> aprovar operação específica -> aplicar atomicamente quando possível -> validar resultado -> registrar evidência. Se interrompida, retomada/rollback seguem estado durável e nunca deixam restauração parcial apresentada como sucesso. Exportação não deve conter tokens.

### 8.2 Migração V1 → V2

Processo determinístico, idempotente e somente leitura da origem durante ensaio; snapshot imutável verificável; transformadores por versão real encontrada; mapa de IDs/proveniência; comparação de contagens, vínculos e métricas; quarentena de objetos não convertíveis; relatório com reconciliação de perdas, transformações e exceções; gate humano. Migração não é mera cópia de IndexedDB V1 para V2. A matriz de suporte a esquemas legados será derivada do inventário F0 e não presumida pelo README.

Antes de corte definitivo, preservar backup V1 externo, verificar restauração e estabelecer ponto de corte. Retorno à V1 não é rollback binário universal: preservar exportação do histórico criado na V2, avaliar compatibilidade e solicitar decisão específica.

## 9. PWA, versões, atualização e disponibilidade

PWA instalável, responsiva e offline no desktop/tablet/celular. Service Worker pode preparar recursos, mas ativação e reload são coordenados para não interromper sessão/formulário crítico. Múltiplas abas devem negociar versão e impedir migrações paralelas que bloqueiem IndexedDB. Uma atualização de assets não implica permissão para migrar dados.

Versionar separadamente app, IndexedDB, backups, contratos públicos e protocolo de sync. Definir na spec subordinada política de compatibilidade entre versões, migração incremental, bloqueio de cliente antigo e recuperação; downgrade de código após upgrade de dados não é presumido seguro.

Operações críticas continuam disponíveis offline enquanto armazenamento local estiver íntegro. O navegador pode suspender scripts, remover dados do site ou negar permissão de persistência; apresentar limites e indicar a necessidade de backup independente. Quando recursos remotos indisponíveis, degradar somente capacidades remotas dependentes.

## 10. Experiência, identidade visual e Impeccable (Emenda A-01)

### 10.1 Identidade V1 preservada sem perpetuar UX fragmentada

Redesenhar arquitetura da informação e fluxos de Organizar -> Planejar -> Estudar -> Revisar -> Analisar -> Configurar. Não pressupor que equivalem a seis menus: a navegação definitiva depende de protótipos e inventário.

PRODUCT.md e DESIGN.md já registram identidade: densa com hierarquia e alto sinal, linguagem precisa, oito temas (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex, Plasma), accent steel-blue, Plus Jakarta Sans + DM Mono. Reutilizar como baseline explícito, mantendo personalidade, mas submetendo alinhamento, legibilidade, responsividade e contraste a testes. Proibir resultado final com aparência genérica de template SaaS.

Meta de acessibilidade: WCAG AA em todos os temas, navegação completa por teclado, foco e skip links visíveis, alvos de toque mínimos de 44 px para ponteiro coarse conforme baseline, suporte a prefers-reduced-motion e interfaces em pt-BR. Os testes de contraste devem avaliar texto, gráficos e estados, não só o tema padrão.

### 10.2 Integração obrigatória do Impeccable

Ferramenta: https://impeccable.style/ e https://github.com/pbakaus/impeccable. A skill Impeccable é ferramenta de processo de design, não dependência de runtime do aplicativo. Superpowers continua responsável pela modelagem/spec/plan/gates e Codex pela implementação futura autorizada.

Pré-requisito de cada fatia com interface: verificar disponibilidade, versão e compatibilidade da skill Impeccable no harness efetivamente utilizado, preferencialmente instalação escopada ao projeto, examinar scripts/hooks e configurações de telemetria, obter autorização para hooks de Codex quando exigida. A V1 já possui PRODUCT.md, DESIGN.md e .impeccable/: inspecionar e preservar a configuração existente antes de qualquer comando de inicialização/extract; não sobrescrever documentos canônicos sem revisão. Registrar versão/fonte no relatório de QA. Se instalação ou hook não forem tecnicamente viáveis sem custo ou sem autorização, BLOQUEAR gate da UI e escalar; não alegar auditoria executada.

Processo exigido:
1. **Descoberta/brief:** examinar PRODUCT.md, DESIGN.md, temas, capturas da V1 e jornadas; aplicar comandos de inicialização/extração/planejamento do Impeccable quando cabíveis, sem redefinir automaticamente identidade.
2. **Pré-design:** propostas de arquitetura da informação, wireframes e variações dentro dos tokens aprovados; revisão e aceite humano antes de implementação de mudanças visuais materiais.
3. **Implementação futura autorizada:** componentes do design system, responsividade, estados de erro/vazio/carregamento, teclado e touch; nenhuma lib introduzida só por preferência estética.
4. **QA visual:** executar critique, audit, adapt, harden e detector CLI de acordo com a interface; produzir registros de achados, capturas nos viewports relevantes e evidências de contraste/teclado.
5. **Polimento e homologação:** polish/distill conforme necessidade, conferir regressão visual e aprovar por gate humano.

Comandos de referência na documentação do fornecedor: /impeccable init, shape, critique, audit, extract, adapt, harden, polish, distill e npx impeccable detect --json. A sintaxe exata e disponibilidade no harness devem ser verificadas no momento da execução; comandos que editam fontes só após autorização do plano. O detector não prova sozinho qualidade de design ou WCAG. Achados têm gravidade e evidência; falsas detecções exigem justificativa, não reparos infinitos; não permitir suppression indiscriminado de regras.

Com Impeccable indisponível em uma fase estritamente backend e sem interface, o gate Impeccable não é aplicável, mas os gates de qualidade de backend permanecem. Para alterações de UI significativas, o gate é obrigatório e não substituível por autoavaliação superficial.

### 10.3 Homologação de interface

Comparar fluxo real e baseline V1, aprovar hierarquia visual, densidade legível, estados de sync/persistência inequívocos, desktop/tablet/mobile, interações de teclado/toque, contraste nos oito temas e ausência de regressões visuais materiais. Capturas e relatórios de Impeccable entram no PR da fatia.

## 11. Diagnóstico, riscos e tratamento de incidentes

Centro de Diagnóstico local com logs estruturados limitados, códigos de erro estáveis, correlação de comandos/sync/migração, checks de integridade não destrutivos e exportação explícita de relatórios saneados. Logs não incluem tokens, conteúdo integral de estudo nem dumps indiscriminados. Retenção proporcional e descarte seguro conforme capacidade do browser.

Políticas por criticidade: falha visual isolada pode não interromper estudo; falha de commit impede confirmação; divergência de dashboard exige recalcular origem/projeção; conflito de sync pausa somente operações afetadas; migração/restauração inválida bloqueia escrita insegura; corrupção grave preserva evidências e instrui recuperação.

Protocolo de remediação: (i) reproduzir ou delimitar problema; (ii) coletar evidência mínima; (iii) identificar hipótese falsificável de causa raiz; (iv) alteração pequena + teste de regressão; (v) revisão independente proporcional; (vi) orçamento explícito de tentativas definido no plano, com STOP e escalonamento ao humano quando FAIL MATERIAL persiste. Nunca converter NOT_RUN/INCONCLUSIVE em PASS.

## 12. Custo zero, ambientes e privacidade operacional

Desenvolvimento prioritariamente local com dados sintéticos e Firebase Emulator Suite. Homologação remota separada da produção, com Firebase Auth/Firestore em projeto isolado e hospedagem estática gratuita quando viável. Produção em serviços com plano gratuito Spark e hospedagem HTTPS gratuita. Nunca habilitar faturamento automaticamente.

Orçamentos de uso/cota, tamanho de documentos/lotes, operações estimadas por fluxo e frequências de sync são critérios a estimar e testar antes de habilitar sincronização automática. Cota excedida -> preservar outbox, backoff, diagnóstico e continuação local. Nenhum mecanismo pode gerar custo pago como fallback.

Configuração de desenvolvimento e homologação não reutiliza credenciais de produção. A integração externa do Impeccable deve ser avaliada quanto a licenciamento, telemetria, rede e hooks; desabilitar telemetria quando necessário à política de privacidade, sem prometer uso offline se não verificado.

## 13. Qualidade: matrizes de testes, evidências e aceites

### 13.1 Gates por risco

| Risco | Exemplos | Critérios mínimos antes de merge |
| --- | --- | --- |
| Baixo | Copy/ícone/CSS isolado | Lint, tipagem, testes focados; checagem visual se UI |
| Médio | Roteamento/formulários | Unitário, integração, E2E de fluxo, visual/Impeccable |
| Alto | Sessões/planejamento/revisões | TDD, domínio, contratos, regressão e revisão independente |
| Crítico | Auth, IndexedDB, migração, sync, backup, update | Adversarial, falha/recuperação, controle de concorrência, isolamento de ambientes, revisão independente, aceite humano |

Não declarar sucesso de testes sem executá-los. Documentar status PASS/FAIL/BLOCKED/INCONCLUSIVE/NOT_RUN, comandos e ambiente. Mudanças que violam fronteiras de domínio falham mesmo com testes funcionais verdes. Em caso de teste indisponível, registrar limite e bloquear os gates impactados, sem resultados fabricados.

### 13.2 Cenários obrigatórios a distribuir entre specs menores

- Offline inicial sem conta; reload; perda/reconexão; quota cheia.
- Gravação local interrompida; outbox crash/retry; entrega duplicada; replay.
- Dois dispositivos alteram mesma entidade; mesmo campo; entidades independentes; exclusão concorrente; tombstone/cliente antigo; desconexão prolongada.
- Uma sessão em duas abas; suspensão do notebook; relógio incorreto; cronômetro em segundo plano; conclusão repetida.
- Migração de esquema antigo, objetos inválidos, registros órfãos, reimportação, rollback de erro e comparação de métricas.
- Restauração simulada, backup adulterado/truncado, interrupção durante apply e preservação da versão anterior.
- Upgrade PWA durante estudo, multiaba com versões divergentes, esquema incompatível, falha após atualização.
- Firebase Rules com UID correto/incorreto, dados contaminados, XSS/CSRF conforme a superfície.
- Impeccable critique/audit/detector com evidências renderizadas, 8 temas, teclado, touch, contraste, tela pequena e loading/error/empty.

Metas numéricas de latência, tamanho, RPO/RTO e testes de capacidade devem derivar de baseline real, evidência e contratos de fatias. Não inventar cobertura/benchmarks aprovados antecipadamente.

## 14. Governança e fluxo de aprovação

Repositório único e monólito modular. Documentação em docs/; arquivos base já existentes na V1 permanecem como fonte histórica. Decisões arquiteturais em ADRs versionadas; mudança material exige ADR substitutiva, impacto em contratos, autorização humana e testes. **Verificações locais pelo Codex** examinam dependências circulares, importações proibidas, tipos/contratos, testes e requisitos de segurança/UX conforme risco; **nenhuma GitHub Action ou CI/CD nova por padrão**.

**Cadeia de gates:**
- G0: aprovar a arquitetura consolidada em seções (27 decisões + emenda A-01). **APROVADO pelo usuário em 2026-10-19.**
- G1: redigir e aprovar esta spec-mestra. **APROVADO expressamente pelo usuário em 2026-10-19.**
- G2: plano da auditoria F0 e método Subagent-driven **aprovados em 2026-10-19**; F0 executada e **aceita com ressalvas em 2026-10-28**, conforme relatório e issue #108. **Spec F1/ADRs em revisão, writing-plans e execução F1 não autorizados.**
- G3: autorização explícita por fase/tarefa para implementação; TDD e revisões independentes conforme criticidade.
- G4: homologação funcional, visual, integridade e recuperação por domínio e integrada.
- G5: autorização exclusiva para cutover V1 -> V2 após piloto, backups verificáveis, reconciliação de dados e contingência aprovada.

Aprovação de G1 **não** autoriza G3 nem G5. Pull request documental pode existir aberto enquanto aguarda revisão, mas não implica merge, releases ou alteração da V1.

## 15. Roadmap e resultados por fatia

| Fase | Entrega | Evidências/Gate |
| --- | --- | --- |
| F0 | Auditoria funcional, técnica, esquemas V1, dependências, riscos, baseline de desempenho e UX | Inventário 100% classificado, matriz V1/V2, proposta de contratos e aceite humano |
| F1 | Fundação V2: scaffolding futuro aprovado, fronteiras, testes, IndexedDB mínimo, PWA inicial, tokens essenciais, contratos de segurança e migração em sandbox | Caminho local completo e testes de persistência, QA técnico e design Impeccable |
| F2 | Editais/conteúdo canônicos, relacionamentos, importação segura | Testes de invariantes e migração dos respectivos dados |
| F3 | Planejamento, ciclo, calendário, reta final e regras temporais | Testes de data passada, fuso, replanejamento e UX |
| F4 | Sessões, cronômetro, questões, execução, histórico e hábitos relacionados | Máquina de estados, crash/multiaba/offline, QA de sessões |
| F5 | Revisões, pontos fracos, inteligência e priorização | Projeções e contratos sobre histórico confiável |
| F6 | Dashboards, desempenho, design system refinado, navegação e acessibilidade | Consistência de indicadores e gate Impeccable multiplataforma |
| F7 | Homologação integrada de sync, backup, restauração, migração, segurança, atualização e custos | Evidência real isolada, testes adversariais e piloto seguro |
| F8 | Procedimento e execução de cutover condicionado ao G5 | Backup final V1, corte, dados V2 preservados e decisão humana |

A fase F0 não executará migração nem mexerá em dados reais de produção. Os planos por fatia deverão definir entradas, saídas, critérios de aceitação, arquivos afetados, orçamento de testes e remediações, riscos e gates. Não autorizar execução de outras fases por inferência.

## 16. Critérios globais de aceite da V2

1. Matriz de funcionalidades V1 fechada: cada funcionalidade preservada/reformulada/unificada/adicionada/descontinuada com aprovação e destino dos dados.
2. Fluxos essenciais e identidade visual homologados em desktop, tablet e celular, com acessibilidade e evidências Impeccable para UI relevante.
3. Histórico V1 migrado com reconciliação satisfatória dos registros/relações/métricas, sem perda silenciosa e com exceções explícitas.
4. Sessões e planejamento corretos após offline, suspensão, dupla aba, recuperação e mudanças temporais.
5. Persistência local durável e estado de sync visível; conflitos concorrentes preservados; fila reexecutável sem duplicação.
6. Restauração de backup externo realmente ensaiada; procedimento de contingência disponível e testado.
7. Segurança/Auth/Rules/isolamento de ambientes verificados; nenhuma vulnerabilidade crítica conhecida sem mitigação.
8. Testes/revisões obrigatórios executados e com evidência, sem FAIL MATERIAL disfarçado de aprovação.
9. Produção compatível com custo recorrente obrigatório R$ 0, sem billing automático.
10. G5 explicitamente aprovado pelo usuário antes da substituição da V1.

## 17. Fora do escopo e decisões reservadas aos planos subordinados

Fora do escopo da V2 inicial: backend próprio, coexistência produtiva bidirecional V1/V2, multi-cloud como peers de sync, integração bidirecional com Plataforma Unificada, E2EE mandatória, telemetria remota obrigatória, app nativo, colaboração multiusuário em tempo real, event sourcing universal, publicação automática e serviços pagos.

Sem decisão antecipada sobre: router, bibliotecas de formulários, componentes e queries, formato físico completo IndexedDB, layout definitivo de telas, thresholds exatos de quotas/latência, formato final de backup, versões de pacotes e técnicas concretas de lock/coordenação. São escolhas de desenho de cada domínio/adaptador e serão submetidas aos gates pertinentes; nenhuma escolha pode contrariar os princípios aprovados. Sua ausência nesta spec-mestra não autoriza soluções ad hoc.

## 18. Matriz de rastreabilidade das decisões aprovadas

| Decisão | Escolha aprovada | Seções |
| --- | --- | --- |
| D01 C | V2 independente e integrável | 1, 2 |
| D02 B | Auditoria com redesign seletivo | 2, 16 |
| D03 A | Web/PWA | 3, 9 |
| D04 B | Local-first e remote sync canônico único | 6 |
| D05 B | Modelo canônico orientado a domínios | 3, 4 |
| D06 B | Sync híbrido; a regra operacional de padrão manual foi **substituída por A-02** após o opt-in Google | 6 |
| D07 A | Firebase Auth/Firestore via adaptadores | 3, 6, 7 |
| D08 B | Mesclagem conservadora e revisão humana | 6 |
| D09 B | Migração progressiva, verificável e reversível | 8 |
| D10 B | UX redesenhada com identidade preservada | 10 |
| D11 A | React + TypeScript + Vite | 3 |
| D12 B | Estado modular por responsabilidade | 3 |
| D13 A | Monólito modular com fronteiras | 3, 14 |
| D14 B | QA e gates proporcionais ao risco | 13 |
| D15 B | Fundação mínima + fatias verticais | 2, 15 |
| D16 B | Modernização com controle de escopo | 2 |
| D17 B | Local sem login + nuvem autenticada | 7 |
| D18 B | Recuperação em camadas, verificável | 8 |
| D19 B | Atualizações PWA controladas/versionadas | 9 |
| D20 B | Observabilidade local e diagnóstico | 11 |
| D21 B | Homologação progressiva + cutover humano | 14–16 |
| D22 B | Custo recorrente zero + ambientes isolados | 12 |
| D23 B | Sessões duráveis e FSM determinística | 5 |
| D24 B | Contratos públicos e adaptadores opcionais | 3, 17 |
| D25 B | Architecture as Code, ADR e gates | 14 |
| D26 B | Armazenamento por criticidade e degradação segura | 6 |
| D27 B | Modelo temporal canônico | 4 |
| A-01 | Uso obrigatório do Impeccable no design, auditoria de UI e homologação | 10, 13, 15 |
| A-02 | Multi-dispositivo com Google Sign-In + Firebase Auth/Firestore Spark; automático após ativação, outbox causal e proteção contra perda silenciosa | 6, 7, 12, 13, 17 |

## 19. Fontes e referências de escopo

**Documentação V1 (baseline, não prova de conformidade da V2):** PRODUCT.md; DESIGN.md; docs/architecture/app-overview.md; docs/api/sync-contract.md; docs/security/sync-threat-model.md; docs/README.md; AGENTS.md. A existência de testes e códigos na V1 não significa que foram executados ou aprovados nesta revisão.

**Ferramentas externas:** https://impeccable.style/ ; https://impeccable.style/docs/ ; https://github.com/pbakaus/impeccable . Referências oficiais consultadas em 2026-10-19. Não instalar ferramentas/hooks nem modificar fontes sem autorização de etapa.

**Nota de consistência:** este documento fixa responsabilidades, invariantes e gates já aprovados. Não substitui as futuras specs por domínio, inventário funcional completo da F0 nem os planos de implementação; isso evita transformar uma spec-mestra em um plano monolítico inexecutável.
