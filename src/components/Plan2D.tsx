"use client";

import { useMemo, useRef, useState } from "react";
import { bounds, center, polyArea, wallAxis, type Opening, type Wall } from "@/data/apartment";
import { catalogByType, type Item } from "@/data/catalog";
import { openingRect, snapTo, wallPieces } from "@/lib/geometry";
import { floorFinishes } from "@/lib/materials";
import { usePlan, useStore } from "@/lib/store";
import { usePlanColors, type PlanColors } from "@/lib/theme";
import { aspectRatio, horizontalFov, usePhoto } from "@/lib/photo";

/** câmera de foto na planta: cone de visão + corpo (arrasta = move) + alça (arrasta = mira) */
function PhotoCamMark({ onDown }: { onDown: (e: React.PointerEvent, part: "cam" | "aim") => void }) {
  const cam = usePhoto((s) => s.cam);
  if (!cam) return null;
  const hf = (horizontalFov(cam.lens, aspectRatio(cam.aspect)) * Math.PI) / 360;
  const L = 2.4;
  const a0 = -hf, a1 = hf;
  const ex = (a: number) => [Math.cos(a) * L, -Math.sin(a) * L];
  const [x0, y0] = ex(a0), [x1, y1] = ex(a1);
  const aim = 0.9;
  return (
    <g transform={`translate(${cam.x} ${-cam.y}) rotate(${-cam.yaw})`}>
      <path d={`M 0 0 L ${x0} ${y0} A ${L} ${L} 0 0 0 ${x1} ${y1} Z`} fill="#ff7a1a" fillOpacity={0.14} stroke="#ff7a1a" strokeWidth={0.015} strokeDasharray="0.06 0.04" style={{ pointerEvents: "none" }} />
      <line x1={0} y1={0} x2={aim} y2={0} stroke="#ff7a1a" strokeWidth={0.025} style={{ pointerEvents: "none" }} />
      <circle cx={aim} cy={0} r={0.09} fill="#ff7a1a" stroke="#fff" strokeWidth={0.02} style={{ cursor: "crosshair" }} onPointerDown={(e) => onDown(e, "aim")} />
      <g onPointerDown={(e) => onDown(e, "cam")} style={{ cursor: "grab" }}>
        <circle r={0.2} fill="#ff7a1a" fillOpacity={0.25} />
        <rect x={-0.1} y={-0.08} width={0.17} height={0.16} rx={0.02} fill="#2b2b2b" />
        <rect x={0.07} y={-0.05} width={0.07} height={0.1} fill="#ff7a1a" />
      </g>
    </g>
  );
}

// SVG em metros; y da planta invertido (y_svg = -y)
const PAD = 0.8;
const VB0 = { x: bounds.minX - PAD, y: -bounds.maxY - PAD, w: bounds.maxX - bounds.minX + 2 * PAD, h: bounds.maxY - bounds.minY + 2 * PAD };

function DoorSymbol({ w, o, C }: { w: Wall; o: Opening; C: PlanColors }) {
  const r = openingRect(w, o);
  const ax = wallAxis(w);
  const leaf = o.a1 - o.a0 - 0.06; // desconta os batentes
  const sw = o.swing ?? 1;
  if (ax === "x") {
    const hx = o.hinge === "end" ? o.a1 - 0.03 : o.a0 + 0.03;
    const fy = sw > 0 ? r.y1 : r.y0;
    const tipX = o.hinge === "end" ? hx - leaf : hx + leaf;
    const ey = fy + sw * leaf;
    const sweep = (o.hinge === "end") === sw > 0 ? 1 : 0;
    return (
      <g stroke={C.door} fill="none" strokeWidth={0.015}>
        <line x1={hx} y1={-fy} x2={hx} y2={-ey} strokeWidth={0.03} />
        <path d={`M ${hx} ${-ey} A ${leaf} ${leaf} 0 0 ${sweep} ${tipX} ${-fy}`} strokeDasharray="0.05 0.04" />
      </g>
    );
  }
  const hy = o.hinge === "end" ? o.a1 - 0.03 : o.a0 + 0.03;
  const fx = sw > 0 ? r.x1 : r.x0;
  const tipY = o.hinge === "end" ? hy - leaf : hy + leaf;
  const ex = fx + sw * leaf;
  const sweep = (o.hinge === "end") === sw > 0 ? 0 : 1;
  return (
    <g stroke={C.door} fill="none" strokeWidth={0.015}>
      <line x1={fx} y1={-hy} x2={ex} y2={-hy} strokeWidth={0.03} />
      <path d={`M ${ex} ${-hy} A ${leaf} ${leaf} 0 0 ${sweep} ${fx} ${-tipY}`} strokeDasharray="0.05 0.04" />
    </g>
  );
}

