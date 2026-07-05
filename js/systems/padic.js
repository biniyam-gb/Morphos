
// p-adic Numbers — ultrametric geometry, p-adic valuation, Hensel's lemma
import { clearCanvas, label, dot } from '../plot.js';

function valuation(n, p) {
  if (n === 0) return Infinity;
  n = Math.abs(n);
  let v = 0;
  while (n % p === 0) { n /= p; v++; }
  return v;
}

function padicNorm(n, p) {
  const v = valuation(n, p);
  return v === Infinity ? 0 : Math.pow(p, -v);
}

function toPadicDigits(n, p, places=12) {
  // For integers: standard base-p digits
  // For negative integers in Z_p: ... uses p-adic expansion of -1 = (p-1)(p-1)(p-1)...
  const digits = [];
  if (n >= 0) {
    let x = n;
    for (let i=0;i<places;i++) { digits.push(x % p); x = Math.floor(x/p); }
  } else {
    // -n in Z_p: compute via p^k - n for large k, take digits (approximates infinite expansion)
    let x = n;
    let borrow = 0;
    let val = n;
    // Use two's-complement-like trick: -1 = (p-1,p-1,p-1,...)
    let m = -n;
    let carry = 1;
    for (let i=0;i<places;i++) {
      let d = (p - 1 - (m % p) + carry) % p;
      carry = ((p-1-(m%p)+carry) >= p) ? 1 : 0;
      // Simpler: compute (p^places - m) digits, treat as expansion
      digits.push(0);
      m = Math.floor(m/p);
    }
    // Recompute properly: -n mod p^places, then digits
    const mod = Math.pow(p, places);
    let val2 = ((mod - (-n) % mod) % mod + mod) % mod;
    digits.length = 0;
    let xx = val2;
    for (let i=0;i<places;i++){ digits.push(xx % p); xx = Math.floor(xx/p); }
  }
  return digits;
}

function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b];}return a;}

