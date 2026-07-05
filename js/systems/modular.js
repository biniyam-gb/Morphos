
// Modular Forms — fundamental domain, j-invariant, Eisenstein series, dedekind eta
import { hsv2rgb } from '../colormap.js';
import { Viewport, clearCanvas, label } from '../plot.js';
import { sampleCM } from '../colormap.js';

// q-expansion based approximations (q = e^{2πiτ})
function dedekindEta(tau_re, tau_im, terms=40) {
  // η(τ) = q^{1/24} Π_{n=1}^∞ (1-q^n),  q=e^{2πiτ}
  if (tau_im <= 0.01) return {r:0,i:0};
  // q = e^{2πi(re+i*im)} = e^{-2π*im} * e^{2πi*re}
  const qMagLog = -2*Math.PI*tau_im;
  const qArg = 2*Math.PI*tau_re;
  // q^(1/24)
  let pr = Math.exp(qMagLog/24)*Math.cos(qArg/24), pi = Math.exp(qMagLog/24)*Math.sin(qArg/24);
  for (let n=1;n<=terms;n++) {
    const qnMagLog = n*qMagLog, qnArg = n*qArg;
    const qnMag = Math.exp(qnMagLog);
    if (qnMag < 1e-16) break;
    const qnr = qnMag*Math.cos(qnArg), qni = qnMag*Math.sin(qnArg);
    const fr = 1-qnr, fi = -qni;
    const nr = pr*fr - pi*fi, ni = pr*fi + pi*fr;
    pr = nr; pi = ni;
  }
  return {r:pr, i:pi};
}

function jInvariant(tau_re, tau_im, terms=40) {
  // j(τ) via eta: j = (E4)^3/Δ but simpler with q-expansion:
  // j(τ) = 1/q + 744 + 196884q + 21493760q^2 + ...
  if (tau_im <= 0.05) return {r:Infinity, i:0};
  const qMagLog = -2*Math.PI*tau_im, qArg = 2*Math.PI*tau_re;
  const qMag = Math.exp(qMagLog);
  if (qMag > 0.98) return {r:NaN, i:NaN}; // too close to boundary, series diverges
  // 1/q
  const invMag = Math.exp(-qMagLog);
  let jr = invMag*Math.cos(-qArg), ji = invMag*Math.sin(-qArg);
  jr += 744;
  const coeffs = [196884, 21493760, 864299970, 20245856256, 333202640600];
  let qnMag=qMag, qnArg=qArg;
  for (let n=1; n<=5; n++) {
    const c = coeffs[n-1];
    const cr = c*qnMag*Math.cos(qnArg), ci = c*qnMag*Math.sin(qnArg);
    jr += cr; ji += ci;
    qnMag *= qMag; qnArg += qArg;
    if (qnMag < 1e-12) break;
  }
  return {r:jr, i:ji};
}

