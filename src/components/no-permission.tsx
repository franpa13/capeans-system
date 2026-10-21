import { Lock } from "lucide-react";

/** Shown instead of a page the signed-in person's role can't see. */
export function NoPermission({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
      <Lock className="size-6" />
      <p className="font-medium text-foreground">No tenés acceso a {what}.</p>
      <p className="text-sm">Si lo necesitás, pedíselo al administrador del consultorio.</p>
    </div>
  );
}
