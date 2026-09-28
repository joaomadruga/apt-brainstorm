// Catálogo de móveis. Dimensões em metros (w = largura em x, d = profundidade em y, h = altura).

export type FurnitureType =
  | "sofa" | "poltrona" | "mesaCentro" | "rack" | "tv" | "mesaJantar" | "cadeira" | "banqueta"
  | "camaCasal" | "camaSolteiro" | "criado" | "guardaRoupa" | "escrivaninha" | "estante"
  | "tapete" | "planta" | "luminaria" | "ilha"
  | "bancada" | "geladeira" | "tanque" | "maquina" | "vaso" | "pia" | "box";

export interface CatalogEntry {
  type: FurnitureType;
  name: string;
  group: "Sala" | "Jantar" | "Quarto" | "Decoração" | "Cozinha" | "Banheiro";
  w: number;
  d: number;
  h: number;
  color: string;
}

export const catalog: CatalogEntry[] = [
  { type: "sofa", name: "Sofá 3 lugares", group: "Sala", w: 2.1, d: 0.9, h: 0.8, color: "#8a8f98" },
  { type: "poltrona", name: "Poltrona", group: "Sala", w: 0.8, d: 0.8, h: 0.8, color: "#b0764a" },
  { type: "mesaCentro", name: "Mesa de centro", group: "Sala", w: 0.9, d: 0.55, h: 0.4, color: "#9c6b43" },
  { type: "rack", name: "Rack", group: "Sala", w: 1.8, d: 0.4, h: 0.5, color: "#5b4636" },
  { type: "tv", name: "TV 55\"", group: "Sala", w: 1.23, d: 0.08, h: 0.72, color: "#111111" },
  { type: "estante", name: "Estante", group: "Sala", w: 1.0, d: 0.35, h: 1.9, color: "#c9a57a" },
  { type: "mesaJantar", name: "Mesa de jantar (4)", group: "Jantar", w: 1.2, d: 0.8, h: 0.76, color: "#a57a52" },
  { type: "cadeira", name: "Cadeira", group: "Jantar", w: 0.45, d: 0.5, h: 0.85, color: "#3d3d3d" },
  { type: "banqueta", name: "Banqueta", group: "Jantar", w: 0.4, d: 0.4, h: 0.75, color: "#3d3d3d" },
  { type: "ilha", name: "Bancada / ilha", group: "Cozinha", w: 1.4, d: 0.6, h: 0.92, color: "#e8e4dc" },
  { type: "camaCasal", name: "Cama casal (queen)", group: "Quarto", w: 1.6, d: 2.0, h: 0.55, color: "#e9e4d8" },
  { type: "camaSolteiro", name: "Cama solteiro", group: "Quarto", w: 0.9, d: 1.9, h: 0.5, color: "#e9e4d8" },
  { type: "criado", name: "Criado-mudo", group: "Quarto", w: 0.45, d: 0.4, h: 0.5, color: "#9c6b43" },
  { type: "guardaRoupa", name: "Guarda-roupa", group: "Quarto", w: 1.6, d: 0.58, h: 2.4, color: "#d8cdbd" },
  { type: "escrivaninha", name: "Escrivaninha", group: "Quarto", w: 1.2, d: 0.6, h: 0.75, color: "#b89168" },
  { type: "tapete", name: "Tapete", group: "Decoração", w: 2.0, d: 1.4, h: 0.01, color: "#c7b8a3" },
  { type: "planta", name: "Planta", group: "Decoração", w: 0.45, d: 0.45, h: 1.2, color: "#4f7a4a" },
  { type: "luminaria", name: "Luminária de piso", group: "Decoração", w: 0.35, d: 0.35, h: 1.6, color: "#f1e3c2" },
  { type: "bancada", name: "Bancada c/ cuba", group: "Cozinha", w: 1.6, d: 0.6, h: 0.9, color: "#e8e4dc" },
  { type: "geladeira", name: "Geladeira", group: "Cozinha", w: 0.6, d: 0.65, h: 1.8, color: "#d7dadd" },
  { type: "tanque", name: "Tanque", group: "Cozinha", w: 0.55, d: 0.47, h: 0.85, color: "#f2f2f2" },
  { type: "maquina", name: "Máquina de lavar", group: "Cozinha", w: 0.6, d: 0.6, h: 0.85, color: "#f5f5f5" },
  { type: "vaso", name: "Vaso sanitário", group: "Banheiro", w: 0.4, d: 0.65, h: 0.75, color: "#fafafa" },
  { type: "pia", name: "Bancada c/ cuba", group: "Banheiro", w: 0.8, d: 0.5, h: 0.85, color: "#efece6" },
  { type: "box", name: "Box de vidro", group: "Banheiro", w: 0.8, d: 0.9, h: 2.0, color: "#bfe3ee" },
];

export const catalogByType = Object.fromEntries(catalog.map((c) => [c.type, c])) as Record<FurnitureType, CatalogEntry>;

export interface Item {
  id: string;
  type: FurnitureType;
  /** centro na planta */
  x: number;
  y: number;
  /** rotação em graus (anti-horária vista de cima) */
  rot: number;
  w: number;
  d: number;
  h: number;
  color: string;
  fixed?: boolean; // louças / bancadas originais do projeto
}

let n = 0;
export const uid = () => `i${Date.now().toString(36)}${(n++).toString(36)}`;

function it(type: FurnitureType, x0: number, y0: number, x1: number, y1: number, rot = 0, extra: Partial<Item> = {}): Item {
  const c = catalogByType[type];
  const sw = rot % 180 === 0;
  return {
    id: `fx-${type}-${x0.toFixed(2)}-${y0.toFixed(2)}`,
    type, rot,
    x: (x0 + x1) / 2, y: (y0 + y1) / 2,
    w: sw ? x1 - x0 : y1 - y0,
    d: sw ? y1 - y0 : x1 - x0,
    h: c.h, color: c.color, fixed: true, ...extra,
  };
}

/** Louças e bancadas desenhadas no projeto (posições do DWG). rot=0 → "frente" voltada para -y (encostado numa parede ao norte). */
export const initialItems: Item[] = [
  // cozinha: bancada contra a fachada norte, cooktop na ponta direita
  it("bancada", 3.29, 6.97, 5.8, 7.572, 0),
  it("geladeira", 5.82, 6.93, 6.38, 7.56, 0),
  it("tanque", 6.46, 6.84, 7.01, 7.28, 0),
  // BWC social
  it("box", 2.926, 0.761, 3.74, 1.64, 0),
  it("pia", 3.74, 0.761, 4.541, 1.26, 180),
  it("vaso", 2.926, 1.79, 3.34, 2.19, 90),
  // BWC suíte
  it("pia", 0.326, 4.55, 1.15, 5.072, 0),
  it("vaso", 1.26, 4.63, 1.7, 5.072, 0),
  it("box", 1.846, 3.901, 2.661, 4.852, 0),
];
