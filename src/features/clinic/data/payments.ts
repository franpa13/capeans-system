import { prisma } from "@/lib/prisma";
import type { Payment, PaymentMethod, Prisma } from "@prisma/client";

export type NewPaymentInput = {
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
};

export type PaymentWithConsultation = Payment & {
  consultation: { id: string; treatment: string; patient: { id: string; name: string } | null };
};

function assertValidPaymentAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("El pago tiene que ser un número entero mayor a 0");
  }
}

/** Creates the payment and moves the consulta's cached amountPaid with
 * it, in the caller's transaction. Checks it doesn't go over what's to be
 * charged — the same rule assertValidAmounts applies on create. */
export async function recordPayment(
  tx: Prisma.TransactionClient,
  clinicId: string,
  consultationId: string,
  input: NewPaymentInput,
): Promise<Payment> {
  assertValidPaymentAmount(input.amount);
  const consultation = await tx.consultation.findFirst({ where: { id: consultationId, clinicId } });
  if (!consultation) {
    throw new Error("Consultation not found for this clinic");
  }
  if (consultation.amountCharged == null) {
    throw new Error("Primero cargá el monto a cobrar de la consulta");
  }
  if (consultation.amountPaid + input.amount > consultation.amountCharged) {
    throw new Error("Lo pagado no puede superar el monto a cobrar");
  }
  await tx.consultation.update({
    where: { id: consultationId },
    data: { amountPaid: { increment: input.amount } },
  });
  return tx.payment.create({
    data: { clinicId, consultationId, amount: input.amount, method: input.method, paidAt: input.paidAt },
  });
}

/** A later payment (an installment, or the rest of the balance). */
export async function addPayment(
  clinicId: string,
  consultationId: string,
  input: NewPaymentInput,
): Promise<Payment> {
  return prisma.$transaction((tx) => recordPayment(tx, clinicId, consultationId, input));
}

export async function deletePayment(clinicId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id, clinicId } });
    if (!payment) {
      throw new Error("Payment not found for this clinic");
    }
    await tx.payment.delete({ where: { id } });
    await tx.consultation.update({
      where: { id: payment.consultationId },
      data: { amountPaid: { decrement: payment.amount } },
    });
  });
}

export async function getConsultationPayments(
  clinicId: string,
  consultationId: string,
): Promise<Payment[]> {
  return prisma.payment.findMany({
    where: { clinicId, consultationId },
    orderBy: { paidAt: "asc" },
  });
}

/** The payments received in [from, to), newest first — the Ingresos page. */
export async function getPayments(
  clinicId: string,
  range: { from: Date; to: Date },
): Promise<PaymentWithConsultation[]> {
  return prisma.payment.findMany({
    where: { clinicId, paidAt: { gte: range.from, lt: range.to } },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    include: {
      consultation: {
        select: {
          id: true,
          treatment: true,
          patient: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export type PatientPayment = Payment & { consultation: { id: string; treatment: string } };

/** Every payment of the patient's consultas, latest first — their ficha. */
export async function getPatientPayments(
  clinicId: string,
  patientId: string,
): Promise<PatientPayment[]> {
  return prisma.payment.findMany({
    where: { clinicId, consultation: { patientId } },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    include: { consultation: { select: { id: true, treatment: true } } },
  });
}
