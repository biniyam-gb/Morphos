// Group Theory & Symmetry -- cyclic, dihedral, and symmetric groups via
// their Cayley graphs, Cayley tables, and geometric symmetry actions.
import { clearCanvas, label } from '../plot.js';

function makeCyclicGroup(n) {
  const elements = Array.from({ length: n }, (_, i) => i);
  const mul = (a, b) => (a + b) % n;
  const inv = a => (n - a) % n;
  const names = elements.map(i => (i === 0 ? 'e' : `r${i > 1 ? '\u00b7' + i : ''}`));
  return { n: elements.length, elements, mul, inv, names, generators: n > 1 ? [1] : [0], label: `\u2124${sub(n)} (cyclic)`, kind: 'cyclic', order: n };
}

// Standard presentation D_n = <r,s | r^n=e, s^2=e, srs=r^-1>.
// Elements 0..n-1 are r^k; elements n..2n-1 are s*r^k (index n+k).
// Multiplication rules, derived from r^a s = s r^{-a}:
//   r^a * r^b       = r^{a+b}
//   r^a * (s r^b)   = s r^{b-a}
//   (s r^a) * r^b   = s r^{a+b}
//   (s r^a)*(s r^b) = r^{b-a}
function makeDihedralGroup(n) {
  const N = 2 * n;
  const elements = Array.from({ length: N }, (_, i) => i);
  const mod = k => ((k % n) + n) % n;
  function mul(a, b) {
    const reflA = a >= n, reflB = b >= n;
    const ka = a % n, kb = b % n;
    if (!reflA && !reflB) return mod(ka + kb);
    if (!reflA && reflB) return n + mod(kb - ka);
    if (reflA && !reflB) return n + mod(ka + kb);
    return mod(kb - ka);
  }
  function inv(a) {
    if (a < n) return mod(-a);       // (r^k)^-1 = r^-k
    return a;                          // reflections are involutions
  }
  const names = elements.map(i => i < n ? (i === 0 ? 'e' : `r${i > 1 ? '\u00b7' + i : ''}`) : `s${i - n > 0 ? '\u00b7r' + (i - n) : ''}`);
  return { n: elements.length, elements, mul, inv, names, generators: [1, n], label: `D${sub(n)} (dihedral)`, kind: 'dihedral', order: n };
}

function permute(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permute(rest)) result.push([arr[i], ...p]);
  }
  return result;
}
function makeSymmetricGroup(n) {
  const perms = permute(Array.from({ length: n }, (_, i) => i));
  const index = new Map(perms.map((p, i) => [p.join(','), i]));
  function mul(a, b) {
    // (a*b)(i) = a(b(i)) -- compose a after b
    const pa = perms[a], pb = perms[b];
    return index.get(pb.map(x => pa[x]).join(','));
  }
  function inv(a) {
    const p = perms[a]; const q = new Array(n);
    p.forEach((v, i) => q[v] = i);
    return index.get(q.join(','));
  }
  const names = perms.map(p => '(' + p.map(x => x + 1).join(' ') + ')');
  const idPerm = Array.from({ length: n }, (_, i) => i);
  const gens = [];
  for (let i = 0; i < n - 1; i++) {
    const p = idPerm.slice(); [p[i], p[i + 1]] = [p[i + 1], p[i]];
    gens.push(index.get(p.join(',')));
  }
  return { n: perms.length, elements: perms.map((_, i) => i), mul, inv, names, generators: gens, label: `S${sub(n)} (symmetric)`, kind: 'symmetric', order: n, perms };
}

