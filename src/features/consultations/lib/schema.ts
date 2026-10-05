import { z } from "zod";
import { OTHER_INSURANCE } from "@/features/clinic/lib/insurance";

export const NEW_PATIENT_VALUE = "__new__";

export const consultationSchema = z
  .object({
    patientId: z.string().min(1, "Seleccioná un paciente"),
    newPatientName: z.string().optional(),
    newPatientPhone: z.string().optional(),
    newPatientEmail: z.union([z.literal(""), z.string().email("Email inválido")]),
    newPatientDni: z.string().optional(),
    newPatientBirthDate: z.string().optional(),
    newPatientAddress: z.string().optional(),
    newPatientInsurance: z.string().optional(),
    newPatientInsuranceOther: z.string().optional(),
    newPatientAllergies: z.string().optional(),
    date: z.string().min(1, "Ingresá la fecha"),
    treatment: z.string().min(1, "Elegí un tratamiento"),
    treatmentOther: z.string().optional(),
    teeth: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.patientId === NEW_PATIENT_VALUE) {
      if (!data.newPatientName?.trim()) {
        ctx.addIssue({
          path: ["newPatientName"],
          code: z.ZodIssueCode.custom,
          message: "Ingresá el nombre del paciente",
        });
      }
      if (!data.newPatientPhone?.trim()) {
        ctx.addIssue({
          path: ["newPatientPhone"],
          code: z.ZodIssueCode.custom,
          message: "Ingresá el teléfono del paciente",
        });
      }
    }
    if (data.treatment === "Otro" && !data.treatmentOther?.trim()) {
      ctx.addIssue({
        path: ["treatmentOther"],
        code: z.ZodIssueCode.custom,
        message: "Describí el tratamiento realizado",
      });
    }
    if (
      data.newPatientInsurance === OTHER_INSURANCE &&
      !data.newPatientInsuranceOther?.trim()
    ) {
      ctx.addIssue({
        path: ["newPatientInsuranceOther"],
        code: z.ZodIssueCode.custom,
        message: "Ingresá el nombre de la obra social",
      });
    }
  });

export type ConsultationValues = z.infer<typeof consultationSchema>;
