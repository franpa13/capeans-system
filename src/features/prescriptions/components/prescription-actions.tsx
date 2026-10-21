"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle, Printer, Trash2, X } from "lucide-react";

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
import { deletePrescriptionAction } from "@/features/patients/actions";
import { unwrap } from "@/lib/action-result";

/** The receta page's buttons: print, send by WhatsApp, delete, back. */
export function PrescriptionActions({
  patientId,
  prescriptionId,
  whatsAppHref,
}: {
  patientId: string;
  prescriptionId: string;
  /** Null when the patient's phone isn't a full mobile number. */
  whatsAppHref: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const fichaHref = `/dashboard/pacientes/${patientId}?seccion=recetas`;

  async function remove() {
    setConfirming(false);
    await unwrap(deletePrescriptionAction(patientId, prescriptionId));
    router.push(fichaHref);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild>
        <a href={`/imprimir/receta/${prescriptionId}`} target="_blank" rel="noreferrer">
          <Printer />
          Imprimir / PDF
        </a>
      </Button>
      {whatsAppHref && (
        <Button asChild className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
          <a href={whatsAppHref} target="_blank" rel="noreferrer">
            <MessageCircle />
            Enviar por WhatsApp
          </a>
        </Button>
      )}
      <Button variant="outline" className="text-destructive" onClick={() => setConfirming(true)}>
        <Trash2 />
        Eliminar
      </Button>
      <Button variant="outline" asChild>
        <Link href={fichaHref}>
          <ArrowLeft />
          Volver
        </Link>
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta receta?</AlertDialogTitle>
            <AlertDialogDescription>Ya no va a aparecer en la ficha del paciente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive! text-white! hover:bg-destructive/90!">
              <Trash2 />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
