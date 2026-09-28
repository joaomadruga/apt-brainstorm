# apt-brainstorm

Visualizador 2D + 3D do apto 1707 (planta tipo "207 A 1907", Casa Forte, 52,71 m²) para testar layouts:
remover paredes, criar cômodos, adicionar e mover móveis, trocar pisos e cores, e capturar vistas em ângulo
(PNG + prompt) para gerar imagens realistas com um modelo de imagem. Tema claro/escuro.

- **Versões da planta:** `versions/*.json` (commitadas — são o que todo mundo vê).
- **Móveis extras:** `furniture/*.json` (peças paramétricas, sem código).
- **Edições feitas no app ficam só no navegador** de quem editou; para guardar, exporte o JSON e commite.

Guia completo (formato dos arquivos, coordenadas, checklist): **[AGENTS.md](AGENTS.md)**.

```bash
npm install
npm run dev        # http://localhost:3000
npm run plan       # lista paredes, cômodos e móveis (ids + coordenadas)
npm run validate   # valida versions/ e furniture/ (também roda antes do build)
```

Stack: Next.js, React Three Fiber (three.js), zustand. Geometria extraída do DWG do projeto (`src/data/apartment.ts`).
