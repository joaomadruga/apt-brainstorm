"use client";

import * as THREE from "three";
import { wallAxis, type Opening, type Wall } from "@/data/apartment";
import { LAYER_PHOTO } from "@/lib/photo";
import { OnLayer } from "./OnLayer";

// Esquadrias em 3D. Tudo é montado no "referencial da parede":
//   a = ao longo da parede (coordenada absoluta x ou y), t = espessura, z = altura.
// Mundo: (x, z, -y).

const ALU = "#b9bec4";
const ALU_DARK = "#a3a9b0";
const GRANITE = "#e7e2d8";
const JAMB = "#f2eee6";
const LEAF = "#d8bf9a";
// vidro bem visível: tom azul-esverdeado, leve brilho próprio pra não sumir na sombra
const GLASS = {
  color: "#8fc3d8",
  emissive: "#5d9fbd",
  emissiveIntensity: 0.25,
  transparent: true,
  opacity: 0.5,
  roughness: 0.05,
  metalness: 0.2,
  side: THREE.DoubleSide,
  depthWrite: false,
} as const;

/** reflexo diagonal no vidro (duas faixas claras) */
function Glare({ ax, a0, a1, tc, z0, z1 }: { ax: Axis; a0: number; a1: number; tc: number; z0: number; z1: number }) {
  const w = a1 - a0, h = z1 - z0;
  if (w < 0.15 || h < 0.15) return null;
  const [cx, cy] = ax === "x" ? [(a0 + a1) / 2, tc] : [tc, (a0 + a1) / 2];
  const ang = Math.atan2(h, w) * 0.8;
  const len = Math.hypot(w, h) * 0.55;
  const rotY = ax === "x" ? 0 : Math.PI / 2;
  return (
    <group position={[cx, (z0 + z1) / 2, -cy]} rotation={[0, rotY, 0]}>
      {[
        [-0.12, 0.06],
        [0.02, 0.025],
      ].map(([off, thick], i) => (
        <mesh key={i} position={[off * w, 0, 0]} rotation={[0, 0, ang]}>
          <planeGeometry args={[thick, len]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

type Axis = "x" | "y";

function Box({ ax, a0, a1, t0, t1, z0, z1, children }: { ax: Axis; a0: number; a1: number; t0: number; t1: number; z0: number; z1: number; children: React.ReactNode }) {
  if (a1 - a0 < 1e-4 || t1 - t0 < 1e-4 || z1 - z0 < 1e-4) return null;
  const am = (a0 + a1) / 2, tm = (t0 + t1) / 2, zm = (z0 + z1) / 2;
  const [x, y] = ax === "x" ? [am, tm] : [tm, am];
  const [sx, sz] = ax === "x" ? [a1 - a0, t1 - t0] : [t1 - t0, a1 - a0];
  return (
    <mesh position={[x, zm, -y]} castShadow receiveShadow>
      <boxGeometry args={[sx, z1 - z0, sz]} />
      {children}
    </mesh>
  );
}

const Alu = ({ dark }: { dark?: boolean }) => <meshStandardMaterial color={dark ? ALU_DARK : ALU} metalness={0.55} roughness={0.35} />;

/** caixilho (moldura + vidro) de uma folha */
function Sash({ ax, a0, a1, tc, z0, z1, depth = 0.03, bar = 0.035 }: { ax: Axis; a0: number; a1: number; tc: number; z0: number; z1: number; depth?: number; bar?: number }) {
  const t0 = tc - depth / 2, t1 = tc + depth / 2;
  const b = Math.min(bar, (a1 - a0) / 4, (z1 - z0) / 4);
  return (
    <group>
      <Box ax={ax} a0={a0} a1={a1} t0={t0} t1={t1} z0={z0} z1={z0 + b}><Alu /></Box>
      <Box ax={ax} a0={a0} a1={a1} t0={t0} t1={t1} z0={z1 - b} z1={z1}><Alu /></Box>
      <Box ax={ax} a0={a0} a1={a0 + b} t0={t0} t1={t1} z0={z0} z1={z1}><Alu /></Box>
      <Box ax={ax} a0={a1 - b} a1={a1} t0={t0} t1={t1} z0={z0} z1={z1}><Alu /></Box>
      <Box ax={ax} a0={a0 + b} a1={a1 - b} t0={tc - 0.005} t1={tc + 0.005} z0={z0 + b} z1={z1 - b}>
        <meshStandardMaterial {...GLASS} />
      </Box>
      {[-1, 1].map((s) => (
        <Glare key={s} ax={ax} a0={a0 + b} a1={a1 - b} tc={tc + s * 0.0065} z0={z0 + b} z1={z1 - b} />
      ))}
    </group>
  );
}

function WindowModel({ w, o, height }: { w: Wall; o: Opening; height: number }) {
  const ax = wallAxis(w);
  const t0 = ax === "x" ? w.y0 : w.x0;
  const t1 = ax === "x" ? w.y1 : w.x1;
  const tm = (t0 + t1) / 2;
  // janelas aparecem inteiras mesmo com as paredes cortadas (maquete), senão sobra só uma faixa
  void height;
  const top = o.head;
  const clipped = false;
  const fr = 0.04; // marco
  const els: React.ReactNode[] = [];
  // peitoril de granito (janelas) — sobressai 2 cm de cada lado
  if (o.sill > 0) {
    els.push(
      <Box key="sill" ax={ax} a0={o.a0 - 0.03} a1={o.a1 + 0.03} t0={t0 - 0.025} t1={t1 + 0.025} z0={o.sill - 0.02} z1={o.sill + 0.005}>
        <meshStandardMaterial color={GRANITE} roughness={0.35} />
      </Box>,
    );
  }
  if (top <= o.sill + 0.02) return <group>{els}</group>;
  // marco
  els.push(
    <Box key="mL" ax={ax} a0={o.a0} a1={o.a0 + fr} t0={tm - 0.04} t1={tm + 0.04} z0={o.sill} z1={top}><Alu dark /></Box>,
    <Box key="mR" ax={ax} a0={o.a1 - fr} a1={o.a1} t0={tm - 0.04} t1={tm + 0.04} z0={o.sill} z1={top}><Alu dark /></Box>,
    <Box key="mB" ax={ax} a0={o.a0} a1={o.a1} t0={tm - 0.04} t1={tm + 0.04} z0={o.sill} z1={o.sill + 0.03}><Alu dark /></Box>,
  );
  if (!clipped) els.push(<Box key="mT" ax={ax} a0={o.a0} a1={o.a1} t0={tm - 0.04} t1={tm + 0.04} z0={top - fr} z1={top}><Alu dark /></Box>);
  const i0 = o.a0 + fr, i1 = o.a1 - fr, span = i1 - i0;
  const z0 = o.sill + 0.03, z1 = clipped ? top : top - fr;
  const maximAr = o.label === "EA5";
  if (maximAr) {
    // folha única, basculante entreaberta (gira no topo)
    const ang = 0.35;
    const hgt = z1 - z0;
    const [cx, cy] = ax === "x" ? [(i0 + i1) / 2, tm] : [tm, (i0 + i1) / 2];
    const rot: [number, number, number] = ax === "x" ? [-ang, 0, 0] : [0, 0, ang];
    els.push(
      <group key="max" position={[cx, z1, -cy]} rotation={rot}>
        <mesh position={[0, -hgt / 2, 0]} castShadow>
          <boxGeometry args={ax === "x" ? [span, hgt, 0.025] : [0.025, hgt, span]} />
          <meshStandardMaterial {...GLASS} />
        </mesh>
      </group>,
    );
  } else {
    // duas folhas de correr sobrepostas em trilhos diferentes
    const ov = 0.04;
    els.push(
      <Sash key="s1" ax={ax} a0={i0} a1={i0 + span / 2 + ov} tc={tm - 0.018} z0={z0} z1={z1} />,
      <Sash key="s2" ax={ax} a0={i1 - span / 2 - ov} a1={i1} tc={tm + 0.018} z0={z0} z1={z1} />,
      // puxadores
      <Box key="p1" ax={ax} a0={i0 + span / 2 + ov - 0.05} a1={i0 + span / 2 + ov - 0.03} t0={tm - 0.045} t1={tm - 0.035} z0={z0 + (z1 - z0) * 0.4} z1={z0 + (z1 - z0) * 0.6}><Alu dark /></Box>,
      <Box key="p2" ax={ax} a0={i1 - span / 2 - ov + 0.03} a1={i1 - span / 2 - ov + 0.05} t0={tm + 0.035} t1={tm + 0.045} z0={z0 + (z1 - z0) * 0.4} z1={z0 + (z1 - z0) * 0.6}><Alu dark /></Box>,
    );
  }
  return <group>{els}</group>;
}

const OPEN_DEG = 75;

function DoorModel({ w, o, height }: { w: Wall; o: Opening; height: number }) {
  const ax = wallAxis(w);
  const t0 = ax === "x" ? w.y0 : w.x0;
  const t1 = ax === "x" ? w.y1 : w.x1;
  const jamb = 0.03; // batente
  const head = Math.min(o.head, height);
  const clipped = o.head > height + 1e-3;
  const els: React.ReactNode[] = [
    <Box key="jL" ax={ax} a0={o.a0} a1={o.a0 + jamb} t0={t0 - 0.008} t1={t1 + 0.008} z0={0} z1={head}><meshStandardMaterial color={JAMB} roughness={0.6} /></Box>,
    <Box key="jR" ax={ax} a0={o.a1 - jamb} a1={o.a1} t0={t0 - 0.008} t1={t1 + 0.008} z0={0} z1={head}><meshStandardMaterial color={JAMB} roughness={0.6} /></Box>,
  ];
  const jT = <Box ax={ax} a0={o.a0} a1={o.a1} t0={t0 - 0.008} t1={t1 + 0.008} z0={o.head - jamb} z1={o.head}><meshStandardMaterial color={JAMB} roughness={0.6} /></Box>;
  // parede cortada: a travessa de cima só aparece na foto (camada LAYER_PHOTO)
  els.push(clipped ? <OnLayer key="jT" layer={LAYER_PHOTO}>{jT}</OnLayer> : <group key="jT">{jT}</group>);

  // folha aberta: gira da posição fechada para o lado do "swing" (igual ao arco da planta)
  const leaf = o.a1 - o.a0 - 2 * jamb;
  const leafH = Math.min(o.head - 0.02, height);
  const sw = o.swing ?? 1;
  const hingeA = o.hinge === "end" ? o.a1 - jamb : o.a0 + jamb;
  const face = sw > 0 ? t1 : t0;
  const [hx, hy] = ax === "x" ? [hingeA, face] : [face, hingeA];
  const d = new THREE.Vector2(...((ax === "x" ? [o.hinge === "end" ? -1 : 1, 0] : [0, o.hinge === "end" ? -1 : 1]) as [number, number]));
  const n = new THREE.Vector2(...((ax === "x" ? [0, sw] : [sw, 0]) as [number, number]));
  const th = (OPEN_DEG * Math.PI) / 180;
  const dir = d.clone().multiplyScalar(Math.cos(th)).add(n.clone().multiplyScalar(Math.sin(th)));
  const phi = Math.atan2(dir.y, dir.x); // rotação em torno de y (mundo) que leva +x até dir
  const thick = 0.035;
  els.push(
    <group key="leaf" position={[hx, 0, -hy]} rotation={[0, phi, 0]}>
      <mesh position={[leaf / 2, leafH / 2 + 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[leaf, leafH, thick]} />
        <meshStandardMaterial color={LEAF} roughness={0.55} />
      </mesh>
      {leafH > 1.1 &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[leaf - 0.07, 1.02, (s * (thick + 0.03)) / 2]} castShadow>
            <boxGeometry args={[0.12, 0.018, 0.018]} />
            <meshStandardMaterial color="#9ea3a8" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
    </group>,
  );
  return <group>{els}</group>;
}

export function Openings3D({ w, height }: { w: Wall; height: number }) {
  return (
    <group>
      {(w.openings ?? []).map((o, i) => (
        <group key={i} userData={{ tag: { kind: "opening", wall: w.id, index: i } }}>
          {o.kind === "door" ? <DoorModel w={w} o={o} height={height} /> : <WindowModel w={w} o={o} height={height} />}
        </group>
      ))}
    </group>
  );
}
