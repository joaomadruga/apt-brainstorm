"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { catalogByType, initialItems, uid, type FurnitureType, type Item } from "@/data/catalog";
import { rooms, type FloorFinish } from "@/data/apartment";

export type ViewMode = "3d" | "2d" | "split";
export type Selection = { kind: "item" | "wall" | "room"; id: string } | null;
export type CameraPreset = "iso" | "top" | "eye";
export type Screen = "versions" | "editor";

export interface Snapshot {
  items: Item[];
  removedWalls: string[];
  floors: Record<string, FloorFinish>;
  wallColors: Record<string, string>;
  wallColor: string;
}

export interface Version {
  id: string;
  name: string;
  data: Snapshot;
  createdAt: number;
  updatedAt: number;
  thumb?: string; // jpeg dataURL da vista 3D
}

interface State extends Snapshot {
  view: ViewMode;
  selection: Selection;
  cutaway: boolean; // paredes cortadas (vista "maquete")
  showCeiling: boolean;
  hour: number; // 6..20
  snap: boolean;
  past: Snapshot[];
  future: Snapshot[];
  cameraPreset: { preset: CameraPreset; nonce: number };

  versions: Version[];
  activeId: string | null;
  screen: Screen;
  setScreen: (s: Screen) => void;
  createVersion: (name: string, from: "original" | string) => string;
  openVersion: (id: string) => void;
  renameVersion: (id: string, name: string) => void;
  duplicateVersion: (id: string, name?: string) => string;
  deleteVersion: (id: string) => void;
  setThumb: (id: string, thumb: string) => void;
  syncActive: () => void; // grava o estado de trabalho na versão ativa

  setView: (v: ViewMode) => void;
  select: (s: Selection) => void;
  setCutaway: (v: boolean) => void;
  setShowCeiling: (v: boolean) => void;
  setHour: (h: number) => void;
  setSnap: (v: boolean) => void;
  goCamera: (p: CameraPreset) => void;

  commit: () => void; // salva snapshot para desfazer
  undo: () => void;
  redo: () => void;

  addItem: (t: FurnitureType, x: number, y: number) => void;
  moveItem: (id: string, x: number, y: number) => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
  rotateItem: (id: string, deg: number) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;

  toggleWall: (id: string) => void;
  restoreWalls: () => void;
  setFloor: (roomId: string, f: FloorFinish) => void;
  setWallColor: (c: string, wallId?: string) => void;
  reset: () => void;
}

const initialFloors = Object.fromEntries(rooms.map((r) => [r.id, r.floor])) as Record<string, FloorFinish>;

const snap = (s: Snapshot): Snapshot => ({
  items: s.items,
  removedWalls: s.removedWalls,
  floors: s.floors,
  wallColors: s.wallColors,
  wallColor: s.wallColor,
});

export const originalSnapshot = (): Snapshot => ({
  items: initialItems,
  removedWalls: [],
  floors: initialFloors,
  wallColors: {},
  wallColor: "#f3efe8",
});

