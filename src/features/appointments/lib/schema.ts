import { z } from "zod";

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

export const appointmentSchema = z.object({
  patientId: z.string().min(1, "Seleccioná un paciente"),
  date: z.string().min(1, "Ingresá la fecha"),
  time: z.string().min(1, "Ingresá la hora"),
  durationMinutes: z.number().int().positive(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export type AppointmentValues = z.infer<typeof appointmentSchema>;
