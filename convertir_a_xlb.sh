#!/bin/bash

# Comprobar si se proporcionó un directorio como argumento
if [ -z "$1" ]; then
  echo "Uso: $0 <directorio>"
  exit 1
fi

DIR="$1"

# Comprobar si el directorio existe
if [ ! -d "$DIR" ]; then
  echo "Error: El directorio '$DIR' no existe."
  exit 1
fi

# Eliminar la barra final si existe para evitar problemas de formato
DIR="${DIR%/}"
# Obtener solo el nombre del directorio (sin la ruta completa)
BASENAME="$(basename "$DIR")"

echo "Procesando directorio: $DIR"

# 1. Cambiar extensión de .jpg a .pag dentro de la carpeta
echo "Cambiando extensiones de .jpg a .pag..."
find "$DIR" -type f -name "*.jpg" -exec sh -c 'mv "$0" "${0%.jpg}.pag"' {} \;

# 2. Comprimir la carpeta a un archivo .zip
echo "Comprimiendo a $BASENAME.zip..."
zip -r "$BASENAME.zip" "$DIR" > /dev/null

# 3. Renombrar el archivo .zip a .xlb
echo "Renombrando a $BASENAME.xlb..."
mv "$BASENAME.zip" "$BASENAME.xlb"

echo "Proceso completado con éxito. Archivo generado: $BASENAME.xlb"
