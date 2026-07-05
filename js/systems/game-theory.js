// Game Theory -- 2x2 Nash equilibria, replicator dynamics on the simplex,
// and an iterated Prisoner's Dilemma round-robin tournament.
import { clearCanvas, label, dot } from '../plot.js';

function findMixedNE2x2(A, B) {
  // A = row player's payoff matrix [[a11,a12],[a21,a22]] against column mix q
  // B = column player's payoff matrix, same indexing, against row mix p
  const [[a11,a12],[a21,a22]] = A;
  const [[b11,b12],[b21,b22]] = B;
  const qDenom = a11 - a12 - a21 + a22;
  const pDenom = b11 - b21 - b12 + b22;
  let q = null, p = null;
  if (Math.abs(qDenom) > 1e-9) q = (a22 - a12) / qDenom;
  if (Math.abs(pDenom) > 1e-9) p = (b22 - b21) / pDenom;
  const valid = q !== null && p !== null && q >= 0 && q <= 1 && p >= 0 && p <= 1;
  return { p, q, valid };
}
function pureNE2x2(A, B) {
  // Cell (i,j) is a pure NE if neither player can improve by unilateral deviation
  const results = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const rowBest = A[i][j] >= A[1-i][j];
    const colBest = B[i][j] >= B[i][1-j];
    if (rowBest && colBest) results.push([i, j]);
  }
  return results;
}

const GAME_PRESETS = {
  "Prisoner's Dilemma": { A: [[3,0],[5,1]], B: [[3,5],[0,1]], desc: 'Mutual defection (row2,col2) is the unique pure NE, even though mutual cooperation gives both players more. The tragedy: individually rational choices produce a collectively worse outcome.' },
  'Matching Pennies':    { A: [[1,-1],[-1,1]], B: [[-1,1],[1,-1]], desc: 'Zero-sum with NO pure Nash equilibrium -- only a mixed one (p=q=0.5). Any deterministic strategy is exploitable.' },
  'Battle of the Sexes':  { A: [[2,0],[0,1]], B: [[1,0],[0,2]], desc: 'Two pure NE (both pick the same option) plus one mixed NE. Players prefer coordinating, but disagree on which outcome.' },
  'Stag Hunt':            { A: [[4,0],[3,3]], B: [[4,3],[0,3]], desc: 'Two pure NE: mutual cooperation (payoff-dominant) and mutual defection (risk-dominant, safer if unsure of the other player).' },
  'Coordination Game':    { A: [[1,0],[0,1]], B: [[1,0],[0,1]], desc: 'Two pure NE, both equally good. Pure coordination -- players just need to agree, the classic conventions/focal-point problem.' },
  'Chicken':              { A: [[0,3],[1,2]], B: [[0,1],[3,2]], desc: 'Two pure NE (one swerves, one doesn\u2019t) plus a mixed NE. Mutual "not swerving" is catastrophic for both.' },
};

const RPS_A = [[0,-1,1],[1,0,-1],[-1,1,0]]; // Rock, Paper, Scissors payoffs to row player
function replicatorPayoff(A, x) {
  const n = x.length;
  const f = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) f[i] += A[i][j] * x[j];
  return f;
}
function barycentricTo2D(x, cx, cy, R) {
  // x = [x1,x2,x3], vertices at angles -90, 30, 150 degrees
  const verts = [[-Math.PI/2],[ -Math.PI/2 + 2*Math.PI/3],[ -Math.PI/2 + 4*Math.PI/3]].map(([a]) => [cx + R*Math.cos(a), cy + R*Math.sin(a)]);
  let px = 0, py = 0;
  for (let i = 0; i < 3; i++) { px += x[i]*verts[i][0]; py += x[i]*verts[i][1]; }
  return [px, py, verts];
}

// Iterated Prisoner's Dilemma strategies
const IPD_PAYOFF = { CC: [3,3], CD: [0,5], DC: [5,0], DD: [1,1] };
const IPD_STRATS = {
  'Always Cooperate': (myHist, oppHist) => 'C',
  'Always Defect':    (myHist, oppHist) => 'D',
  'Tit for Tat':       (myHist, oppHist) => oppHist.length === 0 ? 'C' : oppHist[oppHist.length-1],
  'Grim Trigger':       (myHist, oppHist) => oppHist.includes('D') ? 'D' : 'C',
  'Random':             (myHist, oppHist) => Math.random() < 0.5 ? 'C' : 'D',
  'Tit for Two Tats':   (myHist, oppHist) => oppHist.length >= 2 && oppHist[oppHist.length-1]==='D' && oppHist[oppHist.length-2]==='D' ? 'D' : 'C',
};
function playMatch(s1, s2, rounds) {
  let h1 = [], h2 = [], score1 = 0, score2 = 0;
  for (let r = 0; r < rounds; r++) {
    const m1 = IPD_STRATS[s1](h1, h2), m2 = IPD_STRATS[s2](h2, h1);
    const [p1, p2] = IPD_PAYOFF[m1+m2];
    score1 += p1; score2 += p2;
    h1.push(m1); h2.push(m2);
  }
  return { score1, score2, h1, h2 };
}

