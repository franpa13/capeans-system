"use client";

import { useMemo, useState } from "react";
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
import { NO_INSURANCE, OTHER_INSURANCE } from "@/features/clinic/lib/insurance";
import { PatientActions } from "@/features/patients/components/patient-actions";

const ALL_INSURANCES = "__all__";
const PAGE_SIZE = 20;

function matchesInsurance(
  patientInsurance: string | null,
  filter: string,
  insuranceOptions: string[],
) {
  if (filter === ALL_INSURANCES) return true;
  if (filter === NO_INSURANCE) {
    return !patientInsurance || patientInsurance === NO_INSURANCE;
  }
  if (filter === OTHER_INSURANCE) {
    return (
      !!patientInsurance &&
      patientInsurance !== NO_INSURANCE &&
      !insuranceOptions.includes(patientInsurance)
    );
  }
  return patientInsurance === filter;
}

export function PatientsView({
  patients,
  insuranceOptions,
}: {
  patients: Patient[];
  insuranceOptions: string[];
}) {
  const [query, setQuery] = useState("");
  const [insurance, setInsurance] = useState(ALL_INSURANCES);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (!matchesInsurance(p.insurance, insurance, insuranceOptions)) return false;
      return true;
    });
  }, [patients, query, insurance, insuranceOptions]);

  const hasFilters = !!query || insurance !== ALL_INSURANCES;
  const { page, setPage, pageCount, pageItems } = usePagination(filtered, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Select value={insurance} onValueChange={setInsurance}>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setInsurance(ALL_INSURANCES);
            }}
          >
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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-5" />
                    {patients.length === 0
                      ? "Todavía no hay pacientes cargados."
                      : "No se encontraron pacientes con esos filtros."}
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
