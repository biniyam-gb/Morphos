// Graph Theory & Networks -- random graph phase transition, spectral graph
// theory, and greedy graph coloring.
import { clearCanvas, label } from '../plot.js';

function erdosRenyiByDegree(n, avgDeg) {
  const p = Math.min(1, avgDeg / (n - 1 || 1));
  const edges = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.random() < p) edges.push([i, j]);
  return edges;
}
function adjacency(n, edges) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  return adj;
}
function components(n, adj) {
  const visited = new Array(n).fill(false);
  const comps = [];
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const comp = []; const stack = [i]; visited[i] = true;
    while (stack.length) {
      const u = stack.pop(); comp.push(u);
      for (const v of adj[u]) if (!visited[v]) { visited[v] = true; stack.push(v); }
    }
    comps.push(comp);
  }
  return comps;
}

// Jacobi eigenvalue/eigenvector solver for small symmetric matrices --
// used here on the graph Laplacian for spectral graph theory.
function jacobiEigen(Ain, n, maxSweeps = 100) {
  const a = Ain.map(row => row.slice());
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        const app = a[p][p], aqq = a[q][q], apq = a[p][q];
        a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
        a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
        a[p][q] = a[q][p] = 0;
        for (let i = 0; i < n; i++) {
          if (i !== p && i !== q) {
            const aip = a[i][p], aiq = a[i][q];
            a[i][p] = a[p][i] = c * aip - s * aiq;
            a[i][q] = a[q][i] = s * aip + c * aiq;
          }
          const vip = v[i][p], viq = v[i][q];
          v[i][p] = c * vip - s * viq;
          v[i][q] = s * vip + c * viq;
        }
      }
    }
  }
  const eigenvalues = Array.from({ length: n }, (_, i) => a[i][i]);
  const idx = eigenvalues.map((_, i) => i).sort((i, j) => eigenvalues[i] - eigenvalues[j]);
  return {
    values: idx.map(i => eigenvalues[i]),
    vectors: idx.map(i => v.map(row => row[i])),
  };
}

function greedyColor(n, adj, order) {
  const color = new Array(n).fill(-1);
  for (const u of order) {
    const used = new Set(adj[u].map(v => color[v]).filter(c => c >= 0));
    let c = 0; while (used.has(c)) c++;
    color[u] = c;
  }
  return color;
}

