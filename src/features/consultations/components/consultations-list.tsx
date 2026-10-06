"use client";

import { useMemo, useState } from "react";
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
import { PaginationNavigation } from "@/components/pagination-navigation";
import { usePagination } from "@/hooks/use-pagination";
import { ConsultationsTable } from "@/features/consultations/components/consultations-table";
import { toLocalDateString } from "@/features/clinic/lib/format";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import type { Consultation, Patient } from "@prisma/client";

const ALL_TREATMENTS = "__all__";
const PAGE_SIZE = 20;

function matchesTreatment(
  consultationTreatment: string,
  filter: string,
  treatmentOptions: string[],
) {
  if (filter === ALL_TREATMENTS) return true;
  if (filter === OTHER_TREATMENT) {
    return !treatmentOptions.includes(consultationTreatment);
  }
  return consultationTreatment === filter;
}

export function ConsultationsList({
  consultations,
  patients,
  showPatient = true,
  fixedPatientName,
  emptyMessage = "Todavía no hay consultas registradas.",
  treatmentOptions,
}: {
  consultations: Consultation[];
  patients?: Patient[];
  showPatient?: boolean;
  fixedPatientName?: string;
  emptyMessage?: string;
  treatmentOptions: string[];
}) {
  const [treatment, setTreatment] = useState(ALL_TREATMENTS);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [toothQuery, setToothQuery] = useState("");

  const patientName = (id: string | null) =>
    (id && patients?.find((p) => p.id === id)?.name) || "";

  const filtered = useMemo(() => {
    const p = patientQuery.trim().toLowerCase();
    const tooth = toothQuery.trim();
    return consultations.filter((c) => {
      if (!matchesTreatment(c.treatment, treatment, treatmentOptions)) return false;
      // Not toISOString().slice(0, 10): that reads the UTC day, which can
      // already be tomorrow for a late-evening local time (see format.ts).
      const dateStr = toLocalDateString(c.date);
      if (from && dateStr < from) return false;
      if (to && dateStr > to) return false;
      if (p && !patientName(c.patientId).toLowerCase().includes(p)) return false;
      if (tooth && !c.teeth.some((t) => t.includes(tooth))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultations, treatment, from, to, treatmentOptions, patientQuery, toothQuery, patients]);

  const hasFilters =
    treatment !== ALL_TREATMENTS || !!from || !!to || !!patientQuery || !!toothQuery;

  const clearFilters = () => {
    setTreatment(ALL_TREATMENTS);
    setFrom("");
    setTo("");
    setPatientQuery("");
    setToothQuery("");
  };

  const { page, setPage, pageCount, pageItems } = usePagination(filtered, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tratamiento</Label>
          <Select value={treatment} onValueChange={setTreatment}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TREATMENTS}>
                Todos los tratamientos
              </SelectItem>
              {treatmentOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_TREATMENT}>{OTHER_TREATMENT}</SelectItem>
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
              onChange={(e) => setPatientQuery(e.target.value)}
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
            onChange={(e) => setToothQuery(e.target.value)}
            className="w-full sm:w-28"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
            Desde
          </Label>
          <Input
            id="filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full sm:w-40"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
            Hasta
          </Label>
          <Input
            id="filter-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full sm:w-40"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X />
            Limpiar filtros
          </Button>
        )}
      </div>

      <ConsultationsTable
        consultations={pageItems}
        patients={patients}
        showPatient={showPatient}
        fixedPatientName={fixedPatientName}
        treatmentOptions={treatmentOptions}
        emptyMessage={
          hasFilters
            ? "No hay consultas que coincidan con los filtros."
            : emptyMessage
        }
      />

      <PaginationNavigation page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
