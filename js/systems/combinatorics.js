// Combinatorics -- Pascal's triangle mod p, Catalan numbers, integer
// partitions (Ferrers diagrams), and permutation cycle structure.
import { clearCanvas, label } from '../plot.js';

// C(n,k) mod p via Lucas' theorem -- lets us reach n in the hundreds
// without big integers, since p stays small.
function modPow(base, exp, mod) {
  let r = 1; base %= mod;
  while (exp > 0) {
    if (exp & 1) r = (r * base) % mod;
    exp = Math.floor(exp / 2);
    base = (base * base) % mod;
  }
  return r;
}
function smallBinomModP(n, k, p) {
  if (k < 0 || k > n) return 0;
  let num = 1, den = 1;
  for (let i = 0; i < k; i++) { num = (num * ((n - i) % p)) % p; den = (den * ((i + 1) % p)) % p; }
  return (num * modPow(den, p - 2, p)) % p;
}
function binomModP(n, k, p) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  while (n > 0 || k > 0) {
    const ni = n % p, ki = k % p;
    if (ki > ni) return 0;
    result = (result * smallBinomModP(ni, ki, p)) % p;
    n = Math.floor(n / p); k = Math.floor(k / p);
  }
  return result;
}

function catalan(n) {
  const C = [1];
  for (let i = 1; i <= n; i++) {
    let s = 0;
    for (let j = 0; j < i; j++) s += C[j] * C[i - 1 - j];
    C.push(s);
  }
  return C;
}

function randomTriangulation(n) {
  const N = n + 2;
  const triangles = [];
  (function rec(indices) {
    const m = indices.length;
    if (m < 3) return;
    if (m === 3) { triangles.push([indices[0], indices[1], indices[2]]); return; }
    const j = 1 + Math.floor(Math.random() * (m - 2));
    triangles.push([indices[0], indices[j], indices[m - 1]]);
    rec(indices.slice(0, j + 1));
    rec(indices.slice(j));
  })(Array.from({ length: N }, (_, i) => i));
  return triangles;
}

function partitionCounts(N) {
  const p = new Array(N + 1).fill(0); p[0] = 1;
  for (let k = 1; k <= N; k++) for (let i = k; i <= N; i++) p[i] += p[i - k];
  return p;
}
function generatePartitions(n, maxPart = n, cap = 600) {
  const out = [];
  (function rec(remain, maxP, cur) {
    if (out.length >= cap) return;
    if (remain === 0) { out.push(cur.slice()); return; }
    for (let k = Math.min(remain, maxP); k >= 1; k--) {
      cur.push(k); rec(remain - k, k, cur); cur.pop();
      if (out.length >= cap) return;
    }
  })(n, maxPart, []);
  return out;
}

function inversionCount(perm) {
  let c = 0;
  for (let i = 0; i < perm.length; i++) for (let j = i + 1; j < perm.length; j++) if (perm[i] > perm[j]) c++;
  return c;
}
function cycleDecomposition(perm) {
  const n = perm.length;
  const visited = new Array(n + 1).fill(false);
  const cycles = [];
  for (let i = 1; i <= n; i++) {
    if (visited[i]) continue;
    const cyc = []; let j = i;
    while (!visited[j]) { visited[j] = true; cyc.push(j); j = perm[j - 1]; }
    cycles.push(cyc);
  }
  return cycles;
}
function randomPermutation(n) {
  const p = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}

