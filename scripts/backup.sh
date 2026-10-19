#!/bin/sh
# Copia de seguridad de Dentia: la base de datos (pg_dump) y los archivos
# de los pacientes (radiografías, fotos, PDFs). Pensado para correr en el
# servicio "backup" de docker-compose.prod.yml, pero sirve a mano también.
#
# Variables: PGHOST, PGUSER, PGPASSWORD, PGDATABASE (las de Postgres),
#   BACKUP_DIR (dónde guardar, por defecto /backups),
#   UPLOADS_DIR (carpeta de archivos, por defecto /data/uploads),
#   BACKUP_KEEP_DAYS (cuántos días conservar, por defecto 30).
set -eu

DEST="${BACKUP_DIR:-/backups}"
UPLOADS="${UPLOADS_DIR:-/data/uploads}"
KEEP="${BACKUP_KEEP_DAYS:-30}"
STAMP="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$DEST"

# Formato "custom" de pg_dump: comprimido y restaurable con pg_restore. Se
# escribe a un .tmp y se renombra, así una copia cortada a la mitad nunca
# queda con el nombre de una copia buena.
pg_dump --format=custom --file="$DEST/dentia-$STAMP.dump.tmp"
mv "$DEST/dentia-$STAMP.dump.tmp" "$DEST/dentia-$STAMP.dump"

if [ -d "$UPLOADS" ]; then
  tar -czf "$DEST/archivos-$STAMP.tar.gz.tmp" -C "$UPLOADS" .
  mv "$DEST/archivos-$STAMP.tar.gz.tmp" "$DEST/archivos-$STAMP.tar.gz"
fi

# Borra las copias más viejas que KEEP días.
find "$DEST" -name 'dentia-*.dump' -mtime +"$KEEP" -delete
find "$DEST" -name 'archivos-*.tar.gz' -mtime +"$KEEP" -delete

echo "[backup] $(date '+%Y-%m-%d %H:%M') copia lista: dentia-$STAMP.dump"
