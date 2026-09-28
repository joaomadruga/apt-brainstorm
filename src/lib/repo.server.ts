import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { CatalogEntry } from "@/data/catalog";
import type { VersionFile } from "./files";

const ROOT = process.cwd();
export const VERSIONS_DIR = path.join(ROOT, "versions");
export const FURNITURE_DIR = path.join(ROOT, "furniture");

async function readJsonDir<T>(dir: string): Promise<T[]> {
  let names: string[] = [];
  try {
    names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const out: T[] = [];
  for (const n of names) {
    try {
      out.push(JSON.parse(await fs.readFile(path.join(dir, n), "utf8")) as T);
    } catch (e) {
      console.error(`[repo] JSON inválido em ${path.relative(ROOT, path.join(dir, n))}:`, (e as Error).message);
    }
  }
  return out;
}

export const loadRepoVersions = () => readJsonDir<VersionFile>(VERSIONS_DIR);
export const loadRepoFurniture = () => readJsonDir<CatalogEntry>(FURNITURE_DIR);
