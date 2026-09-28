// Valida /versions/*.json e /furniture/*.json.
//   npm run validate            → valida (roda também antes do build)
//   npm run validate -- --plan  → imprime paredes e cômodos da planta base (ids e coordenadas)
import { promises as fs } from "fs";
import path from "path";
import { rooms, walls, polyArea } from "../src/data/apartment";
import { catalog, registerCatalog, type CatalogEntry } from "../src/data/catalog";
import { validateFurnitureFile, validateVersionFile, type VersionFile } from "../src/lib/files";

const ROOT = path.resolve(__dirname, "..");

async function readDir(dir: string) {
  try {
    return (await fs.readdir(path.join(ROOT, dir))).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

async function main() {
  if (process.argv.includes("--plan")) {
    console.log("PAREDES (id · tipo · x0,y0 → x1,y1 · aberturas)");
    for (const w of walls)
      console.log(`  ${w.id.padEnd(22)} ${w.kind.padEnd(7)} ${w.x0},${w.y0} → ${w.x1},${w.y1}${w.openings?.length ? "  " + w.openings.map((o) => `${o.label}[${o.a0}–${o.a1}]`).join(" ") : ""}`);
    console.log("\nCÔMODOS (id · nome · área · piso · polígono)");
    for (const r of rooms) console.log(`  ${r.id.padEnd(11)} ${r.name.padEnd(18)} ${polyArea(r.poly).toFixed(2)} m²  ${r.floor.padEnd(11)} ${JSON.stringify(r.poly)}`);
    console.log("\nMÓVEIS DO CATÁLOGO (type · nome · w×d×h)");
    const furn = await readDir("furniture");
    for (const n of furn) registerCatalog([JSON.parse(await fs.readFile(path.join(ROOT, "furniture", n), "utf8"))]);
    for (const c of catalog) console.log(`  ${c.type.padEnd(16)} ${c.name.padEnd(24)} ${c.w}×${c.d}×${c.h}  (${c.source})`);
    return;
  }

  let errors = 0;
  const report = (file: string, errs: string[]) => {
    if (!errs.length) return console.log(`  ✓ ${file}`);
    errors += errs.length;
    console.log(`  ✗ ${file}`);
    for (const e of errs) console.log(`      - ${e}`);
  };

  console.log("furniture/");
  const furn: CatalogEntry[] = [];
  for (const n of await readDir("furniture")) {
    try {
      const e = JSON.parse(await fs.readFile(path.join(ROOT, "furniture", n), "utf8")) as CatalogEntry;
      const builtIn = catalog.some((c) => c.type === e.type && c.source === "code");
      report(`furniture/${n}`, [...validateFurnitureFile(e, n.replace(/\.json$/, "")), ...(builtIn ? [`type "${e.type}" já existe no código — escolha outro nome`] : [])]);
      furn.push(e);
    } catch (e) {
      report(`furniture/${n}`, [`JSON inválido: ${(e as Error).message}`]);
    }
  }
  registerCatalog(furn);

  console.log("versions/");
  for (const n of await readDir("versions")) {
    try {
      const f = JSON.parse(await fs.readFile(path.join(ROOT, "versions", n), "utf8")) as VersionFile;
      report(`versions/${n}`, validateVersionFile(f, n.replace(/\.json$/, "")));
    } catch (e) {
      report(`versions/${n}`, [`JSON inválido: ${(e as Error).message}`]);
    }
  }

  if (errors) {
    console.error(`\n${errors} erro(s). Corrija antes de commitar — o build da Vercel roda esta validação.`);
    process.exit(1);
  }
  console.log("\nTudo válido.");
}

main();
