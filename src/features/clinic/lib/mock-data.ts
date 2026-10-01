import type { Consultation, Patient } from "@/features/clinic/lib/types";

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: "1",
    name: "Lucía Fernández",
    phone: "11 4455-2201",
    email: "lucia.fernandez@example.com",
    dni: "32.456.789",
    birthDate: "1990-04-12",
    insurance: "OSDE",
  },
  {
    id: "2",
    name: "Martín Gómez",
    phone: "11 4455-3312",
    email: "martin.gomez@example.com",
    dni: "28.901.234",
    insurance: "Swiss Medical",
  },
  {
    id: "3",
    name: "Sofía Ramírez",
    phone: "11 4455-8890",
    dni: "35.112.567",
    allergies: "Alergia a la penicilina",
  },
  {
    id: "4",
    name: "Nicolás Torres",
    phone: "11 4455-1123",
    email: "nico.torres@example.com",
  },
];

export const INITIAL_CONSULTATIONS: Consultation[] = [
  {
    id: "c1",
    patientId: "1",
    date: "2026-08-12",
    treatment: "Limpieza",
    notes: "Sin complicaciones. Se indica control en 6 meses.",
  },
  {
    id: "c2",
    patientId: "1",
    date: "2026-06-02",
    treatment: "Obturación (caries)",
    tooth: "16",
    notes: "Caries oclusal. Obturación con resina compuesta.",
  },
  {
    id: "c3",
    patientId: "2",
    date: "2026-09-03",
    treatment: "Consulta / diagnóstico",
    notes: "Dolor en molar inferior derecho. Se solicita radiografía.",
  },
  {
    id: "c4",
    patientId: "3",
    date: "2026-07-20",
    treatment: "Extracción",
    tooth: "38",
    notes: "Extracción de muela del juicio. Indicaciones postoperatorias entregadas.",
  },
];
