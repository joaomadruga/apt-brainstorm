# AGENTS.md — apt-brainstorm (Apto 1707)

Visualizador 2D + 3D do **apto 1707** (planta tipo "207 A 1907", Casa Forte, Recife — 52,71 m²) para explorar
layouts: remover paredes, criar/editar cômodos, adicionar móveis, trocar pisos/cores e capturar vistas (PNG +
prompt) para um modelo de imagem gerar renders realistas. Deploy: Vercel, a cada push na `main`.

**O jeito principal de mudar o app é por dados, sem código:**

| Quero…                                   | Faço…                                                        |
| ---------------------------------------- | ------------------------------------------------------------ |
| criar/editar uma versão da planta        | criar/editar `versions/<id>.json`                            |
| adicionar um móvel novo ao catálogo      | criar `furniture/<tipo>.json` (peças paramétricas)           |
| mudar a planta base (o que está no DWG)  | só com motivo forte: `src/data/apartment.ts` (ver abaixo)    |

Depois: `npm run validate` → `npm run build` → commit → push na `main`.

---

## ⚠️ Onde as coisas ficam salvas (importante)

- **Fonte da verdade = o repositório.** O que está em `versions/` e `furniture/` é o que todo mundo vê no site.
- **Edições feitas pelo app web ficam só no navegador de quem editou** (localStorage). Não vão para o repo, nem
  para a Vercel, nem para outro computador. O app avisa isso na tela (aviso fixo + selo em cada versão:
  `repo`, `só neste navegador`, `alterada neste navegador · não salva no repo`). **Não remova esses avisos.**
- Para levar uma edição do navegador para o repo: botão **⬇ Exportar JSON** (baixa `<id>.json`) → colocar em
  `versions/` → commit. Rodando local (`npm run dev`) existe também **💾 Salvar em versions/**, que grava o
  arquivo direto no disco via `POST /api/versions` (a rota recusa fora de `NODE_ENV=development`).
- Quando um arquivo do repo muda, o app atualiza a versão no navegador — a menos que o usuário tenha
  alterações locais nela; aí mostra "repo atualizado · você tem alterações locais" e o botão
  **↺ Descartar alterações locais**.

---

## Coordenadas (leia antes de editar qualquer coisa)

- Metros. **x → leste (direita na planta), y → norte (cima na planta)**. Origem = ponto (1344.10, −1269.65)
  do modelspace do DWG. O apartamento vai de x ≈ −1,645 a 7,291 e y ≈ 0,621 a 8,437.
- No 3D: `world = (x, altura, −y)`. Pé-direito adotado 2,60 m (não consta na planta).
- **`npm run plan`** imprime todas as paredes (id, tipo, retângulo, aberturas), cômodos (id, área, polígono) e
  móveis do catálogo. Use isso para achar ids e coordenadas — não adivinhe.
- Norte fica em cima: bancada da cozinha e janela EA3 na fachada norte; suíte, BWC e quarto na fachada sul;
  varanda a leste; hall de entrada (porta P1) a oeste.

Cômodos da planta base (ids): `hall`, `cozinha`, `sala`, `varanda`, `circ`, `suite`, `bwc-suite`,
`bwc-social`, `quarto`.

**Não inclua nada dos vizinhos.** À esquerda (oeste) do hall ficam o BWC e a suíte do **apto 206** — não fazem
parte do 1707.

---

## `versions/<id>.json` — uma versão da planta

`id` = nome do arquivo sem `.json`, em kebab-case. **Tudo que for omitido assume o projeto original.**
Atualize `updatedAt` (ISO 8601) sempre que editar — é assim que o app percebe a mudança.

```jsonc
{
  "id": "sala-integrada-cozinha",
  "name": "Sala integrada com cozinha",
  "description": "opcional — aparece no cartão da versão",
  "author": "opcional",
  "updatedAt": "2026-09-28T10:00:00Z",

  "items": [ /* móveis — se omitido, usa só as louças/bancadas do projeto */ ],
  "removedWalls": ["cozinha-sala"],            // ids de paredes (base ou extraWalls)
  "floors": { "sala": "cimento" },              // madeira | carvalho | porcelanato | cimento | ceramica | ladrilho | deck
  "wallColor": "#ede3d3",                       // cor de todas as paredes
  "wallColors": { "bwc-sala": "#3f5f68" },      // cor por parede

  "extraWalls": [ /* paredes novas (ou com o mesmo id de uma base, para substituí-la) */ ],
  "rooms": [ /* cômodos novos ou que substituem um da base (mesmo id) */ ],
  "removedRooms": ["circ"]                      // esconde cômodos da base
}
```

Se `items` existir, ele é a lista **completa** — inclua os itens `fixed` do projeto (ids `fx-…`) que quiser manter.
Copie-os de `versions/projeto-original.json`.

### Item (móvel)

```json
{ "id": "sofa-sala", "type": "sofa", "x": 4.2, "y": 3.95, "rot": 180,
  "w": 2.0, "d": 0.9, "h": 0.8, "color": "#8a8f98" }
