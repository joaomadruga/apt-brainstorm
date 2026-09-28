import type { FrameReport } from "./photoPrompt";

export interface CaptureResult {
  /** "photo" = câmera fotográfica posicionada; "view" = ângulo atual do 3D */
  kind: "photo" | "view";
  url: string;
  /** "3:2", "16:9"… ou largura:altura em px */
  aspect: string;
  lens?: number;
  /** o que aparece no quadro (para o prompt) */
  report: FrameReport;
  width: number;
  height: number;
  /** câmera em coordenadas da planta (x leste, y norte, z altura) */
  camera: { x: number; y: number; z: number; dir: { x: number; y: number; z: number }; fov: number };
}

type CaptureFn = (scale: number) => Promise<CaptureResult>;
let fn: CaptureFn | null = null;

export const registerCapture = (f: CaptureFn | null) => {
  fn = f;
};
export const capture = (scale = 2) => (fn ? fn(scale) : Promise.reject(new Error("Cena 3D não está aberta")));
