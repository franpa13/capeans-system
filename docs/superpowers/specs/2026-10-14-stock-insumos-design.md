# Dentia — Stock de insumos

**Fecha:** 2026-10-14
**Estado:** Propuesto, pendiente de revisión del usuario

## Contexto y objetivo

Durante el diseño de Precios y Cobros surgió la necesidad de llevar el control de insumos consumibles del consultorio (ej. gomillas de ortodoncia, anestesia, material de obturación): cuánto cuesta cada uno, cuánto queda, y que el sistema avise antes de que se agoten. Se decidió entonces tratarlo como un proyecto separado, con su propio modelo de datos — este spec lo cubre.

La necesidad concreta: cada insumo tiene un precio y una unidad de medida propia (unidad, caja, ml, etc.). El dentista repone stock manualmente cuando compra más, y opcionalmente anota qué insumos usó (y cuánto) en cada consulta — eso resta del stock. El sistema avisa visualmente cuando un insumo se está quedando sin stock.

### Fuera de alcance (esta fase)

- Historial/ledger de movimientos de stock (solo se guarda la cantidad actual, no un registro de cada reposición o consumo por separado).
- Reglas automáticas de "este tratamiento siempre consume X insumo" — el consumo se anota a mano, consulta por consulta.
- Reportes de costo de insumos por período, o cruce con lo cobrado (Precios y Cobros) para calcular margen.
- Proveedores, números de factura, fechas de vencimiento.
- Multi-sucursal.
- Aviso de stock bajo en Inicio — queda solo visible en la pantalla de Stock.

## Decisiones acordadas

| Decisión | Elección | Motivo |
|---|---|---|
| Modelo de stock | Un campo `quantity` corriente por insumo, sin tabla de movimientos | Igual criterio que Precios y Cobros: lo más simple que cubre la necesidad real; se puede migrar a un ledger después si hace falta auditoría |
| Reposición | Manual — el dentista suma la cantidad comprada cuando quiere | No hay integración con proveedores ni compras automáticas |
| Consumo por consulta | Opcional, manual — se elige insumo + cantidad al registrar la consulta | El consumo depende del caso, no es una regla fija por tratamiento |
| Stock negativo | Permitido | Es en sí mismo el aviso de que hay que reponer ya — no bloquea el registro de la consulta |
| Umbral de stock bajo | Opcional, por insumo, en su propia unidad | Las unidades difieren entre insumos (unidades vs. cajas vs. ml), así que un umbral global no tendría sentido |
| Unidad de medida | Texto libre, se define al crear el insumo | Igual patrón que "Tratamiento"/"Obra social": sin una lista fija predefinida |
| Ubicación en la app | Ítem propio "Stock" en el sidebar, con su tabla completa — Configuración no se toca | Pedido explícito: separar insumos de la Configuración general |
| Eliminar un insumo ya usado | Bloqueado (no se puede eliminar si tiene consultas asociadas) | Igual razón que no se puede perder el precio histórico de una consulta: la fila hace falta para no romper el registro de esa consulta |

## Modelo de datos (Prisma)

```prisma
model Supply {
  id       String @id @default(cuid())
  clinicId String
  clinic   Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  name       String
  unit       String  // "unidad", "caja", "ml", etc. — texto libre
  price      Int?    // costo por unidad, pesos enteros (opcional)
  quantity   Int     @default(0)  // stock actual; puede quedar negativo
  lowStockAt Int?    // umbral de aviso, en la misma unidad (opcional)
  order      Int     @default(0)

  usages ConsultationSupply[]

  @@unique([clinicId, name])
  @@index([clinicId])
}

model ConsultationSupply {
  id             String       @id @default(cuid())
  consultationId String
  consultation   Consultation @relation(fields: [consultationId], references: [id], onDelete: Cascade)
  supplyId       String
  supply         Supply       @relation(fields: [supplyId], references: [id], onDelete: Restrict)

  quantityUsed Int   // cuánto se usó en ESTA consulta

  @@index([consultationId])
  @@index([supplyId])
}
```

`onDelete: Restrict` en `supply`: un insumo con consultas asociadas no se puede borrar (rompería la cantidad usada registrada en esas consultas) — hay que eliminar primero esas referencias o, en la práctica, simplemente no se puede eliminar un insumo que ya se usó alguna vez.

`onDelete: Cascade` en `consultation`: al eliminar una consulta, sus filas de `ConsultationSupply` se eliminan junto con ella — pero antes de eso hay que reponer el stock que esas filas habían restado (ver más abajo).

### Mecánica de stock (dónde vive la lógica)

Nueva función de dominio en `src/features/clinic/lib/stock.ts`:

