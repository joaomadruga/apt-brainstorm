// Geometria do Apto 1707 (planta tipo "207 A 1907"), extraída do DWG
// "Alteração Durante a Obra Po 1170 Encanamento_Varanda de Casa Forte 26_03_24 V1.dwg".
// Coordenadas em metros, sistema local da planta: x → leste (direita), y → norte (cima).
// Origem = ponto (1344.10, -1269.65) do modelspace do DWG.
// Alturas das esquadrias vêm do "Quadro de Esquadrias" do mesmo arquivo.

export type Pt = [number, number];

export type OpeningKind = "door" | "window" | "slider";

export interface Opening {
  kind: OpeningKind;
  label: string;
  /** início/fim ao longo do eixo da parede (coordenada absoluta x ou y) */
  a0: number;
  a1: number;
  sill: number; // peitoril (m)
  head: number; // altura da verga (m)
  /** porta de giro: lado da dobradiça e para onde abre (só para desenho 2D) */
  hinge?: "start" | "end";
  swing?: 1 | -1;
}

export type WallKind = "ext" | "int" | "pillar" | "parapet";

export interface Wall {
  id: string;
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  kind: WallKind;
  /** altura própria (parapeito); se ausente usa o pé-direito */
  height?: number;
  openings?: Opening[];
}

export interface Room {
  id: string;
  name: string;
  poly: Pt[];
  label: Pt;
  floor: FloorFinish;
}

export type FloorFinish = "madeira" | "porcelanato" | "cimento" | "ceramica" | "deck";

export const CEILING = 2.6; // pé-direito adotado (não consta na planta)

export const walls: Wall[] = [
  // ---------- fachada / divisas ----------
  {
    id: "fachada-sul", name: "Fachada (suíte / BWC / quarto)", kind: "ext",
    x0: 0.146, y0: 0.621, x1: 7.291, y1: 0.761,
    openings: [
      { kind: "window", label: "EA3", a0: 0.496, a1: 1.756, sill: 1.1, head: 2.2 },
      { kind: "window", label: "EA5", a0: 3.246, a1: 3.606, sill: 1.6, head: 2.2 },
      { kind: "window", label: "EA3", a0: 4.736, a1: 5.996, sill: 1.1, head: 2.2 },
    ],
  },
  { id: "pilar-so", name: "Pilar", kind: "pillar", x0: 0.146, y0: 0.761, x1: 0.411, y1: 1.962 },
  { id: "divisa-oeste", name: "Parede divisa (apto 206)", kind: "ext", x0: 0.191, y0: 1.962, x1: 0.321, y1: 6.307 },
  { id: "hall-sul", name: "Parede do hall", kind: "ext", x0: -1.645, y0: 6.177, x1: 0.191, y1: 6.307 },
  {
    id: "hall-oeste", name: "Parede da entrada (P1)", kind: "ext",
    x0: -1.645, y0: 6.307, x1: -1.525, y1: 7.572,
    openings: [{ kind: "door", label: "P1", a0: 6.372, a1: 7.232, sill: 0, head: 2.1, hinge: "start", swing: 1 }],
  },
  {
    id: "fachada-norte", name: "Fachada (cozinha)", kind: "ext",
    x0: -1.645, y0: 7.572, x1: 7.291, y1: 7.737,
    openings: [{ kind: "window", label: "EA3", a0: 0.946, a1: 2.206, sill: 1.1, head: 2.2 }],
  },
  { id: "pilar-n", name: "Pilar", kind: "pillar", x0: 0.038, y0: 7.737, x1: 0.441, y1: 8.437 },
  { id: "pilar-serv", name: "Pilar (serviço)", kind: "pillar", x0: 6.406, y0: 7.287, x1: 7.291, y1: 7.572 },
  { id: "pilar-serv2", name: "Pilar (serviço)", kind: "pillar", x0: 7.041, y0: 6.527, x1: 7.291, y1: 7.287 },
  {
    id: "fachada-leste-serv", name: "Fachada (serviço)", kind: "ext",
    x0: 7.126, y0: 5.906, x1: 7.291, y1: 6.527,
    openings: [{ kind: "window", label: "EA5", a0: 6.116, a1: 6.476, sill: 1.6, head: 2.2 }],
  },
  { id: "guarda-varanda", name: "Guarda-corpo da varanda (h=1,10)", kind: "parapet", height: 1.1, x0: 7.126, y0: 3.461, x1: 7.291, y1: 5.906 },
  { id: "fachada-leste-quarto", name: "Fachada (quarto)", kind: "ext", x0: 7.141, y0: 1.816, x1: 7.291, y1: 3.461 },
  { id: "pilar-se", name: "Pilar", kind: "pillar", x0: 7.046, y0: 0.761, x1: 7.291, y1: 1.816 },

  // ---------- internas ----------
  { id: "varanda-quarto", name: "Parede varanda / quarto", kind: "int", x0: 5.826, y0: 3.336, x1: 7.141, y1: 3.461 },
  { id: "sala-quarto", name: "Parede sala / quarto", kind: "int", x0: 3.826, y0: 3.336, x1: 5.651, y1: 3.446 },
  {
    id: "sala-varanda", name: "Parede sala / varanda (EA1)", kind: "int",
    x0: 5.651, y0: 3.336, x1: 5.826, y1: 6.056,
    openings: [{ kind: "slider", label: "EA1", a0: 3.656, a1: 5.716, sill: 0, head: 2.2 }],
  },
  { id: "cozinha-sala", name: "Parede cozinha / sala", kind: "int", x0: 3.631, y0: 5.946, x1: 5.651, y1: 6.056 },
  {
    id: "cozinha-varanda", name: "Parede cozinha / varanda (EA27)", kind: "int",
    x0: 5.826, y0: 5.931, x1: 7.126, y1: 6.056,
    openings: [{ kind: "window", label: "EA27", a0: 5.931, a1: 6.961, sill: 1.1, head: 2.2 }],
  },
  {
    id: "suite-bwc", name: "Parede suíte / BWC suíte", kind: "int",
    x0: 0.321, y0: 3.786, x1: 2.791, y1: 3.901,
    openings: [{ kind: "door", label: "P3", a0: 0.371, a1: 1.031, sill: 0, head: 2.1, hinge: "start", swing: 1 }],
  },
  { id: "bwc-sala", name: "Parede BWC suíte / sala", kind: "int", x0: 2.661, y0: 3.901, x1: 2.786, y1: 5.187 },
  {
    id: "suite-circ", name: "Parede suíte / circulação", kind: "int",
    x0: 2.791, y0: 0.761, x1: 2.926, y1: 3.901,
    openings: [{ kind: "door", label: "P2", a0: 2.486, a1: 3.246, sill: 0, head: 2.1, hinge: "end", swing: -1 }],
  },
  { id: "bwc-cozinha", name: "Parede BWC suíte / cozinha", kind: "int", x0: 0.321, y0: 5.072, x1: 2.786, y1: 5.187 },
  { id: "bwc-shaft", name: "Shaft / enchimento BWC", kind: "int", x0: 1.846, y0: 4.852, x1: 2.661, y1: 5.072 },
  {
    id: "bwc-circ", name: "Parede BWC social / circulação", kind: "int",
    x0: 2.926, y0: 2.336, x1: 4.541, y1: 2.436,
    openings: [{ kind: "door", label: "P3", a0: 3.821, a1: 4.481, sill: 0, head: 2.1, hinge: "end", swing: -1 }],
  },
  {
    id: "bwc-quarto", name: "Parede BWC social / quarto", kind: "int",
    x0: 4.541, y0: 0.761, x1: 4.666, y1: 3.336,
    openings: [{ kind: "door", label: "P2", a0: 2.526, a1: 3.286, sill: 0, head: 2.1, hinge: "end", swing: 1 }],
  },
];

