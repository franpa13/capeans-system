#!/bin/sh
# Restaura una copia de seguridad de Dentia. REEMPLAZA los datos actuales
# de la base PGDATABASE (y, si se pasa, los archivos de UPLOADS_DIR) por
# los de la copia.
#
#   restore.sh --si /backups/dentia-2026-10-19_0300.dump [/backups/archivos-2026-10-19_0300.tar.gz]
#
# El "--si" es obligatorio: confirma que entendés que se reemplazan los datos.
set -eu

if [ "${1:-}" != "--si" ] || [ -z "${2:-}" ]; then
  echo "Uso: restore.sh --si <copia.dump> [archivos.tar.gz]"
  echo "Reemplaza los datos actuales de la base '${PGDATABASE:-?}' por los de la copia."
  exit 1
fi
DUMP="$2"
FILES="${3:-}"
UPLOADS="${UPLOADS_DIR:-/data/uploads}"

[ -f "$DUMP" ] || { echo "No existe $DUMP"; exit 1; }

pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$PGDATABASE" "$DUMP"
echo "[restore] base de datos restaurada desde $DUMP"

if [ -n "$FILES" ]; then
  [ -f "$FILES" ] || { echo "No existe $FILES"; exit 1; }
  mkdir -p "$UPLOADS"
  find "$UPLOADS" -mindepth 1 -delete
  tar -xzf "$FILES" -C "$UPLOADS"
  echo "[restore] archivos restaurados desde $FILES"
fi
