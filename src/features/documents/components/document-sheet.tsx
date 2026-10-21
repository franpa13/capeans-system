import type { Patient } from "@prisma/client";

import { formatDate, toLocalDateString } from "@/features/clinic/lib/format";

/** What every signed document keeps of its professional, as issued. */
export type SignedBy = {
  professionalTitle: string;
  professionalName: string;
  professionalSpecialty: string | null;
  professionalLicense: string;
  professionalSignature: string | null;
};

export type SheetClinic = { name: string; address: string | null; phone: string | null; email: string | null };
export type SheetPatient = Pick<Patient, "name" | "dni" | "birthDate" | "insurance" | "insuranceNumber">;

/** A printed A5 document of the consultorio — a receta, an orden: the
 * letterhead, the patient, the document's own body, and the signature at
 * the foot. Always black on white, whatever the app's theme: it's paper. */
export function DocumentSheet({
  label,
  number,
  date,
  signedBy: p,
  patient,
  clinic,
  extraPatientLine,
  children,
}: {
  /** The article's accessible name, e.g. "Receta". */
  label: string;
  /** e.g. "REC-00000001". */
  number: string;
  date: Date;
  signedBy: SignedBy;
  patient: SheetPatient;
  clinic: SheetClinic;
  /** One more line under the patient (e.g. "Tratamiento: …"). */
  extraPatientLine?: React.ReactNode;
  children: React.ReactNode;
}) {
  const professional = `${p.professionalTitle} ${p.professionalName}`;
  const contact = [clinic.phone && `Tel: ${clinic.phone}`, clinic.email].filter(Boolean).join(" · ");

  return (
    <article
      aria-label={label}
      className="mx-auto flex aspect-148/210 w-full max-w-[148mm] flex-col bg-white p-[9%] font-sans text-[13px] text-neutral-900 shadow-sm print:aspect-auto print:h-[200mm] print:max-w-none print:overflow-hidden print:shadow-none"
    >
      <header className="flex items-start justify-between gap-4 border-b border-neutral-300 pb-4">
        <div className="space-y-0.5">
          <p className="font-serif text-xl font-bold">{clinic.name}</p>
          <p className="font-semibold">{professional}</p>
          {p.professionalSpecialty && <p className="text-xs text-neutral-600 italic">{p.professionalSpecialty}</p>}
          <p className="text-xs">Matrícula: {p.professionalLicense}</p>
          {clinic.address && <p className="text-xs text-neutral-600">{clinic.address}</p>}
          {contact && <p className="text-xs text-neutral-600">{contact}</p>}
        </div>
        <div className="text-right text-xs">
          <p className="text-sm font-semibold tabular-nums">{formatDate(toLocalDateString(date))}</p>
          <p className="text-neutral-600 tabular-nums">{number}</p>
        </div>
      </header>

      <section className="space-y-1 py-4 text-xs">
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          <span>
            <b>Paciente:</b> {patient.name}
          </span>
          {patient.dni && (
            <span>
              <b>DNI:</b> {patient.dni}
            </span>
          )}
          {patient.birthDate && (
            <span>
              <b>Nacimiento:</b> {formatDate(patient.birthDate.toISOString().slice(0, 10))}
            </span>
          )}
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          <span>
            <b>Obra social:</b> {patient.insurance || "Particular"}
          </span>
          {patient.insuranceNumber && (
            <span>
              <b>N° de afiliado:</b> {patient.insuranceNumber}
            </span>
          )}
        </p>
        {extraPatientLine && <p>{extraPatientLine}</p>}
      </section>

      <section className="flex-1 space-y-4">{children}</section>

      <footer className="ml-auto flex w-1/2 flex-col items-center pt-6 text-center text-xs">
        {p.professionalSignature ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL
          <img src={p.professionalSignature} alt={`Firma de ${p.professionalName}`} className="h-16 w-full object-contain" />
        ) : (
          <div className="h-16" />
        )}
        <div className="w-full border-t border-neutral-800 pt-1">
          <p className="font-semibold">{professional}</p>
          {p.professionalSpecialty && <p className="text-neutral-600 italic">{p.professionalSpecialty}</p>}
          <p>Matrícula {p.professionalLicense}</p>
        </div>
      </footer>
    </article>
  );
}
