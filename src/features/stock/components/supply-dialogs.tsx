"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createSupplyAction,
  restockSupplyAction,
  updateSupplyAction,
} from "@/features/stock/actions";
import type { Supply } from "@prisma/client";

const QUANTITY_ERROR = "Tiene que ser un número entero, sin puntos ni comas (ej: 15000)";

/** Same reasoning as the treatment price field: a bare Number() parse
 * isn't enough because a displayed quantity/price can carry thousands
 * separators the user might re-type verbatim — Number("1.000") is 1. */
function parseWholeNumber(raw: string): { value: number | undefined } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: undefined };
  if (trimmed.includes(".") || trimmed.includes(",")) return { error: QUANTITY_ERROR };
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) return { error: QUANTITY_ERROR };
  return { value };
}

function Field({
  id,
  label,
  hint,
  ...inputProps
}: { id: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...inputProps} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DialogButtons({ saving, submitLabel }: { saving: boolean; submitLabel: string }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline">
          <X />
          Cancelar
        </Button>
      </DialogClose>
      <Button type="submit" disabled={saving}>
        <Save />
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}

/** Nuevo insumo when `supply` is undefined, Editar insumo otherwise. The
 * form lives inside DialogContent, so it unmounts on close and every
 * opening starts from fresh values. In Editar, "Stock actual" is a manual
 * count that replaces the stock — it's only sent if it was changed. */
export function SupplyFormDialog({
  open,
  onOpenChange,
  supply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supply?: Supply;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{supply ? "Editar insumo" : "Nuevo insumo"}</DialogTitle>
          <DialogDescription>
            {supply
              ? "Si contaste el insumo y no coincide, corregí el stock actual."
              : "Cargá el insumo con la cantidad que tenés hoy."}
          </DialogDescription>
        </DialogHeader>
        <SupplyForm supply={supply} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SupplyForm({ supply, onDone }: { supply?: Supply; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(supply?.name ?? "");
  const [unit, setUnit] = useState(supply?.unit ?? "");
  const [price, setPrice] = useState(supply?.price != null ? String(supply.price) : "");
  const originalQuantity = supply ? String(supply.quantity) : "";
  const [quantity, setQuantity] = useState(originalQuantity);
  const [lowStockAt, setLowStockAt] = useState(
    supply?.lowStockAt != null ? String(supply.lowStockAt) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) return setError("Completá el nombre y la unidad");
    const parsedPrice = parseWholeNumber(price);
    if ("error" in parsedPrice) return setError(parsedPrice.error);
    // Untouched in Editar → not sent, so an already-negative stock (more
    // used than was loaded) doesn't block saving the other fields.
    const quantityChanged = quantity.trim() !== originalQuantity;
    const parsedQuantity = quantityChanged ? parseWholeNumber(quantity) : { value: undefined };
    if ("error" in parsedQuantity) return setError(parsedQuantity.error);
    const parsedLowStockAt = parseWholeNumber(lowStockAt);
    if ("error" in parsedLowStockAt) return setError(parsedLowStockAt.error);

    setSaving(true);
    setError(null);
    try {
      const input = {
        name,
        unit,
        price: parsedPrice.value,
        lowStockAt: parsedLowStockAt.value,
      };
      if (supply) {
        await updateSupplyAction(supply.id, { ...input, quantity: parsedQuantity.value });
      } else {
        await createSupplyAction({ ...input, quantity: parsedQuantity.value });
      }
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        id="supplyName"
        label="Nombre"
        placeholder="Ej: Anestesia"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        id="supplyUnit"
        label="Unidad"
        placeholder="Ej: unidad, caja, ml"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
      />
      <Field
        id="supplyPrice"
        label="Precio (opcional)"
        type="number"
        min={0}
        placeholder="Ej: 15000"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <Field
        id="supplyQuantity"
        label={supply ? "Stock actual" : "Stock inicial"}
        hint={supply ? "Lo que hay hoy. Para sumar una compra, usá Reponer." : undefined}
        type="number"
        min={0}
        placeholder="Ej: 50"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <Field
        id="supplyLowStockAt"
        label="Avisar cuando queden (opcional)"
        hint="Cuando el stock llegue a este número, se marca como bajo."
        type="number"
        min={0}
        placeholder="Ej: 10"
        value={lowStockAt}
        onChange={(e) => setLowStockAt(e.target.value)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogButtons saving={saving} submitLabel="Guardar" />
    </form>
  );
}

export function RestockDialog({
  open,
  onOpenChange,
  supply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supply: Supply | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="size-4" />
            Reponer insumo
          </DialogTitle>
          {supply && (
            <DialogDescription>
              {supply.name}: hoy hay {supply.quantity} {supply.unit}.
            </DialogDescription>
          )}
        </DialogHeader>
        {supply && <RestockForm supply={supply} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RestockForm({ supply, onDone }: { supply: Supply; onDone: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseWholeNumber(amount);
    if ("error" in parsed) return setError(parsed.error);
    if (!parsed.value) return setError("Ingresá cuánto repusiste");

    setSaving(true);
    setError(null);
    try {
      await restockSupplyAction(supply.id, parsed.value);
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reponer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        id="restockAmount"
        label="Cantidad a reponer"
        hint={`En ${supply.unit}. Se suma al stock actual.`}
        type="number"
        min={1}
        placeholder="Ej: 20"
        autoFocus
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogButtons saving={saving} submitLabel="Reponer" />
    </form>
  );
}
