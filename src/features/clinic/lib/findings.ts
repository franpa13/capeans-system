// What the dentist finds in the mouth (hallazgos), charted on the
// odontograma: per surface (caries, restauración…) or per tooth (corona,
// ausente…). Following the Argentine convention, red is what's left to do
// (PENDING) and blue what's already done or was there (DONE).

export type Surface = "V" | "M" | "O" | "D" | "L";
export type FindingStatus = "PENDING" | "DONE";

/** In the order the tooth-box draws them: lips, sides, chewing face, tongue. */
export const SURFACES: Surface[] = ["V", "M", "O", "D", "L"];

export type FindingCondition =
  | "caries"
  | "restauracion"
  | "sellador"
  | "corona"
  | "endodoncia"
  | "extraccion"
  | "implante"
  | "protesis"
  | "ausente";

export const CONDITIONS: Record<
  FindingCondition,
  {
    label: string;
    scope: "surface" | "tooth";
    defaultStatus: FindingStatus;
    /** Drawn under a tooth for whole-tooth conditions. */
    mark?: string;
  }
> = {
  caries: { label: "Caries", scope: "surface", defaultStatus: "PENDING" },
  restauracion: { label: "Restauración", scope: "surface", defaultStatus: "DONE" },
  sellador: { label: "Sellador", scope: "surface", defaultStatus: "DONE" },
  // Drawn as a ring around the tooth rather than a mark.
  corona: { label: "Corona", scope: "tooth", defaultStatus: "DONE" },
  endodoncia: { label: "Endodoncia", scope: "tooth", defaultStatus: "DONE", mark: "TC" },
  extraccion: { label: "Extracción indicada", scope: "tooth", defaultStatus: "PENDING", mark: "X" },
  implante: { label: "Implante", scope: "tooth", defaultStatus: "DONE", mark: "IM" },
  protesis: { label: "Prótesis", scope: "tooth", defaultStatus: "DONE", mark: "PR" },
  ausente: { label: "Ausente", scope: "tooth", defaultStatus: "DONE", mark: "—" },
};

export const CONDITION_KEYS = Object.keys(CONDITIONS) as FindingCondition[];

export function isCondition(value: string): value is FindingCondition {
  return value in CONDITIONS;
}

export function isSurface(value: string): value is Surface {
  return (SURFACES as string[]).includes(value);
}

export function isSurfaceCondition(condition: FindingCondition): boolean {
  return CONDITIONS[condition].scope === "surface";
}

const quadrantOf = (fdi: string) => Number(fdi[0]);
const positionOf = (fdi: string) => Number(fdi[1]);
const isUpper = (fdi: string) => [1, 2, 5, 6].includes(quadrantOf(fdi));
/** Quadrants drawn on the chart's left half (the patient's right side). */
const isChartLeft = (fdi: string) => [1, 4, 5, 8].includes(quadrantOf(fdi));

/** How a surface is called on this tooth: the chewing face is "incisal"
 * on incisors and canines, the inner face "palatina" on upper teeth. */
export function surfaceLabel(fdi: string, surface: Surface): string {
  switch (surface) {
    case "O":
      return positionOf(fdi) <= 3 ? "Incisal" : "Oclusal";
    case "L":
      return isUpper(fdi) ? "Palatina" : "Lingual";
    case "V":
      return "Vestibular";
    case "M":
      return "Mesial";
    case "D":
      return "Distal";
  }
}

/** Where a surface sits in the tooth-box, as the chart faces the patient:
 * vestibular towards the lips (up for upper teeth), mesial towards the
 * midline. */
export function surfaceSide(
  fdi: string,
  surface: Surface,
): "top" | "bottom" | "left" | "right" | "center" {
  switch (surface) {
    case "O":
      return "center";
    case "V":
      return isUpper(fdi) ? "top" : "bottom";
    case "L":
      return isUpper(fdi) ? "bottom" : "top";
    case "M":
      return isChartLeft(fdi) ? "right" : "left";
    case "D":
      return isChartLeft(fdi) ? "left" : "right";
  }
}

/** "Caries · Oclusal" — what a hallazgo says about its tooth. */
export function findingLabel(f: { tooth: string; surface: string | null; condition: string }): string {
  const condition = isCondition(f.condition) ? CONDITIONS[f.condition].label : f.condition;
  return f.surface && isSurface(f.surface) ? `${condition} · ${surfaceLabel(f.tooth, f.surface)}` : condition;
}

/** One color for a whole tooth (the 3D model can't paint faces): missing
 * beats everything, then anything still to do, then all done. */
export function toothStatus(
  findings: { condition: string; status: FindingStatus }[],
): FindingStatus | "MISSING" | null {
  if (findings.length === 0) return null;
  if (findings.some((f) => f.condition === "ausente")) return "MISSING";
  return findings.some((f) => f.status === "PENDING") ? "PENDING" : "DONE";
}

type Countable = { tooth: string; condition: string; status: FindingStatus };

/** The odontograma's counters. A missing tooth isn't "done" work. */
export function findingCounts(findings: Countable[]) {
  const work = findings.filter((f) => f.condition !== "ausente");
  return {
    pending: work.filter((f) => f.status === "PENDING").length,
    done: work.filter((f) => f.status === "DONE").length,
    missingTeeth: new Set(findings.filter((f) => f.condition === "ausente").map((f) => f.tooth)).size,
  };
}
