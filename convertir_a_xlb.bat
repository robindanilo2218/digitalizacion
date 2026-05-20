@echo off
setlocal enabledelayedexpansion

:: Comprobar si se proporcionó un directorio
if "%~1"=="" (
    echo Uso: %~nx0 ^<directorio^>
    exit /b 1
)

set "DIR=%~1"

:: Comprobar si el directorio existe
if not exist "%DIR%\" (
    echo Error: El directorio '%DIR%' no existe.
    exit /b 1
)

:: Eliminar comillas y posible barra invertida final
set "DIR=%DIR:"=%"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

:: Obtener el nombre base del directorio
for %%I in ("%DIR%") do set "BASENAME=%%~nxI"

echo Procesando directorio: %DIR%

:: 1. Cambiar extension de .jpg a .pag y anadiendo prefijo del libro
echo Cambiando extensiones de .jpg a .pag y anadiendo prefijo %BASENAME%_...
for /R "%DIR%" %%F in (*.jpg) do (
    set "filename=%%~nF"
    echo !filename! | findstr /b /c:"%BASENAME%_" >nul
    if errorlevel 1 (
        ren "%%F" "%BASENAME%_!filename!.pag"
    ) else (
        ren "%%F" "!filename!.pag"
    )
)

:: 2. Comprimir a .zip usando PowerShell integrado en Windows
echo Comprimiendo a %BASENAME%.zip...
powershell -nologo -noprofile -command "Compress-Archive -Path '%DIR%' -DestinationPath '%BASENAME%.zip' -Force"

:: 3. Renombrar .zip a .xlb
echo Renombrando a %BASENAME%.xlb...
if exist "%BASENAME%.xlb" del "%BASENAME%.xlb"
ren "%BASENAME%.zip" "%BASENAME%.xlb"

echo Proceso completado con exito. Archivo generado: %BASENAME%.xlb
