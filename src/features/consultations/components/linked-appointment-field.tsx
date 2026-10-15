"use client";

import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTime } from "@/features/clinic/lib/format";
import {
  getLinkableAppointmentsAction,
  type LinkableAppointment,
} from "@/features/consultations/actions";
import { unwrap } from "@/lib/action-result";

// Radix Select can't use "" as an item value, so "not linked" needs its
// own sentinel; the form itself stores "" for it.
const NONE = "__none__";

/** "Turno de ese día": the patient's turnos on the date the form currently
 * has, re-fetched whenever patient or date change — so back-dating a
 * forgotten consulta to last week shows last week's turnos. */
export function LinkedAppointmentField({
  idPrefix = "",
  patientId,
  day,
  excludeConsultationId,
  value,
  onChange,
}: {
  idPrefix?: string;
  patientId?: string;
  /** "YYYY-MM-DD", straight from the form's date input. */
  day: string;
  excludeConsultationId?: string;
  value: string;
  onChange: (appointmentId: string) => void;
}) {
  // Results are tagged with the search they answer, so "loading" is just
  // "the latest results are for a different search" — derived, not set.
  const searchKey = patientId && day ? `${patientId}|${day}|${excludeConsultationId ?? ""}` : null;
  const [loaded, setLoaded] = useState<{ key: string; options: LinkableAppointment[] } | null>(
    null,
  );

  useEffect(() => {
    if (!searchKey || !patientId) return;
    let cancelled = false;
    unwrap(getLinkableAppointmentsAction(patientId, day, excludeConsultationId)).then((result) => {
      if (cancelled) return;
      setLoaded({ key: searchKey, options: result });
      // A turno picked for a different patient or day no longer applies.
      if (value && !result.some((a) => a.id === value)) onChange("");
    });
    return () => {
      cancelled = true;
    };
    // Only re-fetch when what's being searched for changes, not on every
    // selection the dentist makes from the results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  if (!patientId) return null;

  // null = still loading the current search.
  const options = !searchKey ? [] : loaded?.key === searchKey ? loaded.options : null;

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}appointmentLink`}>Turno de ese día (opcional)</Label>
      {options === null ? (
        <p className="text-sm text-muted-foreground">Buscando turnos...</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin turnos de este paciente ese día.</p>
      ) : (
        <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
          <SelectTrigger id={`${idPrefix}appointmentLink`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin vincular a un turno</SelectItem>
            {options.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {formatTime(new Date(a.startsAt))} — {a.reason || "Sin motivo"}
                {a.status === "COMPLETED" ? " (completado)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