// Medidas do "Quadro de Esquadrias" do DWG (largura × altura, peitoril)
const ESQ: Record<string, { w: number; h: number; sill: number; type: "correr" | "maxim-ar" }> = {
  EA1: { w: 2.0, h: 2.2, sill: 0, type: "correr" },
  EA3: { w: 1.2, h: 1.1, sill: 1.1, type: "correr" },
  EA5: { w: 0.6, h: 0.6, sill: 1.6, type: "maxim-ar" },
  EA27: { w: 1.0, h: 1.1, sill: 1.1, type: "correr" },
};
const br = (n: number) => n.toFixed(2).replace(".", ",");

function WindowSymbol({ w, o, C }: { w: Wall; o: Opening; C: PlanColors }) {
  const GLASS = C.glass;
  const r = openingRect(w, o);
  const isX = wallAxis(w) === "x";
  // eixo "a" = ao longo da parede, eixo "t" = espessura
  const a0 = o.a0, a1 = o.a1;
  const t0 = isX ? r.y0 : r.x0, t1 = isX ? r.y1 : r.x1;
  const T = t1 - t0;
  // lado de fora = o mais longe do centro do apto
  const outward = (isX ? (t0 + t1) / 2 - center[1] : (t0 + t1) / 2 - center[0]) > 0 ? 1 : -1;
  // etiqueta da EA1 vai para o lado da sala (a varanda é estreita)
  const labelSide = o.label === "EA1" ? -1 : outward;
  const P = (a: number, t: number): [number, number] => (isX ? [a, -t] : [t, -a]);
  const L = (aA: number, tA: number, aB: number, tB: number, stroke: string, sw: number, key: string) => {
    const [x1, y1] = P(aA, tA), [x2, y2] = P(aB, tB);
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" />;
  };
  const spec = ESQ[o.label];
  const fr = 0.03; // batente
  const els: React.ReactNode[] = [];
  // vão limpo
  const [rx, ry] = isX ? [r.x0, -r.y1] : [r.x0, -r.y1];
  els.push(<rect key="bg" x={rx} y={ry} width={r.x1 - r.x0} height={r.y1 - r.y0} fill={C.bg} />);
  // peitoril / soleira: linhas finas nas duas faces
  if (o.sill > 0) {
    els.push(L(a0, t0, a1, t0, C.wall, 0.012, "f0"), L(a0, t1, a1, t1, C.wall, 0.012, "f1"));
  }
  // batentes (ombreiras)
  els.push(L(a0, t0, a0, t1, C.wall, 0.025, "j0"), L(a1, t0, a1, t1, C.wall, 0.025, "j1"));
  els.push(L(a0 + fr, t0 + T * 0.2, a0 + fr, t1 - T * 0.2, GLASS, 0.015, "k0"), L(a1 - fr, t0 + T * 0.2, a1 - fr, t1 - T * 0.2, GLASS, 0.015, "k1"));
  const in0 = a0 + fr, in1 = a1 - fr, span = in1 - in0;
  if ((spec?.type ?? "correr") === "correr") {
    // duas folhas de correr sobrepostas, em trilhos diferentes
    const ov = Math.min(0.06, span * 0.08);
    const tA = t0 + T * 0.38, tB = t0 + T * 0.62;
    els.push(L(in0, tA, in0 + span / 2 + ov, tA, GLASS, 0.03, "g0"), L(in1 - span / 2 - ov, tB, in1, tB, GLASS, 0.03, "g1"));
    // puxadores / seta de correr
    els.push(L(in0 + span / 2 + ov, tA - T * 0.12, in0 + span / 2 + ov, tA + T * 0.12, GLASS, 0.012, "h0"), L(in1 - span / 2 - ov, tB - T * 0.12, in1 - span / 2 - ov, tB + T * 0.12, GLASS, 0.012, "h1"));
  } else {
    // maxim-ar: folha única + marca de abertura
    const tm = (t0 + t1) / 2;
    els.push(L(in0, tm, in1, tm, GLASS, 0.03, "g"));
    const [cx, cy] = P((in0 + in1) / 2, tm + outward * T * 0.5);
    const [ax, ay] = P(in0, tm), [bx, by] = P(in1, tm);
    els.push(<polyline key="m" points={`${ax},${ay} ${cx},${cy} ${bx},${by}`} fill="none" stroke={GLASS} strokeWidth={0.01} strokeDasharray="0.03 0.025" />);
  }
  // etiqueta do lado de fora
  const am = (a0 + a1) / 2;
  const tLab = (labelSide > 0 ? t1 : t0) + labelSide * 0.2;
  const [lx, ly] = P(am, tLab);
  const sizes = spec ? `${br(spec.w)} × ${br(spec.h)}${spec.sill ? ` · peit. ${br(spec.sill)}` : ""}` : "";
  const rot = isX ? 0 : -90;
  els.push(
    <g key="lab" transform={`translate(${lx} ${ly}) rotate(${rot})`} style={{ pointerEvents: "none" }}>
      <text fontSize={0.13} textAnchor="middle" fill={GLASS} fontWeight={700} y={labelSide > 0 === isX ? 0 : 0.08}>
        {o.label}
        <tspan fontSize={0.095} fontWeight={400} fill={C.glassSub}>{sizes ? `  ${sizes}` : ""}</tspan>
      </text>
    </g>,
  );
  return <g>{els}</g>;
}

