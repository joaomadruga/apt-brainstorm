"use client";

import * as THREE from "three";
import { CEILING, type Opening, type Wall } from "@/data/apartment";
import { catalogByType, entryName, type Item } from "@/data/catalog";
import { floorFinishes, wallPalette } from "./materials";
import { resolvePlan, roomAt } from "./plan";
import { useStore } from "./store";

// ------------------------------------------------------------------ o que aparece no quadro
// Lança uma grade de raios pela câmera e anota o primeiro objeto opaco de cada raio
// (vidro é atravessado). Cada mesh da cena carrega `userData.tag` no grupo pai.

export type Tag =
  | { kind: "item"; id: string }
  | { kind: "wall"; id: string }
  | { kind: "opening"; wall: string; index: number }
  | { kind: "floor"; id: string }
  | { kind: "ceiling" };

export interface Seen {
  /** fração do quadro (0..1) */
  share: number;
  /** centro médio em NDC (-1..1; x = esquerda→direita, y = baixo→cima) */
  nx: number;
  ny: number;
  /** menor distância até a câmera (m) */
  dist: number;
  /** encosta na borda do quadro (cortado) */
  edge: boolean;
}

export interface FrameReport {
  items: Map<string, Seen>;
  walls: Map<string, Seen>;
  openings: Map<string, Seen>; // chave "wallId:index"
  floors: Map<string, Seen>;
  ceiling: number;
  /** fração do quadro vendo o lado de fora (céu/vizinhança), direto ou através de vidro */
  outside: number;
}

const tagOf = (o: THREE.Object3D | null): Tag | null => {
  for (let p = o; p; p = p.parent) if (p.userData?.tag) return p.userData.tag as Tag;
  return null;
};
const keyOf = (t: Tag) => (t.kind === "opening" ? `${t.wall}:${t.index}` : t.kind === "ceiling" ? "ceiling" : t.id);

const isSeeThrough = (m: THREE.Mesh) => {
  const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material & { opacity?: number };
  return mat.transparent && (mat.opacity ?? 1) < 0.7;
};

export function analyzeFrame(scene: THREE.Object3D, cam: THREE.Camera, layers: number[], aspect: number, cols = 80): FrameReport {
  const rows = Math.max(12, Math.round(cols / aspect));
  const rc = new THREE.Raycaster();
  rc.layers.disableAll();
  layers.forEach((l) => rc.layers.enable(l));
  const acc = { items: new Map(), walls: new Map(), openings: new Map(), floors: new Map() } as Record<"items" | "walls" | "openings" | "floors", Map<string, { n: number; sx: number; sy: number; d: number; edge: boolean }>>;
  let ceiling = 0, outside = 0;
  const bucket = { item: "items", wall: "walls", opening: "openings", floor: "floors" } as const;
  const add = (t: Tag, nx: number, ny: number, d: number, edge: boolean) => {
    if (t.kind === "ceiling") return void ceiling++;
    const m = acc[bucket[t.kind]];
    const k = keyOf(t);
    const e = m.get(k) ?? { n: 0, sx: 0, sy: 0, d: Infinity, edge: false };
    e.n++;
    e.sx += nx;
    e.sy += ny;
    e.d = Math.min(e.d, d);
    e.edge ||= edge;
    m.set(k, e);
  };
  const ndc = new THREE.Vector2();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      ndc.set(((c + 0.5) / cols) * 2 - 1, ((r + 0.5) / rows) * 2 - 1);
      const edge = c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
      rc.setFromCamera(ndc, cam);
      let opaque = false;
      const seenHere = new Set<string>();
      for (const h of rc.intersectObject(scene, true)) {
        const m = h.object as THREE.Mesh;
        if (!m.isMesh || m.userData.helper) continue;
        const t = tagOf(m);
        if (!t) continue;
        const k = `${t.kind}:${keyOf(t)}`;
        if (!seenHere.has(k)) {
          seenHere.add(k);
          add(t, ndc.x, ndc.y, h.distance, edge);
        }
        if (isSeeThrough(m)) continue;
        opaque = true;
        break;
      }
      if (!opaque) outside++;
    }
  const total = rows * cols;
  const fin = (m: Map<string, { n: number; sx: number; sy: number; d: number; edge: boolean }>) =>
    new Map([...m].map(([k, e]) => [k, { share: e.n / total, nx: e.sx / e.n, ny: e.sy / e.n, dist: e.d, edge: e.edge }] as const));
  return { items: fin(acc.items), walls: fin(acc.walls), openings: fin(acc.openings), floors: fin(acc.floors), ceiling: ceiling / total, outside: outside / total };
}

