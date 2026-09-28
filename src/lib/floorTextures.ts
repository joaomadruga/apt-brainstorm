"use client";

import * as THREE from "three";

// Texturas de piso desenhadas em canvas (sem arquivos de imagem).
// A ShapeGeometry dos pisos usa as coordenadas da planta (metros) como UV,
// então `repeat = 1 / tamanho` faz cada canvas cobrir `tamanho` metros.

type Pattern = "planks" | "tiles";

const cache: Partial<Record<Pattern, THREE.CanvasTexture>> = {};

/** gerador determinístico — a textura sai igual toda vez (capturas estáveis) */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** réguas de carvalho: 12 cm de largura, comprimentos variados, juntas desencontradas (canvas = 1,2 m) */
function drawPlanks(ctx: CanvasRenderingContext2D, px: number) {
  const r = rng(7);
  const M = 1.2, boardW = 0.12, s = px / M;
  const tones = ["#c8904f", "#bf8445", "#d19a5a", "#b97c3f", "#cc9655", "#c38a4a"];
  for (let row = 0; row < M / boardW; row++) {
    let x = -r() * 0.9;
    while (x < M) {
      const len = 0.6 + r() * 0.6;
      const y0 = row * boardW * s;
      ctx.fillStyle = tones[Math.floor(r() * tones.length)];
      ctx.fillRect(x * s, y0, len * s, boardW * s);
      // veios
      ctx.strokeStyle = "rgba(90, 50, 20, 0.12)";
      ctx.lineWidth = 1;
      for (let g = 0; g < 5; g++) {
        const gy = y0 + (0.1 + r() * 0.8) * boardW * s;
        ctx.beginPath();
        ctx.moveTo(x * s, gy);
        ctx.bezierCurveTo((x + len / 3) * s, gy + (r() - 0.5) * 6, (x + (2 * len) / 3) * s, gy + (r() - 0.5) * 6, (x + len) * s, gy);
        ctx.stroke();
      }
      // junta de topo
      ctx.fillStyle = "rgba(60, 35, 15, 0.45)";
      ctx.fillRect((x + len) * s - 1, y0, 2, boardW * s);
      x += len;
    }
    ctx.fillStyle = "rgba(60, 35, 15, 0.4)";
    ctx.fillRect(0, (row + 1) * boardW * s - 1, px, 2);
  }
  return M;
}

/** ladrilho hidráulico 20×20: estrela azul nos cantos + flor laranja no centro (canvas = 2×2 peças = 0,4 m) */
function drawTiles(ctx: CanvasRenderingContext2D, px: number) {
  const n = 2, t = px / n;
  const petal = (cx: number, cy: number, ang: number, len: number, wid: number, color: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(wid, len / 2, 0, len);
    ctx.quadraticCurveTo(-wid, len / 2, 0, 0);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };
  ctx.fillStyle = "#efe6d4";
  ctx.fillRect(0, 0, px, px);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x0 = i * t, y0 = j * t, cx = x0 + t / 2, cy = y0 + t / 2;
      // flor central laranja (4 pétalas nas diagonais) + miolo azul
      for (let k = 0; k < 4; k++) petal(cx, cy, Math.PI / 4 + (k * Math.PI) / 2, t * 0.3, t * 0.12, "#d8894a");
      for (let k = 0; k < 4; k++) petal(cx, cy, (k * Math.PI) / 2, t * 0.16, t * 0.05, "#e9b27a");
      ctx.beginPath();
      ctx.arc(cx, cy, t * 0.035, 0, Math.PI * 2);
      ctx.fillStyle = "#2f5b8c";
      ctx.fill();
      // quartos de estrela azul nos cantos (fecham a estrela com as peças vizinhas)
      for (const [qx, qy] of [[x0, y0], [x0 + t, y0], [x0, y0 + t], [x0 + t, y0 + t]]) {
        const toward = Math.atan2(cy - qy, cx - qx) - Math.PI / 2;
        petal(qx, qy, toward, t * 0.32, t * 0.09, "#2f5b8c");
        petal(qx, qy, toward - Math.PI / 4, t * 0.2, t * 0.06, "#5b83b0");
        petal(qx, qy, toward + Math.PI / 4, t * 0.2, t * 0.06, "#5b83b0");
      }
      // rejunte
      ctx.strokeStyle = "rgba(120, 110, 95, 0.55)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 1, y0 + 1, t - 2, t - 2);
    }
  return 0.4;
}

export function floorTexture(pattern: Pattern): THREE.CanvasTexture {
  const hit = cache[pattern];
  if (hit) return hit;
  const px = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  const meters = pattern === "planks" ? drawPlanks(ctx, px) : drawTiles(ctx, px);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / meters, 1 / meters);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache[pattern] = tex;
  return tex;
}
