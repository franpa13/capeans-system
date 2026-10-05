// FDI two-digit tooth notation (ISO 3950), the standard used in Argentina
// and most of Latin America/Europe — not the US "Universal" 1-32 system.
// Quadrants: 1 = upper right, 2 = upper left, 3 = lower left, 4 = lower right
// for PERMANENT (adult) teeth; 5/6/7/8 are the same four quadrants again for
// PRIMARY (baby) teeth — see PRIMARY_TEETH below. Within a quadrant, teeth
// are numbered starting at 1 (central incisor), increasing outward from the
// midline: up to 8 (third molar, "wisdom tooth") for permanent teeth, up to
// 5 (second molar — primary dentition has no premolars) for primary teeth.

export type ToothQuadrant = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Tooth = {
  fdi: string;
  quadrant: ToothQuadrant;
  positionInQuadrant: number; // 1..8 (permanent) or 1..5 (primary), 1 = closest to the midline
  arch: "upper" | "lower";
};

function quadrantTeeth(
  quadrant: ToothQuadrant,
  arch: "upper" | "lower",
  teethInQuadrant: number,
): Tooth[] {
  return Array.from({ length: teethInQuadrant }, (_, i) => {
    const positionInQuadrant = i + 1;
    return {
      fdi: `${quadrant}${positionInQuadrant}`,
      quadrant,
      positionInQuadrant,
      arch,
    };
  });
}

// Visual reading order, as a dental chart is conventionally drawn facing the
// patient: upper row left-to-right is quadrant 1 (outward to inward) then
// quadrant 2 (inward to outward); lower row mirrors the same left/right
// sides so each column lines up with the tooth above/below it.
export const UPPER_ARCH: Tooth[] = [
  ...quadrantTeeth(1, "upper", 8).reverse(),
  ...quadrantTeeth(2, "upper", 8),
];

export const LOWER_ARCH: Tooth[] = [
  ...quadrantTeeth(4, "lower", 8).reverse(),
  ...quadrantTeeth(3, "lower", 8),
];

export const ALL_TEETH: Tooth[] = [...UPPER_ARCH, ...LOWER_ARCH];

// Primary (baby) teeth — same reading-order convention as the permanent
// arches above, just five teeth per quadrant instead of eight. Kept as a
// separate set rather than folded into ALL_TEETH: they're a distinct
// clinical concept (a child's consultation may reference these FDI numbers
// instead of the permanent ones), not an extension of the permanent arch.
export const PRIMARY_UPPER_ARCH: Tooth[] = [
  ...quadrantTeeth(5, "upper", 5).reverse(),
  ...quadrantTeeth(6, "upper", 5),
];

export const PRIMARY_LOWER_ARCH: Tooth[] = [
  ...quadrantTeeth(8, "lower", 5).reverse(),
  ...quadrantTeeth(7, "lower", 5),
];

export const PRIMARY_TEETH: Tooth[] = [...PRIMARY_UPPER_ARCH, ...PRIMARY_LOWER_ARCH];

export function isValidToothFdi(value: string): boolean {
  return ALL_TEETH.some((t) => t.fdi === value) || PRIMARY_TEETH.some((t) => t.fdi === value);
}

export type ToothType = "incisor" | "canine" | "premolar" | "molar";

export function toothType(positionInQuadrant: number): ToothType {
  if (positionInQuadrant <= 2) return "incisor";
  if (positionInQuadrant === 3) return "canine";
  if (positionInQuadrant <= 5) return "premolar";
  return "molar";
}

export type ToothPosition3D = { x: number; y: number; z: number };

// The real position of every tooth in "/teeth/teeth.glb", not an
// approximation: each tooth in the model is its own disconnected island of
// geometry (confirmed by flood-filling the mesh's triangles), so these are
// that island's actual vertex centroid, transformed into the same
// coordinate space the viewer renders in (see tooth-chart-3d.tsx's
// <Center>, which re-origins the whole model to its bounding-box center —
// these values already have that offset baked in).
//
// An earlier version of this file approximated the arch as a half-ellipse
// (even angular spacing, fixed radii) instead of using the real mesh. That
// was close enough for the front teeth, where the real jaw and the ellipse
// roughly agree, but wrong for the back teeth: a real jaw curves back in
// behind its widest point, while the ellipse keeps curving forward, so the
// approximated position for a wisdom tooth could land a noticeable
// distance from — even in front of vs. behind — where that tooth actually
// is. Index order matches each arch's FDI reading order (UPPER_ARCH /
// LOWER_ARCH above): index 0 is the FIRST element of that array.
const UPPER_TOOTH_POSITIONS: ToothPosition3D[] = [
  { x: -0.9431, y: 0.1858, z: -0.5261 },
  { x: -0.9167, y: 0.214, z: -0.1216 },
  { x: -0.8453, y: 0.2405, z: 0.2319 },
  { x: -0.7631, y: 0.2787, z: 0.5061 },
  { x: -0.6814, y: 0.2945, z: 0.7037 },
  { x: -0.5661, y: 0.3358, z: 0.8892 },
  { x: -0.3926, y: 0.3224, z: 1.0474 },
  { x: -0.1384, y: 0.3294, z: 1.1204 },
  { x: 0.1506, y: 0.3294, z: 1.1193 },
  { x: 0.4043, y: 0.3224, z: 1.0444 },
  { x: 0.5767, y: 0.3358, z: 0.885 },
  { x: 0.6905, y: 0.2945, z: 0.6986 },
  { x: 0.7707, y: 0.2787, z: 0.5004 },
  { x: 0.8512, y: 0.2404, z: 0.2244 },
  { x: 0.9197, y: 0.2139, z: -0.1297 },
  { x: 0.943, y: 0.1857, z: -0.5344 },
];

