// Recetas: the medications a dentist usually prescribes, ready-made sets
// of them, and the warnings drawn from the patient's medical history.
// Drugs go by their generic name, as Argentine law (Ley 25.649) requires.

export type PrescriptionItem = {
  drug: string;
  concentration: string;
  /** How many units, e.g. "21" comprimidos or "1 frasco". */
  quantity: string;
  instructions: string;
};

export type CatalogMedication = PrescriptionItem & { key: string; presentation: string };

export const MEDICATIONS: CatalogMedication[] = [
  {
    key: "amoxicilina",
    drug: "Amoxicilina",
    concentration: "500 mg",
    presentation: "comprimidos",
    quantity: "21",
    instructions: "1 comprimido cada 8 horas durante 7 días.",
  },
  {
    key: "amoxiclav",
    drug: "Amoxicilina + ácido clavulánico",
    concentration: "875/125 mg",
    presentation: "comprimidos",
    quantity: "14",
    instructions: "1 comprimido cada 12 horas durante 7 días.",
  },
  {
    key: "clindamicina",
    drug: "Clindamicina",
    concentration: "300 mg",
    presentation: "cápsulas",
    quantity: "28",
    instructions: "1 cápsula cada 6 horas durante 7 días.",
  },
  {
    key: "azitromicina",
    drug: "Azitromicina",
    concentration: "500 mg",
    presentation: "comprimidos",
    quantity: "3",
    instructions: "1 comprimido por día durante 3 días.",
  },
  {
    key: "metronidazol",
    drug: "Metronidazol",
    concentration: "500 mg",
    presentation: "comprimidos",
    quantity: "21",
    instructions: "1 comprimido cada 8 horas durante 7 días. No tomar alcohol.",
  },
  {
    key: "ibuprofeno400",
    drug: "Ibuprofeno",
    concentration: "400 mg",
    presentation: "comprimidos",
    quantity: "12",
    instructions: "1 comprimido cada 8 horas si hay dolor, después de las comidas.",
  },
  {
    key: "ibuprofeno600",
    drug: "Ibuprofeno",
    concentration: "600 mg",
    presentation: "comprimidos",
    quantity: "10",
    instructions: "1 comprimido cada 8 horas si hay dolor, después de las comidas.",
  },
  {
    key: "ketorolac",
    drug: "Ketorolac",
    concentration: "10 mg",
    presentation: "comprimidos sublinguales",
    quantity: "10",
    instructions: "1 comprimido cada 8 horas si hay dolor, hasta 5 días.",
  },
  {
    key: "diclofenac",
    drug: "Diclofenac",
    concentration: "50 mg",
    presentation: "comprimidos",
    quantity: "15",
    instructions: "1 comprimido cada 8 horas después de las comidas.",
  },
  {
    key: "paracetamol",
    drug: "Paracetamol",
    concentration: "500 mg",
    presentation: "comprimidos",
    quantity: "16",
    instructions: "1 comprimido cada 6 a 8 horas si hay dolor.",
  },
  {
    key: "dexametasona",
    drug: "Dexametasona",
    concentration: "4 mg",
    presentation: "comprimidos",
    quantity: "3",
    instructions: "1 comprimido por día durante 3 días, a la mañana.",
  },
  {
    key: "clorhexidina",
    drug: "Clorhexidina enjuague bucal",
    concentration: "0,12 %",
    presentation: "frasco",
    quantity: "1 frasco",
    instructions: "Enjuagar con 15 ml durante 30 segundos, 2 veces por día, por 7 días. Empezar 24 horas después.",
  },
];

export const PRESCRIPTION_TEMPLATES: { label: string; medications: string[]; instructions?: string }[] = [
  {
    label: "Post extracción",
    medications: ["amoxicilina", "ibuprofeno600", "clorhexidina"],
    instructions:
      "No enjuagarse ni escupir durante 24 horas. Dieta blanda y fría. No fumar. Hielo local los primeros 2 días.",
  },
  { label: "Infección", medications: ["amoxiclav", "ibuprofeno400"] },
  { label: "Alérgico a la penicilina", medications: ["clindamicina", "ibuprofeno400"] },
  { label: "Dolor", medications: ["ibuprofeno400", "paracetamol"] },
];

/** "REC-00000002" — how a receta is numbered on paper. */
export function prescriptionNumber(n: number): string {
  return `REC-${String(n).padStart(8, "0")}`;
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const PENICILLINS = ["amoxicilina", "ampicilina", "penicilina"];
const NSAIDS = ["ibuprofeno", "ketorolac", "diclofenac", "naproxeno", "aspirina", "acido acetilsalicilico"];

/** What to warn about before printing this receta, from the patient's
 * allergies and conditions (lib/medical.ts keys). */
export function prescriptionAlerts(
  patient: { allergies: string | null; medicalConditions: string[] },
  items: Pick<PrescriptionItem, "drug">[],
): string[] {
  const alerts: string[] = [];
  const allergies = patient.allergies?.trim() ?? "";
  const allergyText = normalize(allergies);
  const penicillinAllergy = ["penic", "amoxi", "ampic"].some((w) => allergyText.includes(w));

  for (const { drug } of items) {
    const name = normalize(drug);
    if (penicillinAllergy && PENICILLINS.some((p) => name.includes(p))) {
      alerts.push(`Es alérgico a la penicilina: ${drug} es una penicilina.`);
    } else if (allergyText && name.split(/[^a-z]+/).some((word) => word.length > 3 && allergyText.includes(word))) {
      alerts.push(`Tiene registrada alergia a: ${allergies}.`);
    }
  }
  const nsaids = items.filter(({ drug }) => NSAIDS.some((n) => normalize(drug).includes(n)));
  for (const { drug } of nsaids) {
    if (patient.medicalConditions.includes("anticoagulantes")) {
      alerts.push(`Toma anticoagulantes: ${drug} aumenta el riesgo de sangrado.`);
    }
  }
  for (const { drug } of nsaids) {
    if (patient.medicalConditions.includes("embarazo")) {
      alerts.push(`Está embarazada: evitá antiinflamatorios como ${drug}.`);
    }
  }
  return [...new Set(alerts)];
}

/** The receta as a WhatsApp message to the patient. */
export function prescriptionMessage({
  patientName,
  clinicName,
  items,
  instructions,
}: {
  patientName: string;
  clinicName: string;
  items: PrescriptionItem[];
  instructions?: string | null;
}): string {
  const firstName = patientName.trim().split(/\s+/)[0];
  const lines = items.map((i) => {
    const name = [i.drug, i.concentration].filter(Boolean).join(" ");
    const quantity = i.quantity ? ` (${i.quantity})` : "";
    return `• ${name}${quantity}${i.instructions ? `: ${i.instructions}` : ""}`;
  });
  let text = `Hola ${firstName}, te paso la receta de ${clinicName}:\n\n${lines.join("\n")}`;
  if (instructions?.trim()) text += `\n\nIndicaciones: ${instructions.trim()}`;
  return text;
}
