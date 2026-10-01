"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  INITIAL_CONSULTATIONS,
  INITIAL_PATIENTS,
} from "@/features/clinic/lib/mock-data";
import type {
  Consultation,
  NewConsultationInput,
  NewPatientInput,
  Patient,
} from "@/features/clinic/lib/types";

type ClinicDataContextValue = {
  patients: Patient[];
  consultations: Consultation[];
  addPatient: (input: NewPatientInput) => Patient;
  editPatient: (id: string, input: NewPatientInput) => void;
  deletePatient: (id: string) => void;
  addConsultation: (input: NewConsultationInput) => void;
  getPatient: (id: string) => Patient | undefined;
  getConsultationsForPatient: (id: string) => Consultation[];
  getLastVisit: (id: string) => string | undefined;
};

const ClinicDataContext = createContext<ClinicDataContextValue | null>(null);

export function ClinicDataProvider({ children }: { children: React.ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [consultations, setConsultations] = useState<Consultation[]>(
    INITIAL_CONSULTATIONS,
  );

  const addPatient = useCallback((input: NewPatientInput) => {
    const patient: Patient = { id: crypto.randomUUID(), ...input };
    setPatients((prev) => [patient, ...prev]);
    return patient;
  }, []);

  const editPatient = useCallback((id: string, input: NewPatientInput) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { id, ...input } : p)),
    );
  }, []);

  const deletePatient = useCallback((id: string) => {
    setPatients((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addConsultation = useCallback((input: NewConsultationInput) => {
    const consultation: Consultation = { id: crypto.randomUUID(), ...input };
    setConsultations((prev) => [consultation, ...prev]);
  }, []);

  const getPatient = useCallback(
    (id: string) => patients.find((p) => p.id === id),
    [patients],
  );

  const getConsultationsForPatient = useCallback(
    (id: string) =>
      consultations
        .filter((c) => c.patientId === id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [consultations],
  );

  const getLastVisit = useCallback(
    (id: string) => getConsultationsForPatient(id)[0]?.date,
    [getConsultationsForPatient],
  );

  const value = useMemo(
    () => ({
      patients,
      consultations,
      addPatient,
      editPatient,
      deletePatient,
      addConsultation,
      getPatient,
      getConsultationsForPatient,
      getLastVisit,
    }),
    [
      patients,
      consultations,
      addPatient,
      editPatient,
      deletePatient,
      addConsultation,
      getPatient,
      getConsultationsForPatient,
      getLastVisit,
    ],
  );

  return (
    <ClinicDataContext.Provider value={value}>
      {children}
    </ClinicDataContext.Provider>
  );
}

export function useClinicData() {
  const ctx = useContext(ClinicDataContext);
  if (!ctx) {
    throw new Error("useClinicData must be used within a ClinicDataProvider");
  }
  return ctx;
}
