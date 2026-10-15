/** Turno reminders by WhatsApp. Kept free of UI and Next imports on
 * purpose: today they feed a one-tap wa.me link, and the same message and
 * number are what a future automatic sender (WhatsApp Business API) would
 * use. */

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** A phone as typed into the patient form ("11 3333-4444", "011 15
 * 3333-4444", "+54 9 11 …") in the international format WhatsApp needs
 * for an Argentine mobile: 54 + 9 + area code + number, with the national
 * "0" and the mobile "15" removed. Null when it isn't a full 10-digit
 * national number (e.g. no area code), so the UI can ask to fix it rather
 * than open a chat with the wrong person. */
export function toWhatsAppNumber(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("54")) {
    digits = digits.slice(2);
    if (digits.startsWith("9")) digits = digits.slice(1);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  // Area codes are 2-4 digits; "15" right after one is the old mobile prefix.
  if (digits.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === "15") {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }
  return digits.length === 10 ? `549${digits}` : null;
}

/** "hoy", "mañana" or "el martes 20/10", relative to `now`. */
function dayPhrase(startsAt: Date, now: Date) {
  const days = Math.round(
    (startOfDay(startsAt).getTime() - startOfDay(now).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  return `el ${WEEKDAYS[startsAt.getDay()]} ${pad(startsAt.getDate())}/${pad(startsAt.getMonth() + 1)}`;
}

export function reminderMessage({
  patientName,
  startsAt,
  clinicName,
  now = new Date(),
}: {
  patientName: string;
  startsAt: Date;
  clinicName: string;
  now?: Date;
}): string {
  const firstName = patientName.trim().split(/\s+/)[0];
  const time = `${pad(startsAt.getHours())}:${pad(startsAt.getMinutes())}`;
  return (
    `Hola ${firstName}, te recordamos tu turno ${dayPhrase(startsAt, now)} a las ${time} ` +
    `en ${clinicName}. Si no podés venir, por favor avisanos por acá. ¡Gracias!`
  );
}

export function whatsAppLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
