import { z } from "zod";
import { OTHER_INSURANCE } from "@/features/clinic/lib/insurance";

export const NEW_PATIENT_VALUE = "__new__";

/** Shared by both the new- and edit-consultation schemas: amountCharged
 * must be a non-negative number if present, and when paymentChoice is
 * PARCIAL, partialAmountPaid must be a non-negative number that doesn't
 * exceed amountCharged. */
function refineAmounts(
  data: {
    amountCharged?: string;
    paymentChoice?: string;
    partialAmountPaid?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (data.amountCharged) {
    const n = Number(data.amountCharged);
    if (Number.isNaN(n) || n < 0) {
      ctx.addIssue({
        path: ["amountCharged"],
        code: z.ZodIssueCode.custom,
        message: "Ingresá un monto válido, mayor o igual a 0",
      });
    }
  }
  if (data.paymentChoice === "PARCIAL") {
    const paid = Number(data.partialAmountPaid);
    if (!data.partialAmountPaid || Number.isNaN(paid) || paid < 0) {
      ctx.addIssue({
        path: ["partialAmountPaid"],
        code: z.ZodIssueCode.custom,
        message: "Ingresá cuánto se pagó hasta ahora",
      });
    } else {
      const charged = Number(data.amountCharged);
      if (!Number.isNaN(charged) && paid > charged) {
        ctx.addIssue({
          path: ["partialAmountPaid"],
          code: z.ZodIssueCode.custom,
          message: "Lo pagado no puede superar el monto a cobrar",
        });
      }
    }
  }
}

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
    time: z.string().min(1, "Ingresá la hora"),
    treatment: z.string().min(1, "Elegí un tratamiento"),
    treatmentOther: z.string().optional(),
    teeth: z.array(z.string()).optional(),
    notes: z.string().optional(),
    amountCharged: z.string().optional(),
    paymentChoice: z.enum(["PENDIENTE", "PARCIAL", "COBRADO"]).optional(),
    partialAmountPaid: z.string().optional(),
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
    refineAmounts(data, ctx);
  });

export type ConsultationValues = z.infer<typeof consultationSchema>;

export const editConsultationSchema = z
  .object({
    date: z.string().min(1, "Ingresá la fecha"),
    time: z.string().min(1, "Ingresá la hora"),
    treatment: z.string().min(1, "Elegí un tratamiento"),
    treatmentOther: z.string().optional(),
    teeth: z.array(z.string()).optional(),
    notes: z.string().optional(),
    amountCharged: z.string().optional(),
    paymentChoice: z.enum(["PENDIENTE", "PARCIAL", "COBRADO"]).optional(),
    partialAmountPaid: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.treatment === "Otro" && !data.treatmentOther?.trim()) {
      ctx.addIssue({
        path: ["treatmentOther"],
        code: z.ZodIssueCode.custom,
        message: "Describí el tratamiento realizado",
      });
    }
    refineAmounts(data, ctx);
  });

export type EditConsultationValues = z.infer<typeof editConsultationSchema>;
