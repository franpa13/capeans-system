"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailPlus, Send, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type MemberRole } from "@/features/clinic/lib/permissions";
import {
  cancelInvitationAction,
  inviteMemberAction,
  removeMemberAction,
  setMemberProfessionalAction,
  setMemberRoleAction,
} from "@/features/settings/actions";
import { professionalLabel, useProfessionals } from "@/features/clinic/components/permissions-provider";
import { unwrap } from "@/lib/action-result";

type Member = { id: string; name: string; email: string; role: MemberRole; professionalId: string | null };

const NO_PROFILE = "__none__";
type Invitation = { id: string; email: string; role: MemberRole };

function RoleSelect({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  label: string;
  value: MemberRole;
  onChange: (role: MemberRole) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as MemberRole)} disabled={disabled}>
      <SelectTrigger id={id} aria-label={label} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Configuración › Equipo: who works in the consultorio and what each one
 * can do — invite by email with a role, change roles, take people off. */
export function TeamManager({
  members,
  invitations,
  meId,
}: {
  members: Member[];
  invitations: Invitation[];
  /** The signed-in administrador, who can't take themselves off. */
  meId: string;
}) {
  const router = useRouter();
  const professionals = useProfessionals();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("DENTIST");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setNotice(null);
    await run(async () => {
      await unwrap(inviteMemberAction({ email, role }));
      setNotice(`Le enviamos la invitación a ${email.trim()}.`);
      setEmail("");
    });
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Invitar al equipo</CardTitle>
          <CardDescription>
            Le llega un email para entrar al consultorio. Cuando entra, ya tiene el rol que elegiste.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={invite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="Ej: recepcion@consultorio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inviteRole">Rol</Label>
              <RoleSelect id="inviteRole" label="Rol" value={role} onChange={setRole} />
            </div>
            <Button type="submit" disabled={sending || !email.trim()}>
              <Send />
              {sending ? "Enviando..." : "Invitar"}
            </Button>
          </form>
          <ul className="grid gap-2 text-sm sm:grid-cols-3">
            {ROLES.map((r) => (
              <li key={r} className="rounded-md border bg-muted/40 px-3 py-2">
                <p className="font-medium">{ROLE_LABELS[r]}</p>
                <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
              </li>
            ))}
          </ul>
          {notice && <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipo</CardTitle>
          <CardDescription>
            Quiénes usan el sistema. A cada odontólogo vinculalo con su perfil profesional: sus turnos,
            consultas y recetas salen a su nombre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul aria-label="Equipo" className="divide-y rounded-md border">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {m.name}
                    {m.id === meId && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Vos</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{m.email}</p>
                </div>
                {professionals.length > 0 && m.role !== "RECEPTION" && (
                  <Select
                    value={m.professionalId ?? NO_PROFILE}
                    onValueChange={(v) =>
                      run(() => unwrap(setMemberProfessionalAction(m.id, v === NO_PROFILE ? null : v)))
                    }
                  >
                    <SelectTrigger aria-label={`Perfil profesional de ${m.name}`} className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROFILE}>Sin perfil profesional</SelectItem>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {professionalLabel(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <RoleSelect
                  label={`Rol de ${m.name}`}
                  value={m.role}
                  onChange={(next) => run(() => unwrap(setMemberRoleAction(m.id, next)))}
                />
                {m.id !== meId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={`Quitar a ${m.name}`}
                    onClick={() => setRemoving(m)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {invitations.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-sm font-semibold">Invitaciones pendientes</p>
              <ul aria-label="Invitaciones pendientes" className="divide-y rounded-md border">
                {invitations.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <MailPlus className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">{i.email}</span>
                    <span className="text-muted-foreground">{ROLE_LABELS[i.role]}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Cancelar la invitación a ${i.email}`}
                      onClick={() => run(() => unwrap(cancelInvitationAction(i.id)))}
                    >
                      <X />
                      Cancelar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {removing?.name} del equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no va a poder entrar al consultorio. Lo que cargó queda guardado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = removing!;
                setRemoving(null);
                run(() => unwrap(removeMemberAction(target.id)));
              }}
              className="bg-destructive! text-white! hover:bg-destructive/90!"
            >
              <Trash2 />
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
