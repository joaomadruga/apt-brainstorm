"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { catalogByType, type Item, type Part } from "@/data/catalog";

// Cada móvel é montado com primitivas simples no referencial local:
// largura em x, profundidade em z, "frente" voltada para +z, base em y=0.

type BoxProps = { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; m?: number; o?: number };

function B({ p, s, c, r = 0.7, m = 0, o = 1 }: BoxProps) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} transparent={o < 1} opacity={o} />
    </mesh>
  );
}

function C({ p, rt, rb, h, c, r = 0.6 }: { p: [number, number, number]; rt: number; rb: number; h: number; c: string; r?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[rt, rb, h, 20]} />
      <meshStandardMaterial color={c} roughness={r} />
    </mesh>
  );
}

const shade = (hex: string, k: number) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
};

const DEG = Math.PI / 180;

/** Móvel definido por dados (/furniture/*.json): peças em frações da caixa do móvel */
function PartsMesh({ item, parts }: { item: Item; parts: Part[] }) {
  const { w, d, h, color } = item;
  const dark = shade(color, 0.72);
  const light = shade(color, 1.25);
  return (
    <group>
      {parts.map((p, i) => {
        const col = !p.color || p.color === "base" ? color : p.color === "dark" ? dark : p.color === "light" ? light : p.color;
        const sx = p.sx * w, sy = p.sy * h, sz = p.sz * d;
        const rot: [number, number, number] = [(p.rx ?? 0) * DEG, (p.ry ?? 0) * DEG, (p.rz ?? 0) * DEG];
        const o = p.opacity ?? 1;
        return (
          <mesh key={i} position={[p.x * w, p.y * h, p.z * d]} rotation={rot} scale={p.shape === "box" ? 1 : [sx, sy, sz]} castShadow receiveShadow>
            {p.shape === "box" ? (
              <boxGeometry args={[sx, sy, sz]} />
            ) : p.shape === "cylinder" ? (
              <cylinderGeometry args={[0.5 * (p.taper ?? 1), 0.5, 1, 24]} />
            ) : (
              <sphereGeometry args={[0.5, 20, 14]} />
            )}
            <meshStandardMaterial color={col} roughness={p.roughness ?? 0.7} metalness={p.metalness ?? 0} transparent={o < 1} opacity={o} />
          </mesh>
        );
      })}
    </group>
  );
}

