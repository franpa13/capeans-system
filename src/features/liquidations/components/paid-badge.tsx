import { formatDate, toLocalDateString } from "@/features/clinic/lib/format";

/** "Pagada el dd/mm/aaaa" or "Pendiente de pago". */
export function PaidBadge({ paidAt }: { paidAt: Date | null }) {
  return paidAt ? (
    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-300">
      Pagada el {formatDate(toLocalDateString(paidAt))}
    </span>
  ) : (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-700 dark:text-amber-300">
      Pendiente de pago
    </span>
  );
}
