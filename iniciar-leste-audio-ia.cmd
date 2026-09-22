@echo off
title Leste Audio IA
echo.
echo   Iniciando Leste Audio IA...
echo   O navegador abrira sozinho quando o app estiver pronto.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-leste-audio-ia.ps1" %*

if errorlevel 1 (
  echo.
  echo   Nao foi possivel iniciar o Leste Audio IA.
  echo   O motivo aparece na mensagem acima.
  echo.
  echo   Se o problema continuar, tente:
  echo     iniciar-leste-audio-ia.cmd -Reiniciar -Limpar
  echo.
  pause
)
