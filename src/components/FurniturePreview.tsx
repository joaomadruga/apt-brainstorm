"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import type { CatalogEntry, Item } from "@/data/catalog";
import { FurnitureMesh } from "./Furniture3D";

const asItem = (c: CatalogEntry): Item => ({ id: `preview-${c.type}`, type: c.type, x: 0, y: 0, rot: 0, w: c.w, d: c.d, h: c.h, color: c.color });

/** posiciona a câmera para enquadrar o móvel (vista 3/4 de frente) */
function frame(cam: THREE.PerspectiveCamera, c: CatalogEntry, target?: THREE.Vector3) {
  const size = Math.max(c.w, c.d, c.h * 1.1);
  const dist = size * 1.9 + 0.3;
  const t = new THREE.Vector3(0, c.h * 0.45, 0);
  cam.position.copy(t).add(new THREE.Vector3(0.75, 0.62, 1).normalize().multiplyScalar(dist));
  cam.near = 0.01;
  cam.far = 100;
  cam.lookAt(t);
  cam.updateProjectionMatrix();
  target?.copy(t);
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#b9aa94", 1.3]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.2} />
      <directionalLight position={[-3, 2, -1]} intensity={0.5} />
    </>
  );
}

// ------------------------------------------------------------------ miniaturas (cache em memória)
const thumbs = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;
const subscribe = (cb: () => void) => (listeners.add(cb), () => listeners.delete(cb));
const setThumb = (type: string, url: string) => {
  thumbs.set(type, url);
  version++;
  listeners.forEach((l) => l());
};
export function useThumb(type: string) {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return thumbs.get(type);
}

function Shooter({ queue, onDone }: { queue: CatalogEntry[]; onDone: () => void }) {
  const { gl, camera, scene } = useThree();
  const [i, setI] = useState(0);
  const frames = useRef(0);
  const c = queue[i];
  useEffect(() => {
    frames.current = 0;
    if (c) frame(camera as THREE.PerspectiveCamera, c);
  }, [c, camera]);
  useFrame(() => {
    if (!c) return;
    if (++frames.current < 3) return; // deixa montar a geometria
    gl.render(scene, camera);
    setThumb(c.type, gl.domElement.toDataURL("image/png"));
    if (i + 1 >= queue.length) onDone();
    else setI(i + 1);
  });
  return c ? <FurnitureMesh key={c.type} item={asItem(c)} /> : null;
}

/** Gera as miniaturas que faltam num canvas fora da tela e se desmonta. */
export function ThumbFactory({ entries }: { entries: CatalogEntry[] }) {
  const queue = useMemo(() => entries.filter((e) => !thumbs.has(e.type)), [entries]);
  const [done, setDone] = useState(queue.length === 0);
  if (done || !queue.length) return null;
  return (
    <div style={{ position: "fixed", left: -10000, top: 0, width: 160, height: 160, pointerEvents: "none" }} aria-hidden>
      <Canvas gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }} dpr={1} camera={{ fov: 32 }} frameloop="always">
        <Lights />
        <Shooter queue={queue} onDone={() => setDone(true)} />
      </Canvas>
    </div>
  );
}

// ------------------------------------------------------------------ prévia ao vivo
function FitCamera({ entry }: { entry: CatalogEntry }) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    const t = new THREE.Vector3();
    frame(camera as THREE.PerspectiveCamera, entry, t);
    if (controls) {
      controls.target.copy(t);
      controls.update();
    }
  }, [entry, camera, controls]);
  return null;
}

export function LivePreview({ entry }: { entry: CatalogEntry }) {
  const item = useMemo(() => asItem(entry), [entry]);
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 32 }} gl={{ antialias: true, alpha: true }}>
      <Lights />
      <FurnitureMesh item={item} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <circleGeometry args={[Math.max(entry.w, entry.d) * 0.85, 48]} />
        <meshStandardMaterial color="#8c857a" transparent opacity={0.18} />
      </mesh>
      <OrbitControls makeDefault autoRotate autoRotateSpeed={1.6} enablePan={false} enableZoom={false} />
      <FitCamera entry={entry} />
    </Canvas>
  );
}
