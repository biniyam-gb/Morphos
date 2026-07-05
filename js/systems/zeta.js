
// Riemann Zeta Function & Analytic Number Theory
// ζ(s) = Σ 1/nˢ   (Re s > 1)
// Extended via Dirichlet eta: η(s) = (1-2^(1-s))ζ(s) = Σ (-1)^(n-1)/nˢ  (Re s > 0)
// Riemann Hypothesis: all non-trivial zeros lie on Re(s) = 1/2

import { hsv2rgb } from '../colormap.js';
import { Viewport, clearCanvas, drawAxes, label, dot } from '../plot.js';
import { sampleCM } from '../colormap.js';

// Euler-Maclaurin accelerated eta function
function etaComplex(re, im, N = 60) {
  let sr = 0, si = 0;
  for (let n = 1; n <= N; n++) {
    const sign = (n & 1) ? 1 : -1;
    const logN = Math.log(n);
    const mod  = Math.exp(-re * logN);
    const arg  = -im * logN;
    sr += sign * mod * Math.cos(arg);
    si += sign * mod * Math.sin(arg);
  }
  return { r: sr, i: si };
}

// ζ(s) from η(s); handles pole at s=1
function zetaC(re, im, N = 60) {
  if (Math.abs(re - 1) < 0.05 && Math.abs(im) < 0.05) return { r: Infinity, i: 0 };
  const eta = etaComplex(re, im, N);
  // 1 - 2^(1-s) = 1 - exp((1-s)·ln2)
  const r2 = Math.exp((1 - re) * Math.LN2);
  const a2 = -im * Math.LN2;
  const dr = 1 - r2 * Math.cos(a2), di = -r2 * Math.sin(a2);
  const d2 = dr*dr + di*di;
  if (d2 < 1e-14) return { r: Infinity, i: 0 };
  return { r: (eta.r*dr + eta.i*di) / d2, i: (eta.i*dr - eta.r*di) / d2 };
}

// Nontrivial zeros of ζ(s) on critical line (first 30)
const ZEROS_T = [14.1347,21.0220,25.0109,30.4249,32.9351,37.5862,40.9187,43.3271,
  48.0052,49.7738,52.9703,56.4462,59.3470,60.8318,65.1125,67.0798,69.5465,72.0672,
  75.7047,77.1448,79.3374,82.9104,84.7355,87.4253,88.8091,92.4919,94.6513,95.8706,
  98.8312,101.318];

function sieve(n){ const c=new Uint8Array(n+1).fill(1);c[0]=c[1]=0;for(let i=2;i*i<=n;i++)if(c[i])for(let j=i*i;j<=n;j+=i)c[j]=0;return c;}

