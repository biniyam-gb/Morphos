// Percolation Theory -- site percolation on a square lattice, cluster
// identification via flood fill, and the sharp phase transition at p_c.
import { clearCanvas, label } from '../plot.js';

function generateLattice(L, p) {
  const grid = new Uint8Array(L * L);
  for (let i = 0; i < L * L; i++) grid[i] = Math.random() < p ? 1 : 0;
  return grid;
}
function findClusters(grid, L) {
  const labels = new Int32Array(L * L).fill(-1);
  let next = 0;
  const sizes = [];
  for (let i = 0; i < L * L; i++) {
    if (grid[i] === 0 || labels[i] >= 0) continue;
    const stack = [i]; labels[i] = next; let size = 0;
    while (stack.length) {
      const cur = stack.pop(); size++;
      const x = cur % L, y = Math.floor(cur / L);
      if (x > 0 && grid[cur-1] && labels[cur-1] < 0) { labels[cur-1] = next; stack.push(cur-1); }
      if (x < L-1 && grid[cur+1] && labels[cur+1] < 0) { labels[cur+1] = next; stack.push(cur+1); }
      if (y > 0 && grid[cur-L] && labels[cur-L] < 0) { labels[cur-L] = next; stack.push(cur-L); }
      if (y < L-1 && grid[cur+L] && labels[cur+L] < 0) { labels[cur+L] = next; stack.push(cur+L); }
    }
    sizes.push(size); next++;
  }
  return { labels, sizes, numClusters: next };
}
function spanningCluster(labels, L, numClusters) {
  const touchesTop = new Array(numClusters).fill(false), touchesBottom = new Array(numClusters).fill(false);
  for (let x = 0; x < L; x++) {
    if (labels[x] >= 0) touchesTop[labels[x]] = true;
    if (labels[(L-1)*L + x] >= 0) touchesBottom[labels[(L-1)*L + x]] = true;
  }
  for (let c = 0; c < numClusters; c++) if (touchesTop[c] && touchesBottom[c]) return c;
  return -1;
}

const P_CRITICAL = 0.5927; // numerically determined threshold for 2D square-lattice site percolation

