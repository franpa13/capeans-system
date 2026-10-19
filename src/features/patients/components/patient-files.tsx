"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate, toLocalDateString } from "@/features/clinic/lib/format";
import { deletePatientFileAction, uploadPatientFileAction } from "@/features/patients/actions";
import { unwrap } from "@/lib/action-result";

export type PatientFileItem = { id: string; fileName: string; mimeType: string; createdAt: Date };

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

/** The ficha's "Radiografías y fotos": upload (several at once), see them
 * as thumbnails (a PDF as an icon), open one big in a new tab, delete. */
export function PatientFiles({ patientId, files }: { patientId: string; files: PatientFileItem[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<PatientFileItem | null>(null);

  async function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    const failed: string[] = [];
    for (const file of Array.from(list)) {
      const formData = new FormData();
      formData.set("file", file);
      try {
        await unwrap(uploadPatientFileAction(patientId, formData));
      } catch (error) {
        failed.push(`${file.name}: ${error instanceof Error ? error.message : "No se pudo subir"}`);
      }
    }
    setErrors(failed);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await unwrap(deletePatientFileAction(patientId, deleting.id));
      setDeleting(null);
      router.refresh();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "No se pudo borrar"]);
      setDeleting(null);
    }
  }

  return (
    <section aria-labelledby="patient-files-title">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle id="patient-files-title">Radiografías y fotos</CardTitle>
            <CardDescription>Imágenes (JPG, PNG, WEBP, GIF) o PDF de hasta 15 MB.</CardDescription>
          </div>
          <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <ImagePlus />
            {uploading ? "Subiendo..." : "Subir"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            aria-label="Subir radiografías o fotos"
            className="sr-only"
            onChange={(e) => upload(e.target.files)}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {errors.length > 0 && (
            <ul className="space-y-1 text-sm text-destructive">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay radiografías ni fotos.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {files.map((file) => {
                const src = `/api/archivos/${file.id}`;
                return (
                  <li key={file.id} className="group relative overflow-hidden rounded-md border">
                    <a href={src} target="_blank" rel="noopener noreferrer" className="block">
                      {file.mimeType === "application/pdf" ? (
                        <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground">
                          <FileText className="size-8" />
                          <span className="text-xs">PDF</span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- served by our own auth-checked route, not optimizable by next/image
                        <img
                          src={src}
                          alt={file.fileName}
                          loading="lazy"
                          className="aspect-square w-full bg-muted/40 object-cover"
                        />
                      )}
                      <div className="px-2 py-1.5">
                        <p className="truncate text-xs font-medium">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(toLocalDateString(file.createdAt))}
                        </p>
                      </div>
                    </a>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="secondary"
                      aria-label={`Borrar ${file.fileName}`}
                      className="absolute top-1.5 right-1.5"
                      onClick={() => setDeleting(file)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              ¿Borrar &quot;{deleting?.fileName}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive! text-white! hover:bg-destructive/90!"
            >
              <Trash2 />
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
