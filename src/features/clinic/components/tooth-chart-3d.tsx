"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Loader2 } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds, Center, useBounds, useGLTF, useProgress } from "@react-three/drei";
import { ALL_TEETH, LOWER_ARCH, UPPER_ARCH, cameraFocusFor } from "@/features/clinic/lib/odontogram";
import { findMeshIslands } from "@/features/clinic/lib/mesh-islands";

export type ToothHistoryEntry = {
  date: Date;
  treatment: string;
  consultationId?: string;
  notes?: string | null;
};
export type ToothHistory = Record<string, ToothHistoryEntry[]>;

const COLOR_TREATED = "#4ade80";
const COLOR_SELECTED = "#38bdf8";

// The "Teeth" GLB doesn't ship each tooth as its own object — each arch is
// one combined mesh. But each tooth IS its own disconnected island of
// geometry within that mesh, so flood-filling its triangles (same
// technique as findMeshIslands) splits it into 32 real per-tooth shapes,
// which get rendered as colored overlays instead of an approximate marker.
const MIN_ISLAND_VERTICES = 20; // drops a handful of tiny non-tooth islands
const TEETH_PER_ARCH = 16;
const PAINT_INFLATE = 1.05; // clears the base tooth's surface, avoids z-fighting

function buildToothGeometry(mesh: THREE.Mesh, vertexIndices: number[]): THREE.BufferGeometry {
  const posAttr = mesh.geometry.attributes.position;
  const normalAttr = mesh.geometry.attributes.normal as THREE.BufferAttribute | undefined;
  const n = vertexIndices.length;
  const positions = new Float32Array(n * 3);
  const normals = normalAttr ? new Float32Array(n * 3) : null;
  const remap = new Map<number, number>();

  vertexIndices.forEach((oldIndex, newIndex) => {
    remap.set(oldIndex, newIndex);
    positions[newIndex * 3] = posAttr.getX(oldIndex);
    positions[newIndex * 3 + 1] = posAttr.getY(oldIndex);
    positions[newIndex * 3 + 2] = posAttr.getZ(oldIndex);
    if (normals && normalAttr) {
      normals[newIndex * 3] = normalAttr.getX(oldIndex);
      normals[newIndex * 3 + 1] = normalAttr.getY(oldIndex);
      normals[newIndex * 3 + 2] = normalAttr.getZ(oldIndex);
    }
  });

  const vertexSet = new Set(vertexIndices);
  const originalIndex = mesh.geometry.index!.array;
  const newTriangles: number[] = [];
  for (let i = 0; i < originalIndex.length; i += 3) {
    const a = originalIndex[i];
    const b = originalIndex[i + 1];
    const c = originalIndex[i + 2];
    if (vertexSet.has(a) && vertexSet.has(b) && vertexSet.has(c)) {
      newTriangles.push(remap.get(a)!, remap.get(b)!, remap.get(c)!);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (normals) geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(newTriangles);

  // Inflate outward from the tooth's own center, in the mesh's local space,
  // before baking in the world transform below.
  geometry.computeBoundingSphere();
  const center = geometry.boundingSphere!.center;
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      center.x + (pos.getX(i) - center.x) * PAINT_INFLATE,
      center.y + (pos.getY(i) - center.y) * PAINT_INFLATE,
      center.z + (pos.getZ(i) - center.z) * PAINT_INFLATE,
    );
  }
  pos.needsUpdate = true;

  // Bake this mesh's full transform in so the extracted geometry renders
  // correctly as a standalone sibling of the original scene (see
  // MouthModel — both sit inside the same <Center>), without needing to
  // replicate the GLTF's node hierarchy.
  geometry.applyMatrix4(mesh.matrixWorld);
  if (!normals) geometry.computeVertexNormals();

  return geometry;
}

/**
 * Splits the model's two 16-tooth-island arch meshes into 32 standalone
 * per-tooth geometries, keyed by FDI number. Each arch's islands are
 * sorted by their real world X position, which is exactly how UPPER_ARCH /
 * LOWER_ARCH already read left-to-right, so index order lines right up.
 */
function extractToothGeometries(scene: THREE.Object3D): Map<string, THREE.BufferGeometry> {
  scene.updateWorldMatrix(true, true);

  const archMeshes: { mesh: THREE.Mesh; islands: number[][] }[] = [];
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.geometry.index) return;
    const islands = findMeshIslands(
      obj.geometry.attributes.position.count,
      obj.geometry.index.array as ArrayLike<number>,
    );
    const realTeeth = islands.filter((idxs) => idxs.length > MIN_ISLAND_VERTICES);
    if (realTeeth.length === TEETH_PER_ARCH) archMeshes.push({ mesh: obj, islands: realTeeth });
  });
  if (archMeshes.length !== 2) return new Map();

  const sortedArches = archMeshes.map(({ mesh, islands }) => {
    const posAttr = mesh.geometry.attributes.position;
    const withCentroids = islands.map((idxs) => {
      const centroid = new THREE.Vector3();
      for (const i of idxs) centroid.add(new THREE.Vector3().fromBufferAttribute(posAttr, i));
      centroid.divideScalar(idxs.length).applyMatrix4(mesh.matrixWorld);
      return { idxs, centroid };
    });
    const meanY = withCentroids.reduce((sum, t) => sum + t.centroid.y, 0) / withCentroids.length;
    withCentroids.sort((a, b) => a.centroid.x - b.centroid.x);
    return { mesh, meanY, teeth: withCentroids };
  });

  // Upper arch sits higher (larger Y) than the lower arch.
  sortedArches.sort((a, b) => b.meanY - a.meanY);
  const [upper, lower] = sortedArches;

  const geometries = new Map<string, THREE.BufferGeometry>();
  upper.teeth.forEach(({ idxs }, i) => {
    geometries.set(UPPER_ARCH[i].fdi, buildToothGeometry(upper.mesh, idxs));
  });
  lower.teeth.forEach(({ idxs }, i) => {
    geometries.set(LOWER_ARCH[i].fdi, buildToothGeometry(lower.mesh, idxs));
  });
  return geometries;
}