export class Percolation {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.L = 90;
    this.params = {
      p: 0.55, autoSweep: true, sweepSpeed: 1,
      showAllClusters: true,
    };
    this.paramDefs = [
      { group: 'Lattice', items: [
        { id: 'p', label: 'Occupation probability p', min: 0, max: 1, step: 0.005, type: 'range',
          tip: `Critical threshold p_c\u2248${P_CRITICAL} for 2D square-lattice site percolation (numerically determined).` },
        { id: 'autoSweep', label: 'Auto-sweep p', type: 'toggle' },
        { id: 'sweepSpeed', label: 'Sweep speed', min: 1, max: 8, step: 1, type: 'range' },
        { id: 'showAllClusters', label: 'Color all clusters', type: 'toggle', tip: 'Off: only show the spanning cluster (if any), for a cleaner view of the transition.' },
      ]},
    ];
    this.presets = [
      { id: 'below', name: 'Below p_c (0.45)', params: { p: 0.45, autoSweep: false } },
      { id: 'at',    name: 'Near p_c (0.593)',  params: { p: 0.593, autoSweep: false } },
      { id: 'above', name: 'Above p_c (0.75)',  params: { p: 0.75, autoSweep: false } },
      { id: 'sweep', name: 'Animated sweep',      params: { p: 0, autoSweep: true } },
    ];
    this.domain = 'Statistical Mechanics';
    this.description = `Each lattice site is independently "open" with probability p. A spanning cluster connecting top to bottom suddenly becomes overwhelmingly likely once p crosses p_c\u2248${P_CRITICAL} -- a sharp geometric phase transition with no adjustable parameter, exactly analogous to the Ising model's thermal phase transition.`;
    this.stepsPerFrame = 1;
    this._history = [];
    this._regenerate();
  }

  getFormula() { return `Site percolation, p_c \u2248 ${P_CRITICAL} (2D square lattice)`; }

  _regenerate() {
    this._grid = generateLattice(this.L, this.params.p);
    const { labels, sizes, numClusters } = findClusters(this._grid, this.L);
    this._labels = labels; this._sizes = sizes; this._numClusters = numClusters;
    this._spanId = spanningCluster(labels, this.L, numClusters);
  }

  reset() { this._history = []; this._regenerate(); }
  onParamChange(id) { if (id === '_preset') this._history = []; this._regenerate(); }

  update() {
    if (!this.params.autoSweep) return;
    for (let s = 0; s < this.params.sweepSpeed; s++) {
      this.params.p += 0.006;
      if (this.params.p > 1) this.params.p = 0;
      this._regenerate();
      this._history.push({ p: this.params.p, spans: this._spanId >= 0 ? 1 : 0 });
      if (this._history.length > 400) this._history.shift();
    }
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const leftW = W * 0.55;
    const L = this.L;
    const cell = Math.min(leftW - 20, H - 60) / L;
    const ox = (leftW - L * cell) / 2, oy = (H - L * cell) / 2;

    for (let y = 0; y < L; y++) {
      for (let x = 0; x < L; x++) {
        const i = y * L + x;
        let col = '#f0f0ec';
        if (this._grid[i]) {
          const lbl = this._labels[i];
          if (lbl === this._spanId) col = '#c42020';
          else if (this.params.showAllClusters) col = `hsl(${(lbl * 47) % 360},55%,55%)`;
          else col = '#bbb';
        }
        ctx.fillStyle = col;
        ctx.fillRect(ox + x * cell, oy + y * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
    label(ctx, `p = ${this.params.p.toFixed(3)}   ${this._spanId >= 0 ? 'SPANS top\u2192bottom' : 'does not span'}`, ox, oy - 18, { color: this._spanId >= 0 ? '#c42020' : '#333', size: 12, bg: 'rgba(255,255,255,0.9)' });

    // Right: P(spans) vs p accumulated over the sweep
    const gx = leftW + 20, gy = 40, gw = W - leftW - 40, gh = H - 100;
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.stroke();
    const tx = p => gx + p * gw, ty = f => gy + gh - f * gh;
    ctx.strokeStyle = 'rgba(196,32,32,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(tx(P_CRITICAL), gy); ctx.lineTo(tx(P_CRITICAL), gy + gh); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, `p_c\u2248${P_CRITICAL}`, tx(P_CRITICAL) + 4, gy + 4, { color: '#c42020', size: 9 });
    for (const h of this._history) { ctx.fillStyle = 'rgba(26,79,168,0.5)'; ctx.beginPath(); ctx.arc(tx(h.p), ty(h.spans), 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#c42020';
    ctx.beginPath(); ctx.arc(tx(this.params.p), ty(this._spanId >= 0 ? 1 : 0), 5, 0, Math.PI * 2); ctx.fill();
    label(ctx, 'spans? (1/0)', gx, gy - 12, { color: '#555', size: 10 });
    label(ctx, 'p', gx + gw / 2, gy + gh + 16, { color: '#555', size: 10 });
    if (!this.params.autoSweep) label(ctx, 'Enable "Auto-sweep p" to build the transition curve', gx, gy + gh + 32, { color: '#888', size: 9 });

    const largest = Math.max(...this._sizes, 0);
    label(ctx, `${this._numClusters} clusters, largest = ${largest} sites (${(100*largest/(L*L)).toFixed(1)}%)`, gx, H - 12, { color: '#666', size: 9 });
  }

  coordInfo(cx, cy, W, H) {
    const leftW = W * 0.55, L = this.L;
    const cell = Math.min(leftW - 20, H - 60) / L;
    const ox = (leftW - L*cell)/2, oy = (H - L*cell)/2;
    const gx = Math.floor((cx-ox)/cell), gy = Math.floor((cy-oy)/cell);
    if (gx < 0 || gx >= L || gy < 0 || gy >= L) return `p=${this.params.p.toFixed(3)}`;
    const i = gy*L+gx;
    return `site (${gx},${gy}): ${this._grid[i]?'open':'closed'}  p=${this.params.p.toFixed(3)}`;
  }
}
