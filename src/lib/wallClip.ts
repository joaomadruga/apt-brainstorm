import type * as THREE from "three";

// Planos de corte das paredes (um por parede, ver WallMesh em Scene3D). A foto precisa ver as paredes
// inteiras: em vez de desligar o clipping do renderer (troca de shader a cada frame → pisca), só
// empurra os planos lá pra cima durante o render dela.

const NO_CUT = 100;
const planes = new Set<THREE.Plane>();
const cutOnly = new Set<THREE.Object3D>(); // tampas do corte: somem na foto

export const registerCutOnly = (o: THREE.Object3D) => {
  cutOnly.add(o);
  return () => void cutOnly.delete(o);
};

export const registerWallPlane = (p: THREE.Plane) => {
  planes.add(p);
  return () => void planes.delete(p);
};

export function renderUncut(gl: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera) {
  const saved = [...planes].map((p) => [p, p.constant] as const);
  const shown = [...cutOnly].filter((o) => o.visible);
  for (const [p] of saved) p.constant = NO_CUT;
  for (const o of shown) o.visible = false;
  gl.render(scene, cam);
  for (const [p, c] of saved) p.constant = c;
  for (const o of shown) o.visible = true;
}
