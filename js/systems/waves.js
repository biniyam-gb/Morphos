
// Wave & Heat Equations — PDE finite-difference solvers
import { clearCanvas, label } from '../plot.js';
import { sampleCM } from '../colormap.js';

const MATH=`"use strict";const{sin,cos,tan,exp,log,sqrt,abs,pow,atan,atan2,sinh,cosh,sign,floor,ceil,min,max,PI,E}=Math;const pi=PI,e=E;`;
function compileIC(expr){try{return new Function('x',MATH+`return (${expr});`);}catch(e){return null;}}

const IC_PRESETS = {
  'Plucked String':  'x<0.5 ? 2*x : 2*(1-x)',
  'Gaussian Pulse':  'exp(-50*(x-0.3)*(x-0.3))',
  'Two Pulses':      'exp(-80*(x-0.25)**2) - exp(-80*(x-0.75)**2)',
  'Sine Mode 1':     'sin(pi*x)',
  'Sine Mode 3':     'sin(3*pi*x)',
  'Sine Mode 5':     'sin(5*pi*x)',
  'Square Wave':     'abs(sin(2*pi*x)) > 0.5 ? 1 : -1',
  'Half-sine':       'x>0.2&&x<0.6 ? sin(pi*(x-0.2)/0.4) : 0',
  'Custom':          'sin(pi*x)',
};

