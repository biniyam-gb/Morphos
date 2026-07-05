
// js/plot.js — Shared plotting utilities

export class Viewport {
  constructor(xMin = -5, xMax = 5, yMin = -5, yMax = 5) {
    this.xMin = xMin; this.xMax = xMax;
    this.yMin = yMin; this.yMax = yMax;
  }

  toCanvas(x, y, W, H) {
    return [
      (x - this.xMin) / (this.xMax - this.xMin) * W,
      (1 - (y - this.yMin) / (this.yMax - this.yMin)) * H,
    ];
  }

  toWorld(cx, cy, W, H) {
    return [
      this.xMin + (cx / W) * (this.xMax - this.xMin),
      this.yMin + (1 - cy / H) * (this.yMax - this.yMin),
    ];
  }

  // ddx, ddy = how much the mouse moved in canvas pixels (positive = right / down)
  pan(ddx, ddy, W, H) {
    const dx = (ddx / W) * (this.xMax - this.xMin);
    const dy = (ddy / H) * (this.yMax - this.yMin);
    this.xMin -= dx; this.xMax -= dx; // drag right → xMin decreases → world moves right ✓
    this.yMin += dy; this.yMax += dy; // drag down  → yMin increases → canvas y is inverted ✓
  }

  zoom(factor, cx, cy, W, H) {
    const [wx, wy] = this.toWorld(cx, cy, W, H);
    const hw = (this.xMax - this.xMin) * factor * 0.5;
    const hh = (this.yMax - this.yMin) * factor * 0.5;
    this.xMin = wx - hw; this.xMax = wx + hw;
    this.yMin = wy - hh; this.yMax = wy + hh;
  }

  width()  { return this.xMax - this.xMin; }
  height() { return this.yMax - this.yMin; }
  clone()  { return new Viewport(this.xMin, this.xMax, this.yMin, this.yMax); }
}

function niceTick(range) {
  const raw = range / 6;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  if (f < 1.5) return p;
  if (f < 3.5) return 2 * p;
  if (f < 7.5) return 5 * p;
  return 10 * p;
}

function fmtN(x, step) {
  const d = Math.max(0, -Math.floor(Math.log10(step)));
  return x.toFixed(d);
}

export function drawAxes(ctx, vp, W, H, opts = {}) {
  const { zeroColor = '#999', textColor = '#666', fontSize = 11 } = opts;
  ctx.save();

  const [ox, oy] = vp.toCanvas(0, 0, W, H);
  const axY = Math.max(0, Math.min(H, oy));
  const axX = Math.max(0, Math.min(W, ox));

  // Grid lines first (behind axes)
  const xStep = niceTick(vp.xMax - vp.xMin);
  const yStep = niceTick(vp.yMax - vp.yMin);
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
  for (let x = Math.ceil(vp.xMin / xStep) * xStep; x <= vp.xMax + 1e-9; x += xStep) {
    const [cx] = vp.toCanvas(x, 0, W, H);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
  }
  for (let y = Math.ceil(vp.yMin / yStep) * yStep; y <= vp.yMax + 1e-9; y += yStep) {
    const [, cy] = vp.toCanvas(0, y, W, H);
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = zeroColor; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, axY); ctx.lineTo(W, axY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(axX, 0); ctx.lineTo(axX, H); ctx.stroke();

  // Tick labels
  ctx.font = `${fontSize}px "Courier New", monospace`;
  ctx.fillStyle = textColor;
  for (let x = Math.ceil(vp.xMin / xStep) * xStep; x <= vp.xMax + 1e-9; x += xStep) {
    if (Math.abs(x) < xStep * 0.01) continue;
    const [cx] = vp.toCanvas(x, 0, W, H);
    ctx.beginPath(); ctx.moveTo(cx, axY-4); ctx.lineTo(cx, axY+4); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(fmtN(x, xStep), cx, axY + 6);
  }
  for (let y = Math.ceil(vp.yMin / yStep) * yStep; y <= vp.yMax + 1e-9; y += yStep) {
    if (Math.abs(y) < yStep * 0.01) continue;
    const [, cy] = vp.toCanvas(0, y, W, H);
    ctx.beginPath(); ctx.moveTo(axX-4, cy); ctx.lineTo(axX+4, cy); ctx.stroke();
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(fmtN(y, yStep), axX - 6, cy);
  }

  ctx.restore();
}

export function rk4(fn, x, y, dt) {
  const [k1x, k1y] = fn(x, y);
  const [k2x, k2y] = fn(x + dt*k1x/2, y + dt*k1y/2);
  const [k3x, k3y] = fn(x + dt*k2x/2, y + dt*k2y/2);
  const [k4x, k4y] = fn(x + dt*k3x,   y + dt*k3y);
  return [
    x + dt * (k1x + 2*k2x + 2*k3x + k4x) / 6,
    y + dt * (k1y + 2*k2y + 2*k3y + k4y) / 6,
  ];
}

export function clearCanvas(ctx, W, H, bg = '#fff') {
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
}

export function label(ctx, text, cx, cy, opts = {}) {
  const { color = '#333', size = 12, align = 'left', bg = null } = opts;
  ctx.save();
  ctx.font = `${size}px "Courier New", monospace`;
  ctx.textAlign = align; ctx.textBaseline = 'top';
  if (bg) {
    const m = ctx.measureText(text);
    ctx.fillStyle = bg;
    ctx.fillRect(cx - 3, cy - 2, m.width + 6, size + 4);
  }
  ctx.fillStyle = color; ctx.fillText(text, cx, cy);
  ctx.restore();
}

export function dot(ctx, x, y, r, color, lbl, size = 12) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  if (lbl) {
    ctx.fillStyle = '#222';
    ctx.font = `bold ${size}px "Courier New", monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(lbl, x + r + 3, y - r);
  }
  ctx.restore();
}
