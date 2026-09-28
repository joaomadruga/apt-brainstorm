"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { catalogByType, registerCatalog, uid, type CatalogEntry, type FurnitureType, type Item } from "@/data/catalog";
import type { FloorFinish } from "@/data/apartment";
import { fileToSnapshot, normalizeSnapshot, originalSnapshot, type Snapshot, type VersionFile } from "./files";
import { resolvePlan } from "./plan";

export type { Snapshot } from "./files";
export { originalSnapshot } from "./files";

export type ViewMode = "3d" | "2d" | "split";
export type Selection = { kind: "item" | "wall" | "room"; id: string } | null;
export type CameraPreset = "iso" | "top" | "eye";
export type Screen = "versions" | "editor";
export type Theme = "auto" | "light" | "dark";

export interface Version {
  id: string;
  name: string;
  description?: string;
  data: Snapshot;
  createdAt: number;
  updatedAt: number;
  thumb?: string; // jpeg dataURL da vista 3D
  /** versão que veio de /versions/<id>.json */
  repo?: { id: string; updatedAt: string };
  /** mexida no navegador depois de carregada do repo (NÃO salva no repo) */
  dirty?: boolean;
  /** o arquivo no repo mudou enquanto havia alterações locais */
  repoChanged?: boolean;
}

interface State extends Snapshot {
  view: ViewMode;
  selection: Selection;
  cutaway: boolean;
  showCeiling: boolean;
  hour: number;
  snap: boolean;
  theme: Theme;
  past: Snapshot[];
  future: Snapshot[];
  cameraPreset: { preset: CameraPreset; nonce: number };

  versions: Version[];
  activeId: string | null;
  screen: Screen;
  /** versões do repo que o usuário escondeu neste navegador */
  hiddenRepo: string[];

  setView: (v: ViewMode) => void;
  select: (s: Selection) => void;
  setCutaway: (v: boolean) => void;
  setShowCeiling: (v: boolean) => void;
  setHour: (h: number) => void;
  setSnap: (v: boolean) => void;
  setTheme: (t: Theme) => void;
  goCamera: (p: CameraPreset) => void;

  commit: () => void;
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

  setScreen: (s: Screen) => void;
  createVersion: (name: string, from: "original" | string) => string;
  openVersion: (id: string) => void;
  renameVersion: (id: string, name: string) => void;
  duplicateVersion: (id: string, name?: string) => string;
  deleteVersion: (id: string) => void;
  setThumb: (id: string, thumb: string) => void;
  syncActive: () => void;
  mergeRepo: (files: VersionFile[]) => void;
  revertToRepo: (id: string) => void;
  markSavedToRepo: (id: string, file: VersionFile) => void;
}

const SNAP_KEYS = ["items", "removedWalls", "floors", "wallColors", "wallColor", "extraWalls", "rooms", "removedRooms"] as const;

const snap = (s: Snapshot): Snapshot => ({
  items: s.items,
  removedWalls: s.removedWalls,
  floors: s.floors,
  wallColors: s.wallColors,
  wallColor: s.wallColor,
  extraWalls: s.extraWalls,
  rooms: s.rooms,
  removedRooms: s.removedRooms,
});

/** compara pelo conteúdo (abrir uma versão cria objetos novos, mas não é uma edição) */
const sameSnapshot = (a: Snapshot, b: Snapshot) =>
  SNAP_KEYS.every((k) => a[k] === b[k] || JSON.stringify(a[k]) === JSON.stringify(b[k]));

const vid = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const uniqueName = (versions: Version[], base: string) => {
  const names = new Set(versions.map((v) => v.name));
  if (!names.has(base)) return base;
  let k = 2;
  while (names.has(`${base} (${k})`)) k++;
  return `${base} (${k})`;
};

const fromFile = (f: VersionFile): Version => {
  const t = Date.parse(f.updatedAt) || Date.now();
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    data: fileToSnapshot(f),
    createdAt: t,
    updatedAt: t,
    repo: { id: f.id, updatedAt: f.updatedAt },
  };
};

