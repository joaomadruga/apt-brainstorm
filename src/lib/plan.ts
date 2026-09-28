import { rooms as baseRooms, walls as baseWalls, type Pt, type Room, type Wall } from "@/data/apartment";

/** Parte da versão que mexe na geometria (além das paredes removidas). */
export interface GeometryEdits {
  /** paredes novas (ou que substituem uma original com o mesmo id) */
  extraWalls?: Wall[];
  /** cômodos novos ou que substituem um original com o mesmo id */
  rooms?: Room[];
  /** ids de cômodos originais a esconder */
  removedRooms?: string[];
}

export interface Plan {
  walls: Wall[];
  rooms: Room[];
}

export function resolvePlan(e: GeometryEdits): Plan {
  const extra = e.extraWalls ?? [];
  const extraIds = new Set(extra.map((w) => w.id));
  const walls = [...baseWalls.filter((w) => !extraIds.has(w.id)), ...extra];
  const edits = e.rooms ?? [];
  const editIds = new Set(edits.map((r) => r.id));
  const removed = new Set(e.removedRooms ?? []);
  const rooms = [...baseRooms.filter((r) => !editIds.has(r.id) && !removed.has(r.id)), ...edits.filter((r) => !removed.has(r.id))];
  return { walls, rooms };
}

export function pointInPoly(x: number, y: number, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const roomAt = (rooms: Room[], x: number, y: number) => rooms.find((r) => pointInPoly(x, y, r.poly));

export function polyCentroid(p: Pt[]): Pt {
  let x = 0, y = 0;
  for (const [a, b] of p) {
    x += a;
    y += b;
  }
  return [x / p.length, y / p.length];
}
