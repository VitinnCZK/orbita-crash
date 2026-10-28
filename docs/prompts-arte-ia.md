# Prompts de arte (IA) — Órbita

Um prompt por peça que hoje é desenhada em código em `client/src/game/art.ts`.
Os prompts estão em inglês porque os geradores de imagem respondem melhor assim.

## Como gerar sem fundo

Poucos geradores entregam transparência real. Escolha um caminho:

1. **Transparência nativa:** `gpt-image-1` (API ou ChatGPT) com `background: transparent`, ou o Recraft e o Ideogram com a opção de fundo transparente. Exporte em PNG.
2. **Chroma key (funciona em qualquer gerador, incluindo Midjourney):** mantenha no prompt a linha `on a flat solid #FF00FF magenta background`. Depois remova o fundo com `rembg` (`pip install rembg`, `rembg i entrada.png saida.png`), remove.bg ou o Photoshop.
3. Confira as bordas. Se sobrar uma franja magenta, faça um "defringe" ou erosão de 1 px.

Regras para todas as peças:

- Peça sempre **um único objeto centralizado**, com margem de cerca de 10% em volta, sem cortar nada e sem sombra projetada no chão.
- Gere em **quadrado de 1024x1024 ou maior**. A única exceção é o foguete, que fica em 3:2.
- Exporte em **PNG com alpha**. Depois converta para **WebP** (qualidade 85) para o bundle ficar leve.
- Exclua sempre: `text, watermark, logo, signature, frame, border, background elements, ground shadow`.

## Bloco de estilo (cole no início de TODO prompt)

Ele mantém as peças coerentes entre si, no mesmo visual cartoon do código atual:

```
Cute stylized cartoon game asset, thick dark indigo outline (#1d1140), soft cel shading with smooth gradients, glossy specular highlights, vibrant saturated colors, rim light on the upper-left, clean vector-like finish, mobile casual game style, centered single object, chroma key background: perfectly flat solid #FF00FF magenta fill, uniform color edge to edge, no gradient, no vignette, no glow, no shadow, no texture on the background, no magenta on the object itself, no text, no watermark
```

Cuidado com o chroma key: o magenta fica próximo do rosa/vermelho (`#ff4d6d`) e do roxo do foguete, da explosão e do planeta Marte, e a remoção pode comer essas cores nas bordas. Para essas peças, troque no bloco `#FF00FF magenta` por `#00FF00 green`.

Paleta de referência do projeto: roxo `#8b6cff`, lilás `#c9a8e8`, rosa/vermelho `#ff4d6d`, laranja `#ffb15c`, dourado `#ffd23f`, ciano `#4fd6ff`, contorno `#1d1140`.

---

## 1. Foguete — `rocket.png`

Proporção 3:2 (por exemplo 1536x1024). **Aponta para a DIREITA**, porque o código gira o sprite pela trajetória. O tamanho em tela é 92x64.

```
[BLOCO DE ESTILO]. A small cute cartoon rocket ship seen in perfect side view, pointing to the RIGHT (nose on the right, exhaust nozzle on the left), horizontal orientation. Glossy white-lavender body with a subtle gradient from white on top to soft purple (#9d93e0) on the bottom, rounded orange-to-pink nose cone (#ffb15c to #ff4d6d), one round porthole window with a cyan glass gradient (#c9fbff to #1a7fd1) and a white reflection dot, a pink stripe near the tail, two swept-back purple fins (#8b6cff to #4a2fc0) at the top and bottom, a small dark grey-purple engine nozzle. NO flame and NO smoke coming out of the engine. Chunky friendly proportions, thick dark indigo outline.
```

Negative prompt: `flame, fire, exhaust, smoke, motion lines, stars, planet, person, text`

> A chama é dinâmica e muda de tamanho com o multiplicador, então **continua em código** (`flame` em `GameScene.ts`). Por isso o foguete tem que sair sem fogo.

---

## 2. Planetas

Peça **sem halo/brilho externo**, só a esfera. O halo é um gradiente que o código desenha melhor, com transparência suave. A luz vem do canto superior esquerdo. O maior (lilás) aparece em tela grande, então gere em **2048x2048**.

### 2a. `planet-lilas.png` — com crateras

```
[BLOCO DE ESTILO]. A round cartoon planet filling most of the frame, lilac-purple surface (light #c9a8e8, base #8a63b8, dark shadow #3e2466), about 9 soft round craters of different sizes with darker inner shading and a light rim on each crater, light coming from the upper-left, dark terminator shadow on the lower-right side, thin white rim-light arc along the upper-left edge. Perfectly circular silhouette, no rings, no moons, no outer glow.
```

### 2b. `planet-marte.png` — com faixas

