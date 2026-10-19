import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatients } from "@/features/clinic/data/patients";
import { getConsultations } from "@/features/clinic/data/consultations";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import { getPayments } from "@/features/clinic/data/payments";
import { getSupplies } from "@/features/clinic/data/supplies";
import { parsePaymentStatusParam } from "@/features/clinic/lib/billing";
import { addMonths, parseMonthParam, toMonthParam } from "@/features/clinic/lib/month";
import {
  consultationsXlsx,
  patientsXlsx,
  paymentsXlsx,
  suppliesXlsx,
} from "@/features/excel/lib/exports";
import { xlsxResponse } from "@/features/excel/lib/response";

/** "Descargar Excel" for Pacientes, Consultas, Ingresos and Stock. Takes
 * the same query params as the page it's on, so the file matches what's
 * on screen. (No ".xlsx" in the URL: the proxy skips paths with a dot,
 * and this needs Clerk to know the clinic.) */
export async function GET(request: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("No autorizado", { status: 401 });
  const params = new URL(request.url).searchParams;
  const param = (name: string) => params.get(name) || undefined;
  const today = new Date().toISOString().slice(0, 10);

  switch (kind) {
    case "pacientes": {
      const insurance = await getClinicOptions(clinic.id, "insurance");
      const patients = await getPatients(
        clinic.id,
        { query: param("q"), insurance: param("obra") },
        insurance.map((o) => o.label),
      );
      return xlsxResponse(await patientsXlsx(patients), `pacientes-${today}`);
    }
    case "consultas": {
      const treatments = await getClinicOptions(clinic.id, "treatment");
      const [consultations, patients] = await Promise.all([
        getConsultations(
          clinic.id,
          {
            treatment: param("tratamiento"),
            from: param("desde"),
            to: param("hasta"),
            patientQuery: param("paciente"),
            tooth: param("pieza"),
            paymentStatus: parsePaymentStatusParam(param("cobro")),
          },
          treatments.map((o) => o.label),
        ),
        getPatients(clinic.id),
      ]);
      const names = new Map(patients.map((p) => [p.id, p.name]));
      return xlsxResponse(await consultationsXlsx(consultations, names), `consultas-${today}`);
    }
    case "ingresos": {
      const monthStart = parseMonthParam(param("mes"));
      const payments = await getPayments(clinic.id, { from: monthStart, to: addMonths(monthStart, 1) });
      return xlsxResponse(await paymentsXlsx(payments), `ingresos-${toMonthParam(monthStart)}`);
    }
    case "stock": {
      return xlsxResponse(await suppliesXlsx(await getSupplies(clinic.id)), `stock-${today}`);
    }
    default:
      return new Response("No encontrado", { status: 404 });
  }
}
