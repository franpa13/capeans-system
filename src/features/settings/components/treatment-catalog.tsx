"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Save, Search, Stethoscope, Trash2, X } from "lucide-react";
import type { ClinicOption } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  createTreatmentAction,
  deleteClinicOptionAction,
  updateTreatmentAction,
} from "@/features/settings/actions";
import { unwrap } from "@/lib/action-result";

const PAGE_SIZE = 15;
const NO_SPECIALTY = "__none__";
const NUMBER_ERROR = "Tiene que ser un número entero, sin puntos ni comas (ej: 15000)";

type StatusFilter = "all" | "active" | "inactive";

/** "15000" → 15000, "" → undefined, "15.000" → error (Number would read 15). */
function parseWhole(raw: string): { value: number | undefined } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: undefined };
  if (!/^\d+$/.test(trimmed)) return { error: NUMBER_ERROR };
  return { value: Number(trimmed) };
}

/** Configuración › Tratamientos: the catalog with a count per especialidad
 * (tap one to see only those), Todos / Activos / Inactivos, a search, and a
 * table with código, precio de lista / en efectivo, duración and estado. */
export function TreatmentCatalog({
  treatments,
  specialties,
  actions,
}: {
  treatments: ClinicOption[];
  specialties: string[];
  /** Extra buttons next to "Nuevo tratamiento" (Importar Excel). */
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<ClinicOption | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<ClinicOption | null>(null);

  const countBySpecialty = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of treatments) {
      const key = t.specialty ?? NO_SPECIALTY;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [treatments]);
  const activeCount = treatments.filter((t) => t.active).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return treatments.filter(
      (t) =>
        (!q || t.label.toLowerCase().includes(q) || (t.code ?? "").toLowerCase().includes(q)) &&
        (specialty === null || (t.specialty ?? NO_SPECIALTY) === specialty) &&
        (status === "all" || (status === "active" ? t.active : !t.active)),
    );
  }, [treatments, query, specialty, status]);
  const { page, setPage, pageCount, pageItems } = usePagination(filtered, PAGE_SIZE);

  const chips = [
    ...specialties.map((s) => ({ key: s, label: s })),
    ...(countBySpecialty.has(NO_SPECIALTY) ? [{ key: NO_SPECIALTY, label: "Sin especialidad" }] : []),
  ];

  async function handleDelete() {
    if (!deleting) return;
    await unwrap(deleteClinicOptionAction(deleting.id));
    setDeleting(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de tratamientos</CardTitle>
        <CardDescription>
          {treatments.length} {treatments.length === 1 ? "tratamiento" : "tratamientos"}. Los
          activos se ofrecen al cargar consultas y turnos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {actions}
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Nuevo tratamiento
            </Button>
          </div>
        </div>

        {/* One button per especialidad, with how many tratamientos it has. */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Especialidades">
          {chips.map((chip) => {
            const selected = specialty === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setSpecialty(selected ? null : chip.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-card hover:bg-accent"
                }`}
              >
                {chip.label}
                <span
                  className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {countBySpecialty.get(chip.key) ?? 0}
                </span>
              </button>
            );
          })}
          {specialty !== null && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setSpecialty(null)}>
              <X />
              Limpiar
            </Button>
          )}
        </div>

        <div className="flex w-fit gap-1 rounded-md border p-1" role="group" aria-label="Estado">
          {(
            [
              ["all", "Todos", treatments.length],
              ["active", "Activos", activeCount],
              ["inactive", "Inactivos", treatments.length - activeCount],
            ] as const
          ).map(([value, label, count]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={status === value ? "secondary" : "ghost"}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label} <span className="text-muted-foreground tabular-nums">{count}</span>
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border p-8">
            <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
              <Stethoscope className="size-5" />
              {treatments.length === 0
                ? "Todavía no hay tratamientos cargados."
                : "Ningún tratamiento coincide con esos filtros."}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Tratamiento</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead className="text-right">Precio de lista</TableHead>
                  <TableHead className="text-right">En efectivo</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-px">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((t) => (
                  <TableRow key={t.id} className={t.active ? "" : "text-muted-foreground"}>
                    <TableCell className="tabular-nums">{t.code ?? "—"}</TableCell>
                    <TableCell className="font-medium">{t.label}</TableCell>
                    <TableCell>
                      {t.specialty ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {t.specialty}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.price != null ? formatCurrency(t.price) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.cashPrice != null ? formatCurrency(t.cashPrice) : "—"}
                    </TableCell>
                    <TableCell>{t.durationMinutes ? `${t.durationMinutes} min` : "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.active
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.active ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Editar ${t.label}`}
                          onClick={() => {
                            setEditing(t);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Eliminar ${t.label}`}
                          onClick={() => setDeleting(t)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <PaginationNavigation page={page} pageCount={pageCount} onPageChange={setPage} />
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tratamiento" : "Nuevo tratamiento"}</DialogTitle>
            <DialogDescription>
              El precio se sugiere al cargar una consulta; la duración, al dar un turno.
            </DialogDescription>
          </DialogHeader>
          <TreatmentForm
            key={editing?.id ?? "new"}
            treatment={editing ?? undefined}
            specialties={specialties}
            onDone={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              ¿Eliminar &quot;{deleting?.label}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Las consultas que ya lo usan no se modifican. Si solo se dejó de hacer, mejor
              marcalo como inactivo: deja de ofrecerse pero queda en el catálogo.
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

function TreatmentForm({
  treatment,
  specialties,
  onDone,
}: {
  treatment?: ClinicOption;
  specialties: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(treatment?.label ?? "");
  const [code, setCode] = useState(treatment?.code ?? "");
  const [specialty, setSpecialty] = useState(treatment?.specialty ?? NO_SPECIALTY);
  const [price, setPrice] = useState(treatment?.price != null ? String(treatment.price) : "");
  const [cashPrice, setCashPrice] = useState(
    treatment?.cashPrice != null ? String(treatment.cashPrice) : "",
  );
  const [duration, setDuration] = useState(
    treatment?.durationMinutes != null ? String(treatment.durationMinutes) : "",
  );
  const [active, setActive] = useState(treatment?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError("Completá el nombre");
    const parsedPrice = parseWhole(price);
    const parsedCash = parseWhole(cashPrice);
    const parsedDuration = parseWhole(duration);
    for (const parsed of [parsedPrice, parsedCash, parsedDuration]) {
      if ("error" in parsed) return setError(parsed.error);
    }
    setSaving(true);
    setError(null);
    try {
      const input = {
        label,
        code,
        specialty: specialty === NO_SPECIALTY ? undefined : specialty,
        price: (parsedPrice as { value: number | undefined }).value,
        cashPrice: (parsedCash as { value: number | undefined }).value,
        durationMinutes: (parsedDuration as { value: number | undefined }).value,
        active,
      };
      if (treatment) await unwrap(updateTreatmentAction(treatment.id, input));
      else await unwrap(createTreatmentAction(input));
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
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor="treatmentLabel">Nombre</Label>
          <Input
            id="treatmentLabel"
            autoFocus
            placeholder="Ej: Limpieza"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="treatmentCode">Código</Label>
          <Input
            id="treatmentCode"
            placeholder="Ej: 12.04.00"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="treatmentSpecialty">Especialidad</Label>
        <Select value={specialty} onValueChange={setSpecialty}>
          <SelectTrigger id="treatmentSpecialty" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SPECIALTY}>Sin especialidad</SelectItem>
            {specialties.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="treatmentPrice">Precio de lista</Label>
          <Input
            id="treatmentPrice"
            type="number"
            min={0}
            placeholder="Ej: 15000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="treatmentCashPrice">Precio en efectivo</Label>
          <Input
            id="treatmentCashPrice"
            type="number"
            min={0}
            placeholder="Opcional"
            value={cashPrice}
            onChange={(e) => setCashPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="treatmentDuration">Duración (min)</Label>
          <Input
            id="treatmentDuration"
            type="number"
            min={1}
            placeholder="Ej: 30"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Activo (se ofrece al cargar consultas y turnos)
      </label>
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