export class GameTheory {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = {
      view: 'payoff-matrix',    // payoff-matrix | replicator | tournament
      gamePreset: "Prisoner's Dilemma",
      a11: 3, a12: 0, a21: 5, a22: 1,
      b11: 3, b12: 5, b21: 0, b22: 1,
      replicatorGame: 'rock-paper-scissors',
      numTrajectories: 5,
      ipdRounds: 100,
    };
    this.paramDefs = [
      { group: 'Topic', items: [
        { id: 'view', label: 'View', type: 'select', options: ['payoff-matrix', 'replicator', 'tournament'],
          tip: 'payoff-matrix: static 2-player game & Nash equilibria. replicator: evolving population of strategies. tournament: iterated Prisoner\'s Dilemma round-robin.' },
      ]},
      { group: '2x2 Game', items: [
        { id: 'gamePreset', label: 'Preset', type: 'select', options: Object.keys(GAME_PRESETS) },
        { id: '_guide', type: 'hint', html: 'Payoffs: (a\u1d62\u2c7c, b\u1d62\u2c7c) for (row strategy i, column strategy j). Row player picks the row, column player picks the column.' },
        { id: 'a11', label: 'Row payoff, cell (1,1)', min: -5, max: 5, step: 0.5, type: 'range' },
        { id: 'a12', label: 'Row payoff, cell (1,2)', min: -5, max: 5, step: 0.5, type: 'range' },
        { id: 'a21', label: 'Row payoff, cell (2,1)', min: -5, max: 5, step: 0.5, type: 'range' },
        { id: 'a22', label: 'Row payoff, cell (2,2)', min: -5, max: 5, step: 0.5, type: 'range' },
        { id: 'b11', label: 'Col payoff, cell (1,1)', min: -5, max: 5, step: 0.5, type: 'range' },
        { id: 'b12', label: 'Col payoff, cell (1,2)', min: -5, max: 5, step: 0.5, type: 'range' },
        { id: 'b21', label: 'Col payoff, cell (2,1)', min: -5, max: 5, step: 0.5, type: 'range' },
        { id: 'b22', label: 'Col payoff, cell (2,2)', min: -5, max: 5, step: 0.5, type: 'range' },
      ]},
      { group: 'Replicator Dynamics', items: [
        { id: 'replicatorGame', label: 'Population game', type: 'select', options: ['rock-paper-scissors', 'hawk-dove', 'coordination'] },
        { id: 'numTrajectories', label: 'Trajectories', min: 1, max: 12, step: 1, type: 'range' },
      ]},
      { group: 'IPD Tournament', items: [
        { id: 'ipdRounds', label: 'Rounds per match', min: 10, max: 300, step: 10, type: 'range' },
      ]},
    ];
    this.presets = [
      { id: 'pd',  name: "Prisoner's Dilemma",  params: { view: 'payoff-matrix', gamePreset: "Prisoner's Dilemma" } },
      { id: 'mp',  name: 'Matching Pennies',      params: { view: 'payoff-matrix', gamePreset: 'Matching Pennies' } },
      { id: 'bos', name: 'Battle of the Sexes',   params: { view: 'payoff-matrix', gamePreset: 'Battle of the Sexes' } },
      { id: 'rps', name: 'Rock-Paper-Scissors evolution', params: { view: 'replicator', replicatorGame: 'rock-paper-scissors' } },
      { id: 'hd',  name: 'Hawk-Dove evolution',     params: { view: 'replicator', replicatorGame: 'hawk-dove' } },
      { id: 'ipd', name: 'IPD Tournament',           params: { view: 'tournament' } },
    ];
    this.domain = 'Game Theory';
    this.stepsPerFrame = 1;
    this._loadPreset();
    this._initTrajectories();
    this._tournamentResults = null;
  }

  _loadPreset() {
    const p = GAME_PRESETS[this.params.gamePreset]; if (!p) return;
    this.params.a11 = p.A[0][0]; this.params.a12 = p.A[0][1]; this.params.a21 = p.A[1][0]; this.params.a22 = p.A[1][1];
    this.params.b11 = p.B[0][0]; this.params.b12 = p.B[0][1]; this.params.b21 = p.B[1][0]; this.params.b22 = p.B[1][1];
    this._gameDesc = p.desc;
  }
  _getA() { return [[this.params.a11, this.params.a12], [this.params.a21, this.params.a22]]; }
  _getB() { return [[this.params.b11, this.params.b12], [this.params.b21, this.params.b22]]; }

  get description() {
    if (this.params.view === 'payoff-matrix') return this._gameDesc || '';
    if (this.params.view === 'replicator') return 'The replicator equation dx\u1d62/dt = x\u1d62(f\u1d62(x)\u2212f\u0304(x)) models evolution by natural selection: strategies that outperform the population average grow in frequency. Rest points correspond to Nash equilibria.';
    return 'Round-robin tournament of classic strategies under the iterated Prisoner\'s Dilemma. Tit-for-Tat and its relatives famously outperform "smarter" but less forgiving strategies (Axelrod\'s tournaments, 1980).';
  }
  getFormula() {
    if (this.params.view === 'payoff-matrix') return `2\u00d72 game: ${this.params.gamePreset}`;
    if (this.params.view === 'replicator') return 'dx\u1d62/dt = x\u1d62[(Ax)\u1d62 \u2212 x\u1d40Ax]';
    return `Iterated PD, ${this.params.ipdRounds} rounds/match, round-robin`;
  }

  _initTrajectories() {
    const n = Math.round(this.params.numTrajectories);
    this._trajectories = Array.from({ length: n }, () => {
      let x = [Math.random(), Math.random(), Math.random()];
      const s = x[0]+x[1]+x[2]; x = x.map(v => v/s);
      return { x, path: [x.slice()] };
    });
  }

  reset() {
    this._loadPreset();
    this._initTrajectories();
    this._tournamentResults = playRoundRobin(this.params.ipdRounds);
  }
  onParamChange(id) {
    if (id === 'gamePreset' || id === '_preset') this._loadPreset();
    if (id === 'numTrajectories' || id === 'replicatorGame' || id === '_preset') this._initTrajectories();
    if (id === 'ipdRounds' || id === '_preset') this._tournamentResults = playRoundRobin(this.params.ipdRounds);
  }

  update() {
    if (this.params.view !== 'replicator') return;
    let A;
    if (this.params.replicatorGame === 'rock-paper-scissors') A = RPS_A;
    else if (this.params.replicatorGame === 'hawk-dove') A = [[0, 3, 1.5], [-1, 1.5, 0.75], [0.5, 1, 1]]; // 3-strategy relaxation: Hawk, Dove, Retaliator-ish
    else A = [[1, -0.2, -0.2], [-0.2, 1, -0.2], [-0.2, -0.2, 1]]; // coordination: self-reinforcing corners
    const dt = 0.02;
    for (const tr of this._trajectories) {
      const f = replicatorPayoff(A, tr.x);
      const avg = f.reduce((s, fi, i) => s + fi * tr.x[i], 0);
      const nx = tr.x.map((xi, i) => Math.max(1e-6, xi + dt * xi * (f[i] - avg)));
      const s = nx.reduce((a,b)=>a+b,0);
      tr.x = nx.map(v => v / s);
      tr.path.push(tr.x.slice());
      if (tr.path.length > 500) tr.path.shift();
    }
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const v = this.params.view;
    if (v === 'payoff-matrix') this._renderMatrix(ctx, W, H);
    else if (v === 'replicator') this._renderReplicator(ctx, W, H);
    else if (v === 'tournament') this._renderTournament(ctx, W, H);
  }

  _renderMatrix(ctx, W, H) {
    const A = this._getA(), B = this._getB();
    const cx = W * 0.4, cy = H / 2, cell = 110;
    const x0 = cx - cell, y0 = cy - cell;
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(x0, y0+i*cell); ctx.lineTo(x0+2*cell, y0+i*cell); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0+i*cell, y0); ctx.lineTo(x0+i*cell, y0+2*cell); ctx.stroke();
    }
    const pureNE = pureNE2x2(A, B);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const isNE = pureNE.some(([pi,pj]) => pi===i && pj===j);
      if (isNE) { ctx.fillStyle = 'rgba(196,32,32,0.12)'; ctx.fillRect(x0+j*cell, y0+i*cell, cell, cell); }
      ctx.fillStyle = '#1a4fa8'; ctx.font = 'bold 16px Courier New'; ctx.textAlign = 'center';
      ctx.fillText(A[i][j], x0+j*cell+cell*0.35, y0+i*cell+cell*0.5);
      ctx.fillStyle = '#c42020';
      ctx.fillText(B[i][j], x0+j*cell+cell*0.65, y0+i*cell+cell*0.5);
      if (isNE) { ctx.strokeStyle = '#c42020'; ctx.lineWidth = 2.5; ctx.strokeRect(x0+j*cell+3, y0+i*cell+3, cell-6, cell-6); }
    }
    ctx.fillStyle = '#555'; ctx.font = '12px Courier New';
    ctx.fillText('Row 1', x0 - 45, y0 + cell*0.5); ctx.fillText('Row 2', x0 - 45, y0 + cell*1.5);
    ctx.fillText('Col 1', x0 + cell*0.5, y0 - 15); ctx.fillText('Col 2', x0 + cell*1.5, y0 - 15);

    const mixed = findMixedNE2x2(A, B);
    label(ctx, this.params.gamePreset, 8, 8, { color: '#333', size: 13, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, `Blue = row player payoff, Red = column player payoff`, 8, 28, { color: '#555', size: 10, bg: 'rgba(255,255,255,0.86)' });
    label(ctx, pureNE.length ? `Pure Nash equilibria: ${pureNE.map(([i,j])=>`(Row${i+1},Col${j+1})`).join(', ')} (outlined)` : 'No pure Nash equilibrium', 8, 46, { color: '#c42020', size: 10, bg: 'rgba(255,255,255,0.86)' });
    if (mixed.valid) label(ctx, `Mixed NE: row plays Row1 w.p. ${mixed.p.toFixed(3)}, column plays Col1 w.p. ${mixed.q.toFixed(3)}`, 8, 64, { color: '#1a6b1a', size: 10, bg: 'rgba(255,255,255,0.86)' });
  }

  _renderReplicator(ctx, W, H) {
    const cx = W / 2, cy = H / 2 + 20, R = Math.min(W, H) * 0.34;
    const [, , verts] = barycentricTo2D([1/3,1/3,1/3], cx, cy, R);
    const labels = this.params.replicatorGame === 'rock-paper-scissors' ? ['Rock','Paper','Scissors']
      : this.params.replicatorGame === 'hawk-dove' ? ['Hawk','Dove','Retaliator'] : ['A','B','C'];
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1.5;
    ctx.beginPath(); verts.forEach((p,i)=>i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1])); ctx.closePath(); ctx.stroke();
    verts.forEach((p, i) => label(ctx, labels[i], p[0] - 20, p[1] + (i===0?-24:10), { color: '#555', size: 12 }));

    const cols = ['#c42020','#1a4fa8','#1a6b1a','#a05000','#6020a0','#1a7a7a','#884400','#008888','#c48000','#800040','#404040','#4080c0'];
    this._trajectories.forEach((tr, ti) => {
      ctx.strokeStyle = cols[ti % cols.length]; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      tr.path.forEach((x, i) => { const [px,py] = barycentricTo2D(x, cx, cy, R); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
      ctx.stroke();
      const [lx, ly] = barycentricTo2D(tr.x, cx, cy, R);
      dot(ctx, lx, ly, 4, cols[ti % cols.length]);
    });

    label(ctx, `Replicator dynamics: ${this.params.replicatorGame.replace(/-/g,' ')}`, 8, 8, { color: '#333', size: 12, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, 'Each dot is a population state (x\u2081,x\u2082,x\u2083); trails show its evolution over time', 8, H - 16, { color: '#666', size: 10 });
  }

  _renderTournament(ctx, W, H) {
    if (!this._tournamentResults) this._tournamentResults = playRoundRobin(this.params.ipdRounds);
    const { totals } = this._tournamentResults;
    const names = Object.keys(totals);
    const maxScore = Math.max(...Object.values(totals));
    const pad = 40, barH = (H - 2*pad) / names.length - 10;
    names.sort((a,b) => totals[b]-totals[a]).forEach((name, i) => {
      const y = pad + i * (barH + 10);
      const w = (totals[name] / maxScore) * (W - 220);
      ctx.fillStyle = i === 0 ? 'rgba(26,107,26,0.7)' : 'rgba(26,79,168,0.55)';
      ctx.fillRect(180, y, w, barH);
      ctx.fillStyle = '#333'; ctx.font = '12px Courier New'; ctx.textAlign = 'right';
      ctx.fillText(name, 174, y + barH*0.65);
      ctx.textAlign = 'left';
      ctx.fillText(totals[name].toString(), 186 + w, y + barH*0.65);
    });
    label(ctx, `Round-robin tournament, ${this.params.ipdRounds} rounds/match, total score across all opponents`, 8, 8, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, 'Payoffs: both cooperate=3,3  both defect=1,1  defect vs cooperate=5,0', 8, H - 16, { color: '#666', size: 10 });
  }

  coordInfo() { return `view: ${this.params.view}`; }
}

function playRoundRobin(rounds) {
  const names = Object.keys(IPD_STRATS);
  const totals = Object.fromEntries(names.map(n => [n, 0]));
  for (let i = 0; i < names.length; i++) {
    for (let j = i; j < names.length; j++) {
      const { score1, score2 } = playMatch(names[i], names[j], rounds);
      totals[names[i]] += score1;
      totals[names[j]] += score2;
    }
  }
  return { totals };
}
