/**
 * Rhizosphere scene — canvas soil cross-section with pan, parallax, hotspots.
 */
import { ORGANISMS } from "./data.js";

const WORLD_W = 960;
const WORLD_H = 640;
const LAYER_DEPTH = { far: 0.35, mid: 0.65, near: 1 };

export class RhizosphereScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ onSelect?: (id: string | null) => void }} opts
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onSelect = opts.onSelect || (() => {});
    this.selectedId = null;
    this.hoverId = null;
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this.dragging = false;
    this.dragMoved = false;
    this.lastPtr = { x: 0, y: 0 };
    this.ptrStart = { x: 0, y: 0 };
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.t0 = performance.now();
    this.raf = 0;
    this._boundLoop = this._loop.bind(this);
    this._resize = this._resize.bind(this);
    this._onPtrDown = this._onPtrDown.bind(this);
    this._onPtrMove = this._onPtrMove.bind(this);
    this._onPtrUp = this._onPtrUp.bind(this);
    this._onLeave = this._onLeave.bind(this);

    this.hotspots = ORGANISMS.map((o) => ({
      id: o.id,
      label: o.label,
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
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";

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
  }

  select(id) {
    this.selectedId = id;
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
    this.scale = Math.min(w / WORLD_W, h / WORLD_H) * 1.05;
    this._clampOffset();
  }

  _clampOffset() {
    const maxX = (WORLD_W * this.scale - this.viewW) / 2 + 40;
    const maxY = (WORLD_H * this.scale - this.viewH) / 2 + 40;
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
      const depth = LAYER_DEPTH[h.layer] || 0.65;
      const px = h.x + (-this.offsetX / this.scale) * (1 - depth) * 0.15;
      const py = h.y + (-this.offsetY / this.scale) * (1 - depth) * 0.15;
      const d = Math.hypot(wx - px, wy - py);
      const hitR = h.r + 10;
      if (d <= hitR && d < bestD) {
        best = h;
        bestD = d;
      }
    }
    return best;
  }

  _onPtrDown(e) {
    this.dragging = true;
    this.dragMoved = false;
    this.lastPtr = { x: e.clientX, y: e.clientY };
    this.ptrStart = { x: e.clientX, y: e.clientY };
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = "grabbing";
  }

  _onPtrMove(e) {
    if (this.dragging) {
      const dx = e.clientX - this.lastPtr.x;
      const dy = e.clientY - this.lastPtr.y;
      this.lastPtr = { x: e.clientX, y: e.clientY };
      if (Math.hypot(e.clientX - this.ptrStart.x, e.clientY - this.ptrStart.y) > 6) {
        this.dragMoved = true;
      }
      this.offsetX += dx;
      this.offsetY += dy;
      this._clampOffset();
    } else {
      const w = this._worldFromClient(e.clientX, e.clientY);
      const hit = this._hitTest(w.x, w.y);
      this.hoverId = hit ? hit.id : null;
      this.canvas.style.cursor = hit ? "pointer" : "grab";
    }
  }

  _onPtrUp(e) {
    if (!this.dragging) return;
    this.dragging = false;
    this.canvas.style.cursor = this.hoverId ? "pointer" : "grab";
    if (!this.dragMoved) {
      const w = this._worldFromClient(e.clientX, e.clientY);
      const hit = this._hitTest(w.x, w.y);
      this.select(hit ? hit.id : null);
    }
  }

  _onLeave() {
    this.hoverId = null;
    if (!this.dragging) this.canvas.style.cursor = "grab";
  }

  _loop(now) {
    this.raf = requestAnimationFrame(this._boundLoop);
    this._draw(now);
  }

  _draw(now) {
    const ctx = this.ctx;
    const t = this.reducedMotion ? 0 : (now - this.t0) / 1000;
    const w = this.viewW;
    const h = this.viewH;

    ctx.clearRect(0, 0, w, h);

    // Background soil gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#2a2218");
    bg.addColorStop(0.35, "#1f1710");
    bg.addColorStop(1, "#120e0a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 + this.offsetX, h / 2 + this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-WORLD_W / 2, -WORLD_H / 2);

    this._drawHorizon(ctx, t);
    this._drawFarSoil(ctx, t);
    this._drawMidSoil(ctx, t);
    this._drawRoot(ctx, t);
    this._drawExudateGlow(ctx, t);
    this._drawNearParticles(ctx, t);
    this._drawHotspots(ctx, t);

    ctx.restore();

    // vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(10,6,4,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  _parallax(layer) {
    const depth = LAYER_DEPTH[layer] || 0.65;
    const px = (-this.offsetX / this.scale) * (1 - depth) * 0.35;
    const py = (-this.offsetY / this.scale) * (1 - depth) * 0.35;
    return { px, py };
  }

  _drawHorizon(ctx, t) {
    const { px, py } = this._parallax("far");
    ctx.save();
    ctx.translate(px * 0.4, py * 0.4);

    // Above-ground strip
    const sky = ctx.createLinearGradient(0, 0, 0, 110);
    sky.addColorStop(0, "#3a4a38");
    sky.addColorStop(0.55, "#2c3524");
    sky.addColorStop(1, "#1a120c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD_W, 118);

    // Grass tufts
    ctx.strokeStyle = "rgba(90, 138, 82, 0.55)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 48; i++) {
      const x = 20 + i * 20 + Math.sin(i * 1.7) * 4;
      const sway = this.reducedMotion ? 0 : Math.sin(t * 0.8 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(x, 112);
      ctx.quadraticCurveTo(x + sway, 70 + (i % 5) * 3, x + sway * 1.4, 48 + (i % 7) * 4);
      ctx.stroke();
    }

    // Soil surface line
    ctx.strokeStyle = "rgba(168, 144, 112, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 118);
    for (let x = 0; x <= WORLD_W; x += 24) {
      ctx.lineTo(x, 118 + Math.sin(x * 0.04) * 3);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawFarSoil(ctx, t) {
    const { px, py } = this._parallax("far");
    ctx.save();
    ctx.translate(px, py);

    // Deep soil mottling
    for (let i = 0; i < 60; i++) {
      const x = (i * 97) % WORLD_W;
      const y = 160 + ((i * 53) % (WORLD_H - 180));
      const r = 8 + (i % 5) * 3;
      ctx.fillStyle = i % 3 === 0 ? "rgba(74, 47, 24, 0.35)" : "rgba(40, 28, 18, 0.4)";
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aggregates / pebbles
    for (let i = 0; i < 18; i++) {
      const x = 40 + ((i * 137) % (WORLD_W - 80));
      const y = 220 + ((i * 89) % 360);
      ctx.fillStyle = "rgba(156, 107, 74, 0.22)";
      ctx.beginPath();
      ctx.arc(x, y, 4 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }

    // Faint hyphal threads (far)
    ctx.strokeStyle = "rgba(168, 136, 184, 0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x0 = 120 + i * 95;
      const y0 = 300 + (i % 3) * 40;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x0 + 40, y0 + 30, x0 + 80, y0 - 20, x0 + 130, y0 + 50 + Math.sin(t + i) * 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawMidSoil(ctx, t) {
    const { px, py } = this._parallax("mid");
    ctx.save();
    ctx.translate(px, py);

    // Pore spaces
    for (let i = 0; i < 24; i++) {
      const x = 60 + ((i * 71) % (WORLD_W - 120));
      const y = 200 + ((i * 101) % 380);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(x, y, 10 + (i % 4) * 2, 6 + (i % 3), (i % 5) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Decomposer mottles (clay warm)
    ctx.fillStyle = "rgba(184, 122, 82, 0.12)";
    ctx.beginPath();
    ctx.ellipse(680, 470, 70, 36, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Pathogen zone hint
    ctx.fillStyle = "rgba(139, 58, 58, 0.1)";
    ctx.beginPath();
    ctx.ellipse(200, 440, 55, 32, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawRoot(ctx, t) {
    const { px, py } = this._parallax("near");
    ctx.save();
    ctx.translate(px * 0.2, py * 0.2);

    const pulse = this.reducedMotion ? 0 : Math.sin(t * 1.2) * 0.5;

    // Main taproot from surface
    const rootGrad = ctx.createLinearGradient(480, 100, 440, 520);
    rootGrad.addColorStop(0, "#e8dcc8");
    rootGrad.addColorStop(0.4, "#c4a878");
    rootGrad.addColorStop(1, "#8a7340");

    ctx.strokeStyle = rootGrad;
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(490, 108);
    ctx.bezierCurveTo(470, 180, 500, 260, 455, 340);
    ctx.bezierCurveTo(420, 400, 430, 470, 410, 540);
    ctx.stroke();

    // Secondary roots
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#a89070";
    const laterals = [
      [455, 340, 320, 300, 260, 360],
      [455, 340, 560, 320, 620, 380],
      [430, 420, 340, 450, 280, 500],
      [420, 460, 520, 480, 580, 520],
      [445, 280, 380, 250, 300, 270],
    ];
    for (const [x0, y0, cx, cy, x1, y1] of laterals) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx + pulse, cy, x1, y1);
      ctx.stroke();
    }

    // Fine root hairs near exudate zone
    ctx.strokeStyle = "rgba(232, 220, 200, 0.45)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) {
      const ang = -Math.PI / 2 + i * 0.22;
      const bx = 420 + Math.cos(ang) * 8;
      const by = 280 + Math.sin(ang) * 6;
      ctx.beginPath();
      ctx.moveTo(440, 290);
      ctx.lineTo(bx + Math.cos(ang) * (18 + i), by + Math.sin(ang) * (14 + i * 0.5));
      ctx.stroke();
    }

    // Nodule bumps (Rhizobium zone)
    ctx.fillStyle = "#6b8f6a";
    for (const [nx, ny] of [
      [300, 355],
      [318, 372],
      [288, 378],
    ]) {
      ctx.beginPath();
      ctx.ellipse(nx, ny, 9, 7, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawExudateGlow(ctx, t) {
    const { px, py } = this._parallax("near");
    ctx.save();
    ctx.translate(px * 0.15, py * 0.15);
    const breath = this.reducedMotion ? 0.55 : 0.45 + Math.sin(t * 1.5) * 0.2;

    const g = ctx.createRadialGradient(420, 280, 4, 420, 280, 70);
    g.addColorStop(0, `rgba(122, 158, 110, ${0.45 * breath})`);
    g.addColorStop(0.5, `rgba(122, 158, 110, ${0.18 * breath})`);
    g.addColorStop(1, "rgba(122, 158, 110, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(420, 280, 70, 0, Math.PI * 2);
    ctx.fill();

    // Droplet particles
    if (!this.reducedMotion) {
      for (let i = 0; i < 10; i++) {
        const a = t * 0.6 + i * 0.7;
        const rr = 12 + (i % 5) * 8 + Math.sin(a) * 4;
        const ang = a + i;
        const x = 420 + Math.cos(ang) * rr;
        const y = 280 + Math.sin(ang) * rr * 0.7;
        ctx.fillStyle = `rgba(168, 196, 140, ${0.35 + (i % 3) * 0.1})`;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawNearParticles(ctx, t) {
    const { px, py } = this._parallax("near");
    ctx.save();
    ctx.translate(px * 0.1, py * 0.1);

    // AMF purple filaments toward root
    ctx.strokeStyle = "rgba(168, 136, 184, 0.45)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(560, 390);
      const wobble = this.reducedMotion ? 0 : Math.sin(t + i) * 6;
      ctx.bezierCurveTo(520 + wobble, 370 + i * 8, 480, 350 - i * 5, 450, 330 + i * 6);
      ctx.stroke();
    }

    // Tiny microbial dots around Rhizobium
    for (let i = 0; i < 12; i++) {
      const a = i * 0.55 + t * 0.4;
      const x = 310 + Math.cos(a) * (20 + (i % 4) * 5);
      const y = 360 + Math.sin(a) * (14 + (i % 3) * 4);
      ctx.fillStyle = "rgba(106, 173, 122, 0.55)";
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawHotspots(ctx, t) {
    for (const h of this.hotspots) {
      const { px, py } = this._parallax(h.layer);
      const x = h.x + px;
      const y = h.y + py;
      const active = this.selectedId === h.id || this.hoverId === h.id;
      const pulse = this.reducedMotion ? 1 : 1 + Math.sin(t * 2 + x * 0.01) * 0.06;

      ctx.save();
      ctx.translate(x, y);

      // Outer ring
      ctx.beginPath();
      ctx.arc(0, 0, (h.r + 8) * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = active ? h.accent : "rgba(240, 232, 220, 0.22)";
      ctx.lineWidth = active ? 2.2 : 1.2;
      ctx.stroke();

      // Soft fill
      const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, h.r);
      rg.addColorStop(0, active ? h.accent + "cc" : h.accent + "66");
      rg.addColorStop(1, h.accent + "00");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, h.r * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = active ? "#f2ebe0" : h.accent;
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillStyle = active ? "#f2ebe0" : "rgba(184, 168, 152, 0.85)";
      ctx.textAlign = "center";
      ctx.fillText(h.label, 0, h.r + 18);

      ctx.restore();
    }
  }
}