export class GraphTheory {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = {
      view: 'phase-transition',   // phase-transition | spectral | coloring
      n: 60, avgDeg: 1.0, autoSweep: true, sweepSpeed: 1,
      colorSeed: 0,
    };
    this.paramDefs = [
      { group: 'View', items: [
        { id: 'view', label: 'Topic', type: 'select',
          options: ['phase-transition', 'spectral', 'coloring'],
          tip: 'phase-transition: giant component emergence in G(n,p). spectral: Laplacian eigenvalues & spectral layout. coloring: greedy chromatic number.' },
      ]},
      { group: 'Random Graph  G(n,p)', items: [
        { id: 'n', label: 'Vertices n', min: 10, max: 150, step: 5, type: 'range' },
        { id: 'avgDeg', label: 'Average degree c = np', min: 0, max: 4, step: 0.02, type: 'range',
          tip: 'The Erd\u0151s-R\u00e9nyi threshold: a giant component suddenly appears once c crosses 1.' },
        { id: 'autoSweep', label: 'Auto-sweep c', type: 'toggle' },
        { id: 'sweepSpeed', label: 'Sweep speed', min: 1, max: 10, step: 1, type: 'range' },
      ]},
    ];
    this.presets = [
      { id: 'below', name: 'Below threshold (c=0.5)', params: { view: 'phase-transition', avgDeg: 0.5, autoSweep: false } },
      { id: 'at',    name: 'At threshold (c=1.0)',      params: { view: 'phase-transition', avgDeg: 1.0, autoSweep: false } },
      { id: 'above', name: 'Above threshold (c=2.0)',    params: { view: 'phase-transition', avgDeg: 2.0, autoSweep: false } },
      { id: 'sweep', name: 'Animated sweep',              params: { view: 'phase-transition', avgDeg: 0, autoSweep: true } },
      { id: 'spec',  name: 'Spectral layout',              params: { view: 'spectral', avgDeg: 1.8 } },
      { id: 'color', name: 'Greedy coloring',               params: { view: 'coloring', avgDeg: 2.0 } },
    ];
    this.domain = 'Graph Theory & Networks';
    this.stepsPerFrame = 1;
    this._history = [];
    this._regenerate();
  }

  get description() {
    const m = {
      'phase-transition': 'Erd\u0151s & R\u00e9nyi (1960): as the average degree c=np crosses 1, a giant connected component (size \u221dn) suddenly emerges from a sea of small components -- one of the sharpest phase transitions in mathematics, and a model for percolation, epidemics, and network robustness.',
      spectral: 'The graph Laplacian L=D\u2212A has eigenvalues 0=\u03bb\u2081\u2264\u03bb\u2082\u2264\u2026 The number of zero eigenvalues equals the number of connected components; \u03bb\u2082 (the "algebraic connectivity" / Fiedler value) measures how well-connected the graph is. Plotting vertices at their (v\u2082,v\u2083) eigenvector coordinates is a principled way to draw a graph that reveals its cluster structure.',
      coloring: 'A proper coloring assigns colors so no edge is monochromatic. The greedy algorithm processes vertices in some order and always finds a valid coloring, but not always an optimal one -- the number of colors used depends on vertex order, illustrating why finding the true chromatic number is NP-hard in general.',
    };
    return m[this.params.view] || '';
  }
  getFormula() {
    const m = {
      'phase-transition': `G(n,p), n=${this.params.n}, c=np=${this.params.avgDeg.toFixed(2)}  (threshold at c=1)`,
      spectral: 'L = D \u2212 A,  eigenpairs via Jacobi rotation',
      coloring: 'Greedy: assign the smallest color not used by already-colored neighbors',
    };
    return m[this.params.view] || '';
  }

  _regenerate() {
    const n = this.params.n;
    this._edges = erdosRenyiByDegree(n, this.params.avgDeg);
    this._adj = adjacency(n, this._edges);
    this._comps = components(n, this._adj);
    this._layout = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + i * (2 * Math.PI / n);
      return [Math.cos(a), Math.sin(a)];
    });
    if (this.params.view === 'spectral') this._computeSpectral();
    if (this.params.view === 'coloring') this._computeColoring();
  }

  _computeSpectral() {
    const n = this.params.n;
    const L = Array.from({ length: n }, () => new Array(n).fill(0));
    for (const [a, b] of this._edges) { L[a][a]++; L[b][b]++; L[a][b] = -1; L[b][a] = -1; }
    const { values, vectors } = jacobiEigen(L, n);
    this._eigen = { values, vectors };
  }
  _computeColoring() {
    const n = this.params.n;
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => this._adj[b].length - this._adj[a].length);
    this._coloring = greedyColor(n, this._adj, order);
    this._numColors = Math.max(...this._coloring) + 1;
  }

  reset() { this._history = []; this._regenerate(); }
  onParamChange(id) {
    if (id === 'n' || id === '_preset') { this._history = []; }
    this._regenerate();
  }

  update() {
    if (this.params.view !== 'phase-transition' || !this.params.autoSweep) return;
    for (let s = 0; s < this.params.sweepSpeed; s++) {
      this.params.avgDeg += 0.01;
      if (this.params.avgDeg > 4) this.params.avgDeg = 0;
      this._regenerate();
      const largest = Math.max(...this._comps.map(c => c.length));
      this._history.push({ c: this.params.avgDeg, frac: largest / this.params.n });
      if (this._history.length > 400) this._history.shift();
    }
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const v = this.params.view;
    if (v === 'phase-transition') this._renderPhaseTransition(ctx, W, H);
    else if (v === 'spectral') this._renderSpectral(ctx, W, H);
    else if (v === 'coloring') this._renderColoring(ctx, W, H);
  }

  _drawGraph(ctx, W, H, cx, cy, R, vertexColor, edgeColor) {
    const pts = this._layout.map(([x, y]) => [cx + x * R, cy + y * R]);
    ctx.strokeStyle = typeof edgeColor === 'string' ? edgeColor : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.8;
    for (const [a, b] of this._edges) {
      ctx.beginPath(); ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); ctx.stroke();
    }
    pts.forEach((p, i) => {
      ctx.fillStyle = typeof vertexColor === 'function' ? vertexColor(i) : vertexColor;
      ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(2, Math.min(6, 200 / this.params.n)), 0, Math.PI * 2); ctx.fill();
    });
    return pts;
  }

  _renderPhaseTransition(ctx, W, H) {
    const leftW = W * 0.52;
    const largest = Math.max(...this._comps.map(c => c.length));
    const giantComp = this._comps.find(c => c.length === largest);
    const giantSet = new Set(giantComp);
    this._drawGraph(ctx, W, H, leftW / 2, H * 0.42, Math.min(leftW, H) * 0.35,
      i => giantSet.has(i) && giantComp.length > 1 ? '#c42020' : '#1a4fa8', 'rgba(0,0,0,0.12)');
    label(ctx, `n=${this.params.n}  c=${this.params.avgDeg.toFixed(2)}  largest component: ${largest} (${(100 * largest / this.params.n).toFixed(0)}%)`, 8, 8, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.9)' });

    // Right: accumulated history plot
    const gx = leftW + 20, gy = 40, gw = W - leftW - 40, gh = H - 100;
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.stroke();
    const tx = c => gx + (c / 4) * gw, ty = f => gy + gh - f * gh;
    // Threshold line
    ctx.strokeStyle = 'rgba(196,32,32,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(tx(1), gy); ctx.lineTo(tx(1), gy + gh); ctx.stroke(); ctx.setLineDash([]);
    label(ctx, 'c=1 (threshold)', tx(1) + 4, gy + 4, { color: '#c42020', size: 9 });
    // History dots
    ctx.fillStyle = 'rgba(26,79,168,0.5)';
    for (const h of this._history) { ctx.beginPath(); ctx.arc(tx(h.c), ty(h.frac), 2, 0, Math.PI * 2); ctx.fill(); }
    // Current point
    ctx.fillStyle = '#c42020';
    ctx.beginPath(); ctx.arc(tx(this.params.avgDeg), ty(largest / this.params.n), 5, 0, Math.PI * 2); ctx.fill();
    label(ctx, 'largest component / n', gx, gy - 10, { color: '#555', size: 10 });
    label(ctx, 'c = np (average degree)', gx + gw / 2 - 60, gy + gh + 16, { color: '#555', size: 10 });
    if (!this.params.autoSweep) label(ctx, 'Enable "Auto-sweep c" to trace the full curve', gx, gy + gh + 32, { color: '#888', size: 9 });
  }

  _renderSpectral(ctx, W, H) {
    if (!this._eigen) this._computeSpectral();
    const { values, vectors } = this._eigen;
    const leftW = W * 0.55;
    // Spectral layout using eigenvectors 2 and 3 (1-indexed: skip the trivial zero mode)
    const v2 = vectors[1] || vectors[0], v3 = vectors[2] || vectors[0];
    const xs = v2, ys = v3;
    const maxAbs = Math.max(...xs.map(Math.abs), ...ys.map(Math.abs), 1e-6);
    const cx = leftW / 2, cy = H / 2, scale = Math.min(leftW, H) * 0.4 / maxAbs;
    const pts = xs.map((x, i) => [cx + x * scale, cy + ys[i] * scale]);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.8;
    for (const [a, b] of this._edges) { ctx.beginPath(); ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); ctx.stroke(); }
    pts.forEach(p => { ctx.fillStyle = '#1a4fa8'; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill(); });
    label(ctx, 'Spectral layout: position = (eigenvector\u2082, eigenvector\u2083)', 8, 8, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.9)' });

    // Right: eigenvalue spectrum
    const gx = leftW + 20, gy = 30, gw = W - leftW - 40, gh = H - 80;
    const maxV = Math.max(...values, 1e-6);
    const bw = gw / values.length;
    values.forEach((val, i) => {
      const h = (val / maxV) * gh;
      ctx.fillStyle = i === 0 ? '#888' : i === 1 ? '#c42020' : 'rgba(26,79,168,0.6)';
      ctx.fillRect(gx + i * bw, gy + gh - h, Math.max(1, bw - 1), h);
    });
    label(ctx, 'Laplacian eigenvalues \u03bb\u2081\u2264\u03bb\u2082\u2264\u2026', gx, gy - 12, { color: '#555', size: 10 });
    label(ctx, `# zero eigenvalues (\u2248components): ${values.filter(v => v < 1e-6).length}`, gx, gy + gh + 14, { color: '#888', size: 10 });
    label(ctx, `\u03bb\u2082 (Fiedler value) = ${values[1]?.toFixed(4) ?? '-'}`, gx, gy + gh + 30, { color: '#c42020', size: 10 });
  }

  _renderColoring(ctx, W, H) {
    if (!this._coloring) this._computeColoring();
    const cols = ['#c42020', '#1a4fa8', '#1a6b1a', '#a05000', '#6020a0', '#1a7a7a', '#884400', '#008888', '#c48000', '#800040'];
    this._drawGraph(ctx, W, H, W / 2, H / 2 + 10, Math.min(W, H) * 0.4, i => cols[this._coloring[i] % cols.length], 'rgba(0,0,0,0.15)');
    label(ctx, `Greedy coloring used ${this._numColors} colors (n=${this.params.n}, ${this._edges.length} edges)`, 8, 8, { color: '#333', size: 12, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, 'True chromatic number \u03c7(G) \u2264 this value \u2014 greedy is an upper bound, not always optimal', 8, 26, { color: '#666', size: 10, bg: 'rgba(255,255,255,0.86)' });
  }

  coordInfo() { return `${this.params.n} vertices, ${this._edges.length} edges`; }
}
