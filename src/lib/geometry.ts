import { wallAxis, type Opening, type Wall } from "@/data/apartment";

/** Caixa sólida em coordenadas de planta: [x0,y0]-[x1,y1] entre alturas z0..z1 */
export interface Piece {
  x0: number; y0: number; x1: number; y1: number;
  z0: number; z1: number;
}

/**
 * Quebra a parede em blocos sólidos, deixando os vãos das esquadrias.
 * `height` = altura da parede (pé-direito ou altura de corte).
 */
export function wallPieces(w: Wall, height: number): Piece[] {
  const H = w.height ?? height;
  const ax = wallAxis(w);
  const lo = ax === "x" ? w.x0 : w.y0;
  const hi = ax === "x" ? w.x1 : w.y1;
  const ops = [...(w.openings ?? [])].sort((a, b) => a.a0 - b.a0);
  const out: Piece[] = [];
  const mk = (a0: number, a1: number, z0: number, z1: number) => {
    if (a1 - a0 < 1e-4 || z1 - z0 < 1e-4) return;
    out.push(
      ax === "x"
        ? { x0: a0, x1: a1, y0: w.y0, y1: w.y1, z0, z1 }
        : { x0: w.x0, x1: w.x1, y0: a0, y1: a1, z0, z1 },
    );
  };
  let cur = lo;
  for (const o of ops) {
    mk(cur, o.a0, 0, H);
    mk(o.a0, o.a1, 0, Math.min(o.sill, H)); // peitoril
    mk(o.a0, o.a1, Math.min(o.head, H), H); // verga
    cur = o.a1;
  }
  mk(cur, hi, 0, H);
  return out;
}

/** Retângulo (em planta) do vão de uma esquadria */
export function openingRect(w: Wall, o: Opening) {
  return wallAxis(w) === "x"
    ? { x0: o.a0, x1: o.a1, y0: w.y0, y1: w.y1 }
    : { x0: w.x0, x1: w.x1, y0: o.a0, y1: o.a1 };
}

export const snapTo = (v: number, step = 0.05) => Math.round(v / step) * step;