/** arquivos de /versions carregados no build (preenchido pelo App) */
export let repoFiles: VersionFile[] = [];
let repoRegistered = false;
/** registra versões (/versions) e móveis (/furniture) vindos do build — idempotente */
export function registerRepo(versions: VersionFile[], furniture: CatalogEntry[]) {
  if (repoRegistered) return;
  repoRegistered = true;
  repoFiles = versions;
  registerCatalog(furniture);
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...originalSnapshot(),
      view: "split",
      selection: null,
      cutaway: true,
      showCeiling: false,
      hour: 10,
      snap: true,
      theme: "light",
      past: [],
      future: [],
      cameraPreset: { preset: "iso", nonce: 0 },
      versions: [],
      activeId: null,
      screen: "versions",
      hiddenRepo: [],

      setView: (view) => set({ view }),
      select: (selection) => set({ selection }),
      setCutaway: (cutaway) => set({ cutaway }),
      setShowCeiling: (showCeiling) => set({ showCeiling }),
      setHour: (hour) => set({ hour }),
      setSnap: (snap) => set({ snap }),
      setTheme: (theme) => set({ theme }),
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
        const c = catalogByType[type];
        if (!c) return;
        get().commit();
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

      // ------------------------------------------------------------ versões
      setScreen: (screen) => {
        get().syncActive();
        set({ screen, selection: null });
      },
      syncActive: () =>
        set((s) => {
          const v = s.versions.find((x) => x.id === s.activeId);
          if (!v) return {};
          const cur = snap(s);
          if (sameSnapshot(cur, v.data)) return {};
          return {
            versions: s.versions.map((x) =>
              x.id === v.id ? { ...x, data: cur, updatedAt: Date.now(), dirty: x.repo ? true : x.dirty } : x,
            ),
          };
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
        set({ ...normalizeSnapshot(v.data), activeId: id, screen: "editor", selection: null, past: [], future: [] });
      },
      renameVersion: (id, name) =>
        set((s) => ({
          versions: s.versions.map((v) => {
            if (v.id !== id) return v;
            const n = uniqueName(s.versions.filter((x) => x.id !== id), name.trim() || v.name);
            return { ...v, name: n, dirty: v.repo && n !== v.name ? true : v.dirty };
          }),
        })),
      duplicateVersion: (id, name) => {
        get().syncActive();
        const s = get();
        const src = s.versions.find((v) => v.id === id);
        if (!src) return id;
        const now = Date.now();
        const v: Version = {
          id: vid(), name: uniqueName(s.versions, name?.trim() || `${src.name} — cópia`), description: src.description,
          data: src.data, thumb: src.thumb, createdAt: now, updatedAt: now,
        };
        set({ versions: [...s.versions, v] });
        return v.id;
      },
      deleteVersion: (id) =>
        set((s) => {
          const v = s.versions.find((x) => x.id === id);
          const versions = s.versions.filter((x) => x.id !== id);
          const hiddenRepo = v?.repo ? [...s.hiddenRepo, v.repo.id] : s.hiddenRepo;
          return s.activeId === id ? { versions, hiddenRepo, activeId: null, screen: "versions" } : { versions, hiddenRepo };
        }),
      setThumb: (id, thumb) => set((s) => ({ versions: s.versions.map((v) => (v.id === id ? { ...v, thumb } : v)) })),

      // junta as versões commitadas em /versions com as do navegador
      mergeRepo: (files) => {
        get().syncActive();
        set((s) => {
          let versions = [...s.versions];
          let working: Partial<State> = {};
          for (const f of files) {
            if (s.hiddenRepo.includes(f.id)) continue;
            const i = versions.findIndex((v) => v.repo?.id === f.id);
            if (i < 0) {
              if (versions.some((v) => v.id === f.id)) continue;
              versions.push(fromFile(f));
              continue;
            }
            const local = versions[i];
            if (local.repo!.updatedAt === f.updatedAt) continue;
            if (local.dirty) {
              versions[i] = { ...local, repoChanged: true };
            } else {
              versions[i] = { ...fromFile(f), id: local.id, thumb: local.thumb, createdAt: local.createdAt };
              if (s.activeId === local.id) working = { ...fileToSnapshot(f), past: [], future: [] };
            }
          }
          // versão que saiu do repo e não foi mexida aqui: some também
          const repoIds = new Set(files.map((f) => f.id));
          versions = versions.filter((v) => !v.repo || repoIds.has(v.repo.id) || v.dirty);
          const activeId = versions.some((v) => v.id === s.activeId) ? s.activeId : null;
          return { versions, activeId, ...(activeId ? {} : { screen: "versions" as Screen }), ...working };
        });
      },
      revertToRepo: (id) => {
        const s = get();
        const v = s.versions.find((x) => x.id === id);
        const file = v?.repo && repoFiles.find((f) => f.id === v.repo!.id);
        if (!v || !file) return;
        const fresh = { ...fromFile(file), id: v.id, thumb: v.thumb, createdAt: v.createdAt };
        set({ versions: s.versions.map((x) => (x.id === id ? fresh : x)) });
        if (s.activeId === id) set({ ...fresh.data, past: [], future: [], selection: null });
      },
      markSavedToRepo: (id, file) =>
        set((s) => ({
          versions: s.versions.map((v) =>
            v.id === id ? { ...v, name: file.name, repo: { id: file.id, updatedAt: file.updatedAt }, dirty: false, repoChanged: false } : v,
          ),
        })),
    }),
    {
      name: "apto-1707",
      version: 4,
      partialize: (s) => ({
        ...snap(s),
        versions: s.versions, activeId: s.activeId, screen: s.screen, hiddenRepo: s.hiddenRepo,
        view: s.view, cutaway: s.cutaway, hour: s.hour, snap: s.snap, showCeiling: s.showCeiling, theme: s.theme,
      }),
      migrate: (persisted, from) => {
        const p = (persisted ?? {}) as Partial<State> & { versions?: Version[] };
        if (from < 2) {
          const now = Date.now();
          const v: Version = { id: vid(), name: "Minha planta", data: normalizeSnapshot(p), createdAt: now, updatedAt: now };
          return { ...p, ...normalizeSnapshot(p), versions: [v], activeId: v.id, screen: "versions" } as unknown as State;
        }
        // v2 → v3: snapshots ganharam paredes/cômodos extras · v4: tema padrão = claro
        return {
          ...p,
          ...(from < 4 ? { theme: "light" as Theme } : {}),
          ...normalizeSnapshot(p),
          versions: (p.versions ?? []).map((v) => ({ ...v, data: normalizeSnapshot(v.data) })),
        } as unknown as State;
      },
    },
  ),
);

/** paredes e cômodos da versão aberta (planta base + edições da versão) */
export function usePlan() {
  const extraWalls = useStore((s) => s.extraWalls);
  const rooms = useStore((s) => s.rooms);
  const removedRooms = useStore((s) => s.removedRooms);
  return useMemo(() => resolvePlan({ extraWalls, rooms, removedRooms }), [extraWalls, rooms, removedRooms]);
}

// salva automaticamente as mudanças na versão ativa (localStorage deste navegador)
if (typeof window !== "undefined") {
  let t: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((s, prev) => {
    if (SNAP_KEYS.every((k) => s[k] === prev[k])) return;
    clearTimeout(t);
    t = setTimeout(() => useStore.getState().syncActive(), 300);
  });
  window.addEventListener("beforeunload", () => useStore.getState().syncActive());
}
