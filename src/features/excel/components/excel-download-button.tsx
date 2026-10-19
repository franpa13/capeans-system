"use client";

import { useSearchParams } from "next/navigation";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Descargar Excel" — passes the page's own filters (its URL query) on,
 * so the file has exactly what's on screen. */
export function ExcelDownloadButton({ path }: { path: string }) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  return (
    <Button variant="outline" asChild>
      <a href={query ? `${path}?${query}` : path} download>
        <FileDown />
        Descargar Excel
      </a>
    </Button>
  );
}
