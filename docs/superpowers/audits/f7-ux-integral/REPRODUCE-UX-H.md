# Reprodução e guia UX-H

## Abrir localmente

```powershell
cd C:\Projetos\estudo-organizado\_v2-candidate\apps\v2
npm run build
npx vite preview --host 127.0.0.1 --port 18610 --strictPort
```

Use perfil temporário; não use dados pessoais.

## Sequência sugerida

1. `/#/home` — primeiro uso, depois com dados; alterne tema; teste layout manual em “Explorar painel e widgets”.
2. `/#/content` — crie/abra edital, disciplina, assunto e aula; abra o inspetor; teste 320 px.
3. `/#/planning` — cenários A/B, prévia, cancelamento, calendário e Reta Final.
4. `/#/sessions` — sessão, pausa, retomada, histórico e hábitos.
5. `/#/reviews` — fila, política, execução, prioridade → “Ver evidência”.
6. `/#/analytics` — KPIs, gráfico/tabela, filtros e exportação.
7. `/#/attention` — alertas e origem; `Ctrl+Shift+K` para Command Center.
8. `/#/settings` — temas, backup preview e manutenção.

## Decisão UX-H

Marque apenas uma: ACEITO, ACEITO COM RESSALVAS, REPROVO ou ADIAR. Registre observações em um único local. Testes locais não aprovam UX-H, F7 externa ou substituição da V1.