export function FurnitureMesh({ item }: { item: Item }) {
  const { w, d, h, color: c, type } = item;
  const dark = useMemo(() => shade(c, 0.75), [c]);
  const parts = catalogByType[type]?.parts;
  if (parts) return <PartsMesh item={item} parts={parts} />;
  const legs = (lh: number, inset = 0.04, col = "#3a3a3a", t = 0.04) =>
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
      <B key={i} p={[sx * (w / 2 - inset), lh / 2, sz * (d / 2 - inset)]} s={[t, lh, t]} c={col} />
    ));

  switch (type) {
    case "sofa": {
      const seatH = 0.42, arm = 0.18, back = 0.2;
      return (
        <group>
          <B p={[0, 0.1, 0]} s={[w, 0.2, d]} c={dark} />
          <B p={[0, seatH - 0.1, back / 2]} s={[w - 2 * arm, 0.22, d - back]} c={c} r={0.95} />
          <B p={[0, h / 2 + 0.05, -d / 2 + back / 2]} s={[w, h - 0.1, back]} c={c} r={0.95} />
          <B p={[-w / 2 + arm / 2, 0.3, 0]} s={[arm, 0.6, d]} c={c} r={0.95} />
          <B p={[w / 2 - arm / 2, 0.3, 0]} s={[arm, 0.6, d]} c={c} r={0.95} />
        </group>
      );
    }
    case "poltrona":
      return (
        <group>
          {legs(0.12, 0.08)}
          <B p={[0, 0.3, 0.05]} s={[w - 0.2, 0.18, d - 0.15]} c={c} r={0.95} />
          <B p={[0, 0.55, -d / 2 + 0.08]} s={[w, 0.7, 0.16]} c={c} r={0.95} />
          <B p={[-w / 2 + 0.08, 0.38, 0]} s={[0.16, 0.36, d]} c={c} r={0.95} />
          <B p={[w / 2 - 0.08, 0.38, 0]} s={[0.16, 0.36, d]} c={c} r={0.95} />
        </group>
      );
    case "mesaCentro":
    case "mesaJantar":
    case "escrivaninha":
      return (
        <group>
          <B p={[0, h - 0.02, 0]} s={[w, 0.04, d]} c={c} r={0.5} />
          {legs(h - 0.04, 0.06, dark, 0.05)}
        </group>
      );
    case "cadeira":
      return (
        <group>
          {legs(0.45, 0.03, dark, 0.03)}
          <B p={[0, 0.46, 0]} s={[w, 0.04, d]} c={c} />
          <B p={[0, 0.68, -d / 2 + 0.02]} s={[w, 0.4, 0.03]} c={c} />
        </group>
      );
    case "banqueta":
      return (
        <group>
          <C p={[0, h - 0.03, 0]} rt={w / 2} rb={w / 2} h={0.06} c={c} />
          <C p={[0, (h - 0.06) / 2, 0]} rt={0.025} rb={0.03} h={h - 0.06} c="#777" />
          <C p={[0, 0.01, 0]} rt={w / 2.4} rb={w / 2.4} h={0.02} c="#777" />
        </group>
      );
    case "rack":
    case "criado":
      return (
        <group>
          <B p={[0, h / 2 + 0.05, 0]} s={[w, h - 0.1, d]} c={c} r={0.5} />
          {legs(0.1, 0.05, "#222", 0.03)}
          <B p={[0, h / 2 + 0.05, d / 2 + 0.002]} s={[w - 0.04, 0.005, 0.004]} c={dark} />
        </group>
      );
    case "tv":
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, 0.03]} c="#0b0b0b" r={0.2} m={0.3} />
          <B p={[0, h / 2, 0.016]} s={[w - 0.02, h - 0.02, 0.002]} c="#1c2430" r={0.1} />
        </group>
      );
    case "estante":
      return (
        <group>
          <B p={[-w / 2 + 0.01, h / 2, 0]} s={[0.02, h, d]} c={c} />
          <B p={[w / 2 - 0.01, h / 2, 0]} s={[0.02, h, d]} c={c} />
          <B p={[0, h / 2, -d / 2 + 0.005]} s={[w, h, 0.01]} c={dark} />
          {[0, 1, 2, 3, 4].map((k) => (
            <B key={k} p={[0, 0.02 + (k * (h - 0.04)) / 4, 0]} s={[w, 0.025, d]} c={c} />
          ))}
        </group>
      );
    case "camaCasal":
    case "camaSolteiro":
      return (
        <group>
          <B p={[0, 0.15, 0]} s={[w, 0.3, d]} c="#6d5a48" />
          <B p={[0, 0.38, 0.02]} s={[w - 0.04, 0.18, d - 0.06]} c={c} r={0.95} />
          <B p={[0, 0.49, 0.25]} s={[w - 0.02, 0.04, d * 0.6]} c={shade(c, 0.85)} r={1} />
          <B p={[0, 0.55, -d / 2 + 0.25]} s={[w - 0.2, 0.12, 0.35]} c="#ffffff" r={1} />
          <B p={[0, 0.55, -d / 2 + 0.03]} s={[w + 0.06, 1.1, 0.06]} c="#6d5a48" />
        </group>
      );
    case "guardaRoupa":
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.5} />
          {Array.from({ length: Math.max(1, Math.round(w / 0.5) - 1) }, (_, k) => {
            const doors = Math.max(1, Math.round(w / 0.5) - 1) + 1;
            return <B key={k} p={[-w / 2 + ((k + 1) * w) / doors, h / 2, d / 2 + 0.002]} s={[0.005, h - 0.04, 0.004]} c={dark} />;
          })}
        </group>
      );
    case "tapete":
      return <B p={[0, 0.006, 0]} s={[w, 0.012, d]} c={c} r={1} />;
    case "planta":
      return (
        <group>
          <C p={[0, 0.17, 0]} rt={w * 0.32} rb={w * 0.26} h={0.34} c="#b6927a" />
          <mesh position={[0, 0.34 + (h - 0.34) / 2, 0]} castShadow>
            <sphereGeometry args={[w / 2, 16, 12]} />
            <meshStandardMaterial color={c} roughness={0.9} />
          </mesh>
          <mesh position={[0.05, h - 0.12, 0.04]} castShadow>
            <sphereGeometry args={[w / 2.6, 14, 10]} />
            <meshStandardMaterial color={shade(c, 1.2)} roughness={0.9} />
          </mesh>
        </group>
      );
    case "luminaria":
      return (
        <group>
          <C p={[0, 0.015, 0]} rt={0.14} rb={0.14} h={0.03} c="#333" />
          <C p={[0, h / 2, 0]} rt={0.012} rb={0.012} h={h} c="#333" />
          <C p={[0, h - 0.12, 0]} rt={0.12} rb={w / 2} h={0.24} c={c} />
          <pointLight position={[0, h - 0.2, 0]} intensity={0.6} distance={3.5} color="#ffd9a0" />
        </group>
      );
    case "bancada":
    case "ilha":
      return (
        <group>
          <B p={[0, (h - 0.04) / 2, 0.02]} s={[w, h - 0.04, d - 0.04]} c="#cfc6b8" />
          <B p={[0, h - 0.02, 0]} s={[w, 0.03, d]} c={c} r={0.25} />
          {type === "bancada" && (
            <>
              <B p={[w * 0.05, h - 0.05, 0.02]} s={[0.5, 0.06, 0.38]} c="#9aa0a6" m={0.6} r={0.3} />
              <B p={[w / 2 - 0.3, h + 0.002, 0]} s={[0.5, 0.01, 0.45]} c="#111" r={0.2} />
            </>
          )}
        </group>
      );
    case "geladeira":
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.3} m={0.4} />
          <B p={[0, h * 0.62, d / 2 + 0.003]} s={[w - 0.02, 0.006, 0.004]} c="#888" />
          <B p={[w / 2 - 0.06, h * 0.8, d / 2 + 0.02]} s={[0.02, 0.3, 0.03]} c="#999" m={0.6} />
        </group>
      );
    case "tanque":
      return (
        <group>
          <B p={[0, h / 2 - 0.1, -d / 2 + 0.1]} s={[0.12, h - 0.2, 0.12]} c={c} />
          <B p={[0, h - 0.12, 0]} s={[w, 0.24, d]} c={c} r={0.4} />
        </group>
      );
    case "maquina":
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.4} />
          <mesh position={[0, h * 0.5, d / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 0.01, 28]} />
            <meshStandardMaterial color="#8fa3b0" roughness={0.2} metalness={0.3} />
          </mesh>
        </group>
      );
    case "vaso":
      return (
        <group>
          <B p={[0, 0.2, 0.06]} s={[0.36, 0.4, d - 0.2]} c={c} r={0.2} />
          <B p={[0, 0.55, -d / 2 + 0.09]} s={[w, 0.4, 0.18]} c={c} r={0.2} />
        </group>
      );
    case "pia":
      return (
        <group>
          <B p={[0, 0.5, 0]} s={[w, 0.5, d]} c="#cfc6b8" />
          <B p={[0, h - 0.015, 0]} s={[w, 0.03, d]} c={c} r={0.25} />
          <B p={[0, h - 0.04, 0.03]} s={[Math.min(0.45, w - 0.1), 0.05, 0.32]} c="#ffffff" r={0.15} />
        </group>
      );
    case "box":
      return (
        <group>
          <B p={[0, 0.01, 0]} s={[w, 0.02, d]} c="#d8d8d8" />
          <B p={[0, h / 2, d / 2 - 0.005]} s={[w, h, 0.01]} c={c} o={0.25} r={0.05} />
          <B p={[w / 2 - 0.005, h / 2, 0]} s={[0.01, h, d]} c={c} o={0.25} r={0.05} />
        </group>
      );
    default:
      return <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} />;
  }
}
