"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import {
  LOWER_ARCH,
  UPPER_ARCH,
  positionOnArch,
  toothType,
  type Tooth,
} from "@/features/clinic/lib/odontogram";

const COLOR_ENAMEL = "#faf6ec";
const COLOR_TREATED = "#8fd9b6";
const COLOR_SELECTED = "#38bdf8";
const COLOR_HOVER = "#bae6fd";
const COLOR_GUM = "#e3a194";

// Anatomically-inspired crown shapes, built from primitives (no external
// model/asset): a chisel-like incisor, a single-cusp canine, a two-cusp
// premolar, a four-cusp molar. Each sits on a short tapered root stub
// that disappears into the gum ridge.
function ToothCrown({ type, color }: { type: ReturnType<typeof toothType>; color: THREE.Color | string }) {
  const mat = <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} />;
  const root = (
    <mesh position={[0, -0.2, 0]}>
      <coneGeometry args={[0.07, 0.16, 8]} />
      {mat}
    </mesh>
  );

  switch (type) {
    case "incisor":
      return (
        <group>
          {root}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.2, 0.3, 0.1]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.14, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.2, 0.03, 0.1]} />
            {mat}
          </mesh>
        </group>
      );
    case "canine":
      return (
        <group>
          {root}
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.1, 0.11, 0.18, 10]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <coneGeometry args={[0.1, 0.18, 10]} />
            {mat}
          </mesh>
        </group>
      );
    case "premolar":
      return (
        <group>
          {root}
          <mesh>
            <cylinderGeometry args={[0.14, 0.13, 0.24, 12]} />
            {mat}
          </mesh>
          <mesh position={[0.065, 0.12, 0]}>
            <sphereGeometry args={[0.065, 10, 10]} />
            {mat}
          </mesh>
          <mesh position={[-0.065, 0.12, 0]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            {mat}
          </mesh>
        </group>
      );
    case "molar":
      return (
        <group>
          {root}
          <mesh>
            <boxGeometry args={[0.3, 0.22, 0.28]} />
            {mat}
          </mesh>
          {[
            [0.1, 0.1],
            [-0.1, 0.1],
            [0.1, -0.1],
            [-0.1, -0.1],
          ].map(([cx, cz]) => (
            <mesh key={`${cx}-${cz}`} position={[cx, 0.12, cz]}>
              <sphereGeometry args={[0.06, 10, 10]} />
              {mat}
            </mesh>
          ))}
        </group>
      );
  }
}

const HIT_RADIUS_BY_TYPE: Record<string, number> = {
  incisor: 0.16,
  canine: 0.16,
  premolar: 0.18,
  molar: 0.22,
};

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
  const type = toothType(tooth.positionInQuadrant);

  // A touch of per-tooth tone variation so the row doesn't read as one
  // mass-produced primitive repeated 32 times.
  const baseColor = useMemo(() => {
    const c = new THREE.Color(COLOR_ENAMEL);
    const jitter = ((tooth.fdi.charCodeAt(0) + tooth.fdi.charCodeAt(1)) % 7) / 220;
    c.offsetHSL(0, 0, -jitter);
    return c;
  }, [tooth.fdi]);

  const color = isSelected
    ? COLOR_SELECTED
    : hovered
      ? COLOR_HOVER
      : isTreated
        ? COLOR_TREATED
        : baseColor;

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[0, position.rotationY, 0]}
    >
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
        <sphereGeometry args={[HIT_RADIUS_BY_TYPE[type], 8, 8]} />
      </mesh>
      <ToothCrown type={type} color={color} />
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

function GumRidge({ archY }: { archY: number }) {
  const points = useMemo(() => {
    const steps = 48;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const p = positionOnArch(i - 0.5, steps, archY);
      return new THREE.Vector3(p.x, p.y - 0.22 * Math.sign(archY || 1), p.z);
    });
  }, [archY]);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  return (
    <mesh receiveShadow>
      <tubeGeometry args={[curve, 64, 0.1, 8, false]} />
      <meshStandardMaterial color={COLOR_GUM} roughness={0.6} />
    </mesh>
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
    <div className="h-72 w-full overflow-hidden rounded-lg border bg-linear-to-b from-card to-accent/40">
      <Canvas shadows camera={{ position: [0, 1.6, 6.2], fov: 40 }}>
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[3, 5, 3]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-4, 2, -2]} intensity={0.3} />
        <pointLight position={[0, 1, 4]} intensity={0.25} />

        <GumRidge archY={1.1} />
        <GumRidge archY={-1.1} />

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

        <ContactShadows
          position={[0, -1.5, 1]}
          opacity={0.35}
          scale={8}
          blur={2}
          far={2}
        />

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