export class PAdicNumbers {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = {
      view: 'tree',  // tree | norm-comparison | hensel | valuation-table
      p: 2,
      n1: 12, n2: 20,
      depth: 7,
      henselPoly: 'x*x - 2',  // find sqrt(2) in Z_7 etc (needs QR)
    };
    this.paramDefs = [
      { group: 'Prime', items: [
        { id: 'p', label: 'Prime p', min: 2, max: 13, step: 1, type: 'range',
          tip: 'Must be prime for field structure (2,3,5,7,11,13).' },
      ]},
      { group: 'View', items: [
        { id: 'view', label: 'Visualization', type: 'select',
          options: ['tree','norm-comparison','valuation-table','hensel'],
          tip: 'tree: p-adic integers as infinite p-ary tree (ultrametric balls). norm-comparison: |x|_p for various x. valuation-table: v_p(n) heatmap. hensel: lifting solutions mod p^k.' },
        { id: 'depth', label: 'Tree depth', min: 3, max: 9, step: 1, type: 'range' },
      ]},
      { group: 'Distance comparison', items: [
        { id: 'n1', label: 'Number a', min: -50, max: 50, step: 1, type: 'range' },
        { id: 'n2', label: 'Number b', min: -50, max: 50, step: 1, type: 'range' },
      ]},
    ];
    this.presets = [
      { id: 'tree2', name: '2-adic tree',          params: { view:'tree', p:2, depth:7 } },
      { id: 'tree3', name: '3-adic tree',           params: { view:'tree', p:3, depth:5 } },
      { id: 'norm',  name: 'Norm comparison',        params: { view:'norm-comparison', p:5 } },
      { id: 'valtab',name: 'Valuation table',         params: { view:'valuation-table', p:2 } },
      { id: 'hensel',name: "Hensel's lemma (√2 in Z₇)", params: { view:'hensel', p:7 } },
    ];
    this.domain = 'p-adic Analysis & Number Theory';
    this.description = 'p-adic numbers: an alternative completion of ℚ using the p-adic norm |x|ₚ=p^(−vₚ(x)) instead of absolute value. Satisfies the ultrametric (strong triangle) inequality |x+y|ₚ≤max(|x|ₚ,|y|ₚ). Numbers are "close" if they agree on many low-order digits in base p — the opposite intuition from ℝ!';
    this.stepsPerFrame = 0;
  }

  getFormula() {
    const m = {
      tree: `ℤ_${this.params.p} as inverse limit of ℤ/${this.params.p}ⁿℤ`,
      'norm-comparison': `|x|_p = p^{−v_p(x)}  where v_p(x) = max{k: pᵏ|x}`,
      'valuation-table': `v_p(n) = exponent of p in prime factorization of n`,
      hensel: `If f(a)≡0 (mod p) and f'(a)≢0 (mod p), lift uniquely mod pᵏ for all k`,
    };
    return m[this.params.view] || '';
  }

  reset() {}
  update() {}
  onParamChange() {}

  render(ctx, canvas) {
    const W=canvas.width, H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    const v = this.params.view;
    if (v==='tree') this._renderTree(ctx,W,H);
    else if (v==='norm-comparison') this._renderNormComparison(ctx,W,H);
    else if (v==='valuation-table') this._renderValuationTable(ctx,W,H);
    else if (v==='hensel') this._renderHensel(ctx,W,H);
  }

  _renderTree(ctx,W,H) {
    const p = this.params.p, depth = this.params.depth;
    const pad=20;
    const rootY = pad, leafY = H-pad;
    const dy = (leafY-rootY)/depth;

    // Recursive layout: each node at depth d has p children
    const positions = new Map(); // key: "d:path" -> x
    const drawNode = (d, path, x0, x1) => {
      const x = (x0+x1)/2;
      const y = rootY + d*dy;
      positions.set(`${d}:${path}`, {x,y});
      if (d < depth) {
        const w = (x1-x0)/p;
        for (let digit=0; digit<p; digit++) {
          const cx0 = x0+digit*w, cx1=x0+(digit+1)*w;
          const child = drawNode(d+1, path+digit, cx0, cx1);
          // Edge
          const hue = (digit/p)*300;
          ctx.strokeStyle = `hsla(${hue},55%,40%,${Math.max(0.15,1-d*0.12)})`;
          ctx.lineWidth = Math.max(0.4, 2-d*0.2);
          ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(child.x,child.y); ctx.stroke();
        }
      }
      return {x,y};
    };
    drawNode(0, '', pad, W-pad);

    // Highlight path of n1 (in base p, truncated to depth)
    const highlightPath = (n, color) => {
      let x = n;
      let path = '';
      const digits = [];
      if (x>=0) { for (let i=0;i<depth;i++){ digits.push(x%p); x=Math.floor(x/p);} }
      else { let m=Math.pow(p,depth); let v=((m-(-n)%m)%m+m)%m; for(let i=0;i<depth;i++){digits.push(v%p);v=Math.floor(v/p);} }
      let curPath='';
      let prev = positions.get('0:');
      for (let d=0; d<depth; d++) {
        curPath += digits[d];
        const node = positions.get(`${d+1}:${curPath}`);
        if (!node) break;
        ctx.strokeStyle=color; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(prev.x,prev.y); ctx.lineTo(node.x,node.y); ctx.stroke();
        prev = node;
      }
      ctx.fillStyle=color; ctx.beginPath(); ctx.arc(prev.x,prev.y,5,0,Math.PI*2); ctx.fill();
      return digits;
    };
    const d1 = highlightPath(this.params.n1, '#c42020');
    const d2 = highlightPath(this.params.n2, '#1a4fa8');

    label(ctx, `${p}-adic integers ℤ_${p} as infinite ${p}-ary tree`, 8, 8, { color:'#333', size:12, bg:'rgba(255,255,255,0.92)' });
    label(ctx, `Red: ${this.params.n1} = (...${d1.slice().reverse().join('')})_${p}`, 8, 26, { color:'#c42020', size:10, bg:'rgba(255,255,255,0.88)' });
    label(ctx, `Blue: ${this.params.n2} = (...${d2.slice().reverse().join('')})_${p}`, 8, 42, { color:'#1a4fa8', size:10, bg:'rgba(255,255,255,0.88)' });
    label(ctx, 'Two numbers are p-adically close iff their paths agree near the root (low digits)', 8, H-16, { color:'#666', size:10 });
  }

  _renderNormComparison(ctx,W,H) {
    const p = this.params.p;
    const pad=50;
    const nums = Array.from({length:41},(_,i)=>i-20).filter(n=>n!==0);
    const norms = nums.map(n=>({n, norm:padicNorm(n,p), abs:Math.abs(n)}));
    const maxNorm = Math.max(...norms.map(x=>x.norm));
    const maxAbs = Math.max(...norms.map(x=>x.abs));

    const tx = n => pad + (n+20)/40*(W-2*pad);
    // Two bar charts: p-adic norm (top) vs usual abs value (bottom)
    const midY = H/2;
    ctx.strokeStyle='#ddd';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad,midY);ctx.lineTo(W-pad,midY);ctx.stroke();

    for (const {n,norm,abs} of norms) {
      const x = tx(n);
      const hTop = (norm/maxNorm)*(midY-pad-10);
      const hBot = (abs/maxAbs)*(midY-pad-10);
      ctx.fillStyle = norm>0.5?'#c42020':'rgba(196,32,32,0.4)';
      ctx.fillRect(x-3, midY-hTop-30, 6, hTop);
      ctx.fillStyle = 'rgba(26,79,168,0.7)';
      ctx.fillRect(x-3, midY+30, 6, hBot);
    }
    label(ctx, `|n|_${p} (top, red)  vs  |n| usual (bottom, blue)`, pad, 8, { color:'#333', size:12, bg:'rgba(255,255,255,0.9)' });
    label(ctx, `Numbers highly divisible by ${p} have SMALL p-adic norm (opposite of usual!)`, pad, 26, { color:'#666', size:10, bg:'rgba(255,255,255,0.88)' });
    ctx.fillStyle='#888'; ctx.font='10px Courier New'; ctx.textAlign='center';
    for (let n=-20;n<=20;n+=5) ctx.fillText(n, tx(n), midY+14);
    ctx.fillText('n', W/2, H-8);
  }

  _renderValuationTable(ctx,W,H) {
    const p = this.params.p;
    const pad=40;
    const N = 30;
    const cell = Math.min((W-2*pad)/N, 26);
    const cols = Math.floor((W-2*pad)/cell);
    const rows = Math.ceil(N*N/cols);
    let idx=0;
    for (let n=1; n<=N*N && idx<cols*rows; n++) {
      const v = valuation(n,p);
      const row = Math.floor(idx/cols), col = idx%cols;
      const x = pad+col*cell, y = pad+row*cell;
      const t = Math.min(1, v/6);
      const hue = 220-t*180;
      ctx.fillStyle = `hsl(${hue},65%,${75-t*35}%)`;
      ctx.fillRect(x,y,cell-1,cell-1);
      if (cell>16) {
        ctx.fillStyle='#222'; ctx.font=`${Math.min(11,cell-8)}px Courier New`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(n, x+cell/2, y+cell/2);
      }
      idx++;
    }
    label(ctx, `v_${p}(n) = ${p}-adic valuation  —  darker = higher power of ${p} divides n`, pad, H-pad+8, { color:'#333', size:11, bg:'rgba(255,255,255,0.9)' });
  }

  _renderHensel(ctx,W,H) {
    const p = this.params.p;
    // Find sqrt of a quadratic residue mod p, lift via Hensel
    // f(x) = x^2 - a, find a that's a QR mod p
    let a = 2;
    while (a < p) {
      let isQR = false;
      for (let x=1;x<p;x++) if ((x*x)%p === a%p) { isQR=true; break; }
      if (isQR) break;
      a++;
    }
    const f = x => x*x - a;
    const df = x => 2*x;

    // Find initial root mod p
    let x0 = -1;
    for (let x=0;x<p;x++) if (((x*x-a)%p+p)%p === 0) { x0=x; break; }

    const pad=20;
    const lines = [`Solving x² ≡ ${a} (mod ${p}^k)`, ``, `Step 0 (mod ${p}): x₀ = ${x0>=0?x0:'none found'}`];

    if (x0>=0) {
      let x = x0;
      let pk = p;
      for (let k=1; k<=5; k++) {
        // Hensel lift: x_{k+1} = x_k - f(x_k) * (f'(x_k))^{-1} mod p^{k+1}
        const pNext = pk*p;
        // Find inverse of f'(x) mod pNext
        const dfx = df(x);
        let inv=-1;
        for (let i=0;i<pNext;i++) if ((dfx*i)%pNext === 1 || (dfx*i)%pNext === 1-pNext) { inv=i; break; }
        if (inv<0) { for (let i=0;i<pNext;i++) if (((dfx*i)%pNext+pNext)%pNext === 1) {inv=i;break;} }
        const fx = f(x);
        let xNext = ((x - fx*inv) % pNext + pNext) % pNext;
        lines.push(`Step ${k} (mod ${pNext}): x = ${xNext}   [check: x²−${a} ≡ ${((xNext*xNext-a)%pNext+pNext)%pNext} mod ${pNext}]`);
        x = xNext; pk = pNext;
      }
      lines.push('', `√${a} ≈ ...(continues lifting forever in ℤ_${p})`);
    } else {
      lines.push('', `${a} is not a quadratic residue mod ${p} — no solution exists in ℤ_${p}`);
    }

    ctx.fillStyle='#333'; ctx.font='13px Courier New'; ctx.textAlign='left';
    lines.forEach((line,i) => ctx.fillText(line, pad, 40+i*24));

    label(ctx, "Hensel's Lemma: lift solutions from mod p to mod p² to mod p³...", pad, 8, { color:'#1a4fa8', size:12, bg:'rgba(255,255,255,0.9)' });
    label(ctx, 'p-adic analogue of Newton\'s method — converges because |f(x)|_p shrinks each step', pad, H-16, { color:'#666', size:10 });
  }

  coordInfo() { return `p=${this.params.p}`; }
}
