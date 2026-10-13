"use client";

import { useMemo, useState } from "react";

import { PaginationNavigation } from "@/components/pagination-navigation";
import { usePagination } from "@/hooks/use-pagination";
import { ConsultationsTable } from "@/features/consultations/components/consultations-table";
import {
  ALL_PAYMENT_STATUSES,
  ALL_TREATMENTS,
  ConsultationFilterBar,
} from "@/features/consultations/components/consultation-filter-bar";
import { toLocalDateString } from "@/features/clinic/lib/format";
import { paymentStatus } from "@/features/clinic/lib/billing";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import type { Consultation, Patient } from "@prisma/client";

const PAGE_SIZE = 10;

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
  treatmentPrices,
}: {
  consultations: Consultation[];
  patients?: Patient[];
  showPatient?: boolean;
  fixedPatientName?: string;
  emptyMessage?: string;
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
}) {
  const [treatment, setTreatment] = useState(ALL_TREATMENTS);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(ALL_PAYMENT_STATUSES);
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
      if (
        paymentStatusFilter !== ALL_PAYMENT_STATUSES &&
        paymentStatus(c.amountCharged, c.amountPaid) !== paymentStatusFilter
      ) {
        return false;
      }
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
  }, [consultations, treatment, paymentStatusFilter, from, to, treatmentOptions, patientQuery, toothQuery, patients]);

  const hasFilters =
    treatment !== ALL_TREATMENTS ||
    paymentStatusFilter !== ALL_PAYMENT_STATUSES ||
    !!from ||
    !!to ||
    !!patientQuery ||
    !!toothQuery;

  const clearFilters = () => {
    setTreatment(ALL_TREATMENTS);
    setPaymentStatusFilter(ALL_PAYMENT_STATUSES);
    setFrom("");
    setTo("");
    setPatientQuery("");
    setToothQuery("");
  };

  const { page, setPage, pageCount, pageItems } = usePagination(filtered, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <ConsultationFilterBar
        treatment={treatment}
        onTreatmentChange={setTreatment}
        treatmentOptions={treatmentOptions}
        paymentStatus={paymentStatusFilter}
        onPaymentStatusChange={setPaymentStatusFilter}
        showPatient={showPatient}
        patientQuery={patientQuery}
        onPatientQueryChange={setPatientQuery}
        toothQuery={toothQuery}
        onToothQueryChange={setToothQuery}
        from={from}
        to={to}
        onRangeChange={(r) => {
          setFrom(r.from);
          setTo(r.to);
        }}
        hasFilters={hasFilters}
        onClear={clearFilters}
      />

      <ConsultationsTable
        consultations={pageItems}
        patients={patients}
        showPatient={showPatient}
        fixedPatientName={fixedPatientName}
        treatmentOptions={treatmentOptions}
        treatmentPrices={treatmentPrices}
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
