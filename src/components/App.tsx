"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogEntry } from "@/data/catalog";
import { startRepoAutosave, type AutosaveStatus } from "@/lib/autosave";
import { capture, type CaptureResult } from "@/lib/capture";
import { registerRepo, useStore } from "@/lib/store";
import type { VersionFile } from "@/lib/files";
import { ensure3D, takePhoto, usePhoto } from "@/lib/photo";
import { buildFramePrompt } from "@/lib/photoPrompt";
import { useResolvedTheme } from "@/lib/theme";
import Plan2D from "./Plan2D";
import Sidebar from "./Sidebar";
import VersionsScreen from "./Versions";

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false, loading: () => <div className="loading">Carregando 3D…</div> });

function CaptureModal({ shot, onClose }: { shot: CaptureResult; onClose: () => void }) {
  const [prompt] = useState(() => buildFramePrompt(shot.report, shot));
  const isPhoto = shot.kind === "photo";
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
          <strong>{isPhoto ? `Foto · ${shot.lens} mm · ${shot.aspect}` : "Captura"} · {shot.width}×{shot.height}px</strong>
          <div className="row">
            <a className="btn primary" href={shot.url} download={`apto1707-${slug}-${stamp}.png`}>Baixar PNG</a>
            <button onClick={copyImage}>Copiar imagem</button>
          </div>
          <span className="small" title="Lista só o que aparece no quadro (paredes, portas, janelas e móveis visíveis)">Prompt do que está no quadro (envie junto com o PNG):</span>
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

/** telas em que o app vira só visualização (sem edição) */
const VIEW_ONLY_QUERY = "(max-width: 900px), (hover: none) and (pointer: coarse)";

/** Abre/fecha as divisórias camarão (móvel "divisoria") com animação no 3D — flutua sempre no canto */
function PartitionToggle() {
  const has = useStore((s) => s.items.some((i) => i.type === "divisoria"));
  const closed = useStore((s) => s.partitionsClosed);
  const toggle = useStore((s) => s.togglePartitions);
  return (
    <button
      className={`partition-toggle ${closed && has ? "on" : ""}`}
      onClick={toggle}
      disabled={!has}
      title={has ? "Anima as divisórias camarão do escritório" : "Adicione o móvel \"Divisória camarão (abre/fecha)\" (grupo Escritório) nesta versão"}
    >
      {!has ? "Sem divisória nesta versão" : closed ? "Abrir escritório" : "Fechar escritório"}
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
  const [autosave, setAutosave] = useState<AutosaveStatus>(null);
  // estado vem do localStorage: só renderiza no cliente
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);

  const photoShot = usePhoto((p) => p.shot);
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
      if (e.key === "f" || e.key === "F") takePhoto(ensure3D);
      if (e.key === "Escape") {
        s.select(null);
        usePhoto.getState().setPlacing(false);
      }
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

  // URL compartilhável: ?v=<id da versão> abre a versão; sem ?v= mostra a tela de versões
  const urlReady = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    const apply = () => {
      const id = new URLSearchParams(window.location.search).get("v");
      const st = useStore.getState();
      if (id && st.versions.some((v) => v.id === id)) {
        if (st.activeId !== id || st.screen !== "editor") st.openVersion(id);
      } else if (st.screen !== "versions") st.setScreen("versions");
    };
    apply();
    urlReady.current = true;
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, [hydrated]);
  useEffect(() => {
    if (!urlReady.current) return;
    const st = useStore.getState(); // lê do store (o efeito acima pode ter acabado de mudar)
    const url = new URL(window.location.href);
    const want = st.screen === "editor" && st.activeId ? st.activeId : null;
    if (url.searchParams.get("v") === want) return;
    if (want) url.searchParams.set("v", want);
    else url.searchParams.delete("v");
    window.history.pushState(null, "", url);
  }, [hydrated, screen, activeId]);

  // celular/tablet (tela estreita ou só toque): modo só visualização
  useEffect(() => {
    const mq = window.matchMedia(VIEW_ONLY_QUERY);
    const apply = () => useStore.getState().setViewOnly(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // rodando local: cada edição grava versions/<id>.json (ver lib/autosave.ts)
  useEffect(() => {
    if (!hydrated || !canSaveToRepo) return;
    return startRepoAutosave(setAutosave);
  }, [hydrated, canSaveToRepo]);
  useEffect(() => {
    if (autosave?.state !== "saved") return;
    const t = setTimeout(() => setAutosave(null), 2500);
    return () => clearTimeout(t);
  }, [autosave]);
  const autosaveToast = autosave && <div className={`autosave ${autosave.state}`}>{autosave.text}</div>;

  if (!hydrated) return <div className="loading">Carregando…</div>;
  if (screen === "versions" || !activeId)
    return (
      <>
        <VersionsScreen canSaveToRepo={canSaveToRepo} />
        {autosaveToast}
      </>
    );

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
          </div>
        )}
      </main>
      <PartitionToggle />
      {autosaveToast}
      {shot && <CaptureModal shot={shot} onClose={() => setShot(null)} />}
      {photoShot && !shot && <CaptureModal key={photoShot.url.length} shot={photoShot} onClose={() => usePhoto.getState().setShot(null)} />}
    </div>
  );
}
