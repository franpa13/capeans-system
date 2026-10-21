import { describe, expect, it } from "vitest";
import {
  MEDICATIONS,
  PRESCRIPTION_TEMPLATES,
  prescriptionAlerts,
  prescriptionMessage,
  prescriptionNumber,
} from "@/features/clinic/lib/prescriptions";

const item = (drug: string) => ({ drug, concentration: "", quantity: "", instructions: "" });

describe("prescription rules", () => {
  it("numbers recetas like REC-00000002", () => {
    expect(prescriptionNumber(2)).toBe("REC-00000002");
    expect(prescriptionNumber(123456789)).toBe("REC-123456789");
  });

  it("warns about a penicillin allergy when prescribing amoxicilina, whatever the spelling", () => {
    const alerts = prescriptionAlerts({ allergies: "Penicilina", medicalConditions: [] }, [
      item("Amoxicilina + ácido clavulánico"),
      item("Ibuprofeno"),
    ]);
    expect(alerts).toEqual([
      "Es alérgico a la penicilina: Amoxicilina + ácido clavulánico es una penicilina.",
    ]);
  });

  it("warns when a drug matches a recorded allergy", () => {
    expect(
      prescriptionAlerts({ allergies: "ibuprofeno, látex", medicalConditions: [] }, [item("Ibuprofeno")]),
    ).toEqual(["Tiene registrada alergia a: ibuprofeno, látex."]);
  });

  it("warns about anti-inflammatories with anticoagulants or a pregnancy", () => {
    expect(
      prescriptionAlerts({ allergies: null, medicalConditions: ["anticoagulantes", "embarazo"] }, [
        item("Ketorolac"),
        item("Paracetamol"),
      ]),
    ).toEqual([
      "Toma anticoagulantes: Ketorolac aumenta el riesgo de sangrado.",
      "Está embarazada: evitá antiinflamatorios como Ketorolac.",
    ]);
  });

  it("has nothing to say about a healthy patient", () => {
    expect(prescriptionAlerts({ allergies: "", medicalConditions: [] }, [item("Amoxicilina")])).toEqual([]);
  });

  it("only offers templates made of catalog medications", () => {
    const names = new Set(MEDICATIONS.map((m) => m.key));
    for (const template of PRESCRIPTION_TEMPLATES) {
      expect(template.medications.every((key) => names.has(key))).toBe(true);
    }
  });

  it("writes the WhatsApp text with each medication and how to take it", () => {
    expect(
      prescriptionMessage({
        patientName: "Leonardo Aguirre",
        clinicName: "Clínica Capeans",
        items: [
          { drug: "Amoxicilina", concentration: "500 mg", quantity: "21", instructions: "1 cada 8 horas por 7 días" },
        ],
        instructions: "Dieta blanda",
      }),
    ).toBe(
      "Hola Leonardo, te paso la receta de Clínica Capeans:\n\n" +
        "• Amoxicilina 500 mg (21): 1 cada 8 horas por 7 días\n\n" +
        "Indicaciones: Dieta blanda",
    );
  });
});
