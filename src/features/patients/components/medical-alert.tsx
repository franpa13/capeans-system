import { TriangleAlert } from "lucide-react";

/** "⚠ Antecedentes médicos: Alergia: penicilina · Toma anticoagulantes" —
 * shown at the top of the ficha and in the consulta form, the two places
 * the dentist is about to treat this patient. Renders nothing when there's
 * nothing to warn about. */
export function MedicalAlert({ alerts }: { alerts: string[] }) {
  if (alerts.length === 0) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <div>
        <span className="font-semibold">Antecedentes médicos: </span>
        {alerts.map((alert, i) => (
          <span key={alert}>
            {i > 0 && " · "}
            <span className="font-medium">{alert}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
