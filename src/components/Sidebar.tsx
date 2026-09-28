"use client";

import { useMemo, useState } from "react";
import { capture } from "@/lib/capture";
import { polyArea, type FloorFinish } from "@/data/apartment";
import { GROUPS, catalog, catalogByType, type CatalogEntry, type FurnitureType } from "@/data/catalog";
import { floorFinishes, wallPalette } from "@/lib/materials";
import { usePlan, useStore, type Theme } from "@/lib/store";
import { roomAt } from "@/lib/plan";
import { LivePreview, ThumbFactory, useThumb } from "./FurniturePreview";

// Regra de texto da UI: rótulos curtos, avisos em 1 frase, detalhes no `title` (tooltip). Ver AGENTS.md.

const kindLabel = { ext: "Fachada / divisa", int: "Interna", pillar: "Pilar", parapet: "Guarda-corpo" } as const;
type Tab = "moveis" | "editar" | "vista";

// ------------------------------------------------------------------ Editar (seleção)
function Inspector() {
  const selection = useStore((s) => s.selection);
  const items = useStore((s) => s.items);
  const removed = useStore((s) => s.removedWalls);
  const floors = useStore((s) => s.floors);
  const { walls, rooms } = usePlan();
  const s = useStore();

  if (!selection)
    return (
      <div className="stack">
        <p className="muted small">Clique num móvel, parede ou piso para editar.</p>
        <Walls />
      </div>
    );

  if (selection.kind === "item") {
    const it = items.find((i) => i.id === selection.id);
    if (!it) return null;
    const num = (k: "w" | "d" | "h", label: string) => (
      <label className="field">
        <span>{label}</span>
        <input
          type="number"
          step={0.05}
          min={0.05}
          value={Number(it[k].toFixed(2))}
          onChange={(e) => s.updateItem(it.id, { [k]: Math.max(0.02, Number(e.target.value)) })}
        />
      </label>
    );
    return (
      <div className="stack">
        <div className="insp-title">
          <strong>{catalogByType[it.type]?.name ?? it.type}</strong>
          <span className="muted small">{roomAt(rooms, it.x, it.y)?.name ?? "fora"}{it.fixed ? " · projeto" : ""}</span>
        </div>
        <div className="row3">{num("w", "Larg. (m)")}{num("d", "Prof. (m)")}{num("h", "Alt. (m)")}</div>
        <div className="row compact">
          <input type="color" value={it.color} onChange={(e) => s.updateItem(it.id, { color: e.target.value })} title="Cor" />
          <button onClick={() => s.rotateItem(it.id, 90)} title="Girar 90° (R)">⟲ 90°</button>
          <button onClick={() => s.rotateItem(it.id, -15)} title="Girar 15°">⟳ 15°</button>
          <span className="muted small">{it.rot}°</span>
        </div>
        <div className="row">
          <button onClick={() => s.duplicateItem(it.id)}>Duplicar</button>
          <button className="danger" onClick={() => s.removeItem(it.id)} title="Del">Remover</button>
        </div>
      </div>
    );
  }

  if (selection.kind === "wall") {
    const w = walls.find((x) => x.id === selection.id);
    if (!w) return null;
    const isRemoved = removed.includes(w.id);
    const len = Math.max(w.x1 - w.x0, w.y1 - w.y0);
    const thick = Math.min(w.x1 - w.x0, w.y1 - w.y0);
    const structural = w.kind === "ext" || w.kind === "pillar";
    return (
      <div className="stack">
        <div className="insp-title">
          <strong>{w.name}</strong>
          <span className="muted small" title={structural ? "Estrutural / fachada — remover é só simulação" : undefined}>
            {kindLabel[w.kind]} · {len.toFixed(2)} m × {(thick * 100).toFixed(0)} cm{structural ? " · ⚠︎" : ""}
          </span>
        </div>
        <button className={isRemoved ? "" : "danger"} onClick={() => s.toggleWall(w.id)}>
          {isRemoved ? "Recolocar parede" : "Remover parede"}
        </button>
        {!isRemoved && w.kind !== "pillar" && (
          <div className="swatches">
            {wallPalette.map((p) => (
              <button key={p.color} title={p.name} className="swatch" style={{ background: p.color }} onClick={() => s.setWallColor(p.color, w.id)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const r = rooms.find((x) => x.id === selection.id);
  if (!r) return null;
  return (
    <div className="stack">
      <div className="insp-title">
        <strong>{r.name}</strong>
        <span className="muted small">{polyArea(r.poly).toFixed(2)} m²</span>
      </div>
      <div className="finishes">
        {(Object.keys(floorFinishes) as FloorFinish[]).map((f) => (
          <button key={f} className={(floors[r.id] ?? r.floor) === f ? "on" : ""} onClick={() => s.setFloor(r.id, f)}>
            <span className="dot" style={{ background: floorFinishes[f].color }} /> {floorFinishes[f].name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Walls() {
  const s = useStore();
  return (
    <div className="stack tight">
      <span className="label">Cor das paredes</span>
      <div className="swatches">
        {wallPalette.map((p) => (
          <button key={p.color} title={p.name} className={`swatch ${s.wallColor === p.color ? "on" : ""}`} style={{ background: p.color }} onClick={() => s.setWallColor(p.color)} />
        ))}
      </div>
      {s.removedWalls.length > 0 && (
        <button onClick={s.restoreWalls}>Recolocar paredes removidas ({s.removedWalls.length})</button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Móveis
function Thumb({ c, active, onPick, onAdd }: { c: CatalogEntry; active: boolean; onPick: () => void; onAdd: () => void }) {
  const url = useThumb(c.type);
  return (
    <button className={`fcard ${active ? "on" : ""}`} onClick={onPick} onDoubleClick={onAdd} title={`${c.name} · ${c.w}×${c.d}×${c.h} m — duplo clique adiciona`}>
      <span className="fthumb">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" />
        ) : (
          <span className="dot" style={{ background: c.color, width: 18, height: 18 }} />
        )}
      </span>
      <span className="fname">{c.name}</span>
    </button>
  );
}

function FurnitureTab() {
  const s = useStore();
  const { rooms } = usePlan();
  const [group, setGroup] = useState<string>("Todos");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const groups = useMemo(() => ["Todos", ...GROUPS.filter((g) => catalog.some((c) => c.group === g))], []);
  const list = catalog.filter(
    (c) => (group === "Todos" || c.group === group) && (!q || c.name.toLowerCase().includes(q.toLowerCase())),
  );
  const entry = picked ? catalogByType[picked] : null;

  const add = (t: FurnitureType) => {
    // no centro do cômodo selecionado (ou do cômodo do móvel selecionado, ou da sala)
    const sel = s.selection;
    let room = rooms.find((r) => r.id === "sala") ?? rooms[0];
    if (sel?.kind === "room") room = rooms.find((r) => r.id === sel.id) ?? room;
    if (sel?.kind === "item") {
      const it = s.items.find((i) => i.id === sel.id);
      if (it) room = roomAt(rooms, it.x, it.y) ?? room;
    }
    s.addItem(t, room.label[0], room.label[1] - 0.4);
  };

  return (
    <div className="stack">
      <ThumbFactory entries={catalog} />
      {entry ? (
        <div className="fpreview">
          <div className="fpreview-3d">
            <LivePreview entry={entry} />
          </div>
          <div className="fpreview-info">
            <strong>{entry.name}</strong>
            <span className="muted small">{entry.w} × {entry.d} × {entry.h} m</span>
            <div className="row">
              <button className="primary" onClick={() => add(entry.type)}>Adicionar</button>
              <button className="ghost" onClick={() => setPicked(null)}>Fechar</button>
            </div>
          </div>
        </div>
      ) : (
        <p className="muted small">Clique num móvel para ver em 3D.</p>
      )}
      <input className="search" placeholder="Buscar móvel…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {groups.map((g) => (
          <button key={g} className={`chip-s ${group === g ? "on" : ""}`} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </div>
      <div className="fgrid">
        {list.map((c) => (
          <Thumb key={c.type} c={c} active={picked === c.type} onPick={() => setPicked(c.type)} onAdd={() => add(c.type)} />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Vista
function ViewTab() {
  const s = useStore();
  const hh = `${String(Math.floor(s.hour)).padStart(2, "0")}:${String(Math.round((s.hour % 1) * 60)).padStart(2, "0")}`;
  return (
    <div className="stack">
      <span className="label">Câmera</span>
      <div className="seg3">
        <button onClick={() => { s.setCutaway(true); s.setShowCeiling(false); s.goCamera("iso"); }}>Maquete</button>
        <button onClick={() => s.goCamera("top")}>Topo</button>
        <button onClick={() => s.goCamera("eye")} title="W A S D anda · Q / E vira">Olho humano</button>
      </div>
      <label className="check"><input type="checkbox" checked={s.cutaway} onChange={(e) => s.setCutaway(e.target.checked)} /> Paredes cortadas</label>
      <label className="check" title="Aparece com as paredes inteiras"><input type="checkbox" checked={s.showCeiling} onChange={(e) => s.setShowCeiling(e.target.checked)} /> Teto</label>
      <label className="check"><input type="checkbox" checked={s.snap} onChange={(e) => s.setSnap(e.target.checked)} /> Grade de 5 cm</label>
      <label className="field">
        <span>Luz do dia · {hh}</span>
        <input type="range" min={5.5} max={19} step={0.25} value={s.hour} onChange={(e) => s.setHour(Number(e.target.value))} />
      </label>
      <span className="label">Tema</span>
      <div className="seg3">
        {(["light", "dark", "auto"] as Theme[]).map((t) => (
          <button key={t} className={s.theme === t ? "on" : ""} onClick={() => s.setTheme(t)}>
            {t === "auto" ? "Sistema" : t === "light" ? "Claro" : "Escuro"}
          </button>
        ))}
      </div>
      <details className="small muted">
        <summary>Atalhos</summary>
        <ul className="keys">
          <li><kbd>arrastar</kbd> move móvel / vista</li>
          <li><kbd>roda</kbd> zoom · <kbd>clique na roda</kbd> gira</li>
          <li><kbd>R</kbd> gira móvel · <kbd>Del</kbd> remove</li>
          <li><kbd>W A S D</kbd> anda · <kbd>Q E</kbd> vira</li>
          <li><kbd>⌘Z</kbd> desfaz · <kbd>P</kbd> captura</li>
        </ul>
      </details>
      <button className="ghost danger" onClick={() => confirm("Voltar esta versão ao projeto original?") && s.reset()}>Resetar versão</button>
    </div>
  );
}

// ------------------------------------------------------------------ cabeçalho
function VersionName() {
  const version = useStore((s) => s.versions.find((v) => v.id === s.activeId));
  const rename = useStore((s) => s.renameVersion);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  if (!version) return null;
  if (editing)
    return (
      <input
        className="vname-input"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { rename(version.id, name); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { rename(version.id, name); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  return (
    <h1 title="Clique para renomear" className="vname" onClick={() => { setName(version.name); setEditing(true); }}>
      {version.name}
    </h1>
  );
}

async function thumbnail(): Promise<string | undefined> {
  try {
    const shot = await capture(0.75);
    const img = new Image();
    img.src = shot.url;
    await img.decode();
    const W = 560, H = Math.round((W * img.height) / img.width);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    c.getContext("2d")!.drawImage(img, 0, 0, W, H);
    return c.toDataURL("image/jpeg", 0.8);
  } catch {
    return undefined; // 3D não estava aberto
  }
}

export default function Sidebar({ onCapture }: { onCapture: () => void }) {
  const s = useStore();
  const version = s.versions.find((v) => v.id === s.activeId);
  const [tab, setTab] = useState<Tab>("moveis");
  // ao selecionar algo no 2D/3D, abre a aba "Editar"
  const selKey = s.selection ? `${s.selection.kind}:${s.selection.id}` : "";
  const [lastSel, setLastSel] = useState(selKey);
  if (selKey !== lastSel) {
    setLastSel(selKey);
    if (selKey) setTab("editar");
  }

  const goVersions = async () => {
    const id = s.activeId;
    const t = await thumbnail();
    if (id && t) s.setThumb(id, t);
    s.setScreen("versions");
  };
  const saveAs = () => {
    const n = prompt("Nome da nova versão:", version ? `${version.name} — variação` : "Nova versão");
    if (n === null) return;
    s.syncActive();
    s.openVersion(s.duplicateVersion(s.activeId!, n));
  };
  const status = !version?.repo ? "Só neste navegador" : version.dirty ? "Editada · só neste navegador" : "Igual ao repo";

  return (
    <aside className="sidebar">
      <header className="sb-head">
        <div className="row between">
          <button className="ghost back" onClick={goVersions}>← Versões</button>
          <button className="ghost small" onClick={saveAs} title="Duplicar esta versão com outro nome">⧉ Nova variação</button>
        </div>
        <VersionName />
        <span
          className={`vstatus ${version?.repo && !version.dirty ? "repo" : "warn"}`}
          title="Edições feitas no app ficam só neste navegador — não vão para o repositório. Para guardar: Exportar JSON na tela de versões."
        >
          {status} ⓘ
        </span>
      </header>

      <div className="sb-tools">
        <div className="seg3">
          {(["3d", "split", "2d"] as const).map((v) => (
            <button key={v} className={s.view === v ? "on" : ""} onClick={() => s.setView(v)}>
              {v === "3d" ? "3D" : v === "2d" ? "2D" : "2D+3D"}
            </button>
          ))}
        </div>
        <div className="row compact">
          <button onClick={s.undo} disabled={!s.past.length} title="Desfazer (⌘Z)">↶</button>
          <button onClick={s.redo} disabled={!s.future.length} title="Refazer (⌘⇧Z)">↷</button>
          <button className="primary grow" onClick={onCapture} title="Captura PNG do ângulo atual + prompt (P)">📸 Capturar</button>
        </div>
      </div>

      <nav className="tabs">
        {([["moveis", "Móveis"], ["editar", "Editar"], ["vista", "Vista"]] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      <div className="sb-body">
        {tab === "moveis" && <FurnitureTab />}
        {tab === "editar" && <Inspector />}
        {tab === "vista" && <ViewTab />}
      </div>
    </aside>
  );
}