export const rooms: Room[] = [
  { id: "hall", name: "Hall", floor: "porcelanato", label: [-0.65, 6.95],
    poly: [[-1.525, 6.307], [0.321, 6.307], [0.321, 7.572], [-1.525, 7.572]] },
  { id: "cozinha", name: "Cozinha / Serviço", floor: "porcelanato", label: [4.3, 6.6],
    poly: [[0.321, 5.187], [2.786, 5.187], [2.786, 5.946], [3.631, 5.946], [3.631, 6.056], [7.126, 6.056],
      [7.126, 6.527], [7.041, 6.527], [7.041, 7.287], [6.406, 7.287], [6.406, 7.572], [0.321, 7.572]] },
  { id: "sala", name: "Sala", floor: "madeira", label: [4.2, 4.7],
    poly: [[2.786, 3.446], [5.651, 3.446], [5.651, 5.946], [2.786, 5.946]] },
  { id: "varanda", name: "Varanda", floor: "deck", label: [6.47, 4.7],
    poly: [[5.826, 3.461], [7.126, 3.461], [7.126, 5.931], [5.826, 5.931]] },
  { id: "circ", name: "Circ.", floor: "madeira", label: [3.7, 2.9],
    poly: [[2.926, 2.436], [4.541, 2.436], [4.541, 3.446], [2.926, 3.446]] },
  { id: "suite", name: "Suíte", floor: "madeira", label: [1.55, 2.2],
    poly: [[0.411, 0.761], [2.791, 0.761], [2.791, 3.786], [0.321, 3.786], [0.321, 1.962], [0.411, 1.962]] },
  { id: "bwc-suite", name: "BWC suíte", floor: "ceramica", label: [1.2, 4.3],
    poly: [[0.326, 3.901], [2.661, 3.901], [2.661, 4.852], [1.846, 4.852], [1.846, 5.072], [0.326, 5.072]] },
  { id: "bwc-social", name: "BWC", floor: "ceramica", label: [3.73, 1.95],
    poly: [[2.926, 0.761], [4.541, 0.761], [4.541, 2.336], [2.926, 2.336]] },
  { id: "quarto", name: "Quarto", floor: "madeira", label: [5.9, 2.1],
    poly: [[4.666, 0.761], [7.046, 0.761], [7.046, 1.816], [7.141, 1.816], [7.141, 3.336], [4.666, 3.336]] },
];

/** limites para enquadrar câmera / planta */
export const bounds = { minX: -1.645, minY: 0.621, maxX: 7.291, maxY: 8.437 };
export const center: Pt = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + 7.737) / 2];

export function polyArea(p: Pt[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function wallAxis(w: Wall): "x" | "y" {
  return w.x1 - w.x0 >= w.y1 - w.y0 ? "x" : "y";
}
