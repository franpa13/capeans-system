"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds, Center, useBounds, useGLTF } from "@react-three/drei";
import {
  LOWER_ARCH,
  UPPER_ARCH,
  cameraFocusFor,
  outwardDirection,
  positionOnArch,
} from "@/features/clinic/lib/odontogram";

export type ToothHistoryEntry = { date: Date; treatment: string };
export type ToothHistory = Record<string, ToothHistoryEntry[]>;

const COLOR_TREATED = "#4ade80";
const COLOR_SELECTED = "#38bdf8";

const MARKER_OFFSET = 0.06;
const MARKER_RADIUS = 0.055;

function MouthModel() {
  const { scene } = useGLTF("/teeth/teeth.glb");
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

/** Zooms the Bounds-managed camera toward the selected tooth, or back to
 * the full-mouth overview when cleared. Must render inside <Bounds>. */
function CameraFocus({ fdi }: { fdi: string | null }) {
  const bounds = useBounds();
  const wasFocused = useRef(false);

  useEffect(() => {
    if (fdi) {
      const focus = cameraFocusFor(fdi);
      if (!focus) return;
      const { target, cameraPosition } = focus;
      bounds.to({
        position: [cameraPosition.x, cameraPosition.y, cameraPosition.z],
        target: [target.x, target.y, target.z],
      });
      wasFocused.current = true;
    } else if (wasFocused.current) {
      bounds.reset();
      wasFocused.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fdi]);

  return null;
}

function ToothMarker({
  position,
  outward,
  isTreated,
  isSelected,
}: {
  position: { x: number; y: number; z: number };
  outward: { x: number; z: number };
  isTreated: boolean;
  isSelected: boolean;
}) {
  if (!isTreated && !isSelected) return null;
  const color = isSelected ? COLOR_SELECTED : COLOR_TREATED;

  return (
    <mesh
      position={[
        position.x + outward.x * MARKER_OFFSET,
        position.y,
        position.z + outward.z * MARKER_OFFSET,
      ]}
    >
      <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
}

/**
 * A read-only view of the mouth: pieces are chosen elsewhere (the "Piezas
 * dentales" field), never by clicking here. Selecting teeth paints them;
 * with exactly one selected, the camera also zooms toward it (with
 * several, the full-mouth overview stays, since there's no single sane
 * target to zoom to). Teeth with consultation history stay marked in
 * green so the whole chart gives an at-a-glance treatment summary.
 */
export function ToothChart3D({
  history = {},
  selectedTeeth = [],
  className = "h-112",
}: {
  history?: ToothHistory;
  selectedTeeth?: string[];
  className?: string;
}) {
  const focusFdi = selectedTeeth.length === 1 ? selectedTeeth[0] : null;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border bg-linear-to-b from-card to-accent/40 ${className}`}
    >
      <Canvas camera={{ position: [0, 0.05, 1], fov: 35 }}>
        <ambientLight intensity={1} />
        <directionalLight position={[2, 3, 2]} intensity={1.3} />
        <directionalLight position={[-2, 1, 1]} intensity={0.4} />

        <Suspense fallback={null}>
          {/* observe keeps the overview correctly fitted as the container's
              size settles — but once a tooth is focused, a later resize
              (e.g. the dialog's own open animation still finishing) would
              re-trigger Bounds' own fit and silently cancel our explicit
              zoom below. Turning it off while focused freezes that out. */}
          <Bounds fit clip observe={!focusFdi} margin={1.3}>
            <MouthModel />
            <CameraFocus fdi={focusFdi} />

            {UPPER_ARCH.map((tooth, i) => (
              <ToothMarker
                key={tooth.fdi}
                position={positionOnArch(i, UPPER_ARCH.length, "upper")}
                outward={outwardDirection(i, UPPER_ARCH.length)}
                isTreated={!!history[tooth.fdi]?.length}
                isSelected={selectedTeeth.includes(tooth.fdi)}
              />
            ))}
            {LOWER_ARCH.map((tooth, i) => (
              <ToothMarker
                key={tooth.fdi}
                position={positionOnArch(i, LOWER_ARCH.length, "lower")}
                outward={outwardDirection(i, LOWER_ARCH.length)}
                isTreated={!!history[tooth.fdi]?.length}
                isSelected={selectedTeeth.includes(tooth.fdi)}
              />
            ))}
          </Bounds>
        </Suspense>

        {/* makeDefault registers these controls where Bounds can see them
            (useThree's `controls` state) — without it, Bounds has no way
            to keep the controls' own target in sync with a camera move it
            animates, so the two fight over the camera position and which
            one "wins" each frame is unpredictable. */}
        <OrbitControls makeDefault enablePan={false} minDistance={0.3} maxDistance={10} />
      </Canvas>

      <span className="pointer-events-none absolute top-1 right-1.5 text-[9px] text-muted-foreground/70">
        Modelo 3D &quot;Teeth&quot; por dewa (Sketchfab, CC BY)
      </span>
    </div>
  );
}
