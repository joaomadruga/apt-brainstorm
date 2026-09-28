import App from "@/components/App";
import { loadRepoFurniture, loadRepoVersions } from "@/lib/repo.server";

// Versões (/versions/*.json) e móveis (/furniture/*.json) commitados no repositório
// são lidos no build e embutidos na página.
export default async function Page() {
  const [versions, furniture] = await Promise.all([loadRepoVersions(), loadRepoFurniture()]);
  return <App repoVersions={versions} repoFurniture={furniture} canSaveToRepo={process.env.NODE_ENV === "development"} />;
}
