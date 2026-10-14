import { prisma } from "@/lib/prisma";
import type { Supply } from "@prisma/client";

export type NewSupplyInput = {
  name: string;
  unit: string;
  price?: number;
  quantity?: number;
  lowStockAt?: number;
};

export type UpdateSupplyInput = {
  name: string;
  unit: string;
  price?: number;
  lowStockAt?: number;
};

function assertValidPrice(price: number | undefined) {
  if (price == null) return;
  if (!Number.isInteger(price)) {
    throw new Error("El precio tiene que ser un número entero");
  }
  if (price < 0) {
    throw new Error("El precio no puede ser negativo");
  }
}

function assertValidInitialQuantity(quantity: number | undefined) {
  if (quantity == null) return;
  if (!Number.isInteger(quantity)) {
    throw new Error("El stock inicial tiene que ser un número entero");
  }
  if (quantity < 0) {
    throw new Error("El stock inicial no puede ser negativo");
  }
}

function assertValidLowStockAt(lowStockAt: number | undefined) {
  if (lowStockAt == null) return;
  if (!Number.isInteger(lowStockAt)) {
    throw new Error("El umbral tiene que ser un número entero");
  }
  if (lowStockAt < 0) {
    throw new Error("El umbral no puede ser negativo");
  }
}

function requireText(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(message);
  return trimmed;
}

export async function getSupplies(clinicId: string): Promise<Supply[]> {
  return prisma.supply.findMany({
    where: { clinicId },
    orderBy: { name: "asc" },
  });
}

export async function createSupply(clinicId: string, input: NewSupplyInput): Promise<Supply> {
  const name = requireText(input.name, "El nombre no puede estar vacío");
  const unit = requireText(input.unit, "La unidad no puede estar vacía");
  assertValidPrice(input.price);
  assertValidInitialQuantity(input.quantity);
  assertValidLowStockAt(input.lowStockAt);

  const existing = await prisma.supply.findFirst({ where: { clinicId, name } });
  if (existing) {
    throw new Error("Ya existe un insumo con ese nombre");
  }

  return prisma.supply.create({
    data: {
      clinicId,
      name,
      unit,
      price: input.price ?? null,
      quantity: input.quantity ?? 0,
      lowStockAt: input.lowStockAt ?? null,
    },
  });
}

/** Never touches quantity — stock only moves through restockSupply and
 * through consultations that use the insumo. */
export async function updateSupply(
  clinicId: string,
  id: string,
  input: UpdateSupplyInput,
): Promise<Supply> {
  const name = requireText(input.name, "El nombre no puede estar vacío");
  const unit = requireText(input.unit, "La unidad no puede estar vacía");
  assertValidPrice(input.price);
  assertValidLowStockAt(input.lowStockAt);

  const supply = await prisma.supply.findFirst({ where: { id, clinicId } });
  if (!supply) {
    throw new Error("Supply not found for this clinic");
  }

  const duplicate = await prisma.supply.findFirst({
    where: { clinicId, name, id: { not: id } },
  });
  if (duplicate) {
    throw new Error("Ya existe un insumo con ese nombre");
  }

  return prisma.supply.update({
    where: { id },
    data: {
      name,
      unit,
      price: input.price ?? null,
      lowStockAt: input.lowStockAt ?? null,
    },
  });
}

export async function restockSupply(
  clinicId: string,
  id: string,
  amount: number,
): Promise<Supply> {
  if (!Number.isInteger(amount)) {
    throw new Error("La cantidad a reponer tiene que ser un número entero");
  }
  if (amount <= 0) {
    throw new Error("La cantidad a reponer tiene que ser mayor a 0");
  }

  const result = await prisma.supply.updateMany({
    where: { id, clinicId },
    data: { quantity: { increment: amount } },
  });
  if (result.count === 0) {
    throw new Error("Supply not found for this clinic");
  }
  return (await prisma.supply.findFirst({ where: { id, clinicId } }))!;
}

export async function deleteSupply(clinicId: string, id: string): Promise<void> {
  const usageCount = await prisma.consultationSupply.count({
    where: { supplyId: id, supply: { clinicId } },
  });
  if (usageCount > 0) {
    throw new Error("No se puede eliminar un insumo que ya fue usado en alguna consulta");
  }
  await prisma.supply.deleteMany({ where: { id, clinicId } });
}
