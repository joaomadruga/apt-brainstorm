"use client";

import * as THREE from "three";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CaptureResult } from "./capture";
import { useStore } from "./store";

// Câmera fotográfica "de pessoa": fica parada num ponto da planta, na altura do olho,
// e tira a foto (PNG + prompt) só daquele ângulo. É estado de UI deste navegador —
// não entra na versão (versions/*.json).

export const ASPECTS = ["3:2", "16:9", "4:3", "1:1", "4:5", "9:16"] as const;
export type Aspect = (typeof ASPECTS)[number];
export const LENSES = [16, 20, 24, 28, 35, 50] as const; // mm, equivalente full-frame

export interface PhotoCam {
  /** posição na planta (m): x leste, y norte */
  x: number;
  y: number;
  /** altura da lente (m) */
  h: number;
  /** direção em planta, graus (0 = leste, 90 = norte) */
  yaw: number;
  /** inclinação, graus (+ olha para cima) */
  pitch: number;
  lens: number;
  aspect: Aspect;
}

interface PhotoState {
  cam: PhotoCam | null;
  /** esperando clique na planta/chão para posicionar */
  placing: boolean;
  preview: boolean;
  /** última foto tirada (abre o preview) */
  shot: CaptureResult | null;
  busy: boolean;
  place: (x: number, y: number) => void;
  aimAt: (x: number, y: number) => void;
  update: (p: Partial<PhotoCam>) => void;
  setPlacing: (v: boolean) => void;
  setPreview: (v: boolean) => void;
  clear: () => void;
  setShot: (s: CaptureResult | null) => void;
}

export const EYE_H = 1.6;

export const usePhoto = create<PhotoState>()(
  persist(
    (set) => ({
      cam: null,
      placing: false,
      preview: true,
      shot: null,
      busy: false,
      place: (x, y) =>
        set((s) => ({
          cam: s.cam ? { ...s.cam, x, y } : { x, y, h: EYE_H, yaw: 90, pitch: -3, lens: 24, aspect: "3:2" },
        })),
      aimAt: (x, y) =>
        set((s) => {
          if (!s.cam || Math.hypot(x - s.cam.x, y - s.cam.y) < 0.05) return s;
          return { cam: { ...s.cam, yaw: (Math.atan2(y - s.cam.y, x - s.cam.x) * 180) / Math.PI } };
        }),
      update: (p) => set((s) => (s.cam ? { cam: { ...s.cam, ...p } } : s)),
      setPlacing: (placing) => set({ placing }),
      setPreview: (preview) => set({ preview }),
      clear: () => set({ cam: null, placing: false }),
      setShot: (shot) => set({ shot }),
    }),
    { name: "apto-1707-photo", partialize: (s) => ({ cam: s.cam, preview: s.preview }) },
  ),
);

export const aspectRatio = (a: Aspect) => {
  const [w, h] = a.split(":").map(Number);
  return w / h;
};

/** FOV vertical (graus) de uma lente full-frame (36×24) — o lado maior da foto usa os 36 mm */
export function verticalFov(lens: number, aspect: number) {
  const long = 2 * Math.atan(18 / lens);
  const h = aspect >= 1 ? 2 * Math.atan(Math.tan(long / 2) / aspect) : long;
  return (h * 180) / Math.PI;
}

/** direção de visão em coordenadas da planta (x, y, z=altura) */
export function planDir(c: PhotoCam) {
  const y = (c.yaw * Math.PI) / 180, p = (c.pitch * Math.PI) / 180;
  return { x: Math.cos(y) * Math.cos(p), y: Math.sin(y) * Math.cos(p), z: Math.sin(p) };
}

/** aplica a câmera da foto num PerspectiveCamera do three (mundo = (x, altura, -y)) */
export function applyPhotoCam(cam: THREE.PerspectiveCamera, c: PhotoCam, aspect = aspectRatio(c.aspect)) {
  const d = planDir(c);
  cam.position.set(c.x, c.h, -c.y);
  cam.up.set(0, 1, 0);
  cam.lookAt(c.x + d.x, c.h + d.z, -(c.y + d.y));
  cam.aspect = aspect;
  cam.fov = verticalFov(c.lens, aspect);
  cam.near = 0.05;
  cam.far = 60;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}

/** tamanho da foto final (lado maior = 1920 px) */
export function photoSize(a: Aspect, long = 1920) {
  const r = aspectRatio(a);
  return r >= 1 ? { w: long, h: Math.round(long / r) } : { w: Math.round(long * r), h: long };
}

/** retângulo da janelinha de prévia no canto do 3D (px CSS, a partir do canto inferior esquerdo) */
export function pipRect(width: number, height: number, a: Aspect) {
  const r = aspectRatio(a);
  let w = Math.min(340, width * 0.4);
  let h = w / r;
  const maxH = height * 0.45;
  if (h > maxH) {
    h = maxH;
    w = h * r;
  }
  return { w: Math.round(w), h: Math.round(h), margin: 12 };
}

// camada 1 = só a foto enxerga (paredes inteiras, teto); camada 2 = só a vista enxerga (marcador)
export const LAYER_PHOTO = 1;
export const LAYER_EDITOR = 2;

type ShootFn = () => Promise<CaptureResult>;
let shootFn: ShootFn | null = null;
export const registerShoot = (f: ShootFn | null) => {
  shootFn = f;
};
export const shootPhoto = () => (shootFn ? shootFn() : Promise.reject(new Error("Abra o 3D para tirar a foto")));

/** tira a foto pela câmera posicionada e abre o preview */
export async function takePhoto(ensure3D?: () => Promise<void>) {
  const st = usePhoto.getState();
  if (!st.cam || st.busy) return;
  usePhoto.setState({ busy: true });
  try {
    await ensure3D?.();
    usePhoto.setState({ shot: await shootPhoto() });
  } catch (e) {
    alert((e as Error).message);
  } finally {
    usePhoto.setState({ busy: false });
  }
}

/** FOV horizontal (graus) — para desenhar o cone na planta */
export function horizontalFov(lens: number, aspect: number) {
  const v = (verticalFov(lens, aspect) * Math.PI) / 180;
  return (2 * Math.atan(Math.tan(v / 2) * aspect) * 180) / Math.PI;
}

/** a foto precisa do 3D montado */
export async function ensure3D() {
  if (useStore.getState().view !== "2d") return;
  useStore.getState().setView("split");
  await new Promise((r) => setTimeout(r, 500));
}
