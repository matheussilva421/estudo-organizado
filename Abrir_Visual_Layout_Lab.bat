@echo off
echo ===================================================
echo Estudo Organizado - VISUAL LAYOUT LAB
echo ===================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERRO: Node.js nao encontrado. Instale o Node.js para usar o lab.
    pause
    exit /b 1
)

set MOCK_MODE=preserve

echo URL: http://127.0.0.1:18765/lab/visual-layout-lab.html
echo Dica: se o lab parecer desatualizado, use Ctrl+Shift+R no navegador.
echo NAO FECHE esta janela enquanto estiver usando o lab!
echo ===================================================

start http://127.0.0.1:18765/lab/visual-layout-lab.html
node scripts/local-mock-server.mjs

echo.
echo Servidor encerrado.
pause
