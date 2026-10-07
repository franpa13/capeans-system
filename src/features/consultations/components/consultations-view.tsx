"use client";

import type { Consultation, Patient } from "@prisma/client";

import { PaginationNavigation } from "@/components/pagination-navigation";
import { ActiveFilterChips, type FilterChip } from "@/components/active-filter-chips";
import { usePagination } from "@/hooks/use-pagination";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { formatDate } from "@/features/clinic/lib/format";
import { ConsultationsTable } from "@/features/consultations/components/consultations-table";
import {
  ALL_TREATMENTS,
  ConsultationFilterBar,
} from "@/features/consultations/components/consultation-filter-bar";

const PAGE_SIZE = 10;
const PARAM_KEYS = ["tratamiento", "desde", "hasta", "paciente", "pieza"] as const;
const DEBOUNCED_KEYS = ["paciente", "pieza"] as const;

function dateRangeLabel(from: string, to: string) {
  if (from && to) return `Fecha: ${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `Desde: ${formatDate(from)}`;
  return `Hasta: ${formatDate(to)}`;
}

/** The main /dashboard/consultas list: filters live in the URL (so they
 * survive a reload and can be shared/bookmarked) and are applied by
 * getConsultations in the Server Component above — `consultations` here is
 * already the filtered, date-desc-sorted result. Only pagination stays
 * client-side, slicing that already-filtered array. */
export function ConsultationsView({
  consultations,
  patients,
  treatmentOptions,
}: {
  consultations: Consultation[];
  patients: Patient[];
  treatmentOptions: string[];
}) {
  const { values, setValue, setMany, clear } = useUrlFilters(PARAM_KEYS, DEBOUNCED_KEYS);
  const treatment = values.tratamiento || ALL_TREATMENTS;

  const hasFilters =
    treatment !== ALL_TREATMENTS ||
    !!values.desde ||
    !!values.hasta ||
    !!values.paciente ||
    !!values.pieza;

  const chips: FilterChip[] = [
    treatment !== ALL_TREATMENTS && {
      key: "tratamiento",
      label: `Tratamiento: ${treatment}`,
      onRemove: () => setValue("tratamiento", ""),
    },
    !!values.paciente && {
      key: "paciente",
      label: `Paciente: ${values.paciente}`,
      onRemove: () => setValue("paciente", ""),
    },
    !!values.pieza && {
      key: "pieza",
      label: `Pieza: ${values.pieza}`,
      onRemove: () => setValue("pieza", ""),
    },
    (!!values.desde || !!values.hasta) && {
      key: "fecha",
      label: dateRangeLabel(values.desde, values.hasta),
      onRemove: () => setMany({ desde: "", hasta: "" }),
    },
  ].filter((chip): chip is FilterChip => chip !== false);

  const { page, setPage, pageCount, pageItems } = usePagination(consultations, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <ConsultationFilterBar
        treatment={treatment}
        onTreatmentChange={(v) => setValue("tratamiento", v === ALL_TREATMENTS ? "" : v)}
        treatmentOptions={treatmentOptions}
        showPatient
        patientQuery={values.paciente}
        onPatientQueryChange={(v) => setValue("paciente", v)}
        toothQuery={values.pieza}
        onToothQueryChange={(v) => setValue("pieza", v)}
        from={values.desde}
        to={values.hasta}
        onRangeChange={(r) => setMany({ desde: r.from, hasta: r.to })}
        hasFilters={hasFilters}
        onClear={clear}
      />

      <ActiveFilterChips chips={chips} />

      <ConsultationsTable
        consultations={pageItems}
        patients={patients}
        showPatient
        treatmentOptions={treatmentOptions}
        emptyMessage={
          hasFilters
            ? "No hay consultas que coincidan con los filtros."
            : "Todavía no hay consultas registradas."
        }
      />

      <PaginationNavigation page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