```ts
export function isLowStock(quantity: number, lowStockAt: number | null): "out" | "low" | "ok" {
  if (quantity <= 0) return "out";
  if (lowStockAt != null && quantity <= lowStockAt) return "low";
  return "ok";
}
```

Toda mutación de `quantity` pasa por `src/features/clinic/data/supplies.ts`, dentro de una transacción Prisma (`prisma.$transaction`) junto con la escritura de `ConsultationSupply`, para que nunca queden desincronizados:

- **Crear consulta con insumos**: por cada `{supplyId, quantityUsed}`, resta `quantityUsed` del `Supply.quantity` correspondiente y crea la fila `ConsultationSupply`.
- **Editar consulta**: repone todo lo que las filas `ConsultationSupply` existentes de esa consulta habían restado, borra esas filas, y vuelve a aplicar la lista nueva de insumos (como si fuera una creación) — más simple y menos propenso a errores que calcular la diferencia fila por fila.
- **Eliminar consulta**: repone lo que sus filas `ConsultationSupply` habían restado antes de que el `onDelete: Cascade` las borre.
- **Reponer stock**: suma directamente a `Supply.quantity`, sin tocar `ConsultationSupply`.

## Cambios de UI

### Sidebar

Nuevo ítem "Stock" (ícono de caja) entre Turnos y Configuración, apuntando a `/dashboard/stock`.

### Página Stock (`/dashboard/stock`)

Mismo patrón visual que las listas de Configuración (fila "Agregar nuevo...", lista con lápiz/tacho), con estos campos:

- Fila "Agregar nuevo...": nombre, unidad, precio (opcional), stock inicial (opcional, vacío = 0).
- Cada fila: nombre — unidad — precio (o "Sin precio") — cantidad actual, con color según `isLowStock()` (rojo si "out", amarillo si "low", sin color si "ok") — botón "+" para reponer (abre un input chico para sumar una cantidad) — lápiz para editar nombre/unidad/precio/umbral — tacho para eliminar (deshabilitado con tooltip explicando el motivo si tiene consultas asociadas).
- Buscador y paginación, igual que Tratamientos/Obras sociales (ya se volvió necesario ahí con listas largas).

### Nueva consulta / Editar consulta

Nueva sección opcional "Insumos utilizados", entre "Estado del cobro" y "Observaciones":

- Selector de insumo + input de cantidad + botón "Agregar" → la fila elegida aparece en una lista chica dentro del formulario (insumo × cantidad), con una X para quitarla antes de guardar.
- Si no se agrega ninguno, la consulta se guarda exactamente igual que hoy — esta sección es enteramente opcional.
- Al editar una consulta existente, la lista arranca precargada con lo que esa consulta ya tenía registrado.

## Validaciones

Cliente y capa de datos, ambos:
- `name`: no vacío, único por consultorio y categoría (como ClinicOption).
- `unit`: no vacío.
- `price`: opcional, entero no negativo (mismo chequeo ya usado para el precio de tratamientos — rechaza "." y "," además de negativos).
- Stock inicial (al crear): entero ≥ 0.
- Cantidad a reponer: entero > 0.
- `lowStockAt`: opcional, entero ≥ 0.
- `quantityUsed` (insumo usado en una consulta): entero > 0. Sin tope contra el stock disponible — puede quedar negativo.
- Eliminar un insumo con `usages.length > 0`: rechazado con un mensaje explicando el motivo.

## Testing

- **Unit** (`stock.test.ts`): `isLowStock()` — out/low/ok en los límites exactos.
- **Unit** (`supplies.test.ts`): create/update/delete de Supply con las validaciones de arriba; eliminar un insumo sin uso funciona, eliminar uno con uso se rechaza.
- **Unit** (`consultations.test.ts`, extendido): crear una consulta con insumos resta el stock correcto; editar la lista de insumos de una consulta reconcilia el stock (restaura lo viejo, aplica lo nuevo); eliminar una consulta repone el stock que había restado; usar más de lo disponible deja el stock en negativo sin rechazar la operación.
- **E2E** (`stock.spec.ts`, nuevo): crear un insumo con unidad/precio/stock inicial y verificar que aparece; reponer y verificar que sube el número; verificar el color de stock bajo al llegar al umbral y a 0; intentar eliminar un insumo en uso y verificar que se bloquea.
- **E2E** (`consultations.spec.ts`, extendido): agregar insumos a una consulta nueva y verificar que el stock bajó en la pantalla de Stock; editar la consulta cambiando la cantidad usada y verificar que el stock se ajustó; eliminar la consulta y verificar que el stock se repuso.

## Migración

Sin datos previos que migrar — `Supply` y `ConsultationSupply` son tablas nuevas, no hay insumos existentes en la base.
