// Iterated Function Systems -- the "chaos game": repeatedly apply a
// randomly-chosen affine map (weighted by probability) to a point. The
// resulting orbit converges to the IFS attractor. A fundamentally
// different fractal-generation paradigm from L-systems (probabilistic
// iteration vs. deterministic string rewriting) or escape-time fractals.
import { clearCanvas, label, Viewport } from '../plot.js';
import { sampleCM } from '../colormap.js';

const IFS_PRESETS = {
  'Barnsley Fern': {
    // Standard published coefficients (Barnsley, "Fractals Everywhere", 1988)
    t: [
      { a: 0,    b: 0,    c: 0,    d: 0.16, e: 0,    f: 0,    p: 0.01 },
      { a: 0.85, b: 0.04, c: -0.04,d: 0.85, e: 0,    f: 1.6,  p: 0.85 },
      { a: 0.2,  b: -0.26,c: 0.23, d: 0.22, e: 0,    f: 1.6,  p: 0.07 },
      { a: -0.15,b: 0.28, c: 0.26, d: 0.24, e: 0,    f: 0.44, p: 0.07 },
    ],
    bounds: [-3, 3, 0, 10.5],
    desc: 'The classic Barnsley fern. Four affine maps, weighted by probability: one draws the stem, one shrinks the whole frond (self-similarity), two draw left/right leaflets.',
  },
  'Sierpinski Triangle': {
    t: [
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0,    f: 0,        p: 1/3 },
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0.5,  f: 0,        p: 1/3 },
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0.25, f: 0.4330127, p: 1/3 },
      { a: 0,   b: 0, c: 0, d: 0,   e: 0,    f: 0,        p: 0 },
    ],
    bounds: [-0.1, 1.1, -0.1, 1.0],
    desc: 'Three half-scale copies, each shrinking toward a vertex of the triangle. Same attractor as the deterministic Sierpinski gasket, reached here by pure chance.',
  },
  'Sierpinski Carpet-ish': {
    t: [
      { a: 1/3, b: 0, c: 0, d: 1/3, e: 0,    f: 0,    p: 0.125 },
      { a: 1/3, b: 0, c: 0, d: 1/3, e: 1/3,  f: 0,    p: 0.125 },
      { a: 1/3, b: 0, c: 0, d: 1/3, e: 2/3,  f: 0,    p: 0.125 },
      { a: 1/3, b: 0, c: 0, d: 1/3, e: 0,    f: 1/3,  p: 0.125 },
    ],
    bounds: [-0.1, 1.1, -0.1, 1.1],
    desc: 'A 4-map approximation using corner/edge translates at scale 1/3 (the true carpet uses 8 maps -- try building it yourself by adding the missing edge and corner copies!).',
  },
  'Dragon-like': {
    t: [
      { a: 0.5, b: -0.5, c: 0.5, d: 0.5, e: 0, f: 0, p: 0.5 },
      { a: -0.5,b: -0.5, c: 0.5, d: -0.5,e: 1, f: 0, p: 0.5 },
      { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, p: 0 },
      { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, p: 0 },
    ],
    bounds: [-1.2, 1.8, -1.2, 1.2],
    desc: 'Two contracting-rotating similarity maps. Self-similar boundary curve in the style of the Heighway dragon.',
  },
  'Spiral Whorl': {
    t: [
      { a: 0.7*Math.cos(2.4), b: -0.7*Math.sin(2.4), c: 0.7*Math.sin(2.4), d: 0.7*Math.cos(2.4), e: 0.3, f: 0, p: 0.6 },
      { a: 0.5, b: 0, c: 0, d: 0.5, e: -0.3, f: 0.4, p: 0.4 },
      { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, p: 0 },
      { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, p: 0 },
    ],
    bounds: [-1.5, 1.5, -1.5, 1.5],
    desc: 'A rotation-heavy map (large off-diagonal terms) produces a spiral/whorl attractor rather than a self-similar "cutout" shape.',
  },
  'Custom (edit below)': {
    t: [
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0,   f: 0,   p: 0.34 },
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0.5, f: 0,   p: 0.33 },
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0.25,f: 0.43,p: 0.33 },
      { a: 0,   b: 0, c: 0, d: 0,   e: 0,   f: 0,   p: 0 },
    ],
    bounds: [-0.1, 1.1, -0.1, 1.0],
    desc: 'Edit all four transforms\u2019 coefficients freely. Set a transform\u2019s probability to 0 to disable it.',
  },
};

