"use client";

import type { Consultation, Patient } from "@prisma/client";

import { PaginationNavigation } from "@/components/pagination-navigation";
import { usePagination } from "@/hooks/use-pagination";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { ConsultationsTable } from "@/features/consultations/components/consultations-table";
import {
  ALL_TREATMENTS,
  ConsultationFilterBar,
} from "@/features/consultations/components/consultation-filter-bar";

const PAGE_SIZE = 10;
const PARAM_KEYS = ["tratamiento", "desde", "hasta", "paciente", "pieza"] as const;
const DEBOUNCED_KEYS = ["paciente", "pieza"] as const;

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
  const { values, setValue, clear } = useUrlFilters(PARAM_KEYS, DEBOUNCED_KEYS);
  const treatment = values.tratamiento || ALL_TREATMENTS;

  const hasFilters =
    treatment !== ALL_TREATMENTS ||
    !!values.desde ||
    !!values.hasta ||
    !!values.paciente ||
    !!values.pieza;

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
        onFromChange={(v) => setValue("desde", v)}
        to={values.hasta}
        onToChange={(v) => setValue("hasta", v)}
        hasFilters={hasFilters}
        onClear={clear}
      />

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
