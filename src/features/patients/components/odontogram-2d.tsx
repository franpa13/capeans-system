"use client";

import {
  LOWER_ARCH,
  PRIMARY_LOWER_ARCH,
  PRIMARY_UPPER_ARCH,
  UPPER_ARCH,
  type Tooth,
} from "@/features/clinic/lib/odontogram";
import {
  CONDITIONS,
  isCondition,
  isSurface,
  surfaceSide,
  type FindingStatus,
} from "@/features/clinic/lib/findings";

export type Dentition = "adulto" | "nino";

export type FindingView = {
  id: string;
  tooth: string;
  surface: string | null;
  condition: string;
  status: FindingStatus;
  notes: string | null;
  authorName: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  consultationId: string | null;
};

// The Argentine convention: red is to do, blue is done or already there.
export const STATUS_COLOR: Record<FindingStatus, string> = {
  PENDING: "#dc2626",
  DONE: "#2563eb",
};
const MISSING_COLOR = "#9ca3af";

const SIDE_SHAPES = {
  top: "0,0 40,0 28,12 12,12",
  bottom: "0,40 40,40 28,28 12,28",
  left: "0,0 12,12 12,28 0,40",
  right: "40,0 28,12 28,28 40,40",
} as const;

/** One tooth as the classic five-face box, its faces painted by status.
 * Whole-tooth conditions show as a mark under it (an X for extracción,
 * a ring for a corona, greyed out when missing). */
function ToothBox({
  tooth,
  findings,
  treated,
  selected,
  onSelect,
}: {
  tooth: Tooth;
  findings: FindingView[];
  treated: boolean;
  selected: boolean;
  onSelect: (fdi: string) => void;
}) {
  const fill = (side: keyof typeof SIDE_SHAPES | "center") => {
    const onSide = findings.filter(
      (f) => f.surface && isSurface(f.surface) && surfaceSide(tooth.fdi, f.surface) === side,
    );
    if (onSide.length === 0) return "var(--card)";
    return onSide.some((f) => f.status === "PENDING") ? STATUS_COLOR.PENDING : STATUS_COLOR.DONE;
  };
  const whole = findings.filter((f) => !f.surface && isCondition(f.condition));
  const missing = whole.some((f) => f.condition === "ausente");
  const extraction = whole.find((f) => f.condition === "extraccion");
  const crown = whole.find((f) => f.condition === "corona");
  const marks = whole.filter((f) => !["ausente", "extraccion", "corona"].includes(f.condition));
  const isUpper = tooth.arch === "upper";

  const number = (
    <span className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
      {tooth.fdi}
      {treated && <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />}
    </span>
  );

  return (
    <button
      type="button"
      aria-label={`Pieza ${tooth.fdi}`}
      aria-pressed={selected}
      onClick={() => onSelect(tooth.fdi)}
      className={`flex w-9 shrink-0 flex-col items-center gap-1 rounded-md p-0.5 transition-colors hover:bg-accent sm:w-10 ${
        selected ? "bg-primary/10 ring-2 ring-primary" : ""
      }`}
    >
      {isUpper && number}
      <svg viewBox="-4 -4 48 48" className={`w-full ${missing ? "opacity-40" : ""}`} aria-hidden>
        {(Object.keys(SIDE_SHAPES) as (keyof typeof SIDE_SHAPES)[]).map((side) => (
          <polygon
            key={side}
            points={SIDE_SHAPES[side]}
            fill={fill(side)}
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={1.2}
          />
        ))}
        <rect
          x={12}
          y={12}
          width={16}
          height={16}
          fill={fill("center")}
          stroke="currentColor"
          strokeOpacity={0.45}
          strokeWidth={1.2}
        />
        {crown && (
          <circle cx={20} cy={20} r={22} fill="none" stroke={STATUS_COLOR[crown.status]} strokeWidth={3} />
        )}
        {(missing || extraction) && (
          <g stroke={missing ? MISSING_COLOR : STATUS_COLOR[extraction!.status]} strokeWidth={4} strokeLinecap="round">
            <line x1={-2} y1={-2} x2={42} y2={42} />
            <line x1={42} y1={-2} x2={-2} y2={42} />
          </g>
        )}
      </svg>
      <span className="flex h-3.5 gap-0.5 text-[10px] leading-none font-bold">
        {marks.map((f) => (
          <span key={f.id} style={{ color: STATUS_COLOR[f.status] }}>
            {CONDITIONS[f.condition as keyof typeof CONDITIONS].mark}
          </span>
        ))}
      </span>
      {!isUpper && number}
    </button>
  );
}

function Row({
  teeth,
  findingsByTooth,
  treatedTeeth,
  selected,
  onSelect,
}: {
  teeth: Tooth[];
  findingsByTooth: Map<string, FindingView[]>;
  treatedTeeth: Set<string>;
  selected: string | null;
  onSelect: (fdi: string) => void;
}) {
  const half = teeth.length / 2;
  const box = (tooth: Tooth) => (
    <ToothBox
      key={tooth.fdi}
      tooth={tooth}
      findings={findingsByTooth.get(tooth.fdi) ?? []}
      treated={treatedTeeth.has(tooth.fdi)}
      selected={selected === tooth.fdi}
      onSelect={onSelect}
    />
  );
  return (
    <div className="flex justify-center gap-0.5 sm:gap-1">
      {teeth.slice(0, half).map(box)}
      {/* The midline between the patient's right and left. */}
      <span className="mx-1 w-px self-stretch bg-border sm:mx-2" aria-hidden />
      {teeth.slice(half).map(box)}
    </div>
  );
}

/** The classic odontograma: the upper arch over the lower one, as seen
 * facing the patient, each tooth a tappable five-face box. */
export function Odontogram2D({
  findings,
  treatedTeeth,
  dentition,
  selected,
  onSelect,
}: {
  findings: FindingView[];
  treatedTeeth: Set<string>;
  dentition: Dentition;
  selected: string | null;
  onSelect: (fdi: string) => void;
}) {
  const findingsByTooth = new Map<string, FindingView[]>();
  for (const f of findings) {
    findingsByTooth.set(f.tooth, [...(findingsByTooth.get(f.tooth) ?? []), f]);
  }
  const [upper, lower] =
    dentition === "adulto" ? [UPPER_ARCH, LOWER_ARCH] : [PRIMARY_UPPER_ARCH, PRIMARY_LOWER_ARCH];
  const rowProps = { findingsByTooth, treatedTeeth, selected, onSelect };

  return (
    <div className="overflow-x-auto">
      <div className="mx-auto flex w-fit flex-col gap-4 py-2 text-foreground">
        <p className="text-center text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Maxilar superior · derecha / izquierda del paciente
        </p>
        <Row teeth={upper} {...rowProps} />
        <Row teeth={lower} {...rowProps} />
        <p className="text-center text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Maxilar inferior
        </p>
      </div>
    </div>
  );
}
