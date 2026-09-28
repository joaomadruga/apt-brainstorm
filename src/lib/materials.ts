import type { FloorFinish } from "@/data/apartment";

export const floorFinishes: Record<FloorFinish, { name: string; color: string; roughness: number; prompt: string }> = {
  madeira: { name: "Madeira clara", color: "#c9a57c", roughness: 0.65, prompt: "light oak wood flooring" },
  porcelanato: { name: "Porcelanato off-white", color: "#e4e0d8", roughness: 0.35, prompt: "large off-white porcelain tiles" },
  cimento: { name: "Cimento queimado", color: "#a9a7a2", roughness: 0.8, prompt: "polished burnt cement floor" },
  ceramica: { name: "Cerâmica cinza", color: "#c8cbcc", roughness: 0.5, prompt: "light grey ceramic tiles" },
  deck: { name: "Deck / madeira escura", color: "#8a6446", roughness: 0.8, prompt: "dark wood deck" },
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
