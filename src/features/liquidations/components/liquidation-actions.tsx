"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Printer, RotateCcw, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { deleteLiquidationAction, setLiquidationPaidAction } from "@/features/liquidations/actions";
import { unwrap } from "@/lib/action-result";

/** A liquidación's buttons: mark paid (or back to pending), print, delete, back. */
export function LiquidationActions({ id, paid }: { id: string; paid: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {paid ? (
        <Button variant="outline" onClick={async () => { await unwrap(setLiquidationPaidAction(id, false)); router.refresh(); }}>
          <RotateCcw />
          Volver a pendiente
        </Button>
      ) : (
        <Button onClick={async () => { await unwrap(setLiquidationPaidAction(id, true)); router.refresh(); }}>
          <Check />
          Marcar como pagada
        </Button>
      )}
      <Button variant="outline" onClick={() => window.print()}>
        <Printer />
        Imprimir
      </Button>
      <Button variant="outline" className="text-destructive" onClick={() => setConfirming(true)}>
        <Trash2 />
        Eliminar
      </Button>
      <Button variant="outline" asChild>
        <Link href="/dashboard/liquidaciones">
          <ArrowLeft />
          Volver
        </Link>
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta liquidación?</AlertDialogTitle>
            <AlertDialogDescription>
              Ese período queda libre para volver a liquidarlo. Los cobros no cambian.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirming(false);
                await unwrap(deleteLiquidationAction(id));
                router.push("/dashboard/liquidaciones");
              }}
              className="bg-destructive! text-white! hover:bg-destructive/90!"
            >
              <Trash2 />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
