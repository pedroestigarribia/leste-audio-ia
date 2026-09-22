@echo off
setlocal
title Instalar Leste Audio IA
cd /d "%~dp0"

echo.
echo   Leste Audio IA - instalacao em outro computador
echo   -----------------------------------------------

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js 20 ou superior nao foi encontrado.
  echo   Instale em https://nodejs.org e execute este arquivo novamente.
  pause
  exit /b 1
)

if not exist ".env.local" (
  copy /Y ".env.example" ".env.local" >nul
  echo   .env.local criado a partir de .env.example.
  echo   Preencha as chaves antes de usar as funcoes de IA.
)

if not exist "node_modules" (
  echo   Instalando dependencias. Isso pode levar alguns minutos...
  call npm install
  if errorlevel 1 (
    echo   Falha no npm install.
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\criar-atalho.ps1" >nul 2>nul
call "%~dp0iniciar-leste-audio-ia.cmd" -Reiniciar
