# Rhizosphere

Interactive root–microbe soil cross-section for Frank Dixon’s portfolio. Pan a single canvas scene, toggle **Simple ↔ Advanced** copy, and open cited microbiology for exudates, *Rhizobium*, arbuscular mycorrhizal fungi, decomposers, and *Fusarium*.

Hub link: [frank-dixon.github.io](https://frank-dixon.github.io/)

## Develop

```bash
npm install
npm run watch          # Tailwind + JS minify on save → docs/
```

Or separately:

```bash
npm run watch:css
npm run watch:js
```

Production build (writes minified assets into `docs/`):

```bash
npm run build
```

Serve `docs/` with any static server (for example `npx serve docs`) to exercise the service worker on localhost.

## Ship notes

- GitHub Pages is **not** enabled yet. Push for review; enable Pages from the `docs/` folder only when Frank says deploy/ship.
- Built CSS/JS under `docs/` are committed so Pages can serve without a CI build step later.

## Stack

- Tailwind CSS 3 (earth-tone tokens in `tailwind.config.js`)
- Plain ES modules (`src/js` → minified `docs/js` via esbuild)
- Lightweight PWA (`manifest.webmanifest` + `sw.js`)
