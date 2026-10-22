"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { Professional } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SignaturePad } from "@/components/signature-pad";
import { PROFESSIONAL_TITLES } from "@/features/clinic/data/professional-titles";
import {
  createProfessionalAction,
  deleteProfessionalAction,
  updateClinicDetailsAction,
  updateProfessionalAction,
} from "@/features/settings/actions";
import { unwrap } from "@/lib/action-result";

type ClinicDetails = { name: string; address: string | null; phone: string | null; email: string | null };

/** "Datos del consultorio": what heads every printed receta. */
export function ClinicDetailsCard({ clinic }: { clinic: ClinicDetails }) {
  const router = useRouter();
  const [address, setAddress] = useState(clinic.address ?? "");
  const [phone, setPhone] = useState(clinic.phone ?? "");
  const [email, setEmail] = useState(clinic.email ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await unwrap(updateClinicDetailsAction({ address, phone, email }));
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del consultorio</CardTitle>
        <CardDescription>
          {clinic.name}. La dirección, el teléfono y el email salen en el encabezado de recetas y órdenes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="clinicAddress">Dirección</Label>
            <Input
              id="clinicAddress"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: San Juan 3169, Rosario"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clinicPhone">Teléfono</Label>
            <Input id="clinicPhone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clinicEmail">Email</Label>
            <Input id="clinicEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex items-center justify-end gap-3 sm:col-span-3">
            {saved && <span className="text-sm text-muted-foreground">Guardado.</span>}
            <Button type="submit" disabled={saving}>
              <Save />
              {saving ? "Guardando..." : "Guardar datos"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfessionalForm({
  professional,
  specialties,
  onDone,
}: {
  professional: Professional | null;
  specialties: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(professional?.title ?? "Dra.");
  const [name, setName] = useState(professional?.name ?? "");
  const [specialty, setSpecialty] = useState(professional?.specialty ?? "");
  const [license, setLicense] = useState(professional?.license ?? "");
  const [commission, setCommission] = useState(
    professional?.commissionPercent != null ? String(professional.commissionPercent) : "",
  );
  const [signature, setSignature] = useState<string | null>(professional?.signature ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input = {
      title,
      name,
      specialty,
      license,
      signature,
      commissionPercent: commission.trim() === "" ? null : Number(commission),
    };
    try {
      await unwrap(
        professional ? updateProfessionalAction(professional.id, input) : createProfessionalAction(input),
      );
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="professionalTitle">Título</Label>
          <Select value={title} onValueChange={setTitle}>
            <SelectTrigger id="professionalTitle" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROFESSIONAL_TITLES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="professionalName">Nombre y apellido</Label>
          <Input
            id="professionalName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Valeria Moretti"
            autoFocus
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="professionalSpecialty">Especialidad (opcional)</Label>
          <Input
            id="professionalSpecialty"
            list="professional-specialties"
            autoComplete="off"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          />
          <datalist id="professional-specialties">
            {specialties.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="professionalLicense">Matrícula</Label>
          <Input
            id="professionalLicense"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="Ej: MP 4123"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="professionalCommission">Comisión % (opcional)</Label>
          <Input
            id="professionalCommission"
            type="number"
            min={0}
            max={100}
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            placeholder="Ej: 40"
          />
          <p className="text-xs text-muted-foreground">Lo que le corresponde de lo cobrado, para las liquidaciones.</p>
        </div>
      </div>
      <SignaturePad value={signature} onChange={setSignature} />
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
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Configuración › Profesionales: the consultorio's letterhead data and
 * the dentists who sign recetas, each with a drawn signature. */
export function ProfessionalsManager({
  professionals,
  specialties,
}: {
  professionals: Professional[];
  specialties: string[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [deleting, setDeleting] = useState<Professional | null>(null);

  async function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    await unwrap(deleteProfessionalAction(target.id));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Profesionales</CardTitle>
            <CardDescription>Quienes firman las recetas, con su matrícula y su firma.</CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Nuevo profesional
          </Button>
        </CardHeader>
        <CardContent>
          {professionals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay profesionales. Agregá al menos uno para poder hacer recetas.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {professionals.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {p.title} {p.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        p.specialty,
                        `Matrícula ${p.license}`,
                        p.commissionPercent != null ? `${p.commissionPercent}% de comisión` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {p.signature ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a data URL
                    <img
                      src={p.signature}
                      alt={`Firma de ${p.name}`}
                      className="h-12 w-36 rounded border bg-white object-contain"
                    />
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                      Sin firma
                    </span>
                  )}
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${p.name}`}
                      onClick={() => {
                        setEditing(p);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label={`Eliminar ${p.name}`}
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar profesional" : "Nuevo profesional"}</DialogTitle>
            <DialogDescription>Sus datos y su firma salen al pie de cada receta que haga.</DialogDescription>
          </DialogHeader>
          {formOpen && (
            <ProfessionalForm
              key={editing?.id ?? "new"}
              professional={editing}
              specialties={specialties}
              onDone={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Las recetas que ya hizo no cambian: conservan su nombre, matrícula y firma.
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
    </div>
  );
}