```

- `x, y` = **centro** do móvel na planta. `w` = largura (eixo x local), `d` = profundidade, `h` = altura.
- `rot` em graus, anti-horário visto de cima. **rot = 0 → frente do móvel virada para o sul (−y)**, costas para o
  norte. Então: encostado numa parede ao norte → 0; ao sul → 180; a oeste → 90; a leste → 270.
- `type` precisa existir no catálogo (`npm run plan` lista). `id` único na versão. `color` = `#rrggbb`.
- `fixed: true` marca peças do projeto original (louças, bancada) — só informativo.
- Confira que o móvel cabe: a caixa girada tem que ficar dentro do polígono do cômodo e fora das paredes e
  do raio de abertura das portas.

### Parede (`extraWalls`)

Retângulo alinhado aos eixos: `x0 < x1`, `y0 < y1`. O eixo mais longo é o "comprimento". Espessuras reais:
0,12–0,15 m (alvenaria), ~0,07 m (drywall).

```json
{ "id": "closet-lateral", "name": "Parede do closet (drywall)", "kind": "int",
  "x0": 2.03, "y0": 0.761, "x1": 2.10, "y1": 2.37,
  "openings": [
    { "kind": "door", "label": "PC", "a0": 1.55, "a1": 2.20, "sill": 0, "head": 2.1, "hinge": "start", "swing": 1 }
  ] }
```

- `kind`: `int` (interna), `ext` (fachada/divisa), `pillar` (pilar), `parapet` (guarda-corpo de vidro; use
  `"height": 1.1`).
- `openings`: `a0`/`a1` = início/fim **ao longo do comprimento, em coordenada absoluta** (x se a parede é
  horizontal, y se vertical), dentro da parede. `sill` = peitoril, `head` = altura da verga (portas 2,10;
  janelas EA3 peitoril 1,10 / verga 2,20).
- `kind` da abertura: `door` (giro — `hinge: "start"|"end"` = lado da dobradiça, `swing: 1|-1` = abre para +y/+x
  ou −y/−x), `window`, `slider` (correr até o chão).
- Para **remover** uma parede, use `removedWalls`. Para **mover/encurtar** uma parede base, coloque em
  `extraWalls` um objeto com **o mesmo id** e as novas coordenadas.

### Cômodo (`rooms`)

```json
{ "id": "closet", "name": "Closet", "floor": "madeira", "label": [2.45, 1.5],
  "poly": [[2.10, 0.761], [2.791, 0.761], [2.791, 2.30], [2.10, 2.30]] }
```

- `poly` = contorno do piso (face interna das paredes), sentido qualquer, sem repetir o primeiro ponto.
- `label` = onde o nome/área aparecem. Mesmo `id` de um cômodo base → substitui (ex.: redesenhar a `suite`
  quando um closet come parte dela). O cômodo define piso, rótulo, área e "em que cômodo está a câmera" no prompt.
- Exemplo completo: `versions/suite-com-closet.json` (duas paredes novas + suíte redesenhada + closet).

---

## `furniture/<tipo>.json` — móvel novo, só com dados

`type` = nome do arquivo (letras/números/hífen, começando com letra) e não pode repetir um tipo do código.

```json
{
  "type": "aparador", "name": "Aparador", "group": "Sala",
  "w": 1.4, "d": 0.4, "h": 0.8, "color": "#8b6a4f",
  "parts": [
    { "shape": "box", "x": 0, "y": 0.955, "z": 0, "sx": 1, "sy": 0.05, "sz": 1, "color": "base" },
    { "shape": "cylinder", "x": -0.44, "y": 0.15, "z": 0.38, "sx": 0.03, "sy": 0.3, "sz": 0.1, "color": "#2b2b2b" }
  ]
}
```

- `group`: `Sala | Jantar | Quarto | Escritório | Decoração | Cozinha | Banheiro | Varanda`.
- `w, d, h` = tamanho padrão em metros (o usuário pode redimensionar; as peças escalam junto).
- **Peças em frações da caixa do móvel**: `x, z ∈ [−0,5; 0,5]` (centro da peça; **z = +0,5 é a frente**),
  `y ∈ [0; 1]` (centro da peça, 0 = chão). `sx, sy, sz` = tamanho da peça em fração de `w, h, d`.
  Ex.: tampo de 3 cm num móvel de 0,80 → `sy = 0.03/0.8 ≈ 0.04`, `y = 1 − sy/2`.
