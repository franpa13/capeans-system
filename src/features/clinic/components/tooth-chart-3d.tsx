"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds, Center, useBounds, useGLTF } from "@react-three/drei";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LOWER_ARCH,
  UPPER_ARCH,
  cameraFocusFor,
  positionOnArch,
  type Tooth,
} from "@/features/clinic/lib/odontogram";

export type ToothHistoryEntry = { date: Date; treatment: string };
export type ToothHistory = Record<string, ToothHistoryEntry[]>;

const COLOR_TREATED = "#4ade80";
const COLOR_HIGHLIGHT = "#38bdf8";
const COLOR_HOVER = "#7dd3fc";

const HIT_RADIUS = 0.1;
const MARKER_RADIUS = 0.055;

function MouthModel() {
  const { scene } = useGLTF("/teeth/teeth.glb");
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

/** Zooms the Bounds-managed camera toward a tooth, or back to the
 * full-mouth overview when cleared. Must render inside <Bounds>. */
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

function ToothHitTarget({
  tooth,
  position,
  isTreated,
  isFocused,
  onFocus,
}: {
  tooth: Tooth;
  position: { x: number; y: number; z: number };
  isTreated: boolean;
  isFocused: boolean;
  onFocus: (fdi: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const highlighted = isFocused || hovered;
  const markerColor = isFocused ? COLOR_HIGHLIGHT : hovered ? COLOR_HOVER : COLOR_TREATED;

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          onFocus(tooth.fdi);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[HIT_RADIUS, 10, 10]} />
      </mesh>
      {(highlighted || isTreated) && (
        <mesh position={[0, 0, HIT_RADIUS * 0.6]}>
          <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
          <meshStandardMaterial
            color={markerColor}
            emissive={markerColor}
            emissiveIntensity={0.5}
          />
        </mesh>
      )}
    </group>
  );
}

function ToothInfoPanel({
  fdi,
  history,
  onConfirm,
  onClose,
}: {
  fdi: string;
  history: ToothHistoryEntry[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-x-2 bottom-2 rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Pieza {fdi}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {history.length > 0 ? (
        <ul className="mt-1.5 max-h-20 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
          {history.map((entry, i) => (
            <li key={i}>
              {entry.date.toLocaleDateString("es-AR")} — {entry.treatment}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Sin consultas registradas en esta pieza.
        </p>
      )}
      <Button type="button" size="sm" className="mt-2 w-full" onClick={onConfirm}>
        Usar esta pieza
      </Button>
    </div>
  );
}

export function ToothChart3D({
  history = {},
  selectedTooth,
  onToothClick,
  className = "h-112",
}: {
  history?: ToothHistory;
  selectedTooth?: string;
  onToothClick: (fdi: string) => void;
  className?: string;
}) {
  const [focusedTooth, setFocusedTooth] = useState<string | null>(null);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border bg-linear-to-b from-card to-accent/40 ${className}`}
    >
      <Canvas camera={{ position: [0, 0.05, 1], fov: 35 }}>
        <ambientLight intensity={1} />
        <directionalLight position={[2, 3, 2]} intensity={1.3} />
        <directionalLight position={[-2, 1, 1]} intensity={0.4} />

        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.3}>
            <MouthModel />
            <CameraFocus fdi={focusedTooth} />

            {UPPER_ARCH.map((tooth, i) => (
              <ToothHitTarget
                key={tooth.fdi}
                tooth={tooth}
                position={positionOnArch(i, UPPER_ARCH.length, "upper")}
                isTreated={!!history[tooth.fdi]?.length}
                isFocused={focusedTooth === tooth.fdi || selectedTooth === tooth.fdi}
                onFocus={setFocusedTooth}
              />
            ))}
            {LOWER_ARCH.map((tooth, i) => (
              <ToothHitTarget
                key={tooth.fdi}
                tooth={tooth}
                position={positionOnArch(i, LOWER_ARCH.length, "lower")}
                isTreated={!!history[tooth.fdi]?.length}
                isFocused={focusedTooth === tooth.fdi || selectedTooth === tooth.fdi}
                onFocus={setFocusedTooth}
              />
            ))}
          </Bounds>
        </Suspense>

        <OrbitControls enablePan={false} minDistance={0.3} maxDistance={10} />
      </Canvas>

      {focusedTooth && (
        <ToothInfoPanel
          fdi={focusedTooth}
          history={history[focusedTooth] ?? []}
          onConfirm={() => {
            onToothClick(focusedTooth);
            setFocusedTooth(null);
          }}
          onClose={() => setFocusedTooth(null)}
        />
      )}

      <span className="pointer-events-none absolute top-1 right-1.5 text-[9px] text-muted-foreground/70">
        Modelo 3D &quot;Teeth&quot; por dewa (Sketchfab, CC BY)
      </span>
    </div>
  );
}