```
[BLOCO DE ESTILO]. A round cartoon gas-giant style planet filling most of the frame, warm coral-red surface (light #ff9a7a, base #c4405a, dark #5a1636) with 7 horizontal wavy cloud bands alternating between slightly lighter peach and slightly darker maroon, light coming from the upper-left, dark shadow on the lower-right, thin white rim-light arc on the upper-left edge. Perfectly circular silhouette, no rings, no moons, no outer glow.
```

### 2c. `planet-lua.png` — com manchas

```
[BLOCO DE ESTILO]. A small round cartoon planet filling most of the frame, bright blue surface (light #8fe8ff, base #2f8de0, dark #16306e) with about 6 soft pale-cyan oval continent/ice spots, light coming from the upper-left, dark shadow on the lower-right, thin white rim-light arc on the upper-left edge. Perfectly circular silhouette, no rings, no moons, no outer glow.
```

Negative prompt para os três: `rings, moons, atmosphere glow, halo, stars, space background, text, face`

---

## 3. Asteroides — `asteroid-1.png`, `asteroid-2.png`, `asteroid-3.png`

O jogo usa 3 variações. Gere **3 imagens com o mesmo prompt** (troque só a linha final) ou peça 3 formatos diferentes. Tamanho: 1024x1024.

```
[BLOCO DE ESTILO]. A single small cartoon asteroid rock, irregular lumpy polygon-like silhouette with 8-10 slightly angular corners, dusty purple-brown color (light #a07a9e, base #6b4670, dark #3a2342), three small shallow round craters with darker inner shading, light from the upper-left, soft shadow on the lower-right, thick dark indigo outline. VARIATION: <A: wide and flat | B: tall and chunky | C: nearly round with a chipped corner>.
```

Negative prompt: `glow, sparkles, ice, gems, face, text, multiple rocks`

---

## 4. Moeda — `coin.png`

Pequena em tela (cerca de 24 px). Mantenha o desenho **simples e legível**. Gere em 512x512.

```
[BLOCO DE ESTILO]. A single shiny gold cartoon coin seen straight on from the front, perfectly round, radial gold gradient (highlight #fff3a6, mid #ffd23f, edge #f29b0c), a darker orange inner ring engraved near the edge, a small white glossy highlight at the upper-left, a thin darker golden thickness visible below the bottom edge. Blank face, no symbol, no number, no text.
```

Negative prompt: `dollar sign, text, numbers, face, stack of coins, sparkles, hand`

---

## 5. Estrela de explosão "BOOM" — `boom.png`

Grande e dramática. Gere em 1024x1024. É um adesivo de explosão estilo quadrinhos, **sem texto**.

```
[BLOCO DE ESTILO]. A comic-book explosion burst shape, a jagged 11-point star with rounded tips, radial gradient from bright yellow in the center (#ffe066) through orange (#ff8a1e) to red-orange at the tips (#ff4d3d), thick dark crimson outline (#9c1f2e), and a smaller 9-point white-to-pale-yellow star glowing in the very center. Perfectly symmetric radial composition, flat sticker-like look. No text inside, no letters.
```

Negative prompt: `text, letters, "BOOM", smoke, debris, fire realistic, photo`

---

## 6. Fumaça (puff) — `puff.png`

Usada várias vezes em cada explosão, em tamanhos e rotações diferentes. Gere em 512x512.

```
[BLOCO DE ESTILO]. A single round cartoon smoke puff, a soft cloud-like ball with a slightly bumpy outline, lavender gradient (highlight #f2e8ff, mid #b7a3dc, shade #7d68ae), a highlight at the upper-left, thick dark indigo outline. Simple and chunky, looks good when tiny.
```

Negative prompt: `fire, face, multiple clouds, sparkles, text`

---

## O que NÃO precisa de IA

| Peça | Motivo |
|---|---|
| Estrelas (`dot`) | Círculo branco de 8 px, tingido e animado em código. |
| Chama do foguete | Dinâmica, redesenhada a cada frame. |
| Curva, grade e área do gráfico | Dados em tempo real. |
| Fundos (`fundo-espaco-*.jpg`) | Já existem. |
| Logo e ícone | Já existem. |

## Depois de gerar

1. Salve os arquivos em `client/src/assets/images/game/`.
2. Peça para eu trocar `art.ts` para carregar essas imagens (`Assets.load` + `Sprite`) no lugar dos desenhos em canvas. O tamanho em tela continua o mesmo, só muda a origem da textura.
3. Os 3 tamanhos de planeta e os 3 asteroides continuam sendo escalados por `baseR` e `size` no `GameScene.ts`.
4. Se quiser manter o bundle leve, use WebP e redimensione cada peça para 2x do tamanho em tela (ex.: foguete 184x128, moeda 48x48).
