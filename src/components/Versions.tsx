"use client";

import { useMemo, useState } from "react";
import { bounds, rooms as baseRooms } from "@/data/apartment";
import type { VersionFile } from "@/lib/files";
import { wallPieces } from "@/lib/geometry";
import { floorFinishes } from "@/lib/materials";
import { resolvePlan } from "@/lib/plan";
import { originalSnapshot, useStore, versionToFile, type Snapshot, type Version } from "@/lib/store";
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
  const n = (k: number, one: string, many: string) => (k ? `${k} ${k === 1 ? one : many}` : "");
  const parts = [
    n(v.data.removedWalls.length, "parede a menos", "paredes a menos"),
    n(added, "móvel", "móveis"),
    n(removedFixtures, "peça do projeto tirada", "peças do projeto tiradas"),
    n(floorsChanged, "piso trocado", "pisos trocados"),
    n(geo, "edição de planta", "edições de planta"),
    v.data.wallColor !== o.wallColor || Object.keys(v.data.wallColors).length ? "cores" : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Sem mudanças";
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
  if (v.repo && v.repoChanged) return <span className="vstatus warn" title="O arquivo no repositório mudou e você tem edições locais nesta versão">Repo mudou · edição local</span>;
  if (v.repo && v.dirty) return <span className="vstatus warn" title="Editada neste navegador — não salva no repositório">Editada · só aqui</span>;
  if (v.repo) return <span className="vstatus repo" title={`versions/${v.repo.id}.json`}>Repo</span>;
  return <span className="vstatus local" title="Criada neste navegador — não está no repositório">Só aqui</span>;
}

function VersionCard({ v, canSaveToRepo }: { v: Version; canSaveToRepo: boolean }) {
  const s = useStore();
  const [msg, setMsg] = useState("");
  const saveToRepo = async () => {
    const file = versionToFile(v, s.versions);
    setMsg("Salvando…");
    const res = await fetch("/api/versions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(file) });
    const body = await res.json();
    if (!res.ok) return setMsg(`Erro: ${body.error}${body.errors ? ` — ${body.errors.join("; ")}` : ""}`);
    s.markSavedToRepo(v.id, file);
    setMsg(`✓ ${body.path} — falta commitar`);
  };
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(v.name);
  const [showPlan, setShowPlan] = useState(!v.thumb);
  const active = s.activeId === v.id;
  const viewOnly = s.viewOnly;
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
          <strong onDoubleClick={() => !viewOnly && setEditing(true)} title={viewOnly ? undefined : "Duplo clique para renomear"}>{v.name}</strong>
        )}
        <StatusBadge v={v} />
        {v.description && <span className="small clamp2" title={v.description}>{v.description}</span>}
        <span className="small muted">{diffSummary(v)}</span>
        <span className="small muted" title={`Criada ${fmt(v.createdAt)}`}>Editada {fmt(v.updatedAt)}</span>
      </div>
      <div className="row">
        <button className="primary" onClick={() => s.openVersion(v.id)}>Abrir</button>
        {!viewOnly && <>
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
        </>}
      </div>
      {!viewOnly && <div className="row">
        <button onClick={() => download(versionToFile(v, s.versions))} title="Baixa o arquivo para colocar em /versions e commitar">
          ⬇ JSON
        </button>
        {canSaveToRepo && (!v.repo || v.dirty) && (
          <button onClick={saveToRepo} title="Grava /versions/<id>.json no disco (só rodando local)">💾 Salvar no repo</button>
        )}
        {v.repo && (v.dirty || v.repoChanged) && (
          <button onClick={() => confirm("Descartar as alterações deste navegador e voltar para a versão do repositório?") && s.revertToRepo(v.id)}>
            ↺ Descartar edição
          </button>
        )}
      </div>}
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
  const viewOnly = useStore((s) => s.viewOnly);
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
          <div className="muted small">Paredes, cômodos, móveis, pisos e cores de cada ideia.</div>
        </div>
        <div className="theme-inline">
          <ThemeSwitch />
        </div>
      </header>

      <div
        className="localnote"
        title="Versões “repo” vêm de versions/ no repositório. Criar, editar ou renomear aqui não sai deste navegador. Para guardar: Exportar JSON e commitar em versions/."
      >
        {viewOnly ? (
          <>📱 No celular o app é só para ver — abra uma versão e explore em 3D ou 2D. Para editar, use um computador.</>
        ) : canSaveToRepo ? (
          <>💾 Rodando local: toda edição é gravada automaticamente em <strong>versions/</strong> — falta só commitar.</>
        ) : (
          <>⚠️ Edições aqui ficam só neste navegador. Para guardar, use <strong>Exportar JSON</strong>.</>
        )}
      </div>

      {!viewOnly && <section className="vnew">
        <strong>Nova versão</strong>
        <input
          placeholder="Nome da versão"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create(true)}
        />
        <label className="small muted">
          Começar de{" "}
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="original">Projeto original</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <button className="primary" onClick={() => create(true)}>Criar e abrir</button>
          <button onClick={() => create(false)}>Só criar</button>
        </div>
      </section>}

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
