"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDate, formatTime, toLocalDateString } from "@/features/clinic/lib/format";
import { addPatientNoteAction, deletePatientNoteAction } from "@/features/patients/actions";
import { unwrap } from "@/lib/action-result";

export type PatientNoteItem = {
  id: string;
  text: string;
  authorName: string | null;
  createdAt: Date;
};

/** Resumen's "Observaciones": dated notes on the patient, newest first,
 * each signed by whoever wrote it. */
export function PatientNotes({ patientId, notes }: { patientId: string; notes: PatientNoteItem[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PatientNoteItem | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await unwrap(addPatientNoteAction(patientId, text));
      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la observación");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    // Close first, so a slow delete can't close a dialog opened meanwhile.
    const target = deleting;
    setDeleting(null);
    await unwrap(deletePatientNoteAction(patientId, target.id));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Observaciones
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary tabular-nums">
            {notes.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {notes.length > 0 && (
          <ul aria-label="Observaciones" className="flex flex-col gap-2">
            {notes.map((note) => (
              <li key={note.id} className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium whitespace-pre-wrap">{note.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(toLocalDateString(note.createdAt))} {formatTime(note.createdAt)}
                    {note.authorName && ` · ${note.authorName}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  aria-label={`Borrar la observación "${note.text.slice(0, 40)}"`}
                  onClick={() => setDeleting(note)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Textarea
            aria-label="Nueva observación"
            placeholder="Escribí una observación sobre este paciente..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-10"
          />
          <Button type="submit" disabled={saving || !text.trim()}>
            <Plus />
            {saving ? "Agregando..." : "Agregar"}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              ¿Borrar esta observación?
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap">
              {deleting?.text}
            </AlertDialogDescription>
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
    </Card>
  );
}
