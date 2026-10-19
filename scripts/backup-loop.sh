#!/bin/sh
# Corre scripts/backup.sh una vez por día a la hora BACKUP_HOUR (0-23,
# hora del servidor; por defecto 3). Es el comando del servicio "backup".
set -eu
HOUR="${BACKUP_HOUR:-3}"

while true; do
  now=$(date +%s)
  target=$(date -d "$(date +%Y-%m-%d) $(printf '%02d' "$HOUR"):00" +%s)
  [ "$target" -le "$now" ] && target=$((target + 86400))
  echo "[backup] próxima copia: $(date -d "@$target" '+%Y-%m-%d %H:%M')"
  sleep $((target - now))
  /scripts/backup.sh || echo "[backup] ERROR: la copia falló, se reintenta mañana"
done
