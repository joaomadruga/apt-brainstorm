// Formato dos arquivos commitados no repositório:
//   /versions/<id>.json   → uma versão da planta
//   /furniture/<tipo>.json → um móvel paramétrico
// Tudo que for omitido numa versão assume o valor do projeto original.

import { rooms as baseRooms, walls as baseWalls, type FloorFinish, type Room, type Wall } from "@/data/apartment";
import { GROUPS, catalogByType, initialItems, type CatalogEntry, type Item } from "@/data/catalog";
import { floorFinishes } from "./materials";
import { resolvePlan } from "./plan";

export interface VersionFile {
  id: string; // = nome do arquivo sem .json (kebab-case)
  name: string;
  description?: string;
  author?: string;
  updatedAt: string; // ISO 8601 — atualize sempre que editar o arquivo
  items?: Item[];
  removedWalls?: string[];
  floors?: Partial<Record<string, FloorFinish>>;
  wallColor?: string;
  wallColors?: Record<string, string>;
  extraWalls?: Wall[];
  rooms?: Room[];
  removedRooms?: string[];
}

export interface Snapshot {
  items: Item[];
  removedWalls: string[];
  floors: Record<string, FloorFinish>;
  wallColors: Record<string, string>;
  wallColor: string;
  extraWalls: Wall[];
  rooms: Room[];
  removedRooms: string[];
}

export const DEFAULT_WALL_COLOR = "#f3efe8";
export const initialFloors = Object.fromEntries(baseRooms.map((r) => [r.id, r.floor])) as Record<string, FloorFinish>;

export const originalSnapshot = (): Snapshot => ({
  items: initialItems,
  removedWalls: [],
  floors: initialFloors,
  wallColors: {},
  wallColor: DEFAULT_WALL_COLOR,
  extraWalls: [],
  rooms: [],
  removedRooms: [],
});

/** completa um snapshot parcial (ex.: salvo por uma versão antiga do app) */
export const normalizeSnapshot = (p: Partial<Snapshot>): Snapshot => {
  const o = originalSnapshot();
  return {
    items: p.items ?? o.items,
    removedWalls: p.removedWalls ?? [],
    floors: { ...o.floors, ...(p.floors ?? {}) },
    wallColors: p.wallColors ?? {},
    wallColor: p.wallColor ?? o.wallColor,
    extraWalls: p.extraWalls ?? [],
    rooms: p.rooms ?? [],
    removedRooms: p.removedRooms ?? [],
  };
};

export const fileToSnapshot = (f: VersionFile): Snapshot =>
  normalizeSnapshot({ ...f, floors: f.floors as Record<string, FloorFinish> | undefined });

export function snapshotToFile(id: string, name: string, s: Snapshot, extra: Partial<VersionFile> = {}): VersionFile {
  const o = originalSnapshot();
  const floorsDiff = Object.fromEntries(Object.entries(s.floors).filter(([k, v]) => o.floors[k] !== v));
  const r3 = (n: number) => Math.round(n * 1000) / 1000; // milímetro
  const items = s.items.map((i) => ({ ...i, x: r3(i.x), y: r3(i.y), w: r3(i.w), d: r3(i.d), h: r3(i.h), rot: r3(i.rot) }));
  const f: VersionFile = { id, name, ...extra, updatedAt: new Date().toISOString(), items };
  if (s.removedWalls.length) f.removedWalls = s.removedWalls;
  if (Object.keys(floorsDiff).length) f.floors = floorsDiff;
  if (s.wallColor !== o.wallColor) f.wallColor = s.wallColor;
  if (Object.keys(s.wallColors).length) f.wallColors = s.wallColors;
  if (s.extraWalls.length) f.extraWalls = s.extraWalls;
  if (s.rooms.length) f.rooms = s.rooms;
  if (s.removedRooms.length) f.removedRooms = s.removedRooms;
  return f;
}

export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "versao";

// ------------------------------------------------------------------ validação
const FINISHES = Object.keys(floorFinishes) as FloorFinish[];
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const isHex = (v: unknown) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

function checkWall(w: Wall, where: string, err: (m: string) => void) {
  if (!w || typeof w.id !== "string") return err(`${where}: parede sem id`);
  for (const k of ["x0", "y0", "x1", "y1"] as const) if (!isNum(w[k])) err(`${where} (${w.id}): ${k} precisa ser número`);
  if (w.x1 <= w.x0 || w.y1 <= w.y0) err(`${where} (${w.id}): precisa x1 > x0 e y1 > y0 (retângulo em planta)`);
  if (!["ext", "int", "pillar", "parapet"].includes(w.kind)) err(`${where} (${w.id}): kind inválido "${w.kind}"`);
  const along = w.x1 - w.x0 >= w.y1 - w.y0 ? [w.x0, w.x1] : [w.y0, w.y1];
  for (const o of w.openings ?? []) {
    if (!["door", "window", "slider"].includes(o.kind)) err(`${where} (${w.id}): abertura com kind inválido`);
    if (!(o.a0 < o.a1) || o.a0 < along[0] - 1e-6 || o.a1 > along[1] + 1e-6)
      err(`${where} (${w.id}): abertura ${o.label} fora da parede (a0/a1 devem ficar entre ${along[0]} e ${along[1]})`);
    if (!(o.sill >= 0 && o.head > o.sill)) err(`${where} (${w.id}): abertura ${o.label} precisa head > sill >= 0`);
  }
}

