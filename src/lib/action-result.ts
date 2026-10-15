import { unstable_rethrow } from "next/navigation";

/** In a production build, Next replaces the message of any error thrown by
 * a server action with a minified React error ("Minified React error #441…"),
 * so a validation message like "Ya hay un turno agendado en ese horario"
 * never reaches the user. Server actions therefore return their failures as
 * values (as Next's error-handling guide recommends) and the client turns
 * them back into an Error with `unwrap`. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const GENERIC_ACTION_ERROR = "Ocurrió un error inesperado. Probá de nuevo.";

/** Server side: runs the action body and returns its outcome.
 *
 * Our own validation messages are thrown as plain `Error`s with text meant
 * for the dentist, so those pass through. Anything else (a Prisma error, a
 * crash in a library) may carry internals and becomes a generic message. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    // redirect()/notFound() work by throwing — let Next handle those.
    unstable_rethrow(error);
    if (error instanceof Error && error.constructor === Error) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: GENERIC_ACTION_ERROR };
  }
}

/** Client side: the action's data, or a thrown Error carrying its message —
 * so existing `try { await … } catch (e) { e.message }` code keeps working. */
export async function unwrap<T>(result: Promise<ActionResult<T>>): Promise<T> {
  const settled = await result;
  if (!settled.ok) throw new Error(settled.error);
  return settled.data;
}