// ------------------------------------------------------------------ vocabulário do prompt
const EN: Record<string, string> = {
  sofa: "3-seat sofa", poltrona: "armchair", mesaCentro: "coffee table", rack: "low TV console", tv: '55" flat-screen TV',
  estante: "bookshelf", mesaJantar: "4-seat dining table", cadeira: "dining chair", banqueta: "bar stool",
  ilha: "kitchen island counter", camaCasal: "queen-size bed", camaSolteiro: "single bed", criado: "nightstand",
  guardaRoupa: "wardrobe", escrivaninha: "desk", divisoria: "folding partition screen", tapete: "rug", planta: "potted plant",
  luminaria: "floor lamp", bancada: "kitchen countertop with sink and cooktop", geladeira: "refrigerator", tanque: "laundry sink",
  maquina: "washing machine", vaso: "toilet", pia: "bathroom vanity with washbasin", box: "glass shower enclosure",
};
const furnitureName = (type: string) => catalogByType[type]?.prompt ?? EN[type] ?? entryName(type);

/** nome aproximado de uma cor em inglês (o modelo de imagem entende melhor que hex) */
export function colorName(hex: string) {
  const c = new THREE.Color(hex);
  const { h, s, l } = c.getHSL({ h: 0, s: 0, l: 0 });
  const chroma = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  const warm = h < 0.17 || h > 0.9;
  const light = l > 0.8 ? "very light " : l > 0.62 ? "light " : l < 0.18 ? "very dark " : l < 0.35 ? "dark " : "";
  if (chroma < 0.04 || s < 0.08) return l > 0.9 ? "white" : l < 0.1 ? "black" : `${light}grey`.trim();
  if (chroma < 0.13 && l > 0.78) return warm ? "warm off-white" : "cool off-white";
  if (chroma < 0.13) return `${light}${warm ? "greige" : "grey"}`;
  const deg = h * 360;
  const hue =
    deg < 15 || deg >= 345 ? "red" : deg < 40 ? (l < 0.5 ? "brown" : "terracotta orange") : deg < 55 ? (s < 0.45 ? "beige" : "ochre") : deg < 70 ? "yellow" :
    deg < 160 ? (s < 0.35 ? "sage green" : "green") : deg < 200 ? "teal" : deg < 255 ? (s < 0.35 ? "slate blue" : "blue") : deg < 290 ? "purple" : "pink";
  return `${light}${hue}`;
}

const hPos = (nx: number) => (nx < -0.45 ? "far left" : nx < -0.15 ? "left" : nx <= 0.15 ? "center" : nx <= 0.45 ? "right" : "far right");
const depth = (d: number) => (d < 1.4 ? "foreground" : d < 3.2 ? "midground" : "background");
const pct = (s: number) => (s >= 0.01 ? `~${Math.round(s * 100)}% of frame` : "small");
const m2 = (n: number) => n.toFixed(2);

function openingText(w: Wall, o: Opening) {
  const wd = m2(o.a1 - o.a0);
  const hh = m2(o.head - o.sill);
  if (o.kind === "door") return `hinged wooden interior door ${wd} m wide × ${m2(o.head)} m high, painted white frame, standing open`;
  if (o.label === "EA1" || o.sill === 0) return `full-height sliding glass door ${wd} × ${hh} m to the balcony, two clear-glass panels in slim silver aluminium frames`;
  if (o.label === "EA5") return `small top-hung awning window ${wd} × ${hh} m high on the wall (sill ${m2(o.sill)} m), frosted glass, slightly open`;
  return `horizontal sliding window ${wd} × ${hh} m, sill at ${m2(o.sill)} m with a light granite ledge, two clear-glass panels in silver aluminium frames${w.kind === "ext" ? ", looking outside" : ""}`;
}

// ------------------------------------------------------------------ prompt
export interface ShotMeta {
  kind: "photo" | "view";
  camera: { x: number; y: number; z: number; dir: { x: number; y: number; z: number }; fov: number };
  lens?: number;
  aspect: string;
}

