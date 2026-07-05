
// Knot Theory — torus knots/links, braid words, crossing diagrams
import { clearCanvas, label } from '../plot.js';

// (p,q) torus knot parametrization in 3D, projected to 2D
function torusKnotPoint(t, p, q, R=2, r=0.8) {
  const x = (R + r*Math.cos(q*t)) * Math.cos(p*t);
  const y = (R + r*Math.cos(q*t)) * Math.sin(p*t);
  const z = r*Math.sin(q*t);
  return [x,y,z];
}

function project3(x,y,z,rx,ry) {
  const cy=Math.cos(ry), sy=Math.sin(ry);
  const x2=x*cy+z*sy, z2=-x*sy+z*cy;
  const cx=Math.cos(rx), sx=Math.sin(rx);
  const y3=y*cx-z2*sx, z3=y*sx+z2*cx;
  return [x2, y3, z3];
}

const TORUS_PRESETS = {
  'Trefoil (3,2)':      { p:3, q:2 },
  'Figure-8-like (3,4)':{ p:3, q:4 },
  'Cinquefoil (5,2)':   { p:5, q:2 },
  '(5,3) knot':         { p:5, q:3 },
  '(7,2) knot':         { p:7, q:2 },
  'Hopf Link (2,2)':    { p:2, q:2 },
  'Unknot (1,1)':       { p:1, q:1 },
  '(4,3) knot':         { p:4, q:3 },
  '(8,3) knot':         { p:8, q:3 },
};

