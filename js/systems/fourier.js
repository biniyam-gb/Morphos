
// Fourier Analysis — DFT epicycles + spectrum
import { clearCanvas, label } from '../plot.js';

// Closed curve definitions, sampled as complex z[n] = x[n] + i*y[n]
const SHAPES = {
  'Heart':       t => ({ x: 16*Math.pow(Math.sin(t),3)/16, y: (13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/16 }),
  'Circle':      t => ({ x: Math.cos(t), y: Math.sin(t) }),
  'Square':      t => { const s=t/(Math.PI/2); const q=s%1; const f=Math.floor(s)%4; const corners=[[1,-1],[1,1],[-1,1],[-1,-1]]; const next=corners[(f+1)%4]; const cur=corners[f]; return {x:cur[0]+(next[0]-cur[0])*q, y:cur[1]+(next[1]-cur[1])*q}; },
  'Star (5)':    t => { const r=1+0.5*Math.cos(5*t); return {x:r*Math.cos(t), y:r*Math.sin(t)}; },
  'Trefoil':     t => { const r=Math.cos(3*t)+1.5; return {x:r*Math.cos(t)*0.5, y:r*Math.sin(t)*0.5}; },
  'Lissajous':   t => ({ x: Math.sin(3*t+Math.PI/4), y: Math.sin(2*t) }),
  'Infinity':    t => ({ x: Math.cos(t)/(1+Math.sin(t)*Math.sin(t)), y: Math.sin(t)*Math.cos(t)/(1+Math.sin(t)*Math.sin(t)) }),
  'Butterfly':   t => { const e=Math.exp(Math.cos(t))-2*Math.cos(4*t)-Math.pow(Math.sin(t/12),5); return {x:Math.sin(t)*e*0.35, y:-Math.cos(t)*e*0.35}; },
  'Hypotrochoid': t => ({ x: (2*Math.cos(t) + 3*Math.cos(t*2/3))*0.25, y: (2*Math.sin(t) - 3*Math.sin(t*2/3))*0.25 }),
};

function computeDFT(pts) {
  const N = pts.length;
  const out = [];
  for (let k = 0; k < N; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const angle = 2 * Math.PI * k * n / N;
      re += pts[n].x * Math.cos(angle) + pts[n].y * Math.sin(angle);
      im += pts[n].y * Math.cos(angle) - pts[n].x * Math.sin(angle);
    }
    re /= N; im /= N;
    // Map k to frequency: k < N/2 → positive freq; k >= N/2 → negative freq
    const freq = k <= N / 2 ? k : k - N;
    out.push({ freq, re, im, amp: Math.sqrt(re*re + im*im), phase: Math.atan2(im, re) });
  }
  // Sort by amplitude descending
  return out.sort((a, b) => b.amp - a.amp);
}

