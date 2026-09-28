"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useStore } from "./store";

const mq = () => window.matchMedia("(prefers-color-scheme: dark)");
const subscribe = (cb: () => void) => {
  const m = mq();
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** "light" | "dark" já resolvido (auto segue o sistema) e aplicado em <html data-theme> */
export function useResolvedTheme(): "light" | "dark" {
  const pref = useStore((s) => s.theme);
  const systemDark = useSyncExternalStore(subscribe, () => mq().matches, () => false);
  const t = pref === "auto" ? (systemDark ? "dark" : "light") : pref;
  useEffect(() => {
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
  }, [t]);
  return t;
}

export interface PlanColors {
  bg: string; grid: string; wall: string; pillar: string; text: string; subtext: string;
  floorOpacity: number; threshold: string; itemStroke: string; itemFixedStroke: string; itemText: string;
  glass: string; glassSub: string; door: string; scene: string; plinth: string; edge: string;
}

export const planColors: Record<"light" | "dark", PlanColors> = {
  light: {
    bg: "#f7f5f1", grid: "#e3ded6", wall: "#2b2b2b", pillar: "#6b6b6b", text: "#3b3b3b", subtext: "#6b6b6b",
    floorOpacity: 0.35, threshold: "#e9e1d4", itemStroke: "#3a3a3a", itemFixedStroke: "#7d8a96", itemText: "#222",
    glass: "#1f7fb0", glassSub: "#4d7d96", door: "#b57a1c", scene: "#e4ded5", plinth: "#d6d0c6", edge: "#8d867c",
  },
  dark: {
    bg: "#16181b", grid: "#24272c", wall: "#e8e4dc", pillar: "#9a958d", text: "#ece8e1", subtext: "#a19b92",
    floorOpacity: 0.28, threshold: "#3a342c", itemStroke: "#d6d0c6", itemFixedStroke: "#8fa0ae", itemText: "#f2eee8",
    glass: "#5cc3f0", glassSub: "#8fc7df", door: "#e0a54a", scene: "#1b1d21", plinth: "#34373c", edge: "#5b5750",
  },
};

export function usePlanColors() {
  return planColors[useResolvedTheme()];
}
