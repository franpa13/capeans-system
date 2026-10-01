# Dentia — Fase 1: Base multi-tenant (backend real, auth, Docker)

**Fecha:** 2026-10-01
**Estado:** Propuesto, pendiente de revisión del usuario

## Contexto y objetivo

El proyecto (hoy en el repositorio `capeans-system`) arrancó como un mockup de un solo consultorio dental (Dr. José Capeáns), con login mock, datos en memoria (sin backend) y una arquitectura por features ya sólida (Next.js 16 App Router, shadcn/ui, Pacientes y Consultas/Tratamientos funcionando).

El objetivo ahora es convertirlo en la base de **Dentia**, un **producto SaaS multi-tenant**: múltiples consultorios dentales (clientes) usando la misma aplicación, cada uno viendo solo sus propios datos, pagando una suscripción mensual. El consultorio del Dr. Capeáns pasa a ser el primer cliente piloto del producto, no su marca.

Esta fase 1 cubre **únicamente la base técnica**: backend real persistente, aislamiento multi-tenant, autenticación real, y despliegue en contenedores. Quedan explícitamente **fuera de alcance** (fases futuras):

- Facturación / cobro de suscripciones (Mercado Pago)
- Sitio público de marketing / alta de nuevos consultorios sin intervención manual
- Roles y permisos más allá de lo que Clerk Organizations da por defecto
- Módulo de Turnos (ya estaba marcado "Próximamente")

## Decisiones acordadas

| Decisión | Elección | Motivo |
|---|---|---|
| Nombre del producto | Dentia | Nombre genérico de marca; "Capeans" queda como nombre del consultorio piloto, no del producto |
| Mercado objetivo | Argentina | Define billing futuro (Mercado Pago, no en esta fase) |
| Base del proyecto | Evolucionar `capeans-system` existente | Ya tiene UI y arquitectura por features funcionando; no se reescribe |
| Escala inicial | 1-20 consultorios | Justifica simplicidad sobre infraestructura pesada |
| Multi-tenancy | Base de datos compartida, columna `clinicId` en cada tabla | Estándar de la industria a esta escala; barato y simple de operar |
| Autenticación | Clerk, usando **Organizations** = consultorios | Evita construir a mano invitaciones, roles, recuperación de contraseña — crítico con datos de salud |
| Base de datos | PostgreSQL | Estándar, soportado por Railway de forma nativa |
| ORM | Prisma | Mejor curva de aprendizaje y tooling de migraciones para este equipo |
| Contenedores | Docker (app + Postgres) tanto en desarrollo como en producción | Pedido explícito del usuario: dueño de su infra, portable |
| Hosting | Railway (deploy directo del Dockerfile + Postgres administrado) | Cero mantenimiento de servidor, a cambio de costo por uso |

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│  Railway                                         │
│  ┌─────────────────────┐   ┌──────────────────┐ │
│  │ Next.js app          │   │ Postgres          │ │
│  │ (desde Dockerfile)   │──▶│ (plugin Railway)  │ │
│  └──────────┬───────────┘   └──────────────────┘ │
└─────────────┼─────────────────────────────────────┘
              │
              ▼
        ┌───────────┐
        │   Clerk    │  (identidad, organizaciones, sesiones)
        └───────────┘
```

- **Clerk** es la fuente de verdad de identidad: usuarios, organizaciones (= consultorios) y membresías viven ahí. No se duplica una tabla de usuarios propia en esta fase.
- **Postgres** guarda únicamente los datos de dominio de la app (`Clinic`, `Patient`, `Consultation`, …), cada fila de dominio ligada a un `clinicId`.
- Un webhook de Clerk (`/api/webhooks/clerk`) crea la fila `Clinic` en Postgres la primera vez que se crea una Organization en Clerk, enlazándola por `clerkOrgId`.

## Modelo de datos (Prisma, boceto)

```prisma
model Clinic {
  id          String   @id @default(cuid())
  clerkOrgId  String   @unique
  name        String
  createdAt   DateTime @default(now())

  patients      Patient[]
  consultations Consultation[]
}

model Patient {
  id          String   @id @default(cuid())
  clinicId    String
  clinic      Clinic   @relation(fields: [clinicId], references: [id])

  name        String
  phone       String
  email       String?
  dni         String?
  birthDate   DateTime?
  address     String?
  insurance   String?
  allergies   String?

  consultations Consultation[]

  @@index([clinicId])
}

