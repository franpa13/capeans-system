"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Save, X } from "lucide-react";

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
import { ORDER_KINDS, ORDER_KIND_KEYS, type OrderKind } from "@/features/clinic/lib/orders";
import { createMedicalOrderAction } from "@/features/patients/actions";
import type { ProfessionalOption } from "@/features/prescriptions/components/new-prescription-dialog";
import { unwrap } from "@/lib/action-result";

/** "Nueva orden" on the ficha: the kind (imágenes, laboratorio,
 * derivación), what's asked for — one tap from a list, editable, or typed
 * — and why. */
export function NewOrderDialog({
  patientId,
  patientName,
  professionals,
}: {
  patientId: string;
  patientName: string;
  professionals: ProfessionalOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [professionalId, setProfessionalId] = useState(professionals[0]?.id ?? "");
  const [kind, setKind] = useState<OrderKind>("imagenes");
  const [items, setItems] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setProfessionalId(professionals[0]?.id ?? "");
    setKind("imagenes");
    setItems([]);
    setCustom("");
    setDiagnosis("");
    setNotes("");
    setError(null);
  }

  function chooseKind(next: OrderKind) {
    // Each kind is its own orden: switching starts the list over.
    setKind(next);
    setItems([]);
  }

  function addCustom() {
    if (!custom.trim()) return;
    setItems([...items, custom.trim()]);
    setCustom("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { id } = await unwrap(
        createMedicalOrderAction(patientId, { professionalId, kind, items, diagnosis, notes }),
      );
      setOpen(false);
      reset();
      router.push(`/dashboard/pacientes/${patientId}/ordenes/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la orden");
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
          Nueva orden
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva orden</DialogTitle>
          <DialogDescription>Estudios, análisis o derivaciones para {patientName}.</DialogDescription>
        </DialogHeader>

        {professionals.length === 0 ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            Primero cargá quién firma en{" "}
            <Link href="/dashboard/configuracion?tab=professionals" className="font-medium underline">
              Configuración › Profesionales
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="orderProfessional">Profesional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger id="orderProfessional" className="w-full">
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

            <div className="flex w-fit flex-wrap gap-1 rounded-md border p-1" role="group" aria-label="Tipo de orden">
              {ORDER_KIND_KEYS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={kind === key ? "secondary" : "ghost"}
                  aria-pressed={kind === key}
                  onClick={() => chooseKind(key)}
                >
                  {ORDER_KINDS[key].label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Tocá lo que querés pedir</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Opciones">
                {ORDER_KINDS[kind].options.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-auto py-1.5 text-left whitespace-normal"
                    onClick={() => setItems([...items, option])}
                  >
                    <Plus />
                    {option.trim()}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  aria-label="Otro pedido"
                  placeholder="Otro (escribilo y tocá Agregar)"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addCustom} disabled={!custom.trim()}>
                  Agregar
                </Button>
              </div>
            </div>

            {items.length > 0 && (
              <section aria-label="Se solicita" className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <p className="text-sm font-semibold">Solicito:</p>
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      aria-label={`Pedido ${i + 1}`}
                      value={item}
                      onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label={`Quitar ${item.trim()}`}
                      onClick={() => setItems(items.filter((_, j) => j !== i))}
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                {items.some((i) => /pieza\s*$/i.test(i)) && (
                  <p className="text-xs text-muted-foreground">Completá el número de pieza en la periapical.</p>
                )}
              </section>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="orderDiagnosis">Diagnóstico / motivo (opcional)</Label>
              <Input
                id="orderDiagnosis"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Ej: evaluación de terceros molares"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orderNotes">Observaciones (opcional)</Label>
              <Textarea id="orderNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
              {saving ? "Creando..." : "Crear orden"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
