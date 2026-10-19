# Publicar Dentia y sus copias de seguridad

Esta guía cubre cómo poner Dentia en un servidor con Docker, cómo se hacen
las copias de seguridad y cómo recuperarlas si algo sale mal.

## 1. Qué se necesita

- Un servidor Linux (un VPS o una PC que quede siempre prendida) con
  **Docker** y **Docker Compose**.
- Un dominio (por ejemplo `consultorio.com.ar`) apuntando al servidor, para
  tener HTTPS.
- Una aplicación de **producción** en Clerk (dashboard.clerk.com), con sus
  claves. La de desarrollo no sirve para producción.

## 2. Publicar por primera vez

1. Copiá el proyecto al servidor (por ejemplo con `git clone`).
2. Creá el archivo de configuración:

   ```sh
   cp .env.production.example .env
   ```

   Completá cada valor de `.env`. Para la contraseña de la base generá una
   larga y aleatoria:

   ```sh
   openssl rand -base64 32
   ```

3. Levantá todo:

   ```sh
   docker compose -f docker-compose.prod.yml up -d --build
   ```

   Esto arranca la base de datos, aplica las migraciones (el servicio
   `migrate`), arranca la app en el puerto 3000 y activa las copias diarias.

4. Poné un proxy con HTTPS delante del puerto 3000. Lo más simple es
   [Caddy](https://caddyserver.com), que consigue el certificado solo. Un
   `Caddyfile` mínimo:

   ```
   consultorio.com.ar {
       reverse_proxy localhost:3000
   }
   ```

5. En Clerk, configurá el webhook de producción apuntando a
   `https://consultorio.com.ar/api/webhooks/clerk` y copiá su secreto a
   `CLERK_WEBHOOK_SECRET`.

> `docker-compose.yml` (sin `.prod`) es **solo para desarrollo**: tiene una
> contraseña fija y deja la base abierta en el puerto 5433. No lo uses en el
> servidor.

## 3. Actualizar a una versión nueva

```sh
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Las migraciones nuevas se aplican solas antes de que arranque la app.

## 4. Copias de seguridad

### Qué se copia y cuándo

El servicio `backup` hace una copia **todos los días a las 3:00** (se cambia
con `BACKUP_HOUR` en `.env`) y guarda en la carpeta `backups/` del servidor:

- `dentia-AAAA-MM-DD_HHMM.dump`: toda la base de datos (pacientes,
  consultas, pagos, turnos, stock, configuración).
- `archivos-AAAA-MM-DD_HHMM.tar.gz`: las radiografías, fotos y PDFs de los
  pacientes.

Se conservan los últimos **30 días** (`BACKUP_KEEP_DAYS`).

Para hacer una copia en el momento, por ejemplo antes de una actualización:

```sh
docker compose -f docker-compose.prod.yml exec backup /scripts/backup.sh
```

Para ver que las copias se están haciendo:

```sh
docker compose -f docker-compose.prod.yml logs backup
ls -lh backups/
```

### Sacar las copias del servidor (importante)

Una copia que vive en el mismo disco que la base se pierde junto con él si el
disco se rompe. Las copias tienen que estar **también en otro lugar**.

Lo más práctico es [rclone](https://rclone.org), que sincroniza una carpeta
con Google Drive, Dropbox, OneDrive o un bucket en la nube:

```sh
rclone config                                   # una sola vez: conectar la cuenta
rclone copy backups/ drive:dentia-backups       # copiar
```

Y agregalo al cron del servidor para que corra solo cada día, después de la
copia (por ejemplo a las 4:00):

```
0 4 * * * cd /ruta/a/capeans-system && rclone copy backups/ drive:dentia-backups
```

Las copias contienen historias clínicas: guardalas en una cuenta privada, con
contraseña fuerte y verificación en dos pasos.

### Restaurar una copia

> Restaurar **reemplaza** los datos actuales por los de la copia. Si dudás,
> hacé primero una copia del estado actual (ver arriba).

1. Elegí la copia, por ejemplo `backups/dentia-2026-10-19_0300.dump` y
   `backups/archivos-2026-10-19_0300.tar.gz`.
2. Frená la app para que nadie cargue datos mientras tanto:

   ```sh
   docker compose -f docker-compose.prod.yml stop app
   ```

3. Restaurá la base y los archivos:

   ```sh
   docker compose -f docker-compose.prod.yml exec backup /scripts/restore.sh --si \
     /backups/dentia-2026-10-19_0300.dump \
     /backups/archivos-2026-10-19_0300.tar.gz
   ```

   Si solo querés recuperar la base (sin tocar las radiografías), omití el
   segundo archivo.

4. Volvé a arrancar la app:

   ```sh
   docker compose -f docker-compose.prod.yml start app
   ```

### Probar que las copias sirven

Una copia que nunca se probó no es una copia. Una vez por mes, restaurá la
última en una base aparte y fijate que los números coincidan:

```sh
C="docker compose -f docker-compose.prod.yml exec -T backup"
$C createdb dentia_prueba
$C pg_restore --no-owner -d dentia_prueba /backups/<la última>.dump
$C psql -d dentia -tAc 'SELECT count(*) FROM "Patient"'
$C psql -d dentia_prueba -tAc 'SELECT count(*) FROM "Patient"'
$C dropdb dentia_prueba
```

Los dos números de pacientes tienen que ser iguales.
