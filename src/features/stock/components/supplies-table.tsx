"use client";

import { useMemo, useState } from "react";
import { Boxes, Search } from "lucide-react";
import type { Supply } from "@prisma/client";

import { Input } from "@/components/ui/input";
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
import { usePagination } from "@/hooks/use-pagination";
import { formatCurrency } from "@/features/clinic/lib/format";
import { isLowStock } from "@/features/clinic/lib/stock";
import { SupplyActions } from "@/features/stock/components/supply-actions";

const PAGE_SIZE = 10;

const STOCK_STYLES: Record<"out" | "low", string> = {
  out: "text-destructive",
  low: "text-amber-600 dark:text-amber-400",
};

/** "38 ampolla", colored and followed by "Stock bajo"/"Sin stock" in words
 * when it's at or under the threshold — color alone isn't enough. */
function StockLevel({ supply }: { supply: Supply }) {
  const level = isLowStock(supply.quantity, supply.lowStockAt);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className={`font-medium ${level !== "ok" ? STOCK_STYLES[level] : ""}`}>
        {supply.quantity} {supply.unit}
      </span>
      {level !== "ok" && (
        <span className={`text-xs ${STOCK_STYLES[level]}`}>
          {level === "out" ? "Sin stock" : "Stock bajo"}
        </span>
      )}
    </span>
  );
}

function priceLabel(supply: Supply) {
  return supply.price != null ? formatCurrency(supply.price) : "Sin precio";
}

export function SuppliesTable({ supplies }: { supplies: Supply[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? supplies.filter((s) => s.name.toLowerCase().includes(q)) : supplies;
  }, [supplies, query]);
  const { page, setPage, pageCount, pageItems } = usePagination(filtered, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar..."
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border p-8">
          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <Boxes className="size-5" />
            {supplies.length === 0
              ? "Todavía no hay insumos cargados."
              : `Ningún insumo coincide con "${query}".`}
          </div>
        </div>
      ) : (
        <>
          {/* Same as Pacientes: a table from sm up, stacked cards below it
          so Acciones is reachable without scrolling sideways. */}
          <div className="hidden rounded-lg border sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="w-px">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((supply) => (
                  <TableRow key={supply.id}>
                    <TableCell className="font-medium">{supply.name}</TableCell>
                    <TableCell className="text-muted-foreground">{priceLabel(supply)}</TableCell>
                    <TableCell>
                      <StockLevel supply={supply} />
                    </TableCell>
                    <TableCell>
                      <SupplyActions supply={supply} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {pageItems.map((supply) => (
              <Card key={supply.id}>
                <CardContent className="flex items-start justify-between gap-2">
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="font-medium">{supply.name}</span>
                    <span className="text-sm text-muted-foreground">
                      Precio: {priceLabel(supply)}
                    </span>
                    <span className="text-sm">
                      <StockLevel supply={supply} />
                    </span>
                  </div>
                  <SupplyActions supply={supply} />
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
