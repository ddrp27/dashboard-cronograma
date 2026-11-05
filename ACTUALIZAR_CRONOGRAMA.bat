@echo off
chcp 65001 > nul
title Actualizador del Cronograma AG LAB
echo ========================================================
echo   ACTUALIZADOR AUTOMATICO - CRONOGRAMA AGLAB
echo ========================================================
echo.

if "%~1"=="" (
    echo [i] Buscando el archivo Excel mas reciente en la carpeta...
    node "%~dp0actualizar_cronograma.cjs"
) else (
    echo [i] Procesando archivo seleccionado: "%~1"
    node "%~dp0actualizar_cronograma.cjs" "%~1"
)

echo.
echo ========================================================
echo   Proceso completado. Presiona cualquier tecla para salir.
echo ========================================================
pause > nul
