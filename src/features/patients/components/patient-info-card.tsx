import { Info } from "lucide-react";
import type { Patient } from "@prisma/client";

import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/features/clinic/lib/format";
import {
  GENDERS,
  IVA_CONDITIONS,
  REFERRAL_SOURCES,
  optionLabel,
} from "@/features/patients/lib/options";

type Item = { label: string; value: string | null | undefined };

function Group({ title, items }: { title: string; items: Item[] }) {
  const filled = items.filter((i) => i.value);
  if (filled.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-3">
        {filled.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-sm font-medium whitespace-pre-wrap">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Everything on file about the patient, grouped like the form, showing
 * only what was filled in. */
export function PatientInfoCard({ patient }: { patient: Patient }) {
  const place = [patient.address, patient.city, patient.province].filter(Boolean).join(", ");
  const groups: { title: string; items: Item[] }[] = [
    {
      title: "Datos personales",
      items: [
        { label: "DNI", value: patient.dni },
        { label: "Fecha de nacimiento", value: formatDate(patient.birthDate?.toISOString().slice(0, 10)) },
        { label: "Género", value: optionLabel(GENDERS, patient.gender) },
        { label: "Email", value: patient.email },
        { label: "Dirección", value: place || null },
      ],
    },
    {
      title: "Obra social",
      items: [
        { label: "Obra social", value: patient.insurance },
        { label: "Plan", value: patient.insurancePlan },
        { label: "N° de afiliado", value: patient.insuranceNumber },
        { label: "Titular", value: patient.insuranceHolder },
        { label: "Parentesco con el titular", value: patient.holderRelationship },
        { label: "Grupo familiar", value: patient.familyGroup },
        { label: "Lugar de trabajo del titular", value: patient.holderWorkplace },
      ],
    },
    {
      title: "Datos fiscales",
      items: [
        { label: "CUIT / CUIL", value: patient.taxId },
        { label: "Razón social", value: patient.taxName },
        { label: "Condición frente al IVA", value: optionLabel(IVA_CONDITIONS, patient.ivaCondition) },
      ],
    },
    {
      title: "Contacto de emergencia",
      items: [
        { label: "Nombre", value: patient.emergencyName },
        { label: "Teléfono", value: patient.emergencyPhone },
        { label: "Relación", value: patient.emergencyRelation },
      ],
    },
    {
      title: "Información médica",
      items: [
        { label: "Grupo sanguíneo", value: patient.bloodType },
        { label: "Presión arterial habitual", value: patient.bloodPressure },
        { label: "Alergias", value: patient.allergies },
        { label: "Medicación habitual", value: patient.medications },
        { label: "Antecedentes médicos", value: patient.medicalHistory },
      ],
    },
    {
      title: "Notas y origen",
      items: [
        { label: "Cómo llegó", value: optionLabel(REFERRAL_SOURCES, patient.referralSource) },
        { label: "Recordatorios", value: patient.acceptsReminders ? null : "No acepta recordatorios" },
      ],
    },
  ];
  const hasAny = groups.some((g) => g.items.some((i) => i.value));

  return (
    <Card>
      {hasAny ? (
        <CardContent className="space-y-5">
          {groups.map((group) => (
            <Group key={group.title} title={group.title} items={group.items} />
          ))}
        </CardContent>
      ) : (
        <CardContent className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
          <Info className="size-5" />
          Todavía no se cargaron más datos de este paciente.
        </CardContent>
      )}
    </Card>
  );
}