export class ModularForms {
  constructor(W,H) {
    this.canvasW=W; this.canvasH=H;
    this.vp = new Viewport(-2, 2, 0, 2);
    this.params = {
      view: 'fundamental-domain',  // fundamental-domain | j-invariant | eta-function | orbit
      showOrbit: false,
      orbitTauRe: 0.3, orbitTauIm: 1.3,
      colorMode: 'standard',
    };
    this.paramDefs = [
      { group: 'View', items: [
        { id: 'view', label: 'Visualization', type: 'select',
          options: ['fundamental-domain','j-invariant','eta-function','orbit'],
          tip: 'fundamental-domain: tiling of H by SL(2,Z). j-invariant: domain coloring of j(τ). eta: Dedekind eta function. orbit: SL(2,Z) orbit of a point.' },
      ]},
      { group: 'Display', items: [
        { id: 'colorMode', label: 'Color mode', type: 'select', options: ['standard','magnitude-only'] },
      ]},
      { group: 'Orbit point τ', items: [
        { id: 'orbitTauRe', label: 'Re(τ)', min: -2, max: 2, step: 0.01, type: 'range' },
        { id: 'orbitTauIm', label: 'Im(τ)', min: 0.3, max: 3, step: 0.01, type: 'range' },
      ]},
      { group: 'Navigation', items: [
        { id: '_zin',   label: 'Zoom In',   type: 'button' },
        { id: '_zout',  label: 'Zoom Out',  type: 'button' },
        { id: '_reset', label: 'Reset View',type: 'button' },
      ]},
    ];
    this.presets = [
      { id: 'fund', name: 'Fundamental domain', params: { view:'fundamental-domain' } },
      { id: 'jinv', name: 'j-invariant',          params: { view:'j-invariant' } },
      { id: 'eta',  name: 'Dedekind eta',          params: { view:'eta-function' } },
      { id: 'orbit',name: 'SL(2,ℤ) orbit',         params: { view:'orbit', orbitTauRe:0.3, orbitTauIm:1.3 } },
    ];
    this.domain = 'Modular Forms';
    this.description = 'Modular forms live on the upper half-plane H={τ: Im τ>0}, invariant under SL(2,ℤ) acting by τ→(aτ+b)/(cτ+d). The j-invariant j(τ) is a bijection from the fundamental domain to ℂ, and famously has integer Fourier coefficients related to the Monster group (Moonshine).';
    this.stepsPerFrame = 0;
    this._dirty = true;
  }

  getFormula() {
    const m = {
      'fundamental-domain': 'F = {τ: |Re τ|≤½, |τ|≥1}  (fundamental domain for SL(2,ℤ)\\H)',
      'j-invariant': 'j(τ) = 1/q + 744 + 196884q + …   q=e^{2πiτ}',
      'eta-function': 'η(τ) = q^{1/24} Π_{n≥1}(1−qⁿ)   q=e^{2πiτ}',
      orbit: 'τ → (aτ+b)/(cτ+d),  ad−bc=1,  a,b,c,d∈ℤ',
    };
    return m[this.params.view] || '';
  }

  reset() { this.vp = new Viewport(-2,2,0,2); this._dirty=true; }
  update() {}
  onParamChange(id) {
    if (id==='_zin')  this.vp.zoom(0.5,this.canvasW/2,this.canvasH/2,this.canvasW,this.canvasH);
    if (id==='_zout') this.vp.zoom(2,this.canvasW/2,this.canvasH/2,this.canvasW,this.canvasH);
    if (id==='_reset') this.reset();
    this._dirty=true;
  }
  onMouseDrag(ddx,ddy,cx,cy,W,H) { this.vp.pan(ddx,ddy,W,H); this._dirty=true; }
  onWheel(cx,cy,delta,W,H) { this.vp.zoom(delta>0?1.3:0.77,cx,cy,W,H); this._dirty=true; }

  render(ctx, canvas) {
    if (!this._dirty) return; this._dirty=false;
    const W=canvas.width, H=canvas.height;
    const v = this.params.view;
    if (v==='fundamental-domain') this._renderFundamental(ctx,W,H);
    else if (v==='j-invariant') this._renderJ(ctx,W,H);
    else if (v==='eta-function') this._renderEta(ctx,W,H);
    else if (v==='orbit') this._renderOrbit(ctx,W,H);
  }

