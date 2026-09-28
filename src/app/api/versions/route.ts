import { promises as fs } from "fs";
import path from "path";
import { validateVersionFile, type VersionFile } from "@/lib/files";
import { VERSIONS_DIR } from "@/lib/repo.server";

// Grava /versions/<id>.json. Só funciona rodando local (npm run dev):
// em produção (Vercel) o disco é somente leitura e nada é salvo.
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Só disponível em desenvolvimento local (npm run dev)." }, { status: 403 });
  }
  const file = (await req.json()) as VersionFile;
  const errors = validateVersionFile(file);
  if (errors.length) return Response.json({ error: "Versão inválida", errors }, { status: 400 });
  await fs.mkdir(VERSIONS_DIR, { recursive: true });
  const p = path.join(VERSIONS_DIR, `${file.id}.json`);
  await fs.writeFile(p, JSON.stringify(file, null, 2) + "\n", "utf8");
  return Response.json({ ok: true, path: path.relative(process.cwd(), p) });
}
