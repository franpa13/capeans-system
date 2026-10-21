import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, toLocalDateString } from "@/features/clinic/lib/format";
import type { LiquidationLine } from "@/features/clinic/lib/liquidations";

const SOURCE: Record<LiquidationLine["percentSource"], string> = {
  professional: "del profesional",
  treatment: "del tratamiento",
  none: "sin % configurado",
};

/** Each consulta of a liquidación: what was collected for it in the
 * period, the % applied (and where it came from), and the commission. */
export function LiquidationLines({
  lines,
  totalCollected,
  totalCommission,
}: {
  lines: LiquidationLine[];
  totalCollected: number;
  totalCommission: number;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Paciente</TableHead>
          <TableHead>Tratamiento</TableHead>
          <TableHead className="text-right">Cobrado</TableHead>
          <TableHead className="text-right">%</TableHead>
          <TableHead className="text-right">Comisión</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => (
          <TableRow key={l.consultationId}>
            <TableCell className="tabular-nums">{formatDate(toLocalDateString(new Date(l.date)))}</TableCell>
            <TableCell>{l.patientName}</TableCell>
            <TableCell>{l.treatment}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(l.collected)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {l.percent}%
              <span className="block text-xs text-muted-foreground">{SOURCE[l.percentSource]}</span>
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">{formatCurrency(l.commission)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3} className="font-semibold">
            Total
          </TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(totalCollected)}</TableCell>
          <TableCell />
          <TableCell className="text-right text-base font-bold tabular-nums">{formatCurrency(totalCommission)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
