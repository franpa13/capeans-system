import { prescriptionNumber, type PrescriptionItem } from "@/features/clinic/lib/prescriptions";
import {
  DocumentSheet,
  type SheetClinic,
  type SheetPatient,
  type SignedBy,
} from "@/features/documents/components/document-sheet";

export type { SheetClinic };

export type SheetPrescription = SignedBy & {
  number: number;
  date: Date;
  treatment: string | null;
  instructions: string | null;
  items: PrescriptionItem[];
};

/** The receta as printed: Rp/ with each medication and the general
 * indicaciones, on the consultorio's signed sheet. */
export function PrescriptionSheet({
  prescription: p,
  patient,
  clinic,
}: {
  prescription: SheetPrescription;
  patient: SheetPatient;
  clinic: SheetClinic;
}) {
  return (
    <DocumentSheet
      label="Receta"
      number={prescriptionNumber(p.number)}
      date={p.date}
      signedBy={p}
      patient={patient}
      clinic={clinic}
      extraPatientLine={
        p.treatment && (
          <>
            <b>Tratamiento:</b> {p.treatment}
          </>
        )
      }
    >
      <p className="font-serif text-2xl font-bold italic">Rp/</p>
      <ol className="space-y-3">
        {p.items.map((item, i) => (
          <li key={i}>
            <p className="font-semibold">{[item.drug, item.concentration].filter(Boolean).join(" ")}</p>
            {item.quantity && <p className="text-xs text-neutral-600">Cantidad: {item.quantity}</p>}
            {item.instructions && <p className="text-xs">{item.instructions}</p>}
          </li>
        ))}
      </ol>
      {p.instructions && (
        <div className="border-t border-dashed border-neutral-300 pt-3 text-xs">
          <p className="font-semibold">Indicaciones</p>
          <p className="whitespace-pre-wrap">{p.instructions}</p>
        </div>
      )}
    </DocumentSheet>
  );
}
