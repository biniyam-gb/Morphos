
import { clearCanvas, label, dot } from '../plot.js';

function cAdd(a,b){return{r:a.r+b.r,i:a.i+b.i};}
function cSub(a,b){return{r:a.r-b.r,i:a.i-b.i};}
function cMul(a,b){return{r:a.r*b.r-a.i*b.i,i:a.r*b.i+a.i*b.r};}
function cDiv(a,b){const d=b.r*b.r+b.i*b.i;return{r:(a.r*b.r+a.i*b.i)/d,i:(a.i*b.r-a.r*b.i)/d};}
function cAbs(a){return Math.sqrt(a.r*a.r+a.i*a.i);}

// Hyperbolic distance
function hDist(p, q) {
  const num=(p.r-q.r)*(p.r-q.r)+(p.i-q.i)*(p.i-q.i);
  const den=(1-p.r*p.r-p.i*p.i)*(1-q.r*q.r-q.i*q.i);
  if(den<=0) return Infinity;
  return Math.acosh(1 + 2*num/den);
}

// Circle through p,q orthogonal to unit circle → {cx,cy,r} or null (diameter)
function geodesicCircle(p, q) {
  const px=p.r,py=p.i,qx=q.r,qy=q.i;
  // Perpendicular bisector of pq
  const mx=(px+qx)/2, my=(py+qy)/2;
  const dx=qx-px, dy=qy-py;
  // Center C on perp bisector: C=(mx−t·dy, my+t·dx)
  // Orthogonality to unit circle: |C|²=|C−P|²+1 → condition on t
  const denom = -2*(px*dy - py*dx);
  if (Math.abs(denom) < 1e-9) return null; // geodesic is a diameter
  const t = (px*px+py*py+1-2*px*mx-2*py*my) / denom;
  const ocx = mx - t*dy, ocy = my + t*dx;
  const r = Math.sqrt((ocx-px)*(ocx-px)+(ocy-py)*(ocy-py));
  return { cx:ocx, cy:ocy, r };
}

