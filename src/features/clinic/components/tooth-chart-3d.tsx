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
  type ToothType,
} from "@/features/clinic/lib/odontogram";

const COLOR_ENAMEL = "#faf6ec";
const COLOR_TREATED = "#8fd9b6";
const COLOR_SELECTED = "#38bdf8";
const COLOR_HOVER = "#bae6fd";
const COLOR_GUM = "#e3a194";

function lathe(profile: Array<[number, number]>, segments: number) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

// Each profile is a root-to-crown silhouette (radius, height), revolved
// into a smooth, rotationally-symmetric body, then flattened on one axis
// (see FLATTEN_BY_TYPE) so it reads as a tooth cross-section rather than
// a vase. The narrow waist partway up is the cervical line — where the
// crown meets the root, the one landmark every real tooth shares.
const INCISOR_GEOMETRY = lathe(
  [
    [0, -0.36],
    [0.035, -0.3],
    [0.05, -0.2],
    [0.048, -0.1],
    [0.04, -0.04], // cervical line
    [0.075, 0.02],
    [0.095, 0.09],
    [0.088, 0.15],
    [0.055, 0.185],
    [0, 0.195],
  ],
  16,
);

const CANINE_GEOMETRY = lathe(
  [
    [0, -0.4],
    [0.04, -0.32],
    [0.055, -0.2],
    [0.05, -0.1],
    [0.044, -0.03], // cervical line
    [0.08, 0.04],
    [0.1, 0.13],
    [0.078, 0.21],
    [0.035, 0.27],
    [0, 0.29],
  ],
  16,
);

const PREMOLAR_BASE_GEOMETRY = lathe(
  [
    [0, -0.34],
    [0.05, -0.26],
    [0.075, -0.14],
    [0.068, -0.05], // cervical line
    [0.12, 0.0],
    [0.14, 0.06],
    [0.13, 0.11],
    [0.09, 0.14],
    [0, 0.145],
  ],
  20,
);

const MOLAR_BASE_GEOMETRY = lathe(
  [
    [0, -0.3],
    [0.065, -0.22],
    [0.095, -0.1],
    [0.085, -0.02], // cervical line
    [0.155, 0.02],
    [0.175, 0.06],
    [0.155, 0.1],
    [0.09, 0.12],
    [0, 0.125],
  ],
  24,
);

const CUSP_GEOMETRY = new THREE.SphereGeometry(0.06, 14, 12);

// Non-uniform scale per type: incisors are the most labio-lingually
// flattened (thin front-to-back, wide side-to-side), canines rounder,
// premolars and molars progressively wider.
const FLATTEN_BY_TYPE: Record<ToothType, [number, number, number]> = {
  incisor: [1, 1, 0.5],
  canine: [1, 1, 0.78],
  premolar: [1, 1, 0.8],
  molar: [1.1, 1, 0.95],
};

function ToothCrown({ type, color }: { type: ToothType; color: THREE.Color | string }) {
  const mat = <meshStandardMaterial color={color} roughness={0.3} metalness={0.04} />;
  const scale = FLATTEN_BY_TYPE[type];

  switch (type) {
    case "incisor":
      return (
        <mesh geometry={INCISOR_GEOMETRY} scale={scale}>
          {mat}
        </mesh>
      );
    case "canine":
      return (
        <mesh geometry={CANINE_GEOMETRY} scale={scale}>
          {mat}
        </mesh>
      );
    case "premolar":
      return (
        <group scale={scale}>
          <mesh geometry={PREMOLAR_BASE_GEOMETRY}>{mat}</mesh>
          <mesh geometry={CUSP_GEOMETRY} position={[0.055, 0.1, 0.05]} scale={0.95}>
            {mat}
          </mesh>
          <mesh geometry={CUSP_GEOMETRY} position={[-0.055, 0.1, -0.05]} scale={0.9}>
            {mat}
          </mesh>
        </group>
      );
    case "molar":
      return (
        <group scale={scale}>
          <mesh geometry={MOLAR_BASE_GEOMETRY}>{mat}</mesh>
          {(
            [
              [0.08, 0.08],
              [-0.08, 0.08],
              [0.08, -0.08],
              [-0.08, -0.08],
            ] as const
          ).map(([cx, cz]) => (
            <mesh
              key={`${cx}-${cz}`}
              geometry={CUSP_GEOMETRY}
              position={[cx, 0.08, cz]}
              scale={0.85}
            >
              {mat}
            </mesh>
          ))}
        </group>
      );
  }
}

const HIT_RADIUS_BY_TYPE: Record<ToothType, number> = {
  incisor: 0.15,
  canine: 0.15,
  premolar: 0.17,
  molar: 0.22,
};

function ToothMesh({
  tooth,
  position,
  isTreated,
  isSelected,
  flipped,
  onClick,
}: {
  tooth: Tooth;
  position: { x: number; y: number; z: number; rotationY: number };
  isTreated: boolean;
  isSelected: boolean;
  flipped: boolean;
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
      {/* Upper teeth hang crown-down from the gum; lower teeth stand
          crown-up from it — same geometry, flipped for the upper arch. */}
      <group rotation={flipped ? [0, 0, Math.PI] : [0, 0, 0]}>
        <ToothCrown type={type} color={color} />
      </group>
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
      return new THREE.Vector3(p.x, p.y - 0.3 * Math.sign(archY || 1), p.z);
    });
  }, [archY]);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  return (
    <mesh receiveShadow>
      <tubeGeometry args={[curve, 64, 0.11, 8, false]} />
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
      <Canvas shadows camera={{ position: [0, 1.7, 6.4], fov: 38 }}>
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[3, 5, 3]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-4, 2, -2]} intensity={0.3} />
        <pointLight position={[0, 1, 4]} intensity={0.25} />

        <GumRidge archY={1.15} />
        <GumRidge archY={-1.15} />

        {UPPER_ARCH.map((tooth, i) => (
          <ToothMesh
            key={tooth.fdi}
            tooth={tooth}
            position={positionOnArch(i, UPPER_ARCH.length, 1.15)}
            isTreated={treatedTeeth.includes(tooth.fdi)}
            isSelected={selectedTooth === tooth.fdi}
            flipped
            onClick={onToothClick}
          />
        ))}
        {LOWER_ARCH.map((tooth, i) => (
          <ToothMesh
            key={tooth.fdi}
            tooth={tooth}
            position={positionOnArch(i, LOWER_ARCH.length, -1.15)}
            isTreated={treatedTeeth.includes(tooth.fdi)}
            isSelected={selectedTooth === tooth.fdi}
            flipped={false}
            onClick={onToothClick}
          />
        ))}

        <ContactShadows
          position={[0, -1.6, 1]}
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
