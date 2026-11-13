# UX-H — como abrir a V2 localmente

HEAD de código disponível para a nova avaliação: 454f27e5. A decisão anterior REPROVOU a4b56e5e; este é um novo candidato de remediação.

As capturas e comparações atuais estão em uxh-remediation-454f27e5 do pacote de revisão. Os HEADs 0c31e6ef, a4b56e5e, 48548168, 862db594 e 2b63a179 citados em registros anteriores são históricos.

## Requisitos

- Windows com Node 26 e npm 12 já usados no projeto.
- Navegador limpo ou perfil temporário; não usar o perfil pessoal de estudos.
- Nenhum login Google/Firebase/Cloudflare. Nenhum dado real.

## Abrir

    cd C:/Projetos/estudo-organizado/_v2-candidate/apps/v2
    npm ci
    npm run build
    npx vite preview --host 127.0.0.1 --port 18433 --strictPort

Abra http://127.0.0.1:18433 no navegador escolhido.

O servidor é temporário e pode não continuar ativo depois da sessão do Codex. Se a URL não abrir, repita os comandos acima; não use outra máquina nem exponha a porta na rede.

## Perfil sintético

1. Use janela anônima ou um perfil de navegador dedicado à avaliação.
2. A aplicação cria o perfil local-default no primeiro acesso.
3. Cadastre conteúdo fictício (por exemplo, disciplina 'Avaliação UX', edital 'Teste UX 2026').
4. Ao terminar, exporte o backup F7 se quiser guardar evidência e feche/descarte o perfil temporário.
5. Não apague o perfil pessoal nem o IndexedDB de outros perfis.

## Parar

Pressione Ctrl+C no terminal do preview. O navegador pode ser fechado em seguida.

## Limites

- Sync remoto, ACK, Firebase, Cloudflare e staging não estão habilitados.
- O indicador 'salvo local' não significa convergência remota.
- Java não está disponível; o emulador Firebase não faz parte desta avaliação.
- NVDA/Narrator e hardware modesto não foram executados; marque NOT_RUN se não testar.