function sub(n) { const map = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089'; return String(n).split('').map(d => map[+d]).join(''); }

const GROUPS = {
  'Z6 (cyclic)':  () => makeCyclicGroup(6),
  'Z8 (cyclic)':  () => makeCyclicGroup(8),
  'D3 (triangle symmetries)': () => makeDihedralGroup(3),
  'D4 (square symmetries)':   () => makeDihedralGroup(4),
  'D6 (hexagon symmetries)':  () => makeDihedralGroup(6),
  'S3 (all perms of 3)': () => makeSymmetricGroup(3),
  'S4 (all perms of 4)': () => makeSymmetricGroup(4),
};

export class GroupTheory {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = {
      groupName: 'D3 (triangle symmetries)',
      view: 'symmetry-action',   // cayley-graph | cayley-table | symmetry-action
      selectedElement: 1,
      animate: true, animSpeed: 1,
    };
    this.paramDefs = [
      { group: 'Group', items: [
        { id: 'groupName', label: 'Group', type: 'select', options: Object.keys(GROUPS) },
        { id: 'view', label: 'View', type: 'select', options: ['symmetry-action', 'cayley-graph', 'cayley-table'],
          tip: 'symmetry-action: how the group physically acts. cayley-graph: elements as nodes, generators as colored edges. cayley-table: the full multiplication table.' },
      ]},
      { group: 'Symmetry Action', items: [
        { id: 'selectedElement', label: 'Selected element index', min: 0, max: 47, step: 1, type: 'range' },
        { id: 'animate', label: 'Animate through all elements', type: 'toggle' },
        { id: 'animSpeed', label: 'Animation speed', min: 1, max: 20, step: 1, type: 'range' },
      ]},
    ];
    this.presets = [
      { id: 'd3', name: 'D3 = symmetries of a triangle', params: { groupName: 'D3 (triangle symmetries)', view: 'symmetry-action' } },
      { id: 'd4', name: 'D4 = symmetries of a square',    params: { groupName: 'D4 (square symmetries)',   view: 'symmetry-action' } },
      { id: 'z6', name: 'Z6 Cayley graph',                  params: { groupName: 'Z6 (cyclic)', view: 'cayley-graph' } },
      { id: 'd4t',name: 'D4 multiplication table',           params: { groupName: 'D4 (square symmetries)', view: 'cayley-table' } },
      { id: 's3', name: 'S3 permutations of 3 points',       params: { groupName: 'S3 (all perms of 3)', view: 'symmetry-action' } },
      { id: 's4t',name: 'S4 Cayley table (24x24)',            params: { groupName: 'S4 (all perms of 4)', view: 'cayley-table' } },
    ];
    this.domain = 'Abstract Algebra';
    this.stepsPerFrame = 1;
    this._t = 0;
    this._loadGroup();
  }

  _loadGroup() {
    this._group = GROUPS[this.params.groupName]();
    this.params.selectedElement = Math.min(this.params.selectedElement, this._group.n - 1);
  }

  get description() {
    const g = this._group;
    if (g.kind === 'cyclic') return `The cyclic group of rotations by multiples of 360\u00b0/${g.order}. Abelian (commutative): every pair of elements commutes.`;
    if (g.kind === 'dihedral') return `The symmetries of a regular ${g.order}-gon: ${g.order} rotations and ${g.order} reflections, ${2 * g.order} elements total. Non-abelian for n\u22653 -- rotating then reflecting differs from reflecting then rotating.`;
    return `All ${g.n} permutations of ${g.order} labeled points, under composition. Non-abelian for n\u22653. Generated here by adjacent transpositions (the Coxeter generators).`;
  }
  getFormula() {
    const g = this._group;
    return `${g.label}: |G| = ${g.n}${g.kind !== 'cyclic' && g.n > 2 ? ' (non-abelian)' : ' (abelian)'}`;
  }

  reset() { this._t = 0; this._loadGroup(); }
  onParamChange(id) {
    if (id === 'groupName' || id === '_preset') { this._loadGroup(); this._t = 0; }
  }

  update() {
    if (!this.params.animate) return;
    this._t += this.params.animSpeed * 0.03;
    const g = this._group;
    this.params.selectedElement = Math.floor(this._t) % g.n;
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const v = this.params.view;
    if (v === 'symmetry-action') this._renderAction(ctx, W, H);
    else if (v === 'cayley-graph') this._renderCayleyGraph(ctx, W, H);
    else if (v === 'cayley-table') this._renderCayleyTable(ctx, W, H);
  }

  _renderAction(ctx, W, H) {
    const g = this._group;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.3;
    const idx = this.params.selectedElement;

    if (g.kind === 'symmetric') {
      // Show the permutation acting on n labeled points on a line
      const n = g.order;
      const perm = g.perms[idx];
      const y0 = cy - 40, y1 = cy + 40;
      const xs = Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * 70);
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
      xs.forEach(x => { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); });
      perm.forEach((to, from) => {
        const x1 = xs[from], x2 = xs[to];
        ctx.strokeStyle = `hsl(${(from / n) * 300},60%,42%)`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1, y0); ctx.bezierCurveTo(x1, cy, x2, cy, x2, y1); ctx.stroke();
      });
      xs.forEach((x, i) => {
        ctx.fillStyle = '#333'; ctx.font = '13px Courier New'; ctx.textAlign = 'center';
        ctx.fillText(i + 1, x, y0 - 12); ctx.fillText(perm[i] + 1, x, y1 + 20);
      });
      label(ctx, `\u03c3 = ${g.names[idx]}`, 8, 8, { color: '#333', size: 13, bg: 'rgba(255,255,255,0.9)' });
    } else {
      // Cyclic/dihedral acting on the plane: draw the base n-gon and the
      // orbit of a marker point/shape under the selected element.
      const n = g.order;
      const poly = Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + i * (2 * Math.PI / n);
        return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
      });
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5;
      ctx.beginPath(); poly.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.stroke();

      // Marker triangle (asymmetric so rotation/reflection is visible)
      const markerBase = [[0.5, 0], [0.15, 0.12], [0.15, -0.12]].map(([x, y]) => [R * 0.55 + x * 40, y * 40]);
      const isRefl = idx >= n;
      const k = idx % n;
      const rotAngle = (isRefl ? -1 : 1) * k * (2 * Math.PI / n) * (isRefl ? -1 : 1);
      // Correct transform: rotation by k*(2pi/n), then reflect across x-axis if isRefl (s), matching r^k / s r^k acting on the plane about origin then re-centered
      const applyElem = ([x, y]) => {
        let X = x, Y = y;
        if (isRefl) Y = -Y;
        const a = k * (2 * Math.PI / n);
        const ca = Math.cos(a), sa = Math.sin(a);
        return [cx + (X * ca - Y * sa), cy + (X * sa + Y * ca)];
      };
      ctx.fillStyle = isRefl ? 'rgba(196,32,32,0.75)' : 'rgba(26,79,168,0.75)';
      ctx.beginPath();
      markerBase.forEach(([x, y], i) => { const [px, py] = applyElem([x, y]); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
      ctx.closePath(); ctx.fill();

      // Faint orbit trail: all group images
      for (let e = 0; e < g.n; e++) {
        const eIsRefl = e >= n, ek = e % n;
        const applyE = ([x, y]) => {
          let X = x, Y = y; if (eIsRefl) Y = -Y;
          const a = ek * (2 * Math.PI / n), ca = Math.cos(a), sa = Math.sin(a);
          return [cx + (X * ca - Y * sa), cy + (X * sa + Y * ca)];
        };
        ctx.strokeStyle = eIsRefl ? 'rgba(196,32,32,0.15)' : 'rgba(26,79,168,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        markerBase.forEach(([x, y], i) => { const [px, py] = applyE([x, y]); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
        ctx.closePath(); ctx.stroke();
      }

      label(ctx, `Applying ${g.names[idx]} to the marker (faint copies show the full orbit)`, 8, 8, { color: '#333', size: 12, bg: 'rgba(255,255,255,0.9)' });
      label(ctx, isRefl ? 'Reflection (flips orientation)' : 'Rotation (preserves orientation)', 8, 26, { color: isRefl ? '#c42020' : '#1a4fa8', size: 10, bg: 'rgba(255,255,255,0.86)' });
    }
  }

  _renderCayleyGraph(ctx, W, H) {
    const g = this._group;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
    const pts = g.elements.map((_, i) => {
      const a = -Math.PI / 2 + i * (2 * Math.PI / g.n);
      return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    });
    const genCols = ['#1a4fa8', '#c42020', '#1a6b1a', '#a05000'];
    g.generators.forEach((gen, gi) => {
      ctx.strokeStyle = genCols[gi % genCols.length]; ctx.lineWidth = 1.5;
      for (const e of g.elements) {
        const to = g.mul(e, gen);
        const [x1, y1] = pts[e], [x2, y2] = pts[to];
        const mx = (x1 + x2) / 2 + (y2 - y1) * 0.1, my = (y1 + y2) / 2 - (x2 - x1) * 0.1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
      }
    });
    pts.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#333' : '#666';
      ctx.beginPath(); ctx.arc(p[0], p[1], g.n > 20 ? 4 : 7, 0, Math.PI * 2); ctx.fill();
      if (g.n <= 24) {
        ctx.fillStyle = '#fff'; ctx.font = '9px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(i, p[0], p[1]);
      }
    });
    label(ctx, `Cayley graph of ${g.label} \u2014 edge colors = right-multiplication by each generator`, 8, 8, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.9)' });
    g.generators.forEach((gen, gi) => label(ctx, `\u2192 ${g.names[gen]}`, 8, H - 16 - (g.generators.length - 1 - gi) * 14, { color: genCols[gi % genCols.length], size: 10 }));
  }

  _renderCayleyTable(ctx, W, H) {
    const g = this._group;
    const n = g.n;
    const pad = 20;
    const cell = Math.min((W - 2 * pad) / n, (H - 2 * pad) / n);
    const ox = (W - n * cell) / 2, oy = (H - n * cell) / 2;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = g.mul(i, j);
        const hue = (v / n) * 300;
        ctx.fillStyle = `hsl(${hue},60%,${45 + (v === 0 ? 25 : 0)}%)`;
        ctx.fillRect(ox + j * cell, oy + i * cell, Math.max(1, cell - 0.5), Math.max(1, cell - 0.5));
      }
    }
    label(ctx, `Cayley table of ${g.label} \u2014 cell (i,j) = g\u1d62 \u00b7 g\u2c7c, colored by result index`, 8, 8, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, 'Every row and column is a permutation of all elements (Latin square property)', 8, H - 16, { color: '#666', size: 10 });
  }

  coordInfo() { return `${this._group.label}  |element=${this.params.selectedElement}: ${this._group.names[this.params.selectedElement]}`; }
}
