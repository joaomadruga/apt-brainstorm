"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { entryName, type CatalogEntry } from "@/data/catalog";
import { capture, type CaptureResult } from "@/lib/capture";
import { floorFinishes, wallPalette } from "@/lib/materials";
import { registerRepo, useStore } from "@/lib/store";
import type { VersionFile } from "@/lib/files";
import { resolvePlan, roomAt as roomIn } from "@/lib/plan";
import { useResolvedTheme } from "@/lib/theme";
import Plan2D from "./Plan2D";
import Sidebar from "./Sidebar";
import VersionsScreen from "./Versions";

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false, loading: () => <div className="loading">Carregando 3D…</div> });

function buildPrompt(r: CaptureResult) {
  const st = useStore.getState();
  const { rooms, walls } = resolvePlan(st);
  const roomAt = (x: number, y: number) => roomIn(rooms, x, y);
  const cam = r.camera;
  const room = roomAt(cam.x, cam.y);
  const deg = (Math.atan2(cam.dir.y, cam.dir.x) * 180) / Math.PI;
  const compass = ["leste", "nordeste", "norte", "noroeste", "oeste", "sudoeste", "sul", "sudeste"][Math.round(((deg + 360) % 360) / 45) % 8];
  const pitch = (Math.asin(Math.max(-1, Math.min(1, cam.dir.z))) * 180) / Math.PI;
  const wallName = wallPalette.find((p) => p.color === st.wallColor)?.name ?? st.wallColor;
  const furniture = st.items
    .map((i) => `${entryName(i.type)} (${i.w.toFixed(2)}×${i.d.toFixed(2)} m, ${roomAt(i.x, i.y)?.name ?? "—"})`)
    .join("; ");
  const floorsTxt = rooms.map((rm) => `${rm.name}: ${floorFinishes[st.floors[rm.id] ?? rm.floor].prompt}`).join("; ");
  const removed = st.removedWalls.map((id) => walls.find((w) => w.id === id)?.name).filter(Boolean);
  const hh = Math.floor(st.hour), mm = Math.round((st.hour % 1) * 60);
  const inside = room && cam.z < 2.6;
  return [
    "Photorealistic interior architectural render of a compact 52 m² apartment in Recife, Brazil (2 bedrooms: master suite + bedroom, living room with balcony, open kitchen with laundry corner, 2 bathrooms).",
    "Keep EXACTLY the same camera angle, framing, perspective, room layout, wall positions, openings and furniture placement as the reference image. Only improve materials, lighting and realism; do not add or move walls, doors or windows.",
    inside
      ? `Camera: eye-level inside the ${room!.name}, ${cam.z.toFixed(2)} m above floor, looking ${compass} (pitch ${pitch.toFixed(0)}°), ${cam.fov.toFixed(0)}° vertical FOV.`
      : `Camera: ${pitch < -60 ? "top-down" : "elevated three-quarter"} view of the cut-away apartment model, looking ${compass}, pitch ${pitch.toFixed(0)}°.`,
    `Ceiling height 2.60 m. Walls painted ${wallName}. Floors — ${floorsTxt}.`,
    `Windows: sliding aluminium windows with 1.10 m sills; full-height 2.00 m sliding glass door to the balcony with a 1.10 m glass railing.`,
    `Time of day ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}, tropical natural daylight${st.hour > 17.7 || st.hour < 6.3 ? " (night, warm interior lamps)" : ""}.`,
    removed.length ? `Removed walls (open plan): ${removed.join(", ")}.` : "",
    `Furniture present: ${furniture}.`,
    "Style: contemporary Brazilian, natural textures, soft shadows, 35mm lens look, high dynamic range, no people, no text.",
  ]
    .filter(Boolean)
    .join("\n");
}

