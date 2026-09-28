/**
 * Rhizosphere app — mode toggle, detail panel, sources, hub wiring, SW.
 */
import { MODES, ORGANISMS, CITATIONS, organismById, citationById } from "./data.js";
import { RhizosphereScene } from "./scene.js";

const STORAGE_KEY = "rhizosphere-mode";

function $(sel, root = document) {
  return root.querySelector(sel);
}

function readMode() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === MODES.ADVANCED ? MODES.ADVANCED : MODES.SIMPLE;
}

function writeMode(mode) {
  localStorage.setItem(STORAGE_KEY, mode);
}

function renderLegend(container) {
  container.innerHTML = ORGANISMS.map(
    (o) =>
      `<button type="button" class="hotspot-chip hover:border-ochre/40 transition-soil" data-org="${o.id}" aria-label="Show ${o.label}">
        <span class="dot" style="background:${o.accent}"></span>${o.label}
      </button>`
  ).join("");
}

function renderSources(listEl) {
  listEl.innerHTML = CITATIONS.map(
    (c) =>
      `<li class="mb-3 last:mb-0">
        <span class="font-mono text-[0.62rem] tracking-widest uppercase text-ochre/80">${c.short}</span>
        <p class="m-0 mt-1 text-[0.8rem] leading-relaxed text-mist">${c.full}</p>
      </li>`
  ).join("");
}

function renderDetail(panel, orgId, mode) {
  const empty = $("#detail-empty", panel);
  const body = $("#detail-body", panel);
  if (!orgId) {
    empty.hidden = false;
    body.hidden = true;
    body.innerHTML = "";
    return;
  }
  const org = organismById(orgId);
  if (!org) return;
  const copy = mode === MODES.ADVANCED ? org.advanced : org.simple;
  empty.hidden = true;
  body.hidden = false;

  let citesHtml = "";
  if (mode === MODES.ADVANCED && copy.cites && copy.cites.length) {
    citesHtml = `<div class="mt-4 space-y-2">
      ${copy.cites
        .map((id) => {
          const c = citationById(id);
          return c ? `<blockquote class="cite"><span class="font-mono text-[0.6rem] tracking-widest uppercase text-ochre block mb-1">${c.short}</span>${c.full}</blockquote>` : "";
        })
        .join("")}
    </div>`;
  }

  body.innerHTML = `
    <div class="flex items-center gap-2 mb-2">
      <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${org.accent}" aria-hidden="true"></span>
      <p class="m-0 font-mono text-[0.62rem] tracking-widest uppercase text-mist-dim">${mode === MODES.ADVANCED ? "Advanced" : "Simple"} reading</p>
    </div>
    <h2 class="m-0 font-display font-normal text-[1.55rem] text-root-pale leading-tight">${copy.title}</h2>
    <p class="mt-2 mb-3 text-[0.95rem] text-ochre-bright/90 leading-snug">${copy.lede}</p>
    <p class="m-0 text-[0.88rem] leading-relaxed text-mist">${copy.body}</p>
    ${citesHtml}
  `;
}

function setModeButtons(mode) {
  document.querySelectorAll("[data-mode]").forEach((btn) => {
    const on = btn.getAttribute("data-mode") === mode;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:";
  // Register on http(s) hosts (GitHub Pages or local static server)
  if (location.protocol !== "https:" && !isLocal) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("SW registration skipped:", err.message);
    });
  });
}

function init() {
  const canvas = $("#soil-canvas");
  const panel = $("#detail-panel");
  const legend = $("#organism-legend");
  const sourcesList = $("#sources-list");
  const modeStatus = $("#mode-status");

  let mode = readMode();
  setModeButtons(mode);
  if (modeStatus) {
    modeStatus.textContent =
      mode === MODES.ADVANCED
        ? "Advanced mode shows mechanisms and citations."
        : "Simple mode keeps the story short and clear.";
  }

  renderLegend(legend);
  renderSources(sourcesList);
  renderDetail(panel, null, mode);

  const scene = new RhizosphereScene(canvas, {
    onSelect(id) {
      renderDetail(panel, id, mode);
      legend.querySelectorAll("[data-org]").forEach((chip) => {
        chip.classList.toggle("ring-1", chip.getAttribute("data-org") === id);
        chip.classList.toggle("ring-ochre/50", chip.getAttribute("data-org") === id);
      });
      if (id) {
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
  });

  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mode = btn.getAttribute("data-mode");
      writeMode(mode);
      setModeButtons(mode);
      if (modeStatus) {
        modeStatus.textContent =
          mode === MODES.ADVANCED
            ? "Advanced mode shows mechanisms and citations."
            : "Simple mode keeps the story short and clear.";
      }
      renderDetail(panel, scene.selectedId, mode);
    });
  });

  legend.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-org]");
    if (!chip) return;
    const id = chip.getAttribute("data-org");
    scene.select(id);
  });

  const sourcesToggle = $("#sources-toggle");
  const sourcesPanel = $("#sources-panel");
  if (sourcesToggle && sourcesPanel) {
    sourcesToggle.addEventListener("click", () => {
      const open = sourcesPanel.hasAttribute("hidden");
      if (open) sourcesPanel.removeAttribute("hidden");
      else sourcesPanel.setAttribute("hidden", "");
      sourcesToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  registerSW();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