- `shape`: `box`, `cylinder` (eixo vertical; `taper` = raio do topo ÷ base; `rz: 90` deita), `sphere`.
- `color`: `base` (cor do item), `dark`, `light` (variações dela) ou `#rrggbb`. Opcionais: `roughness`,
  `metalness`, `opacity`, `rx/ry/rz` (graus).
- Exemplos: `furniture/aparador.json`, `furniture/mesa-lateral.json`. O móvel aparece no painel
  "Adicionar móveis" no grupo escolhido e pode ser usado em `items[].type`.
- Móveis com modelo mais elaborado vivem no código (`src/data/catalog.ts` + `src/components/Furniture3D.tsx`,
  um `case` por tipo). Prefira JSON; só vá para o código se precisar de algo que peças não resolvem.

---

## Checklist antes de dar push

1. `npm run validate` — valida todos os JSON (ids, paredes/cômodos/tipos existentes, aberturas dentro da parede,
   cores, números). **Roda também no `prebuild`: se falhar, o deploy da Vercel falha.**
2. `npm run build` (inclui a validação) — e, se mexeu em código, `npx tsc --noEmit` e `npx eslint src scripts`.
3. Conferir visualmente quando possível (`npm run dev` → http://localhost:3000 → abrir a versão, 2D e 3D).
   Coordenadas erradas não quebram a validação, mas deixam o móvel dentro da parede.
4. Commit pequeno e descritivo (`versions: adiciona "home office no quarto"`), push na `main`.

## Mapa do código

- `src/data/apartment.ts` — **planta base fiel ao DWG** (paredes, pilares, esquadrias, cômodos). Só mude com
  base no DWG; ideias de reforma vão em `versions/`.
- `src/data/catalog.ts` — catálogo de móveis do código, formato `Part`, louças originais (`initialItems`).
- `src/lib/files.ts` — formato + validação de `versions/` e `furniture/` (usado pelo app e pelo `validate`).
- `src/lib/plan.ts` — junta planta base + edições da versão (`resolvePlan`).
- `src/lib/store.ts` — estado (zustand + localStorage), versões, sincronização com o repo, desfazer.
- `src/lib/repo.server.ts` — lê `versions/` e `furniture/` no build; `src/app/api/versions/route.ts` — grava (só dev).
- `src/components/` — `Plan2D` (SVG), `Scene3D` + `Furniture3D` (react-three-fiber), `Sidebar`, `Versions`, `App`.
- `src/lib/theme.ts` — tema claro/escuro/auto (cores da planta e do 3D); tokens CSS em `src/app/globals.css`.
- `scripts/validate.ts` — `npm run validate` / `npm run plan`.

Fonte da geometria: `Alteração Durante a Obra Po 1170 Encanamento_Varanda de Casa Forte 26_03_24 V1.dwg`
(bloco "Tipo alt"); alturas do "Quadro de Esquadrias" do mesmo arquivo. EA1 2,00×2,20 (correr, piso);
EA3 1,20×1,10 peit. 1,10; EA5 0,60×0,60 peit. 1,60; EA27 1,00×1,10 peit. 1,10; P1 0,80, P2 0,70, P3 0,60 × 2,10.

## Textos da interface (regra)

- **Curto.** Botões com 1–3 palavras; selos/status com até ~4 palavras; avisos em **1 frase**.
- **Detalhe vai no `title` (tooltip)**, não no corpo da tela. Ex.: o aviso de armazenamento é
  "⚠️ Edições aqui ficam só neste navegador. Para guardar, use Exportar JSON." e a explicação completa fica
  no `title`.
- Nada de parágrafos em cards, sidebar ou modais. Descrições de versão aparecem cortadas em 2 linhas.
- Mantenha os avisos de "só neste navegador" (a regra de armazenamento acima) — só não os deixe longos.

## Sidebar do editor

Cabeçalho (← Versões, nome editável, selo de status, ⧉ Nova variação) → barra (3D / 2D+3D / 2D, desfazer,
📸 Capturar) → abas **Móveis** (prévia 3D + miniaturas; clique mostra, duplo clique ou "Adicionar" coloca),
**Editar** (seleção atual; abre sozinha ao clicar em algo), **Vista** (câmera, teto, grade, luz, tema,
atalhos). Coisas novas entram numa dessas abas — não crie seções soltas.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
