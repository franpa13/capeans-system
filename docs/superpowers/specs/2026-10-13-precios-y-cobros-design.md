# Dentia — Precios y Cobros (parte contable, fase 1)

**Fecha:** 2026-10-13
**Estado:** Propuesto, pendiente de revisión del usuario

## Contexto y objetivo

Hoy "Tratamiento" es solo una etiqueta: una fila de `ClinicOption` (`category: "treatment"`) sin precio, y `Consultation.treatment` guarda ese texto libre. No existe ningún concepto de monto, cobro o saldo en la app.

El pedido original fue puntual — agregar un campo de precio al tratamiento que se crea en Configuración — pero al conversarlo surgió que la necesidad real es más amplia: saber cuánto cobrar por cada consulta, cuánto se cobró efectivamente, y cuánto le debe cada paciente al consultorio.

En la misma conversación surgió además una necesidad de **stock de insumos** (ej. gomillas de ortodoncia consumidas en un tratamiento). Se decidió explícitamente tratarlo como **un proyecto separado, posterior a este**: tiene su propio modelo de datos (insumos, cantidades) y no depende de que el cobro exista primero. Este spec cubre únicamente Precios y Cobros.

### Fuera de alcance (esta fase)

- Stock de insumos (próximo proyecto, spec aparte).
- Pagos múltiples/parciales en fechas distintas con método de pago (nivel "Completo" descartado a favor de "Intermedio" — ver Decisiones).
- Reportes de caja por período (ingresos de la semana/mes). La única superficie de reporte agregado en esta fase es la tarjeta "Por cobrar" en Inicio.
- Gastos generales del consultorio (alquiler, sueldos, etc.) — el pedido se acotó a ingresos de pacientes.
- Facturación fiscal / AFIP.

## Decisiones acordadas

| Decisión | Elección | Motivo |
|---|---|---|
| Alcance contable | Solo ingresos de pacientes, no gastos generales | Lo que efectivamente se pidió; gastos de insumos se resuelve en el proyecto de Stock aparte |
| Profundidad de cobro | "Intermedio": monto editable por consulta + estado Cobrado/Pendiente/Parcial + saldo por paciente | Cubre la necesidad real sin construir pagos múltiples/método de pago que no se van a usar todavía |
| Modelo de datos | Enfoque A: `amountCharged`/`amountPaid` directo en `Consultation`, estado derivado (no guardado) | Más simple y rápido de construir y usar; el salto a una tabla de Pagos (si algún día hace falta pagos en fechas distintas) es una migración aditiva separada, no una reescritura |
| Unidad monetaria | Pesos enteros (`Int`), sin centavos | Así cotizan los tratamientos en la práctica; evita la complejidad de centavos que no se usa |
| Precio de tratamiento | Campo opcional en `ClinicOption` (solo relevante para `category: "treatment"`) | Reutiliza el modelo existente en vez de crear una tabla `Treatment` nueva — no hay otro atributo que justifique separarla todavía |
| Monto y cobro por consulta | Opcionales | Una consulta de cortesía o un control rápido no tiene por qué tener monto; no se fuerza a tasar todo |
| Default de estado al crear | Pendiente (`amountPaid = 0`) | No asumir que se cobró si no se marcó explícitamente — más seguro para el registro contable |
| Tarjeta "Por cobrar" en Inicio | Sí, se agrega como 4ª tarjeta | Vistazo inmediato del saldo pendiente total sin tener que ir a Consultas a filtrar |
| Consultas existentes | Quedan con `amountCharged = null`, sin migración retroactiva | No hay con qué inferir el monto real de consultas pasadas; se completan a mano si hace falta |
| Descuento por obra social | Campo "Descuento %" manual en el formulario de consulta, calcula el monto pero no se guarda | El descuento real depende del tratamiento tanto como de la obra social (no es un % fijo por obra social) — cargarlo a mano en cada consulta es más simple que mantener una tabla de descuentos por obra social o una grilla de precios por combinación tratamiento×obra social |

## Modelo de datos (Prisma)

```prisma
model ClinicOption {
  // ...campos existentes...
  price    Int?   // precio de lista, pesos enteros. Solo se usa si category == "treatment".
}

model Consultation {
  // ...campos existentes...
  amountCharged Int?            // monto acordado para ESTA visita (precargado del precio de lista, editable)
  amountPaid    Int  @default(0) // cuánto se pagó hasta ahora
}
```

No hay un campo de estado guardado. El estado de cobro se deriva en el código de dominio (`src/features/clinic/lib/billing.ts`, nuevo):

```ts
type PaymentStatus = "SIN_MONTO" | "PENDIENTE" | "PARCIAL" | "COBRADO";

function paymentStatus(amountCharged: number | null, amountPaid: number): PaymentStatus {
  if (amountCharged == null) return "SIN_MONTO";
  if (amountPaid <= 0) return "PENDIENTE";
  if (amountPaid >= amountCharged) return "COBRADO";
  return "PARCIAL";
}
```

`SIN_MONTO` cubre tanto las consultas viejas (`amountCharged` nunca cargado) como las nuevas donde el dentista decidió no tasarla — en ambos casos no se muestra badge de cobro.