function ItemShape({ item, onDown, C }: { item: Item; onDown: (e: React.PointerEvent, it: Item) => void; C: PlanColors }) {
  const selection = useStore((s) => s.selection);
  const sel = selection?.kind === "item" && selection.id === item.id;
  const name = catalogByType[item.type]?.name ?? item.type;
  const small = Math.min(item.w, item.d) < 0.5;
  return (
    <g transform={`translate(${item.x} ${-item.y}) rotate(${-item.rot})`} onPointerDown={(e) => onDown(e, item)} style={{ cursor: "grab" }}>
      <rect
        x={-item.w / 2}
        y={-item.d / 2}
        width={item.w}
        height={item.d}
        rx={item.type === "tapete" ? 0 : 0.03}
        fill={item.color}
        fillOpacity={item.type === "tapete" ? 0.35 : 0.55}
        stroke={sel ? "#ff7a1a" : item.fixed ? C.itemFixedStroke : C.itemStroke}
        strokeWidth={sel ? 0.035 : 0.015}
      />
      {/* marca da "frente" */}
      <line x1={-item.w / 2 + 0.04} x2={item.w / 2 - 0.04} y1={item.d / 2 - 0.03} y2={item.d / 2 - 0.03} stroke="#0003" strokeWidth={0.02} />
      {!small && (
        <text fontSize={0.11} textAnchor="middle" dominantBaseline="middle" fill={C.itemText} style={{ pointerEvents: "none" }} transform={`rotate(${item.rot})`}>
          {name}
        </text>
      )}
    </g>
  );
}

