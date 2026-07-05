// Control Theory & Cybernetics -- feedback loops, PID control, stability
// Models a plant G(s) = 1/(s^2 + a*s + b) (a general 2nd-order system:
// mass-spring-damper, RLC circuit, thermal system, etc.) under closed-loop
// PID control, plus frequency-domain (Bode) and pole-placement (root locus)
// views of the same feedback loop.
import { clearCanvas, label } from '../plot.js';

// Simulate the closed loop with RK4 on the state [y, y', integral_error].
// Plant: y'' + a*y' + b*y = u(t)   (standard 2nd-order plant)
// Controller: u = Kp*e + Ki*integral(e) + Kd*e'   where e = setpoint - y
function simulateStep(state, params, t, dt) {
  const { a, b, Kp, Ki, Kd, setpoint, disturbanceAt, disturbanceMag } = params;
  const f = (s) => {
    const [y, dy, ei] = s;
    const e = setpoint - y;
    const de = -dy; // d/dt(setpoint - y) = -dy since setpoint constant
    const u = Kp * e + Ki * ei + Kd * de;
    let disturbance = 0;
    if (disturbanceAt >= 0 && t >= disturbanceAt && t < disturbanceAt + 0.05) disturbance = disturbanceMag / 0.05;
    const ddy = u + disturbance - a * dy - b * y;
    return [dy, ddy, e];
  };
  const k1 = f(state);
  const k2 = f(state.map((s, i) => s + dt * k1[i] / 2));
  const k3 = f(state.map((s, i) => s + dt * k2[i] / 2));
  const k4 = f(state.map((s, i) => s + dt * k3[i]));
  return state.map((s, i) => s + dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
}

const PRESETS = {
  'Well-tuned PID': { a: 1.0, b: 4.0, Kp: 8, Ki: 4, Kd: 2, desc: 'Balanced gains: fast rise, small overshoot, settles quickly. This is what good tuning looks like.' },
  'P-only (offset)': { a: 1.0, b: 4.0, Kp: 6, Ki: 0, Kd: 0, desc: 'Proportional-only control leaves a permanent steady-state error against a constant disturbance -- there is nothing to integrate the error away.' },
  'Underdamped (high Kp)': { a: 1.0, b: 4.0, Kp: 40, Ki: 2, Kd: 0.5, desc: 'High proportional gain with weak damping causes large overshoot and ringing before settling.' },
  'Unstable (too aggressive)': { a: 0.2, b: 1.0, Kp: 60, Ki: 30, Kd: 0.1, desc: 'Gains pushed past the stability margin -- oscillations grow rather than decay. In a real system this destroys the actuator.' },
  'Overdamped (sluggish)': { a: 1.0, b: 4.0, Kp: 1.5, Ki: 0.3, Kd: 3, desc: 'Heavy derivative damping with low proportional gain: no overshoot, but slow to reach the setpoint.' },
  'Integral windup': { a: 1.0, b: 4.0, Kp: 3, Ki: 15, Kd: 0, desc: 'Large Ki with no derivative term causes the integral term to overshoot before it can unwind -- classic "integral windup" oscillation.' },
  'PD only (no integral)': { a: 1.0, b: 4.0, Kp: 8, Ki: 0, Kd: 2, desc: 'No integral term means fast, well-damped response but a lasting steady-state offset once a disturbance hits.' },
};

export class ControlTheory {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = {
      view: 'step-response',   // step-response | bode | root-locus | block-diagram
      a: 1.0, b: 4.0,           // plant: y'' + a y' + b y = u
      Kp: 8, Ki: 4, Kd: 2,
      setpoint: 1.0,
      disturbanceAt: 4.0, disturbanceMag: -0.6,
      dt: 0.01, speed: 4, tMax: 10,
    };
    this.paramDefs = [
      { group: 'View', items: [
        { id: 'view', label: 'Visualization', type: 'select',
          options: ['step-response', 'bode', 'root-locus', 'block-diagram'],
          tip: 'step-response: y(t) tracking a setpoint. bode: open-loop frequency response. root-locus: closed-loop pole paths as Kp varies. block-diagram: the feedback loop itself.' },
      ]},
      { group: 'Plant  G(s) = 1/(s^2 + a*s + b)', items: [
        { id: 'a', label: 'Damping a', min: 0.05, max: 5, step: 0.05, type: 'range', tip: 'Natural damping of the uncontrolled plant (friction, resistance, ...).' },
        { id: 'b', label: 'Stiffness b', min: 0.2, max: 10, step: 0.1, type: 'range', tip: 'Natural stiffness/restoring force (spring constant, 1/LC, ...).' },
      ]},
      { group: 'PID Controller  u = Kp*e + Ki*Int(e) + Kd*de/dt', items: [
        { id: 'Kp', label: 'Kp (proportional)', min: 0, max: 60, step: 0.5, type: 'range', tip: 'Pushes toward the setpoint proportional to current error. Too high -> oscillation.' },
        { id: 'Ki', label: 'Ki (integral)',     min: 0, max: 40, step: 0.5, type: 'range', tip: 'Eliminates steady-state error by accumulating past error. Too high -> windup/overshoot.' },
        { id: 'Kd', label: 'Kd (derivative)',   min: 0, max: 10, step: 0.1, type: 'range', tip: 'Damps oscillation by reacting to the rate of change of error. Too high -> noise sensitivity.' },
      ]},
      { group: 'Simulation', items: [
        { id: 'setpoint', label: 'Setpoint', min: -2, max: 2, step: 0.1, type: 'range' },
        { id: 'disturbanceAt', label: 'Disturbance time (s)', min: -1, max: 9, step: 0.5, type: 'range', tip: 'Negative = no disturbance. A sudden impulse tests the controller\u2019s rejection.' },
        { id: 'disturbanceMag', label: 'Disturbance magnitude', min: -2, max: 2, step: 0.1, type: 'range' },
      ]},
    ];
    this.presets = Object.keys(PRESETS).map(k => ({ id: k, name: k, params: { ...PRESETS[k], view: 'step-response' } }));
    this.domain = 'Control Theory';
    this.stepsPerFrame = 1;
    this._history = [];
    this._t = 0;
    this._state = [0, 0, 0];
    this._loadPreset('Well-tuned PID');
  }

  _loadPreset(name) {
    const p = PRESETS[name]; if (!p) return;
    Object.assign(this.params, p);
    this.description = p.desc;
    this._reset();
  }

  getFormula() {
    const { a, b, Kp, Ki, Kd } = this.params;
    return `Plant: y\u2033+${a.toFixed(2)}y\u2032+${b.toFixed(2)}y=u   Controller: u=${Kp.toFixed(1)}e+${Ki.toFixed(1)}\u222be+${Kd.toFixed(1)}e\u2032`;
  }

  _reset() {
    this._state = [0, 0, 0];
    this._t = 0;
    this._history = [{ t: 0, y: 0, u: 0, e: this.params.setpoint }];
  }
  reset() { this._reset(); }

  onParamChange(id) {
    if (id === '_preset') { this.description = this.description || ''; }
    this._reset();
  }

  update() {
    const { dt, speed, tMax } = this.params;
    for (let i = 0; i < speed; i++) {
      if (this._t >= tMax) return;
      this._state = simulateStep(this._state, this.params, this._t, dt);
      this._t += dt;
      const [y, , ei] = this._state;
      const e = this.params.setpoint - y;
      const u = this.params.Kp * e + this.params.Ki * ei + this.params.Kd * (-this._state[1]);
      this._history.push({ t: this._t, y, u, e });
      if (this._history.length > 3000) this._history.shift();
    }
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const v = this.params.view;
    if (v === 'step-response') this._renderStep(ctx, W, H);
    else if (v === 'bode') this._renderBode(ctx, W, H);
    else if (v === 'root-locus') this._renderRootLocus(ctx, W, H);
    else if (v === 'block-diagram') this._renderBlockDiagram(ctx, W, H);
  }

  _renderStep(ctx, W, H) {
    const pad = 46, tMax = this.params.tMax;
    const hist = this._history;
    const allY = hist.map(h => h.y);
    const yMin = Math.min(-0.3, ...allY) - 0.2, yMax = Math.max(this.params.setpoint + 0.3, ...allY) + 0.2;
    const tx = t => pad + (t / tMax) * (W - 2 * pad);
    const ty = y => H - pad - (y - yMin) / (yMax - yMin) * (H - 2 * pad - 20);

    // Grid + setpoint line
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,80,0,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(pad, ty(this.params.setpoint)); ctx.lineTo(W - pad, ty(this.params.setpoint)); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'setpoint', W - pad - 55, ty(this.params.setpoint) - 16, { color: '#a05000', size: 10 });

    // Disturbance marker
    if (this.params.disturbanceAt >= 0 && this.params.disturbanceAt <= tMax) {
      const x = tx(this.params.disturbanceAt);
      ctx.strokeStyle = 'rgba(196,32,32,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, 'disturbance', x + 4, pad, { color: '#c42020', size: 10 });
    }

    // y(t) response
    ctx.strokeStyle = '#1a4fa8'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    hist.forEach((h, i) => { i === 0 ? ctx.moveTo(tx(h.t), ty(h.y)) : ctx.lineTo(tx(h.t), ty(h.y)); });
    ctx.stroke();

    // u(t) control effort (secondary, small)
    const uMax = Math.max(1, ...hist.map(h => Math.abs(h.u)));
    ctx.strokeStyle = 'rgba(26,107,26,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath();
    hist.forEach((h, i) => {
      const uy = H - pad - (h.u / uMax) * 30 - 4;
      i === 0 ? ctx.moveTo(tx(h.t), uy) : ctx.lineTo(tx(h.t), uy);
    });
    ctx.stroke();

    label(ctx, this.getFormula(), pad, 8, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, 'Blue: y(t) response to setpoint   Green: u(t) control effort (scaled)   Orange dashed: setpoint', pad, 26, { color: '#555', size: 10, bg: 'rgba(255,255,255,0.86)' });
    ctx.fillStyle = '#888'; ctx.font = '10px Courier New'; ctx.textAlign = 'center';
    ctx.fillText('time (s)', W / 2, H - 8);
  }

  _renderBode(ctx, W, H) {
    // Open-loop transfer function (controller * plant), no feedback closed yet:
    // L(jw) = (Kp + Ki/(jw) + Kd*jw) * 1/((jw)^2 + a(jw) + b)
    const { a, b, Kp, Ki, Kd } = this.params;
    const pad = 50;
    const wMin = 0.05, wMax = 100;
    const N = 300;
    const mags = [], phases = [];
    for (let i = 0; i <= N; i++) {
      const logW = Math.log10(wMin) + (Math.log10(wMax) - Math.log10(wMin)) * i / N;
      const w = Math.pow(10, logW);
      // Controller C(jw) = Kp + Ki/(jw) + Kd(jw) = Kp + Kd*jw - j*Ki/w  (since 1/j = -j)
      const Cr = Kp, Ci = Kd * w - Ki / w;
      // Plant G(jw) = 1/((jw)^2+a(jw)+b) = 1/(-w^2+b + j a w)
      const Gr_den = b - w * w, Gi_den = a * w;
      const den2 = Gr_den * Gr_den + Gi_den * Gi_den;
      const Gr = Gr_den / den2, Gi = -Gi_den / den2;
      // L = C * G
      const Lr = Cr * Gr - Ci * Gi, Li = Cr * Gi + Ci * Gr;
      const mag = Math.sqrt(Lr * Lr + Li * Li);
      const phase = Math.atan2(Li, Lr) * 180 / Math.PI;
      mags.push({ w, db: 20 * Math.log10(mag) });
      phases.push({ w, deg: phase });
    }
    const magH = (H - 3 * pad) / 2, phaseY0 = pad + magH + pad;
    const tx = w => pad + (Math.log10(w) - Math.log10(wMin)) / (Math.log10(wMax) - Math.log10(wMin)) * (W - 2 * pad);
    const dbMin = Math.min(-40, ...mags.map(m => m.db)), dbMax = Math.max(40, ...mags.map(m => m.db));
    const tyMag = db => pad + magH - (db - dbMin) / (dbMax - dbMin) * magH;
    const tyPhase = deg => phaseY0 + magH - (deg + 270) / 360 * magH;

    // Magnitude plot
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, tyMag(0)); ctx.lineTo(W - pad, tyMag(0)); ctx.stroke();
    ctx.strokeStyle = '#1a4fa8'; ctx.lineWidth = 2;
    ctx.beginPath(); mags.forEach((m, i) => { i === 0 ? ctx.moveTo(tx(m.w), tyMag(m.db)) : ctx.lineTo(tx(m.w), tyMag(m.db)); }); ctx.stroke();
    label(ctx, 'Magnitude |L(j\u03c9)| (dB)', pad, pad - 14, { color: '#333', size: 11 });

    // Phase plot
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, tyPhase(-180)); ctx.lineTo(W - pad, tyPhase(-180)); ctx.stroke();
    ctx.strokeStyle = '#c42020'; ctx.lineWidth = 2;
    ctx.beginPath(); phases.forEach((p, i) => { i === 0 ? ctx.moveTo(tx(p.w), tyPhase(p.deg)) : ctx.lineTo(tx(p.w), tyPhase(p.deg)); }); ctx.stroke();
    label(ctx, 'Phase \u2220L(j\u03c9) (\u00b0), \u2212180\u00b0 marked', pad, phaseY0 - 14, { color: '#333', size: 11 });

    // Find gain crossover (0dB) and phase there -> phase margin
    let crossW = null;
    for (let i = 1; i < mags.length; i++) {
      if ((mags[i - 1].db >= 0) !== (mags[i].db >= 0)) { crossW = mags[i].w; break; }
    }
    if (crossW) {
      const x = tx(crossW);
      ctx.strokeStyle = 'rgba(26,107,26,0.6)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke(); ctx.setLineDash([]);
      const idx = mags.findIndex(m => m.w === crossW);
      const pm = 180 + (phases[idx]?.deg ?? -180);
      label(ctx, `Phase margin \u2248 ${pm.toFixed(0)}\u00b0 at gain crossover`, x + 4, pad + 4, { color: '#1a6b1a', size: 10, bg: 'rgba(255,255,255,0.85)' });
    }
    label(ctx, 'Open-loop Bode plot: L(s) = C(s)G(s)  \u2014  margins predict closed-loop stability', pad, H - 16, { color: '#666', size: 10 });
  }

  _renderRootLocus(ctx, W, H) {
    // Closed-loop char. eq: s^2 + a s + b + Kp(1 + Ki_ratio/s + Kd_ratio*s) = 0
    // Simplify: sweep Kp (with fixed Ki,Kd ratios relative to current values scaled) and
    // find closed-loop poles of: s^2 + (a+Kd*k)s + (b+Kp*k) ... use a clean PD-only locus
    // for clarity: s^2 + (a + Kd*k)s + (b + Kp*k) = 0 as k in [0, kMax], showing how
    // poles move -- classic root locus intuition using this system's own gains as direction.
    const { a, b, Kp, Kd } = this.params;
    const pad = 40;
    const vp = { xMin: -8, xMax: 3, yMin: -6, yMax: 6 };
    const tx = re => pad + (re - vp.xMin) / (vp.xMax - vp.xMin) * (W - 2 * pad);
    const ty = im => H - pad - (im - vp.yMin) / (vp.yMax - vp.yMin) * (H - 2 * pad);

    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx(0), pad); ctx.lineTo(tx(0), H - pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, ty(0)); ctx.lineTo(W - pad, ty(0)); ctx.stroke();
    ctx.fillStyle = 'rgba(196,32,32,0.06)';
    ctx.fillRect(tx(0), pad, W - pad - tx(0), H - 2 * pad);
    label(ctx, 'unstable (Re>0)', tx(0) + 6, pad + 4, { color: 'rgba(196,32,32,0.6)', size: 10 });

    // Sweep k from 0 to a value that scales up to current Kp, Kd
    const N = 400;
    ctx.strokeStyle = 'rgba(100,100,180,0.5)'; ctx.lineWidth = 1;
    let prevR1 = null, prevR2 = null;
    for (let i = 0; i <= N; i++) {
      const k = (i / N) * Math.max(Kp, 1) * 1.4;
      const A = 1, B = a + Kd * (k / Math.max(Kp, 1)), C = b + k;
      const disc = B * B - 4 * A * C;
      let r1, r2;
      if (disc >= 0) { const s = Math.sqrt(disc); r1 = { re: (-B + s) / 2, im: 0 }; r2 = { re: (-B - s) / 2, im: 0 }; }
      else { const s = Math.sqrt(-disc); r1 = { re: -B / 2, im: s / 2 }; r2 = { re: -B / 2, im: -s / 2 }; }
      if (prevR1) {
        ctx.beginPath(); ctx.moveTo(tx(prevR1.re), ty(prevR1.im)); ctx.lineTo(tx(r1.re), ty(r1.im)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx(prevR2.re), ty(prevR2.im)); ctx.lineTo(tx(r2.re), ty(r2.im)); ctx.stroke();
      }
      prevR1 = r1; prevR2 = r2;
    }
    // Current pole location (k = Kp)
    const B0 = a + Kd, C0 = b + Kp, disc0 = B0 * B0 - 4 * C0;
    let cur1, cur2;
    if (disc0 >= 0) { const s = Math.sqrt(disc0); cur1 = { re: (-B0 + s) / 2, im: 0 }; cur2 = { re: (-B0 - s) / 2, im: 0 }; }
    else { const s = Math.sqrt(-disc0); cur1 = { re: -B0 / 2, im: s / 2 }; cur2 = { re: -B0 / 2, im: -s / 2 }; }
    ctx.fillStyle = '#c42020';
    [cur1, cur2].forEach(p => { ctx.beginPath(); ctx.arc(tx(p.re), ty(p.im), 5, 0, Math.PI * 2); ctx.fill(); });
    label(ctx, `Current poles: ${cur1.re.toFixed(2)}${cur1.im >= 0 ? '+' : ''}${cur1.im.toFixed(2)}i, ${cur2.re.toFixed(2)}${cur2.im >= 0 ? '+' : ''}${cur2.im.toFixed(2)}i`, pad, 8, { color: '#c42020', size: 11, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, 'Root locus: closed-loop pole paths as gain sweeps 0 \u2192 current(Kp,Kd). Poles in right half \u2192 unstable.', pad, 26, { color: '#555', size: 10, bg: 'rgba(255,255,255,0.86)' });
  }

  _renderBlockDiagram(ctx, W, H) {
    const cy = H / 2;
    const boxes = [
      { x: W * 0.08, w: 60, label: 'r(t)', isPoint: true },
      { x: W * 0.22, w: 70, label: 'Controller\nC(s)' },
      { x: W * 0.48, w: 70, label: 'Plant\nG(s)' },
      { x: W * 0.75, w: 60, label: 'y(t)', isPoint: true },
    ];
    const boxH = 60;
    // Sum junction
    const sumX = W * 0.16, sumY = cy;
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sumX, sumY, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '16px Courier New'; ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+', sumX - 6, sumY - 6); ctx.fillText('\u2212', sumX + 6, sumY + 8);

    // r(t) -> sum
    ctx.beginPath(); ctx.moveTo(boxes[0].x + boxes[0].w, cy); ctx.lineTo(sumX - 16, cy); ctx.stroke();
    label(ctx, 'r(t) setpoint', boxes[0].x, cy - 30, { color: '#555', size: 11 });

    // sum -> controller
    const cX = boxes[1].x;
    ctx.beginPath(); ctx.moveTo(sumX + 16, cy); ctx.lineTo(cX, cy); ctx.stroke();
    ctx.strokeStyle = '#1a4fa8'; ctx.strokeRect(cX, cy - boxH / 2, boxes[1].w, boxH);
    ctx.fillStyle = '#1a4fa8'; ctx.font = '12px Courier New';
    ctx.fillText('Controller', cX + boxes[1].w / 2, cy - 8);
    ctx.fillText('C(s)', cX + boxes[1].w / 2, cy + 10);

    // controller -> plant
    const pX = boxes[2].x;
    ctx.strokeStyle = '#333';
    ctx.beginPath(); ctx.moveTo(cX + boxes[1].w, cy); ctx.lineTo(pX, cy); ctx.stroke();
    label(ctx, 'u(t)', (cX + boxes[1].w + pX) / 2 - 12, cy - 26, { color: '#1a6b1a', size: 10 });
    ctx.strokeStyle = '#c42020'; ctx.strokeRect(pX, cy - boxH / 2, boxes[2].w, boxH);
    ctx.fillStyle = '#c42020'; ctx.font = '12px Courier New';
    ctx.fillText('Plant', pX + boxes[2].w / 2, cy - 8);
    ctx.fillText('G(s)', pX + boxes[2].w / 2, cy + 10);

    // plant -> output
    const outX = boxes[3].x;
    ctx.strokeStyle = '#333';
    ctx.beginPath(); ctx.moveTo(pX + boxes[2].w, cy); ctx.lineTo(outX, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(outX - 8, cy - 5); ctx.lineTo(outX, cy); ctx.lineTo(outX - 8, cy + 5); ctx.stroke();
    label(ctx, 'y(t) output', outX + 2, cy - 8, { color: '#555', size: 12 });

    // Feedback path
    const fbY = cy + 110;
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(outX - 20, cy); ctx.lineTo(outX - 20, fbY);
    ctx.lineTo(sumX, fbY); ctx.lineTo(sumX, sumY + 16);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sumX - 5, sumY + 10); ctx.lineTo(sumX, sumY + 16); ctx.lineTo(sumX + 5, sumY + 10); ctx.stroke();
    label(ctx, 'feedback (sensor measurement)', (outX + sumX) / 2 - 90, fbY + 6, { color: '#888', size: 10 });

    label(ctx, 'Closed-loop feedback control system \u2014 the fundamental diagram of cybernetics (Wiener, 1948)', 10, 10, { color: '#333', size: 12, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, 'e(t) = r(t) \u2212 y(t)  is fed to the controller; this error-correction loop is what "cybernetics" means', 10, 28, { color: '#666', size: 10, bg: 'rgba(255,255,255,0.86)' });
  }

  coordInfo() { return `t=${this._t.toFixed(2)}s / ${this.params.tMax}s`; }
}
