"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2, X, Check } from "lucide-react";

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
import type { OptionCategory } from "@/features/clinic/data/clinic-options";
import { formatCurrency } from "@/features/clinic/lib/format";
import {
  createClinicOptionAction,
  deleteClinicOptionAction,
  updateClinicOptionAction,
} from "@/features/settings/actions";

const PAGE_SIZE = 10;

const PRICE_ERROR = "El precio tiene que ser un número entero, sin puntos ni comas (ej: 15000)";

/** Whole-pesos prices only (see formatCurrency) — a bare numeric parse of
 * the typed string isn't enough: formatCurrency renders "12000" as
 * "$ 12.000", so a user re-typing what they just saw would type "12.000"
 * and Number("12.000") silently parses to 12, not twelve thousand. "." and
 * "," are therefore rejected outright rather than just non-integers. */
function parsePrice(raw: string): { value: number | undefined } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: undefined };
  if (trimmed.includes(".") || trimmed.includes(",")) return { error: PRICE_ERROR };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { error: PRICE_ERROR };
  return { value };
}

type Option = { id: string; label: string; price?: number | null };

export function OptionListManager({
  category,
  title,
  description,
  options,
}: {
  category: OptionCategory;
  title: string;
  description: string;
  options: Option[];
}) {
  const router = useRouter();
  const showPrice = category === "treatment";
  const [newLabel, setNewLabel] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Option | null>(null);

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const { page, setPage, pageCount, pageItems } = usePagination(filtered, PAGE_SIZE);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    const parsedPrice = showPrice ? parsePrice(newPrice) : { value: undefined };
    if ("error" in parsedPrice) {
      setAddError(parsedPrice.error);
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await createClinicOptionAction(category, newLabel, parsedPrice.value);
      setNewLabel("");
      setNewPrice("");
      router.refresh();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "No se pudo agregar");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(option: Option) {
    setEditingId(option.id);
    setEditLabel(option.label);
    setEditPrice(option.price != null ? String(option.price) : "");
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editLabel.trim()) return;
    const parsedPrice = showPrice ? parsePrice(editPrice) : { value: undefined };
    if ("error" in parsedPrice) {
      setEditError(parsedPrice.error);
      return;
    }
    setEditError(null);
    try {
      await updateClinicOptionAction(id, editLabel, parsedPrice.value);
      setEditingId(null);
      router.refresh();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "No se pudo guardar");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteClinicOptionAction(deleteTarget.id);
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Agregar nuevo..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          {showPrice && (
            <Input
              type="number"
              min={0}
              placeholder="Precio (opcional)"
              className="sm:w-40"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          )}
          <Button type="button" onClick={handleAdd} disabled={adding}>
            <Plus />
            Agregar
          </Button>
        </div>
        {addError && <p className="text-sm text-destructive">{addError}</p>}

        {options.length > 0 && (
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

        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay opciones cargadas.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguna opción coincide con &quot;{query}&quot;.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {pageItems.map((option) => (
              <li
                key={option.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                {editingId === option.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      autoFocus
                      aria-label="Editar valor"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveEdit(option.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    {showPrice && (
                      <Input
                        type="number"
                        min={0}
                        aria-label={`Precio de ${option.label}`}
                        className="w-32"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveEdit(option.id);
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Guardar"
                      onClick={() => handleSaveEdit(option.id)}
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
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{option.label}</span>
                      {showPrice && (
                        <span className="text-sm text-muted-foreground">
                          {option.price != null ? formatCurrency(option.price) : "Sin precio"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${option.label}`}
                        onClick={() => startEdit(option)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Eliminar ${option.label}`}
                        onClick={() => setDeleteTarget(option)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <PaginationNavigation page={page} pageCount={pageCount} onPageChange={setPage} />
        {editError && <p className="text-sm text-destructive">{editError}</p>}
      </CardContent>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              ¿Eliminar &quot;{deleteTarget?.label}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Los pacientes o consultas que ya usan este valor no se modifican,
              solo deja de estar disponible para elegir en registros nuevos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