// Draw a geodesic between two points in the unit disk model
function drawGeodesic(ctx, p, q, ox, oy, R) {
  // Convert disk coords to canvas
  const tc = z => [ox + z.r*R, oy - z.i*R];
  const arc = geodesicCircle(p, q);
  ctx.save();
  // Clip to disk
  ctx.beginPath(); ctx.arc(ox, oy, R - 1, 0, Math.PI*2); ctx.clip();
  if (!arc) {
    // Diameter line
    const [ax,ay] = tc(p), [bx,by] = tc(q);
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
  } else {
    // Full circle — clipping handles the interior part
    const { cx: acx, cy: acy, r: ar } = arc;
    ctx.beginPath();
    ctx.arc(ox + acx*R, oy - acy*R, ar*R, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}

export class HyperbolicGeometry {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params  = { view:'geodesics', numRandom:10, showDist:true };
    this.paramDefs = [
      { group:'View', items:[
        { id:'view', label:'Mode', type:'select', options:['geodesics','triangle','parallel','tiling'],
          tip:'Click two points to draw a geodesic. Geodesics are arcs of circles ⊥ to the boundary.' },
        { id:'numRandom', label:'Background geodesics', min:0, max:30, step:1, type:'range' },
        { id:'showDist',  label:'Show hyperbolic distance', type:'toggle' },
      ]},
    ];
    this.presets=[
      {id:'geo',  name:'Geodesics',     params:{view:'geodesics', numRandom:12}},
      {id:'tri',  name:'H-Triangle',    params:{view:'triangle',  numRandom:0}},
      {id:'para', name:'Parallel lines',params:{view:'parallel',  numRandom:0}},
      {id:'til',  name:'H-Tiling',      params:{view:'tiling',    numRandom:0}},
    ];
    this.domain = 'Non-Euclidean Geometry';
    this.description = 'Poincaré disk model of hyperbolic plane. Geodesics = circular arcs ⊥ to boundary. Euclid\'s 5th postulate fails: through any exterior point pass infinitely many parallels.';
    this._pts = [];  // user-clicked points
    this._animT = 0;
    this.stepsPerFrame = 1;
  }

  getFormula() { return 'Poincaré disk:  ds² = 4(dx²+dy²) / (1 − |z|²)²'; }
  reset()      { this._pts = []; }
  update()     { this._animT += 0.006; }
  onParamChange(){ this._pts = []; }

  onClick(cx, cy, W, H) {
    const R = Math.min(W,H) * 0.45;
    const dx = (cx - W/2)/R, dy = -(cy - H/2)/R;
    if (dx*dx+dy*dy >= 0.96) return;
    this._pts.push({r:dx, i:dy});
    if (this._pts.length > 2) this._pts = this._pts.slice(-2);
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const R = Math.min(W,H) * 0.45;
    const ox = W/2, oy = H/2;

    // Disk background
    ctx.save();
    ctx.fillStyle = '#fafaf7';
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    // Background geodesics (random but seeded)
    let seed = 12345;
    const rng = () => { seed = (seed*1664525+1013904223)&0x7FFFFFFF; return seed/0x7FFFFFFF; };
    for (let i = 0; i < this.params.numRandom; i++) {
      const a1 = rng()*Math.PI*2, a2 = rng()*Math.PI*2;
      const r1 = 0.6+rng()*0.35, r2 = 0.6+rng()*0.35;
      const p = {r:r1*Math.cos(a1), i:r1*Math.sin(a1)};
      const q = {r:r2*Math.cos(a2), i:r2*Math.sin(a2)};
      const hue = (i / this.params.numRandom * 300 + 160);
      ctx.strokeStyle = `hsla(${hue},55%,45%,0.45)`; ctx.lineWidth = 1.2;
      drawGeodesic(ctx, p, q, ox, oy, R);
    }

    const view = this.params.view;

    // Hyperbolic triangle
    if (view === 'triangle') {
      const triPts = [{r:0,i:0.65},{r:-0.56,i:-0.32},{r:0.56,i:-0.32}];
      ctx.strokeStyle='#1a4fa8'; ctx.lineWidth=2;
      for (let i=0;i<3;i++) drawGeodesic(ctx,triPts[i],triPts[(i+1)%3],ox,oy,R);
      triPts.forEach((p,i)=>{
        const [px2,py2]=[ox+p.r*R,oy-p.i*R];
        dot(ctx,px2,py2,5,'#1a4fa8',['A','B','C'][i],12);
      });
      label(ctx,'Hyperbolic triangle: A+B+C < 180°',8,8,{color:'#1a4fa8',size:12,bg:'rgba(255,255,255,0.9)'});
      label(ctx,'Defect δ=π−(A+B+C) = Hyperbolic area (Gauss-Bonnet)',8,26,{color:'#555',size:10,bg:'rgba(255,255,255,0.88)'});
    }

    // Parallel lines illustration
    if (view === 'parallel') {
      // Draw a geodesic L, then several geodesics through P not meeting L
      const p1={r:-0.7,i:0}, p2={r:0.7,i:0}; // geodesic L (along real axis = diameter)
      ctx.strokeStyle='#c42020'; ctx.lineWidth=2;
      drawGeodesic(ctx,p1,p2,ox,oy,R);
      const P={r:0,i:0.45};
      // Several geodesics through P parallel to L
      const parallels=[{r:-0.98,i:0.2},{r:0.98,i:0.2},{r:-0.9,i:-0.43},{r:0.9,i:-0.43}];
      ctx.lineWidth=1.5;
      for(let i=0;i<parallels.length;i++){
        const c2=parallels[i];
        // Find a point on each parallel geodesic through P
        const hue=200+i*40;
        ctx.strokeStyle=`hsla(${hue},60%,40%,0.8)`;
        drawGeodesic(ctx,P,c2,ox,oy,R);
      }
      dot(ctx,ox+P.r*R,oy-P.i*R,5,'#333','P',12);
      label(ctx,'L: red geodesic  |  Blue: all through P, none meeting L',8,8,{color:'#333',size:11,bg:'rgba(255,255,255,0.9)'});
      label(ctx,'Euclid\'s 5th fails: ∞ many parallels through P',8,26,{color:'#c42020',size:11,bg:'rgba(255,255,255,0.88)'});
    }

    // Tiling: simple {∞,3} tiling approximation using reflections
    if (view === 'tiling') {
      // Draw a few ideal triangle geodesics
      const idealPts=(n)=>Array.from({length:n},(_,i)=>({r:Math.cos(i/n*Math.PI*2),i:Math.sin(i/n*Math.PI*2)}));
      const p7=idealPts(7);
      ctx.lineWidth=1;
      for(let i=0;i<7;i++){
        const hue=i/7*360;
        ctx.strokeStyle=`hsla(${hue},60%,40%,0.6)`;
        for(let j=i+1;j<7;j++) drawGeodesic(ctx,p7[i],p7[j],ox,oy,R);
      }
      label(ctx,'{7,3} tiling (ideal vertices on boundary)',8,8,{color:'#333',size:11,bg:'rgba(255,255,255,0.9)'});
    }

    // User geodesic
    if (this._pts.length === 2) {
      const [p, q] = this._pts;
      ctx.strokeStyle = '#c42020'; ctx.lineWidth = 2.5;
      drawGeodesic(ctx, p, q, ox, oy, R);
      const [px2,py2]=[ox+p.r*R,oy-p.i*R],[qx2,qy2]=[ox+q.r*R,oy-q.i*R];
      dot(ctx,px2,py2,5,'#c42020');
      dot(ctx,qx2,qy2,5,'#c42020');
      if (this.params.showDist) {
        const d = hDist(p, q);
        label(ctx, `h-dist = ${d.toFixed(4)}`, 8, 8, { color:'#c42020', size:13, bg:'rgba(255,255,255,0.9)' });
        // Euclidean distance for comparison
        const ed = Math.sqrt((p.r-q.r)**2+(p.i-q.i)**2);
        label(ctx, `e-dist = ${ed.toFixed(4)}  (e-dist underestimates h-dist near boundary)`, 8, 26, { color:'#888', size:10, bg:'rgba(255,255,255,0.88)' });
      }
    } else if (this._pts.length === 1) {
      const p = this._pts[0];
      dot(ctx, ox+p.r*R, oy-p.i*R, 5, '#c42020');
      label(ctx, 'Click a second point', 8, 8, { color:'#555', size:11, bg:'rgba(255,255,255,0.9)' });
    }

    if (this._pts.length === 0) {
      label(ctx, 'Click to place points', 8, H-18, { color:'#aaa', size:10 });
    }
  }

  coordInfo(cx, cy, W, H) {
    const R = Math.min(W,H) * 0.45;
    const dx=(cx-W/2)/R, dy=-(cy-H/2)/R;
    const r2=dx*dx+dy*dy;
    if(r2>=1) return 'boundary (point at infinity)';
    const hd = -Math.log((1-Math.sqrt(r2))/(1+Math.sqrt(r2)));
    return `z=${dx.toFixed(3)}+${dy.toFixed(3)}i  |z|=${Math.sqrt(r2).toFixed(3)}  h-dist from O=${hd.toFixed(3)}`;
  }
}
