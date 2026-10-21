"use client";

import { useDefaultProfessionalId } from "@/features/clinic/components/permissions-provider";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Save, Search, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MEDICATIONS,
  PRESCRIPTION_TEMPLATES,
  prescriptionAlerts,
  type PrescriptionItem,
} from "@/features/clinic/lib/prescriptions";
import { createPrescriptionAction } from "@/features/patients/actions";
import { unwrap } from "@/lib/action-result";

export type ProfessionalOption = { id: string; title: string; name: string; hasSignature: boolean };

const NO_TREATMENT = "__none__";

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** "Nueva receta" on the ficha: who signs it, which consulta it's for,
 * the medications (from a short catalog, ready-made sets, or typed by
 * hand), and warnings from the patient's medical history. */
export function NewPrescriptionDialog({
  patientId,
  patientName,
  professionals,
  treatments,
  medicalHistory,
}: {
  patientId: string;
  patientName: string;
  professionals: ProfessionalOption[];
  /** The patient's consultas' tratamientos, to attach the receta to one. */
  treatments: string[];
  medicalHistory: { allergies: string | null; medicalConditions: string[] };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The signed-in dentist signs by default.
  const mine = useDefaultProfessionalId();
  const firstChoice = professionals.find((p) => p.id === mine)?.id ?? professionals[0]?.id ?? "";
  const [professionalId, setProfessionalId] = useState(firstChoice);
  const [treatment, setTreatment] = useState(NO_TREATMENT);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [instructions, setInstructions] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const professional = professionals.find((p) => p.id === professionalId);
  const alerts = prescriptionAlerts(medicalHistory, items);
  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return MEDICATIONS.filter((m) => normalize(`${m.drug} ${m.concentration}`).includes(q)).slice(0, 6);
  }, [query]);

  function reset() {
    setProfessionalId(firstChoice);
    setTreatment(NO_TREATMENT);
    setItems([]);
    setInstructions("");
    setQuery("");
    setError(null);
  }

  function add(item: PrescriptionItem) {
    setItems((current) => [...current, item]);
    setQuery("");
  }

  function addCatalog(key: string) {
    const m = MEDICATIONS.find((x) => x.key === key)!;
    add({ drug: m.drug, concentration: m.concentration, quantity: m.quantity, instructions: m.instructions });
  }

  function applyTemplate(index: number) {
    const template = PRESCRIPTION_TEMPLATES[index];
    for (const key of template.medications) addCatalog(key);
    if (template.instructions && !instructions.trim()) setInstructions(template.instructions);
  }

  function update(index: number, patch: Partial<PrescriptionItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { id } = await unwrap(
        createPrescriptionAction(patientId, {
          professionalId,
          items,
          treatment: treatment === NO_TREATMENT ? undefined : treatment,
          instructions,
        }),
      );
      setOpen(false);
      reset();
      router.push(`/dashboard/pacientes/${patientId}/recetas/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la receta");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Nueva receta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva receta</DialogTitle>
          <DialogDescription>Para {patientName}. Los medicamentos van por su nombre genérico.</DialogDescription>
        </DialogHeader>

        {professionals.length === 0 ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            Primero cargá quién firma las recetas en{" "}
            <Link href="/dashboard/configuracion?tab=professionals" className="font-medium underline">
              Configuración › Profesionales
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prescriptionProfessional">Profesional</Label>
                <Select value={professionalId} onValueChange={setProfessionalId}>
                  <SelectTrigger id="prescriptionProfessional" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prescriptionTreatment">Tratamiento asociado (opcional)</Label>
                <Select value={treatment} onValueChange={setTreatment}>
                  <SelectTrigger id="prescriptionTreatment" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TREATMENT}>Sin tratamiento asociado</SelectItem>
                    {treatments.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {professional && !professional.hasSignature && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                {professional.title} {professional.name} no tiene firma cargada: la receta sale sin firma
                para firmarla a mano. Podés dibujarla en Configuración › Profesionales.
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Recetas armadas</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESCRIPTION_TEMPLATES.map((t, i) => (
                  <Button key={t.label} type="button" size="sm" variant="outline" onClick={() => applyTemplate(i)}>
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="medicationSearch">Medicamentos</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="medicationSearch"
                  className="pl-8"
                  placeholder="Buscar medicamento... (ej: amoxicilina)"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (matches[0]) addCatalog(matches[0].key);
                      else if (query.trim()) add({ drug: query.trim(), concentration: "", quantity: "", instructions: "" });
                    }
                  }}
                />
              </div>
              {query.trim() && (
                <ul aria-label="Resultados" className="divide-y rounded-md border">
                  {matches.map((m) => (
                    <li key={m.key}>
                      <button
                        type="button"
                        className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => addCatalog(m.key)}
                      >
                        <span className="font-medium">
                          {m.drug} {m.concentration}
                        </span>
                        <span className="text-xs text-muted-foreground">{m.presentation}</span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => add({ drug: query.trim(), concentration: "", quantity: "", instructions: "" })}
                    >
                      <Plus className="size-4" />
                      Agregar “{query.trim()}”
                    </button>
                  </li>
                </ul>
              )}
            </div>

            {alerts.length > 0 && (
              <div
                role="alert"
                className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {alerts.map((a) => (
                  <p key={a} className="flex items-start gap-2 font-medium">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    {a}
                  </p>
                ))}
              </div>
            )}

            {items.map((item, i) => (
              <section
                key={i}
                aria-label={item.drug}
                className="relative space-y-3 rounded-lg border bg-muted/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <Input
                    aria-label="Medicamento"
                    value={item.drug}
                    onChange={(e) => update(i, { drug: e.target.value })}
                    className="font-semibold"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={`Quitar ${item.drug}`}
                    onClick={() => setItems(items.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Concentración</Label>
                    <Input
                      aria-label={`Concentración de ${item.drug}`}
                      value={item.concentration}
                      onChange={(e) => update(i, { concentration: e.target.value })}
                      placeholder="Ej: 500 mg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Cantidad</Label>
                    <Input
                      aria-label={`Cantidad de ${item.drug}`}
                      value={item.quantity}
                      onChange={(e) => update(i, { quantity: e.target.value })}
                      placeholder="Ej: 21"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Indicaciones</Label>
                  <Textarea
                    aria-label={`Indicaciones de ${item.drug}`}
                    value={item.instructions}
                    onChange={(e) => update(i, { instructions: e.target.value })}
                    placeholder="Ej: 1 comprimido cada 8 horas durante 7 días, después de las comidas."
                    className="min-h-12"
                  />
                </div>
              </section>
            ))}


            <div className="space-y-1.5">
              <Label htmlFor="prescriptionInstructions">Indicaciones generales (opcional)</Label>
              <Textarea
                id="prescriptionInstructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ej: dieta blanda, no enjuagarse por 24 horas..."
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <X />
              Cancelar
            </Button>
          </DialogClose>
          {professionals.length > 0 && (
            <Button type="button" onClick={save} disabled={saving || items.length === 0}>
              <Save />
              {saving ? "Creando..." : "Crear receta"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
