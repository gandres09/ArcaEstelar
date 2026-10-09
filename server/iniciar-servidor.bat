@echo off
title Servidor de Arca Estelar
cd /d "%~dp0\.."
echo Arrancando el servidor de Arca Estelar...
echo (Deja esta ventana abierta. Para apagarlo, cerrala o apreta Ctrl+C.)
:loop
node server\arca-server.mjs %*
echo El servidor se cerro. Lo vuelvo a abrir en 5 segundos...
timeout /t 5 /nobreak >nul
goto loop
