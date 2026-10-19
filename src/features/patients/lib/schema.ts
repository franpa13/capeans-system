import { z } from "zod";
import { OTHER_INSURANCE } from "@/features/clinic/lib/insurance";
import type { NewPatientInput } from "@/features/clinic/data/patients";

const optionalText = z.string().optional();

export const patientSchema = z
  .object({
    name: z.string().min(1, "Ingresá el nombre"),
    phone: z.string().min(1, "Ingresá el teléfono"),
    email: z.union([z.literal(""), z.string().email("Email inválido")]),
    dni: optionalText,
    birthDate: optionalText,
    address: optionalText,
    insurance: optionalText,
    insuranceOther: optionalText,
    insuranceNumber: optionalText,
    allergies: optionalText,
    medicalConditions: z.array(z.string()),
    medications: optionalText,
  })
  .superRefine((data, ctx) => {
    if (data.insurance === OTHER_INSURANCE && !data.insuranceOther?.trim()) {
      ctx.addIssue({
        path: ["insuranceOther"],
        code: z.ZodIssueCode.custom,
        message: "Ingresá el nombre de la obra social",
      });
    }
  });

export type PatientValues = z.infer<typeof patientSchema>;

/** The form's values as the data layer's input — shared by Nuevo and
 * Editar paciente so both send exactly the same shape. */
export function toPatientInput(values: PatientValues): NewPatientInput {
  return {
    name: values.name,
    phone: values.phone,
    email: values.email || undefined,
    dni: values.dni || undefined,
    birthDate: values.birthDate ? new Date(values.birthDate) : undefined,
    address: values.address || undefined,
    insurance:
      values.insurance === OTHER_INSURANCE
        ? values.insuranceOther?.trim()
        : values.insurance || undefined,
    insuranceNumber: values.insuranceNumber?.trim() || undefined,
    allergies: values.allergies || undefined,
    medicalConditions: values.medicalConditions,
    medications: values.medications?.trim() || undefined,
  };
}
