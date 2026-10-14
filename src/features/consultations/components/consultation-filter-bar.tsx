"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import { PAYMENT_STATUS_LABELS, PENDING_OR_PARTIAL } from "@/features/clinic/lib/billing";
import { DateRangeFilter } from "@/features/consultations/components/date-range-filter";

export const ALL_TREATMENTS = "__all__";
export const ALL_PAYMENT_STATUSES = "__all__";

// Built from PAYMENT_STATUS_LABELS (billing.ts) rather than its own
// hardcoded strings, so this dropdown's wording can never drift from the
// badge's (payment-status-badge.tsx, Step 1) — SIN_MONTO deliberately
// included here even though the badge never renders for it: filtering by
// "Sin monto" is exactly how a dentist finds consultations to go price.
const PAYMENT_STATUS_OPTIONS = (
  ["COBRADO", "PENDIENTE", "PARCIAL", "SIN_MONTO"] as const
).map((value) => ({ value, label: PAYMENT_STATUS_LABELS[value] }));

/** The Tratamiento/Paciente/Pieza/Desde/Hasta filter row shared by the main
 * Consultas list (filtered server-side, via URL search params) and the
 * consultations list embedded in a patient's own page (filtered in memory,
 * since it's already scoped to one patient and has no Paciente field). Pure
 * presentation — every value and change is controlled by the caller. */
export function ConsultationFilterBar({
  treatment,
  onTreatmentChange,
  treatmentOptions,
  paymentStatus,
  onPaymentStatusChange,
  showPatient,
  patientQuery,
  onPatientQueryChange,
  toothQuery,
  onToothQueryChange,
  from,
  to,
  onRangeChange,
  hasFilters,
  onClear,
}: {
  treatment: string;
  onTreatmentChange: (value: string) => void;
  treatmentOptions: string[];
  paymentStatus: string;
  onPaymentStatusChange: (value: string) => void;
  showPatient: boolean;
  patientQuery: string;
  onPatientQueryChange: (value: string) => void;
  toothQuery: string;
  onToothQueryChange: (value: string) => void;
  from: string;
  to: string;
  onRangeChange: (range: { from: string; to: string }) => void;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tratamiento</Label>
        <Select value={treatment} onValueChange={onTreatmentChange}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TREATMENTS}>Todos los tratamientos</SelectItem>
            {treatmentOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
            <SelectItem value={OTHER_TREATMENT}>{OTHER_TREATMENT}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Estado de cobro</Label>
        <Select value={paymentStatus} onValueChange={onPaymentStatusChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PAYMENT_STATUSES}>Todos</SelectItem>
            {PAYMENT_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
            {/* Only reachable via the dashboard's "Por cobrar" link — kept
                out of normal browsing so the dropdown doesn't carry an
                entry nobody would pick on their own. */}
            {paymentStatus === PENDING_OR_PARTIAL && (
              <SelectItem value={PENDING_OR_PARTIAL}>Pendiente o parcial</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {showPatient && (
        <div className="space-y-1.5">
          <Label htmlFor="filter-patient" className="text-xs text-muted-foreground">
            Paciente
          </Label>
          <Input
            id="filter-patient"
            placeholder="Buscar por nombre..."
            value={patientQuery}
            onChange={(e) => onPatientQueryChange(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="filter-tooth" className="text-xs text-muted-foreground">
          Pieza
        </Label>
        <Input
          id="filter-tooth"
          placeholder="Ej: 16"
          value={toothQuery}
          onChange={(e) => onToothQueryChange(e.target.value)}
          className="w-full sm:w-28"
        />
      </div>

      <DateRangeFilter from={from} to={to} onChange={onRangeChange} />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X />
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
