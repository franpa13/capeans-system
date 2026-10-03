// FDI two-digit tooth notation (ISO 3950), the standard used in Argentina
// and most of Latin America/Europe — not the US "Universal" 1-32 system.
// Quadrants: 1 = upper right, 2 = upper left, 3 = lower left, 4 = lower right.
// Within a quadrant, teeth are numbered 1 (central incisor) to 8 (third molar,
// "wisdom tooth"), increasing outward from the midline.

export type ToothQuadrant = 1 | 2 | 3 | 4;

export type Tooth = {
  fdi: string;
  quadrant: ToothQuadrant;
  positionInQuadrant: number; // 1..8, 1 = closest to the midline
  arch: "upper" | "lower";
};

function quadrantTeeth(quadrant: ToothQuadrant, arch: "upper" | "lower"): Tooth[] {
  return Array.from({ length: 8 }, (_, i) => {
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
  ...quadrantTeeth(1, "upper").reverse(),
  ...quadrantTeeth(2, "upper"),
];

export const LOWER_ARCH: Tooth[] = [
  ...quadrantTeeth(4, "lower").reverse(),
  ...quadrantTeeth(3, "lower"),
];

export const ALL_TEETH: Tooth[] = [...UPPER_ARCH, ...LOWER_ARCH];

export function isValidToothFdi(value: string): boolean {
  return ALL_TEETH.some((t) => t.fdi === value);
}

export type ToothPosition3D = { x: number; y: number; z: number; rotationY: number };

/**
 * Positions a row of teeth along a horseshoe-shaped arch in the XZ plane,
 * viewed from above: the midline is at x=0 toward +z, the arch opens
 * toward -z. `archY` separates the upper arch from the lower arch.
 */
export function positionOnArch(
  indexInRow: number,
  teethInRow: number,
  archY: number,
): ToothPosition3D {
  // Spread teeth across a half-ellipse, midline tooth at the front (+z).
  const t = (indexInRow + 0.5) / teethInRow; // 0..1 across the row
  const angle = t * Math.PI; // 0..PI
  const radiusX = 2.6;
  const radiusZ = 2.0;
  const x = Math.cos(angle) * radiusX * -1; // left-to-right matches reading order
  const z = Math.sin(angle) * radiusZ - radiusZ + 2.2;
  const rotationY = angle - Math.PI / 2;
  return { x, y: archY, z, rotationY };
}
