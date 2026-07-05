
// 2D Ising Model — Statistical Mechanics & Phase Transitions
// H = -J Σ_<ij> sᵢsⱼ - h Σᵢ sᵢ   (spins sᵢ = ±1)
// Metropolis-Hastings Monte Carlo at temperature T
// Critical temperature (Onsager, 1944): Tc = 2J/(k·ln(1+√2)) ≈ 2.269 J/k

import { clearCanvas, label } from '../plot.js';
import { sampleCM } from '../colormap.js';

export class IsingModel {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.L = 120;  // lattice size
    this.params = {
      T: 2.269, J: 1.0, h: 0.0,
      sweepsPerFrame: 4,
      colormap: 'coolwarm',
      showMagnetization: true,
      boundary: 'periodic',
    };
    this.paramDefs = [
      { group: 'Physics', items: [
        { id: 'T', label: 'Temperature T', min: 0.5, max: 5.0, step: 0.01, type: 'range',
          tip: 'Critical temp Tc≈2.269 (Onsager exact). Below: ordered (magnetized). Above: disordered.' },
        { id: 'J', label: 'Coupling J', min: -2, max: 2, step: 0.1, type: 'range',
          tip: 'J>0: ferromagnetic (aligned spins favored). J<0: antiferromagnetic.' },
        { id: 'h', label: 'Field h', min: -2, max: 2, step: 0.05, type: 'range',
          tip: 'External magnetic field — biases spins toward +1 or -1.' },
      ]},
      { group: 'Simulation', items: [
        { id: 'sweepsPerFrame', label: 'MC sweeps/frame', min: 1, max: 20, step: 1, type: 'range' },
        { id: 'boundary', label: 'Boundary', type: 'select', options: ['periodic','fixed'] },
        { id: 'colormap', label: 'Color map', type: 'colormap' },
        { id: 'showMagnetization', label: 'Show M(t) graph', type: 'toggle' },
      ]},
    ];
    this.presets = [
      { id: 'critical', name: 'At Tc (critical)',     params: { T: 2.269, J:1, h:0 } },
      { id: 'cold',     name: 'Cold (ordered)',         params: { T: 1.0,   J:1, h:0 } },
      { id: 'hot',      name: 'Hot (disordered)',       params: { T: 4.0,   J:1, h:0 } },
      { id: 'field',    name: 'Strong field',            params: { T: 2.269, J:1, h:0.8 } },
      { id: 'anti',     name: 'Antiferromagnetic',       params: { T: 1.5,   J:-1, h:0 } },
      { id: 'slow',     name: 'Slow cooling (quench)',   params: { T: 3.5,   J:1, h:0 } },
    ];
    this.domain = 'Statistical Mechanics';
    this.description = '2D Ising model via Metropolis Monte Carlo. Models ferromagnetism. At T=Tc≈2.269 (exact, Onsager 1944) the system undergoes a continuous phase transition — correlation length diverges, fractal domain boundaries appear at all scales.';
    this.stepsPerFrame = 1;
    this._spins = null;
    this._magHistory = [];
    this._t = 0;
    this._initLattice();
  }

  _initLattice() {
    const L = this.L;
    this._spins = new Int8Array(L*L);
    for (let i = 0; i < L*L; i++) this._spins[i] = Math.random() < 0.5 ? 1 : -1;
    this._magHistory = [];
    this._t = 0;
  }

  getFormula() { return `H = −J Σ⟨ij⟩ sᵢsⱼ − h Σᵢ sᵢ   T=${this.params.T.toFixed(3)}  Tc≈2.269`; }
  reset() { this._initLattice(); }

  onParamChange(id) {
    if (id === '_preset') this._initLattice();
  }

  _neighbors(i, j, L) {
    if (this.params.boundary === 'periodic') {
      return [
        ((i+1)%L)*L+j, ((i-1+L)%L)*L+j,
        i*L+((j+1)%L), i*L+((j-1+L)%L),
      ];
    } else {
      const out = [];
      if (i+1<L) out.push((i+1)*L+j);
      if (i-1>=0) out.push((i-1)*L+j);
      if (j+1<L) out.push(i*L+(j+1));
      if (j-1>=0) out.push(i*L+(j-1));
      return out;
    }
  }

  _metropolisSweep() {
    const L = this.L, { T, J, h } = this.params;
    const spins = this._spins;
    const N = L*L;
    for (let step = 0; step < N; step++) {
      const idx = (Math.random()*N)|0;
      const i = (idx/L)|0, j = idx%L;
      const nbrs = this._neighbors(i,j,L);
      let sumNbr = 0;
      for (const n of nbrs) sumNbr += spins[n];
      const dE = 2 * spins[idx] * (J*sumNbr + h);
      if (dE <= 0 || Math.random() < Math.exp(-dE/Math.max(T,0.01))) {
        spins[idx] *= -1;
      }
    }
  }

  update() {
    for (let s = 0; s < this.params.sweepsPerFrame; s++) this._metropolisSweep();
    // Track magnetization
    let M = 0;
    for (let i = 0; i < this._spins.length; i++) M += this._spins[i];
    M /= this._spins.length;
    this._magHistory.push(M);
    if (this._magHistory.length > 300) this._magHistory.shift();
    this._t++;
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const showMag = this.params.showMagnetization;
    const latticeH = showMag ? H * 0.75 : H;

    // Render lattice
    const L = this.L;
    const imgd = ctx.createImageData(L, L);
    const data = imgd.data;
    const cm = this.params.colormap;
    for (let i = 0; i < L*L; i++) {
      const t = (this._spins[i] + 1) / 2;
      const [r,g,b] = sampleCM(cm, t);
      const p = i*4; data[p]=r;data[p+1]=g;data[p+2]=b;data[p+3]=255;
    }
    const tmp = document.createElement('canvas');
    tmp.width = L; tmp.height = L;
    tmp.getContext('2d').putImageData(imgd, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const size = Math.min(W, latticeH);
    const ox = (W-size)/2, oy = (latticeH-size)/2;
    ctx.drawImage(tmp, ox, oy, size, size);

    // Magnetization graph
    if (showMag && this._magHistory.length > 1) {
      const gy = latticeH, gh = H - latticeH;
      ctx.fillStyle = '#fafafa'; ctx.fillRect(0, gy, W, gh);
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(40, gy+gh/2); ctx.lineTo(W-10, gy+gh/2); ctx.stroke();
      ctx.strokeStyle = '#1a4fa8'; ctx.lineWidth = 1.5; ctx.lineJoin='round';
      ctx.beginPath();
      this._magHistory.forEach((m,i) => {
        const x = 40 + (i/300)*(W-50);
        const y = gy + gh/2 - m*(gh/2-6);
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      });
      ctx.stroke();
      ctx.fillStyle='#555'; ctx.font='10px Courier New'; ctx.textAlign='left';
      ctx.fillText('M(t)', 6, gy+12);
      ctx.fillText('+1', 6, gy+10); ctx.fillText('−1', 6, gy+gh-4);
      const curM = this._magHistory[this._magHistory.length-1];
      label(ctx, `M = ${curM.toFixed(3)}`, W-100, gy+8, { color:'#1a4fa8', size:11 });
    }

    const phase = this.params.T < 2.0 ? 'Ordered (ferromagnetic)' : this.params.T > 2.6 ? 'Disordered (paramagnetic)' : 'Near critical — fractal domains';
    label(ctx, `T=${this.params.T.toFixed(3)}  (Tc≈2.269)  —  ${phase}`, 8, 8, { color:'#fff', size:11, bg:'rgba(0,0,0,0.5)' });
  }

  coordInfo() { return `sweep ${this._t}  |  T=${this.params.T.toFixed(3)}  Tc≈2.269  |  ↺ to reshuffle`; }
}