function CaptureModal({ shot, onClose }: { shot: CaptureResult; onClose: () => void }) {
  const [prompt] = useState(() => buildPrompt(shot));
  const vname = useStore((s) => s.versions.find((v) => v.id === s.activeId)?.name ?? "apto1707");
  const slug = vname.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  const [copied, setCopied] = useState("");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const copyImage = async () => {
    try {
      const blob = await (await fetch(shot.url)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied("imagem");
    } catch {
      setCopied("erro");
    }
  };
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <div className="modal-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot.url} alt="captura" />
        </div>
        <div className="modal-side">
          <strong>Captura {shot.width}×{shot.height}px</strong>
          <div className="row">
            <a className="btn primary" href={shot.url} download={`apto1707-${slug}-${stamp}.png`}>Baixar PNG</a>
            <button onClick={copyImage}>Copiar imagem</button>
          </div>
          <span className="small">Prompt sugerido para o modelo de imagem (envie junto com o PNG):</span>
          <textarea readOnly value={prompt} rows={14} />
          <div className="row">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(prompt);
                setCopied("prompt");
              }}
            >
              Copiar prompt
            </button>
            <button onClick={onClose}>Fechar</button>
          </div>
          {copied && <span className="small muted">{copied === "erro" ? "Não deu pra copiar — use Baixar." : `✓ ${copied} copiado`}</span>}
        </div>
      </div>
    </div>
  );
}

/** Abre/fecha as divisórias camarão (móvel "divisoria") com animação no 3D */
function PartitionToggle() {
  const has = useStore((s) => s.items.some((i) => i.type === "divisoria"));
  const closed = useStore((s) => s.partitionsClosed);
  const toggle = useStore((s) => s.togglePartitions);
  if (!has) return null;
  return (
    <button className={`partition-toggle ${closed ? "on" : ""}`} onClick={toggle} title="Anima as divisórias camarão do escritório">
      {closed ? "Abrir escritório" : "Fechar escritório"}
    </button>
  );
}

export default function App({
  repoVersions,
  repoFurniture,
  canSaveToRepo,
}: {
  repoVersions: VersionFile[];
  repoFurniture: CatalogEntry[];
  canSaveToRepo: boolean;
}) {
  // móveis de /furniture e versões de /versions (lidos no build)
  registerRepo(repoVersions, repoFurniture);
  useResolvedTheme();
  const view = useStore((s) => s.view);
  const screen = useStore((s) => s.screen);
  const activeId = useStore((s) => s.activeId);
  const [shot, setShot] = useState<CaptureResult | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // estado vem do localStorage: só renderiza no cliente
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);

  const doCapture = useCallback(async () => {
    if (useStore.getState().view === "2d") useStore.getState().setView("split");
    await new Promise((r) => setTimeout(r, 400));
    try {
      setShot(await capture(2));
    } catch (e) {
      alert((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      const s = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod) return;
      if (e.key === "p" || e.key === "P") doCapture();
      if (e.key === "Escape") s.select(null);
      const sel = s.selection;
      if (!sel) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (sel.kind === "item") s.removeItem(sel.id);
        if (sel.kind === "wall") s.toggleWall(sel.id);
      }
      if (sel.kind === "item" && (e.key === "r" || e.key === "R")) s.rotateItem(sel.id, e.shiftKey ? -90 : 90);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doCapture]);

  // junta as versões do repositório com as deste navegador
  useEffect(() => {
    if (!hydrated) return;
    const s = useStore.getState();
    s.mergeRepo(repoVersions);
    if (useStore.getState().versions.length === 0) s.createVersion("Projeto original", "original");
  }, [hydrated, repoVersions]);

  if (!hydrated) return <div className="loading">Carregando…</div>;
  if (screen === "versions" || !activeId) return <VersionsScreen canSaveToRepo={canSaveToRepo} />;

  return (
    <div className="app">
      <Sidebar onCapture={doCapture} />
      <main className={`views ${view}`}>
        {view !== "3d" && (
          <div className="pane">
            <Plan2D />
          </div>
        )}
        {view !== "2d" && (
          <div className="pane">
            <Scene3D />
            <PartitionToggle />
          </div>
        )}
      </main>
      {shot && <CaptureModal shot={shot} onClose={() => setShot(null)} />}
    </div>
  );
}