model Consultation {
  id          String   @id @default(cuid())
  clinicId    String
  clinic      Clinic   @relation(fields: [clinicId], references: [id])
  patientId   String
  patient     Patient  @relation(fields: [patientId], references: [id])

  date        DateTime
  treatment   String
  tooth       String?
  notes       String?

  @@index([clinicId])
  @@index([patientId])
}
```

`clinicId` se repite en `Consultation` (es derivable vía `patient.clinicId`) a propósito: permite filtrar consultas por consultorio sin un `join`, y es una capa extra de defensa contra fugas de datos entre tenants si alguna consulta llegara a construirse mal.

## Aplicación de multi-tenancy (cómo se evita que un consultorio vea datos de otro)

Toda lectura/escritura de `Patient` y `Consultation` pasa por una **capa de acceso a datos** (`src/features/clinic/data/*.ts`) cuyas funciones exigen `clinicId` como primer parámetro — nunca opcional, nunca tomado de un input del cliente:

```ts
export async function getPatients(clinicId: string) { ... }
export async function createPatient(clinicId: string, input: NewPatientInput) { ... }
```

El `clinicId` sale siempre de la sesión autenticada (`auth()` de Clerk → `orgId` → `Clinic` correspondiente), nunca de la URL ni del body de un request. Ningún Server Component ni Server Action llama a Prisma directamente para estas tablas; solo a través de esta capa. Esto concentra en un solo lugar la regla "nunca mezclar datos de dos consultorios", en vez de depender de que cada query individual la respete.

Postgres Row-Level Security queda como mejora futura si en algún momento se requiere una segunda capa de seguridad (por ejemplo por un requisito de compliance); no es necesaria a esta escala y agregaría complejidad operativa ahora.

## Autenticación

- Se elimina `src/features/auth/*` (login mock, cookie propia, `proxy.ts` actual) y se reemplaza por Clerk:
  - `<ClerkProvider>` en el layout raíz
  - Middleware de Clerk protegiendo `/dashboard/*`
  - Componentes prediseñados de Clerk para login/signup/gestión de cuenta (reemplazan la pantalla de login hecha a mano, se puede re-skinear con los colores de marca)
  - Cada usuario pertenece a una Organization de Clerk (= su consultorio); cambiar de organización activa no aplica en fase 1 (un usuario = un consultorio, por simplicidad)

## Migración de la UI existente

Hoy toda la data vive en `ClinicDataProvider` (contexto de React en memoria). Pasa a:

- **Server Components** para lecturas: las páginas (`/dashboard/pacientes`, `/dashboard/consultas`, etc.) llaman directo a la capa de datos del lado del servidor.
- **Server Actions** para escrituras: siguiendo el mismo patrón que ya usan `loginAction`/`logoutAction` hoy, los formularios (`NewPatientDialog`, `NewConsultationDialog`, `EditPatientDialog`, borrado) pasan a usar Server Actions que llaman a la capa de datos.
- Los componentes visuales (tablas, diálogos, filtros) **se mantienen básicamente iguales** — el cambio es de dónde sacan y a dónde mandan los datos, no de cómo se ven. Se conserva todo el trabajo de diseño ya hecho.
- `INITIAL_PATIENTS` / `INITIAL_CONSULTATIONS` (mock data actual) pasan a ser un script de seed de Prisma para desarrollo local, asociado a un "consultorio demo". En producción no hay migración de datos: el consultorio del Dr. Capeáns se da de alta como cualquier cliente nuevo, creando su cuenta y su Organization en Clerk a través del flujo normal de signup.
- Rebranding visual: las referencias a "Capeans" como marca del producto (encabezado del sidebar, título de la pestaña del navegador, pantalla de login) pasan a decir "Dentia". El nombre del consultorio del Dr. Capeáns (y de cada consultorio cliente) se sigue mostrando donde corresponda — por ejemplo, en el encabezado del dashboard una vez logueado — pero ya no es el nombre de la aplicación.

## Docker

- `Dockerfile`: build multi-stage de Next.js usando `output: "standalone"` (hay que agregar esa opción a `next.config.ts`).
- `docker-compose.yml`: para desarrollo local — levanta `app` + `postgres` juntos, con `.env.local` para `DATABASE_URL` y las claves de Clerk.
- `.dockerignore`: excluye `node_modules`, `.next`, etc. del build context.
- En Railway: un servicio desplegado desde el `Dockerfile`, más el plugin de Postgres administrado (Railway inyecta `DATABASE_URL` automáticamente al servicio de la app).

## Testing

- Se mantiene la práctica ya usada en este proyecto de verificar cada feature con Playwright contra el flujo real (login, alta/edición/borrado de paciente, consultas), ahora contra datos reales en vez de mock.
- Agregar un caso explícito de aislamiento multi-tenant: dos consultorios de prueba, verificar que ninguno ve datos del otro.

## Fuera de alcance (fases futuras)

- Facturación/suscripciones con Mercado Pago
- Landing page pública y alta de consultorios sin intervención manual
- Permisos más allá de los roles por defecto de Clerk Organizations
- Módulo de Turnos
