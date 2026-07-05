
// Continued Fractions, Stern-Brocot Tree, Farey Sequences
// x = a0 + 1/(a1 + 1/(a2 + 1/(a3 + ...)))
import { clearCanvas, label, dot } from '../plot.js';

function gcd(a,b){ a=Math.abs(a);b=Math.abs(b); while(b){[a,b]=[b,a%b];} return a; }

function continuedFraction(x, maxTerms=15) {
  const terms = [];
  let val = x;
  for (let i = 0; i < maxTerms; i++) {
    const a = Math.floor(val);
    terms.push(a);
    const frac = val - a;
    if (Math.abs(frac) < 1e-12) break;
    val = 1/frac;
    if (!isFinite(val)) break;
  }
  return terms;
}

function convergents(terms) {
  const out = [];
  let h_2=0,h_1=1,k_2=1,k_1=0;
  for (const a of terms) {
    const h = a*h_1+h_2, k = a*k_1+k_2;
    out.push({h,k,val:h/k});
    h_2=h_1;h_1=h;k_2=k_1;k_1=k;
  }
  return out;
}

const CONSTANTS = {
  'φ (golden ratio)': (1+Math.sqrt(5))/2,
  'π':                Math.PI,
  'e':                Math.E,
  '√2':               Math.sqrt(2),
  '√3':               Math.sqrt(3),
  '√5':               Math.sqrt(5),
  'γ (Euler-Mascheroni)': 0.5772156649015329,
  'ln 2':              Math.log(2),
  '∛2':                Math.cbrt(2),
  '22/7 (π approx)':   22/7,
  '355/113 (π approx)':355/113,
  'Custom':            Math.PI,
};

export class ContinuedFractions {
  constructor(W,H) {
    this.canvasW=W; this.canvasH=H;
    this.params = {
      view: 'cf-spiral',  // cf-spiral | stern-brocot | farey | best-approx
      constant: 'φ (golden ratio)',
      customValue: 3.14159265,
      maxTerms: 12,
      sbDepth: 9,
      fareyN: 12,
    };
    this.paramDefs = [
      { group: 'View', items: [
        { id: 'view', label: 'Visualization', type: 'select',
          options: ['cf-spiral','stern-brocot','farey','best-approx'],
          tip: 'cf-spiral: continued fraction as nested rectangles. stern-brocot: tree of all rationals. farey: Farey sequence circles. best-approx: convergent quality.' },
      ]},
      { group: 'Number', items: [
        { id: 'constant', label: 'Constant', type: 'select', options: Object.keys(CONSTANTS) },
        { id: 'customValue', label: 'Custom value', min: 0.001, max: 10, step: 0.0001, type: 'range', tip: 'Used when "Custom" selected above.' },
        { id: 'maxTerms', label: 'CF terms', min: 2, max: 20, step: 1, type: 'range' },
      ]},
      { group: 'Stern-Brocot / Farey', items: [
        { id: 'sbDepth', label: 'Tree depth', min: 3, max: 12, step: 1, type: 'range' },
        { id: 'fareyN',  label: 'Farey order n', min: 3, max: 30, step: 1, type: 'range' },
      ]},
    ];
    this.presets = [
      { id: 'phi',  name: 'Golden ratio φ',     params: { view:'cf-spiral', constant:'φ (golden ratio)' } },
      { id: 'pi',   name: 'π convergents',       params: { view:'best-approx', constant:'π' } },
      { id: 'sqrt2',name: '√2 periodic CF',      params: { view:'cf-spiral', constant:'√2' } },
      { id: 'sb',   name: 'Stern-Brocot tree',    params: { view:'stern-brocot', sbDepth:8 } },
      { id: 'farey',name: 'Farey sequence',       params: { view:'farey', fareyN:15 } },
      { id: 'e',    name: 'e convergents',        params: { view:'best-approx', constant:'e' } },
    ];
    this.domain = 'Number Theory';
    this.description = 'Continued fractions [a₀;a₁,a₂,…] give the best rational approximations to any real number. φ has the "slowest converging" CF [1;1,1,1,…] — the most irrational number. The Stern-Brocot tree enumerates ALL positive rationals exactly once.';
    this.stepsPerFrame = 0;
  }

  _val() {
    const c = this.params.constant;
    return c === 'Custom' ? this.params.customValue : CONSTANTS[c];
  }

  getFormula() {
    const terms = continuedFraction(this._val(), this.params.maxTerms);
    const str = `[${terms[0]};${terms.slice(1).join(',')}]`;
    return `${this.params.constant} = ${str}`;
  }