export class IteratedFunctionSystem {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = { preset: 'Barnsley Fern', colormap: 'viridis', colorBy: 'transform', pointsPerFrame: 4000, maxPoints: 300000 };
    for (let i = 1; i <= 4; i++) for (const k of ['a','b','c','d','e','f','p']) this.params[`T${i}_${k}`] = 0;
    this.paramDefs = [
      { group: 'Preset', items: [
        { id: 'preset', label: 'Attractor', type: 'select', options: Object.keys(IFS_PRESETS) },
      ]},
      { group: 'Display', items: [
        { id: 'colormap', label: 'Color map', type: 'colormap' },
        { id: 'colorBy', label: 'Color by', type: 'select', options: ['transform', 'density', 'iteration'] },
        { id: 'pointsPerFrame', label: 'Points/frame', min: 200, max: 20000, step: 200, type: 'range' },
      ]},
      ...[1, 2, 3, 4].map(i => ({
        group: `Transform ${i}: w(x,y) = (ax+by+e, cx+dy+f)`,
        items: [
          { id: `T${i}_a`, label: 'a', min: -1.2, max: 1.2, step: 0.01, type: 'range' },
          { id: `T${i}_b`, label: 'b', min: -1.2, max: 1.2, step: 0.01, type: 'range' },
          { id: `T${i}_c`, label: 'c', min: -1.2, max: 1.2, step: 0.01, type: 'range' },
          { id: `T${i}_d`, label: 'd', min: -1.2, max: 1.2, step: 0.01, type: 'range' },
          { id: `T${i}_e`, label: 'e (translate x)', min: -2, max: 2, step: 0.02, type: 'range' },
          { id: `T${i}_f`, label: 'f (translate y)', min: -2, max: 2, step: 0.02, type: 'range' },
          { id: `T${i}_p`, label: 'probability p', min: 0, max: 1, step: 0.01, type: 'range', tip: 'Set to 0 to disable this transform.' },
        ],
      })),
    ];
    this.presets = Object.keys(IFS_PRESETS).map(k => ({ id: k, name: k, params: { preset: k } }));
    this.domain = 'Fractal Geometry';
    this.stepsPerFrame = 1;
    this._loadPreset('Barnsley Fern');
  }

  _loadPreset(name) {
    const p = IFS_PRESETS[name]; if (!p) return;
    p.t.forEach((tr, i) => { for (const k of ['a','b','c','d','e','f','p']) this.params[`T${i+1}_${k}`] = tr[k]; });
    this._bounds = p.bounds;
    this.description = p.desc;
    this._reset();
  }

  _transforms() {
    const ts = [];
    for (let i = 1; i <= 4; i++) {
      const t = { a: this.params[`T${i}_a`], b: this.params[`T${i}_b`], c: this.params[`T${i}_c`], d: this.params[`T${i}_d`], e: this.params[`T${i}_e`], f: this.params[`T${i}_f`], p: this.params[`T${i}_p`] };
      if (t.p > 0) ts.push(t);
    }
    return ts;
  }

  getFormula() { return `w\u1d62(x,y) = (a\u1d62x+b\u1d62y+e\u1d62, c\u1d62x+d\u1d62y+f\u1d62), chosen with probability p\u1d62`; }

  _reset() {
    this._x = 0; this._y = 0;
    this._points = [];
    this._iter = 0;
    this._warmup = 20;
    this._dataBounds = null;   // computed live from actual generated points
  }
  reset() { this._reset(); }

  onParamChange(id) {
    if (id === 'preset' || id === '_preset') { this._loadPreset(this.params.preset); return; }
    this._reset();
  }

  update() {
    const ts = this._transforms();
    if (!ts.length) return;
    const totalP = ts.reduce((s, t) => s + t.p, 0) || 1;
    const N = Math.round(this.params.pointsPerFrame);
    for (let i = 0; i < N; i++) {
      let r = Math.random() * totalP, chosen = ts[0];
      for (const t of ts) { if (r < t.p) { chosen = t; break; } r -= t.p; }
      const nx = chosen.a * this._x + chosen.b * this._y + chosen.e;
      const ny = chosen.c * this._x + chosen.d * this._y + chosen.f;
      // Guard against a non-contractive custom transform sending the orbit
      // to infinity -- without this, a single bad slider edit can leave
      // the attractor permanently unrecoverable until Reset is pressed.
      if (!isFinite(nx) || !isFinite(ny) || Math.abs(nx) > 1e6 || Math.abs(ny) > 1e6) {
        this._x = 0; this._y = 0; continue;
      }
      this._x = nx; this._y = ny;
      this._iter++;
      if (this._iter > this._warmup) {
        this._points.push({ x: nx, y: ny, iter: this._iter, tIdx: ts.indexOf(chosen) });
        if (!this._dataBounds) {
          this._dataBounds = { xMin: nx, xMax: nx, yMin: ny, yMax: ny };
        } else {
          const b = this._dataBounds;
          if (nx < b.xMin) b.xMin = nx; if (nx > b.xMax) b.xMax = nx;
          if (ny < b.yMin) b.yMin = ny; if (ny > b.yMax) b.yMax = ny;
        }
      }
    }
    if (this._points.length > this.params.maxPoints) this._points.splice(0, this._points.length - this.params.maxPoints);
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    if (!this._points.length) { label(ctx, 'Adjust transforms with nonzero probability to begin', 20, 20, { color: '#888', size: 12 }); return; }

    // Prefer bounds measured from the actual generated points -- correct
    // by construction for ANY transform the user dials in, including
    // presets whose hardcoded bounds don't apply after editing. Only fall
    // back to preset bounds in the brief window before enough points exist.
    let xMin, xMax, yMin, yMax;
    if (this._dataBounds) {
      const b = this._dataBounds;
      const padX = Math.max((b.xMax - b.xMin) * 0.06, 0.05);
      const padY = Math.max((b.yMax - b.yMin) * 0.06, 0.05);
      xMin = b.xMin - padX; xMax = b.xMax + padX;
      yMin = b.yMin - padY; yMax = b.yMax + padY;
    } else {
      [xMin, xMax, yMin, yMax] = this._bounds || [-2, 2, -2, 2];
    }
    const vp = new Viewport(xMin, xMax, yMin, yMax);

    const cm = this.params.colormap, mode = this.params.colorBy;
    const maxIter = this._points[this._points.length - 1]?.iter || 1;
    const tCols = ['#c42020', '#1a4fa8', '#1a6b1a', '#a05000'];

    if (mode === 'density') {
      const binsW = 300, binsH = 300;
      const hist = new Float32Array(binsW * binsH);
      for (const p of this._points) {
        const [cx, cy] = vp.toCanvas(p.x, p.y, binsW, binsH);
        const px = Math.floor(cx), py = Math.floor(cy);
        if (px >= 0 && px < binsW && py >= 0 && py < binsH) hist[py * binsW + px]++;
      }
      const maxH = Math.max(...hist, 1);
      const imgd = ctx.createImageData(binsW, binsH);
      for (let i = 0; i < binsW * binsH; i++) {
        if (!hist[i]) { imgd.data[i*4+3] = 0; continue; }
        const t = Math.sqrt(hist[i] / maxH);
        const [r, g, b] = sampleCM(cm, t);
        imgd.data[i*4]=r; imgd.data[i*4+1]=g; imgd.data[i*4+2]=b; imgd.data[i*4+3]=255;
      }
      const tmp = document.createElement('canvas'); tmp.width = binsW; tmp.height = binsH;
      tmp.getContext('2d').putImageData(imgd, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmp, 0, 0, W, H);
    } else {
      for (const p of this._points) {
        const [px, py] = vp.toCanvas(p.x, p.y, W, H);
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        if (mode === 'transform') ctx.fillStyle = tCols[p.tIdx % tCols.length];
        else { const [r,g,b] = sampleCM(cm, p.iter / maxIter); ctx.fillStyle = `rgb(${r},${g},${b})`; }
        ctx.fillRect(px, py, 1, 1);
      }
    }

    label(ctx, `${this._points.length.toLocaleString()} points, ${this._transforms().length} active transforms`, 8, 8, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.88)' });
  }

  coordInfo() { return `${this._points.length.toLocaleString()} points plotted`; }
}
