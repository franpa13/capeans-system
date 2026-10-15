"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, PackagePlus, Pencil, Plus, Trash2, X } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteSupplyAction } from "@/features/stock/actions";
import { unwrap } from "@/lib/action-result";
import { RestockDialog, SupplyFormDialog } from "@/features/stock/components/supply-dialogs";
import type { Supply } from "@prisma/client";

/** The header's "Nuevo insumo" button, same place as "Nuevo paciente". */
export function NewSupplyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Nuevo insumo
      </Button>
      <SupplyFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Per-row "⋯" menu, same pattern as PatientActions. */
export function SupplyActions({ supply }: { supply: Supply }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    try {
      await unwrap(deleteSupplyAction(supply.id));
      setDeleteOpen(false);
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Acciones para ${supply.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              setRestockOpen(true);
            }}
          >
            <PackagePlus />
            Reponer
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              setEditOpen(true);
            }}
          >
            <Pencil />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            <Trash2 />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RestockDialog open={restockOpen} onOpenChange={setRestockOpen} supply={supply} />
      <SupplyFormDialog open={editOpen} onOpenChange={setEditOpen} supply={supply} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              ¿Eliminar &quot;{supply.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si este insumo ya se usó en alguna consulta, no se va
              a poder eliminar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog open so a "can't delete, it's in use"
                // error is shown instead of the dialog just vanishing.
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive! text-white! hover:bg-destructive/90!"
            >
              <Trash2 />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
