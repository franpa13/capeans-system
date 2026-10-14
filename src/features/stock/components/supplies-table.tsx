"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";

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
import { deleteSupplyAction } from "@/features/stock/actions";
import { RestockDialog, SupplyFormDialog } from "@/features/stock/components/supply-dialogs";
import type { Supply } from "@prisma/client";

const PAGE_SIZE = 10;

const STOCK_STYLES: Record<"out" | "low", string> = {
  out: "text-destructive",
  low: "text-amber-600 dark:text-amber-400",
};

export function SuppliesTable({ supplies }: { supplies: Supply[] }) {
  const router = useRouter();

  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<Supply | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Supply | null>(null);
  const [restockOpen, setRestockOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supply | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? supplies.filter((s) => s.name.toLowerCase().includes(q)) : supplies;
  }, [supplies, query]);
  const { page, setPage, pageCount, pageItems } = usePagination(filtered, PAGE_SIZE);

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
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {supplies.length > 0 ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          ) : (
            <span />
          )}
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus />
            Nuevo insumo
          </Button>
        </div>

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
                <li
                  key={supply.id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
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
                        setRestockTarget(supply);
                        setRestockOpen(true);
                      }}
                    >
                      <Plus />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar ${supply.name}`}
                      onClick={() => {
                        setEditTarget(supply);
                        setEditOpen(true);
                      }}
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
                </li>
              );
            })}
          </ul>
        )}
        <PaginationNavigation page={page} pageCount={pageCount} onPageChange={setPage} />
      </CardContent>

      <SupplyFormDialog open={creating} onOpenChange={setCreating} />
      {/* The target stays set while the dialog animates closed, so its
          title and fields don't flash to "Nuevo insumo" on the way out. */}
      {editTarget && (
        <SupplyFormDialog
          key={editTarget.id}
          open={editOpen}
          onOpenChange={setEditOpen}
          supply={editTarget}
        />
      )}
      <RestockDialog open={restockOpen} onOpenChange={setRestockOpen} supply={restockTarget} />

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
