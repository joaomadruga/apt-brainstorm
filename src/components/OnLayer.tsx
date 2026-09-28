"use client";

import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

/** Põe tudo dentro numa camada do three (ver LAYER_PHOTO / LAYER_EDITOR em lib/photo.ts). */
export function OnLayer({ layer, children }: { layer: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => o.layers.set(layer));
  });
  return <group ref={ref}>{children}</group>;
}
