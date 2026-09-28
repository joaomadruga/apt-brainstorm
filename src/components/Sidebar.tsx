"use client";

import { useMemo, useState } from "react";
import { capture } from "@/lib/capture";
import { polyArea, type FloorFinish } from "@/data/apartment";
import { catalog, catalogByType, type FurnitureType } from "@/data/catalog";
import { floorFinishes, wallPalette } from "@/lib/materials";
import { usePlan, useStore, type Theme } from "@/lib/store";
import { roomAt } from "@/lib/plan";

const kindLabel = { ext: "Fachada / divisa", int: "Interna", pillar: "Pilar (estrutural)", parapet: "Guarda-corpo" } as const;


function Inspector() {
  const selection = useStore((s) => s.selection);
  const items = useStore((s) => s.items);
  const removed = useStore((s) => s.removedWalls);
  const floors = useStore((s) => s.floors);
  const { walls, rooms } = usePlan();
  const s = useStore();

  if (!selection)
    return <p className="muted">Clique num móvel, parede ou piso (no 2D ou no 3D) para editar.</p>;

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
        <strong>{catalogByType[it.type]?.name ?? it.type}{it.fixed ? " · do projeto" : ""}</strong>
        <div className="row3">{num("w", "Larg.")}{num("d", "Prof.")}{num("h", "Alt.")}</div>
        <div className="muted small">
          Posição: x {it.x.toFixed(2)} · y {it.y.toFixed(2)} · {it.rot}° · {roomAt(rooms, it.x, it.y)?.name ?? "fora"}
        </div>
        <label className="field">
          <span>Cor</span>
          <input type="color" value={it.color} onChange={(e) => s.updateItem(it.id, { color: e.target.value })} />
        </label>
        <div className="row">
          <button onClick={() => s.rotateItem(it.id, 90)}>⟲ 90°</button>
          <button onClick={() => s.rotateItem(it.id, -90)}>⟳ 90°</button>
          <button onClick={() => s.rotateItem(it.id, 15)}>+15°</button>
          <button onClick={() => s.rotateItem(it.id, -15)}>−15°</button>
        </div>
        <div className="row">
          <button onClick={() => s.duplicateItem(it.id)}>Duplicar</button>
          <button className="danger" onClick={() => s.removeItem(it.id)}>Remover</button>
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
    return (
      <div className="stack">
        <strong>{w.name}</strong>
        <div className="muted small">
          {kindLabel[w.kind]} · {len.toFixed(2)} m × {(thick * 100).toFixed(0)} cm
          {w.openings?.length ? ` · ${w.openings.map((o) => o.label).join(", ")}` : ""}
        </div>
        {(w.kind === "ext" || w.kind === "pillar") && (
          <div className="warn small">⚠️ Estrutural / fachada — remover aqui é só para brincar.</div>
        )}
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
      <strong>{r.name}</strong>
      <div className="muted small">{polyArea(r.poly).toFixed(2)} m²</div>
      <span className="small">Piso</span>
      <div className="stack tight">
        {(Object.keys(floorFinishes) as FloorFinish[]).map((f) => (
          <button key={f} className={floors[r.id] === f ? "on" : ""} onClick={() => s.setFloor(r.id, f)}>
            <span className="dot" style={{ background: floorFinishes[f].color }} /> {floorFinishes[f].name}
          </button>
        ))}
      </div>
    </div>
  );
}

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
    <h1 title="Clique para renomear" style={{ cursor: "text" }} onClick={() => { setName(version.name); setEditing(true); }}>
      {version.name} <span className="muted small">✎</span>
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
  const { rooms } = usePlan();
  const version = s.versions.find((v) => v.id === s.activeId);
  const goVersions = async () => {
    const id = s.activeId;
    const t = await thumbnail();
    if (id && t) s.setThumb(id, t);
    s.setScreen("versions");
  };
  const groups = useMemo(() => {
    const g: Record<string, typeof catalog> = {};
    catalog.forEach((c) => (g[c.group] ??= []).push(c));
    return g;
  }, []);

  const add = (t: FurnitureType) => {
    // coloca no centro do cômodo selecionado (ou na sala)
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
    <aside className="sidebar">
      <header className="stack tight">
        <button className="ghost back" onClick={goVersions}>← Versões</button>
        <VersionName />
        <div className="muted small">Apto 1707 · Casa Forte · 52,71 m²</div>
        <div className="localnote small">
          <strong>⚠️ Só neste navegador.</strong> O que você mexe aqui fica guardado apenas neste navegador
          {version?.repo ? " (por cima da versão do repositório)" : ""} — <strong>não é salvo no repositório nem em
          nenhum servidor</strong>. Para guardar de verdade, use “Exportar JSON” na tela de versões.
        </div>
        <button
          onClick={() => {
            const cur = s.versions.find((v) => v.id === s.activeId);
            const n = prompt("Nome da nova versão:", cur ? `${cur.name} — variação` : "Nova versão");
            if (n === null) return;
            s.syncActive();
            const id = s.duplicateVersion(s.activeId!, n);
            s.openVersion(id);
          }}
        >
          Salvar como nova versão
        </button>
      </header>

      <section>
        <div className="seg theme">
          {(["auto", "light", "dark"] as Theme[]).map((t) => (
            <button key={t} className={s.theme === t ? "on" : ""} onClick={() => s.setTheme(t)} title="Tema">
              {t === "auto" ? "◐ Auto" : t === "light" ? "☀︎ Claro" : "☾ Escuro"}
            </button>
          ))}
        </div>
        <div className="seg">
          {(["3d", "split", "2d"] as const).map((v) => (
            <button key={v} className={s.view === v ? "on" : ""} onClick={() => s.setView(v)}>
              {v === "3d" ? "3D" : v === "2d" ? "2D" : "2D + 3D"}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Câmera</h2>
        <div className="row">
          <button onClick={() => { s.setCutaway(true); s.setShowCeiling(false); s.goCamera("iso"); }}>Maquete</button>
          <button onClick={() => s.goCamera("top")}>Topo</button>
          <button onClick={() => s.goCamera("eye")}>Olho humano</button>
        </div>
        <label className="check"><input type="checkbox" checked={s.cutaway} onChange={(e) => s.setCutaway(e.target.checked)} /> Paredes cortadas (1,25 m)</label>
        <label className="check"><input type="checkbox" checked={s.showCeiling} onChange={(e) => s.setShowCeiling(e.target.checked)} /> Teto (só com paredes inteiras)</label>
        <label className="field">
          <span>Luz do dia · {String(Math.floor(s.hour)).padStart(2, "0")}:{String(Math.round((s.hour % 1) * 60)).padStart(2, "0")}</span>
          <input type="range" min={5.5} max={19} step={0.25} value={s.hour} onChange={(e) => s.setHour(Number(e.target.value))} />
        </label>
        <button className="primary" onClick={onCapture}>📸 Capturar vista (P)</button>
      </section>

      <section>
        <h2>Selecionado</h2>
        <Inspector />
      </section>

      <section>
        <h2>Adicionar móveis</h2>
        {Object.entries(groups).map(([g, list]) => (
          <details key={g} open={g === "Sala" || g === "Quarto"}>
            <summary>{g}</summary>
            <div className="catalog">
              {list.map((c) => (
                <button key={c.type + c.name} onClick={() => add(c.type)} title={`${c.w}×${c.d}×${c.h} m`}>
                  <span className="dot" style={{ background: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          </details>
        ))}
      </section>

      <section>
        <h2>Paredes</h2>
        <div className="swatches">
          {wallPalette.map((p) => (
            <button key={p.color} title={`${p.name} (todas)`} className={`swatch ${s.wallColor === p.color ? "on" : ""}`} style={{ background: p.color }} onClick={() => s.setWallColor(p.color)} />
          ))}
        </div>
        <div className="row">
          <button onClick={s.restoreWalls} disabled={!s.removedWalls.length}>Recolocar todas ({s.removedWalls.length})</button>
        </div>
      </section>

      <section>
        <div className="row">
          <button onClick={s.undo} disabled={!s.past.length}>↶ Desfazer</button>
          <button onClick={s.redo} disabled={!s.future.length}>↷ Refazer</button>
          <button onClick={() => s.setSnap(!s.snap)} className={s.snap ? "on" : ""}>Grade 5 cm</button>
        </div>
        <button className="ghost" onClick={() => confirm("Voltar ao projeto original?") && s.reset()}>Resetar tudo</button>
        <details className="small muted">
          <summary>Atalhos</summary>
          <ul>
            <li>Arrastar: mover móvel · R / Shift+R: girar 90° · Del: remover</li>
            <li>3D: arrastar = mover a vista · clicar na roda (ou botão direito, ou Shift+arrastar) e arrastar = girar · roda = zoom</li>
            <li>W A S D: andar · Q / E: virar · Shift: correr</li>
            <li>Ctrl/⌘+Z desfazer · Ctrl/⌘+Shift+Z refazer · P: capturar</li>
          </ul>
        </details>
      </section>
    </aside>
  );
}