export class KnotTheory {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = {
      view: 'torus-3d',  // torus-3d | braid | crossing-diagram
      knotType: 'Trefoil (3,2)',
      tubeRadius: 0.22,
      rotX: 0.5, rotY: 0.3, autoRotate: true,
      braidWord: 'σ1 σ2 σ1⁻¹ σ2',
      strands: 3,
    };
    this.paramDefs = [
      { group: 'Knot', items: [
        { id: 'view', label: 'Visualization', type: 'select',
          options: ['torus-3d','braid','crossing-diagram'],
          tip: 'torus-3d: (p,q) torus knot in 3D. braid: braid word → permutation. crossing-diagram: 2D knot diagram with over/under crossings.' },
        { id: 'knotType', label: '(p,q) torus knot', type: 'select', options: Object.keys(TORUS_PRESETS),
          tip: 'gcd(p,q)=1 gives a knot; gcd(p,q)=d>1 gives a d-component link.' },
      ]},
      { group: '3D View', items: [
        { id: 'tubeRadius', label: 'Tube thickness', min: 0.05, max: 0.4, step: 0.01, type: 'range' },
        { id: 'autoRotate', label: 'Auto-rotate', type: 'toggle' },
        { id: 'rotX', label: 'Tilt', min:-Math.PI,max:Math.PI,step:0.01, type: 'range' },
        { id: 'rotY', label: 'Spin', min:-Math.PI,max:Math.PI,step:0.01, type: 'range' },
      ]},
      { group: 'Braid Group Bₙ', items: [
        { id: 'strands', label: 'Strands n', min: 2, max: 6, step: 1, type: 'range' },
        { id: 'braidWord', label: 'Braid word', type: 'code',
          tip: 'Space-separated generators: σ1 σ2 ... or s1 s2 (use s1- for inverse σ1⁻¹). Each σᵢ crosses strand i over i+1.' },
      ]},
    ];
    this.presets = [
      { id: 'trefoil',  name: 'Trefoil knot',     params: { view:'torus-3d', knotType:'Trefoil (3,2)' } },
      { id: 'cinq',     name: 'Cinquefoil (5₁)',   params: { view:'torus-3d', knotType:'Cinquefoil (5,2)' } },
      { id: 'hopf',     name: 'Hopf link',          params: { view:'torus-3d', knotType:'Hopf Link (2,2)' } },
      { id: 'braid1',   name: 'Braid: trefoil word',params: { view:'braid', strands:2, braidWord:'s1 s1 s1' } },
      { id: 'braid2',   name: 'Braid: 3-strand',    params: { view:'braid', strands:3, braidWord:'s1 s2 s1- s2' } },
      { id: 'cross',    name: 'Crossing diagram',    params: { view:'crossing-diagram', knotType:'Trefoil (3,2)' } },
    ];
    this.domain = 'Knot Theory & Topology';
    this.description = 'Torus knots wind p times around one direction, q times around another on a torus surface. The trefoil (3,2) is the simplest non-trivial knot. Braid groups Bₙ generate knots via Markov\'s theorem (braid closure).';
    this.stepsPerFrame = 1;
    this._drag = null;
  }

  getFormula() {
    if (this.params.view === 'torus-3d') {
      const { p, q } = TORUS_PRESETS[this.params.knotType] || {p:3,q:2};
      return `T(${p},${q}): (cos(pt)(R+r·cos(qt)), sin(pt)(R+r·cos(qt)), r·sin(qt))`;
    }
    return `Braid word in B${this.params.strands}: ${this.params.braidWord}`;
  }

  reset() { this.params.rotX=0.5; this.params.rotY=0.3; }
  update() { if (this.params.autoRotate) this.params.rotY += 0.006; }
  onParamChange() {}
  onMouseDrag(ddx,ddy) {
    this.params.rotY += ddx*0.008;
    this.params.rotX += ddy*0.008;
  }

  render(ctx, canvas) {
    const W=canvas.width, H=canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const v = this.params.view;
    if (v==='torus-3d') this._renderTorus(ctx,W,H);
    else if (v==='braid') this._renderBraid(ctx,W,H);
    else if (v==='crossing-diagram') this._renderCrossing(ctx,W,H);
  }

  _renderTorus(ctx,W,H) {
    const { p, q } = TORUS_PRESETS[this.params.knotType] || {p:3,q:2};
    const { rotX, rotY, tubeRadius } = this.params;
    const steps = 400;
    const tubeSteps = 8;
    const scale = Math.min(W,H)*0.13;
    const cx=W/2, cy=H/2;

    // Build tube mesh
    const segs = [];
    for (let i=0; i<=steps; i++) {
      const t = i/steps * Math.PI*2;
      const t2 = (i+1)/steps * Math.PI*2;
      const [x1,y1,z1] = torusKnotPoint(t,p,q);
      const [x2,y2,z2] = torusKnotPoint(t2,p,q);
      // Tangent direction for tube orientation
      const dx=x2-x1,dy=y2-y1,dz=z2-z1;
      const len=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;
      // Simple perpendicular frame
      let nx=-dy/len, ny=dx/len, nz=0;
      const nl=Math.sqrt(nx*nx+ny*ny+nz*nz)||1; nx/=nl;ny/=nl;nz/=nl;
      const bx=dy*nz-dz*ny, by=dz*nx-dx*nz, bz=dx*ny-dy*nx;
      for (let k=0; k<tubeSteps; k++) {
        const a = k/tubeSteps*Math.PI*2;
        const ox = x1 + tubeRadius*(nx*Math.cos(a)+bx*Math.sin(a));
        const oy = y1 + tubeRadius*(ny*Math.cos(a)+by*Math.sin(a));
        const oz = z1 + tubeRadius*(nz*Math.cos(a)+bz*Math.sin(a));
        const [px,py,pz] = project3(ox,oy,oz,rotX,rotY);
        segs.push({ x:cx+px*scale, y:cy-py*scale, z:pz, ti:i, ki:k });
      }
    }
    // Sort by depth and draw as points (simple but effective for thin tube)
    segs.sort((a,b)=>a.z-b.z);
    for (const s of segs) {
      const depthT = (s.z+4)/8;
      const hue = 220 - depthT*180;
      ctx.fillStyle = `hsl(${hue},65%,${35+depthT*25}%)`;
      ctx.beginPath(); ctx.arc(s.x,s.y,2.2,0,Math.PI*2); ctx.fill();
    }

    const { p:pp, q:qq } = TORUS_PRESETS[this.params.knotType];
    const g = gcd(pp,qq);
    label(ctx, `Torus ${g>1?'link':'knot'} T(${pp},${qq})`, 8, 8, { color:'#333', size:13, bg:'rgba(255,255,255,0.9)' });
    label(ctx, g>1?`${g} components (gcd(${pp},${qq})=${g})`:`Crossing number ≤ min(p(q-1), q(p-1)) = ${Math.min(pp*(qq-1),qq*(pp-1))}`, 8, 26, { color:'#666', size:10, bg:'rgba(255,255,255,0.85)' });
    label(ctx, 'Drag to rotate', 8, H-16, { color:'#aaa', size:10 });
  }

  _renderBraid(ctx,W,H) {
    const n = this.params.strands;
    const gens = this.params.braidWord.trim().split(/\s+/).filter(Boolean);
    const pad=40, colW=(W-2*pad)/(n-1||1);
    const rowH = Math.max(30, Math.min(70, (H-2*pad)/(gens.length+1)));
    const startY=pad;

    // Track strand positions (for permutation coloring)
    let positions = Array.from({length:n},(_,i)=>i);
    const cols = ['#c42020','#1a4fa8','#1a6b1a','#a05000','#6020a0','#1a7a7a'];
    const origColor = i => cols[i%cols.length];

    // Draw initial strand labels
    for (let i=0;i<n;i++) {
      const x = pad+i*colW;
      ctx.fillStyle = origColor(i);
      ctx.beginPath();ctx.arc(x,startY,4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#333';ctx.font='10px Courier New';ctx.textAlign='center';
      ctx.fillText(i+1,x,startY-10);
    }

    let y = startY;
    let curPos = Array.from({length:n},(_,i)=>i); // curPos[strand_original] = current_column

    for (const g of gens) {
      const m = g.match(/[sσ](\d+)(-|⁻¹|')?/);
      if (!m) { y+=rowH; continue; }
      const i = parseInt(m[1])-1; // crossing between column i and i+1
      const inv = !!m[2];
      if (i<0||i>=n-1) { y+=rowH; continue; }

      const y2 = y+rowH;
      // Draw straight strands except at crossing
      for (let s=0; s<n; s++) {
        const col = curPos[s];
        if (col===i || col===i+1) continue;
        const x = pad+col*colW;
        ctx.strokeStyle = origColor(s); ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y2); ctx.stroke();
      }
      // Find which strands are at i, i+1
      const sA = curPos.indexOf(i), sB = curPos.indexOf(i+1);
      const xA = pad+i*colW, xB = pad+(i+1)*colW;
      // Draw crossing: one strand goes over (drawn last/thicker), other under (gap)
      const drawCross = (sOver, sUnder) => {
        const xO = curPos[sOver]===i?xA:xB, xU = curPos[sUnder]===i?xA:xB;
        // under strand with gap
        ctx.strokeStyle = origColor(sUnder); ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(xU,y); ctx.lineTo(xU+(xO-xU)*0.4,y+rowH*0.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xU+(xO-xU)*0.6,y+rowH*0.6); ctx.lineTo(xO,y2); ctx.stroke();
        // over strand continuous
        ctx.strokeStyle = origColor(sOver); ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(xO,y); ctx.lineTo(xU,y2); ctx.stroke();
      };
      if (!inv) drawCross(sA, sB); else drawCross(sB, sA);

      // Swap positions
      [curPos[sA], curPos[sB]] = [curPos[sB], curPos[sA]];
      y = y2;

      ctx.fillStyle='#888'; ctx.font='9px Courier New'; ctx.textAlign='left';
      ctx.fillText(g, W-pad+6, y-rowH/2+3);
    }

    // Final permutation
    label(ctx, `Braid word: ${this.params.braidWord || '(identity)'}`, 8, 8, { color:'#333', size:12, bg:'rgba(255,255,255,0.9)' });
    const perm = curPos.map((c,s)=>`${s+1}→${c+1}`).join(' ');
    label(ctx, `Permutation: ${perm}`, 8, H-18, { color:'#666', size:10, bg:'rgba(255,255,255,0.85)' });
  }

  _renderCrossing(ctx,W,H) {
    const { p, q } = TORUS_PRESETS[this.params.knotType] || {p:3,q:2};
    // 2D projection of torus knot (flatten z, use it for over/under)
    const steps = 300;
    const cx=W/2, cy=H/2, R=Math.min(W,H)*0.32;
    const pts = [];
    for (let i=0;i<=steps;i++) {
      const t = i/steps*Math.PI*2;
      const [x,y,z] = torusKnotPoint(t,p,q,2,0.8);
      // Simple 2D projection (top-down-ish with rotation)
      const a=0.6;
      const px = x*Math.cos(a)-y*Math.sin(a)*0.3;
      const py = y*Math.cos(a)*0.6 + x*Math.sin(a)*0.2 + z*0.3;
      pts.push({x:cx+px*R*0.4, y:cy+py*R*0.4, z});
    }
    // Find self-intersections approximately by checking segment pairs (coarse)
    // For visual simplicity: draw path, break with gaps where z is "lower" near crossings using a heuristic
    ctx.lineWidth = 3; ctx.lineCap='round'; ctx.lineJoin='round';
    for (let i=0;i<pts.length-1;i++) {
      const t = i/pts.length;
      const hue = t*300+10;
      ctx.strokeStyle = `hsl(${hue},65%,42%)`;
      ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[i+1].x,pts[i+1].y); ctx.stroke();
    }
    label(ctx, `Knot diagram projection: T(${p},${q})`, 8, 8, { color:'#333', size:12, bg:'rgba(255,255,255,0.9)' });
    label(ctx, 'Color gradient follows the curve parameter t from 0 to 2π', 8, H-16, { color:'#666', size:10 });
  }

  coordInfo() {
    if (this.params.view==='torus-3d') {
      const {p,q} = TORUS_PRESETS[this.params.knotType]||{p:3,q:2};
      return `T(${p},${q})  |  rotX=${this.params.rotX.toFixed(2)} rotY=${this.params.rotY.toFixed(2)}`;
    }
    return `Braid group B${this.params.strands}`;
  }
}

function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b];}return a;}