  _renderFundamental(ctx,W,H) {
    clearCanvas(ctx,W,H,'#fff');
    const vp = this.vp;
    // Draw upper half plane boundary
    const [ox] = vp.toCanvas(0,0,W,H);
    // Shade Im(tau)<0
    const [,zeroY] = vp.toCanvas(0,0,W,H);
    ctx.fillStyle='rgba(0,0,0,0.05)';
    ctx.fillRect(0,zeroY,W,H-zeroY);

    // Tessellate by SL(2,Z) translates of fundamental domain (a few copies via T,S generators)
    const drawDomain = (a,b,c,d,col) => {
      // Apply Mobius transform to boundary of standard fund domain
      const apply = (re,im) => {
        const denom_r = c*re+d, denom_i = c*im;
        const num_r = a*re+b, num_i = a*im;
        const d2 = denom_r*denom_r+denom_i*denom_i;
        if (d2<1e-10) return null;
        return [(num_r*denom_r+num_i*denom_i)/d2, (num_i*denom_r-num_r*denom_i)/d2];
      };
      const pts = [];
      for (let t=0;t<=1;t+=0.02) { const r=apply(-0.5+t,Math.sqrt(1-(-0.5+t)**2<0?0.001:Math.max(0.0001,1-(-0.5+t)**2))); if(r)pts.push(r); }
      // simpler: just draw straight + arc boundary directly transformed via sampling
      const bndry=[];
      for (let t=0;t<=1;t+=0.03){ const x=-0.5+t; const y=Math.sqrt(Math.max(0.001,1-x*x)); bndry.push([x,y]); }
      for (let t=0;t<=1;t+=0.05){ const y=Math.sqrt(0.75)+t*2; bndry.push([0.5,y]); }
      for (let t=1;t>=0;t-=0.05){ const y=Math.sqrt(0.75)+t*2; bndry.push([-0.5,y]); }
      const transformed = bndry.map(([x,y])=>apply(x,y)).filter(p=>p);
      if (transformed.length<3) return;
      ctx.fillStyle=col; ctx.beginPath();
      transformed.forEach(([x,y],i)=>{const[cx,cy]=vp.toCanvas(x,y,W,H);i===0?ctx.moveTo(cx,cy):ctx.lineTo(cx,cy);});
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.8; ctx.stroke();
    };

    // Generate several SL(2,Z) elements: T^n (translation) and S T^n S etc (small set)
    const transforms = [[1,0,0,1]]; // identity
    for (let n=-3;n<=3;n++) if(n!==0) transforms.push([1,n,0,1]); // T^n
    transforms.push([0,-1,1,0]); // S
    for (let n=-2;n<=2;n++) transforms.push([0,-1,1,n]); // S T^n combos (approx)
    transforms.push([1,0,1,1]); transforms.push([1,0,-1,1]);
    transforms.push([2,1,1,1]); transforms.push([1,1,1,2]);
    transforms.push([2,-1,-1,1]); transforms.push([1,-1,-1,2]);

    const cols = ['rgba(26,79,168,0.18)','rgba(196,32,32,0.18)','rgba(26,107,26,0.18)','rgba(160,80,0,0.18)','rgba(96,32,160,0.18)'];
    transforms.forEach(([a,b,c,d],i) => drawDomain(a,b,c,d, cols[i%cols.length]));

    // Mark the standard fundamental domain boundary clearly
    ctx.strokeStyle='#c42020'; ctx.lineWidth=2;
    ctx.beginPath();
    const [x1,y1] = vp.toCanvas(-0.5, Math.sqrt(0.75), W, H);
    ctx.moveTo(x1,y1);
    const [x2,y2] = vp.toCanvas(-0.5, vp.yMax, W, H);
    ctx.lineTo(x2,y2);
    ctx.stroke();
    ctx.beginPath();
    const [x3,y3] = vp.toCanvas(0.5, Math.sqrt(0.75), W, H);
    const [x4,y4] = vp.toCanvas(0.5, vp.yMax, W, H);
    ctx.moveTo(x3,y3); ctx.lineTo(x4,y4); ctx.stroke();
    // Unit circle arc
    ctx.beginPath();
    for (let t=0;t<=1;t+=0.01) {
      const x=-0.5+t, y=Math.sqrt(Math.max(0,1-x*x));
      const [cx,cy]=vp.toCanvas(x,y,W,H);
      t===0?ctx.moveTo(cx,cy):ctx.lineTo(cx,cy);
    }
    ctx.stroke();

    // Special points: i, rho=e^{i pi/3}
    const special = [[0,1,'i'], [0.5,Math.sqrt(0.75),'ρ=e^{iπ/3}'], [-0.5,Math.sqrt(0.75),'ρ²']];
    for (const [x,y,lbl] of special) {
      const [cx,cy]=vp.toCanvas(x,y,W,H);
      ctx.fillStyle='#c42020'; ctx.beginPath();ctx.arc(cx,cy,4,0,Math.PI*2);ctx.fill();
      label(ctx,lbl,cx+6,cy-14,{color:'#c42020',size:11,bg:'rgba(255,255,255,0.8)'});
    }

    label(ctx, 'Fundamental domain F for SL(2,ℤ) acting on H (red boundary), with images under group elements', 8, 8, { color:'#333', size:11, bg:'rgba(255,255,255,0.9)' });
    label(ctx, 'τ ~ τ+1 (T) and τ ~ −1/τ (S) generate SL(2,ℤ)/{±I} = PSL(2,ℤ)', 8, H-16, { color:'#666', size:10 });
  }

