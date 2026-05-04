@echo off
echo ===================================================
echo Estudo Organizado - MODO MOCK (Teste Local)
echo ===================================================
echo.

echo Escolha uma opcao:
echo [1] Preservar dados (manter alteracoes)
echo [2] Resetar dados mock (recriar dataset)
echo [3] Limpar dados (app vazio)
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERRO: Node.js nao encontrado. Instale o Node.js para usar o modo mock.
    pause
    exit /b 1
)

choice /c 123 /n /m "Digite sua escolha (1-3): "
if %ERRORLEVEL%==1 set MOCK_MODE=preserve
if %ERRORLEVEL%==2 set MOCK_MODE=reset
if %ERRORLEVEL%==3 set MOCK_MODE=clean

echo.
echo Modo: %MOCK_MODE%
echo URL: http://127.0.0.1:18765
echo NAO FECHE esta janela enquanto estiver usando o app!
echo ===================================================

start http://127.0.0.1:18765
node scripts/local-mock-server.mjs

echo.
echo Servidor encerrado.
pause
