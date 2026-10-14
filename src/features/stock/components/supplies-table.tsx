"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaginationNavigation } from "@/components/pagination-navigation";
import { usePagination } from "@/hooks/use-pagination";
import { formatCurrency } from "@/features/clinic/lib/format";
import { isLowStock } from "@/features/clinic/lib/stock";
import {
  createSupplyAction,
  deleteSupplyAction,
  restockSupplyAction,
  updateSupplyAction,
} from "@/features/stock/actions";
import type { Supply } from "@prisma/client";

const PAGE_SIZE = 10;

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

const STOCK_STYLES: Record<"out" | "low", string> = {
  out: "text-destructive",
  low: "text-amber-600 dark:text-amber-400",
};

export function SuppliesTable({ supplies }: { supplies: Supply[] }) {
  const router = useRouter();

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editLowStockAt, setEditLowStockAt] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [restockAmount, setRestockAmount] = useState("");
  const [restockError, setRestockError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Supply | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? supplies.filter((s) => s.name.toLowerCase().includes(q)) : supplies;
  }, [supplies, query]);
  const { page, setPage, pageCount, pageItems } = usePagination(filtered, PAGE_SIZE);

  async function handleAdd() {
    if (!newName.trim() || !newUnit.trim()) {
      setAddError("Completá el nombre y la unidad");
      return;
    }
    const parsedPrice = parseWholeNumber(newPrice);
    if ("error" in parsedPrice) return setAddError(parsedPrice.error);
    const parsedQuantity = parseWholeNumber(newQuantity);
    if ("error" in parsedQuantity) return setAddError(parsedQuantity.error);

    setAdding(true);
    setAddError(null);
    try {
      await createSupplyAction({
        name: newName,
        unit: newUnit,
        price: parsedPrice.value,
        quantity: parsedQuantity.value,
      });
      setNewName("");
      setNewUnit("");
      setNewPrice("");
      setNewQuantity("");
      router.refresh();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "No se pudo agregar");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(supply: Supply) {
    setEditingId(supply.id);
    setRestockingId(null);
    setEditName(supply.name);
    setEditUnit(supply.unit);
    setEditPrice(supply.price != null ? String(supply.price) : "");
    setEditLowStockAt(supply.lowStockAt != null ? String(supply.lowStockAt) : "");
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim() || !editUnit.trim()) {
      setEditError("Completá el nombre y la unidad");
      return;
    }
    const parsedPrice = parseWholeNumber(editPrice);
    if ("error" in parsedPrice) return setEditError(parsedPrice.error);
    const parsedLowStockAt = parseWholeNumber(editLowStockAt);
    if ("error" in parsedLowStockAt) return setEditError(parsedLowStockAt.error);

    setEditError(null);
    try {
      await updateSupplyAction(id, {
        name: editName,
        unit: editUnit,
        price: parsedPrice.value,
        lowStockAt: parsedLowStockAt.value,
      });
      setEditingId(null);
      router.refresh();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "No se pudo guardar");
    }
  }

  async function handleRestock(id: string) {
    const parsed = parseWholeNumber(restockAmount);
    if ("error" in parsed) return setRestockError(parsed.error);
    if (!parsed.value) return setRestockError("Ingresá cuánto repusiste");

    setRestockError(null);
    try {
      await restockSupplyAction(id, parsed.value);
      setRestockingId(null);
      setRestockAmount("");
      router.refresh();
    } catch (error) {
      setRestockError(error instanceof Error ? error.message : "No se pudo reponer");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteSupplyAction(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteError(null);
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insumos</CardTitle>
        <CardDescription>
          Stock disponible de cada insumo. Se descuenta solo cuando lo marcás como usado en una
          consulta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Agregar nuevo..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder="Unidad (ej: unidad, caja, ml)"
            className="sm:w-56 sm:shrink-0"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
          />
          <Input
            type="number"
            min={0}
            placeholder="Precio (opcional)"
            className="sm:w-40 sm:shrink-0"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
          <Input
            type="number"
            min={0}
            placeholder="Stock inicial"
            className="sm:w-32 sm:shrink-0"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
          />
          <Button type="button" onClick={handleAdd} disabled={adding}>
            <Plus />
            Agregar
          </Button>
        </div>
        {addError && <p className="text-sm text-destructive">{addError}</p>}

        {supplies.length > 0 && (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {supplies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay insumos cargados.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ningún insumo coincide con &quot;{query}&quot;.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {pageItems.map((supply) => {
              const level = isLowStock(supply.quantity, supply.lowStockAt);
              return (
                <li key={supply.id} className="flex flex-col gap-2 px-3 py-2">
                  {editingId === supply.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        autoFocus
                        aria-label="Editar nombre"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                      <Input
                        aria-label={`Unidad de ${supply.name}`}
                        className="sm:w-40"
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                      />
                      <Input
                        type="number"
                        min={0}
                        aria-label={`Precio de ${supply.name}`}
                        placeholder="Precio"
                        className="sm:w-32"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                      />
                      <Input
                        type="number"
                        min={0}
                        aria-label={`Umbral de stock bajo de ${supply.name}`}
                        placeholder="Avisar con"
                        className="sm:w-28"
                        value={editLowStockAt}
                        onChange={(e) => setEditLowStockAt(e.target.value)}
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Guardar"
                          onClick={() => handleSaveEdit(supply.id)}
                        >
                          <Check />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Cancelar"
                          onClick={() => setEditingId(null)}
                        >
                          <X />
                        </Button>
                      </div>
                    </div>
                  ) : restockingId === supply.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span className="text-sm font-medium">{supply.name}</span>
                      <Input
                        autoFocus
                        type="number"
                        min={1}
                        aria-label={`Cantidad a reponer de ${supply.name}`}
                        placeholder={`Cantidad repuesta (${supply.unit})`}
                        className="sm:w-48"
                        value={restockAmount}
                        onChange={(e) => setRestockAmount(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRestock(supply.id);
                          }
                        }}
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Confirmar reposición"
                          onClick={() => handleRestock(supply.id)}
                        >
                          <Check />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Cancelar reposición"
                          onClick={() => {
                            setRestockingId(null);
                            setRestockError(null);
                          }}
                        >
                          <X />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium">{supply.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {supply.price != null ? formatCurrency(supply.price) : "Sin precio"}
                        </span>
                        <span
                          className={`text-sm font-medium ${level !== "ok" ? STOCK_STYLES[level] : ""}`}
                        >
                          {supply.quantity} {supply.unit}
                        </span>
                        {level !== "ok" && (
                          <span className={`text-xs ${STOCK_STYLES[level]}`}>
                            {level === "out" ? "Sin stock" : "Stock bajo"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Reponer ${supply.name}`}
                          onClick={() => {
                            setRestockingId(supply.id);
                            setEditingId(null);
                            setRestockAmount("");
                            setRestockError(null);
                          }}
                        >
                          <Plus />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Editar ${supply.name}`}
                          onClick={() => startEdit(supply)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Eliminar ${supply.name}`}
                          onClick={() => {
                            setDeleteTarget(supply);
                            setDeleteError(null);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  )}
                  {restockingId === supply.id && restockError && (
                    <p className="text-sm text-destructive">{restockError}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <PaginationNavigation page={page} pageCount={pageCount} onPageChange={setPage} />
        {editError && <p className="text-sm text-destructive">{editError}</p>}
      </CardContent>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              ¿Eliminar &quot;{deleteTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si este insumo ya se usó en alguna consulta, no se va
              a poder eliminar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog open so a "can't delete, it's in use"
                // error is shown instead of the dialog just vanishing.
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive! text-white! hover:bg-destructive/90!"
            >
              <Trash2 />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