export function validateVersionFile(f: VersionFile, fileId?: string): string[] {
  const errs: string[] = [];
  const err = (m: string) => errs.push(m);
  if (!f || typeof f !== "object") return ["arquivo não é um objeto JSON"];
  if (typeof f.id !== "string" || !/^[a-z0-9-]+$/.test(f.id)) err(`id precisa ser kebab-case (a-z, 0-9, -): "${f.id}"`);
  if (fileId && f.id !== fileId) err(`id "${f.id}" diferente do nome do arquivo "${fileId}.json"`);
  if (typeof f.name !== "string" || !f.name.trim()) err("name obrigatório");
  if (typeof f.updatedAt !== "string" || Number.isNaN(Date.parse(f.updatedAt))) err("updatedAt precisa ser data ISO (ex.: 2026-09-28T10:00:00Z)");
  (f.extraWalls ?? []).forEach((w, i) => checkWall(w, `extraWalls[${i}]`, err));
  const plan = resolvePlan(f);
  const wallIds = new Set([...baseWalls, ...(f.extraWalls ?? [])].map((w) => w.id));
  for (const id of f.removedWalls ?? []) if (!wallIds.has(id)) err(`removedWalls: parede "${id}" não existe`);
  for (const [i, r] of (f.rooms ?? []).entries()) {
    if (typeof r.id !== "string") err(`rooms[${i}]: sem id`);
    if (!Array.isArray(r.poly) || r.poly.length < 3 || r.poly.some((p) => !Array.isArray(p) || !isNum(p[0]) || !isNum(p[1])))
      err(`rooms[${i}] (${r.id}): poly precisa de >= 3 pontos [x, y]`);
    if (!Array.isArray(r.label) || !isNum(r.label[0]) || !isNum(r.label[1])) err(`rooms[${i}] (${r.id}): label [x, y] obrigatório`);
    if (!FINISHES.includes(r.floor)) err(`rooms[${i}] (${r.id}): floor deve ser um de ${FINISHES.join(", ")}`);
  }
  const roomIds = new Set(plan.rooms.map((r) => r.id).concat(f.removedRooms ?? []));
  for (const id of f.removedRooms ?? []) if (!baseRooms.some((r) => r.id === id) && !(f.rooms ?? []).some((r) => r.id === id)) err(`removedRooms: cômodo "${id}" não existe`);
  for (const [k, v] of Object.entries(f.floors ?? {})) {
    if (!roomIds.has(k)) err(`floors: cômodo "${k}" não existe`);
    if (!FINISHES.includes(v as FloorFinish)) err(`floors.${k}: "${v}" inválido (use ${FINISHES.join(", ")})`);
  }
  if (f.wallColor !== undefined && !isHex(f.wallColor)) err("wallColor precisa ser #rrggbb");
  for (const [k, v] of Object.entries(f.wallColors ?? {})) {
    if (!wallIds.has(k)) err(`wallColors: parede "${k}" não existe`);
    if (!isHex(v)) err(`wallColors.${k} precisa ser #rrggbb`);
  }
  const ids = new Set<string>();
  for (const [i, it] of (f.items ?? []).entries()) {
    const at = `items[${i}]${it?.id ? ` (${it.id})` : ""}`;
    if (typeof it.id !== "string") err(`${at}: id obrigatório`);
    else if (ids.has(it.id)) err(`${at}: id repetido`);
    ids.add(it.id);
    if (!catalogByType[it.type]) err(`${at}: type "${it.type}" não existe no catálogo`);
    for (const k of ["x", "y", "rot", "w", "d", "h"] as const) if (!isNum(it[k])) err(`${at}: ${k} precisa ser número`);
    if (!(it.w > 0 && it.d > 0 && it.h > 0)) err(`${at}: w, d, h precisam ser > 0`);
    if (!isHex(it.color)) err(`${at}: color precisa ser #rrggbb`);
  }
  return errs;
}

export function validateFurnitureFile(e: CatalogEntry, fileId?: string): string[] {
  const errs: string[] = [];
  const err = (m: string) => errs.push(m);
  if (typeof e.type !== "string" || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(e.type)) err(`type inválido "${e.type}"`);
  if (fileId && e.type !== fileId) err(`type "${e.type}" diferente do nome do arquivo "${fileId}.json"`);
  if (typeof e.name !== "string" || !e.name.trim()) err("name obrigatório");
  if (!GROUPS.includes(e.group)) err(`group deve ser um de: ${GROUPS.join(", ")}`);
  for (const k of ["w", "d", "h"] as const) if (!(isNum(e[k]) && e[k] > 0)) err(`${k} precisa ser número > 0 (metros)`);
  if (!isHex(e.color)) err("color precisa ser #rrggbb");
  if (!Array.isArray(e.parts) || !e.parts.length) err("parts: lista com pelo menos uma peça");
  (e.parts ?? []).forEach((p, i) => {
    if (!["box", "cylinder", "sphere"].includes(p.shape)) err(`parts[${i}]: shape deve ser box, cylinder ou sphere`);
    for (const k of ["x", "y", "z", "sx", "sy", "sz"] as const) if (!isNum(p[k])) err(`parts[${i}]: ${k} precisa ser número`);
    if (p.sx <= 0 || p.sy <= 0 || p.sz <= 0) err(`parts[${i}]: sx, sy, sz precisam ser > 0`);
    if (p.color && !["base", "dark", "light"].includes(p.color) && !isHex(p.color)) err(`parts[${i}]: color deve ser base, dark, light ou #rrggbb`);
    if (Math.abs(p.x) > 0.5 + 1e-6 || Math.abs(p.z) > 0.5 + 1e-6 || p.y < 0 || p.y > 1) err(`parts[${i}]: centro fora da caixa do móvel (x,z ∈ [-0.5,0.5], y ∈ [0,1])`);
  });
  return errs;
}