  _renderJ(ctx,W,H) {
    const vp = this.vp;
    const RS = 0.36;
    const rW = Math.max(60, Math.floor(W*RS)), rH = Math.max(60, Math.floor(H*RS));
    const imgd = ctx.createImageData(rW,rH);
    const data = imgd.data;
    for (let py=0; py<rH; py++) {
      for (let px=0; px<rW; px++) {
        const [re,im] = vp.toWorld(px*W/rW, py*H/rH, W, H);
        const p = (py*rW+px)*4;
        if (im <= 0.02) { data[p]=15;data[p+1]=15;data[p+2]=15;data[p+3]=255; continue; }
        const { r:jr, i:ji } = jInvariant(re, im);
        if (!isFinite(jr) || isNaN(jr)) { data[p]=40;data[p+1]=40;data[p+2]=60;data[p+3]=255; continue; }
        const mag = Math.sqrt(jr*jr+ji*ji);
        const phase = Math.atan2(ji,jr);
        const hue = phase/(2*Math.PI)+0.5;
        const logM = mag>0?Math.log(mag+1):0;
        let v2 = 0.5+0.5*Math.sin(logM*Math.PI/3);
        v2 = Math.pow(Math.max(0.1,Math.min(1,v2)),0.6);
        const [r,g,b] = hsv2rgb(hue,0.85,v2);
        data[p]=r;data[p+1]=g;data[p+2]=b;data[p+3]=255;
      }
    }
    const tmp = document.createElement('canvas'); tmp.width=rW; tmp.height=rH;
    tmp.getContext('2d').putImageData(imgd,0,0);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='medium';
    ctx.drawImage(tmp,0,0,W,H);
    label(ctx,'j(τ): domain coloring  —  black = lower half-plane (Im τ≤0)',8,8,{color:'#fff',size:11,bg:'rgba(0,0,0,0.5)'});
    label(ctx,'j(i)=1728, j(ρ)=0, j(i∞)=∞  —  j is constant on SL(2,ℤ)-orbits',8,26,{color:'#fff',size:10,bg:'rgba(0,0,0,0.45)'});
  }

  _renderEta(ctx,W,H) {
    const vp = this.vp;
    const RS = 0.36;
    const rW = Math.max(60, Math.floor(W*RS)), rH = Math.max(60, Math.floor(H*RS));
    const imgd = ctx.createImageData(rW,rH);
    const data = imgd.data;
    for (let py=0; py<rH; py++) {
      for (let px=0; px<rW; px++) {
        const [re,im] = vp.toWorld(px*W/rW, py*H/rH, W, H);
        const p = (py*rW+px)*4;
        if (im <= 0.02) { data[p]=15;data[p+1]=15;data[p+2]=15;data[p+3]=255; continue; }
        const { r:er, i:ei } = dedekindEta(re, im);
        const mag = Math.sqrt(er*er+ei*ei);
        const phase = Math.atan2(ei,er);
        const hue = phase/(2*Math.PI)+0.5;
        const v2 = Math.pow(Math.max(0.05,Math.min(1,mag*3)),0.5);
        const [r,g,b] = hsv2rgb(hue,0.9,v2);
        data[p]=r;data[p+1]=g;data[p+2]=b;data[p+3]=255;
      }
    }
    const tmp = document.createElement('canvas'); tmp.width=rW; tmp.height=rH;
    tmp.getContext('2d').putImageData(imgd,0,0);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='medium';
    ctx.drawImage(tmp,0,0,W,H);
    label(ctx,'Dedekind η(τ) = q^{1/24}Π(1−qⁿ)  —  weight 1/2 modular form',8,8,{color:'#fff',size:11,bg:'rgba(0,0,0,0.5)'});
    label(ctx,'η²⁴ = Δ (discriminant), the weight-12 cusp form. η(−1/τ)=√(−iτ)η(τ)',8,26,{color:'#fff',size:10,bg:'rgba(0,0,0,0.45)'});
  }

