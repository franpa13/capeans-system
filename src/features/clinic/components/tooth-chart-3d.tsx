"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import {
  LOWER_ARCH,
  UPPER_ARCH,
  positionOnArch,
  type Tooth,
} from "@/features/clinic/lib/odontogram";

const COLOR_DEFAULT = "#f1ede3";
const COLOR_TREATED = "#86efac";
const COLOR_SELECTED = "#38bdf8";
const COLOR_HOVER = "#bae6fd";

function ToothMesh({
  tooth,
  position,
  isTreated,
  isSelected,
  onClick,
}: {
  tooth: Tooth;
  position: { x: number; y: number; z: number; rotationY: number };
  isTreated: boolean;
  isSelected: boolean;
  onClick: (fdi: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const color = isSelected
    ? COLOR_SELECTED
    : hovered
      ? COLOR_HOVER
      : isTreated
        ? COLOR_TREATED
        : COLOR_DEFAULT;

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[0, position.rotationY, 0]}
    >
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick(tooth.fdi);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <capsuleGeometry args={[0.16, 0.26, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {(hovered || isSelected) && (
        <Html center distanceFactor={8} style={{ pointerEvents: "none" }}>
          <div className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-background">
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
}: {
  treatedTeeth?: string[];
  selectedTooth?: string;
  onToothClick: (fdi: string) => void;
}) {
  return (
    <div className="h-72 w-full overflow-hidden rounded-md border bg-muted/20">
      <Canvas camera={{ position: [0, 1.6, 6.2], fov: 40 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 2]} intensity={0.9} />
        {UPPER_ARCH.map((tooth, i) => (
          <ToothMesh
            key={tooth.fdi}
            tooth={tooth}
            position={positionOnArch(i, UPPER_ARCH.length, 1.1)}
            isTreated={treatedTeeth.includes(tooth.fdi)}
            isSelected={selectedTooth === tooth.fdi}
            onClick={onToothClick}
          />
        ))}
        {LOWER_ARCH.map((tooth, i) => (
          <ToothMesh
            key={tooth.fdi}
            tooth={tooth}
            position={positionOnArch(i, LOWER_ARCH.length, -1.1)}
            isTreated={treatedTeeth.includes(tooth.fdi)}
            isSelected={selectedTooth === tooth.fdi}
            onClick={onToothClick}
          />
        ))}
        <OrbitControls
          enablePan={false}
          minDistance={3.5}
          maxDistance={9}
          target={[0, 0, 1]}
        />
      </Canvas>
    </div>
  );
}
