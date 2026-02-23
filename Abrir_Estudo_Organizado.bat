@echo off
echo ===================================================
echo Iniciando Estudo Organizado via Servidor Local...
echo Por favor, NAO FECHE esta janela preta enquanto estuda!
echo Feche apenas quando terminar de usar o aplicativo.
echo ===================================================
cd "%~dp0src"
start http://localhost:8000
python -m http.server 8000
