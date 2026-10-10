"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { OptionCategory } from "@/features/clinic/data/clinic-options";
import {
  createClinicOptionAction,
  deleteClinicOptionAction,
  updateClinicOptionAction,
} from "@/features/settings/actions";

type Option = { id: string; label: string };

export function OptionListManager({
  category,
  title,
  description,
  options,
}: {
  category: OptionCategory;
  title: string;
  description: string;
  options: Option[];
}) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Option | null>(null);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      await createClinicOptionAction(category, newLabel);
      setNewLabel("");
      router.refresh();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "No se pudo agregar");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(option: Option) {
    setEditingId(option.id);
    setEditLabel(option.label);
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editLabel.trim()) return;
    setEditError(null);
    try {
      await updateClinicOptionAction(id, editLabel);
      setEditingId(null);
      router.refresh();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "No se pudo guardar");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteClinicOptionAction(deleteTarget.id);
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Agregar nuevo..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button type="button" onClick={handleAdd} disabled={adding}>
            <Plus />
            Agregar
          </Button>
        </div>
        {addError && <p className="text-sm text-destructive">{addError}</p>}

        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay opciones cargadas.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {options.map((option) => (
              <li
                key={option.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                {editingId === option.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      autoFocus
                      aria-label="Editar valor"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveEdit(option.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Guardar"
                      onClick={() => handleSaveEdit(option.id)}
                    >
                      <Check />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Cancelar"
                      onClick={() => setEditingId(null)}
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm">{option.label}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${option.label}`}
                        onClick={() => startEdit(option)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Eliminar ${option.label}`}
                        onClick={() => setDeleteTarget(option)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {editError && <p className="text-sm text-destructive">{editError}</p>}
      </CardContent>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              ¿Eliminar &quot;{deleteTarget?.label}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Los pacientes o consultas que ya usan este valor no se modifican,
              solo deja de estar disponible para elegir en registros nuevos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive! text-white! hover:bg-destructive/90!"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
