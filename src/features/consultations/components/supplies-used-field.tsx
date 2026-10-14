"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SupplyUsageInput } from "@/features/clinic/data/consultations";

export type SupplyOption = { id: string; name: string; unit: string };

/** A plain controlled list, not a react-hook-form field: there's no typed
 * string to validate the way amountCharged needs — just "pick one, pick a
 * quantity, add it to the list" repeated as many times as needed. The
 * parent dialog owns `value` and reads it directly at submit time. */
export function SuppliesUsedField({
  idPrefix = "",
  supplies,
  value,
  onChange,
  onPendingChange,
}: {
  idPrefix?: string;
  supplies: SupplyOption[];
  value: SupplyUsageInput[];
  onChange: (next: SupplyUsageInput[]) => void;
  /** True while an insumo or quantity is typed but not yet added to the
   * list — the parent blocks saving so a pick isn't silently dropped. */
  onPendingChange?: (pending: boolean) => void;
}) {
  const [selectedSupplyId, setSelectedSupplyIdState] = useState("");
  const [quantity, setQuantityState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = selectedSupplyId !== "" || quantity.trim() !== "";

  function setSelectedSupplyId(next: string) {
    setSelectedSupplyIdState(next);
    onPendingChange?.(next !== "" || quantity.trim() !== "");
  }

  function setQuantity(next: string) {
    setQuantityState(next);
    onPendingChange?.(selectedSupplyId !== "" || next.trim() !== "");
  }

  function supplyFor(id: string) {
    return supplies.find((s) => s.id === id);
  }

  function handleAdd() {
    if (!selectedSupplyId) {
      setError("Elegí un insumo");
      return;
    }
    const trimmedQuantity = quantity.trim();
    // Same fix as the treatment price field and the consultation amount
    // fields: reject "." / "," outright rather than let Number() parse
    // "10.000" down to 10.
    if (trimmedQuantity.includes(".") || trimmedQuantity.includes(",")) {
      setError("La cantidad tiene que ser un número entero, sin puntos ni comas");
      return;
    }
    const qty = Number(trimmedQuantity);
    if (!trimmedQuantity || !Number.isInteger(qty) || qty <= 0) {
      setError("Ingresá una cantidad entera mayor a 0");
      return;
    }
    setError(null);

    const existingIndex = value.findIndex((v) => v.supplyId === selectedSupplyId);
    if (existingIndex >= 0) {
      const next = [...value];
      next[existingIndex] = {
        ...next[existingIndex],
        quantityUsed: next[existingIndex].quantityUsed + qty,
      };
      onChange(next);
    } else {
      onChange([...value, { supplyId: selectedSupplyId, quantityUsed: qty }]);
    }
    setSelectedSupplyIdState("");
    setQuantityState("");
    onPendingChange?.(false);
  }

  function handleRemove(supplyId: string) {
    onChange(value.filter((v) => v.supplyId !== supplyId));
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}supplySelect`}>Insumos utilizados (opcional)</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={selectedSupplyId} onValueChange={setSelectedSupplyId}>
          <SelectTrigger className="w-full" id={`${idPrefix}supplySelect`}>
            <SelectValue placeholder="Elegí un insumo" />
          </SelectTrigger>
          <SelectContent>
            {supplies.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.unit})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={1}
          placeholder="Cantidad"
          aria-label="Cantidad usada"
          className="sm:w-28 sm:shrink-0"
          id={`${idPrefix}supplyQuantity`}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={handleAdd}>
          <Plus />
          Agregar insumo
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        pending && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Tocá «Agregar insumo» para sumarlo a la lista
          </p>
        )
      )}

      {value.length > 0 && (
        <ul className="divide-y rounded-md border">
          {value.map((entry) => {
            const supply = supplyFor(entry.supplyId);
            return (
              <li
                key={entry.supplyId}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  {supply?.name ?? "Insumo eliminado"} × {entry.quantityUsed}
                  {supply ? ` ${supply.unit}` : ""}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Quitar ${supply?.name ?? "insumo"}`}
                  onClick={() => handleRemove(entry.supplyId)}
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
