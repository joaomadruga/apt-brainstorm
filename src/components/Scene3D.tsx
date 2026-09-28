"use client";

import { Canvas, useThree, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Edges } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CEILING, bounds, center, type Room, type Wall } from "@/data/apartment";
import { openingRect, snapTo, wallPieces } from "@/lib/geometry";
import { usePlan, useStore } from "@/lib/store";
import { usePlanColors } from "@/lib/theme";
import { FurnitureMesh } from "./Furniture3D";
import { Openings3D } from "./Openings3D";
import { floorFinishes } from "@/lib/materials";
import type { Item } from "@/data/catalog";
import { registerCapture } from "@/lib/capture";

const CUT_H = 1.25; // altura das paredes no modo "maquete"
const toW = (x: number, y: number, z = 0) => new THREE.Vector3(x, z, -y);

// ---------------------------------------------------------------- walls
function WallMesh({ w, height, edge }: { w: Wall; height: number; edge: string }) {
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const baseColor = useStore((s) => s.wallColors[w.id] ?? s.wallColor);
  const sel = selection?.kind === "wall" && selection.id === w.id;
  const pieces = useMemo(() => (w.kind === "parapet" ? [] : wallPieces(w, height)), [w, height]);
  const color = w.kind === "pillar" ? "#d9d4cc" : w.kind === "parapet" ? "#e8e6e1" : baseColor;
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select({ kind: "wall", id: w.id });
  };
  const H = w.height ?? height;
  return (
    <group onClick={onClick}>
      {pieces.map((p, i) => (
        <mesh key={i} position={toW((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2)} castShadow receiveShadow>
          <boxGeometry args={[p.x1 - p.x0, p.z1 - p.z0, p.y1 - p.y0]} />
          <meshStandardMaterial color={sel ? "#ff8a3d" : color} roughness={0.92} />
          {p.z1 >= H - 1e-3 && height < CEILING && <Edges color={edge} threshold={15} />}
        </mesh>
      ))}
      {/* janelas, portas de correr e portas de giro */}
      <Openings3D w={w} height={height} />
      {w.kind === "parapet" && (
        <>
          <mesh position={toW((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, 1.08)} castShadow>
            <boxGeometry args={[0.05, 0.04, w.y1 - w.y0]} />
            <meshStandardMaterial color={sel ? "#ff8a3d" : "#9aa0a6"} metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={toW((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, 0.55)}>
            <boxGeometry args={[0.02, 1.06, w.y1 - w.y0]} />
            <meshPhysicalMaterial color="#cfe8f2" transparent opacity={0.28} roughness={0.05} />
          </mesh>
        </>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- floors
function Floors({ rooms, walls }: { rooms: Room[]; walls: Wall[] }) {
  const floors = useStore((s) => s.floors);
  const select = useStore((s) => s.select);
  const selection = useStore((s) => s.selection);
  const removed = useStore((s) => s.removedWalls);
  const shapes = useMemo(
    () =>
      rooms.map((r) => {
        const sh = new THREE.Shape();
        r.poly.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
        return new THREE.ShapeGeometry(sh);
      }),
    [rooms],
  );
  // piso sob vãos de porta e sob paredes removidas (para não ficar buraco)
  const patches = useMemo(() => {
    const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
    for (const w of walls) {
      if (removed.includes(w.id) && w.kind !== "pillar") out.push(w);
      else for (const o of w.openings ?? []) if (o.sill === 0) out.push(openingRect(w, o));
    }
    return out;
  }, [removed, walls]);
  return (
    <group>
      {rooms.map((r, i) => {
        const f = floorFinishes[floors[r.id] ?? r.floor];
        const sel = selection?.kind === "room" && selection.id === r.id;
        return (
          <mesh
            key={r.id}
            geometry={shapes[i]}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.001, 0]}
            receiveShadow
            onClick={(e) => {
              e.stopPropagation();
              select({ kind: "room", id: r.id });
            }}
          >
            <meshStandardMaterial color={sel ? "#ffd2a8" : f.color} roughness={f.roughness} />
          </mesh>
        );
      })}
      {patches.map((p, i) => (
        <mesh key={i} position={toW((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, 0.0005)} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[p.x1 - p.x0, p.y1 - p.y0]} />
          <meshStandardMaterial color="#cbbfae" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Ceiling({ rooms }: { rooms: Room[] }) {
  const geo = useMemo(() => {
    const g: THREE.ShapeGeometry[] = [];
    for (const r of rooms) {
      if (r.id === "varanda") continue;
      const sh = new THREE.Shape();
      r.poly.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
      g.push(new THREE.ShapeGeometry(sh));
    }
    return g;
  }, [rooms]);
  // normal para cima + BackSide = só aparece olhando de baixo
  return (
    <group position={[0, CEILING, 0]}>
      {geo.map((g, i) => (
        <mesh key={i} geometry={g} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#fbfaf7" side={THREE.BackSide} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Plinth({ color }: { color: string }) {
  const w = bounds.maxX - bounds.minX + 0.6;
  const d = bounds.maxY - bounds.minY + 0.6;
  return (
    <mesh position={toW(center[0], (bounds.minY + bounds.maxY) / 2, -0.16)} receiveShadow>
      <boxGeometry args={[w, 0.3, d]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

// ---------------------------------------------------------------- furniture + drag
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function ItemMesh({ item }: { item: Item }) {
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const moveItem = useStore((s) => s.moveItem);
  const commit = useStore((s) => s.commit);
  const snap = useStore((s) => s.snap);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const sel = selection?.kind === "item" && selection.id === item.id;
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    select({ kind: "item", id: item.id });
    if (!e.ray.intersectPlane(floorPlane, hit)) return;
    drag.current = { dx: item.x - hit.x, dy: item.y + hit.z, moved: false };
    (e.target as Element).setPointerCapture(e.pointerId);
    if (controls) controls.enabled = false;
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    if (!e.ray.intersectPlane(floorPlane, hit)) return;
    if (!drag.current.moved) {
      commit();
      drag.current.moved = true;
    }
    let x = hit.x + drag.current.dx;
    let y = -hit.z + drag.current.dy;
    if (snap) {
      x = snapTo(x);
      y = snapTo(y);
    }
    moveItem(item.id, x, y);
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    drag.current = null;
    if (controls) controls.enabled = true;
  };

  return (
    <group
      position={toW(item.x, item.y)}
      rotation={[0, (item.rot * Math.PI) / 180, 0]}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      <FurnitureMesh item={item} />
      {sel && (
        <mesh position={[0, item.h / 2 + 0.005, 0]} userData={{ helper: true }}>
          <boxGeometry args={[item.w + 0.03, item.h + 0.02, item.d + 0.03]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges color="#ff7a1a" />
        </mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- lights
function Sun() {
  const hour = useStore((s) => s.hour);
  const ref = useRef<THREE.DirectionalLight>(null);
  const { pos, color, intensity, amb } = useMemo(() => {
    // sol nasce a leste (+x), passa pelo norte (+y na planta, Recife ~8°S) e se põe a oeste
    const t = (hour - 6) / 12; // 0..1
    const az = Math.PI * t; // 0 = leste, π = oeste
    const el = Math.sin(Math.PI * Math.min(Math.max(t, 0), 1));
    const R = 20;
    const p = toW(center[0] + Math.cos(az) * R, center[1] + Math.sin(az) * R * 0.35 + 3, 2 + el * 18);
    const warm = new THREE.Color("#ffb46b").lerp(new THREE.Color("#fff6e8"), el);
    const night = hour < 6.3 || hour > 17.7;
    return { pos: p, color: night ? new THREE.Color("#6d7fb0") : warm, intensity: night ? 0.25 : 0.6 + el * 2.2, amb: night ? 0.25 : 0.45 + el * 0.4 };
  }, [hour]);
  useEffect(() => {
    if (ref.current) ref.current.target.position.copy(toW(center[0], center[1]));
    ref.current?.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <hemisphereLight args={["#f4f6ff", "#c9b89f", amb * 1.6]} />
      <ambientLight intensity={amb * 0.5} />
      <directionalLight
        ref={ref}
        position={pos}
        color={color}
        intensity={intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
    </>
  );
}

// ---------------------------------------------------------------- camera
const TARGET = toW(center[0], center[1], 0);
const ISO_OFFSET = new THREE.Vector3(7.5, 11.5, 11);

function CameraRig() {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const preset = useStore((s) => s.cameraPreset);
  const setCutaway = useStore((s) => s.setCutaway);
  const setShowCeiling = useStore((s) => s.setShowCeiling);

  useEffect(() => {
    if (!controls) return;
    const cam = camera as THREE.PerspectiveCamera;
    if (preset.preset === "iso") {
      cam.position.copy(TARGET).add(ISO_OFFSET);
      controls.target.copy(TARGET);
      cam.fov = 40;
    } else if (preset.preset === "top") {
      cam.position.copy(TARGET).add(new THREE.Vector3(0, 16, 0.01));
      controls.target.copy(TARGET);
      cam.fov = 40;
    } else {
      // em pé no canto da sala, olhando para a cozinha / varanda
      setCutaway(false);
      setShowCeiling(true);
      cam.position.copy(toW(3.1, 3.75, 1.6));
      controls.target.copy(toW(5.2, 5.6, 1.35));
      cam.fov = 65;
    }
    cam.updateProjectionMatrix();
    controls.update();
  }, [preset.nonce, controls]); // eslint-disable-line react-hooks/exhaustive-deps

  // WASD / QE para andar, estilo "olho humano"
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
    };
    const dn = (e: KeyboardEvent) => {
      if (isTyping() || e.metaKey || e.ctrlKey) return;
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const side = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    if (!controls) return;
    const k = keys.current;
    const v = 2.2 * dt * (k["shift"] ? 2 : 1);
    fwd.subVectors(controls.target, camera.position).setY(0);
    if (fwd.lengthSq() < 1e-6) return;
    fwd.normalize();
    side.crossVectors(fwd, camera.up).normalize();
    const mv = new THREE.Vector3();
    if (k["w"]) mv.add(fwd);
    if (k["s"]) mv.sub(fwd);
    if (k["d"]) mv.add(side);
    if (k["a"]) mv.sub(side);
    if (mv.lengthSq() > 0) {
      mv.normalize().multiplyScalar(v);
      camera.position.add(mv);
      controls.target.add(mv);
    }
    const rot = (k["q"] ? 1 : 0) - (k["e"] ? 1 : 0);
    if (rot) {
      const off = controls.target.clone().sub(camera.position);
      off.applyAxisAngle(camera.up, rot * 1.4 * dt);
      controls.target.copy(camera.position).add(off);
    }
    if (mv.lengthSq() > 0 || rot) controls.update();
  });
  return null;
}

// ---------------------------------------------------------------- capture
function CaptureBridge() {
  const { gl, scene, camera, size } = useThree();
  const select = useStore((s) => s.select);
  useEffect(() => {
    registerCapture(async (scale: number) => {
      const prevSel = useStore.getState().selection;
      select(null);
      // espera o React tirar os destaques de seleção
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const prevRatio = gl.getPixelRatio();
      gl.setPixelRatio(Math.min(4, prevRatio * scale));
      gl.setSize(size.width, size.height, false);
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL("image/png");
      gl.setPixelRatio(prevRatio);
      gl.setSize(size.width, size.height, false);
      select(prevSel);
      const cam = camera as THREE.PerspectiveCamera;
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      return {
        url,
        width: Math.round(size.width * prevRatio * scale),
        height: Math.round(size.height * prevRatio * scale),
        camera: {
          x: cam.position.x, y: -cam.position.z, z: cam.position.y,
          dir: { x: dir.x, y: -dir.z, z: dir.y },
          fov: cam.fov,
        },
      };
    });
    return () => registerCapture(null);
  }, [gl, scene, camera, size, select]);
  return null;
}

// ---------------------------------------------------------------- scene
function World() {
  const cutaway = useStore((s) => s.cutaway);
  const showCeiling = useStore((s) => s.showCeiling);
  const removed = useStore((s) => s.removedWalls);
  const { walls, rooms } = usePlan();
  const C = usePlanColors();
  const items = useStore((s) => s.items);
  const select = useStore((s) => s.select);
  const height = cutaway ? CUT_H : CEILING;
  return (
    <group onPointerMissed={() => select(null)}>
      <Plinth color={C.plinth} />
      <Floors rooms={rooms} walls={walls} />
      {walls
        .filter((w) => !removed.includes(w.id))
        .map((w) => (
          <WallMesh key={w.id} w={w} height={height} edge={C.edge} />
        ))}
      {items.map((i) => (
        <ItemMesh key={i.id} item={i} />
      ))}
      {showCeiling && !cutaway && <Ceiling rooms={rooms} />}
    </group>
  );
}

function Background() {
  const C = usePlanColors();
  return <color attach="background" args={[C.scene]} />;
}

export default function Scene3D() {
  const select = useStore((s) => s.select);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ position: TARGET.clone().add(ISO_OFFSET).toArray(), fov: 40, near: 0.05, far: 200 }}
      onPointerMissed={() => select(null)}
    >
      <Background />
      <Sun />
      <World />
      <OrbitControls
        makeDefault
        target={TARGET}
        enableDamping
        dampingFactor={0.12}
        maxPolarAngle={Math.PI * 0.495}
        minDistance={0.2}
        maxDistance={40}
        // arrastar (esquerdo) = mover a vista pelo chão · clicar na roda e arrastar = girar · roda = zoom
        // (Shift/⌘/Ctrl + arrastar também gira — útil no trackpad)
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        screenSpacePanning={false}
        zoomToCursor
      />
      <CameraRig />
      <CaptureBridge />
    </Canvas>
  );
}
