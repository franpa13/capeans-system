import { z } from "zod";
import type { Patient } from "@prisma/client";
import { NO_INSURANCE, OTHER_INSURANCE } from "@/features/clinic/lib/insurance";
import type { NewPatientInput } from "@/features/clinic/data/patients";

const optionalText = z.string().optional();

/** The optional free-text fields of the full profile, as the form names
 * them — the same names as the Patient columns. */
export const PROFILE_TEXT_FIELDS = [
  "dni",
  "birthDate",
  "gender",
  "address",
  "city",
  "province",
  "insuranceNumber",
  "insurancePlan",
  "insuranceHolder",
  "holderRelationship",
  "familyGroup",
  "holderWorkplace",
  "taxId",
  "taxName",
  "ivaCondition",
  "emergencyName",
  "emergencyPhone",
  "emergencyRelation",
  "bloodType",
  "bloodPressure",
  "allergies",
  "medications",
  "medicalHistory",
  "referralSource",
] as const;

export const patientSchema = z
  .object({
    firstName: z.string().trim().min(1, "Ingresá el nombre"),
    lastName: z.string().trim().min(1, "Ingresá el apellido"),
    phone: z.string().trim().min(1, "Ingresá el teléfono"),
    email: z.union([z.literal(""), z.string().email("Email inválido")]),
    insurance: optionalText,
    insuranceOther: optionalText,
    medicalConditions: z.array(z.string()),
    active: z.boolean(),
    acceptsReminders: z.boolean(),
    ...Object.fromEntries(PROFILE_TEXT_FIELDS.map((f) => [f, optionalText])),
  } as {
    firstName: z.ZodString;
    lastName: z.ZodString;
    phone: z.ZodString;
    email: z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>;
    insurance: typeof optionalText;
    insuranceOther: typeof optionalText;
    medicalConditions: z.ZodArray<z.ZodString>;
    active: z.ZodBoolean;
    acceptsReminders: z.ZodBoolean;
  } & Record<(typeof PROFILE_TEXT_FIELDS)[number], typeof optionalText>)
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

export const EMPTY_PATIENT_VALUES: PatientValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  insurance: "",
  insuranceOther: "",
  medicalConditions: [],
  active: true,
  acceptsReminders: true,
  ...(Object.fromEntries(PROFILE_TEXT_FIELDS.map((f) => [f, ""])) as Record<
    (typeof PROFILE_TEXT_FIELDS)[number],
    string
  >),
};

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/** A saved patient as the form's values (for Editar). */
export function patientToValues(patient: Patient, insuranceOptions: string[]): PatientValues {
  const knownInsurance =
    !patient.insurance ||
    patient.insurance === NO_INSURANCE ||
    insuranceOptions.includes(patient.insurance);
  const text = Object.fromEntries(
    PROFILE_TEXT_FIELDS.map((f) => [
      f,
      f === "birthDate" ? toDateInputValue(patient.birthDate) : ((patient[f] as string | null) ?? ""),
    ]),
  ) as Record<(typeof PROFILE_TEXT_FIELDS)[number], string>;
  return {
    ...text,
    firstName: patient.firstName,
    lastName: patient.lastName,
    phone: patient.phone,
    email: patient.email ?? "",
    insurance: knownInsurance ? (patient.insurance ?? "") : OTHER_INSURANCE,
    insuranceOther: knownInsurance ? "" : (patient.insurance ?? ""),
    medicalConditions: patient.medicalConditions,
    active: patient.active,
    acceptsReminders: patient.acceptsReminders,
  };
}

/** The form's values as the data layer's input — the same for Nuevo and
 * Editar paciente. Empty optional fields are sent as undefined (cleared). */
export function toPatientInput(values: PatientValues): NewPatientInput {
  const text = Object.fromEntries(
    PROFILE_TEXT_FIELDS.filter((f) => f !== "birthDate").map((f) => [
      f,
      (values[f] as string | undefined)?.trim() || undefined,
    ]),
  );
  return {
    ...text,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim(),
    email: values.email || undefined,
    birthDate: values.birthDate ? new Date(values.birthDate) : undefined,
    insurance:
      values.insurance === OTHER_INSURANCE
        ? values.insuranceOther?.trim()
        : values.insurance || undefined,
    medicalConditions: values.medicalConditions,
    active: values.active,
    acceptsReminders: values.acceptsReminders,
  };
}
