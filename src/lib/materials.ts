import type { FloorFinish } from "@/data/apartment";

/** `pattern` = textura procedural no 3D (lib/floorTextures.ts); `color` continua sendo a cor na planta 2D */
export const floorFinishes: Record<FloorFinish, { name: string; color: string; roughness: number; prompt: string; pattern?: "planks" | "tiles" | "herringbone" }> = {
  madeira: { name: "Madeira clara", color: "#c9a57c", roughness: 0.65, prompt: "light oak wood flooring" },
  carvalho: { name: "Carvalho natural (réguas)", color: "#c48b4e", roughness: 0.55, prompt: "natural honey oak strip wood flooring, satin finish, narrow planks laid lengthwise", pattern: "planks" },
  porcelanato: { name: "Porcelanato off-white", color: "#e4e0d8", roughness: 0.35, prompt: "large off-white porcelain tiles" },
  cimento: { name: "Cimento queimado", color: "#a9a7a2", roughness: 0.8, prompt: "polished burnt cement floor" },
  ceramica: { name: "Cerâmica cinza", color: "#c8cbcc", roughness: 0.5, prompt: "light grey ceramic tiles" },
  ladrilho: { name: "Ladrilho hidráulico", color: "#c9c2ae", roughness: 0.45, prompt: "patterned encaustic cement tiles (ladrilho hidráulico), cream base with navy-blue stars and terracotta-orange flowers, 20×20 cm", pattern: "tiles" },
  deck: { name: "Deck / madeira escura", color: "#8a6446", roughness: 0.8, prompt: "dark wood deck" },
  espinha: { name: "Carvalho espinha de peixe", color: "#8e6040", roughness: 0.5, prompt: "smoked oak herringbone parquet, warm mid-brown with natural variation, matte oiled finish, laid at 45 degrees", pattern: "herringbone" },
};

export const wallPalette = [
  { name: "Branco gelo", color: "#f3efe8" },
  { name: "Off-white quente", color: "#ede3d3" },
  { name: "Cinza claro", color: "#d9d9d6" },
  { name: "Verde sálvia", color: "#b7c2a8" },
  { name: "Terracota", color: "#c98b6b" },
  { name: "Azul petróleo", color: "#3f5f68" },
  { name: "Grafite", color: "#4a4a4a" },
  { name: "Areia", color: "#d8c3a0" },
];