// A pointer that moved more than this between press and release was
// rotating the mouth, not tapping a tooth.
const MAX_CLICK_DRAG_PX = 5;

// The GLB's three materials (Gums, Teeth, Tongue) carry no color or PBR
// values, and glTF's default for a bare material is fully metallic — which,
// with no environment to reflect, renders everything a flat dark gray. Give
// each a natural, non-metallic look instead: ivory teeth, pink gums/tongue.
const NATURAL_MATERIALS: Record<string, { color: string; roughness: number }> = {
  Teeth: { color: "#f7f3ea", roughness: 0.35 },
  Gums: { color: "#e8a0a6", roughness: 0.6 },
  Tongue: { color: "#d9808b", roughness: 0.7 },
};

function applyNaturalMaterials(scene: THREE.Object3D) {
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const material = obj.material as THREE.MeshStandardMaterial;
    const look = NATURAL_MATERIALS[material.name];
    if (!look) return;
    material.color.set(look.color);
    material.metalness = 0;
    material.roughness = look.roughness;
    material.needsUpdate = true;
  });
}

function MouthModel({
  paintedTeeth,
  onToothClick,
}: {
  paintedTeeth: Map<string, string>;
  onToothClick?: (fdi: string) => void;
}) {
  const { scene } = useGLTF("/teeth/teeth.glb");
  useMemo(() => applyNaturalMaterials(scene), [scene]);
  const toothGeometries = useMemo(() => extractToothGeometries(scene), [scene]);

  return (
    <Center>
      <primitive object={scene} />
      {[...paintedTeeth].map(([fdi, color]) => {
        const geometry = toothGeometries.get(fdi);
        if (!geometry) return null;
        return (
          <mesh
            key={fdi}
            geometry={geometry}
            onClick={
              onToothClick &&
              ((e) => {
                if (e.delta > MAX_CLICK_DRAG_PX) return;
                e.stopPropagation();
                onToothClick(fdi);
              })
            }
            onPointerOver={onToothClick && (() => (document.body.style.cursor = "pointer"))}
            onPointerOut={onToothClick && (() => (document.body.style.cursor = ""))}
          >
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
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

/** useProgress reads three.js's global DefaultLoadingManager, so it works
 * as a plain hook outside the Canvas/R3F tree — the model loading blank
 * with no feedback for a couple of seconds on a cold cache read as
 * "broken" rather than "loading" for anyone not familiar with 3D viewers. */
function LoadingOverlay() {
  const { active } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Cargando modelo...
    </div>
  );
}

/**
 * A read-only view of the mouth: pieces are chosen elsewhere (the "Piezas
 * dentales" field), never by clicking here. Selecting teeth paints their
 * real shape (not a floating marker); with autoFocus on and exactly one
 * selected, the camera also zooms toward it (with several, the full-mouth
 * overview stays, since there's no single sane target to zoom to) — useful
 * while actively picking a tooth, but distracting when just reviewing an
 * already-complete consultation, so view/edit dialogs turn it off and stay
 * on the overview regardless of how many teeth are selected. Teeth with
 * consultation history stay painted green so the whole chart gives an
 * at-a-glance treatment summary.
 */
export function ToothChart3D({
  history = {},
  selectedTeeth = [],
  autoFocus = true,
  className = "h-112",
  onToothClick,
}: {
  history?: ToothHistory;
  selectedTeeth?: string[];
  autoFocus?: boolean;
  className?: string;
  /** Makes the painted (treated/selected) teeth tappable. */
  onToothClick?: (fdi: string) => void;
}) {
  const focusFdi = autoFocus && selectedTeeth.length === 1 ? selectedTeeth[0] : null;

  const paintedTeeth = useMemo(() => {
    const map = new Map<string, string>();
    for (const tooth of ALL_TEETH) {
      if (selectedTeeth.includes(tooth.fdi)) map.set(tooth.fdi, COLOR_SELECTED);
      else if (history[tooth.fdi]?.length) map.set(tooth.fdi, COLOR_TREATED);
    }
    return map;
  }, [selectedTeeth, history]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border bg-linear-to-b from-card to-accent/40 ${className}`}
    >
      <LoadingOverlay />
      <Canvas camera={{ position: [0, 0.05, 1], fov: 35 }}>
        {/* High ambient relative to the directional lights so a tooth near
            the back of the arch — now that the camera can pull back behind
            the model to face it, since the real jaw curls back there — is
            still clearly lit instead of going dark on the side the two
            fixed directional lights don't reach. */}
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 3, 2]} intensity={1} />
        <directionalLight position={[-2, 1, 1]} intensity={0.4} />
        <directionalLight position={[0, -2, -2]} intensity={0.5} />

        <Suspense fallback={null}>
          {/* observe keeps the overview correctly fitted as the container's
              size settles — but once a tooth is focused, a later resize
              (e.g. the dialog's own open animation still finishing) would
              re-trigger Bounds' own fit and silently cancel our explicit
              zoom below. Turning it off while focused freezes that out. */}
          <Bounds fit clip observe={!focusFdi} margin={1.3}>
            <MouthModel paintedTeeth={paintedTeeth} onToothClick={onToothClick} />
            <CameraFocus fdi={focusFdi} />
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
