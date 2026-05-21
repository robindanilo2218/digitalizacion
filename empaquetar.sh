#!/bin/bash
echo "=== Herramienta de Empaquetado de Archivo ==="

# 1. Renombrar .jpg a .pag
echo "[1/4] Cambiando extensiones a .pag..."
for file in *.jpg; do
    if [ -f "$file" ]; then
        mv "$file" "${file%.jpg}.pag"
    fi
done

WORKDAY_DIR="$PWD"
WORKDAY_NAME="$(basename "$WORKDAY_DIR")"
BOOK_DIR="$(dirname "$WORKDAY_DIR")"
BOOK_NAME="$(basename "$BOOK_DIR")"
COLLECTION_DIR="$(dirname "$BOOK_DIR")"
COLLECTION_NAME="$(basename "$COLLECTION_DIR")"
ROOT_DIR="$(dirname "$COLLECTION_DIR")"

# 2. Comprimir Jornada a .jor
echo "[2/4] Comprimiendo Jornada $WORKDAY_NAME.jor..."
cd "$BOOK_DIR"
rm -f "$WORKDAY_NAME.jor"
zip -r "$WORKDAY_NAME.jor" "$WORKDAY_NAME" > /dev/null

# 3. Comprimir Libro a .xlb (solo incluye los .jor)
echo "[3/4] Comprimiendo Libro $BOOK_NAME.xlb..."
cd "$BOOK_DIR"
rm -f "../$BOOK_NAME.xlb"
zip "../$BOOK_NAME.xlb" *.jor > /dev/null

# 4. Comprimir Colección a .cll (solo incluye los .xlb)
echo "[4/4] Comprimiendo Coleccion $COLLECTION_NAME.cll..."
cd "$COLLECTION_DIR"
rm -f "$ROOT_DIR/$COLLECTION_NAME.cll"
zip "$ROOT_DIR/$COLLECTION_NAME.cll" *.xlb > /dev/null

echo "Proceso completado exitosamente. Paquete maestro generado en: $ROOT_DIR/$COLLECTION_NAME.cll"
