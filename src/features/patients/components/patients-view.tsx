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
import { Card, CardContent } from "@/components/ui/card";
import { PaginationNavigation } from "@/components/pagination-navigation";
import { ActiveFilterChips, type FilterChip } from "@/components/active-filter-chips";
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

  const chips: FilterChip[] = [
    !!query && {
      key: "q",
      label: `Nombre: ${query}`,
      onRemove: () => setValue("q", ""),
    },
    insurance !== ALL_INSURANCES && {
      key: "obra",
      label: `Obra social: ${insurance}`,
      onRemove: () => setValue("obra", ""),
    },
  ].filter((chip): chip is FilterChip => chip !== false);

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

      <ActiveFilterChips chips={chips} />

      {patients.length === 0 ? (
        <div className="rounded-lg border p-8">
          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <Users className="size-5" />
            {hasFilters
              ? "No se encontraron pacientes con esos filtros."
              : "Todavía no hay pacientes cargados."}
          </div>
        </div>
      ) : (
        <>
          {/* Below sm, a table forces side-scrolling to reach Acciones —
          cards stack every field instead, each full width and readable
          without scrolling sideways. */}
          <div className="hidden rounded-lg border sm:block">
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
                {pageItems.map((patient) => (
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
                      <PatientActions patient={patient} insuranceOptions={insuranceOptions} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {pageItems.map((patient) => (
              <Card key={patient.id}>
                <CardContent className="flex items-start justify-between gap-2">
                  <Link
                    href={`/dashboard/pacientes/${patient.id}`}
                    className="flex flex-1 flex-col gap-0.5"
                  >
                    <span className="font-medium">{patient.name}</span>
                    <span className="text-sm text-muted-foreground">
                      Teléfono: {patient.phone}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Obra social: {patient.insurance ?? "—"}
                    </span>
                  </Link>
                  <PatientActions patient={patient} insuranceOptions={insuranceOptions} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <PaginationNavigation page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
