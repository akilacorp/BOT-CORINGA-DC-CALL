@echo off
title Bot de Voz Discord
color 0A

echo ===================================
echo     BOT CORINGA HAHAHA CONECTADO
echo ===================================
echo.

echo Verificando dependencias...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo NODE.JS nao encontrado! Por favor, instale o Node.js.
    pause
    exit /b
)

echo Verificando pacotes instalados...
if not exist node_modules (
    echo Instalando pacotes necessarios...
    call npm install
)

echo.
echo Limpando arquivos temporarios...
if exist temp\* del /q temp\*

echo.
echo Iniciando o Bot Discord...
echo.
echo Use o comando /call em um canal do Discord para conectar o bot ao seu canal de voz.
echo Use o comando /stop para desconectar o bot.
echo.
echo Pressione CTRL+C para encerrar o bot.
echo.

node index.js

pause
