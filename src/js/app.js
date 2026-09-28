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
      `<button type="button" class="hotspot-chip" data-org="${o.id}" aria-label="Show ${o.label}">
        <span class="dot" style="background:${o.accent}"></span>
        <span class="chip-label">${o.label}</span>
        <span class="chip-zone">${o.zone || ""}</span>
      </button>`
  ).join("");
}

function renderSources(listEl) {
  listEl.innerHTML = CITATIONS.map(
    (c) =>
      `<li class="source-item">
        <span class="source-short">${c.short}</span>
        <p class="source-full">${c.full}</p>
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
    citesHtml = `<div class="cite-stack">
      ${copy.cites
        .map((id) => {
          const c = citationById(id);
          return c
            ? `<blockquote class="cite"><span class="cite-tag">${c.short}</span>${c.full}</blockquote>`
            : "";
        })
        .join("")}
    </div>`;
  }

  body.innerHTML = `
    <div class="detail-meta">
      <span class="detail-swatch" style="background:${org.accent}" aria-hidden="true"></span>
      <p class="detail-kicker">${org.zone || "Rhizosphere"} · ${mode === MODES.ADVANCED ? "Advanced" : "Simple"}</p>
    </div>
    <h2 class="detail-title">${copy.title}</h2>
    <p class="detail-lede">${copy.lede}</p>
    <p class="detail-body">${copy.body}</p>
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

function syncLegendSelection(legend, id) {
  legend.querySelectorAll("[data-org]").forEach((chip) => {
    const on = chip.getAttribute("data-org") === id;
    chip.classList.toggle("is-active", on);
    chip.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:";
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
        ? "Mechanisms, pathways, and primary literature."
        : "Full-sentence ecology without jargon overload.";
  }

  renderLegend(legend);
  renderSources(sourcesList);
  renderDetail(panel, null, mode);

  const scene = new RhizosphereScene(canvas, {
    onSelect(id) {
      renderDetail(panel, id, mode);
      syncLegendSelection(legend, id);
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
            ? "Mechanisms, pathways, and primary literature."
            : "Full-sentence ecology without jargon overload.";
      }
      renderDetail(panel, scene.selectedId, mode);
    });
  });

  legend.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-org]");
    if (!chip) return;
    scene.select(chip.getAttribute("data-org"));
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

  // Prevent context menu on canvas when brush-revealing with right-click
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  registerSW();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
