"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaginationNavigation } from "@/components/pagination-navigation";
import { usePagination } from "@/hooks/use-pagination";
import type { OptionCategory } from "@/features/clinic/data/clinic-options";
import { formatCurrency } from "@/features/clinic/lib/format";
import {
  createClinicOptionAction,
  deleteClinicOptionAction,
  updateClinicOptionAction,
} from "@/features/settings/actions";
import { unwrap } from "@/lib/action-result";

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

/** What each list calls one of its items, for button and modal titles. */
const NOUNS: Record<OptionCategory, { create: string; edit: string; placeholder: string }> = {
  insurance: {
    create: "Nueva obra social",
    edit: "Editar obra social",
    placeholder: "Ej: OSDE",
  },
  treatment: {
    create: "Nuevo tratamiento",
    edit: "Editar tratamiento",
    placeholder: "Ej: Limpieza",
  },
};

export function OptionListManager({
  category,
  title,
  description,
  options,
  actions,
}: {
  category: OptionCategory;
  /** Extra buttons next to "Nuevo…" (e.g. Importar Excel). */
  actions?: React.ReactNode;
  title: string;
  description: string;
  options: Option[];
}) {
  const router = useRouter();
  const nouns = NOUNS[category];

  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<Option | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Option | null>(null);

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const { page, setPage, pageCount, pageItems } = usePagination(filtered, PAGE_SIZE);

  async function handleDelete() {
    if (!deleteTarget) return;
    await unwrap(deleteClinicOptionAction(deleteTarget.id));
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
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {options.length > 0 ? (
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
          <div className="flex flex-wrap gap-2">
            {actions}
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus />
              {nouns.create}
            </Button>
          </div>
        </div>

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
                <div className="flex items-center gap-3">
                  <span className="text-sm">{option.label}</span>
                  {category === "treatment" && (
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
                    onClick={() => {
                      setEditTarget(option);
                      setEditOpen(true);
                    }}
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
              </li>
            ))}
          </ul>
        )}
        <PaginationNavigation page={page} pageCount={pageCount} onPageChange={setPage} />
      </CardContent>

      <OptionFormDialog category={category} open={creating} onOpenChange={setCreating} />
      {/* The target stays set while the dialog animates closed, so its
          title and fields don't flash to the "Nuevo" version on the way out. */}
      {editTarget && (
        <OptionFormDialog
          key={editTarget.id}
          category={category}
          open={editOpen}
          onOpenChange={setEditOpen}
          option={editTarget}
        />
      )}

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

/** "Nuevo…" when `option` is undefined, "Editar…" otherwise. The form
 * lives inside DialogContent, so it unmounts on close and every opening
 * starts from fresh values. */
function OptionFormDialog({
  category,
  open,
  onOpenChange,
  option,
}: {
  category: OptionCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option?: Option;
}) {
  const nouns = NOUNS[category];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{option ? nouns.edit : nouns.create}</DialogTitle>
          <DialogDescription>
            {category === "treatment"
              ? "El precio se sugiere al cargar una consulta con este tratamiento."
              : "Va a aparecer como opción al cargar un paciente."}
          </DialogDescription>
        </DialogHeader>
        <OptionForm category={category} option={option} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function OptionForm({
  category,
  option,
  onDone,
}: {
  category: OptionCategory;
  option?: Option;
  onDone: () => void;
}) {
  const router = useRouter();
  const showPrice = category === "treatment";
  const [label, setLabel] = useState(option?.label ?? "");
  const [price, setPrice] = useState(option?.price != null ? String(option.price) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError("Completá el nombre");
    const parsedPrice = showPrice ? parsePrice(price) : { value: undefined };
    if ("error" in parsedPrice) return setError(parsedPrice.error);

    setSaving(true);
    setError(null);
    try {
      if (option) {
        await unwrap(updateClinicOptionAction(option.id, label, parsedPrice.value));
      } else {
        await unwrap(createClinicOptionAction(category, label, parsedPrice.value));
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
      <div className="space-y-1.5">
        <Label htmlFor="optionLabel">Nombre</Label>
        <Input
          id="optionLabel"
          autoFocus
          placeholder={NOUNS[category].placeholder}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      {showPrice && (
        <div className="space-y-1.5">
          <Label htmlFor="optionPrice">Precio (opcional)</Label>
          <Input
            id="optionPrice"
            type="number"
            min={0}
            placeholder="Ej: 15000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            <X />
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          <Save />
          Guardar
        </Button>
      </DialogFooter>
    </form>
  );
}
