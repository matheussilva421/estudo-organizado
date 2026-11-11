# Plano de rollback local

1. Inventariar antes de agir: git status, HEAD, commits exclusivos, bundle e hashes. Confirmar que 99284994/24865ffb são ancestrais do HEAD e que o bundle escolhido abre com git bundle verify.
2. Para comparar o estado anterior sem tocar na v2: clonar o bundle verificado em diretório temporário, criar worktree isolado e usar perfil sintético. Não há rollback de IndexedDB por Git; dados de teste devem ser exportados ou descartados à parte.
3. Para reverter o código aprovado, criar commits de reversão na v2, do mais recente para o mais antigo, com git revert <hash> (sem reset --hard, clean -fd, force push ou reescrita). Resolver conflitos preservando main/V1 e refs de recovery.
4. Reverter somente apresentação quando o problema for visual: arquivos de styles, HomeView, AppNav, StudyScene, ReviewWorkspace e CommandCenter. Serviços, persistência, sync, backup e políticas não precisam ser alterados.
5. Se houver regressão funcional, reverter primeiro os commits de integração 22de061d e 3f79e682; depois os visuais 531426fa, 34f308ec, f96d45dc, 24865ffb.
6. Após qualquer reversão: npm run typecheck, lint, build, test:unit e E2E; repetir capturas e atualizar matriz, bundle e ZIP. Não apagar branches, refs recovery, stashes ou bundles.
7. Rollback de dados (IndexedDB, backup ou restauração) segue os fluxos F7 com prévia, confirmação e read-back; nunca usar o ZIP como backup de dados.
8. Se a reversão não for autorizada, manter o pacote atual e registrar a decisão humana. Nenhum push ou merge com main faz parte deste plano.
