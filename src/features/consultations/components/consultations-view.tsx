"use client";

import { useMemo } from "react";

import { useClinicData } from "@/features/clinic/context/clinic-provider";
import { ConsultationsList } from "@/features/consultations/components/consultations-list";

export function ConsultationsView() {
  const { consultations, patients } = useClinicData();

  const sorted = useMemo(
    () => [...consultations].sort((a, b) => b.date.localeCompare(a.date)),
    [consultations],
  );

  return <ConsultationsList consultations={sorted} patients={patients} />;
}
