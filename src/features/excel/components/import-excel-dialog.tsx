"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileDown, FileUp, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { importExcelAction } from "@/features/excel/actions";
import { unwrap } from "@/lib/action-result";
import type { ImportResult } from "@/features/clinic/data/imports";
import type { TemplateKind } from "@/features/excel/lib/exports";

const WORDS: Record<TemplateKind, { one: string; many: string; title: string }> = {
  pacientes: { one: "paciente", many: "pacientes", title: "Importar pacientes" },
  insumos: { one: "insumo", many: "insumos", title: "Importar insumos" },
  tratamientos: { one: "tratamiento", many: "tratamientos", title: "Importar tratamientos" },
};

function count(n: number, kind: TemplateKind) {
  return `${n} ${n === 1 ? WORDS[kind].one : WORDS[kind].many}`;
}

/** "Importar Excel": download the template, fill it in, pick the file. The
 * result says what was loaded, what already existed, and which rows had a
 * problem (by row number, as Excel shows them). */
export function ImportExcelDialog({ kind }: { kind: TemplateKind }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setFile(null);
    setError(null);
    setResult(null);
  }

  async function handleImport() {
    if (!file) return setError("Elegí un archivo de Excel");
    setImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      setResult(await unwrap(importExcelAction(kind, formData)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileUp />
        Importar Excel
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{WORDS[kind].title}</DialogTitle>
          <DialogDescription>
            1. Descargá la plantilla y completala, una fila por {WORDS[kind].one}. 2. Elegí el
            archivo y tocá Importar. Lo que ya está cargado no se duplica.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Check className="size-4 text-primary" />
              {result.created === 1 ? "Se cargó" : "Se cargaron"} {count(result.created, kind)}
              {result.updated > 0 && ` y se actualizó el precio de ${count(result.updated, kind)}`}.
            </p>
            {result.skipped.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium">Ya existían ({result.skipped.length}):</p>
                <ul className="list-inside list-disc text-muted-foreground">
                  {result.skipped.map((s) => (
                    <li key={s.row}>
                      Fila {s.row}: {s.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-destructive">
                  No se cargaron por un error ({result.errors.length}):
                </p>
                <ul className="list-inside list-disc text-destructive">
                  {result.errors.map((e) => (
                    <li key={e.row}>
                      Fila {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground">
                  Corregí esas filas en el Excel y volvé a importarlo: lo ya cargado no se repite.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Button variant="secondary" asChild>
              <a href={`/api/excel/plantilla/${kind}`} download>
                <FileDown />
                Descargar plantilla
              </a>
            </Button>
            <div className="space-y-2">
              <Label htmlFor={`import-${kind}`}>Archivo de Excel (.xlsx)</Label>
              <Input
                id={`import-${kind}`}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <DialogClose asChild>
              <Button>Listo</Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button disabled={importing} onClick={handleImport}>
                <Upload />
                {importing ? "Importando..." : "Importar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
