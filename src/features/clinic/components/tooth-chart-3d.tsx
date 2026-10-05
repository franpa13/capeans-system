"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Bounds, Center, useGLTF } from "@react-three/drei";
import {
  LOWER_ARCH,
  UPPER_ARCH,
  positionOnArch,
  type Tooth,
} from "@/features/clinic/lib/odontogram";

const COLOR_TREATED = "#4ade80";
const COLOR_SELECTED = "#38bdf8";
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

function ToothHitTarget({
  tooth,
  position,
  isTreated,
  isSelected,
  onClick,
}: {
  tooth: Tooth;
  position: { x: number; y: number; z: number };
  isTreated: boolean;
  isSelected: boolean;
  onClick: (fdi: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showMarker = hovered || isSelected || isTreated;
  const markerColor = isSelected ? COLOR_SELECTED : hovered ? COLOR_HOVER : COLOR_TREATED;

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          onClick(tooth.fdi);
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
      {showMarker && (
        <mesh position={[0, 0, HIT_RADIUS * 0.6]}>
          <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
          <meshStandardMaterial
            color={markerColor}
            emissive={markerColor}
            emissiveIntensity={0.5}
          />
        </mesh>
      )}
      {(hovered || isSelected) && (
        <Html center distanceFactor={3} style={{ pointerEvents: "none" }}>
          <div className="rounded bg-foreground px-1 py-px text-[8px] font-medium whitespace-nowrap text-background">
            {tooth.fdi}
          </div>
        </Html>
      )}
    </group>
  );
}

export function ToothChart3D({
  treatedTeeth = [],
  selectedTooth,
  onToothClick,
  className = "h-112",
}: {
  treatedTeeth?: string[];
  selectedTooth?: string;
  onToothClick: (fdi: string) => void;
  className?: string;
}) {
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
          </Bounds>

          {UPPER_ARCH.map((tooth, i) => (
            <ToothHitTarget
              key={tooth.fdi}
              tooth={tooth}
              position={positionOnArch(i, UPPER_ARCH.length, "upper")}
              isTreated={treatedTeeth.includes(tooth.fdi)}
              isSelected={selectedTooth === tooth.fdi}
              onClick={onToothClick}
            />
          ))}
          {LOWER_ARCH.map((tooth, i) => (
            <ToothHitTarget
              key={tooth.fdi}
              tooth={tooth}
              position={positionOnArch(i, LOWER_ARCH.length, "lower")}
              isTreated={treatedTeeth.includes(tooth.fdi)}
              isSelected={selectedTooth === tooth.fdi}
              onClick={onToothClick}
            />
          ))}
        </Suspense>

        <OrbitControls enablePan={false} minDistance={0.5} maxDistance={10} />
      </Canvas>
      <span className="pointer-events-none absolute right-1.5 bottom-1 text-[9px] text-muted-foreground/70">
        Modelo 3D &quot;Teeth&quot; por dewa (Sketchfab, CC BY)
      </span>
    </div>
  );
}
