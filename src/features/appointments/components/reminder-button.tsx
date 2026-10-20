"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { markReminderSentAction } from "@/features/appointments/actions";
import { unwrap } from "@/lib/action-result";
import {
  reminderMessage,
  toWhatsAppNumber,
  whatsAppLink,
} from "@/features/appointments/lib/reminder";

/** Opens WhatsApp with the turno reminder already written — the dentist
 * only taps "Enviar" — and records that it went out, so the turno shows
 * "Recordatorio enviado" from then on. */
export function ReminderButton({
  appointmentId,
  startsAt,
  reminderSentAt,
  patientName,
  phone,
  clinicName,
  acceptsReminders = true,
}: {
  appointmentId: string;
  startsAt: Date;
  reminderSentAt: Date | null;
  patientName: string;
  phone: string;
  clinicName: string;
  /** The patient's own choice on their ficha ("Acepta recordatorios"). */
  acceptsReminders?: boolean;
}) {
  const router = useRouter();
  // Shown right away: the dialogs that host this button keep their own copy
  // of the turno, so the refreshed reminderSentAt wouldn't reach them.
  const [sentNow, setSentNow] = useState(false);
  const sent = !!reminderSentAt || sentNow;
  const number = toWhatsAppNumber(phone);

  if (!acceptsReminders) {
    return <span className="text-sm text-muted-foreground">No acepta recordatorios</span>;
  }

  if (!number) {
    return (
      <span className="text-sm text-muted-foreground">
        Revisá el teléfono del paciente (falta el código de área)
      </span>
    );
  }

  const href = whatsAppLink(number, reminderMessage({ patientName, startsAt, clinicName }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sent && (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Check className="size-4" />
          Recordatorio enviado
        </span>
      )}
      {/* WhatsApp green, so it reads as "this opens WhatsApp" at a glance:
          solid before sending, outlined once it's already gone out. */}
      <Button
        variant="outline"
        size="sm"
        className={
          sent
            ? "border-[#1DAA61]/60! bg-transparent! text-[#1DAA61]! hover:bg-[#1DAA61]/10!"
            : "border-transparent! bg-[#1DAA61]! text-white! hover:bg-[#178F51]!"
        }
        asChild
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            setSentNow(true);
            // Best effort: WhatsApp opens either way, and a failure here
            // only means the "enviado" mark isn't saved for next time.
            unwrap(markReminderSentAction(appointmentId))
              .then(() => router.refresh())
              .catch(() => {});
          }}
        >
          <MessageCircle />
          {sent ? "Volver a enviar" : "Recordar por WhatsApp"}
        </a>
      </Button>
    </div>
  );
}
