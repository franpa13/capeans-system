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

export type ToothType = "incisor" | "canine" | "premolar" | "molar";

export function toothType(positionInQuadrant: number): ToothType {
  if (positionInQuadrant <= 2) return "incisor";
  if (positionInQuadrant === 3) return "canine";
  if (positionInQuadrant <= 5) return "premolar";
  return "molar";
}

export type ToothPosition3D = { x: number; y: number; z: number };

// Calibrated against the real "/teeth/teeth.glb" model (not guessed): each
// constant below comes from raycasting real clicks onto the rendered mesh,
// centered the same way the viewer centers it (see tooth-chart-3d.tsx),
// then fitting the same half-ellipse-in-XZ shape used before — this model's
// teeth really do sit on one, it just has different radii than a guess
// would. radiusZ/zOffset give the front-to-back curve (center teeth project
// furthest toward the camera); yEdge/yCenter capture the mild vertical bow
// across the row.
const ARCH_CALIBRATION = {
  upper: { radiusX: 0.88, radiusZ: 0.65, zOffset: 0.5, yEdge: 0.45, yCenter: 0.42 },
  lower: { radiusX: 0.84, radiusZ: 0.56, zOffset: 0.57, yEdge: -0.33, yCenter: -0.26 },
} as const;

/**
 * Positions a row of teeth along the real model's arch curve (see
 * ARCH_CALIBRATION). The midline is at x=0 toward +z; left-to-right
 * matches each arch's FDI reading order (UPPER_ARCH / LOWER_ARCH above).
 */
export function positionOnArch(
  indexInRow: number,
  teethInRow: number,
  arch: "upper" | "lower",
): ToothPosition3D {
  const { radiusX, radiusZ, zOffset, yEdge, yCenter } = ARCH_CALIBRATION[arch];
  const { x, z, angle } = archXZ(indexInRow, teethInRow, radiusX, radiusZ, zOffset);
  const y = yEdge + (yCenter - yEdge) * Math.sin(angle);
  return { x, y, z };
}

function archXZ(
  indexInRow: number,
  teethInRow: number,
  radiusX: number,
  radiusZ: number,
  zOffset: number,
) {
  const t = (indexInRow + 0.5) / teethInRow; // 0..1 across the row
  const angle = t * Math.PI; // 0..PI
  return { x: -Math.cos(angle) * radiusX, z: Math.sin(angle) * radiusZ + zOffset, angle };
}

/** The 3D position of a tooth by its FDI number, or null if invalid. */
export function findToothPosition(fdi: string): ToothPosition3D | null {
  const upperIndex = UPPER_ARCH.findIndex((t) => t.fdi === fdi);
  if (upperIndex !== -1) return positionOnArch(upperIndex, UPPER_ARCH.length, "upper");

  const lowerIndex = LOWER_ARCH.findIndex((t) => t.fdi === fdi);
  if (lowerIndex !== -1) return positionOnArch(lowerIndex, LOWER_ARCH.length, "lower");

  return null;
}

/**
 * The tooth whose calibrated position is closest to a given 3D point —
 * used to resolve a raycast hit on the real model's visible mesh to a
 * tooth, since the invisible per-tooth hit-spheres only reliably line up
 * with the real geometry from the default front-on camera angle. Any
 * click on the model itself, from any orbit angle, lands close to its
 * tooth's calibrated position, so nearest-neighbor is robust even where
 * the calibration isn't pixel-perfect.
 */
export function nearestTooth(point: ToothPosition3D): string {
  let bestFdi = ALL_TEETH[0].fdi;
  let bestDistance = Infinity;

  for (const tooth of ALL_TEETH) {
    const pos = findToothPosition(tooth.fdi)!;
    const dx = pos.x - point.x;
    const dy = pos.y - point.y;
    const dz = pos.z - point.z;
    const distance = dx * dx + dy * dy + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestFdi = tooth.fdi;
    }
  }

  return bestFdi;
}

export type CameraFocus = { target: ToothPosition3D; cameraPosition: ToothPosition3D };

/**
 * Where to put the camera to look at a given tooth from "in front of" it —
 * not from the chart's single overview direction (+z), which only faces
 * the front teeth correctly. The arch is close enough to circular that the
 * position vector itself (relative to the arch's center) already points
 * outward at every tooth, front or back, so it doubles as the direction to
 * pull the camera back along.
 */
export function cameraFocusFor(fdi: string): CameraFocus | null {
  for (const [arch, teeth] of [
    ["upper", UPPER_ARCH],
    ["lower", LOWER_ARCH],
  ] as const) {
    const index = teeth.findIndex((t) => t.fdi === fdi);
    if (index === -1) continue;

    const { radiusX, radiusZ, zOffset, yEdge, yCenter } = ARCH_CALIBRATION[arch];
    const { x, z, angle } = archXZ(index, teeth.length, radiusX, radiusZ, zOffset);
    const y = yEdge + (yCenter - yEdge) * Math.sin(angle);
    const outwardX = -Math.cos(angle);
    const outwardZ = Math.sin(angle);
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
