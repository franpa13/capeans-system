"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTimeBlockAction } from "@/features/appointments/actions";
import { toLocalDateString } from "@/features/clinic/lib/format";
import { unwrap } from "@/lib/action-result";

/** "Bloquear": a period with no turnos — vacaciones, a feriado, a congreso.
 * Whole days by default (the common case); untick "Todo el día" to block
 * just some hours. */
export function BlockTimeDialog({ defaultDay }: { defaultDay: Date }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [fromTime, setFromTime] = useState("09:00");
  const [toDate, setToDate] = useState("");
  const [toTime, setToTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affected, setAffected] = useState<number | null>(null);

  function openDialog() {
    const day = toLocalDateString(defaultDay);
    setAllDay(true);
    setFromDate(day);
    setToDate(day);
    setFromTime("09:00");
    setToTime("13:00");
    setReason("");
    setError(null);
    setAffected(null);
    setOpen(true);
  }

  async function handleSave() {
    if (!fromDate || !toDate) return setError("Completá las fechas");
    const startsAt = new Date(`${fromDate}T${allDay ? "00:00" : fromTime}:00`);
    const endsAt = new Date(`${toDate}T${allDay ? "00:00" : toTime}:00`);
    // A whole day runs until the next midnight.
    if (allDay) endsAt.setDate(endsAt.getDate() + 1);

    setSaving(true);
    setError(null);
    try {
      const { affectedTurnos } = await unwrap(
        createTimeBlockAction({ startsAt, endsAt, reason: reason || undefined }),
      );
      router.refresh();
      if (affectedTurnos > 0) setAffected(affectedTurnos);
      else setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo bloquear");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={openDialog}>
        <Lock />
        Bloquear
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bloquear horario</DialogTitle>
          <DialogDescription>
            Vacaciones, un feriado, un congreso: en ese período no se pueden dar turnos.
          </DialogDescription>
        </DialogHeader>

        {affected !== null ? (
          <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            Quedó bloqueado. Ojo: ya había {affected} {affected === 1 ? "turno" : "turnos"} en ese
            período. Reprogramalos o cancelalos desde la agenda.
          </p>
        ) : (
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              Todo el día
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="blockFrom">Desde</Label>
                <Input
                  id="blockFrom"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="blockTo">Hasta</Label>
                <Input
                  id="blockTo"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              {!allDay && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="blockFromTime">Desde la hora</Label>
                    <Input
                      id="blockFromTime"
                      type="time"
                      value={fromTime}
                      onChange={(e) => setFromTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="blockToTime">Hasta la hora</Label>
                    <Input
                      id="blockToTime"
                      type="time"
                      value={toTime}
                      onChange={(e) => setToTime(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blockReason">Motivo (opcional)</Label>
              <Input
                id="blockReason"
                placeholder="Ej: Vacaciones, feriado, congreso"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {affected !== null ? (
            <DialogClose asChild>
              <Button>Listo</Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="outline">
                  <X />
                  Cancelar
                </Button>
              </DialogClose>
              <Button disabled={saving} onClick={handleSave}>
                <Lock />
                Bloquear
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