**Saldo de un paciente** = `Σ (amountCharged - amountPaid)` sobre sus consultas con `amountCharged` no nulo. Se calcula al pedir la ficha (en `src/features/clinic/data/patients.ts` o una función nueva en `billing.ts`), no se persiste — no puede desincronizarse porque no hay nada que sincronizar.

**Total "por cobrar" de la clínica** (para la tarjeta de Inicio) = la misma suma, sobre todas las consultas de la clínica en vez de un solo paciente.

## Cambios de UI

### Configuración → Tratamientos

`OptionListManager` (hoy compartido entre Obras sociales y Tratamientos) suma un campo "Precio" **solo cuando `category === "treatment"`**:
- Fila "Agregar nuevo...": input de nombre + input de precio (opcional) + botón Agregar.
- Cada fila existente: nombre, precio (si tiene, si no "Sin precio"), lápiz para editar (ahora edita nombre y precio), tacho para eliminar.
- Obras sociales no se toca — sigue mostrando solo nombre.

### Nueva consulta / Editar consulta

Al elegir un Tratamiento con precio de lista, aparecen tres campos encadenados:

1. **Precio de lista** — solo lectura, el del tratamiento elegido.
2. **Descuento %** — input manual, vacío/0 por default. No se guarda en la base; es una calculadora para llegar más rápido al monto final (la obra social cambia el descuento según el tratamiento, no hay un % fijo que valga para todo, así que no tiene sentido pre-configurarlo en otro lado).
3. **Monto a cobrar** (`amountCharged`) — se recalcula solo cada vez que cambia el Descuento % (`precio de lista × (1 - %)`), pero se puede escribir directamente a mano en cualquier momento para pisar ese cálculo (por ejemplo, un monto ya negociado que no sale de aplicar un % redondo).

Si el tratamiento no tiene precio de lista, los campos 1 y 2 no aparecen y se carga el monto final directo (o se deja vacío).

Al lado, un selector de 3 opciones (mismo patrón visual que el `ViewToggle` de Turnos):

- **Pendiente** (default al crear) → `amountPaid = 0`
- **Cobrado** → `amountPaid = amountCharged`, un click
- **Parcial** → aparece un input "Pagado hasta ahora", acotado entre 0 y el monto a cobrar

Si el dentista borra el monto a cobrar, la consulta queda sin datos de cobro (igual que hoy).

### Consultas/Tratamientos (tabla y cards mobile)

- Nueva badge de estado de cobro (Cobrado/Pendiente/Parcial, con color — mismo lenguaje visual que `STATUS_STYLES` de turnos) junto al badge de Tratamiento, mostrando el monto. Las consultas sin monto cargado no muestran badge de cobro (ni la cuentan como "pendiente").
- Nuevo filtro **"Estado de cobro"** en la barra de filtros existente (Tratamiento, Paciente, Pieza, Fecha): Todos / Cobrado / Pendiente / Parcial / Sin monto — el último sirve para encontrar las consultas que todavía no se tasaron y completarlas.

### Ficha de paciente

Si el saldo es mayor a 0, aparece **"Debe: $X"** cerca del nombre/teléfono. Si no debe nada (o no tiene consultas con monto), no se muestra nada — no agrega ruido a una ficha sin datos de cobro.

### Inicio

Se agrega una 4ª tarjeta junto a Pacientes/Consultas/Turnos: **"Por cobrar: $X"**, enlazando a Consultas con el filtro de Estado de cobro en Pendiente+Parcial ya aplicado.

## Formateo de moneda

Nuevo helper en `src/features/clinic/lib/format.ts`, mismo patrón que `formatDate` (locale `es-AR`):

```ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}
```

## Validaciones

Cliente (formularios) y server action, ambos:
- `price` (ClinicOption), `amountCharged`, `amountPaid`: no negativos.
- `amountPaid` no puede superar `amountCharged` — error en vez de guardar un "pagado de más" silencioso.

## Testing

- **Unit** (`billing.test.ts`): `paymentStatus()` — sin monto, pendiente, parcial, cobrado exacto, y el caso límite pagado == cobrado.
- **Unit**: cálculo de saldo de un paciente a partir de una lista de consultas (mezcla de con/sin monto, pagado/no pagado).
- **E2E** (extiende `settings.spec.ts`, `consultations.spec.ts`): cargar precio en Configuración → Tratamientos y verificar que persiste; crear una consulta con monto y verificar la badge correcta; marcarla Cobrado y verificar que el saldo del paciente baja a 0; filtrar Consultas por Pendiente.

## Datos de ejemplo (`prisma/seed.ts`)

- Precio a los tratamientos por defecto (Limpieza, Extracción, Endodoncia, etc.).
- Las consultas sembradas quedan con una mezcla realista de Cobrado/Pendiente/Parcial, para que el filtro, las badges, la ficha de paciente y la tarjeta de Inicio tengan datos desde el primer `npm run dev`.

## Migración

Las consultas existentes quedan con `amountCharged = null` (sin tocar). No se infiere un monto retroactivo — si hace falta, se completa a mano editando la consulta.
