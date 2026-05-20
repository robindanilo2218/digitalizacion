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

# 1. Cambiar extensión de .jpg a .pag y añadir prefijo del libro
echo "Añadiendo prefijo y cambiando extensión de .jpg a .pag..."
export BASENAME
find "$DIR" -type f -name "*.jpg" -exec bash -c '
  for file do
    dir=$(dirname "$file")
    base=$(basename "$file" .jpg)
    if [[ "$base" == "${BASENAME}_"* ]]; then
      mv "$file" "$dir/${base}.pag"
    else
      mv "$file" "$dir/${BASENAME}_${base}.pag"
    fi
  done
' bash {} +

# 2. Comprimir la carpeta a un archivo .zip
echo "Comprimiendo a $BASENAME.zip..."
zip -r "$BASENAME.zip" "$DIR" > /dev/null

# 3. Renombrar el archivo .zip a .xlb
echo "Renombrando a $BASENAME.xlb..."
mv "$BASENAME.zip" "$BASENAME.xlb"

echo "Proceso completado con éxito. Archivo generado: $BASENAME.xlb"