const vid = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const uniqueName = (versions: Version[], base: string) => {
  const names = new Set(versions.map((v) => v.name));
  if (!names.has(base)) return base;
  let k = 2;
  while (names.has(`${base} (${k})`)) k++;
  return `${base} (${k})`;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      items: initialItems,
      removedWalls: [],
      floors: initialFloors,
      wallColors: {},
      view: "split",
      selection: null,
      cutaway: true,
      showCeiling: false,
      hour: 10,
      wallColor: "#f3efe8",
      snap: true,
      past: [],
      future: [],
      cameraPreset: { preset: "iso", nonce: 0 },
      versions: [],
      activeId: null,
      screen: "versions",

      setScreen: (screen) => {
        get().syncActive();
        set({ screen, selection: null });
      },
      syncActive: () =>
        set((s) => {
          const v = s.versions.find((x) => x.id === s.activeId);
          if (!v) return {};
          const cur = snap(s);
          const same = (Object.keys(cur) as (keyof Snapshot)[]).every((k) => cur[k] === v.data[k]);
          if (same) return {};
          return { versions: s.versions.map((x) => (x.id === v.id ? { ...x, data: cur, updatedAt: Date.now() } : x)) };
        }),
      createVersion: (name, from) => {
        get().syncActive();
        const s = get();
        const base = from === "original" ? originalSnapshot() : s.versions.find((v) => v.id === from)?.data ?? originalSnapshot();
        const now = Date.now();
        const v: Version = { id: vid(), name: uniqueName(s.versions, name.trim() || "Nova versão"), data: base, createdAt: now, updatedAt: now };
        set({ versions: [...s.versions, v] });
        return v.id;
      },
      openVersion: (id) => {
        get().syncActive();
        const v = get().versions.find((x) => x.id === id);
        if (!v) return;
        set({ ...snap(v.data), activeId: id, screen: "editor", selection: null, past: [], future: [] });
      },
      renameVersion: (id, name) =>
        set((s) => ({
          versions: s.versions.map((v) =>
            v.id === id ? { ...v, name: uniqueName(s.versions.filter((x) => x.id !== id), name.trim() || v.name) } : v,
          ),
        })),
      duplicateVersion: (id, name) => {
        get().syncActive();
        const s = get();
        const src = s.versions.find((v) => v.id === id);
        if (!src) return id;
        const now = Date.now();
        const v: Version = { ...src, id: vid(), name: uniqueName(s.versions, name?.trim() || `${src.name} — cópia`), createdAt: now, updatedAt: now };
        set({ versions: [...s.versions, v] });
        return v.id;
      },
      deleteVersion: (id) =>
        set((s) => {
          const versions = s.versions.filter((v) => v.id !== id);
          return s.activeId === id ? { versions, activeId: null, screen: "versions" } : { versions };
        }),
      setThumb: (id, thumb) => set((s) => ({ versions: s.versions.map((v) => (v.id === id ? { ...v, thumb } : v)) })),

      setView: (view) => set({ view }),
      select: (selection) => set({ selection }),
      setCutaway: (cutaway) => set({ cutaway }),
      setShowCeiling: (showCeiling) => set({ showCeiling }),
      setHour: (hour) => set({ hour }),
      setSnap: (snap) => set({ snap }),
      goCamera: (preset) => set((s) => ({ cameraPreset: { preset, nonce: s.cameraPreset.nonce + 1 } })),

      commit: () => set((s) => ({ past: [...s.past.slice(-60), snap(s)], future: [] })),
      undo: () =>
        set((s) => {
          const prev = s.past[s.past.length - 1];
          if (!prev) return {};
          return { ...prev, past: s.past.slice(0, -1), future: [snap(s), ...s.future], selection: null };
        }),
      redo: () =>
        set((s) => {
          const next = s.future[0];
          if (!next) return {};
          return { ...next, future: s.future.slice(1), past: [...s.past, snap(s)], selection: null };
        }),

      addItem: (type, x, y) => {
        get().commit();
        const c = catalogByType[type];
        const item: Item = { id: uid(), type, x, y, rot: 0, w: c.w, d: c.d, h: c.h, color: c.color };
        set((s) => ({ items: [...s.items, item], selection: { kind: "item", id: item.id } }));
      },
      moveItem: (id, x, y) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, x, y } : i)) })),
      updateItem: (id, patch) => {
        get().commit();
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
      },
      rotateItem: (id, deg) => {
        get().commit();
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, rot: (((i.rot + deg) % 360) + 360) % 360 } : i)) }));
      },
      removeItem: (id) => {
        get().commit();
        set((s) => ({ items: s.items.filter((i) => i.id !== id), selection: null }));
      },
      duplicateItem: (id) => {
        const src = get().items.find((i) => i.id === id);
        if (!src) return;
        get().commit();
        const copy = { ...src, id: uid(), x: src.x + 0.3, y: src.y - 0.3, fixed: false };
        set((s) => ({ items: [...s.items, copy], selection: { kind: "item", id: copy.id } }));
      },

      toggleWall: (id) => {
        get().commit();
        set((s) => ({
          removedWalls: s.removedWalls.includes(id) ? s.removedWalls.filter((w) => w !== id) : [...s.removedWalls, id],
        }));
      },
      restoreWalls: () => {
        get().commit();
        set({ removedWalls: [] });
      },
      setFloor: (roomId, f) => {
        get().commit();
        set((s) => ({ floors: { ...s.floors, [roomId]: f } }));
      },
      setWallColor: (c, wallId) => {
        get().commit();
        if (wallId) set((s) => ({ wallColors: { ...s.wallColors, [wallId]: c } }));
        else set({ wallColor: c, wallColors: {} });
      },
      reset: () => {
        get().commit();
        set({ ...originalSnapshot(), selection: null });
      },
    }),
    {
      name: "apto-1707",
      version: 2,
      partialize: (s) => ({
        items: s.items, removedWalls: s.removedWalls, floors: s.floors, wallColors: s.wallColors, wallColor: s.wallColor,
        versions: s.versions, activeId: s.activeId, screen: s.screen,
        view: s.view, cutaway: s.cutaway, hour: s.hour, snap: s.snap, showCeiling: s.showCeiling,
      }),
      // v1 (sem versões): o que existia vira a versão "Minha planta"
      migrate: (persisted, from) => {
        const p = (persisted ?? {}) as Partial<State>;
        if (from < 2) {
          const now = Date.now();
          const data = snap({ ...originalSnapshot(), ...p } as Snapshot);
          const v: Version = { id: vid(), name: "Minha planta", data, createdAt: now, updatedAt: now };
          return { ...p, versions: [v], activeId: v.id, screen: "versions" } as unknown as State;
        }
        return p as State;
      },
    },
  ),
);

// salva automaticamente as mudanças na versão ativa
if (typeof window !== "undefined") {
  let t: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((s, prev) => {
    if (s.items === prev.items && s.removedWalls === prev.removedWalls && s.floors === prev.floors && s.wallColors === prev.wallColors && s.wallColor === prev.wallColor) return;
    clearTimeout(t);
    t = setTimeout(() => useStore.getState().syncActive(), 300);
  });
  window.addEventListener("beforeunload", () => useStore.getState().syncActive());
}