export class FourierAnalysis {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params  = { shape: 'Heart', numTerms: 40, speed: 0.25, showCircles: true, showSpectrum: true, drawMode: false };
    this.paramDefs = [
      { group: 'Shape', items: [
        { id: 'shape',    label: 'Preset curve',   type: 'select', options: Object.keys(SHAPES) },
        { id: 'drawMode', label: 'Draw custom path', type: 'toggle', tip: 'Click & drag to draw a closed curve, then release.' },
        { id: 'numTerms', label: 'Epicycles (N)', min: 1, max: 120, step: 1, type: 'range', tip: 'Number of rotating circles. More = more detail.' },
      ]},
      { group: 'Display', items: [
        { id: 'showCircles',  label: 'Show circles',  type: 'toggle' },
        { id: 'showSpectrum', label: 'Show spectrum', type: 'toggle', tip: 'Bar chart of Fourier coefficients by amplitude.' },
        { id: 'speed', label: 'Speed', min: 0.03, max: 2.0, step: 0.02, type: 'range', tip: '0.03 = very slow, 1.0 = one cycle per ~4 seconds' },
      ]},
    ];
    this.presets = Object.keys(SHAPES).map(k => ({ id: k, name: k, params: { shape: k, drawMode: false } }));
    this.domain      = 'Fourier Analysis';
    this.description = 'Any closed curve = sum of rotating circles (epicycles). The DFT finds each circle\'s radius and speed. N=1: one circle (approximation). N=all: exact reproduction.';
    this.stepsPerFrame = 1;
    this._coeffs = [];
    this._phase  = 0;   // animation phase 0..2π
    this._path   = [];  // traced tip positions
    this._drawn  = [];  // user-drawn path (canvas coords)
    this._isDrawing = false;
    this._sampleShape(this.params.shape);
  }

  _sampleShape(name) {
    const fn = SHAPES[name]; if (!fn) return;
    const N = 256;
    const pts = Array.from({ length: N }, (_, i) => fn(i / N * 2 * Math.PI));
    this._coeffs = computeDFT(pts);
    this._phase  = 0;
    this._path   = [];
  }

  _sampleDrawn() {
    if (this._drawn.length < 8) return;
    const W = this.canvasW, H = this.canvasH;
    const cx = W / 2, cy = H / 2, sc = Math.min(W, H) * 0.38;
    // Resample to 256 evenly-spaced points by arc length
    const total = this._drawn.reduce((s, p, i) => {
      if (i === 0) return 0;
      return s + Math.hypot(p.x - this._drawn[i-1].x, p.y - this._drawn[i-1].y);
    }, 0);
    const step = total / 256;
    const pts = []; let acc = 0, di = 1;
    pts.push({ x: (this._drawn[0].x - cx) / sc, y: -(this._drawn[0].y - cy) / sc });
    for (let n = 1; n < 256; n++) {
      const target = n * step;
      while (di < this._drawn.length - 1 && acc + Math.hypot(this._drawn[di].x - this._drawn[di-1].x, this._drawn[di].y - this._drawn[di-1].y) < target) {
        acc += Math.hypot(this._drawn[di].x - this._drawn[di-1].x, this._drawn[di].y - this._drawn[di-1].y);
        di++;
      }
      const t = Math.min(1, (target - acc) / (Math.hypot(this._drawn[di].x - this._drawn[di-1].x, this._drawn[di].y - this._drawn[di-1].y) || 1));
      pts.push({
        x:  (this._drawn[di-1].x + t * (this._drawn[di].x - this._drawn[di-1].x) - cx) / sc,
        y: -(this._drawn[di-1].y + t * (this._drawn[di].y - this._drawn[di-1].y) - cy) / sc,
      });
    }
    this._coeffs = computeDFT(pts);
    this._phase  = 0;
    this._path   = [];
  }

  getFormula() { return `f(t) = Σ cₙ e^{2πint}   N=${this.params.numTerms} terms`; }

  reset() { this._phase = 0; this._path = []; if (!this.params.drawMode) this._sampleShape(this.params.shape); }

  onParamChange(id) {
    if (id === 'shape' && !this.params.drawMode) this._sampleShape(this.params.shape);
    if (id === '_preset') { this.params.drawMode = false; this._sampleShape(this.params.shape); }
    this._path = [];
  }

  // Drawing mode
  onMouseDown(cx, cy) {
    if (!this.params.drawMode) return;
    this._isDrawing = true; this._drawn = [{ x: cx, y: cy }];
  }
  onMouseDrag(ddx, ddy, cx, cy) {
    if (!this.params.drawMode || !this._isDrawing) return;
    const last = this._drawn[this._drawn.length - 1];
    if (Math.hypot(cx - last.x, cy - last.y) > 5) this._drawn.push({ x: cx, y: cy });
  }
  onMouseUp() {
    if (!this._isDrawing) return;
    this._isDrawing = false;
    if (this._drawn.length > 16) this._sampleDrawn();
  }

  update() {
    if (this._isDrawing || !this._coeffs.length) return;
    // Advance by (speed / 60) of a full cycle per frame
    this._phase += (this.params.speed / 60) * 2 * Math.PI;
    if (this._phase > 2 * Math.PI) {
      this._phase -= 2 * Math.PI;
      this._path = []; // reset trace on each full cycle
    }
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');

    // Show drawing in progress
    if (this._isDrawing && this._drawn.length > 1) {
      ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(this._drawn[0].x, this._drawn[0].y);
      for (let i = 1; i < this._drawn.length; i++) ctx.lineTo(this._drawn[i].x, this._drawn[i].y);
      ctx.stroke();
      label(ctx, 'Drawing... release to compute DFT', 8, 8, { color: '#888', size: 12 });
      return;
    }

    if (!this._coeffs.length) return;

    const cx0 = W / 2, cy0 = H / 2;
    const sc  = Math.min(W, H) * 0.38;
    const N   = Math.min(this.params.numTerms, this._coeffs.length);
    const t   = this._phase;

    // Compute epicycle tip positions
    let x = cx0, y = cy0;
    const tips = [{ x, y }];
    for (let i = 0; i < N; i++) {
      const c = this._coeffs[i];
      const angle = 2 * Math.PI * c.freq * t / (2 * Math.PI) + c.phase;
      // Correctly: phase = freq * t + phase_offset
      // t goes 0..2π, so one full cycle of freq=1 needs t=0..2π
      const a = c.freq * t + c.phase;
      const r = c.amp * sc;
      const nx = x + r * Math.cos(a);
      const ny = y - r * Math.sin(a); // canvas y inverted

      // Draw circle and spoke
      if (this.params.showCircles && r > 0.5) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(60,60,180,0.5)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
        ctx.restore();
      }
      x = nx; y = ny;
      tips.push({ x, y });
    }

    // Record tip and draw trace
    this._path.push({ x, y });

    if (this._path.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#c42020'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this._path[0].x, this._path[0].y);
      for (let i = 1; i < this._path.length; i++) ctx.lineTo(this._path[i].x, this._path[i].y);
      ctx.stroke();
      ctx.restore();
    }

    // Tip dot
    ctx.fillStyle = '#c42020';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();

    // Spectrum panel
    if (this.params.showSpectrum) {
      const panW = 180, panH = 70, panX = W - panW - 10, panY = 10;
      ctx.save();
      ctx.fillStyle = 'rgba(248,245,240,0.95)';
      ctx.fillRect(panX, panY, panW, panH + 18);
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
      ctx.strokeRect(panX, panY, panW, panH + 18);
      const show = this._coeffs.slice(0, Math.min(36, this._coeffs.length));
      const maxAmp = show[0]?.amp || 1;
      const bw = panW / show.length;
      for (let i = 0; i < show.length; i++) {
        const h = (show[i].amp / maxAmp) * panH;
        ctx.fillStyle = i < N ? '#1a4fa8' : '#ddd';
        ctx.fillRect(panX + i * bw, panY + panH - h, Math.max(1, bw - 1), h);
      }
      ctx.fillStyle = '#555'; ctx.font = '10px Courier New'; ctx.textAlign = 'left';
      ctx.fillText(`Spectrum — top ${show.length} amplitudes`, panX + 3, panY + panH + 4);
      ctx.restore();
    }

    // Progress arc
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(18, 18, 12, -Math.PI/2, -Math.PI/2 + t); ctx.stroke();
    ctx.strokeStyle = '#c42020'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(18, 18, 12, -Math.PI/2, -Math.PI/2 + t); ctx.stroke();
    ctx.restore();

    label(ctx, `N=${N} circles  |  ${((t / (2*Math.PI))*100).toFixed(0)}%`, 36, 10, { color: '#555', size: 11 });
    if (this.params.drawMode) {
      label(ctx, 'Draw mode: click & drag to draw a closed curve', 8, H - 18, { color: '#888', size: 10 });
    } else {
      label(ctx, this.params.shape, 8, H - 18, { color: '#aaa', size: 10 });
    }
  }

  coordInfo() { return `N=${this.params.numTerms} terms  |  phase=${((this._phase / (2*Math.PI))*100).toFixed(1)}%`; }
}