const MIN_SHARE = 0.0015;
const ROOM_EN: Record<string, string> = {
  hall: "entrance hall", cozinha: "kitchen", sala: "living room", varanda: "balcony", circ: "hallway",
  suite: "master bedroom", "bwc-suite": "en-suite bathroom", "bwc-social": "bathroom", quarto: "bedroom",
};

export function buildFramePrompt(r: FrameReport, meta: ShotMeta) {
  const st = useStore.getState();
  const { rooms, walls } = resolvePlan(st);
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const roomName = (id: string) => ROOM_EN[id] ?? rooms.find((x) => x.id === id)?.name ?? id;
  const cam = meta.camera;
  const here = roomAt(rooms, cam.x, cam.y);
  const deg = (Math.atan2(cam.dir.y, cam.dir.x) * 180) / Math.PI;
  const compass = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"][Math.round(((deg + 360) % 360) / 45) % 8];
  const pitch = (Math.asin(Math.max(-1, Math.min(1, cam.dir.z))) * 180) / Math.PI;
  const hFov = (2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * aspectOf(meta.aspect)) * 180) / Math.PI;
  const isPhoto = meta.kind === "photo";

  // cômodos visíveis (pelo piso)
  const floorsSeen = [...r.floors].filter(([, s]) => s.share >= MIN_SHARE).sort((a, b) => b[1].share - a[1].share);
  // agrupa cômodos com o mesmo piso (evita repetir a descrição)
  const byFinish = new Map<string, string[]>();
  for (const [id, s] of floorsSeen) {
    const f = floorFinishes[st.floors[id] ?? rooms.find((x) => x.id === id)?.floor ?? "madeira"].prompt;
    byFinish.set(f, [...(byFinish.get(f) ?? []), `${roomName(id)} (${depth(s.dist)}, ${pct(s.share)})`]);
  }
  const roomsTxt = [...byFinish].map(([f, rs]) => `${rs.join(", ")}: ${f}`).join("; ");

  // paredes visíveis: cor + guarda-corpo
  const wallColors = new Map<string, number>();
  let railing: Seen | null = null;
  for (const [id, s] of r.walls) {
    const w = wallById.get(id);
    if (!w || s.share < MIN_SHARE) continue;
    if (w.kind === "parapet") railing = s;
    else if (w.kind !== "pillar") {
      const c = st.wallColors[id] ?? st.wallColor;
      wallColors.set(c, (wallColors.get(c) ?? 0) + s.share);
    }
  }
  const paint = [...wallColors]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => {
      const n = wallPalette.find((p) => p.color === c)?.name;
      return `${colorName(c)} matte paint${n ? ` ("${n}")` : ""}`;
    });

  // esquadrias
  const openings = [...r.openings]
    .filter(([, s]) => s.share >= MIN_SHARE)
    .sort((a, b) => a[1].nx - b[1].nx)
    .map(([k, s]) => {
      const [wid, i] = k.split(":");
      const w = wallById.get(wid);
      const o = w?.openings?.[Number(i)];
      return w && o ? `${openingText(w, o)} — ${hPos(s.nx)}, ${depth(s.dist)}${s.edge ? ", cut by the frame edge" : ""}` : "";
    })
    .filter(Boolean);
  if (railing) openings.push(`frameless glass balcony railing 1.10 m high with a slim aluminium top rail — ${hPos(railing.nx)}, ${depth(railing.dist)}`);

  // móveis: agrupa iguais na mesma região do quadro
  const groups = new Map<string, { item: Item; s: Seen; n: number }>();
  for (const [id, s] of r.items) {
    const it = st.items.find((x) => x.id === id);
    if (!it || s.share < MIN_SHARE) continue;
    const k = `${it.type}|${it.color ?? ""}|${hPos(s.nx)}|${depth(s.dist)}`;
    const g = groups.get(k);
    if (g) {
      g.n++;
      g.s = { ...g.s, share: g.s.share + s.share, edge: g.s.edge || s.edge };
    } else groups.set(k, { item: it, s, n: 1 });
  }
  const furniture = [...groups.values()]
    .sort((a, b) => a.s.nx - b.s.nx)
    .map(({ item, s, n }) => {
      const color = item.color ?? catalogByType[item.type]?.color;
      const size = `${m2(item.w)} × ${m2(item.d)} m, ${m2(item.h)} m tall`;
      return `${n > 1 ? `${n} × ` : ""}${furnitureName(item.type)} (${size}${color ? `, ${colorName(color)}` : ""}) — ${hPos(s.nx)}, ${depth(s.dist)}, ${pct(s.share)}${s.edge ? ", partly cut by the frame edge" : ""}`;
    });

  const hh = Math.floor(st.hour), mm = Math.round((st.hour % 1) * 60);
  const night = st.hour > 17.7 || st.hour < 6.3;
  const removed = st.removedWalls.map((id) => wallById.get(id)?.name).filter(Boolean);
  const list = (xs: string[]) => xs.map((x, i) => `  ${i + 1}. ${x}`).join("\n");

  return [
    isPhoto
      ? "Create a photorealistic interior photograph from the attached reference render. The reference is a simple 3D mock-up of a real 52 m² apartment in Recife, Brazil; it is the ground truth for geometry and composition."
      : "Create a photorealistic architectural visualization from the attached reference render (a cut-away 3D model of a 52 m² apartment in Recife, Brazil). The reference is the ground truth for geometry and composition.",
    "",
    "HARD CONSTRAINTS",
    `- Keep the exact camera position, angle, perspective, framing and ${meta.aspect} aspect ratio of the reference.`,
    "- Keep every wall, door, window and furniture piece exactly where it is, with the same size, shape and proportions.",
    "- The frame contains ONLY the elements listed below. Do not add anything that is not listed (no extra furniture, decor, artwork, plants, rugs, lamps, curtains, people or text) and do not remove or move listed elements.",
    "- Only upgrade flat colors to realistic materials, textures, lighting and depth.",
    "",
    "CAMERA",
    isPhoto
      ? `- Handheld eye-level photo: lens ${m2(cam.z)} m above the floor, standing in the ${here ? roomName(here.id) : "apartment"}, facing ${compass}, ${Math.abs(pitch) < 1 ? "level" : `tilted ${Math.abs(pitch).toFixed(0)}° ${pitch < 0 ? "down" : "up"}`}; ${meta.lens} mm full-frame lens (~${hFov.toFixed(0)}° horizontal field of view), vertical lines kept straight.`
      : `- ${pitch < -60 ? "Top-down" : "Elevated three-quarter"} view of the cut-away model, facing ${compass}, pitch ${pitch.toFixed(0)}°, ~${hFov.toFixed(0)}° horizontal field of view.`,
    "",
    "SPACE IN FRAME",
    roomsTxt ? `- Rooms / floors: ${roomsTxt}.` : "",
    paint.length ? `- Walls: ${paint.join("; ")}.${isPhoto ? ` Ceiling height ${m2(CEILING)} m.` : ""}` : "",
    r.ceiling >= MIN_SHARE ? "- Ceiling: flat smooth white plaster ceiling, no moldings, no light fixtures unless listed." : "",
    removed.length ? `- Open plan: these walls were removed in this layout: ${removed.join(", ")}.` : "",
    openings.length ? `- Doors and windows in frame (left → right):\n${list(openings)}` : "- No doors or windows in frame.",
    "",
    furniture.length ? `FURNITURE IN FRAME (left → right)\n${list(furniture)}` : "FURNITURE IN FRAME\n  none — the visible area is empty; keep it empty.",
    "",
    "LIGHT AND ATMOSPHERE",
    `- Time ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}, ${night ? "night: warm interior lighting, dark sky outside" : "bright tropical natural daylight coming through the windows, soft realistic shadows"}.`,
    r.outside >= 0.01 ? `- Outside the glass (${pct(r.outside)}): ${night ? "night city lights" : "bright sky and softly out-of-focus neighboring residential towers"}, slightly overexposed like a real interior photo.` : "",
    "",
    "STYLE",
    "- Contemporary Brazilian apartment, natural textures, realistic scale, 35 mm photography look, high dynamic range, sharp focus, no people, no text, no watermark.",
  ]
    .filter((l) => l !== "")
    .join("\n")
    .replace(/\n(HARD|CAMERA|SPACE|FURNITURE|LIGHT|STYLE)/g, "\n\n$1");
}

function aspectOf(a: string) {
  const [w, h] = a.split(":").map(Number);
  return w && h ? w / h : 1.5;
}
