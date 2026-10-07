"use client";

import Link from "next/link";
import { Search, Users, X } from "lucide-react";
import type { Patient } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationNavigation } from "@/components/pagination-navigation";
import { usePagination } from "@/hooks/use-pagination";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { NO_INSURANCE, OTHER_INSURANCE } from "@/features/clinic/lib/insurance";
import { PatientActions } from "@/features/patients/components/patient-actions";

const ALL_INSURANCES = "__all__";
const PAGE_SIZE = 10;
const PARAM_KEYS = ["q", "obra"] as const;
const DEBOUNCED_KEYS = ["q"] as const;

/** Filters live in the URL (so they survive a reload and can be shared /
 * bookmarked) and are applied by getPatients in the Server Component above
 * — `patients` here is already the filtered result. Only pagination stays
 * client-side, slicing that already-filtered array. */
export function PatientsView({
  patients,
  insuranceOptions,
}: {
  patients: Patient[];
  insuranceOptions: string[];
}) {
  const { values, setValue, clear } = useUrlFilters(PARAM_KEYS, DEBOUNCED_KEYS);
  const insurance = values.obra || ALL_INSURANCES;
  const query = values.q;

  const hasFilters = !!query || insurance !== ALL_INSURANCES;
  const { page, setPage, pageCount, pageItems } = usePagination(patients, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            className="pl-8"
            value={query}
            onChange={(e) => setValue("q", e.target.value)}
          />
        </div>

        <Select
          value={insurance}
          onValueChange={(v) => setValue("obra", v === ALL_INSURANCES ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_INSURANCES}>Todas las obras sociales</SelectItem>
            <SelectItem value={NO_INSURANCE}>{NO_INSURANCE}</SelectItem>
            {insuranceOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
            <SelectItem value={OTHER_INSURANCE}>{OTHER_INSURANCE}</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <X />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Obra social</TableHead>
              <TableHead className="w-px">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-5" />
                    {hasFilters
                      ? "No se encontraron pacientes con esos filtros."
                      : "Todavía no hay pacientes cargados."}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="p-0">
                    <Link
                      href={`/dashboard/pacientes/${patient.id}`}
                      className="block px-4 py-2.5 font-medium"
                    >
                      {patient.name}
                    </Link>
                  </TableCell>
                  <TableCell>{patient.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {patient.insurance ?? "—"}
                  </TableCell>
                  <TableCell>
                    <PatientActions
                      patient={patient}
                      insuranceOptions={insuranceOptions}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationNavigation page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
