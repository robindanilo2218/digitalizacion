@echo off
setlocal enabledelayedexpansion

echo === Herramienta de Empaquetado de Archivo ===

:: 1. Renombrar .jpg a .pag
echo [1/4] Cambiando extensiones a .pag...
for %%F in (*.jpg) do (
    ren "%%F" "%%~nF.pag"
)

:: Obtener rutas
set "WORKDAY_DIR=%CD%"
for %%I in ("%WORKDAY_DIR%") do set "WORKDAY_NAME=%%~nxI"

cd ..
set "BOOK_DIR=%CD%"
for %%I in ("%BOOK_DIR%") do set "BOOK_NAME=%%~nxI"

cd ..
set "COLLECTION_DIR=%CD%"
for %%I in ("%COLLECTION_DIR%") do set "COLLECTION_NAME=%%~nxI"

cd ..
set "ROOT_DIR=%CD%"

:: 2. Comprimir Jornada a .jor
echo [2/4] Comprimiendo Jornada %WORKDAY_NAME%.jor...
cd "%BOOK_DIR%"
if exist "%WORKDAY_NAME%.jor" del "%WORKDAY_NAME%.jor"
powershell -nologo -noprofile -command "Compress-Archive -Path '%WORKDAY_NAME%' -DestinationPath '%WORKDAY_NAME%.zip' -Force"
ren "%WORKDAY_NAME%.zip" "%WORKDAY_NAME%.jor"

:: 3. Comprimir Libro a .xlb (solo archivos .jor)
echo [3/4] Comprimiendo Libro %BOOK_NAME%.xlb...
cd "%BOOK_DIR%"
if exist "..\%BOOK_NAME%.xlb" del "..\%BOOK_NAME%.xlb"
powershell -nologo -noprofile -command "Compress-Archive -Path '*.jor' -DestinationPath '..\%BOOK_NAME%.zip' -Force"
ren "..\%BOOK_NAME%.zip" "%BOOK_NAME%.xlb"

:: 4. Comprimir Coleccion a .cll (solo archivos .xlb)
echo [4/4] Comprimiendo Coleccion %COLLECTION_NAME%.cll...
cd "%COLLECTION_DIR%"
if exist "..\%COLLECTION_NAME%.cll" del "..\%COLLECTION_NAME%.cll"
powershell -nologo -noprofile -command "Compress-Archive -Path '*.xlb' -DestinationPath '..\%COLLECTION_NAME%.zip' -Force"
ren "..\%COLLECTION_NAME%.zip" "%COLLECTION_NAME%.cll"

echo Proceso completado exitosamente. Paquete maestro generado en: %ROOT_DIR%\%COLLECTION_NAME%.cll
pause