export class Waves {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.N = 300; // spatial grid points
    this.params = {
      equation: 'wave',     // 'wave' | 'heat' | 'schrodinger' | 'kdv'
      ic: 'Plucked String',
      icExpr: IC_PRESETS['Plucked String'],
      c: 1.0,               // wave speed / diffusivity
      bc: 'fixed',          // 'fixed' | 'periodic' | 'free'
      showHistory: true,
      colormap: 'coolwarm',
      speed: 3,
      damping: 0.0,
    };
    this.paramDefs = [
      { group: 'Equation', items: [
        { id: 'equation', label: 'PDE', type: 'select',
          options: ['wave','heat','schrodinger','kdv'],
          tip: 'wave: u_tt=c²u_xx. heat: u_t=αu_xx. schrödinger: iℏψ_t=−ℏ²ψ_xx/2m+Vψ. KdV: u_t+6uu_x+u_xxx=0.' },
        { id: 'bc', label: 'Boundary conditions', type: 'select',
          options: ['fixed','periodic','free'],
          tip: 'fixed: u=0 at ends. periodic: wraps around. free: u_x=0 at ends.' },
        { id: 'c',       label: 'Speed / Diffusivity', min: 0.05, max: 3, step: 0.05, type: 'range' },
        { id: 'damping', label: 'Damping (wave)',       min: 0,    max: 0.1, step: 0.002, type: 'range' },
      ]},
      { group: 'Initial Condition u(x,0)', items: [
        { id: 'ic',     label: 'Preset',   type: 'select', options: Object.keys(IC_PRESETS) },
        { id: '_guide', type: 'hint', html: 'Variable: <code>x</code> ∈ [0,1]  |  Functions: <code>sin cos exp sqrt abs pi</code><br>Examples: <code>sin(3*pi*x)</code>, <code>exp(-50*(x-0.5)^2)</code>' },
        { id: 'icExpr', label: 'u(x,0) =', type: 'code' },
      ]},
      { group: 'Display', items: [
        { id: 'showHistory', label: 'Spacetime diagram', type: 'toggle', tip: 'Shows u(x,t) as a heatmap (x horizontal, t vertical).' },
        { id: 'colormap',    label: 'Color map',          type: 'colormap' },
        { id: 'speed',       label: 'Steps/frame', min: 1, max: 20, step: 1, type: 'range' },
      ]},
    ];
    this.presets = [
      { id: 'wave-pluck',  name: 'Wave: plucked string',   params: { equation:'wave', ic:'Plucked String',  c:1, bc:'fixed',    damping:0 } },
      { id: 'wave-gauss',  name: 'Wave: Gaussian pulse',   params: { equation:'wave', ic:'Gaussian Pulse',  c:1, bc:'periodic', damping:0 } },
      { id: 'wave-modes',  name: 'Wave: standing modes',   params: { equation:'wave', ic:'Sine Mode 3',     c:1, bc:'fixed',    damping:0 } },
      { id: 'wave-damp',   name: 'Wave: damped',           params: { equation:'wave', ic:'Plucked String',  c:1, bc:'fixed',    damping:0.04 } },
      { id: 'heat-gauss',  name: 'Heat: Gaussian diffuse', params: { equation:'heat', ic:'Gaussian Pulse',  c:0.05 } },
      { id: 'heat-square', name: 'Heat: square → smooth',  params: { equation:'heat', ic:'Square Wave',     c:0.02, bc:'periodic' } },
      { id: 'heat-two',    name: 'Heat: two pulses merge',  params: { equation:'heat', ic:'Two Pulses',     c:0.03 } },
      { id: 'schrod',      name: 'Schrödinger: free packet',params: { equation:'schrodinger', ic:'Gaussian Pulse', bc:'periodic', c:1 } },
      { id: 'kdv',         name: 'KdV: soliton',            params: { equation:'kdv', ic:'Gaussian Pulse', bc:'periodic', c:1 } },
    ];
    this.domain = 'PDEs & Mathematical Physics';
    this.description = 'Finite-difference solvers for classical PDEs. Wave equation: vibrating string, acoustics. Heat equation: diffusion, thermodynamics. Schrödinger: quantum wave packet. KdV: soliton propagation.';
    this.stepsPerFrame = 3;
    this._u = null; this._uprev = null; this._history = [];
    this._initPDE();
  }

  getFormula() {
    const m = {
      wave: 'u_tt = c²·u_xx  (wave equation, c=' + this.params.c.toFixed(2) + ')',
      heat: 'u_t = α·u_xx  (heat/diffusion, α=' + this.params.c.toFixed(3) + ')',
      schrodinger: 'iψ_t = −ψ_xx + V·ψ  (Schrödinger, dimensionless)',
      kdv: 'u_t + 6u·u_x + u_xxx = 0  (Korteweg–de Vries, solitons)',
    };
    return m[this.params.equation] || '';
  }

  _evalIC(x) {
    const f = compileIC(this.params.icExpr);
    if (!f) return 0;
    try { const v = f(x); return isFinite(v) ? v : 0; } catch(e) { return 0; }
  }

  _initPDE() {
    const N = this.N;
    this._u     = new Float64Array(N);
    this._uprev = new Float64Array(N);
    this._unext = new Float64Array(N);
    // Schrödinger: complex wavefunction [re0,im0,re1,im1,...]
    this._psiRe = new Float64Array(N);
    this._psiIm = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1);
      const v = this._evalIC(x);
      this._u[i] = v;
      this._uprev[i] = v;
      // Schrödinger: Gaussian wave packet
      const xc = 0.3, k0 = 20;
      this._psiRe[i] = Math.exp(-80*(x-xc)**2) * Math.cos(k0*x);
      this._psiIm[i] = Math.exp(-80*(x-xc)**2) * Math.sin(k0*x);
    }
    // For wave eq, uprev = u (at rest) unless we set initial velocity
    this._history = [];
    this._t = 0;
  }

  reset() { this._initPDE(); }
  onParamChange(id) {
    if (id === 'ic' || id === '_preset') this.params.icExpr = IC_PRESETS[this.params.ic] || this.params.icExpr;
    this._initPDE();
  }

  _applyBC(arr) {
    const N = arr.length;
    if (this.params.bc === 'fixed')    { arr[0] = 0; arr[N-1] = 0; }
    if (this.params.bc === 'free')     { arr[0] = arr[1]; arr[N-1] = arr[N-2]; }
    if (this.params.bc === 'periodic') { arr[0] = arr[N-2]; arr[N-1] = arr[1]; }
  }

  _stepWave() {
    const N = this.N, { c, damping } = this.params;
    const dx = 1 / (N - 1);
    const dt = 0.4 * dx / Math.max(c, 0.001); // CFL condition r ≤ 0.5
    const r = c * dt / dx;
    const r2 = r * r;
    const d = 1 / (1 + damping * dt);
    const u = this._u, up = this._uprev, un = this._unext;
    for (let i = 1; i < N - 1; i++) {
      un[i] = d * (2*u[i] - up[i]*(1-damping*dt) + r2*(u[i+1]-2*u[i]+u[i-1]));
    }
    this._applyBC(un);
    this._uprev.set(this._u);
    this._u.set(un);
    this._t += dt;
  }

  _stepHeat() {
    const N = this.N, { c } = this.params;
    const dx = 1 / (N - 1);
    const dt = 0.4 * dx * dx / Math.max(c, 1e-6); // stability: α·dt/dx² ≤ 0.5
    const r = c * dt / (dx * dx);
    const u = this._u, un = this._unext;
    for (let i = 1; i < N - 1; i++) {
      un[i] = u[i] + r * (u[i+1] - 2*u[i] + u[i-1]);
    }
    this._applyBC(un);
    this._u.set(un);
    this._t += dt;
  }

  _stepSchrodinger() {
    const N = this.N;
    const dx = 1 / (N - 1), dt = 0.25 * dx * dx;
    const r = dt / (dx * dx);
    const re = this._psiRe, im = this._psiIm;
    const reN = new Float64Array(N), imN = new Float64Array(N);
    for (let i = 1; i < N - 1; i++) {
      reN[i] = re[i] + r * (im[i+1] - 2*im[i] + im[i-1]);
      imN[i] = im[i] - r * (re[i+1] - 2*re[i] + re[i-1]);
    }
    if (this.params.bc === 'periodic') {
      reN[0] = re[0]+r*(im[1]-2*im[0]+im[N-2]); imN[0]=im[0]-r*(re[1]-2*re[0]+re[N-2]);
      reN[N-1]=reN[0]; imN[N-1]=imN[0];
    } else { reN[0]=0;imN[0]=0;reN[N-1]=0;imN[N-1]=0; }
    re.set(reN); im.set(imN);
    // Store |ψ|² in _u for rendering
    for (let i = 0; i < N; i++) this._u[i] = re[i]*re[i]+im[i]*im[i];
    this._t += dt;
  }

  _stepKdV() {
    // Pseudospectral / finite difference KdV: u_t + 6u·u_x + u_xxx = 0
    const N = this.N, dx = 1 / (N - 1), dt = 0.0001;
    const u = this._u, un = this._unext;
    for (let i = 2; i < N - 2; i++) {
      const ux  = (u[i+1]-u[i-1])/(2*dx);
      const uxxx = (u[i+2]-2*u[i+1]+2*u[i-1]-u[i-2])/(2*dx*dx*dx);
      un[i] = u[i] - dt*(6*u[i]*ux + uxxx);
    }
    // Periodic BCs
    for (let i of [0,1,N-2,N-1]) un[i] = u[(i+N-2)%(N)] ; // simplified
    this._u.set(un);
    this._t += dt;
  }

  update() {
    const eq = this.params.equation;
    for (let s = 0; s < Math.round(this.params.speed); s++) {
      if (eq === 'wave')         this._stepWave();
      else if (eq === 'heat')    this._stepHeat();
      else if (eq === 'schrodinger') this._stepSchrodinger();
      else if (eq === 'kdv')     this._stepKdV();
    }
    // Store snapshot for spacetime diagram (every few steps)
    if (this._history.length === 0 || this._t - (this._history._lastT||0) > 0.02) {
      this._history.push(Float64Array.from(this._u));
      this._history._lastT = this._t;
      if (this._history.length > 300) this._history.shift();
    }
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    if (this.params.showHistory && this._history.length > 4) {
      this._renderSpacetime(ctx, W, H);
    } else {
      this._renderProfile(ctx, W, H);
    }
    label(ctx, this.getFormula(), 8, 8, { color:'#333', size:11, bg:'rgba(255,255,255,0.9)' });
    label(ctx, `t = ${this._t.toFixed(4)}  |  BC: ${this.params.bc}`, 8, H-18, { color:'#888', size:10 });
  }

  _renderProfile(ctx, W, H) {
    const N = this.N, u = this._u;
    const pad = 48;
    const maxU = Math.max(1e-6, ...u.map(Math.abs));
    const tx = i => pad + (i/(N-1)) * (W-2*pad);
    const ty = v => H/2 - v/maxU*(H/2-pad);
    // Zero line
    ctx.strokeStyle='#ddd';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad,H/2);ctx.lineTo(W-pad,H/2);ctx.stroke();
    ctx.strokeStyle='#1a4fa8';ctx.lineWidth=2;ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(tx(0),ty(u[0]));
    for(let i=1;i<N;i++)ctx.lineTo(tx(i),ty(u[i]));
    ctx.stroke();
    // Fill
    ctx.fillStyle='rgba(26,79,168,0.07)';
    ctx.beginPath();ctx.moveTo(tx(0),H/2);
    for(let i=0;i<N;i++)ctx.lineTo(tx(i),ty(u[i]));
    ctx.lineTo(tx(N-1),H/2);ctx.closePath();ctx.fill();
    // Axes
    ctx.fillStyle='#888';ctx.font='11px Courier New';ctx.textAlign='center';
    ctx.fillText('0',pad,H/2+14);ctx.fillText('1',W-pad,H/2+14);
    ctx.fillText(`max=${maxU.toFixed(3)}`,W-50,pad-4);
  }

  _renderSpacetime(ctx, W, H) {
    const pad = 40;
    const hist = this._history;
    const nT = hist.length, N = this.N;
    const imgd = ctx.createImageData(W-2*pad, H-2*pad);
    const data = imgd.data;
    const cm = this.params.colormap;
    // Find range
    let mn = Infinity, mx = -Infinity;
    for (const row of hist) for (const v of row) { if(v<mn)mn=v; if(v>mx)mx=v; }
    const range = Math.max(mx-mn, 1e-10);
    for (let ty2 = 0; ty2 < H-2*pad; ty2++) {
      const ti = Math.floor(ty2/(H-2*pad)*nT);
      const row = hist[ti];
      if (!row) continue;
      for (let tx2 = 0; tx2 < W-2*pad; tx2++) {
        const xi = Math.floor(tx2/(W-2*pad)*N);
        const t = (row[xi]-mn)/range;
        const [r,g,b] = sampleCM(cm, t);
        const p = (ty2*(W-2*pad)+tx2)*4;
        data[p]=r;data[p+1]=g;data[p+2]=b;data[p+3]=255;
      }
    }
    ctx.putImageData(imgd, pad, pad);
    // Axes
    ctx.fillStyle='#555';ctx.font='10px Courier New';
    ctx.textAlign='center';ctx.fillText('x →',W/2,H-pad+14);
    ctx.textAlign='right';ctx.fillText('t ↑',pad-4,pad);
    ctx.fillText('t=0',pad-4,H-pad);
    // Current profile overlay at top
    const u = this._u;
    const maxU=Math.max(1e-6,...u.map(Math.abs));
    ctx.strokeStyle='rgba(200,20,20,0.8)';ctx.lineWidth=2;
    ctx.beginPath();
    for(let i=0;i<N;i++){
      const x=pad+(i/(N-1))*(W-2*pad);
      const y=pad+20-(u[i]/maxU)*18;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
  }

  coordInfo(cx,cy,W,H){ return `t=${this._t.toFixed(4)}  |  N=${this.N} grid points`; }
}
