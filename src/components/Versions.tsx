"use client";

import { useMemo, useState } from "react";
import { bounds, rooms as baseRooms } from "@/data/apartment";
import { slugify, snapshotToFile, type VersionFile } from "@/lib/files";
import { wallPieces } from "@/lib/geometry";
import { floorFinishes } from "@/lib/materials";
import { resolvePlan } from "@/lib/plan";
import { originalSnapshot, useStore, type Snapshot, type Version } from "@/lib/store";
import { usePlanColors } from "@/lib/theme";

/** Mini planta estática (sempre fiel ao conteúdo da versão) */
export function MiniPlan({ data }: { data: Snapshot }) {
  const C = usePlanColors();
  const { rooms, walls } = resolvePlan(data);
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
              <rect key={`${w.id}${i}`} x={p.x0} y={-p.y1} width={p.x1 - p.x0} height={p.y1 - p.y0} fill={w.kind === "parapet" ? "#9ec5d6" : C.wall} />
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
          stroke={C.itemStroke}
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
  const floorsChanged = baseRooms.filter((r) => v.data.floors[r.id] !== o.floors[r.id]).length;
  const geo = v.data.extraWalls.length + v.data.rooms.length + v.data.removedRooms.length;
  const parts = [
    v.data.removedWalls.length ? `${v.data.removedWalls.length} parede(s) removida(s)` : "",
    added ? `${added} móvel(is)` : "",
    removedFixtures ? `${removedFixtures} peça(s) do projeto tirada(s)` : "",
    floorsChanged ? `${floorsChanged} piso(s) trocado(s)` : "",
    geo ? `${geo} edição(ões) de paredes/cômodos` : "",
    v.data.wallColor !== o.wallColor || Object.keys(v.data.wallColors).length ? "cores de parede" : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Igual ao projeto original";
}

function toFile(v: Version, taken: Set<string>): VersionFile {
  let id = v.repo?.id ?? slugify(v.name);
  if (!v.repo) {
    const base = id;
    let k = 2;
    while (taken.has(id)) id = `${base}-${k++}`;
  }
  return snapshotToFile(id, v.name, v.data, v.description ? { description: v.description } : {});
}

function download(file: VersionFile) {
  const blob = new Blob([JSON.stringify(file, null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${file.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function StatusBadge({ v }: { v: Version }) {
  if (v.repo && v.repoChanged) return <span className="vstatus warn">repo atualizado · você tem alterações locais</span>;
  if (v.repo && v.dirty) return <span className="vstatus warn">alterada neste navegador · não salva no repo</span>;
  if (v.repo) return <span className="vstatus repo">repo · versions/{v.repo.id}.json</span>;
  return <span className="vstatus local">só neste navegador · não está no repo</span>;
}

function VersionCard({ v, canSaveToRepo }: { v: Version; canSaveToRepo: boolean }) {
  const s = useStore();
  const [msg, setMsg] = useState("");
  const taken = new Set(s.versions.flatMap((x) => (x.repo ? [x.repo.id] : [])));
  const saveToRepo = async () => {
    const file = toFile(v, taken);
    setMsg("Salvando…");
    const res = await fetch("/api/versions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(file) });
    const body = await res.json();
    if (!res.ok) return setMsg(`Erro: ${body.error}${body.errors ? ` — ${body.errors.join("; ")}` : ""}`);
    s.markSavedToRepo(v.id, file);
    setMsg(`✓ Gravado em ${body.path}. Falta commitar e dar push.`);
  };
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
        <StatusBadge v={v} />
        {v.description && <span className="small">{v.description}</span>}
        <span className="small muted">{diffSummary(v)}</span>
        <span className="small muted">Editada {fmt(v.updatedAt)} · criada {fmt(v.createdAt)}</span>
      </div>
      <div className="row">
        <button className="primary" onClick={() => s.openVersion(v.id)}>Abrir</button>
        <button onClick={() => { setName(v.name); setEditing(true); }}>Renomear</button>
        <button onClick={() => s.duplicateVersion(v.id)}>Duplicar</button>
        <button
          className="danger"
          onClick={() =>
            confirm(
              v.repo
                ? `Esconder "${v.name}" neste navegador? O arquivo continua no repositório.`
                : `Excluir a versão "${v.name}"? Ela só existe neste navegador — não dá pra desfazer.`,
            ) && s.deleteVersion(v.id)
          }
        >
          {v.repo ? "Esconder" : "Excluir"}
        </button>
      </div>
      <div className="row">
        <button onClick={() => download(toFile(v, taken))} title="Baixa o arquivo para colocar em /versions e commitar">
          ⬇ Exportar JSON
        </button>
        {canSaveToRepo && (!v.repo || v.dirty) && (
          <button onClick={saveToRepo} title="Grava /versions/<id>.json no disco (só rodando local)">💾 Salvar em versions/</button>
        )}
        {v.repo && (v.dirty || v.repoChanged) && (
          <button onClick={() => confirm("Descartar as alterações deste navegador e voltar para a versão do repositório?") && s.revertToRepo(v.id)}>
            ↺ Descartar alterações locais
          </button>
        )}
      </div>
      {msg && <span className="small muted">{msg}</span>}
    </div>
  );
}

function ThemeSwitch() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  return (
    <div className="seg theme">
      {(["auto", "light", "dark"] as const).map((t) => (
        <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>
          {t === "auto" ? "◐ Auto" : t === "light" ? "☀︎ Claro" : "☾ Escuro"}
        </button>
      ))}
    </div>
  );
}

export default function VersionsScreen({ canSaveToRepo }: { canSaveToRepo: boolean }) {
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
          <div className="muted small">Cada versão guarda paredes, cômodos, móveis, pisos e cores.</div>
        </div>
        <div className="theme-inline">
          <ThemeSwitch />
        </div>
      </header>

      <div className="localnote">
        <strong>⚠️ Onde as coisas ficam salvas:</strong> as versões marcadas <em>repo</em> vêm da pasta <code>versions/</code> do
        repositório (é o que aparece para todo mundo). <strong>Qualquer alteração feita aqui no app — criar, editar, mover,
        renomear — fica só neste navegador</strong>: não vai para o repositório, nem para a Vercel, nem para outro computador, e
        some se você limpar os dados do site. Para guardar de verdade: <strong>⬇ Exportar JSON</strong> e commitar o arquivo
        em <code>versions/</code> (ou peça para um agent fazer isso).
        {canSaveToRepo && <> Rodando local (<code>npm run dev</code>), dá para usar <strong>💾 Salvar em versions/</strong> e depois commitar.</>}
      </div>

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
            <VersionCard key={v.id} v={v} canSaveToRepo={canSaveToRepo} />
          ))}
        </div>
      )}
    </div>
  );
}
