@echo off
title Servidor Local - Archivo Histórico Digital
echo ==========================================================
echo    INICIANDO SERVIDOR LOCAL PARA ARCHIVO HISTORICO
echo ==========================================================
echo.
echo Este servidor local activa las caracteristicas PWA:
echo  1. Podra INSTALAR la aplicacion en su PC (icono en Escritorio).
echo  2. Funcionamiento fluido offline (sin internet).
echo  3. Eliminara los errores de consola de Service Worker y CORS.
echo.
echo ==========================================================
echo.

:: Detectar Node.js / npx
where npx >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Se detecto Node.js. Iniciando servidor con npx...
    start "" http://localhost:8080
    npx -y http-server -p 8080 -c-1
    goto end
)

:: Detectar Python
where python >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Se detecto Python. Iniciando servidor con Python...
    start "" http://localhost:8080
    python -m http.server 8080
    goto end
)

:: Fallback si no hay Node ni Python
echo [ADVERTENCIA] No se detecto Node.js ni Python instalado en el sistema.
echo Para poder INSTALAR la app y evitar avisos del navegador, le sugerimos:
echo  - Instalar Node.js (https://nodejs.org)
echo  - O instalar Python.
echo.
echo Abriendo el archivo en modo local de compatibilidad...
start "" index.html

:end
pause
