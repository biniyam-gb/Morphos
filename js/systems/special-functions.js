// Special Functions -- the workhorses of mathematical physics: Gamma,
// Bessel, and complete elliptic integrals, plus Stirling's asymptotic
// approximation to Gamma.
import { Viewport, drawAxes, clearCanvas, label } from '../plot.js';
import { hsv2rgb } from '../colormap.js';

// Lanczos approximation (g=7, standard published coefficients) -- accurate
// to ~15 digits, correctly reproduces Gamma(n)=(n-1)! and the poles at
// 0,-1,-2,... via the reflection formula.
const LANCZOS_G = 7;
const LANCZOS_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];
function gammaReal(x) {
  if (x < 0.5) {
    const s = Math.sin(Math.PI * x);
    if (Math.abs(s) < 1e-12) return Infinity; // pole at non-positive integers
    return Math.PI / (s * gammaReal(1 - x));
  }
  x -= 1;
  let a = LANCZOS_C[0];
  const t = x + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_G + 2; i++) a += LANCZOS_C[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
}
// Complex Gamma via the same Lanczos series, for domain coloring.
function gammaComplex(re, im) {
  if (re < 0.5) {
    // reflection: Gamma(z) = pi / (sin(pi z) Gamma(1-z))
    const sr = Math.sin(Math.PI * re) * Math.cosh(Math.PI * im);
    const si = Math.cos(Math.PI * re) * Math.sinh(Math.PI * im);
    const g = gammaComplex(1 - re, -im);
    const nr = Math.PI, ni = 0;
    // divide (nr,ni) by (sr*g.r - si*g.i, sr*g.i+si*g.r)
    const dr = sr * g.r - si * g.i, di = sr * g.i + si * g.r;
    const d2 = dr * dr + di * di || 1e-300;
    return { r: (nr * dr + ni * di) / d2, i: (ni * dr - nr * di) / d2 };
  }
  const zr = re - 1, zi = im;
  let ar = LANCZOS_C[0], ai = 0;
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    const dr = zr + i, di = zi;
    const d2 = dr * dr + di * di;
    ar += LANCZOS_C[i] * dr / d2;
    ai += -LANCZOS_C[i] * di / d2;
  }
  const tr = zr + LANCZOS_G + 0.5, ti = zi;
  // t^(z+0.5) = exp((z+0.5) * log(t))
  const logTmag = 0.5 * Math.log(tr * tr + ti * ti), logTarg = Math.atan2(ti, tr);
  const expR = zr + 0.5, expI = zi;
  const pr = expR * logTmag - expI * logTarg, pi = expR * logTarg + expI * logTmag;
  // exp(pr+i*pi) * exp(-t) * a
  const magPow = Math.exp(pr);
  const powR = magPow * Math.cos(pi), powI = magPow * Math.sin(pi);
  const eR = Math.exp(-tr) * Math.cos(-ti), eI = Math.exp(-tr) * Math.sin(-ti);
  const c1r = powR * eR - powI * eI, c1i = powR * eI + powI * eR;
  const c2r = c1r * ar - c1i * ai, c2i = c1r * ai + c1i * ar;
  const s = Math.sqrt(2 * Math.PI);
  return { r: s * c2r, i: s * c2i };
}

function besselJ(n, x, terms = 45) {
  if (x === 0) return n === 0 ? 1 : 0;
  const halfX = x / 2;
  let sum = 0, term = Math.pow(halfX, n) / factorial(n);
  for (let m = 0; m < terms; m++) {
    sum += term;
    term *= -(halfX * halfX) / ((m + 1) * (n + m + 1));
    if (Math.abs(term) < 1e-18 && m > 5) break;
  }
  return sum;
}
function factorial(k) { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; }

