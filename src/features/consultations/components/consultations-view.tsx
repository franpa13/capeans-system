"use client";

import { useMemo } from "react";
import type { Consultation, Patient } from "@prisma/client";

import { ConsultationsList } from "@/features/consultations/components/consultations-list";

export function ConsultationsView({
  consultations,
  patients,
}: {
  consultations: Consultation[];
  patients: Patient[];
}) {
  const sorted = useMemo(
    () => [...consultations].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [consultations],
  );

  return <ConsultationsList consultations={sorted} patients={patients} />;
}
