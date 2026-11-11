# F7-UX Premium — fechamento local

**Código validado:** 9457b7ca (v2 local, sem push)
**Estado:** LOCAL_PREMIUM_CLOSURE_READY_FOR_UX_H / REMOTE_PUSH_NOT_AUTHORIZED / UX_HUMAN_PENDING
**Escopo:** recomposição visual estrutural pedida no adendo prioritário, correções P1/P2 das revisões e cobertura VA/DV.

## Delta desta rodada

- Home recomposta: cabeçalho compacto com busca em pílula, ações de Atenção/Configurações, rail lateral emoldurado com ícones e citação, hero dominante com ilustração SVG temática, passos em faixa própria, bento com cartões de larguras diferentes, ícones por widget, minigráfico real de foco e seção Recursos principais.
- Prioridade acadêmica: avisos operacionais deixaram de ocupar o hero e de se repetir nos cartões; diagnósticos ficam na Central de Atenção e na faixa de sincronização.
- Densidade revisada: rail 214 px, hero reduzido, paddings de 14–24 px, tipografia menor, cartões mais baixos; comparações lado a lado em comparacoes/.
- Correções de integridade: transferência de autoridade só ocorre após pause confirmado; resolução remota de sessão valida o snapshot e registra auditoria; checkpoints de 15 s não recarregam a projeção global.
- Correções de UX: biblioteca abre a árvore por ID e sincroniza a troca de edital; filtros mobile com contagem viva, foco e zoom; sugestão de ordem com aceite explícito, foco e anúncio; alvos de toque da Home em 24 px.

## Verificação

- typecheck, lint (0 avisos) e build: PASS.
- Unidade: 880 testes em 129 arquivos: PASS.
- E2E Chromium: 226 PASS, 5 SKIP, 0 FAIL em 231.
- Capturas: 24 da Home (4 temas × vazio desktop/tablet/320/390 + dados desktop/390), 8 comparações lado a lado, 36 imagens de módulos.
- Firebase Emulator, NVDA/Narrator e hardware físico: NOT_RUN.

## Limites preservados

Ilustração é vetorial e não replica a fotocomposição dos mockups; cartões têm menos gráficos internos que a referência; Knowledge/Review/Insights mantêm inspetor e painéis existentes com nova linguagem, sem reengenharia profunda. UX-H, G-EXT, G-STAGING, push e F8 seguem não autorizados.