// K(m), E(m) in the "parameter" convention (m = k^2). K via the classical
// AGM identity (Gauss); E via direct Simpson-rule quadrature.
function ellipticK(m) {
  let a = 1, b = Math.sqrt(Math.max(0, 1 - m));
  for (let i = 0; i < 25; i++) { const an = (a + b) / 2, bn = Math.sqrt(a * b); a = an; b = bn; if (Math.abs(a - b) < 1e-15) break; }
  return Math.PI / (2 * a);
}
function ellipticE(m) {
  const N = 300, h = (Math.PI / 2) / N;
  let sum = 0;
  for (let i = 0; i <= N; i++) {
    const th = i * h;
    const f = Math.sqrt(Math.max(0, 1 - m * Math.sin(th) * Math.sin(th)));
    sum += (i === 0 || i === N) ? f : (i % 2 === 1 ? 4 * f : 2 * f);
  }
  return sum * h / 3;
}

export class SpecialFunctions {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.vp = new Viewport(-3, 6, -6, 6);
    this.params = {
      view: 'gamma',           // gamma | bessel | elliptic | stirling
      besselOrder: 0,
      besselMode: 'radial',     // radial | drumhead
      pendulumAmplitude: 2.8,   // radians, for elliptic-integral pendulum demo
    };
    this.paramDefs = [
      { group: 'Function', items: [
        { id: 'view', label: 'Function', type: 'select', options: ['gamma', 'bessel', 'elliptic', 'stirling'],
          tip: 'gamma: complex \u0393(z), poles at 0,-1,-2,... bessel: J_n(x), drumhead modes. elliptic: K(m),E(m), exact pendulum period. stirling: asymptotic accuracy.' },
      ]},
      { group: 'Gamma / Stirling', items: [
        { id: '_zin',   label: 'Zoom In',    type: 'button' },
        { id: '_zout',  label: 'Zoom Out',   type: 'button' },
        { id: '_reset', label: 'Reset View', type: 'button' },
      ]},
      { group: 'Bessel Functions', items: [
        { id: 'besselOrder', label: 'Order n', min: 0, max: 5, step: 1, type: 'range' },
        { id: 'besselMode', label: 'Display', type: 'select', options: ['radial', 'drumhead'],
          tip: 'radial: J_n(x) vs x. drumhead: 2D mode shape J_n(kr)cos(n\u03b8) of a vibrating circular membrane.' },
      ]},
      { group: 'Elliptic Integrals', items: [
        { id: 'pendulumAmplitude', label: 'Pendulum amplitude \u03b8\u2080 (rad)', min: 0.05, max: 3.1, step: 0.02, type: 'range',
          tip: 'The exact large-angle pendulum period uses K(sin\u00b2(\u03b8\u2080/2)) -- far from the small-angle approximation as \u03b8\u2080\u2192\u03c0.' },
      ]},
    ];
    this.presets = [
      { id: 'gamma-dc',   name: 'Gamma domain coloring', params: { view: 'gamma' } },
      { id: 'bessel-rad', name: 'Bessel J\u2080, J\u2081, J\u2082',   params: { view: 'bessel', besselMode: 'radial' } },
      { id: 'drum',        name: 'Vibrating drumhead mode', params: { view: 'bessel', besselMode: 'drumhead', besselOrder: 2 } },
      { id: 'elliptic',    name: 'Pendulum period (exact)', params: { view: 'elliptic', pendulumAmplitude: 2.8 } },
      { id: 'stirling',    name: "Stirling's approximation", params: { view: 'stirling' } },
    ];
    this.domain = 'Special Functions';
    this.stepsPerFrame = 0;
    this._dirty = true;
  }

  get description() {
    const m = {
      gamma: '\u0393(z) extends the factorial to all complex z: \u0393(n)=(n\u22121)! for positive integers. Simple poles at z=0,\u22121,\u22122,\u2026 with residue (\u22121)\u207f/n!.',
      bessel: 'Solutions to Bessel\u2019s ODE x\u00b2y\u2033+xy\u2032+(x\u00b2\u2212n\u00b2)y=0. They are the natural radial modes of any circularly symmetric wave problem -- drumheads, optical fibers, and antenna patterns all use them.',
      elliptic: 'K(m) and E(m) arise from arc-length integrals on an ellipse. They give the EXACT period of a pendulum at any amplitude -- the familiar T=2\u03c0\u221a(L/g) is only the m\u21920 limit.',
      stirling: "Stirling's formula ln\u0393(x)\u2248(x\u2212\u00bd)ln x\u2212x+\u00bdln(2\u03c0) is astonishingly accurate even for modest x -- the relative error shrinks like 1/(12x).",
    };
    return m[this.params.view] || '';
  }
  getFormula() {
    const m = {
      gamma: '\u0393(z) = \u222b\u2080^\u221e t^(z\u22121) e^(\u2212t) dt   (analytically continued)',
      bessel: `J_n(x) = \u03a3_{m=0}^\u221e (\u22121)^m/(m!(n+m)!) \u00b7 (x/2)^(n+2m)`,
      elliptic: 'K(m) = \u222b\u2080^(\u03c0/2) d\u03b8/\u221a(1\u2212m sin\u00b2\u03b8)   E(m) = \u222b\u2080^(\u03c0/2) \u221a(1\u2212m sin\u00b2\u03b8) d\u03b8',
      stirling: 'ln \u0393(x) \u2248 (x\u2212\u00bd)ln x \u2212 x + \u00bdln(2\u03c0) + 1/(12x) \u2212 \u2026',
    };
    return m[this.params.view] || '';
  }

  reset() { this.vp = new Viewport(-3, 6, -6, 6); this._dirty = true; }
  update() {}
  onParamChange(id) {
    if (id === '_zin') this.vp.zoom(0.5, this.canvasW / 2, this.canvasH / 2, this.canvasW, this.canvasH);
    if (id === '_zout') this.vp.zoom(2, this.canvasW / 2, this.canvasH / 2, this.canvasW, this.canvasH);
    if (id === '_reset') this.reset();
    this._dirty = true;
  }
  onMouseDrag(ddx, ddy, cx, cy, W, H) { this.vp.pan(ddx, ddy, W, H); this._dirty = true; }
  onWheel(cx, cy, delta, W, H) { this.vp.zoom(delta > 0 ? 1.3 : 0.77, cx, cy, W, H); this._dirty = true; }

  render(ctx, canvas) {
    if (!this._dirty) return; this._dirty = false;
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const v = this.params.view;
    if (v === 'gamma') this._renderGamma(ctx, W, H);
    else if (v === 'bessel') this._renderBessel(ctx, W, H);
    else if (v === 'elliptic') this._renderElliptic(ctx, W, H);
    else if (v === 'stirling') this._renderStirling(ctx, W, H);
  }

  _renderGamma(ctx, W, H) {
    const vp = this.vp;
    const RS = 0.38;
    const rW = Math.max(60, Math.floor(W * RS)), rH = Math.max(60, Math.floor(H * RS));
    const imgd = ctx.createImageData(rW, rH);
    const data = imgd.data;
    for (let py = 0; py < rH; py++) {
      for (let px = 0; px < rW; px++) {
        const [re, im] = vp.toWorld(px * W / rW, py * H / rH, W, H);
        const p = (py * rW + px) * 4;
        const { r, i } = gammaComplex(re, im);
        if (!isFinite(r) || !isFinite(i)) { data[p] = 15; data[p+1] = 15; data[p+2] = 15; data[p+3] = 255; continue; }
        const mag = Math.sqrt(r * r + i * i), phase = Math.atan2(i, r);
        const hue = phase / (2 * Math.PI) + 0.5;
        const logM = mag > 0 ? Math.log(mag) : -20;
        let v2 = Math.pow(Math.max(0.08, Math.min(1, 0.5 + 0.5 * Math.sin(logM * Math.PI / Math.LN2))), 0.6);
        const [rr, gg, bb] = hsv2rgb(hue, 0.9, v2);
        data[p] = rr; data[p+1] = gg; data[p+2] = bb; data[p+3] = 255;
      }
    }
    const tmp = document.createElement('canvas'); tmp.width = rW; tmp.height = rH;
    tmp.getContext('2d').putImageData(imgd, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(tmp, 0, 0, W, H);
    for (let n = 0; n <= 5; n++) {
      const [px, py] = vp.toCanvas(-n, 0, W, H);
      if (px >= 0 && px <= W) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.stroke(); }
    }
    label(ctx, '\u0393(z) domain coloring \u2014 white dots mark poles at z=0,\u22121,\u22122,\u2026', 8, 8, { color: '#fff', size: 11, bg: 'rgba(0,0,0,0.5)' });
  }

  _renderBessel(ctx, W, H) {
    if (this.params.besselMode === 'radial') this._renderBesselRadial(ctx, W, H);
    else this._renderBesselDrumhead(ctx, W, H);
  }
  _renderBesselRadial(ctx, W, H) {
    const vp = new Viewport(0, 20, -0.6, 1.05);
    drawAxes(ctx, vp, W, H);
    const cols = ['#1a4fa8', '#c42020', '#1a6b1a', '#a05000', '#6020a0', '#1a7a7a'];
    for (let n = 0; n <= this.params.besselOrder; n++) {
      ctx.strokeStyle = cols[n % cols.length]; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 400; i++) {
        const x = 20 * i / 400;
        const y = besselJ(n, x);
        const [cx, cy] = vp.toCanvas(x, y, W, H);
        i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      label(ctx, `J${['\u2080','\u2081','\u2082','\u2083','\u2084','\u2085'][n]}(x)`, 12, 12 + n * 14, { color: cols[n % cols.length], size: 11, bg: 'rgba(255,255,255,0.85)' });
    }
  }
  _renderBesselDrumhead(ctx, W, H) {
    const n = this.params.besselOrder;
    // Use the k such that J_n(k)=0 approximately (first zero-crossing scan) so the
    // mode fits exactly within the unit drum -- fixed boundary condition.
    let k = 0;
    for (let x = 0.1; x < 20; x += 0.01) { if (besselJ(n, x) < 0 && besselJ(n, x - 0.01) >= 0) { k = x; break; } }
    if (k === 0) k = 3.83;
    const size = Math.min(W, H) * 0.42, cx = W / 2, cy = H / 2;
    const res = 140;
    const imgd = ctx.createImageData(res, res);
    const data = imgd.data;
    for (let py = 0; py < res; py++) {
      for (let px = 0; px < res; px++) {
        const x = (px / res) * 2 - 1, y = (py / res) * 2 - 1;
        const r = Math.sqrt(x * x + y * y), theta = Math.atan2(y, x);
        const p = (py * res + px) * 4;
        if (r > 1) { data[p] = 240; data[p+1]=240; data[p+2]=240; data[p+3]=255; continue; }
        const z = besselJ(n, k * r) * Math.cos(n * theta);
        const t = 0.5 + 0.5 * Math.max(-1, Math.min(1, z * 2));
        const hue = 220 - t * 220;
        const [rr, gg, bb] = hsv2rgb(hue / 360, 0.8, 0.5 + 0.4 * Math.abs(z * 2));
        data[p] = rr; data[p+1] = gg; data[p+2] = bb; data[p+3] = 255;
      }
    }
    const tmp = document.createElement('canvas'); tmp.width = res; tmp.height = res;
    tmp.getContext('2d').putImageData(imgd, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, cx - size, cy - size, size * 2, size * 2);
    label(ctx, `Vibrating circular drumhead: J_${n}(kr)cos(${n}\u03b8), k\u2248${k.toFixed(3)} (fixed rim)`, 8, 8, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, `${n} angular nodal diameter${n===1?'':'s'} \u2014 red/blue = displacement up/down`, 8, H - 16, { color: '#666', size: 10 });
  }

  _renderElliptic(ctx, W, H) {
    const pad = 46;
    const leftW = W * 0.5;
    const vp = new Viewport(0, 1, 0, 4);
    // K(m), E(m) over m in [0,1)
    ctx.save();
    ctx.translate(0, 0);
    const tx = m => pad + m * (leftW - 2 * pad), ty = v => H - pad - (v / 4) * (H - 2 * pad);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(leftW - pad, H - pad); ctx.stroke();
    ctx.strokeStyle = '#1a4fa8'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const m = i / 200 * 0.995; const y = ty(ellipticK(m)); i === 0 ? ctx.moveTo(tx(m), y) : ctx.lineTo(tx(m), y); }
    ctx.stroke();
    ctx.strokeStyle = '#c42020'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const m = i / 200; const y = ty(ellipticE(m)); i === 0 ? ctx.moveTo(tx(m), y) : ctx.lineTo(tx(m), y); }
    ctx.stroke();
    label(ctx, 'K(m) blue (\u2192\u221e as m\u21921)   E(m) red', pad, 12, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.9)' });
    ctx.restore();

    // Right: exact pendulum period vs small-angle approx
    const theta0 = this.params.pendulumAmplitude;
    const m = Math.sin(theta0 / 2) ** 2;
    const exactPeriod = 4 * ellipticK(m) / (2 * Math.PI); // in units of small-angle period T0=2pi
    const smallAnglePeriod = 1;
    const gx = leftW + 30, gw = W - leftW - 60, gy = 40, gh = H - 100;
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    const maxP = 2.2;
    const barW = gw * 0.25;
    ctx.fillStyle = 'rgba(160,160,160,0.7)';
    ctx.fillRect(gx + gw * 0.2, gy + gh - (smallAnglePeriod / maxP) * gh, barW, (smallAnglePeriod / maxP) * gh);
    ctx.fillStyle = 'rgba(196,32,32,0.75)';
    ctx.fillRect(gx + gw * 0.55, gy + gh - (exactPeriod / maxP) * gh, barW, (exactPeriod / maxP) * gh);
    label(ctx, 'small-angle T\u2080', gx + gw * 0.2 - 4, gy + gh + 4, { color: '#888', size: 10 });
    label(ctx, 'exact T', gx + gw * 0.55 + 10, gy + gh + 4, { color: '#c42020', size: 10 });
    label(ctx, `\u03b8\u2080 = ${theta0.toFixed(2)} rad (${(theta0*180/Math.PI).toFixed(0)}\u00b0)`, gx, gy - 20, { color: '#333', size: 12, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, `T / T\u2080 = ${exactPeriod.toFixed(4)}`, gx, gy - 4, { color: '#c42020', size: 12, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, 'T = (4/\u03c0)K(sin\u00b2(\u03b8\u2080/2)) \u00b7 T\u2080/4  \u2014 diverges as \u03b8\u2080\u2192\u03c0 (pendulum balanced upright)', gx, H - 16, { color: '#666', size: 9 });
  }

  _renderStirling(ctx, W, H) {
    const vp = new Viewport(0.5, 10, -2, 15);
    drawAxes(ctx, vp, W, H);
    ctx.strokeStyle = '#1a4fa8'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 300; i++) { const x = 0.5 + 9.5 * i / 300; const y = Math.log(Math.abs(gammaReal(x))); const [cx,cy]=vp.toCanvas(x,y,W,H); i===0?ctx.moveTo(cx,cy):ctx.lineTo(cx,cy); }
    ctx.stroke();
    ctx.strokeStyle = '#c42020'; ctx.lineWidth = 2; ctx.setLineDash([5,3]);
    ctx.beginPath();
    for (let i = 0; i <= 300; i++) { const x = 0.5 + 9.5*i/300; const y = (x-0.5)*Math.log(x) - x + 0.5*Math.log(2*Math.PI); const [cx,cy]=vp.toCanvas(x,y,W,H); i===0?ctx.moveTo(cx,cy):ctx.lineTo(cx,cy); }
    ctx.stroke(); ctx.setLineDash([]);
    label(ctx, 'Blue: ln \u0393(x) exact   Red dashed: Stirling approximation', 8, 8, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.9)' });
    const x0 = 5;
    const exact = Math.log(gammaReal(x0)), approx = (x0-0.5)*Math.log(x0)-x0+0.5*Math.log(2*Math.PI);
    label(ctx, `At x=${x0}: exact=${exact.toFixed(5)}  Stirling=${approx.toFixed(5)}  error=${Math.abs(exact-approx).toExponential(2)}`, 8, H - 16, { color: '#666', size: 10 });
  }

  coordInfo(cx, cy, W, H) {
    if (this.params.view === 'gamma') {
      const [re, im] = this.vp.toWorld(cx, cy, W, H);
      const { r, i } = gammaComplex(re, im);
      return `z=${re.toFixed(3)}+${im.toFixed(3)}i  \u0393(z)\u2248${r.toFixed(3)}+${i.toFixed(3)}i`;
    }
    return `view: ${this.params.view}`;
  }
}