export default function Plan2D() {
  const items = useStore((s) => s.items);
  const removed = useStore((s) => s.removedWalls);
  const floors = useStore((s) => s.floors);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const moveItem = useStore((s) => s.moveItem);
  const commit = useStore((s) => s.commit);
  const snap = useStore((s) => s.snap);
  const toggleWall = useStore((s) => s.toggleWall);
  // só visualização: tocar em móvel/parede/cômodo não seleciona — o gesto segue para mover a vista
  const viewOnly = useStore((s) => s.viewOnly);
  const { walls, rooms } = usePlan();
  const C = usePlanColors();
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState(VB0);
  const drag = useRef<
    | { kind: "item"; id: string; dx: number; dy: number; moved: boolean }
    | { kind: "pan"; sx: number; sy: number; vb: typeof VB0 }
    | { kind: "cam"; dx: number; dy: number }
    | { kind: "aim" }
    | null
  >(null);

  const toPlan = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: -p.y };
  };

  const onItemDown = (e: React.PointerEvent, it: Item) => {
    if (viewOnly) return;
    e.stopPropagation();
    select({ kind: "item", id: it.id });
    const p = toPlan(e);
    drag.current = { kind: "item", id: it.id, dx: it.x - p.x, dy: it.y - p.y, moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const placing = usePhoto((p) => p.placing);
  const onCamDown = (e: React.PointerEvent, part: "cam" | "aim") => {
    e.stopPropagation();
    const c = usePhoto.getState().cam!;
    const p = toPlan(e);
    drag.current = part === "cam" ? { kind: "cam", dx: c.x - p.x, dy: c.y - p.y } : { kind: "aim" };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  // posicionando: o clique vai para a câmera antes de qualquer outro elemento
  const onPlaceDown = (e: React.PointerEvent) => {
    if (!usePhoto.getState().placing || e.button !== 0) return;
    e.stopPropagation();
    const p = toPlan(e);
    usePhoto.getState().place(p.x, p.y);
    drag.current = { kind: "aim" };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onBgDown = (e: React.PointerEvent) => {
    drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vb };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "cam" || d.kind === "aim") {
      const p = toPlan(e);
      if (d.kind === "cam") usePhoto.getState().place(p.x + d.dx, p.y + d.dy);
      else usePhoto.getState().aimAt(p.x, p.y);
      return;
    }
    if (d.kind === "item") {
      if (!d.moved) {
        commit();
        d.moved = true;
      }
      const p = toPlan(e);
      let x = p.x + d.dx;
      let y = p.y + d.dy;
      if (snap) {
        x = snapTo(x);
        y = snapTo(y);
      }
      moveItem(d.id, x, y);
    } else {
      const rect = svgRef.current!.getBoundingClientRect();
      const k = Math.max(d.vb.w / rect.width, d.vb.h / rect.height);
      setVb({ ...d.vb, x: d.vb.x - (e.clientX - d.sx) * k, y: d.vb.y - (e.clientY - d.sy) * k });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d?.kind === "pan" && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) select(null);
    if (d?.kind === "aim" && usePhoto.getState().placing) usePhoto.getState().setPlacing(false);
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    const p = toPlan(e);
    const f = Math.exp(e.deltaY * 0.0015);
    const px = p.x, py = -p.y;
    setVb((v) => ({ x: px - (px - v.x) * f, y: py - (py - v.y) * f, w: v.w * f, h: v.h * f }));
  };

  const total = useMemo(() => rooms.reduce((a, r) => a + polyArea(r.poly), 0), [rooms]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: C.bg }}>
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ width: "100%", height: "100%", touchAction: "none", userSelect: "none", cursor: placing ? "crosshair" : undefined }}
        onPointerDown={onBgDown}
        onPointerDownCapture={onPlaceDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onWheel={onWheel}
      >
        <defs>
          <pattern id="grid" width={0.5} height={0.5} patternUnits="userSpaceOnUse">
            <path d="M 0.5 0 L 0 0 0 0.5" fill="none" stroke={C.grid} strokeWidth={0.01} />
          </pattern>
          <pattern id="removed" width={0.08} height={0.08} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={0.08} stroke="#e07a5f" strokeWidth={0.015} />
          </pattern>
        </defs>
        <rect x={vb.x - 50} y={vb.y - 50} width={vb.w + 100} height={vb.h + 100} fill="url(#grid)" />

        {/* pisos */}
        {rooms.map((r) => {
          const sel = selection?.kind === "room" && selection.id === r.id;
          return (
            <polygon
              key={r.id}
              points={r.poly.map(([x, y]) => `${x},${-y}`).join(" ")}
              fill={floorFinishes[floors[r.id] ?? r.floor].color}
              fillOpacity={sel ? 0.75 : C.floorOpacity}
              stroke={sel ? "#ff7a1a" : "none"}
              strokeWidth={0.03}
              onPointerDown={(e) => {
                if (viewOnly) return;
                e.stopPropagation();
                select({ kind: "room", id: r.id });
              }}
            />
          );
        })}
        {/* piso sob portas / paredes removidas */}
        {walls.flatMap((w) =>
          removed.includes(w.id) ? [] : (w.openings ?? []).filter((o) => o.sill === 0).map((o, i) => {
            const r = openingRect(w, o);
            return <rect key={`${w.id}-t${i}`} x={r.x0} y={-r.y1} width={r.x1 - r.x0} height={r.y1 - r.y0} fill={C.threshold} />;
          }),
        )}

        {/* rótulos dos cômodos */}
        {rooms.map((r) => (
          <g key={`l-${r.id}`} style={{ pointerEvents: "none" }}>
            <text x={r.label[0]} y={-r.label[1]} fontSize={0.2} textAnchor="middle" fill={C.text} fontWeight={600}>
              {r.name}
            </text>
            <text x={r.label[0]} y={-r.label[1] + 0.22} fontSize={0.13} textAnchor="middle" fill={C.subtext}>
              {polyArea(r.poly).toFixed(2)} m²
            </text>
          </g>
        ))}

        {/* paredes */}
        {walls.map((w) => {
          const isRemoved = removed.includes(w.id);
          const sel = selection?.kind === "wall" && selection.id === w.id;
          const onDown = (e: React.PointerEvent) => {
            if (viewOnly) return;
            e.stopPropagation();
            select({ kind: "wall", id: w.id });
          };
          if (isRemoved)
            return (
              <rect key={w.id} x={w.x0} y={-w.y1} width={w.x1 - w.x0} height={w.y1 - w.y0} fill="url(#removed)" stroke="#e07a5f" strokeWidth={0.012} strokeDasharray="0.05 0.04" onPointerDown={onDown} onDoubleClick={() => toggleWall(w.id)} />
            );
          const pieces = wallPieces(w, 2.6).filter((p) => p.z0 === 0 && p.z1 > 1.5);
          const fill = sel ? "#ff8a3d" : w.kind === "pillar" ? C.pillar : w.kind === "parapet" ? "#9ec5d6" : C.wall;
          return (
            <g key={w.id} onPointerDown={onDown} style={{ cursor: "pointer" }}>
              {w.kind === "parapet" ? (
                <rect x={w.x0} y={-w.y1} width={w.x1 - w.x0} height={w.y1 - w.y0} fill={fill} fillOpacity={0.7} />
              ) : (
                pieces.map((p, i) => <rect key={i} x={p.x0} y={-p.y1} width={p.x1 - p.x0} height={p.y1 - p.y0} fill={fill} />)
              )}
              {(w.openings ?? []).map((o, i) =>
                o.kind === "door" ? <DoorSymbol key={i} w={w} o={o} C={C} /> : <WindowSymbol key={i} w={w} o={o} C={C} />,
              )}
            </g>
          );
        })}

        {/* móveis */}
        {items.map((it) => (
          <ItemShape key={it.id} item={it} onDown={onItemDown} C={C} />
        ))}

        <PhotoCamMark onDown={onCamDown} />

        {/* norte + escala */}
        <g transform={`translate(${bounds.maxX + 0.35} ${-bounds.maxY + 0.2})`} style={{ pointerEvents: "none" }}>
          <path d="M 0 -0.25 L 0.1 0.05 L 0 0 L -0.1 0.05 Z" fill={C.subtext} />
          <text y={0.25} fontSize={0.14} textAnchor="middle" fill={C.subtext}>N</text>
        </g>
        <g transform={`translate(${bounds.minX} ${-bounds.minY + 0.45})`} style={{ pointerEvents: "none" }}>
          <rect width={1} height={0.04} fill={C.subtext} />
          <rect x={1} width={1} height={0.04} fill="#aaa" />
          <text x={0} y={0.2} fontSize={0.12} fill={C.subtext}>0</text>
          <text x={1} y={0.2} fontSize={0.12} fill={C.subtext} textAnchor="middle">1 m</text>
          <text x={2} y={0.2} fontSize={0.12} fill={C.subtext} textAnchor="middle">2 m</text>
        </g>
      </svg>
      <div style={{ position: "absolute", left: 12, top: 10, fontSize: 12, color: C.subtext, pointerEvents: "none" }}>
        Área útil dos cômodos: {total.toFixed(2)} m² · planta oficial: 52,71 m² (inclui paredes)
      </div>
      <button
        onClick={() => setVb(VB0)}
        style={{ position: "absolute", right: 12, bottom: 10 }}
        className="chip"
      >
        Enquadrar
      </button>
    </div>
  );
}
