import { z } from "zod";
import { OTHER_INSURANCE } from "@/features/clinic/lib/insurance";

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
    allergies: optionalText,
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
