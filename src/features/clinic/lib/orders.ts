// Órdenes: what the dentist asks of someone else — imaging studies, lab
// tests before a surgery, a referral to another specialist — printed on
// the same signed sheet as a receta.

export type OrderKind = "imagenes" | "laboratorio" | "derivacion";

export const ORDER_KINDS: Record<OrderKind, { label: string; options: string[] }> = {
  imagenes: {
    label: "Estudios por imágenes",
    options: [
      "Radiografía panorámica",
      "Radiografía periapical de la pieza ",
      "Radiografía bite-wing (aleta de mordida)",
      "Telerradiografía de perfil",
      "Tomografía cone beam (CBCT) del maxilar superior",
      "Tomografía cone beam (CBCT) del maxilar inferior",
      "Fotografías intraorales y extraorales",
    ],
  },
  laboratorio: {
    label: "Laboratorio",
    options: [
      "Hemograma completo",
      "Coagulograma (TP, KPTT, RIN)",
      "Glucemia en ayunas",
      "Hemoglobina glicosilada (HbA1c)",
      "Urea y creatinina",
      "Serología para hepatitis B, hepatitis C y HIV",
    ],
  },
  derivacion: {
    label: "Derivación",
    options: [
      "Interconsulta con cardiología: solicito evaluación y apto para cirugía odontológica",
      "Interconsulta con clínica médica: solicito apto para cirugía odontológica",
      "Derivación a endodoncia",
      "Derivación a ortodoncia",
      "Derivación a periodoncia",
      "Derivación a cirugía bucomaxilofacial",
      "Derivación a odontopediatría",
    ],
  },
};

export const ORDER_KIND_KEYS = Object.keys(ORDER_KINDS) as OrderKind[];

export function isOrderKind(value: string): value is OrderKind {
  return value in ORDER_KINDS;
}

/** "ORD-00000003" — how an orden is numbered on paper. */
export function orderNumber(n: number): string {
  return `ORD-${String(n).padStart(8, "0")}`;
}

/** The orden as a WhatsApp message to the patient. */
export function orderMessage({
  patientName,
  clinicName,
  kind,
  items,
  diagnosis,
}: {
  patientName: string;
  clinicName: string;
  kind: OrderKind;
  items: string[];
  diagnosis?: string | null;
}): string {
  const firstName = patientName.trim().split(/\s+/)[0];
  let text =
    `Hola ${firstName}, te paso la orden de ${clinicName} (${ORDER_KINDS[kind].label}):\n\n` +
    items.map((i) => `• ${i}`).join("\n");
  if (diagnosis?.trim()) text += `\n\nDiagnóstico: ${diagnosis.trim()}`;
  return text;
}
