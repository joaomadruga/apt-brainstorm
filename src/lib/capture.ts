export interface CaptureResult {
  url: string;
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
