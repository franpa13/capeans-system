"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, X } from "lucide-react";
import type { TimeBlock } from "@prisma/client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteTimeBlockAction } from "@/features/appointments/actions";
import { formatDate, formatTime, toLocalDateString } from "@/features/clinic/lib/format";
import { unwrap } from "@/lib/action-result";

function describePeriod(block: TimeBlock) {
  const allDay = formatTime(block.startsAt) === "00:00" && formatTime(block.endsAt) === "00:00";
  const from = formatDate(toLocalDateString(block.startsAt));
  if (allDay) {
    // A whole-day block ends at the next midnight: the last day is the one before.
    const to = formatDate(toLocalDateString(new Date(block.endsAt.getTime() - 1)));
    return from === to ? `el ${from}` : `del ${from} al ${to}`;
  }
  const to = formatDate(toLocalDateString(block.endsAt));
  return `del ${from} ${formatTime(block.startsAt)} al ${to} ${formatTime(block.endsAt)}`;
}

/** The "Bloqueado · motivo" label drawn on a blocked period; tapping it
 * offers to unblock. */
export function TimeBlockBadge({ block }: { block: TimeBlock }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const label = block.reason ? `Bloqueado · ${block.reason}` : "Bloqueado";

  async function handleUnblock() {
    await unwrap(deleteTimeBlockAction(block.id));
    setConfirming(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
        className="pointer-events-auto inline-flex max-w-full items-center gap-1 rounded-full border border-amber-500/50 bg-card px-2.5 py-0.5 text-xs font-medium text-amber-700 shadow-xs hover:bg-amber-500/10 dark:text-amber-300"
      >
        <Lock className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desbloquear este horario?</AlertDialogTitle>
            <AlertDialogDescription>
              {label}, {describePeriod(block)}. Vas a poder volver a dar turnos en ese período.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleUnblock}>
              <LockOpen />
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