  reset() {}
  update() {}
  onParamChange() {}

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const v = this.params.view;
    if (v === 'cf-spiral')   this._renderSpiral(ctx, W, H);
    else if (v === 'stern-brocot') this._renderSternBrocot(ctx, W, H);
    else if (v === 'farey')        this._renderFarey(ctx, W, H);
    else if (v === 'best-approx')  this._renderBestApprox(ctx, W, H);
  }

  _renderSpiral(ctx, W, H) {
    const x = this._val();
    const terms = continuedFraction(x, this.params.maxTerms);
    const cv = convergents(terms);
    // Nested rectangle visualization (like golden rectangle construction)
    const pad = 30;
    let rx = pad, ry = pad, rw = W-2*pad, rh = H-2*pad;
    const cols = ['#c42020','#1a4fa8','#1a6b1a','#a05000','#6020a0','#1a7a7a','#884400','#008888'];
    ctx.save();
    let horizontal = true;
    for (let i = 0; i < Math.min(terms.length, 10) && rw>4 && rh>4; i++) {
      const a = Math.max(1, terms[i]);
      const col = cols[i % cols.length];
      if (horizontal) {
        const segW = rw / (a + (i < terms.length-1 ? 1 : 0.001));
        for (let k = 0; k < a; k++) {
          ctx.strokeStyle = col; ctx.lineWidth = 1;
          ctx.strokeRect(rx+k*segW, ry, segW, rh);
        }
        rx += a*segW; rw -= a*segW;
      } else {
        const segH = rh / (a + (i < terms.length-1 ? 1 : 0.001));
        for (let k = 0; k < a; k++) {
          ctx.strokeStyle = col; ctx.lineWidth = 1;
          ctx.strokeRect(rx, ry+k*segH, rw, segH);
        }
        ry += a*segH; rh -= a*segH;
      }
      horizontal = !horizontal;
    }
    ctx.restore();

    // Convergents table
    label(ctx, this.getFormula(), 8, 8, { color:'#333', size:13, bg:'rgba(255,255,255,0.92)' });
    cv.slice(0,8).forEach((c,i) => {
      const err = Math.abs(c.val - x);
      label(ctx, `p${i}/q${i} = ${c.h}/${c.k} = ${c.val.toFixed(8)}  (err=${err.toExponential(2)})`,
        8, 30+i*15, { color: cols[i%cols.length], size:10, bg:'rgba(255,255,255,0.85)' });
    });
  }

  _renderSternBrocot(ctx, W, H) {
    const depth = this.params.sbDepth;
    const pad = 30;
    // Mediant-based tree
    const nodes = [];
    function build(l, r, d) {
      const med = { h: l.h+r.h, k: l.k+r.k };
      nodes.push({ l, r, med, d });
      if (d < depth) { build(l, med, d+1); build(med, r, d+1); }
    }
    const L0 = {h:0,k:1}, R0={h:1,k:0};
    build(L0, R0, 0);

    const x0=pad, x1=W-pad, y0=pad, y1=H-pad;
    const valToX = v => x0 + (v/(1+v))*(x1-x0); // map [0,∞) to [x0,x1) via v/(1+v)
    const cols = d => `hsl(${(d*47)%360},60%,40%)`;
    for (const n of nodes) {
      const v = n.med.h/n.med.k;
      const x = valToX(v);
      const y = y0 + (n.d/depth)*(y1-y0);
      ctx.fillStyle = cols(n.d);
      ctx.beginPath(); ctx.arc(x,y,Math.max(1.5,5-n.d*0.4),0,Math.PI*2); ctx.fill();
      if (n.d < depth) {
        const py = y0 + ((n.d-1)/depth)*(y1-y0);
        // (visual edges optional, skip for clarity/perf)
      }
      if (n.d <= 5) {
        ctx.fillStyle='#333'; ctx.font='9px Courier New'; ctx.textAlign='center';
        ctx.fillText(`${n.med.h}/${n.med.k}`, x, y-7);
      }
    }
    label(ctx, `Stern-Brocot tree, depth ${depth}  —  every positive rational appears exactly once`, 8, 8, { color:'#333', size:11, bg:'rgba(255,255,255,0.9)' });
    label(ctx, 'Left child = mediant(parent,left ancestor); Right = mediant(parent,right ancestor)', 8, H-18, { color:'#666', size:10 });
  }

  _renderFarey(ctx, W, H) {
    const n = this.params.fareyN;
    // Generate Farey sequence F_n
    const farey = [];
    for (let q=1; q<=n; q++) for (let p=0; p<=q; p++) if (gcd(p,q)===1) farey.push({p,q,val:p/q});
    farey.sort((a,b)=>a.val-b.val);
    // Dedupe
    const uniq = []; let last=-1;
    for (const f of farey) { if (Math.abs(f.val-last)>1e-9) { uniq.push(f); last=f.val; } }

    const pad=40, baseY=H-pad-60;
    const tx = v => pad + v*(W-2*pad);
    // Ford circles: circle at x=p/q with radius 1/(2q²)
    ctx.save();
    for (const f of uniq) {
      const r = 1/(2*f.q*f.q) * (W-2*pad) * 0.5;
      const cx = tx(f.val);
      const hue = (f.q*40)%360;
      ctx.strokeStyle = `hsla(${hue},65%,40%,0.8)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, baseY-r, r, 0, Math.PI*2); ctx.stroke();
      if (f.q <= 8) {
        ctx.fillStyle = '#333'; ctx.font='9px Courier New'; ctx.textAlign='center';
        ctx.fillText(`${f.p}/${f.q}`, cx, baseY+12);
      }
    }
    ctx.restore();
    // Baseline
    ctx.strokeStyle='#999'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(pad,baseY); ctx.lineTo(W-pad,baseY); ctx.stroke();

    label(ctx, `Ford Circles for Farey sequence F_${n}  (${uniq.length} fractions)`, 8, 8, { color:'#333', size:12, bg:'rgba(255,255,255,0.9)' });
    label(ctx, 'Circle at p/q has radius 1/(2q²). Tangent circles ↔ consecutive Farey fractions (|p₁q₂−p₂q₁|=1)', 8, H-16, { color:'#666', size:10 });
  }

  _renderBestApprox(ctx, W, H) {
    const x = this._val();
    const terms = continuedFraction(x, this.params.maxTerms);
    const cv = convergents(terms);
    const pad = 50;
    // log-scale error plot
    ctx.strokeStyle='#ddd'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad,pad); ctx.lineTo(pad,H-pad); ctx.stroke();

    const errs = cv.map(c => Math.abs(c.val-x)).filter(e=>e>1e-15);
    if (!errs.length) return;
    const logErrs = errs.map(e=>Math.log10(e));
    const minLog = Math.min(...logErrs), maxLog = Math.max(...logErrs);
    const tx = i => pad + (i/(cv.length-1||1))*(W-2*pad);
    const ty = le => H-pad - (le-minLog)/(maxLog-minLog||1)*(H-2*pad-20);

    // Plot |x - p/q| vs n
    ctx.strokeStyle='#c42020'; ctx.lineWidth=2; ctx.lineJoin='round';
    ctx.beginPath();
    cv.forEach((c,i) => {
      const e = Math.abs(c.val-x);
      if (e<1e-15) return;
      const y = ty(Math.log10(e));
      i===0?ctx.moveTo(tx(i),y):ctx.lineTo(tx(i),y);
    });
    ctx.stroke();
    cv.forEach((c,i) => {
      const e = Math.abs(c.val-x); if(e<1e-15)return;
      const y = ty(Math.log10(e));
      ctx.fillStyle='#c42020'; ctx.beginPath(); ctx.arc(tx(i),y,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#333'; ctx.font='9px Courier New'; ctx.textAlign='center';
      ctx.fillText(`${c.h}/${c.k}`, tx(i), y-8);
    });

    // Compare with 1/q^2 bound (theorem: |x-p/q| < 1/q²)
    ctx.strokeStyle='rgba(26,79,168,0.6)'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
    ctx.beginPath();
    cv.forEach((c,i) => {
      const bound = 1/(c.k*c.k);
      const y = ty(Math.log10(bound));
      i===0?ctx.moveTo(tx(i),y):ctx.lineTo(tx(i),y);
    });
    ctx.stroke(); ctx.setLineDash([]);

    label(ctx, `Convergent quality: ${this.getFormula()}`, pad, 8, { color:'#333', size:12, bg:'rgba(255,255,255,0.9)' });
    label(ctx, 'Red: |x − pₙ/qₙ| (actual error)   Blue dashed: 1/qₙ² (theorem bound)', pad, 26, { color:'#555', size:10, bg:'rgba(255,255,255,0.88)' });
    ctx.fillStyle='#888'; ctx.font='10px Courier New'; ctx.textAlign='center';
    ctx.fillText('convergent index n', W/2, H-8);
    ctx.save(); ctx.translate(16,H/2); ctx.rotate(-Math.PI/2); ctx.fillText('log₁₀|error|',0,0); ctx.restore();
  }

  coordInfo() { return `${this.params.constant} = ${this._val().toFixed(10)}`; }
}
