"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { renderUncut } from "@/lib/wallClip";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { snapTo } from "@/lib/geometry";
import {
  LAYER_EDITOR,
  LAYER_PHOTO,
  applyPhotoCam,
  horizontalFov,
  aspectRatio,
  photoSize,
  pipRect,
  planDir,
  registerShoot,
  selectPhotoCam,
  takePhoto,
  usePhoto,
} from "@/lib/photo";
import { analyzeFrame } from "@/lib/photoPrompt";
import { useStore } from "@/lib/store";
import { OnLayer } from "./OnLayer";

// Câmera fotográfica no 3D: marcador arrastável, clique-no-chão para posicionar,
// prévia ao vivo no canto e a foto em si (registerShoot).

const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ORANGE = "#ff7a1a";
const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/** arrasto no plano do chão; desliga a órbita enquanto arrasta e religa ao soltar em qualquer lugar */
function useFloorDrag(onPoint: (x: number, y: number, first: boolean) => void, onEnd?: () => void) {
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const active = useRef(false);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const point = (e: ThreeEvent<PointerEvent>, first: boolean) => {
    if (!e.ray.intersectPlane(floor, hit)) return;
    const snap = useStore.getState().snap;
    const x = snap ? snapTo(hit.x) : hit.x, y = snap ? snapTo(-hit.z) : -hit.z;
    onPoint(x, y, first);
  };
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    active.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    if (controls) controls.enabled = false;
    point(e, true);
    const up = () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      active.current = false;
      if (controls) controls.enabled = true;
      onEnd?.();
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (active.current) point(e, false);
  };
  return { onPointerDown, onPointerMove, onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation() };
}

