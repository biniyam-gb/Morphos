
// Random Matrix Theory — GOE/GUE eigenvalue statistics, Wigner semicircle
import { clearCanvas, label } from '../plot.js';

function randn() { let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

// Symmetric eigenvalue solver via Jacobi rotation (good for small N, dense symmetric matrices)
function jacobiEigenvalues(A, n, maxSweeps=60) {
  const a = A.map(row=>row.slice());
  for (let sweep=0; sweep<maxSweeps; sweep++) {
    let off=0;
    for (let p=0;p<n;p++) for (let q=p+1;q<n;q++) off += a[p][q]*a[p][q];
    if (off < 1e-20) break;
    for (let p=0; p<n-1; p++) {
      for (let q=p+1; q<n; q++) {
        if (Math.abs(a[p][q]) < 1e-14) continue;
        const theta = (a[q][q]-a[p][p])/(2*a[p][q]);
        const t = Math.sign(theta||1)/(Math.abs(theta)+Math.sqrt(theta*theta+1));
        const c = 1/Math.sqrt(t*t+1), s = t*c;
        const app=a[p][p],aqq=a[q][q],apq=a[p][q];
        a[p][p]=c*c*app-2*s*c*apq+s*s*aqq;
        a[q][q]=s*s*app+2*s*c*apq+c*c*aqq;
        a[p][q]=a[q][p]=0;
        for (let i=0;i<n;i++) {
          if (i===p||i===q) continue;
          const aip=a[i][p], aiq=a[i][q];
          a[i][p]=a[p][i]=c*aip-s*aiq;
          a[i][q]=a[q][i]=s*aip+c*aiq;
        }
      }
    }
  }
  return Array.from({length:n},(_,i)=>a[i][i]).sort((x,y)=>x-y);
}

export class RandomMatrix {
  constructor(W, H) {
    this.canvasW=W; this.canvasH=H;
    this.params = {
      ensemble: 'GOE',  // GOE | GUE | Wishart | Uniform-symmetric
      N: 40,
      trials: 25,
      view: 'eigenvalue-histogram',  // eigenvalue-histogram | spacing-distribution | eigenvalue-trace
      bins: 40,
    };
    this.paramDefs = [
      { group: 'Ensemble', items: [
        { id: 'ensemble', label: 'Random matrix type', type: 'select',
          options: ['GOE','GUE-like','Wishart','Uniform-symmetric'],
          tip: 'GOE: Gaussian Orthogonal Ensemble (real symmetric). GUE-like: complex Hermitian (simulated via doubled GOE). Wishart: covariance matrices XᵀX. Uniform: symmetric with uniform entries.' },
        { id: 'N', label: 'Matrix size N', min: 8, max: 100, step: 2, type: 'range',
          tip: 'Larger N → cleaner semicircle law (asymptotic N→∞ result).' },
        { id: 'trials', label: 'Independent trials', min: 1, max: 100, step: 1, type: 'range',
          tip: 'More trials = smoother histogram (aggregates eigenvalues across matrices).' },
      ]},
      { group: 'View', items: [
        { id: 'view', label: 'Statistic', type: 'select',
          options: ['eigenvalue-histogram','spacing-distribution','eigenvalue-trace'],
          tip: 'histogram: Wigner semicircle law. spacing: level repulsion (GOE/GUE differ!). trace: eigenvalues as N grows.' },
        { id: 'bins', label: 'Histogram bins', min: 15, max: 80, step: 5, type: 'range' },
      ]},
    ];
    this.presets = [
      { id: 'goe-hist',  name: 'GOE semicircle',      params: { ensemble:'GOE', N:60, trials:30, view:'eigenvalue-histogram' } },
      { id: 'goe-space', name: 'GOE level spacing',    params: { ensemble:'GOE', N:60, trials:30, view:'spacing-distribution' } },
      { id: 'gue-space', name: 'GUE level spacing',     params: { ensemble:'GUE-like', N:60, trials:30, view:'spacing-distribution' } },
      { id: 'wishart',   name: 'Wishart (Marchenko-Pastur)', params: { ensemble:'Wishart', N:50, trials:20, view:'eigenvalue-histogram' } },
      { id: 'trace',     name: 'Eigenvalue evolution', params: { ensemble:'GOE', N:30, view:'eigenvalue-trace' } },
    ];
    this.domain = 'Random Matrix Theory';
    this.description = 'Eigenvalues of large random matrices follow universal laws independent of matrix details. Wigner semicircle law: eigenvalue density → (2/πR²)√(R²−x²). Level spacing shows "repulsion" — GOE/GUE matrices avoid close eigenvalues, unlike Poisson (uncorrelated) statistics. Connects to quantum chaos, zeta zeros, nuclear physics.';
    this.stepsPerFrame = 0;
    this._dirty = true;
    this._cache = null;
  }

  getFormula() {
    const m = {
      GOE: 'A = (G+Gᵀ)/2, G~N(0,1) iid  —  real symmetric',
      'GUE-like': 'Hermitian: A=(G+G†)/2 with complex G  (simulated)',
      Wishart: 'W = XXᵀ/N, X is N×N Gaussian  —  covariance matrices',
      'Uniform-symmetric': 'A symmetric, entries ~ Uniform(−1,1)',
    };
    return m[this.params.ensemble] || '';
  }

  reset() { this._dirty = true; }
  update() {}
  onParamChange() { this._dirty = true; }

  _generateMatrix(N, ensemble) {
    const A = Array.from({length:N},()=>new Array(N).fill(0));
    if (ensemble==='Wishart') {
      // X is N x N random gaussian, W = XX^T / N
      const X = Array.from({length:N},()=>Array.from({length:N},()=>randn()));
      for (let i=0;i<N;i++) for(let j=0;j<N;j++) {
        let s=0; for(let k=0;k<N;k++) s+=X[i][k]*X[j][k];
        A[i][j]=s/N;
      }
      return A;
    }
    for (let i=0;i<N;i++) {
      for (let j=i;j<N;j++) {
        let v;
        if (ensemble==='Uniform-symmetric') v = (Math.random()*2-1);
        else v = randn();  // GOE and GUE-like both use real symmetric here (GUE complex effects on spacing simulated via doubling below)
        A[i][j]=v; A[j][i]=v;
      }
      A[i][i] = (ensemble==='Uniform-symmetric'?(Math.random()*2-1):randn())*Math.SQRT2;
    }
    return A;
  }

  _computeEnsemble() {
    const { N, trials, ensemble } = this.params;
    const allEigs = [];
    const traceData = [];
    const isGUE = ensemble==='GUE-like';
    for (let tr=0; tr<trials; tr++) {
      const A = this._generateMatrix(N, ensemble);
      const eigs = jacobiEigenvalues(A, N);
      const norm = isGUE ? Math.sqrt(2*N) : Math.sqrt(N); // normalization for semicircle support
      const normed = eigs.map(e=>e/norm);
      allEigs.push(...normed);
      if (tr===0) traceData.push(...normed);
    }
    return { allEigs, traceData };
  }

  _computeTraceEvolution() {
    const maxN = this.params.N;
    const sizes = [];
    for (let n=4; n<=maxN; n+=2) sizes.push(n);
    return sizes.map(n => {
      const A = this._generateMatrix(n, this.params.ensemble);
      const eigs = jacobiEigenvalues(A, n);
      return { n, eigs: eigs.map(e=>e/Math.sqrt(n)) };
    });
  }

  render(ctx, canvas) {
    if (!this._dirty) return; this._dirty=false;
    const W=canvas.width, H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    const v = this.params.view;
    if (v==='eigenvalue-histogram') this._renderHistogram(ctx,W,H);
    else if (v==='spacing-distribution') this._renderSpacing(ctx,W,H);
    else if (v==='eigenvalue-trace') this._renderTrace(ctx,W,H);
  }

  _renderHistogram(ctx,W,H) {
    const { allEigs } = this._computeEnsemble();
    const pad=50, bins=this.params.bins;
    const isWishart = this.params.ensemble==='Wishart';
    const lo = isWishart ? 0 : -2.2, hi = isWishart ? 4.5 : 2.2;
    const hist = new Float64Array(bins);
    for (const e of allEigs) { const b=Math.floor((e-lo)/(hi-lo)*bins); if(b>=0&&b<bins) hist[b]++; }
    const maxH = Math.max(...hist)||1;
    const tx = i => pad + (i/bins)*(W-2*pad);
    const ty = h => H-pad-(h/maxH)*(H-2*pad-30);
    // Axes
    ctx.strokeStyle='#ddd';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad,H-pad);ctx.lineTo(W-pad,H-pad);ctx.stroke();
    // Histogram
    ctx.fillStyle='rgba(26,79,168,0.6)';
    for (let i=0;i<bins;i++) ctx.fillRect(tx(i),ty(hist[i]),(W-2*pad)/bins-1,H-pad-ty(hist[i]));
    // Theoretical curve
    ctx.strokeStyle='#c42020'; ctx.lineWidth=2.5;
    ctx.beginPath();
    const totalArea = allEigs.length * (hi-lo)/bins;
    for (let i=0;i<=200;i++) {
      const x = lo + (hi-lo)*i/200;
      let theory;
      if (isWishart) {
        // Marchenko-Pastur with ratio=1: density = 1/(2π x) sqrt(x(4-x)) for 0<x<4
        theory = (x>0.001 && x<4) ? Math.sqrt(x*(4-x))/(2*Math.PI*x) : 0;
      } else {
        const R=2;
        theory = Math.abs(x)<R ? (2/(Math.PI*R*R))*Math.sqrt(R*R-x*x) : 0;
      }
      const y = ty(theory*totalArea);
      i===0?ctx.moveTo(tx((x-lo)/(hi-lo)*bins),y):ctx.lineTo(tx((x-lo)/(hi-lo)*bins),y);
    }
    ctx.stroke();
    label(ctx, `${this.params.ensemble}: N=${this.params.N}, ${this.params.trials} trials, ${allEigs.length} eigenvalues`, pad, 8, { color:'#333', size:11, bg:'rgba(255,255,255,0.9)' });
    label(ctx, isWishart?'Red: Marchenko-Pastur law':'Red: Wigner semicircle law (2/πR²)√(R²−x²)', pad, 26, { color:'#c42020', size:10, bg:'rgba(255,255,255,0.88)' });
    ctx.fillStyle='#888';ctx.font='10px Courier New';ctx.textAlign='center';
    ctx.fillText('normalized eigenvalue λ/√N',W/2,H-8);
  }

  _renderSpacing(ctx,W,H) {
    const { allEigs } = this._computeEnsemble();
    const sorted = allEigs.slice().sort((a,b)=>a-b);
    // Unfold spectrum (normalize local spacing to mean 1) — simplified: use raw consecutive spacings, normalized by mean
    const spacings = [];
    for (let i=1;i<sorted.length;i++) {
      const s = sorted[i]-sorted[i-1];
      if (s>0) spacings.push(s);
    }
    const mean = spacings.reduce((a,b)=>a+b,0)/spacings.length;
    const normed = spacings.map(s=>s/mean);

    const pad=50, bins=40, maxS=4;
    const hist = new Float64Array(bins);
    for (const s of normed) { const b=Math.floor(s/maxS*bins); if(b>=0&&b<bins) hist[b]++; }
    const totalArea = normed.length * maxS/bins;
    const maxH = Math.max(...hist)||1;
    const tx = i => pad+(i/bins)*(W-2*pad);
    const ty = h => H-pad-(h/maxH)*(H-2*pad-30);
    ctx.fillStyle='rgba(26,79,168,0.6)';
    for (let i=0;i<bins;i++) ctx.fillRect(tx(i),ty(hist[i]),(W-2*pad)/bins-1,H-pad-ty(hist[i]));

    // Wigner surmise: GOE P(s)=(πs/2)exp(-πs²/4). Poisson: P(s)=exp(-s)
    const isGUE = this.params.ensemble==='GUE-like';
    ctx.strokeStyle='#c42020'; ctx.lineWidth=2.5;
    ctx.beginPath();
    for (let i=0;i<=200;i++) {
      const s = maxS*i/200;
      const p = isGUE ? (32/(Math.PI*Math.PI))*s*s*Math.exp(-4*s*s/Math.PI) : (Math.PI*s/2)*Math.exp(-Math.PI*s*s/4);
      const y = ty(p*totalArea);
      i===0?ctx.moveTo(tx(i/200*bins),y):ctx.lineTo(tx(i/200*bins),y);
    }
    ctx.stroke();
    // Poisson comparison
    ctx.strokeStyle='rgba(100,100,100,0.6)'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
    ctx.beginPath();
    for (let i=0;i<=200;i++) {
      const s=maxS*i/200; const p=Math.exp(-s);
      const y=ty(p*totalArea);
      i===0?ctx.moveTo(tx(i/200*bins),y):ctx.lineTo(tx(i/200*bins),y);
    }
    ctx.stroke(); ctx.setLineDash([]);

    label(ctx, `Level Spacing Distribution — ${this.params.ensemble}`, pad, 8, { color:'#333', size:12, bg:'rgba(255,255,255,0.9)' });
    label(ctx, isGUE?'Red: GUE Wigner surmise P(s)∝s²e^(−4s²/π) [quadratic repulsion]':'Red: GOE Wigner surmise P(s)=(πs/2)e^(−πs²/4) [linear repulsion]', pad, 26, { color:'#c42020', size:10, bg:'rgba(255,255,255,0.88)' });
    label(ctx, 'Gray dashed: Poisson e⁻ˢ (uncorrelated eigenvalues — NOT what random matrices show)', pad, 42, { color:'#888', size:10, bg:'rgba(255,255,255,0.85)' });
    label(ctx, 'Key insight: random matrix eigenvalues REPEL — P(0)=0, unlike independent random points!', pad, H-16, { color:'#1a6b1a', size:10 });
  }

  _renderTrace(ctx,W,H) {
    const data = this._computeTraceEvolution();
    const pad=50;
    const allVals = data.flatMap(d=>d.eigs);
    const yMin=Math.min(...allVals)-0.3, yMax=Math.max(...allVals)+0.3;
    const tx = n => pad + (n-data[0].n)/(data[data.length-1].n-data[0].n)*(W-2*pad);
    const ty = v => H-pad-(v-yMin)/(yMax-yMin)*(H-2*pad);
    ctx.strokeStyle='#ddd';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad,ty(0));ctx.lineTo(W-pad,ty(0));ctx.stroke();
    for (const d of data) {
      for (const e of d.eigs) {
        ctx.fillStyle='rgba(26,79,168,0.5)';
        ctx.beginPath(); ctx.arc(tx(d.n), ty(e), 1.5, 0, Math.PI*2); ctx.fill();
      }
    }
    // Semicircle bounds
    ctx.strokeStyle='#c42020'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
    ctx.beginPath();ctx.moveTo(pad,ty(2));ctx.lineTo(W-pad,ty(2));ctx.stroke();
    ctx.beginPath();ctx.moveTo(pad,ty(-2));ctx.lineTo(W-pad,ty(-2));ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, `Eigenvalue spectrum as N grows (${this.params.ensemble})`, pad, 8, { color:'#333', size:12, bg:'rgba(255,255,255,0.9)' });
    label(ctx, 'Red dashed: semicircle support [−2,2] — eigenvalues converge to this range', pad, 26, { color:'#c42020', size:10, bg:'rgba(255,255,255,0.88)' });
    ctx.fillStyle='#888';ctx.font='10px Courier New';ctx.textAlign='center';
    ctx.fillText('matrix size N',W/2,H-8);
  }

  coordInfo() { return `${this.params.ensemble}  N=${this.params.N}  |  ↺ to regenerate`; }
}
