# Próximo passo

O ponto de retomada é a revisão do ZIP local e, somente depois de autorização humana específica, o preflight de integração/piloto externo.

1. Abrir o ZIP desta rodada e conferir `SUMMARY.md`, matrizes, capturas e manifesto.
2. Se o proprietário quiser integração: revisar os commits locais e autorizar expressamente o push fast-forward de `v2`; hoje `REMOTE_PUSH_NOT_AUTHORIZED`.
3. Para homologação real: autorizar G-EXT e G-STAGING em um único consentimento, com projeto Firebase Spark isolado, Worker/KV Free e origem de avaliação separada.
4. Executar apenas então `GATES-EXTERNOS-READINESS.md`; serviços reais, dados pessoais, billing, DNS e V1 continuam proibidos até o gate específico.
5. Após URL real, fazer UX-H e registrar o aceite humano. Não iniciar F8/G5.

**Próximo comando local, sem efeito remoto:** abrir o diretório do pacote e verificar o ZIP com listagem e `Get-FileHash -Algorithm SHA256`.
