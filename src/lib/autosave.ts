"use client";

import { SNAP_KEYS, useStore, versionToFile, type Version } from "./store";

// Rodando local (npm run dev), toda edição feita no app é gravada em versions/<id>.json
// via POST /api/versions — assim o repo acompanha o que está na tela e não sobra
// "alteração só neste navegador". Em produção nada disso liga (a rota recusa).
//
// Só grava o que MUDOU nesta sessão: abrir uma versão não reescreve o arquivo, e
// alterações antigas que já estavam no navegador só vão pro disco na próxima edição.

export type AutosaveStatus = { state: "saving" | "saved" | "error"; text: string } | null;

const DEBOUNCE_MS = 600;

/** conteúdo comparável do arquivo (sem updatedAt, que muda a cada gravação) */
const content = (v: Version, versions: Version[]) => {
  const { updatedAt: _ignored, ...rest } = versionToFile(v, versions);
  void _ignored;
  return JSON.stringify(rest);
};

export function startRepoAutosave(onStatus: (s: AutosaveStatus) => void) {
  const saved = new Map<string, string>(); // id da versão → conteúdo que já está no disco
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let busy = false;

  /** marca o conteúdo de `id` em `versions` como "já no disco" (se ainda não conhecido) */
  const baseline = (id: string | null, versions = useStore.getState().versions) => {
    if (!id || saved.has(id)) return;
    const v = versions.find((x) => x.id === id);
    if (v) saved.set(id, content(v, versions));
  };

  const flush = async () => {
    if (busy) return schedule();
    busy = true;
    try {
      useStore.getState().syncActive(); // leva a edição da tela para versions[]
      for (const id of [...pending]) {
        pending.delete(id);
        const s = useStore.getState();
        const v = s.versions.find((x) => x.id === id);
        if (!v) continue;
        const c = content(v, s.versions);
        if (saved.get(id) === c) continue;
        const file = versionToFile(v, s.versions);
        onStatus({ state: "saving", text: `Salvando versions/${file.id}.json…` });
        try {
          const res = await fetch("/api/versions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(file) });
          const body = await res.json();
          if (!res.ok) {
            onStatus({ state: "error", text: `Não salvou: ${body.error}${body.errors ? ` — ${body.errors.join("; ")}` : ""}` });
            continue;
          }
          saved.set(id, c);
          useStore.getState().markSavedToRepo(id, file);
          onStatus({ state: "saved", text: `✓ ${body.path} — falta commitar` });
        } catch (e) {
          pending.add(id);
          onStatus({ state: "error", text: `Não salvou: ${(e as Error).message}` });
        }
      }
    } finally {
      busy = false;
    }
  };

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  }

  baseline(useStore.getState().activeId);
  const unsub = useStore.subscribe((s, prev) => {
    // versão aberta agora: o que está nela é o ponto de partida (abrir não grava)
    if (s.activeId !== prev.activeId) baseline(s.activeId);
    if (s.activeId && s.activeId === prev.activeId && SNAP_KEYS.some((k) => s[k] !== prev[k])) {
      pending.add(s.activeId);
      schedule();
    }
    // renomear na tela de versões também atualiza o arquivo
    if (s.versions !== prev.versions) {
      for (const v of s.versions) {
        const old = prev.versions.find((x) => x.id === v.id);
        if (old && old.name !== v.name) {
          baseline(v.id, prev.versions); // ponto de partida = antes do rename
          pending.add(v.id);
          schedule();
        }
      }
    }
  });
  return () => {
    unsub();
    clearTimeout(timer);
  };
}