function Marker() {
  const cam = usePhoto((s) => s.cam)!;
  const place = usePhoto((s) => s.place);
  const aimAt = usePhoto((s) => s.aimAt);
  const off = useRef({ dx: 0, dy: 0 });
  const move = useFloorDrag((x, y, first) => {
    const c = usePhoto.getState().cam!;
    if (first) {
      off.current = { dx: c.x - x, dy: c.y - y };
      selectPhotoCam();
    }
    else place(x + off.current.dx, y + off.current.dy);
  });
  const aim = useFloorDrag((x, y, first) => (first ? selectPhotoCam() : aimAt(x, y)));
  const selected = usePhoto((s) => s.selected);
  const [hover, setHover] = useState<"" | "body" | "aim">("");
  useEffect(() => {
    document.body.style.cursor = hover ? (hover === "aim" ? "crosshair" : "grab") : "";
    return () => void (document.body.style.cursor = "");
  }, [hover]);

  // cone de visão: 4 arestas até um retângulo a 1,2 m
  const frustum = useMemo(() => {
    const a = aspectRatio(cam.aspect);
    const hf = (horizontalFov(cam.lens, a) * Math.PI) / 360;
    const L = 1.2, hw = Math.tan(hf) * L, hh = hw / a;
    const c = [
      [L, hh, hw], [L, hh, -hw], [L, -hh, -hw], [L, -hh, hw],
    ];
    const pts: number[] = [];
    for (let i = 0; i < 4; i++) {
      pts.push(0, 0, 0, ...c[i]);
      pts.push(...c[i], ...c[(i + 1) % 4]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [cam.aspect, cam.lens]);

  const yaw = (cam.yaw * Math.PI) / 180, pitch = (cam.pitch * Math.PI) / 180;
  const aimDist = 0.9;
  return (
    <OnLayer layer={LAYER_EDITOR}>
      <group position={[cam.x, 0, -cam.y]} rotation={[0, yaw, 0]}>
        {/* haste + corpo */}
        <group {...move} onPointerOver={() => setHover("body")} onPointerOut={() => setHover("")}>
          <mesh position={[0, cam.h / 2, 0]}>
            <cylinderGeometry args={[0.012, 0.012, cam.h, 8]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.18, 32]} />
            <meshBasicMaterial color={ORANGE} transparent opacity={selected ? 0.7 : 0.35} depthWrite={false} />
          </mesh>
          <group position={[0, cam.h, 0]} rotation={[0, 0, pitch]}>
            <mesh>
              <boxGeometry args={[0.1, 0.09, 0.15]} />
              <meshStandardMaterial color="#2b2b2b" roughness={0.5} />
            </mesh>
            <mesh position={[0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.035, 0.04, 0.07, 20]} />
              <meshStandardMaterial color={ORANGE} roughness={0.4} />
            </mesh>
            <lineSegments geometry={frustum}>
              <lineBasicMaterial color={ORANGE} transparent opacity={0.85} />
            </lineSegments>
          </group>
        </group>
        {/* alça de mira: arraste para girar */}
        <mesh position={[aimDist, 0.04, 0]} {...aim} onPointerOver={() => setHover("aim")} onPointerOut={() => setHover("")}>
          <sphereGeometry args={[0.07, 20, 12]} />
          <meshStandardMaterial color={hover === "aim" ? "#ffb070" : ORANGE} />
        </mesh>
        <mesh position={[aimDist / 2, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[aimDist, 0.015]} />
          <meshBasicMaterial color={ORANGE} />
        </mesh>
      </group>
    </OnLayer>
  );
}

/** plano no chão que recebe o clique de "posicionar": clica = onde fica, arrasta = para onde olha */
function PlacePlane() {
  const place = usePhoto((s) => s.place);
  const aimAt = usePhoto((s) => s.aimAt);
  const setPlacing = usePhoto((s) => s.setPlacing);
  const drag = useFloorDrag(
    (x, y, first) => (first ? place(x, y) : aimAt(x, y)),
    () => setPlacing(false),
  );
  useEffect(() => {
    document.body.style.cursor = "crosshair";
    return () => void (document.body.style.cursor = "");
  }, []);
  return (
    <OnLayer layer={LAYER_EDITOR}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} {...drag}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </OnLayer>
  );
}

export function PhotoCamera3D() {
  const { gl, scene, camera, raycaster } = useThree();
  const has = usePhoto((s) => !!s.cam);
  const placing = usePhoto((s) => s.placing);
  const photoCam = useMemo(() => {
    const c = new THREE.PerspectiveCamera();
    c.layers.set(0);
    c.layers.enable(LAYER_PHOTO);
    return c;
  }, []);

  // a vista do editor enxerga o marcador; a foto não
  useLayoutEffect(() => {
    camera.layers.enable(LAYER_EDITOR);
    raycaster.layers.enable(LAYER_EDITOR);
  }, [camera, raycaster]);

  // prioridade 1 = assume o render: cena principal + prévia da câmera no canto
  useFrame((state) => {
    const { size } = state;
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.render(scene, camera);
    const { cam, preview } = usePhoto.getState();
    if (!cam || !preview) return;
    const r = pipRect(size.width, size.height, cam.aspect);
    applyPhotoCam(photoCam, cam, r.w / r.h);
    const x = r.margin, y = r.margin; // canto inferior esquerdo (o direito tem o botão da divisória)
    gl.setScissorTest(true);
    gl.setViewport(x, y, r.w, r.h);
    gl.setScissor(x, y, r.w, r.h);
    renderUncut(gl, scene, photoCam);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
  }, 1);

  useEffect(() => {
    registerShoot(async () => {
      const cam = usePhoto.getState().cam;
      if (!cam) throw new Error("Posicione a câmera primeiro");
      const st = useStore.getState();
      const prevSel = st.selection;
      st.select(null);
      await raf2();
      const { w, h } = photoSize(cam.aspect);
      applyPhotoCam(photoCam, cam, w / h);
      const ratio = gl.getPixelRatio();
      const css = gl.getSize(new THREE.Vector2());
      gl.setPixelRatio(1);
      gl.setSize(w, h, false);
      gl.setScissorTest(false);
      renderUncut(gl, scene, photoCam);
      const url = gl.domElement.toDataURL("image/png");
      gl.setPixelRatio(ratio);
      gl.setSize(css.x, css.y, false);
      const report = analyzeFrame(scene, photoCam, [0, LAYER_PHOTO], w / h);
      st.select(prevSel);
      return {
        kind: "photo",
        url,
        width: w,
        height: h,
        aspect: cam.aspect,
        lens: cam.lens,
        report,
        camera: { x: cam.x, y: cam.y, z: cam.h, dir: planDir(cam), fov: photoCam.fov },
      };
    });
    return () => registerShoot(null);
  }, [gl, scene, photoCam]);

  return (
    <>
      {has && <Marker />}
      {placing && <PlacePlane />}
    </>
  );
}

/** moldura + botões por cima da prévia (fora do Canvas) */
export function PhotoOverlay() {
  const cam = usePhoto((s) => s.cam);
  const preview = usePhoto((s) => s.preview);
  const placing = usePhoto((s) => s.placing);
  const busy = usePhoto((s) => s.busy);
  const setPreview = usePhoto((s) => s.setPreview);
  const clear = usePhoto((s) => s.clear);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const r = cam && size.w ? pipRect(size.w, size.h, cam.aspect) : null;
  return (
    <div ref={ref} className="photo-overlay">
      {placing && <div className="photo-hint">Clique no chão onde a pessoa fica · arraste para onde ela olha · Esc cancela</div>}
      {cam && preview && r && (
        <div className="photo-pip" style={{ width: r.w, height: r.h, left: r.margin, bottom: r.margin }}>
          <div className="photo-pip-bar">
            <span>📷 {cam.lens} mm · {cam.aspect} · {cam.h.toFixed(2).replace(".", ",")} m</span>
            <span>
              <button className="icon" onClick={clear} title="Remover câmera (ou selecione e aperte Delete)">🗑</button>
              <button className="icon" onClick={() => setPreview(false)} title="Esconder prévia">✕</button>
            </span>
          </div>
          <button className="primary photo-shoot" disabled={busy} onClick={() => takePhoto()} title="Tirar foto (F)">
            {busy ? "…" : "📸 Tirar foto"}
          </button>
        </div>
      )}
    </div>
  );
}
