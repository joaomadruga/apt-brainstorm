# apt-brainstorm

Visualizador 2D + 3D do apto 1707 (planta tipo "207 A 1907", Casa Forte, 52,71 m²) para testar layouts:
remover paredes, adicionar e mover móveis, trocar pisos e cores, e capturar vistas em ângulo (PNG + prompt)
para gerar imagens realistas com um modelo de imagem. Várias versões nomeadas da planta, salvas no navegador.

Geometria extraída do DWG do projeto (`src/data/apartment.ts`); alturas das esquadrias do quadro de esquadrias.

```bash
npm install
npm run dev
```

Stack: Next.js, React Three Fiber (three.js), zustand.
