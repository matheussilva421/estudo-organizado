# CLAUDE.md

Orientações para qualquer IA que trabalhe neste repositório.

## Versionamento (GitHub)

- **Sempre atualize o GitHub** ao final de uma tarefa: faça commit e push das alterações.
- **Se não conseguir atualizar o GitHub**, forneça ao usuário os comandos de terminal exatos para que ele mesmo faça o push (ex.: `git add`, `git commit`, `git push`).

## Handoff

- **Ao final de cada sessão, sempre crie um handoff** para outra IA entender tudo o que foi feito e continuar o trabalho caso não tenha sido concluído. O handoff deve descrever: o que foi feito, o estado atual, o que falta e os próximos passos.

## Testes — TDD rigoroso

Siga TDD (Test-Driven Development) de forma rigorosa:

1. **Antes de implementar** qualquer funcionalidade, escreva primeiro os testes automatizados que descrevam o comportamento esperado.
2. **Rode os testes e confirme que falham** (red).
3. **Implemente apenas o mínimo necessário** para fazê-los passar (green).
4. **Refatore** o código mantendo todos os testes verdes (refactor).
5. **Não altere funcionalidades sem atualizar ou criar testes** correspondentes.

### Proporcionalidade dos testes

- Use testes **proporcionais ao risco**.
- Para alterações pequenas: priorize **testes específicos** e **validação manual**.
- Para áreas sensíveis (**sync, salvamento e fluxos críticos**): mantenha uma **suíte de testes ampla**.

### Saída de testes

- **Resuma os logs de teste** em vez de despejar saídas gigantes na conversa.

<!-- AI-HANDOFF:START -->
Leia AGENTS.md e .ai/CURRENT.md antes de continuar.
Valide .ai/RECOVERY.md e o estado real do Git.
<!-- AI-HANDOFF:END -->
