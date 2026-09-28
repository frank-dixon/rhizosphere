/**
 * Rhizosphere scene — premium soil cross-section: horizons, fine roots,
 * microbial fields, dig/brush reveal, precise hotspots, keyboard pan.
 */
import { ORGANISMS } from "./data.js";

const WORLD_W = 960;
const WORLD_H = 640;
const LAYER_DEPTH = { far: 0.32, mid: 0.62, near: 1 };

/** Deterministic pseudo-random from integer seed */
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class RhizosphereScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ onSelect?: (id: string | null) => void }} opts
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.onSelect = opts.onSelect || (() => {});
    this.selectedId = null;
    this.hoverId = null;
    this.focusIndex = -1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.velX = 0;
    this.velY = 0;
    this.scale = 1;
    this.dragging = false;
    this.dragMoved = false;
    this.brushing = false;
    this.lastPtr = { x: 0, y: 0 };
    this.ptrStart = { x: 0, y: 0 };
    this.digDepth = 0.35; // 0 = surface crust, 1 = fully revealed microbial field
    this.brushMarks = []; // {x,y,r,life}
    this.keys = new Set();
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.t0 = performance.now();
    this.raf = 0;
    this._boundLoop = this._loop.bind(this);
    this._resize = this._resize.bind(this);
    this._onPtrDown = this._onPtrDown.bind(this);
    this._onPtrMove = this._onPtrMove.bind(this);
    this._onPtrUp = this._onPtrUp.bind(this);
    this._onLeave = this._onLeave.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    this.hotspots = ORGANISMS.map((o) => ({
      id: o.id,
      label: o.label,
      zone: o.zone || "",
      accent: o.accent,
      x: o.x,
      y: o.y,
      r: o.r,
      layer: o.layer || "mid",
    }));

    this._resize();
    window.addEventListener("resize", this._resize);
    canvas.addEventListener("pointerdown", this._onPtrDown);
    canvas.addEventListener("pointermove", this._onPtrMove);
    canvas.addEventListener("pointerup", this._onPtrUp);
    canvas.addEventListener("pointercancel", this._onPtrUp);
    canvas.addEventListener("pointerleave", this._onLeave);
    canvas.addEventListener("wheel", this._onWheel, { passive: false });
    canvas.setAttribute("tabindex", "0");
    canvas.addEventListener("keydown", this._onKeyDown);
    canvas.addEventListener("keyup", this._onKeyUp);
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    canvas.style.outline = "none";

    this.raf = requestAnimationFrame(this._boundLoop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this._resize);
    this.canvas.removeEventListener("pointerdown", this._onPtrDown);
    this.canvas.removeEventListener("pointermove", this._onPtrMove);
    this.canvas.removeEventListener("pointerup", this._onPtrUp);
    this.canvas.removeEventListener("pointercancel", this._onPtrUp);
    this.canvas.removeEventListener("pointerleave", this._onLeave);
    this.canvas.removeEventListener("wheel", this._onWheel);
    this.canvas.removeEventListener("keydown", this._onKeyDown);
    this.canvas.removeEventListener("keyup", this._onKeyUp);
  }

  select(id) {
    this.selectedId = id;
    if (id) {
      const idx = this.hotspots.findIndex((h) => h.id === id);
      if (idx >= 0) this.focusIndex = idx;
    }
    this.onSelect(id);
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, rect.width || this.canvas.clientWidth || 800);
    const h = Math.max(280, rect.height || this.canvas.clientHeight || 520);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = w;
    this.viewH = h;
    this.scale = Math.min(w / WORLD_W, h / WORLD_H) * 1.08;
    this._clampOffset();
  }

  _clampOffset() {
    const maxX = (WORLD_W * this.scale - this.viewW) / 2 + 48;
    const maxY = (WORLD_H * this.scale - this.viewH) / 2 + 48;
    this.offsetX = Math.max(-Math.abs(maxX), Math.min(Math.abs(maxX), this.offsetX));
    this.offsetY = Math.max(-Math.abs(maxY), Math.min(Math.abs(maxY), this.offsetY));
  }

  _worldFromClient(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cx = this.viewW / 2 + this.offsetX;
    const cy = this.viewH / 2 + this.offsetY;
    return {
      x: (sx - cx) / this.scale + WORLD_W / 2,
      y: (sy - cy) / this.scale + WORLD_H / 2,
    };
  }

  _hitTest(wx, wy) {
    let best = null;
    let bestD = Infinity;
    for (const h of this.hotspots) {
      const depth = LAYER_DEPTH[h.layer] || 0.62;
      const px = h.x + (-this.offsetX / this.scale) * (1 - depth) * 0.12;
      const py = h.y + (-this.offsetY / this.scale) * (1 - depth) * 0.12;
      const d = Math.hypot(wx - px, wy - py);
      const hitR = h.r + 14;
      if (d <= hitR && d < bestD) {
        best = h;
        bestD = d;
      }
    }
    return best;
  }

  _onPtrDown(e) {
    this.canvas.focus({ preventScroll: true });
    this.dragging = true;
    this.dragMoved = false;
    this.brushing = e.shiftKey || e.altKey || e.button === 2;
    this.lastPtr = { x: e.clientX, y: e.clientY };
    this.ptrStart = { x: e.clientX, y: e.clientY };
    this.velX = 0;
    this.velY = 0;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    this.canvas.style.cursor = this.brushing ? "crosshair" : "grabbing";
    if (this.brushing) {
      const w = this._worldFromClient(e.clientX, e.clientY);
      this._addBrush(w.x, w.y);
    }
  }

  _onPtrMove(e) {
    if (this.dragging) {
      const dx = e.clientX - this.lastPtr.x;
      const dy = e.clientY - this.lastPtr.y;
      this.lastPtr = { x: e.clientX, y: e.clientY };
      if (Math.hypot(e.clientX - this.ptrStart.x, e.clientY - this.ptrStart.y) > 5) {
        this.dragMoved = true;
      }
      if (this.brushing) {
        const w = this._worldFromClient(e.clientX, e.clientY);
        this._addBrush(w.x, w.y);
      } else {
        this.offsetX += dx;
        this.offsetY += dy;
        this.velX = dx;
        this.velY = dy;
        this._clampOffset();
      }
    } else {
      const w = this._worldFromClient(e.clientX, e.clientY);
      const hit = this._hitTest(w.x, w.y);
      this.hoverId = hit ? hit.id : null;
      this.canvas.style.cursor = hit ? "pointer" : "grab";
    }
  }

  _onPtrUp(e) {
    if (!this.dragging) return;
    const wasBrush = this.brushing;
    this.dragging = false;
    this.brushing = false;
    this.canvas.style.cursor = this.hoverId ? "pointer" : "grab";
    if (!wasBrush && !this.dragMoved) {
      const w = this._worldFromClient(e.clientX, e.clientY);
      const hit = this._hitTest(w.x, w.y);
      this.select(hit ? hit.id : null);
    }
  }

  _onLeave() {
    this.hoverId = null;
    if (!this.dragging) this.canvas.style.cursor = "grab";
  }

  _onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.04 : -0.04;
    this.digDepth = Math.max(0, Math.min(1, this.digDepth + delta));
  }

  _addBrush(x, y) {
    this.brushMarks.push({ x, y, r: 36 + hash(x + y) * 18, life: 1 });
    if (this.brushMarks.length > 48) this.brushMarks.shift();
    this.digDepth = Math.min(1, this.digDepth + 0.015);
  }

  _onKeyDown(e) {
    const panKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s", "A", "D", "W", "S"];
    if (panKeys.includes(e.key)) {
      e.preventDefault();
      this.keys.add(e.key);
      return;
    }
    if (e.key === "[" || e.key === "-") {
      e.preventDefault();
      this.digDepth = Math.max(0, this.digDepth - 0.06);
      return;
    }
    if (e.key === "]" || e.key === "=" || e.key === "+") {
      e.preventDefault();
      this.digDepth = Math.min(1, this.digDepth + 0.06);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const dir = e.shiftKey ? -1 : 1;
      this.focusIndex = (this.focusIndex + dir + this.hotspots.length) % this.hotspots.length;
      const h = this.hotspots[this.focusIndex];
      this.hoverId = h.id;
      this.select(h.id);
      this._panToward(h.x, h.y);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (this.hoverId) this.select(this.hoverId);
      else if (this.focusIndex >= 0) this.select(this.hotspots[this.focusIndex].id);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.select(null);
      this.hoverId = null;
      this.focusIndex = -1;
    }
  }

  _onKeyUp(e) {
    this.keys.delete(e.key);
  }

  _panToward(wx, wy) {
    const targetX = -(wx - WORLD_W / 2) * this.scale * 0.35;
    const targetY = -(wy - WORLD_H / 2) * this.scale * 0.35;
    this.offsetX += (targetX - this.offsetX) * 0.55;
    this.offsetY += (targetY - this.offsetY) * 0.55;
    this._clampOffset();
  }

  _loop(now) {
    this.raf = requestAnimationFrame(this._boundLoop);
    this._applyKeys();
    if (!this.dragging && !this.reducedMotion) {
      this.offsetX += this.velX;
      this.offsetY += this.velY;
      this.velX *= 0.88;
      this.velY *= 0.88;
      if (Math.abs(this.velX) < 0.05) this.velX = 0;
      if (Math.abs(this.velY) < 0.05) this.velY = 0;
      this._clampOffset();
    }
    // Fade brush marks
    for (const m of this.brushMarks) {
      m.life -= this.reducedMotion ? 0.02 : 0.008;
    }
    this.brushMarks = this.brushMarks.filter((m) => m.life > 0);
    this._draw(now);
  }

  _applyKeys() {
    const speed = 4.2;
    let dx = 0;
    let dy = 0;
    if (this.keys.has("ArrowLeft") || this.keys.has("a") || this.keys.has("A")) dx += speed;
    if (this.keys.has("ArrowRight") || this.keys.has("d") || this.keys.has("D")) dx -= speed;
    if (this.keys.has("ArrowUp") || this.keys.has("w") || this.keys.has("W")) dy += speed;
    if (this.keys.has("ArrowDown") || this.keys.has("s") || this.keys.has("S")) dy -= speed;
    if (dx || dy) {
      this.offsetX += dx;
      this.offsetY += dy;
      this.velX = 0;
      this.velY = 0;
      this._clampOffset();
    }
  }

  _draw(now) {
    const ctx = this.ctx;
    const t = this.reducedMotion ? 0 : (now - this.t0) / 1000;
    const w = this.viewW;
    const h = this.viewH;
    const dig = this.digDepth;

    ctx.clearRect(0, 0, w, h);

    // Base void
    ctx.fillStyle = "#14100c";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 + this.offsetX, h / 2 + this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-WORLD_W / 2, -WORLD_H / 2);

    this._drawHorizons(ctx, dig);
    this._drawSoilTexture(ctx, dig);
    this._drawBulkMicrobes(ctx, t, dig);
    this._drawHyphalNetwork(ctx, t, dig);
    this._drawRootSystem(ctx, t);
    this._drawRhizosphereSleeve(ctx, t, dig);
    this._drawRhizoplane(ctx, t, dig);
    this._drawNodules(ctx);
    this._drawBrushReveals(ctx, dig);
    this._drawZoneLabels(ctx, dig);
    this._drawHotspots(ctx, t);

    ctx.restore();

    // Soft vignette
    const vig = ctx.createRadialGradient(w / 2, h * 0.42, h * 0.15, w / 2, h / 2, h * 0.92);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(12,8,5,0.48)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Dig depth indicator (editorial, bottom-right of canvas)
    this._drawDigMeter(ctx, w, h, dig);
  }

  _parallax(layer) {
    const depth = LAYER_DEPTH[layer] || 0.62;
    const px = (-this.offsetX / this.scale) * (1 - depth) * 0.28;
    const py = (-this.offsetY / this.scale) * (1 - depth) * 0.28;
    return { px, py };
  }

  _drawHorizons(ctx, dig) {
    const { px, py } = this._parallax("far");
    ctx.save();
    ctx.translate(px * 0.35, py * 0.35);

    // Above-ground / litter strip (O horizon edge)
    const sky = ctx.createLinearGradient(0, 0, 0, 108);
    sky.addColorStop(0, "#2e3830");
    sky.addColorStop(0.5, "#243028");
    sky.addColorStop(1, "#1a140e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD_W, 108);

    // Sparse grass — restrained vertical strokes, not cartoon tufts
    ctx.strokeStyle = "rgba(78, 110, 72, 0.4)";
    ctx.lineWidth = 0.9;
    ctx.lineCap = "round";
    for (let i = 0; i < 36; i++) {
      const x = 18 + i * 26 + hash(i * 3) * 8;
      const hgt = 22 + hash(i * 7) * 18;
      ctx.beginPath();
      ctx.moveTo(x, 104);
      ctx.lineTo(x, 104 - hgt);
      ctx.stroke();
    }

    // A horizon — organic-rich
    const aH = ctx.createLinearGradient(0, 108, 0, 280);
    aH.addColorStop(0, "#3a2a1c");
    aH.addColorStop(0.4, "#2c1e14");
    aH.addColorStop(1, "#241810");
    ctx.fillStyle = aH;
    ctx.fillRect(0, 108, WORLD_W, 172);

    // B horizon — denser mineral
    const bH = ctx.createLinearGradient(0, 280, 0, WORLD_H);
    bH.addColorStop(0, "#221810");
    bH.addColorStop(0.55, "#1a120c");
    bH.addColorStop(1, "#120e0a");
    ctx.fillStyle = bH;
    ctx.fillRect(0, 280, WORLD_W, WORLD_H - 280);

    // Horizon boundary lines (editorial hairlines)
    ctx.strokeStyle = `rgba(168, 148, 118, ${0.12 + dig * 0.1})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(24, 280);
    ctx.lineTo(WORLD_W - 24, 280);
    ctx.stroke();
    ctx.setLineDash([]);

    // Surface contact
    ctx.strokeStyle = "rgba(180, 158, 122, 0.28)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(0, 108);
    for (let x = 0; x <= WORLD_W; x += 16) {
      ctx.lineTo(x, 108 + Math.sin(x * 0.035) * 2.2);
    }
    ctx.stroke();

    ctx.restore();
  }

  _drawSoilTexture(ctx, dig) {
    const { px, py } = this._parallax("far");
    ctx.save();
    ctx.translate(px, py);

    // Aggregates — quiet ellipses, not playful pebbles
    for (let i = 0; i < 90; i++) {
      const x = hash(i * 11) * WORLD_W;
      const y = 130 + hash(i * 17) * (WORLD_H - 150);
      const rx = 3 + hash(i * 23) * 9;
      const ry = 2 + hash(i * 29) * 5;
      const a = 0.04 + hash(i) * 0.1 * (0.4 + dig * 0.6);
      ctx.fillStyle = hash(i * 3) > 0.5 ? `rgba(62, 42, 28, ${a})` : `rgba(28, 20, 14, ${a + 0.05})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, hash(i * 5) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pore spaces
    for (let i = 0; i < 28; i++) {
      const x = 40 + hash(i * 41) * (WORLD_W - 80);
      const y = 180 + hash(i * 43) * 400;
      ctx.fillStyle = `rgba(0,0,0,${0.12 + dig * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 6 + hash(i) * 8, 3 + hash(i * 2) * 4, hash(i * 7), 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine mineral grit
    ctx.fillStyle = `rgba(156, 128, 96, ${0.08 + dig * 0.1})`;
    for (let i = 0; i < 120; i++) {
      const x = hash(i * 53) * WORLD_W;
      const y = 140 + hash(i * 59) * 460;
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.restore();
  }

  _drawBulkMicrobes(ctx, t, dig) {
    const { px, py } = this._parallax("far");
    ctx.save();
    ctx.translate(px, py);
    const alpha = 0.15 + dig * 0.55;

    // Diffuse microbial field — fine stipple density, not cartoon dots
    for (let i = 0; i < 180; i++) {
      const x = hash(i * 61) * WORLD_W;
      const y = 200 + hash(i * 67) * 400;
      const nearRoot = Math.hypot(x - 450, y - 340);
      const dens = nearRoot < 160 ? 1.4 : nearRoot < 280 ? 0.9 : 0.45;
      const a = alpha * dens * (0.25 + hash(i * 71) * 0.5);
      const c = hash(i * 13);
      if (c < 0.33) ctx.fillStyle = `rgba(106, 148, 110, ${a})`;
      else if (c < 0.66) ctx.fillStyle = `rgba(168, 140, 100, ${a})`;
      else ctx.fillStyle = `rgba(140, 120, 150, ${a * 0.85})`;
      const r = 0.6 + hash(i * 19) * 1.4;
      ctx.beginPath();
      ctx.arc(x, y + (this.reducedMotion ? 0 : Math.sin(t * 0.3 + i) * 0.4), r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Saprotroph zone — warm mottling lower-right
    ctx.fillStyle = `rgba(166, 122, 82, ${0.06 + dig * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(708, 482, 78, 42, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Pathogen pressure — cool crimson haze lower-left
    ctx.fillStyle = `rgba(143, 69, 69, ${0.05 + dig * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(188, 448, 62, 36, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawHyphalNetwork(ctx, t, dig) {
    const { px, py } = this._parallax("mid");
    ctx.save();
    ctx.translate(px, py);
    const alpha = 0.12 + dig * 0.38;

    ctx.lineCap = "round";
    ctx.lineWidth = 0.85;

    // Extraradical AMF network — fine branching from AMF hotspot toward root
    const strands = [
      [572, 398, 530, 370, 490, 350, 455, 335],
      [572, 398, 540, 410, 500, 395, 462, 375],
      [572, 398, 600, 430, 640, 455, 680, 470],
      [572, 398, 610, 380, 660, 360, 720, 355],
      [560, 410, 520, 450, 480, 470, 430, 490],
      [580, 390, 550, 340, 520, 310, 490, 290],
    ];
    for (let i = 0; i < strands.length; i++) {
      const [x0, y0, cx1, cy1, cx2, cy2, x1, y1] = strands[i];
      const wob = this.reducedMotion ? 0 : Math.sin(t * 0.5 + i) * 2;
      ctx.strokeStyle = `rgba(168, 136, 184, ${alpha * (0.55 + (i % 3) * 0.12)})`;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(cx1 + wob, cy1, cx2 - wob, cy2, x1, y1);
      ctx.stroke();
      // Secondary forks
      if (i < 4) {
        ctx.strokeStyle = `rgba(168, 136, 184, ${alpha * 0.35})`;
        ctx.beginPath();
        ctx.moveTo(cx2, cy2);
        ctx.quadraticCurveTo(cx2 + 30, cy2 + 25 + i * 4, cx2 + 55, cy2 + 40);
        ctx.stroke();
      }
    }

    // Distant faint hyphae in bulk
    ctx.strokeStyle = `rgba(150, 130, 160, ${alpha * 0.25})`;
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 7; i++) {
      const x0 = 80 + i * 120;
      const y0 = 320 + hash(i * 9) * 180;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x0 + 40, y0 + 20, x0 + 70, y0 - 15, x0 + 110, y0 + 35);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawRootSystem(ctx, t) {
    const { px, py } = this._parallax("near");
    ctx.save();
    ctx.translate(px * 0.15, py * 0.15);

    const breath = this.reducedMotion ? 0 : Math.sin(t * 0.7) * 0.8;

    // Soft root girth glow
    ctx.strokeStyle = "rgba(200, 178, 140, 0.12)";
    ctx.lineWidth = 22;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(492, 108);
    ctx.bezierCurveTo(472, 185, 502, 265, 458, 345);
    ctx.bezierCurveTo(422, 405, 432, 475, 412, 555);
    ctx.stroke();

    // Primary axis
    const rootGrad = ctx.createLinearGradient(490, 100, 410, 560);
    rootGrad.addColorStop(0, "#e4d6c0");
    rootGrad.addColorStop(0.35, "#c4ae88");
    rootGrad.addColorStop(0.75, "#9a8258");
    rootGrad.addColorStop(1, "#6e5a38");
    ctx.strokeStyle = rootGrad;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(492, 108);
    ctx.bezierCurveTo(472, 185, 502, 265, 458, 345);
    ctx.bezierCurveTo(422, 405, 432, 475, 412, 555);
    ctx.stroke();

    // Highlight edge
    ctx.strokeStyle = "rgba(242, 235, 220, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(488, 110);
    ctx.bezierCurveTo(468, 186, 498, 266, 454, 346);
    ctx.stroke();

    // Secondary laterals — architectural, tapered
    const laterals = [
      { pts: [458, 345, 360, 318, 290, 365], w: 4.2 },
      { pts: [458, 345, 545, 328, 625, 385], w: 4.0 },
      { pts: [432, 430, 348, 455, 265, 512], w: 3.4 },
      { pts: [425, 465, 515, 485, 590, 535], w: 3.2 },
      { pts: [470, 250, 400, 228, 325, 255], w: 3.6 },
      { pts: [480, 200, 540, 185, 600, 210], w: 2.8 },
      { pts: [450, 380, 400, 410, 370, 460], w: 2.6 },
    ];
    for (const lat of laterals) {
      const [x0, y0, cx, cy, x1, y1] = lat.pts;
      ctx.strokeStyle = "#a89270";
      ctx.lineWidth = lat.w;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx + breath * 0.4, cy, x1, y1);
      ctx.stroke();
      // Fine tertiary tips
      ctx.strokeStyle = "rgba(180, 160, 130, 0.55)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(x1 + (x1 - cx) * 0.35, y1 + 12, x1 + (x1 - cx) * 0.55, y1 + 22);
      ctx.stroke();
    }

    // Root hairs — dense, fine, near exudate zone
    ctx.strokeStyle = "rgba(230, 218, 198, 0.38)";
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 28; i++) {
      const baseX = 430 + (i % 7) * 4;
      const baseY = 270 + Math.floor(i / 7) * 14;
      const ang = -2.4 + (i % 9) * 0.28 + hash(i) * 0.2;
      const len = 10 + hash(i * 3) * 16;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(baseX + Math.cos(ang) * len, baseY + Math.sin(ang) * len);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawRhizosphereSleeve(ctx, t, dig) {
    const { px, py } = this._parallax("near");
    ctx.save();
    ctx.translate(px * 0.12, py * 0.12);
    const breath = this.reducedMotion ? 0.5 : 0.42 + Math.sin(t * 0.9) * 0.08;
    const a = (0.2 + dig * 0.35) * breath;

    // Elliptical sleeve along main root — scientific diagram language
    ctx.save();
    ctx.translate(450, 340);
    ctx.rotate(-0.35);
    const sleeve = ctx.createRadialGradient(0, 0, 20, 0, 0, 120);
    sleeve.addColorStop(0, `rgba(109, 143, 98, ${a * 0.55})`);
    sleeve.addColorStop(0.45, `rgba(109, 143, 98, ${a * 0.18})`);
    sleeve.addColorStop(1, "rgba(109, 143, 98, 0)");
    ctx.fillStyle = sleeve;
    ctx.beginPath();
    ctx.ellipse(0, 0, 55, 130, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hairline boundary of rhizosphere vs bulk
    ctx.strokeStyle = `rgba(109, 143, 98, ${0.15 + dig * 0.2})`;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 55, 130, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.restore();
  }

  _drawRhizoplane(ctx, t, dig) {
    const { px, py } = this._parallax("near");
    ctx.save();
    ctx.translate(px * 0.1, py * 0.1);
    const a = 0.25 + dig * 0.5;

    // Exudate plume — tight to surface, not bouncy glow orbs
    const g = ctx.createRadialGradient(438, 286, 2, 438, 286, 48);
    g.addColorStop(0, `rgba(109, 143, 98, ${0.4 * a})`);
    g.addColorStop(0.55, `rgba(109, 143, 98, ${0.12 * a})`);
    g.addColorStop(1, "rgba(109, 143, 98, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(438, 286, 48, 0, Math.PI * 2);
    ctx.fill();

    // Chemotactic particle drift — tiny, slow, precise
    if (!this.reducedMotion && dig > 0.15) {
      for (let i = 0; i < 14; i++) {
        const ang = t * 0.35 + i * 0.55;
        const rr = 8 + (i % 5) * 5;
        const x = 438 + Math.cos(ang) * rr;
        const y = 286 + Math.sin(ang * 0.9) * rr * 0.65;
        ctx.fillStyle = `rgba(168, 196, 150, ${0.2 + dig * 0.25})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Biofilm film along epidermis segment
    ctx.strokeStyle = `rgba(11, 138, 143, ${0.15 + dig * 0.28})`;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(478, 220);
    ctx.bezierCurveTo(470, 255, 488, 295, 455, 335);
    ctx.stroke();
    // Quorum-density stipple on film
    for (let i = 0; i < 20; i++) {
      const u = i / 19;
      const x = 478 + (455 - 478) * u + Math.sin(u * 6) * 4;
      const y = 220 + (335 - 220) * u;
      ctx.fillStyle = `rgba(11, 138, 143, ${0.2 + dig * 0.35})`;
      ctx.beginPath();
      ctx.arc(x + (hash(i) - 0.5) * 6, y + (hash(i * 2) - 0.5) * 4, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // N-fixer microcolonies near nodules
    for (let i = 0; i < 16; i++) {
      const ang = i * 0.4 + t * 0.25;
      const x = 298 + Math.cos(ang) * (14 + (i % 4) * 4);
      const y = 368 + Math.sin(ang) * (10 + (i % 3) * 3);
      ctx.fillStyle = `rgba(79, 125, 92, ${0.25 + dig * 0.35})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawNodules(ctx) {
    const { px, py } = this._parallax("near");
    ctx.save();
    ctx.translate(px * 0.15, py * 0.15);
    const nodules = [
      [292, 358, 8, 6.5],
      [308, 372, 7, 5.5],
      [280, 376, 6.5, 5],
      [318, 355, 5.5, 4.5],
    ];
    for (const [nx, ny, rx, ry] of nodules) {
      ctx.fillStyle = "#4a6b4e";
      ctx.beginPath();
      ctx.ellipse(nx, ny, rx, ry, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(200, 220, 190, 0.2)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawBrushReveals(ctx, dig) {
    if (!this.brushMarks.length) return;
    ctx.save();
    for (const m of this.brushMarks) {
      const a = m.life * (0.15 + dig * 0.25);
      const g = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, m.r);
      g.addColorStop(0, `rgba(200, 190, 160, ${a * 0.35})`);
      g.addColorStop(0.5, `rgba(120, 140, 100, ${a * 0.12})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
      // Extra microbe reveal inside brush
      for (let i = 0; i < 12; i++) {
        const ang = hash(i + m.x) * Math.PI * 2;
        const rr = hash(i + m.y) * m.r * 0.7;
        ctx.fillStyle = `rgba(150, 180, 140, ${a * 0.5})`;
        ctx.beginPath();
        ctx.arc(m.x + Math.cos(ang) * rr, m.y + Math.sin(ang) * rr, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawZoneLabels(ctx, dig) {
    if (dig < 0.12) return;
    const a = Math.min(1, (dig - 0.12) / 0.35);
    ctx.save();
    ctx.font = '500 9px "IBM Plex Sans", system-ui, sans-serif';
    ctx.textAlign = "left";
    ctx.fillStyle = `rgba(184, 172, 152, ${0.35 * a})`;
    ctx.letterSpacing = "0.14em";

    const labels = [
      { text: "RHIZOPLANE", x: 500, y: 268 },
      { text: "RHIZOSPHERE", x: 510, y: 360 },
      { text: "BULK SOIL", x: 760, y: 420 },
      { text: "A HORIZON", x: 36, y: 168 },
      { text: "B HORIZON", x: 36, y: 310 },
    ];
    for (const L of labels) {
      ctx.fillText(L.text, L.x, L.y);
    }
    ctx.restore();
  }

  _drawHotspots(ctx, t) {
    for (const h of this.hotspots) {
      const { px, py } = this._parallax(h.layer);
      const x = h.x + px;
      const y = h.y + py;
      const active = this.selectedId === h.id;
      const hovered = this.hoverId === h.id;
      const lit = active || hovered;

      ctx.save();
      ctx.translate(x, y);

      // Precise annular marker — no bouncing pulse rings
      const breathe = this.reducedMotion || !lit ? 1 : 1 + Math.sin(t * 1.6) * 0.015;

      // Outer hairline
      ctx.beginPath();
      ctx.arc(0, 0, (h.r + 6) * breathe, 0, Math.PI * 2);
      ctx.strokeStyle = active
        ? "rgba(242, 235, 220, 0.75)"
        : hovered
          ? h.accent + "aa"
          : "rgba(240, 232, 220, 0.18)";
      ctx.lineWidth = active ? 1.4 : 0.9;
      ctx.stroke();

      // Inner accent ring
      ctx.beginPath();
      ctx.arc(0, 0, h.r * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = lit ? h.accent : h.accent + "66";
      ctx.lineWidth = lit ? 1.5 : 1;
      ctx.stroke();

      // Soft fill only when selected
      if (active) {
        const rg = ctx.createRadialGradient(0, 0, 1, 0, 0, h.r + 4);
        rg.addColorStop(0, h.accent + "55");
        rg.addColorStop(1, h.accent + "00");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(0, 0, h.r + 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core tick — small square rotated 45° (editorial, not candy dot)
      ctx.save();
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = lit ? "#f2ebe0" : h.accent;
      const s = lit ? 3.2 : 2.4;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();

      // Label — restrained typography
      ctx.font = '500 10px "IBM Plex Sans", system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.fillStyle = lit ? "rgba(242, 235, 220, 0.92)" : "rgba(168, 156, 140, 0.55)";
      ctx.fillText(h.label, 0, h.r + 16);
      if (lit && h.zone) {
        ctx.font = '400 8px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillStyle = lit ? h.accent : "rgba(168, 156, 140, 0.4)";
        ctx.fillText(h.zone, 0, h.r + 28);
      }

      ctx.restore();
    }
  }

  _drawDigMeter(ctx, w, h, dig) {
    const mw = 64;
    const mh = 3;
    const mx = w - mw - 14;
    const my = h - 18;
    ctx.fillStyle = "rgba(242, 235, 220, 0.12)";
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = "rgba(11, 138, 143, 0.7)";
    ctx.fillRect(mx, my, mw * dig, mh);
    ctx.font = '400 8px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillStyle = "rgba(184, 172, 152, 0.45)";
    ctx.textAlign = "right";
    ctx.fillText("DEPTH", mx - 6, my + 4);
  }
}