  _renderOrbit(ctx,W,H) {
    clearCanvas(ctx,W,H,'#fff');
    const vp = this.vp;
    const [ , zeroY] = vp.toCanvas(0,0,W,H);
    ctx.fillStyle='rgba(0,0,0,0.04)'; ctx.fillRect(0,zeroY,W,H-zeroY);

    const tau0 = [this.params.orbitTauRe, this.params.orbitTauIm];
    // Generate orbit under small set of SL(2,Z) elements
    const gens = [];
    for (let a=-2;a<=2;a++) for (let b=-2;b<=2;b++) for (let c=-2;c<=2;c++) for (let d=-2;d<=2;d++) {
      if (a*d-b*c===1) gens.push([a,b,c,d]);
    }
    const apply = ([a,b,c,d],[re,im]) => {
      const dr=c*re+d, di=c*im;
      const nr=a*re+b, ni=a*im;
      const d2=dr*dr+di*di; if(d2<1e-9)return null;
      return [(nr*dr+ni*di)/d2,(ni*dr-nr*di)/d2];
    };
    const orbitPts = gens.map(g=>apply(g,tau0)).filter(p=>p && p[1]>0.01 && p[1]<vp.yMax*3);
    // Dedupe-ish and draw
    ctx.fillStyle='rgba(26,79,168,0.7)';
    for (const [x,y] of orbitPts) {
      if (x<vp.xMin-1||x>vp.xMax+1||y>vp.yMax+2) continue;
      const [cx,cy]=vp.toCanvas(x,y,W,H);
      ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2); ctx.fill();
    }
    // Original point highlighted
    const [ox,oy]=vp.toCanvas(tau0[0],tau0[1],W,H);
    ctx.fillStyle='#c42020'; ctx.beginPath();ctx.arc(ox,oy,5,0,Math.PI*2);ctx.fill();
    label(ctx,`τ₀=${tau0[0].toFixed(2)}+${tau0[1].toFixed(2)}i`,ox+8,oy-8,{color:'#c42020',size:11,bg:'rgba(255,255,255,0.85)'});

    // Fundamental domain outline
    ctx.strokeStyle='rgba(180,180,180,0.6)'; ctx.lineWidth=1.5;
    const [fx1,fy1]=vp.toCanvas(-0.5,Math.sqrt(0.75),W,H), [fx2,fy2]=vp.toCanvas(-0.5,vp.yMax,W,H);
    ctx.beginPath();ctx.moveTo(fx1,fy1);ctx.lineTo(fx2,fy2);ctx.stroke();
    const [fx3,fy3]=vp.toCanvas(0.5,Math.sqrt(0.75),W,H), [fx4,fy4]=vp.toCanvas(0.5,vp.yMax,W,H);
    ctx.beginPath();ctx.moveTo(fx3,fy3);ctx.lineTo(fx4,fy4);ctx.stroke();

    label(ctx, `SL(2,ℤ)-orbit of τ₀ (blue dots = {γτ₀: γ∈SL(2,ℤ), ad−bc=1})`, 8, 8, { color:'#333', size:11, bg:'rgba(255,255,255,0.9)' });
    label(ctx, `${orbitPts.length} orbit points shown — j(τ) is the SAME for all of these!`, 8, 26, { color:'#666', size:10, bg:'rgba(255,255,255,0.88)' });
  }

  coordInfo(cx,cy,W,H) {
    const [re,im] = this.vp.toWorld(cx,cy,W,H);
    return `τ = ${re.toFixed(4)} + ${im.toFixed(4)}i  ${im<=0?'(outside H)':''}`;
  }
}