const LOWER_TOOTH_POSITIONS: ToothPosition3D[] = [
  { x: -0.9056, y: 0.0203, z: -0.4577 },
  { x: -0.8838, y: -0.0718, z: -0.0536 },
  { x: -0.8169, y: -0.1575, z: 0.3076 },
  { x: -0.7265, y: -0.2344, z: 0.5861 },
  { x: -0.6152, y: -0.2768, z: 0.7788 },
  { x: -0.498, y: -0.343, z: 0.939 },
  { x: -0.3248, y: -0.3701, z: 1.0707 },
  { x: -0.107, y: -0.3786, z: 1.1205 },
  { x: 0.116, y: -0.3785, z: 1.1199 },
  { x: 0.3334, y: -0.3698, z: 1.0689 },
  { x: 0.5059, y: -0.3426, z: 0.9362 },
  { x: 0.6222, y: -0.2763, z: 0.7753 },
  { x: 0.7323, y: -0.2338, z: 0.582 },
  { x: 0.8214, y: -0.1566, z: 0.3019 },
  { x: 0.8861, y: -0.0708, z: -0.0598 },
  { x: 0.9055, y: 0.0214, z: -0.4641 },
];

function toothPositions(arch: "upper" | "lower"): ToothPosition3D[] {
  return arch === "upper" ? UPPER_TOOTH_POSITIONS : LOWER_TOOTH_POSITIONS;
}

// The arch's own center in the XZ plane — the average of its 16 real tooth
// positions — used as the origin outwardDirection measures "away from the
// mouth's middle" relative to, so it's accurate for the real (non-elliptical)
// curve instead of assuming a shape.
function archCenterXZ(arch: "upper" | "lower"): { x: number; z: number } {
  const positions = toothPositions(arch);
  const sum = positions.reduce(
    (acc, p) => ({ x: acc.x + p.x, z: acc.z + p.z }),
    { x: 0, z: 0 },
  );
  return { x: sum.x / positions.length, z: sum.z / positions.length };
}

export type Direction2D = { x: number; z: number };

/**
 * The outward-facing unit direction (in the XZ plane) for a tooth at this
 * row index — the real direction from the arch's own center (see
 * archCenterXZ) to that tooth's real position, so it follows the actual
 * curve of the jaw instead of assuming a smooth ellipse. Used to pull the
 * camera back to face a chosen tooth (cameraFocusFor) and to nudge a
 * visual marker toward the viewer instead of into the tooth behind it
 * (ToothMarker in tooth-chart-3d.tsx).
 */
export function outwardDirection(indexInRow: number, arch: "upper" | "lower"): Direction2D {
  const position = toothPositions(arch)[indexInRow];
  const center = archCenterXZ(arch);
  const dx = position.x - center.x;
  const dz = position.z - center.z;
  const length = Math.hypot(dx, dz) || 1;
  return { x: dx / length, z: dz / length };
}

/** Each tooth's real position in "/teeth/teeth.glb" (see
 * UPPER_TOOTH_POSITIONS / LOWER_TOOTH_POSITIONS). The teethInRow parameter
 * is unused — every arch has exactly 16 real teeth — and kept only so
 * callers don't need special-casing versus other row-indexed helpers. */
export function positionOnArch(
  indexInRow: number,
  _teethInRow: number,
  arch: "upper" | "lower",
): ToothPosition3D {
  return toothPositions(arch)[indexInRow];
}

/** The 3D position of a tooth by its FDI number, or null if invalid. */
export function findToothPosition(fdi: string): ToothPosition3D | null {
  const upperIndex = UPPER_ARCH.findIndex((t) => t.fdi === fdi);
  if (upperIndex !== -1) return positionOnArch(upperIndex, UPPER_ARCH.length, "upper");

  const lowerIndex = LOWER_ARCH.findIndex((t) => t.fdi === fdi);
  if (lowerIndex !== -1) return positionOnArch(lowerIndex, LOWER_ARCH.length, "lower");

  return null;
}

export type CameraFocus = { target: ToothPosition3D; cameraPosition: ToothPosition3D };

/**
 * Where to put the camera to look at a given tooth from "in front of" it —
 * not from the chart's single overview direction (+z), which only faces
 * the front teeth correctly. outwardDirection (the real direction from the
 * arch's own center to this tooth) doubles as the direction to pull the
 * camera back along, so it works the same for a front tooth or a back one.
 */
export function cameraFocusFor(fdi: string): CameraFocus | null {
  for (const [arch, teeth] of [
    ["upper", UPPER_ARCH],
    ["lower", LOWER_ARCH],
  ] as const) {
    const index = teeth.findIndex((t) => t.fdi === fdi);
    if (index === -1) continue;

    const { x, y, z } = positionOnArch(index, teeth.length, arch);
    const { x: outwardX, z: outwardZ } = outwardDirection(index, arch);
    const distance = 0.55;

    return {
      target: { x, y, z },
      cameraPosition: {
        x: x + outwardX * distance,
        y: y * 0.3 + 0.25,
        z: z + outwardZ * distance,
      },
    };
  }
  return null;
}
