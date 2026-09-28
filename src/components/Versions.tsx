"use client";

import { useMemo, useState } from "react";
import { bounds, rooms, walls } from "@/data/apartment";
import { wallPieces } from "@/lib/geometry";
import { floorFinishes } from "@/lib/materials";
import { originalSnapshot, useStore, type Snapshot, type Version } from "@/lib/store";

/** Mini planta estática (sempre fiel ao conteúdo da versão) */
export function MiniPlan({ data }: { data: Snapshot }) {
  const pad = 0.3;
  const vb = `${bounds.minX - pad} ${-bounds.maxY - pad} ${bounds.maxX - bounds.minX + 2 * pad} ${bounds.maxY - bounds.minY + 2 * pad}`;
  return (
    <svg viewBox={vb} style={{ width: "100%", height: "100%" }}>
      {rooms.map((r) => (
        <polygon key={r.id} points={r.poly.map(([x, y]) => `${x},${-y}`).join(" ")} fill={floorFinishes[data.floors[r.id] ?? r.floor].color} fillOpacity={0.45} />
      ))}
      {walls.map((w) =>
        data.removedWalls.includes(w.id) ? (
          <rect key={w.id} x={w.x0} y={-w.y1} width={w.x1 - w.x0} height={w.y1 - w.y0} fill="none" stroke="#e07a5f" strokeWidth={0.03} strokeDasharray="0.08 0.06" />
        ) : (
          wallPieces(w, 2.6)
            .filter((p) => p.z0 === 0 && p.z1 > 1.5)
            .map((p, i) => (
              <rect key={`${w.id}${i}`} x={p.x0} y={-p.y1} width={p.x1 - p.x0} height={p.y1 - p.y0} fill={w.kind === "parapet" ? "#9ec5d6" : "#2b2b2b"} />
            ))
        ),
      )}
      {data.items.map((it) => (
        <rect
          key={it.id}
          x={-it.w / 2}
          y={-it.d / 2}
          width={it.w}
          height={it.d}
          transform={`translate(${it.x} ${-it.y}) rotate(${-it.rot})`}
          fill={it.color}
          fillOpacity={0.7}
          stroke="#3a3a3a"
          strokeWidth={0.015}
        />
      ))}
    </svg>
  );
}

const fmt = (t: number) =>
  new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function diffSummary(v: Version) {
  const o = originalSnapshot();
  const origIds = new Set(o.items.map((i) => i.id));
  const added = v.data.items.filter((i) => !origIds.has(i.id)).length;
  const removedFixtures = o.items.filter((i) => !v.data.items.some((x) => x.id === i.id)).length;
  const floorsChanged = rooms.filter((r) => v.data.floors[r.id] !== o.floors[r.id]).length;
  const parts = [
    v.data.removedWalls.length ? `${v.data.removedWalls.length} parede(s) removida(s)` : "",
    added ? `${added} móvel(is)` : "",
    removedFixtures ? `${removedFixtures} peça(s) do projeto tirada(s)` : "",
    floorsChanged ? `${floorsChanged} piso(s) trocado(s)` : "",
    v.data.wallColor !== o.wallColor || Object.keys(v.data.wallColors).length ? "cores de parede" : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Igual ao projeto original";
}

function VersionCard({ v }: { v: Version }) {
  const s = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(v.name);
  const [showPlan, setShowPlan] = useState(!v.thumb);
  const active = s.activeId === v.id;
  const save = () => {
    s.renameVersion(v.id, name);
    setEditing(false);
  };
  return (
    <div className={`vcard ${active ? "active" : ""}`}>
      <button className="vthumb" onClick={() => s.openVersion(v.id)} title="Abrir">
        {v.thumb && !showPlan ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.thumb} alt={v.name} />
        ) : (
          <MiniPlan data={v.data} />
        )}
        {active && <span className="badge">aberta por último</span>}
      </button>
      {v.thumb && (
        <div className="vtoggle">
          <button className={!showPlan ? "on" : ""} onClick={() => setShowPlan(false)}>3D</button>
          <button className={showPlan ? "on" : ""} onClick={() => setShowPlan(true)}>Planta</button>
        </div>
      )}
      <div className="vinfo">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setName(v.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <strong onDoubleClick={() => setEditing(true)} title="Duplo clique para renomear">{v.name}</strong>
        )}
        <span className="small muted">{diffSummary(v)}</span>
        <span className="small muted">Editada {fmt(v.updatedAt)} · criada {fmt(v.createdAt)}</span>
      </div>
      <div className="row">
        <button className="primary" onClick={() => s.openVersion(v.id)}>Abrir</button>
        <button onClick={() => { setName(v.name); setEditing(true); }}>Renomear</button>
        <button onClick={() => s.duplicateVersion(v.id)}>Duplicar</button>
        <button
          className="danger"
          onClick={() => confirm(`Excluir a versão "${v.name}"? Não dá pra desfazer.`) && s.deleteVersion(v.id)}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

export default function VersionsScreen() {
  const versions = useStore((s) => s.versions);
  const createVersion = useStore((s) => s.createVersion);
  const openVersion = useStore((s) => s.openVersion);
  const [name, setName] = useState("");
  const [from, setFrom] = useState<string>("original");
  const [sort, setSort] = useState<"updated" | "name" | "created">("updated");

  const sorted = useMemo(() => {
    const list = [...versions];
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    else if (sort === "created") list.sort((a, b) => b.createdAt - a.createdAt);
    else list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }, [versions, sort]);

  const create = (open: boolean) => {
    const id = createVersion(name || `Versão ${versions.length + 1}`, from);
    setName("");
    if (open) openVersion(id);
  };

  return (
    <div className="versions">
      <header className="vheader">
        <div>
          <h1>Apto 1707 · Versões</h1>
          <div className="muted small">Cada versão guarda paredes, móveis, pisos e cores. Tudo salva sozinho enquanto você edita.</div>
        </div>
      </header>

      <section className="vnew">
        <strong>Nova versão</strong>
        <input
          placeholder={`Nome (ex.: "Sala integrada com cozinha")`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create(true)}
        />
        <label className="small muted">
          Começar de{" "}
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="original">Projeto original (planta do DWG)</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                Cópia de “{v.name}”
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <button className="primary" onClick={() => create(true)}>Criar e abrir</button>
          <button onClick={() => create(false)}>Só criar</button>
        </div>
      </section>

      <div className="vbar">
        <span className="muted small">{versions.length} versão(ões)</span>
        <label className="small muted">
          Ordenar{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="updated">Última edição</option>
            <option value="created">Mais recentes</option>
            <option value="name">Nome</option>
          </select>
        </label>
      </div>

      {versions.length === 0 ? (
        <div className="muted" style={{ padding: 40, textAlign: "center" }}>Nenhuma versão ainda — crie a primeira acima.</div>
      ) : (
        <div className="vgrid">
          {sorted.map((v) => (
            <VersionCard key={v.id} v={v} />
          ))}
        </div>
      )}
    </div>
  );
}
