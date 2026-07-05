// Double Pendulum -- Lagrangian mechanics, deterministic chaos
import { clearCanvas, label, dot } from '../plot.js';

// Standard double-pendulum equations of motion (point masses, massless rods).
// Delta = th1 - th2, used consistently (this is the part that's easy to get
// backwards -- a single sign flip here makes the simulation "look" chaotic
// but be physically wrong).
function dpEOM(state, m1, m2, l1, l2, g) {
  const [th1, w1, th2, w2] = state;
  const delta = th1 - th2;
  const sD = Math.sin(delta), cD = Math.cos(delta);
  const den = (2*m1 + m2 - m2*Math.cos(2*delta));

  const num1 = -g*(2*m1+m2)*Math.sin(th1)
               - m2*g*Math.sin(th1-2*th2)
               - 2*sD*m2*(w2*w2*l2 + w1*w1*l1*cD);
  const dth1 = num1 / (l1*den);

  const num2 = 2*sD*(w1*w1*l1*(m1+m2) + g*(m1+m2)*Math.cos(th1) + w2*w2*l2*m2*cD);
  const dth2 = num2 / (l2*den);

  return [w1, dth1, w2, dth2];
}

function rk4dp(state, m1, m2, l1, l2, g, dt) {
  const f = s => dpEOM(s, m1, m2, l1, l2, g);
  const k1 = f(state);
  const k2 = f(state.map((s,i) => s + dt*k1[i]/2));
  const k3 = f(state.map((s,i) => s + dt*k2[i]/2));
  const k4 = f(state.map((s,i) => s + dt*k3[i]));
  return state.map((s,i) => s + dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}

export class DoublePendulum {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = {
      th1: Math.PI/2, w1: 0, th2: Math.PI/2 + 0.01, w2: 0,
      m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81,
      view: 'pendulum',
      numExtra: 3, dt: 0.01, speed: 3,
      trailLen: 800,
    };
    this.paramDefs = [
      { group: 'Initial Conditions', items: [
        { id: 'th1', label: 'th1 (initial)', min: -Math.PI, max: Math.PI, step: 0.01, type: 'range', tip: 'Angle of upper bob from vertical.' },
        { id: 'th2', label: 'th2 (initial)', min: -Math.PI, max: Math.PI, step: 0.01, type: 'range', tip: 'Angle of lower bob from vertical.' },
        { id: 'w1',  label: 'omega1 (initial)', min: -8, max: 8, step: 0.1, type: 'range', tip: 'Initial angular velocity of upper bob.' },
        { id: 'w2',  label: 'omega2 (initial)', min: -8, max: 8, step: 0.1, type: 'range', tip: 'Initial angular velocity of lower bob.' },
      ]},
      { group: 'Physical Parameters', items: [
        { id: 'm1', label: 'Mass m1', min: 0.1, max: 5, step: 0.1, type: 'range' },
        { id: 'm2', label: 'Mass m2', min: 0.1, max: 5, step: 0.1, type: 'range' },
        { id: 'l1', label: 'Length l1', min: 0.2, max: 2, step: 0.05, type: 'range' },
        { id: 'l2', label: 'Length l2', min: 0.2, max: 2, step: 0.05, type: 'range' },
        { id: 'g',  label: 'Gravity g', min: 1, max: 20, step: 0.1, type: 'range' },
      ]},
      { group: 'View', items: [
        { id: 'view', label: 'Display', type: 'select', options: ['pendulum','phase','chaos'],
          tip: 'pendulum: physical animation, every trajectory drawn as a real pendulum. phase: (th1,omega1) trajectory. chaos: divergence over time.' },
        { id: 'numExtra', label: 'Extra pendulums', min: 0, max: 5, step: 1, type: 'range', tip: 'Each extra pendulum starts th1 offset by (copy number)\u00d70.001 rad from the reference one, and is drawn as a full second pendulum -- not just a trail.' },
        { id: 'trailLen', label: 'Trail length', min: 50, max: 3000, step: 50, type: 'range' },
        { id: 'speed',    label: 'Steps/frame',  min: 1, max: 30,  step: 1, type: 'range' },
      ]},
    ];
    this.presets = [
      { id: 'p1', name: 'Near-vertical chaos (5 pendulums)', params: { th1: Math.PI*0.99, th2: Math.PI*0.99, w1:0, w2:0, numExtra:4, view:'pendulum' } },
      { id: 'p2', name: 'Gentle swing (1 pendulum)',          params: { th1: 0.6, th2: 0.6, w1:0, w2:0, numExtra:0, view:'pendulum' } },
      { id: 'p3', name: 'Phase space orbit',                    params: { th1: Math.PI/2, th2: Math.PI/2, w1:0, w2:0, view:'phase' } },
      { id: 'p4', name: 'Chaos divergence over time',            params: { th1: Math.PI*0.97, th2: Math.PI*0.97, w1:0, w2:0, numExtra:4, view:'chaos' } },
      { id: 'p5', name: 'Asymmetric (m2=3)',                     params: { th1: 2, th2: 1, w1:0, w2:0, m2:3, numExtra:2, view:'pendulum' } },
      { id: 'p6', name: 'Spinning (high omega)',                 params: { th1: 0.3, th2: 0.1, w1:6, w2:-4, numExtra:0, view:'pendulum' } },
    ];
    this.domain = 'Dynamical Systems';
    this.description = 'Double pendulum: two bobs on coupled rods. Chaotic for large angles -- extreme sensitivity to initial conditions. Every pendulum shown (the reference one and every "extra" copy) is a full physical pendulum with its own rods and bobs, started a fraction of a degree apart, so you can watch them visibly diverge.';
    this._reset();
  }

  _reset() {
    const { th1, w1, th2, w2 } = this.params;
    const N = Math.round(this.params.numExtra);
    const cols = ['#1a4fa8', '#c42020', '#1a6b1a', '#a05000', '#6020a0', '#1a7a7a'];
    // The reference pendulum and every "extra" copy are tracked the same
    // way, so every one of them is drawn as a full rod+bob rig -- not just
    // a bare trail. Only the starting angle differs, by epsilon per copy.
    this._pends = [{ state: [th1, w1, th2, w2], color: cols[0], trail: [], isRef: true }];
    for (let k = 0; k < N; k++) {
      this._pends.push({ state: [th1 + (k + 1) * 0.001, w1, th2, w2], color: cols[(k + 1) % cols.length], trail: [], isRef: false });
    }
    this._phaseTrail = [];
    this.t = 0;
  }

  getFormula() { return 'theta1\u0308 = f(theta1,theta2,omega1,omega2)   theta2\u0308 = g(...)   [exact nonlinear EOM]'; }
  reset() { this._reset(); }
  get stepsPerFrame() { return Math.round(this.params.speed); }

  onParamChange() { this._reset(); }

  update() {
    const { m1, m2, l1, l2, g, dt, trailLen } = this.params;
    for (const p of this._pends) {
      p.state = rk4dp(p.state, m1, m2, l1, l2, g, dt);
      const [th1, w1, th2] = p.state;
      const x2 = l1 * Math.sin(th1) + l2 * Math.sin(th2);
      const y2 = l1 * Math.cos(th1) + l2 * Math.cos(th2);
      p.trail.push({ x: x2, y: y2 });
      if (p.trail.length > trailLen) p.trail.shift();
      if (p.isRef) {
        this._phaseTrail.push({ th1, w1 });
        if (this._phaseTrail.length > trailLen) this._phaseTrail.shift();
      }
    }
    this.t += dt;
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const v = this.params.view;
    if (v === 'pendulum')   this._renderPendulum(ctx, W, H);
    else if (v === 'phase') this._renderPhase(ctx, W, H);
    else if (v === 'chaos') this._renderChaos(ctx, W, H);
  }

  _renderPendulum(ctx, W, H) {
    const { l1, l2 } = this.params;
    const scale = Math.min(W,H) / (2*(l1+l2)+0.5) * 0.85;
    const ox = W/2, oy = H*0.3;

    // Trails first, underneath the rigs
    for (const p of this._pends) {
      if (p.trail.length < 2) continue;
      const [r,g,b] = p.isRef ? [26,79,168] : hexToRgb(p.color);
      for (let i = 1; i < p.trail.length; i++) {
        const t = i / p.trail.length;
        ctx.strokeStyle = `rgba(${r},${g},${b},${t * (p.isRef ? 0.7 : 0.5)})`;
        ctx.lineWidth = p.isRef ? 1.2 : 1;
        ctx.beginPath();
        ctx.moveTo(ox + p.trail[i-1].x*scale, oy + p.trail[i-1].y*scale);
        ctx.lineTo(ox + p.trail[i].x*scale,   oy + p.trail[i].y*scale);
        ctx.stroke();
      }
    }

    // Pivot (shared by all pendulums -- they all hang from the same point)
    ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI*2); ctx.fill();

    // Full rod+bob rig for every pendulum, including every "extra" one --
    // this is what actually makes the divergence visible.
    for (const p of this._pends) {
      const [th1, w1, th2, w2] = p.state;
      const x1 = ox + l1*Math.sin(th1)*scale, y1 = oy + l1*Math.cos(th1)*scale;
      const x2 = x1 + l2*Math.sin(th2)*scale, y2 = y1 + l2*Math.cos(th2)*scale;
      ctx.strokeStyle = p.color; ctx.lineWidth = p.isRef ? 3 : 1.8; ctx.lineCap = 'round';
      ctx.globalAlpha = p.isRef ? 1 : 0.75;
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(x1,y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(x1, y1, (p.isRef ? 7 : 5) + 3*this.params.m1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x2, y2, (p.isRef ? 8 : 5) + 3*this.params.m2, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    const { m1, m2, g } = this.params;
    const [th1, w1, th2, w2] = this._pends[0].state;
    const vx2 = l1*w1*Math.cos(th1) + l2*w2*Math.cos(th2);
    const vy2 = l1*w1*Math.sin(th1) + l2*w2*Math.sin(th2);
    const KE = 0.5*m1*(l1*w1)**2 + 0.5*m2*(vx2*vx2+vy2*vy2);
    const PE = -g*(m1*l1*Math.cos(th1) + m2*(l1*Math.cos(th1)+l2*Math.cos(th2)));
    label(ctx, `t=${this.t.toFixed(2)}s   KE=${KE.toFixed(3)}   PE=${PE.toFixed(3)}   E=${(KE+PE).toFixed(3)} (conserved)`, 8, 8, { color:'#333', size:11, bg:'rgba(255,255,255,0.9)' });
    if (this._pends.length > 1) label(ctx, `${this._pends.length} pendulums shown, starting ~0.001-0.005 rad apart -- watch them diverge`, 8, H-16, { color:'#888', size:10 });
    else label(ctx, 'Set "Extra pendulums" > 0 to compare several side by side', 8, H-16, { color:'#888', size:10 });
  }

  _renderPhase(ctx, W, H) {
    const pad = 50;
    const W2 = W-2*pad, H2 = H-2*pad;
    const tx = th => pad + ((th+Math.PI)/(2*Math.PI))*W2;
    const ty = w => H-pad - ((w+10)/20)*H2;

    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
    [-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI].forEach(th => {
      const x = tx(th); ctx.beginPath(); ctx.moveTo(x,pad); ctx.lineTo(x,H-pad); ctx.stroke();
    });
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pad,ty(0)); ctx.lineTo(W-pad,ty(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx(0),pad); ctx.lineTo(tx(0),H-pad); ctx.stroke();

    const trail = this._phaseTrail;
    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(26,79,168,0.6)'; ctx.lineWidth = 1.2; ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(tx(trail[0].th1), ty(trail[0].w1));
      for (let i=1;i<trail.length;i++) ctx.lineTo(tx(trail[i].th1), ty(trail[i].w1));
      ctx.stroke();
    }
    if (trail.length) {
      const last = trail[trail.length-1];
      dot(ctx, tx(last.th1), ty(last.w1), 4, '#c42020');
    }

    label(ctx, 'Phase portrait: (theta1, omega1) projection of the 4D phase space', 8, 8, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, 'Trajectory never closes for chaotic initial conditions -- it densely fills a region', 8, 26, { color: '#666', size: 10, bg: 'rgba(255,255,255,0.85)' });
    ctx.fillStyle='#888'; ctx.font='10px Courier New'; ctx.textAlign='center';
    ctx.fillText('theta1',W/2,H-16); ctx.save(); ctx.translate(16,H/2); ctx.rotate(-Math.PI/2); ctx.fillText('omega1',0,0); ctx.restore();
  }

  _renderChaos(ctx, W, H) {
    const { l1, l2 } = this.params;
    const scale = Math.min(W,H) / (2*(l1+l2)+0.5) * 0.85;
    const ox = W/2, oy = H*0.32;
    for (const p of this._pends) {
      if (p.trail.length < 2) continue;
      ctx.strokeStyle = p.color; ctx.lineWidth = p.isRef ? 2 : 1.5; ctx.lineJoin='round';
      ctx.beginPath(); ctx.moveTo(ox+p.trail[0].x*scale, oy+p.trail[0].y*scale);
      for (let i=1;i<p.trail.length;i++) ctx.lineTo(ox+p.trail[i].x*scale, oy+p.trail[i].y*scale);
      ctx.stroke();
      const l = p.trail[p.trail.length-1];
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(ox+l.x*scale, oy+l.y*scale, 5, 0, Math.PI*2); ctx.fill();
    }
    if (this._pends.length > 1) {
      const th1ref = this._pends[0].state[0], th1e = this._pends[1].state[0];
      const dist = Math.abs(th1ref-th1e);
      label(ctx, `delta-theta1 divergence (ref vs. copy 1): ${dist.toExponential(3)}  (started at 0.001)`, 8, 8, { color: '#c42020', size: 12, bg: 'rgba(255,255,255,0.9)' });
    } else {
      label(ctx, 'Set "Extra pendulums" > 0 to see divergence', 8, 8, { color: '#888', size: 11, bg: 'rgba(255,255,255,0.9)' });
    }
    label(ctx, 'Lyapunov instability: nearby orbits separate exponentially in time', 8, H-16, { color: '#666', size: 10 });
  }

  coordInfo() { const [th1,w1] = this._pends[0].state; return `t=${this.t.toFixed(3)}s  |  th1=${th1.toFixed(3)}  w1=${w1.toFixed(3)}`; }
}