export class ZetaFunction {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.vp = new Viewport(-1, 4, -40, 40);
    this.params = {
      view: 'domain-color',  // domain-color | critical-line | prime-counting | euler-product
      colorMode: 'standard',
      showZeros: true,
      showCritical: true,
      N: 13,  // terms in series — kept low by default since this is recomputed on every pan/zoom
      tMax: 100,
    };
    this.paramDefs = [
      { group: 'View', items: [
        { id: 'view', label: 'Visualization', type: 'select',
          options: ['domain-color','critical-line','prime-counting','euler-product'],
          tip: 'domain-color: ζ(s) as hue=arg, brightness=|ζ|. critical-line: |ζ(½+it)| showing zeros. prime-counting: π(x) vs Li(x) vs Riemann R(x). euler-product: Π 1/(1-p^{-s}).' },
        { id: 'N', label: 'Series terms (accuracy)', min: 20, max: 150, step: 5, type: 'range',
          tip: 'More terms → more accurate near Re(s)=0. Very slow below 20.' },
      ]},
      { group: 'Domain Color', items: [
        { id: 'showZeros',    label: 'Mark zeros',         type: 'toggle', tip: 'White dots at known zeros on critical line.' },
        { id: 'showCritical', label: 'Mark critical line', type: 'toggle', tip: 'Red line Re(s)=½. RH: all nontrivial zeros lie here.' },
        { id: 'colorMode', label: 'Color mode', type: 'select', options: ['standard','enhanced-phase','magnitude-only'] },
      ]},
      { group: 'Critical line t range', items: [
        { id: 'tMax', label: 'Max |t|', min: 30, max: 300, step: 10, type: 'range' },
      ]},
      { group: 'Navigation', items: [
        { id: '_zin',   label: 'Zoom In',    type: 'button' },
        { id: '_zout',  label: 'Zoom Out',   type: 'button' },
        { id: '_reset', label: 'Reset View', type: 'button' },
      ]},
    ];
    this.presets = [
      { id: 'dc',  name: 'Domain coloring',    params: { view:'domain-color', N:50 } },
      { id: 'cl',  name: 'Critical line zeros', params: { view:'critical-line', tMax:100 } },
      { id: 'pc',  name: 'Prime counting π(x)', params: { view:'prime-counting' } },
      { id: 'ep',  name: 'Euler product',        params: { view:'euler-product' } },
      { id: 'wide',name: 'Wide view (zeros)',    params: { view:'domain-color', N:60 } },
    ];
    this.domain = 'Analytic Number Theory';
    this.description = 'Riemann zeta function ζ(s) = Σ 1/nˢ, analytically continued to all ℂ. Non-trivial zeros lie in the critical strip 0<Re(s)<1. The Riemann Hypothesis (1859, unproven) states all zeros satisfy Re(s)=½. Connecting primes to complex analysis.';
    this.stepsPerFrame = 0;
    this._dirty = true;
  }

  getFormula() {
    const m = {
      'domain-color':   'ζ(s) = Σ_{n=1}^∞ 1/nˢ  [domain coloring: hue=arg ζ, brightness=|ζ|]',
      'critical-line':  '|ζ(½+it)| for t∈ℝ  — zeros of ζ on the critical line',
      'prime-counting': 'π(x) = #{p≤x: p prime}  vs  Li(x) = ∫₂ˣ dt/ln t  (PNT)',
      'euler-product':  'ζ(s) = Π_{p prime} 1/(1−p^{−s})  —  primes encode ζ',
    };
    return m[this.params.view] || '';
  }

  reset() { this.vp = new Viewport(-1,4,-40,40); this._dirty = true; }
  update() {}
  onParamChange(id) {
    if (id === '_zin')   this.vp.zoom(0.5, this.canvasW/2, this.canvasH/2, this.canvasW, this.canvasH);
    if (id === '_zout')  this.vp.zoom(2,   this.canvasW/2, this.canvasH/2, this.canvasW, this.canvasH);
    if (id === '_reset') this.reset();
    this._dirty = true;
  }
  onMouseDrag(ddx, ddy, cx, cy, W, H) { this.vp.pan(ddx, ddy, W, H); this._dirty = true; }
  onWheel(cx, cy, delta, W, H) { this.vp.zoom(delta > 0 ? 1.3 : 0.77, cx, cy, W, H); this._dirty = true; }
  onClick(cx, cy, W, H, e) { if (e?.detail === 2) { this.vp.zoom(0.25, cx, cy, W, H); this._dirty = true; } }

  render(ctx, canvas) {
    if (!this._dirty) return; this._dirty = false;
    const W = canvas.width, H = canvas.height;
    const v = this.params.view;
    if (v === 'domain-color')  this._renderDomain(ctx, W, H);
    else if (v === 'critical-line')  this._renderCritical(ctx, W, H);
    else if (v === 'prime-counting') this._renderPrimeCounting(ctx, W, H);
    else if (v === 'euler-product')  this._renderEuler(ctx, W, H);
  }

  _renderDomain(ctx, W, H) {
    const N = this.params.N;
    const RS = 0.24;                             // internal render scale — this loop is per-pixel expensive
    const rW = Math.max(60, Math.floor(W * RS)), rH = Math.max(60, Math.floor(H * RS));
    const imgd = ctx.createImageData(rW, rH);
    const data = imgd.data;
    const vp = this.vp;
    for (let py = 0; py < rH; py++) {
      for (let px = 0; px < rW; px++) {
        const [re, im] = vp.toWorld(px * W / rW, py * H / rH, W, H);
        const { r: zr, i: zi } = zetaC(re, im, N);
        const p = (py*rW+px)*4;
        if (!isFinite(zr)) { data[p]=20;data[p+1]=20;data[p+2]=20;data[p+3]=255;continue; }
        const phase = Math.atan2(zi, zr);
        const mag   = Math.sqrt(zr*zr + zi*zi);
        const hue   = phase / (2*Math.PI) + 0.5;
        const logM  = mag > 0 ? Math.log(mag) : -20;
        let v2 = 0.5 + 0.5 * Math.sin(logM * Math.PI / Math.LN2);
        if (!isFinite(v2)) v2 = 0.1;
        v2 = Math.pow(Math.max(0.05, Math.min(1, v2)), 0.6);
        let [r, g, b] = hsv2rgb(hue, 0.95, v2);
        const t = ((phase / (2*Math.PI) + 1) % 1) * 12;
        if (t - Math.floor(t) < 0.08) { r=Math.round(r*.25);g=Math.round(g*.25);b=Math.round(b*.25); }
        if (mag > 0) { const lm2 = Math.log2(mag); const tf = lm2-Math.floor(lm2); if(tf<0.08||tf>0.92){r=Math.round(r*.25);g=Math.round(g*.25);b=Math.round(b*.25);} }
        data[p]=r;data[p+1]=g;data[p+2]=b;data[p+3]=255;
      }
    }
    const tmp = document.createElement('canvas'); tmp.width = rW; tmp.height = rH;
    tmp.getContext('2d').putImageData(imgd, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(tmp, 0, 0, W, H);
    // Critical line
    if (this.params.showCritical) {
      const [cx] = vp.toCanvas(0.5, 0, W, H);
      ctx.save(); ctx.strokeStyle='rgba(255,50,50,0.7)'; ctx.lineWidth=1.5; ctx.setLineDash([6,3]);
      ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx,H); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      label(ctx, 'Re(s)=½', cx+4, 6, { color:'rgba(220,30,30,0.9)', size:10 });
    }
    // Known zeros
    if (this.params.showZeros) {
      for (const t of ZEROS_T) {
        for (const sign of [1,-1]) {
          const [cx, cy] = vp.toCanvas(0.5, sign*t, W, H);
          if (cy < 0 || cy > H) continue;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle='#000'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.arc(cx,cy,3.5,0,Math.PI*2); ctx.stroke();
        }
      }
    }
    // Trivial zeros at s = -2,-4,-6,...
    for (let n = -2; n >= vp.xMin; n -= 2) {
      const [cx,cy] = vp.toCanvas(n, 0, W, H);
      if(cx<0||cx>W)continue;
      ctx.fillStyle='rgba(255,200,100,0.9)'; ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2); ctx.fill();
    }
    label(ctx, 'ζ(s)  —  white=nontrivial zeros  |  yellow=trivial zeros at −2,−4,…', 8, H-18, { color:'rgba(0,0,0,0.7)', size:10, bg:'rgba(255,255,255,0.7)' });
    label(ctx, `Re∈[${vp.xMin.toFixed(1)},${vp.xMax.toFixed(1)}]  Im∈[${vp.yMin.toFixed(1)},${vp.yMax.toFixed(1)}]  N=${N} terms`, 8, 8, { color:'rgba(0,0,0,0.7)', size:10, bg:'rgba(255,255,255,0.7)' });
  }

  _renderCritical(ctx, W, H) {
    clearCanvas(ctx, W, H, '#fff');
    const tMax = this.params.tMax, N = this.params.N;
    const pad = 50;
    const steps = Math.min(1200, tMax * 10);
    const vals = [];
    for (let i = 0; i <= steps; i++) {
      const t = -tMax + (2*tMax*i/steps);
      const { r, i: im } = zetaC(0.5, t, N);
      vals.push({ t, mag: Math.sqrt(r*r+im*im), re:r, im });
    }
    const maxMag = Math.max(...vals.map(v=>v.mag), 1);
    const tx = t => pad + (t + tMax) / (2*tMax) * (W-2*pad);
    const ty = m => H - pad - (m/maxMag)*(H-2*pad-20);
    // Grid
    ctx.strokeStyle='#eee'; ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad,H-pad);ctx.lineTo(W-pad,H-pad);ctx.stroke();
    // Mark known zeros
    for (const t0 of ZEROS_T) {
      for (const s of [t0,-t0]) {
        if(Math.abs(s)>tMax)continue;
        const x=tx(s);
        ctx.strokeStyle='rgba(200,20,20,0.3)';ctx.lineWidth=1;ctx.setLineDash([2,3]);
        ctx.beginPath();ctx.moveTo(x,pad);ctx.lineTo(x,H-pad);ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle='#c42020';ctx.font='9px Courier New';ctx.textAlign='center';
        ctx.fillText(Math.abs(s).toFixed(1),x,H-pad+11);
      }
    }
    // |ζ(½+it)| curve
    ctx.strokeStyle='#1a4fa8'; ctx.lineWidth=1.8; ctx.lineJoin='round';
    ctx.beginPath();
    vals.forEach((v,i) => { i===0?ctx.moveTo(tx(v.t),ty(v.mag)):ctx.lineTo(tx(v.t),ty(v.mag)); });
    ctx.stroke();
    // Fill
    ctx.fillStyle='rgba(26,79,168,0.08)';
    ctx.beginPath();ctx.moveTo(tx(-tMax),H-pad);
    vals.forEach(v=>ctx.lineTo(tx(v.t),ty(v.mag)));
    ctx.lineTo(tx(tMax),H-pad);ctx.closePath();ctx.fill();
    label(ctx,`|ζ(½+it)| for t ∈ [−${tMax}, ${tMax}]`,pad,8,{color:'#333',size:12,bg:'rgba(255,255,255,0.9)'});
    label(ctx,'Red dashed: known zeros. RH predicts ALL zeros here.',pad,26,{color:'#666',size:10,bg:'rgba(255,255,255,0.88)'});
    ctx.fillStyle='#888';ctx.font='10px Courier New';ctx.textAlign='center';
    ctx.fillText('t (imaginary part of s = ½+it)',W/2,H-8);
  }

  _renderPrimeCounting(ctx, W, H) {
    clearCanvas(ctx, W, H, '#fff');
    const xMax=200, pad=50;
    const primes=sieve(xMax);
    // π(x) step function
    const pi=[]; let cnt=0;
    for(let x=2;x<=xMax;x++){if(primes[x])cnt++;pi.push({x,y:cnt});}
    // Li(x) = integral 2 to x of 1/ln(t) dt (numerical)
    function Li(x){let s=0;const n=200;for(let k=1;k<=n;k++){const t=2+(x-2)*k/n;s+=1/Math.log(t)*(x-2)/n;}return s;}
    // R(x) Riemann's approximation: Σ μ(n)/n * Li(x^(1/n))
    function R(x){let s=Li(x);for(let n=2;n<=10;n++){const mob=[0,1,-1,-1,0,-1,1,-1,-1,0,-1,1][n]||0;if(mob)s+=mob/n*Li(Math.pow(x,1/n));}return s;}
    const piVals=pi, liVals=Array.from({length:xMax-1},(_,i)=>Li(i+2));
    const rVals =Array.from({length:xMax-1},(_,i)=>R(i+2));
    const maxY=Math.max(cnt, liVals[liVals.length-1])+3;
    const tx=x=>pad+(x-2)/(xMax-2)*(W-2*pad);
    const ty=y=>H-pad-y/maxY*(H-2*pad);
    // Grid
    drawAxes(ctx,{toCanvas:(x,y,W2,H2)=>[tx(x),ty(y)],xMin:0,xMax,yMin:0,yMax:maxY,width:()=>xMax,height:()=>maxY},W,H);
    // Li(x)
    ctx.strokeStyle='#1a6b1a';ctx.lineWidth=1.5;
    ctx.beginPath();liVals.forEach((y,i)=>{i===0?ctx.moveTo(tx(i+2),ty(y)):ctx.lineTo(tx(i+2),ty(y));});ctx.stroke();
    // R(x)
    ctx.strokeStyle='#a05000';ctx.lineWidth=1.5;ctx.setLineDash([4,3]);
    ctx.beginPath();rVals.forEach((y,i)=>{i===0?ctx.moveTo(tx(i+2),ty(y)):ctx.lineTo(tx(i+2),ty(y));});ctx.stroke();ctx.setLineDash([]);
    // π(x) step function
    ctx.strokeStyle='#1a4fa8';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(tx(2),ty(0));
    for(const{x,y}of piVals){ctx.lineTo(tx(x-0.5),ty(y-1));ctx.lineTo(tx(x-0.5),ty(y));ctx.lineTo(tx(x),ty(y));}
    ctx.stroke();
    // Legend
    label(ctx,'— π(x): exact prime count',pad,8,{color:'#1a4fa8',size:11,bg:'rgba(255,255,255,0.9)'});
    label(ctx,'— Li(x) = ∫₂ˣ dt/ln t  (PNT estimate)',pad,22,{color:'#1a6b1a',size:11,bg:'rgba(255,255,255,0.88)'});
    label(ctx,'— R(x) Riemann approx (includes zero corrections)',pad,36,{color:'#a05000',size:11,bg:'rgba(255,255,255,0.88)'});
    const err=Math.abs(cnt-liVals[liVals.length-1]);
    label(ctx,`π(${xMax})=${cnt}  Li(${xMax})=${liVals[liVals.length-1].toFixed(1)}  error=${err.toFixed(1)}`,pad,H-18,{color:'#555',size:10});
  }

  _renderEuler(ctx, W, H) {
    clearCanvas(ctx, W, H, '#fff');
    const pad=50, pmax=80;
    const pr=sieve(pmax);
    const primes=[]; for(let i=2;i<=pmax;i++)if(pr[i])primes.push(i);
    // Show partial Euler products vs ζ(s) for real s
    const steps=200, sVals=Array.from({length:steps},(_,i)=>1.1+i*0.02);
    const W2=W-2*pad, H2=H-2*pad-20;
    const maxS=sVals[sVals.length-1];
    const tx=s=>pad+(s-1.1)/(maxS-1.1)*W2;
    const ty=v=>H-pad-Math.min(1,(v-1)/9)*H2;
    // True ζ(s)
    ctx.strokeStyle='#333';ctx.lineWidth=2;
    ctx.beginPath();
    sVals.forEach((s,i)=>{
      const{r}=zetaC(s,0,80); const y=ty(r);
      i===0?ctx.moveTo(tx(s),y):ctx.lineTo(tx(s),y);
    });
    ctx.stroke();
    // Partial products for different prime sets
    const cols=['#c42020','#1a4fa8','#1a6b1a','#a05000','#6020a0'];
    [5,10,20,40,primes.length].forEach((np,ki)=>{
      ctx.strokeStyle=cols[ki];ctx.lineWidth=1.2;ctx.setLineDash(ki===4?[]:[3,3]);
      ctx.beginPath();
      sVals.forEach((s,i)=>{
        let prod=1;
        for(let pi=0;pi<np&&pi<primes.length;pi++) prod*=1/(1-Math.pow(primes[pi],-s));
        const y=ty(prod);
        i===0?ctx.moveTo(tx(s),y):ctx.lineTo(tx(s),y);
      });
      ctx.stroke();ctx.setLineDash([]);
    });
    label(ctx,'Euler product: ζ(s) = Π_{p≤P} 1/(1−p^{−s})',pad,8,{color:'#333',size:12,bg:'rgba(255,255,255,0.9)'});
    [5,10,20,40,'all'].forEach((np,i)=>label(ctx,`P≤${np==='all'?pmax:primes[np-1]}`,pad+i*60,26,{color:cols[i],size:10}));
    label(ctx,'Primes encode all of ζ(s). More primes → better approximation.',pad,H-18,{color:'#666',size:10});
    ctx.fillStyle='#555';ctx.font='10px Courier New';ctx.textAlign='center';
    ctx.fillText('s (real)',W/2,H-6);
  }

  coordInfo(cx, cy, W, H) {
    const [re, im] = this.vp.toWorld(cx, cy, W, H);
    const { r: zr, i: zi } = zetaC(re, im, this.params.N);
    const mag = Math.sqrt(zr*zr+zi*zi), arg = Math.atan2(zi,zr)*180/Math.PI;
    return `s=${re.toFixed(3)}+${im.toFixed(3)}i  |ζ|=${mag.toFixed(4)}  arg=${arg.toFixed(1)}°`;
  }
}
