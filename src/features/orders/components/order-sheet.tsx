import { ORDER_KINDS, isOrderKind, orderNumber } from "@/features/clinic/lib/orders";
import {
  DocumentSheet,
  type SheetClinic,
  type SheetPatient,
  type SignedBy,
} from "@/features/documents/components/document-sheet";

export type SheetOrder = SignedBy & {
  number: number;
  date: Date;
  kind: string;
  items: string[];
  diagnosis: string | null;
  notes: string | null;
};

/** The orden as printed: "Solicito:" each study or referral, with the
 * diagnosis, on the consultorio's signed sheet. */
export function OrderSheet({
  order: o,
  patient,
  clinic,
}: {
  order: SheetOrder;
  patient: SheetPatient;
  clinic: SheetClinic;
}) {
  return (
    <DocumentSheet
      label="Orden"
      number={orderNumber(o.number)}
      date={o.date}
      signedBy={o}
      patient={patient}
      clinic={clinic}
    >
      <p className="text-xs font-semibold tracking-wider text-neutral-600 uppercase">
        {isOrderKind(o.kind) ? ORDER_KINDS[o.kind].label : o.kind}
      </p>
      <p className="font-serif text-xl font-bold italic">Solicito:</p>
      <ul className="list-disc space-y-1.5 pl-5">
        {o.items.map((item, i) => (
          <li key={i} className="font-medium">
            {item}
          </li>
        ))}
      </ul>
      {o.diagnosis && (
        <p className="text-xs">
          <b>Diagnóstico / motivo:</b> {o.diagnosis}
        </p>
      )}
      {o.notes && (
        <div className="border-t border-dashed border-neutral-300 pt-3 text-xs">
          <p className="font-semibold">Observaciones</p>
          <p className="whitespace-pre-wrap">{o.notes}</p>
        </div>
      )}
    </DocumentSheet>
  );
}
