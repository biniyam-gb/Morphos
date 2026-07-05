
import { Viewport, clearCanvas, label } from '../plot.js';
import { sampleCM } from '../colormap.js';

export class Fractal {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.vp = new Viewport(-2.5, 1.0, -1.75, 1.75);
    this.params = { type: 'mandelbrot', maxIter: 200, cx: -0.7269, cy: 0.1889, colormap: 'inferno', smooth: true, animJulia: false };
    this.paramDefs = [
      { group: 'Type', items: [
        { id: 'type',    label: 'Fractal', type: 'select', options: ['mandelbrot','julia','burning-ship','tricorn','newton','z^3+c'],
          tip: 'Click to zoom in. Double-click for 4x zoom.' },
        { id: 'maxIter', label: 'Max iterations', min: 32, max: 800, step: 8, type: 'range' },
        { id: 'smooth',  label: 'Smooth coloring', type: 'toggle' },
        { id: 'colormap',label: 'Color map', type: 'colormap' },
      ]},
      { group: 'Julia c parameter', items: [
        { id: 'cx',        label: 'c  real', min: -2, max: 2, step: 0.001, type: 'range' },
        { id: 'cy',        label: 'c  imag', min: -2, max: 2, step: 0.001, type: 'range' },
        { id: 'animJulia', label: 'Animate c (orbit)', type: 'toggle' },
      ]},
      { group: 'Navigation', items: [
        { id: '_zin',   label: 'Zoom In (×2)',   type: 'button' },
        { id: '_zout',  label: 'Zoom Out (×2)',  type: 'button' },
        { id: '_reset', label: 'Reset View',     type: 'button' },
      ]},
    ];
    this.presets = [
      { id: 'm0', name: 'Mandelbrot',         params: { type:'mandelbrot', maxIter:200, colormap:'inferno', animJulia:false } },
      { id: 'm1', name: 'Mandelbrot (deep)',  params: { type:'mandelbrot', maxIter:800, colormap:'plasma',  animJulia:false } },
      { id: 'j1', name: 'Julia – Douady',     params: { type:'julia', cx:-0.1226, cy:0.7449, colormap:'magma'   } },
      { id: 'j2', name: 'Julia – San Marco',  params: { type:'julia', cx:-0.7269, cy:0.1889, colormap:'viridis' } },
      { id: 'j3', name: 'Julia – Spiral',     params: { type:'julia', cx:0.285,   cy:0.01,   colormap:'hot'     } },
      { id: 'j4', name: 'Julia (animated c)', params: { type:'julia', animJulia:true, colormap:'plasma' } },
      { id: 'bs', name: 'Burning Ship',       params: { type:'burning-ship', colormap:'inferno' } },
      { id: 'n0', name: 'Newton (z³−1)',       params: { type:'newton', maxIter:64, colormap:'spectral' } },
    ];
    this.domain = 'Fractal Geometry';
    this.description = 'Escape-time fractals. Mandelbrot: z→z²+c, z₀=0. Julia: z→z²+c, z₀=pixel. Click=zoom. Double-click=deep zoom.';
    this._animT = 0;
    this._needsRender = true;
  }

  get stepsPerFrame() { return this.params.animJulia ? 1 : 0; }

  getFormula() {
    const m = { mandelbrot:'z → z²+c  (z₀=0, c=pixel)', julia:'z → z²+c  (c fixed, z₀=pixel)', 'burning-ship':'z → (|Re z|+i|Im z|)²+c', tricorn:'z → z̄²+c', newton:'Newton for z³−1=0', 'z^3+c':'z → z³+c' };
    return m[this.params.type] || this.params.type;
  }

  reset() { this.vp = new Viewport(-2.5,1.0,-1.75,1.75); this._needsRender = true; }

  onParamChange(id) {
    if (id === '_zin')    this.vp.zoom(0.5, this.canvasW/2, this.canvasH/2, this.canvasW, this.canvasH);
    if (id === '_zout')   this.vp.zoom(2.0, this.canvasW/2, this.canvasH/2, this.canvasW, this.canvasH);
    if (id === '_reset')  this.reset();
    this._needsRender = true;
  }

  onClick(cx, cy, W, H) { this.vp.zoom(0.5, cx, cy, W, H); this._needsRender = true; }
  onDblClick(cx, cy, W, H) { this.vp.zoom(0.25, cx, cy, W, H); this._needsRender = true; }
  onMouseDrag(ddx, ddy, cx, cy, W, H) { this.vp.pan(ddx, ddy, W, H); this._needsRender = true; }
  onWheel(cx, cy, delta, W, H) { this.vp.zoom(delta > 0 ? 1.3 : 0.77, cx, cy, W, H); this._needsRender = true; }

  update() {
    if (this.params.animJulia) {
      this._animT += 0.02;
      this.params.cx = 0.7885 * Math.cos(this._animT);
      this.params.cy = 0.7885 * Math.sin(this._animT);
      this._needsRender = true;
    }
  }

  _iterate(type, re, im, cre, cim, maxIter, smooth) {
    if (type === 'newton') return this._newton(re, im, maxIter);
    let zr = type === 'julia' ? re : 0;
    let zi = type === 'julia' ? im : 0;
    const cr = type === 'julia' ? cre : re;
    const ci = type === 'julia' ? cim : im;
    for (let n = 0; n < maxIter; n++) {
      let nr, ni;
      if (type === 'burning-ship') { nr = zr*zr-zi*zi+cr; ni = 2*Math.abs(zr*zi)+ci; }
      else if (type === 'tricorn') { nr = zr*zr-zi*zi+cr; ni = -2*zr*zi+ci; }
      else if (type === 'z^3+c')   { nr = zr*(zr*zr-3*zi*zi)+cr; ni = zi*(3*zr*zr-zi*zi)+ci; }
      else                          { nr = zr*zr-zi*zi+cr; ni = 2*zr*zi+ci; }
      zr = nr; zi = ni;
      const r2 = zr*zr + zi*zi;
      if (r2 > 65536) {
        return smooth ? n - Math.log2(Math.log2(r2)) : n;
      }
    }
    return -1;
  }

  _newton(zr, zi, maxIter) {
    const roots = [[1,0],[-0.5,0.866025],[-0.5,-0.866025]];
    for (let n = 0; n < maxIter; n++) {
      const z3r = zr*(zr*zr-3*zi*zi), z3i = zi*(3*zr*zr-zi*zi);
      const z2r = zr*zr-zi*zi, z2i = 2*zr*zi;
      const d = 3*(z2r*z2r+z2i*z2i); if (d < 1e-14) return -1;
      const nr = zr - ((z3r-1)*z2r+z3i*z2i)/d;
      const ni = zi - (z3i*z2r-(z3r-1)*z2i)/d;
      for (let k = 0; k < 3; k++) {
        const dr=nr-roots[k][0], di=ni-roots[k][1];
        if (dr*dr+di*di < 1e-8) return k/3 + n/maxIter*0.33;
      }
      zr = nr; zi = ni;
    }
    return -1;
  }

  render(ctx, canvas) {
    if (!this._needsRender) return;
    this._needsRender = false;
    const W = canvas.width, H = canvas.height;
    // Render at 75% resolution, then scale up
    const rW = Math.floor(W * 0.75), rH = Math.floor(H * 0.75);
    const { type, maxIter, cx, cy, smooth, colormap } = this.params;
    const vp = this.vp;
    const imgd = ctx.createImageData(rW, rH);
    const data = imgd.data;
    for (let py = 0; py < rH; py++) {
      for (let px = 0; px < rW; px++) {
        // Map render pixel → canvas pixel → world
        const [re, im] = vp.toWorld(px * W / rW, py * H / rH, W, H);
        const v = this._iterate(type, re, im, cx, cy, maxIter, smooth);
        let r = 0, g = 0, b = 0;
        if (v >= 0) {
          const t = (v % maxIter) / maxIter;
          [r,g,b] = sampleCM(colormap, t);
        }
        const p = (py * rW + px) * 4;
        data[p]=r; data[p+1]=g; data[p+2]=b; data[p+3]=255;
      }
    }
    // Blit to offscreen, then scale to canvas
    const tmp = document.createElement('canvas');
    tmp.width = rW; tmp.height = rH;
    tmp.getContext('2d').putImageData(imgd, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tmp, 0, 0, W, H);
    // Overlay text
    label(ctx, this.getFormula(), 8, 8, { color:'rgba(255,255,255,0.92)', size:11, bg:'rgba(0,0,0,0.4)' });
    if (type === 'julia') {
      label(ctx, `c = ${cx.toFixed(4)} + ${cy.toFixed(4)}i`, 8, 26, { color:'rgba(255,255,255,0.85)', size:10, bg:'rgba(0,0,0,0.35)' });
    }
    const zoom = (3.5 / vp.width()).toFixed(2);
    label(ctx, `zoom ${zoom}×  |  click=zoom  dblclick=4×  drag=pan`, 8, H-18, { color:'rgba(255,255,255,0.65)', size:10 });
  }

  coordInfo(cx, cy, W, H) {
    const [re, im] = this.vp.toWorld(cx, cy, W, H);
    return `z = ${re.toFixed(6)} + ${im.toFixed(6)}i`;
  }
}