export class Combinatorics {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = {
      view: 'pascal',
      pascalRows: 256, pascalMod: 2,
      catalanN: 6,
      partitionN: 10,
      permN: 8, permStr: '', permAuto: true,
    };
    this.paramDefs = [
      { group: 'View', items: [
        { id: 'view', label: 'Topic', type: 'select',
          options: ['pascal', 'catalan', 'partitions', 'permutations'],
          tip: 'pascal: binomial coefficients mod p. catalan: balanced structures. partitions: Ferrers diagrams. permutations: cycle structure.' },
      ]},
      { group: "Pascal's Triangle mod p", items: [
        { id: 'pascalRows', label: 'Rows', min: 32, max: 512, step: 16, type: 'range' },
        { id: 'pascalMod', label: 'Modulus p (prime)', min: 2, max: 13, step: 1, type: 'range',
          tip: 'C(n,k) mod p, computed via Lucas\' theorem. p=2 reproduces the Sierpinski triangle exactly.' },
      ]},
      { group: 'Catalan Numbers', items: [
        { id: 'catalanN', label: 'n (polygon has n+2 sides)', min: 1, max: 12, step: 1, type: 'range',
          tip: 'C_n counts triangulations of a convex (n+2)-gon, balanced parenthesizations, binary trees with n+1 leaves, and dozens of other structures.' },
      ]},
      { group: 'Integer Partitions', items: [
        { id: 'partitionN', label: 'n', min: 1, max: 20, step: 1, type: 'range',
          tip: 'Shows every way to write n as a sum of positive integers (order irrelevant), as Ferrers/Young diagrams.' },
      ]},
      { group: 'Permutations', items: [
        { id: 'permN', label: 'n', min: 3, max: 10, step: 1, type: 'range' },
        { id: '_guide', type: 'hint', html: 'Leave the field blank for a random permutation, or type one in one-line notation, e.g. <code>3 1 4 2</code> for &sigma;(1)=3, &sigma;(2)=1, ...' },
        { id: 'permStr', label: 'Permutation (one-line)', type: 'code' },
      ]},
    ];
    this.presets = [
      { id: 'sierpinski', name: 'Pascal mod 2 (Sierpinski)', params: { view: 'pascal', pascalMod: 2, pascalRows: 256 } },
      { id: 'pascal3',    name: 'Pascal mod 3',               params: { view: 'pascal', pascalMod: 3, pascalRows: 243 } },
      { id: 'pascal5',    name: 'Pascal mod 5',               params: { view: 'pascal', pascalMod: 5, pascalRows: 250 } },
      { id: 'catalan',    name: 'Catalan triangulation',      params: { view: 'catalan', catalanN: 6 } },
      { id: 'partitions', name: 'Partitions of 10',            params: { view: 'partitions', partitionN: 10 } },
      { id: 'perm',       name: 'Random permutation',           params: { view: 'permutations', permN: 8, permStr: '' } },
    ];
    this.domain = 'Combinatorics';
    this.stepsPerFrame = 0;
    this._dirty = true;
    this._triangulation = randomTriangulation(this.params.catalanN);
    this._perm = randomPermutation(this.params.permN);
  }

  getFormula() {
    const m = {
      pascal: `C(n,k) mod ${this.params.pascalMod}  (Lucas\u2019 theorem)`,
      catalan: `C_n = C(2n,n)/(n+1) = (2n)! / (n!(n+1)!)`,
      partitions: `p(${this.params.partitionN}) = number of partitions of ${this.params.partitionN}`,
      permutations: `\u03c3 \u2208 S_${this.params.permN},  ${this.params.permN}! = ${factorial(this.params.permN).toLocaleString()} total`,
    };
    return m[this.params.view] || '';
  }
  get description() {
    const m = {
      pascal: 'Binomial coefficients reduced mod a prime p. By Lucas\u2019 theorem this depends only on the base-p digits of n and k -- the self-similar fractal pattern (Sierpinski triangle at p=2) is a direct visual proof of that theorem.',
      catalan: 'The Catalan numbers count an enormous family of combinatorial structures: triangulations of polygons, balanced parenthesizations, binary trees, monotone lattice paths that don\u2019t cross the diagonal, and more -- all in bijection with each other.',
      partitions: 'Every way to write n as an unordered sum of positive integers. The generating function \u03a3p(n)x^n = \u03a0 1/(1-x^k) (Euler) encodes this entire sequence in one infinite product.',
      permutations: 'Every permutation decomposes uniquely into disjoint cycles. The number of inversions determines the sign (parity): even permutations are products of an even number of transpositions.',
    };
    return m[this.params.view] || '';
  }

  reset() {
    this._triangulation = randomTriangulation(this.params.catalanN);
    this._perm = this.params.permStr.trim() ? this._parsePerm() : randomPermutation(this.params.permN);
    this._dirty = true;
  }
  _parsePerm() {
    const nums = this.params.permStr.split(/[\s,]+/).map(Number).filter(x => !isNaN(x));
    const n = this.params.permN;
    if (nums.length === n && new Set(nums).size === n && nums.every(x => x >= 1 && x <= n)) return nums;
    return randomPermutation(n);
  }
  update() {}
  onParamChange(id) {
    if (id === 'catalanN') this._triangulation = randomTriangulation(this.params.catalanN);
    if (id === 'permN' || id === 'permStr') this._perm = this.params.permStr.trim() ? this._parsePerm() : randomPermutation(this.params.permN);
    this._dirty = true;
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const v = this.params.view;
    if (v === 'pascal') this._renderPascal(ctx, W, H);
    else if (v === 'catalan') this._renderCatalan(ctx, W, H);
    else if (v === 'partitions') this._renderPartitions(ctx, W, H);
    else if (v === 'permutations') this._renderPermutations(ctx, W, H);
  }

  _renderPascal(ctx, W, H) {
    const rows = this.params.pascalRows, p = this.params.pascalMod;
    const cell = Math.max(1, Math.min(W / rows, (H - 20) / rows));
    const ox = (W - rows * cell) / 2;
    const hues = Array.from({ length: p }, (_, i) => (i / p) * 300);
    for (let n = 0; n < rows; n++) {
      const rowW = (n + 1) * cell;
      const rowOx = (W - rowW) / 2;
      for (let k = 0; k <= n; k++) {
        const v = binomModP(n, k, p);
        if (v === 0) continue;
        ctx.fillStyle = `hsl(${hues[v % p]},65%,45%)`;
        ctx.fillRect(rowOx + k * cell, 10 + n * cell, Math.max(1, cell), Math.max(1, cell));
      }
    }
    label(ctx, `Pascal's triangle mod ${p}, rows 0..${rows - 1}`, 8, H - 18, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.85)' });
  }

  _renderCatalan(ctx, W, H) {
    const n = this.params.catalanN;
    const C = catalan(12);
    const cx = W * 0.32, cy = H * 0.42, R = Math.min(W, H) * 0.24;
    const N = n + 2;
    const pts = Array.from({ length: N }, (_, i) => {
      const a = -Math.PI / 2 + i * (2 * Math.PI / N);
      return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    });
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach((p, i) => { i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); });
    ctx.closePath(); ctx.stroke();
    const cols = ['#c42020', '#1a4fa8', '#1a6b1a', '#a05000', '#6020a0', '#1a7a7a', '#884400', '#008888', '#c48000', '#800040', '#404040', '#4080c0'];
    this._triangulation.forEach((tri, i) => {
      ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pts[tri[0]][0], pts[tri[0]][1]);
      ctx.lineTo(pts[tri[1]][0], pts[tri[1]][1]);
      ctx.lineTo(pts[tri[2]][0], pts[tri[2]][1]);
      ctx.closePath(); ctx.stroke();
    });
    pts.forEach(p => { ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill(); });

    label(ctx, `One (of C_${n} = ${C[n].toLocaleString()}) triangulations of a ${N}-gon`, 12, 8, { color: '#333', size: 12, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, 'Click "Reset" to sample a different random triangulation', 12, H - 16, { color: '#888', size: 10 });

    // Growth chart on the right
    const gx = W * 0.62, gw = W * 0.34, gy = H * 0.15, gh = H * 0.65;
    const maxC = C[Math.min(11, n + 2)];
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    const bw = gw / 12;
    for (let i = 0; i <= 11; i++) {
      const h = (C[i] / maxC) * gh;
      ctx.fillStyle = i === n ? '#c42020' : 'rgba(26,79,168,0.55)';
      ctx.fillRect(gx + i * bw, gy + gh - h, bw - 2, h);
    }
    label(ctx, 'C_0, C_1, ... C_11', gx, gy - 14, { color: '#555', size: 10 });
    label(ctx, `C_${n} = ${C[n].toLocaleString()}`, gx, gy + gh + 4, { color: '#c42020', size: 10 });
  }

  _renderPartitions(ctx, W, H) {
    const n = this.params.partitionN;
    const parts = generatePartitions(n);
    const counts = partitionCounts(30);
    label(ctx, `p(${n}) = ${counts[n]} partitions${parts.length < counts[n] ? ` (showing first ${parts.length})` : ''}`, 8, 8, { color: '#333', size: 12, bg: 'rgba(255,255,255,0.9)' });

    const cellSize = 6, pad = 4;
    let x = 10, y = 32, rowMaxH = 0;
    const maxWidth = W - 10;
    for (const part of parts) {
      const w = part.length * (cellSize + 1);
      const h = part[0] * (cellSize + 1);
      if (x + w > maxWidth) { x = 10; y += rowMaxH + pad + 6; rowMaxH = 0; }
      if (y > H - 20) break;
      ctx.strokeStyle = '#1a4fa8'; ctx.fillStyle = 'rgba(26,79,168,0.55)';
      part.forEach((rowLen, ri) => {
        for (let ci = 0; ci < rowLen; ci++) {
          ctx.fillRect(x + ci * (cellSize + 1), y + ri * (cellSize + 1), cellSize, cellSize);
        }
      });
      rowMaxH = Math.max(rowMaxH, h);
      x += w + pad + 4;
    }
  }

  _renderPermutations(ctx, W, H) {
    const perm = this._perm;
    const n = perm.length;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.3;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + i * (2 * Math.PI / n);
      return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    });
    const cycles = cycleDecomposition(perm);
    const cols = ['#c42020', '#1a4fa8', '#1a6b1a', '#a05000', '#6020a0', '#1a7a7a', '#884400', '#008888'];
    const colorOf = new Array(n + 1);
    cycles.forEach((cyc, ci) => cyc.forEach(v => colorOf[v] = cols[ci % cols.length]));

    for (let i = 1; i <= n; i++) {
      const j = perm[i - 1];
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[j - 1];
      ctx.strokeStyle = colorOf[i]; ctx.fillStyle = colorOf[i]; ctx.lineWidth = 2;
      if (i === j) {
        ctx.beginPath(); ctx.arc(x1 + (x1 - cx) * 0.25, y1 + (y1 - cy) * 0.25, 10, 0, Math.PI * 2); ctx.stroke();
      } else {
        const mx = (x1 + x2) / 2 + (y2 - y1) * 0.15, my = (y1 + y2) / 2 - (x2 - x1) * 0.15;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
        const ang = Math.atan2(y2 - my, x2 - mx);
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 8 * Math.cos(ang - 0.4), y2 - 8 * Math.sin(ang - 0.4));
        ctx.lineTo(x2 - 8 * Math.cos(ang + 0.4), y2 - 8 * Math.sin(ang + 0.4));
        ctx.closePath(); ctx.fill();
      }
    }
    pts.forEach((p, i) => {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = colorOf[i + 1]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p[0], p[1], 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.font = '12px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, p[0], p[1]);
    });

    const inv = inversionCount(perm);
    const sign = inv % 2 === 0 ? 'even (+1)' : 'odd (\u22121)';
    label(ctx, `\u03c3 = (${perm.join(' ')})`, 8, 8, { color: '#333', size: 12, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, `Cycle type: ${cycles.map(c => `(${c.join(' ')})`).join(' ')}`, 8, 26, { color: '#555', size: 10, bg: 'rgba(255,255,255,0.86)' });
    label(ctx, `Inversions: ${inv}  \u2192  sign: ${sign}`, 8, 42, { color: '#555', size: 10, bg: 'rgba(255,255,255,0.86)' });
  }

  coordInfo() { return `view: ${this.params.view}`; }
}

function factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
