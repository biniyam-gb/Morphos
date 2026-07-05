
// Elliptic Curves — y² = x³ + ax + b over R
// Group law: chord-and-tangent construction
import { clearCanvas, label, dot, drawAxes, Viewport } from '../plot.js';

export class EllipticCurve {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.vp = new Viewport(-4,4,-6,6);
    this.params = { a:-1, b:0, showGroup:true, animP:0.0, showTorsion:false };
    this.paramDefs=[
      { group:'Curve  y² = x³ + ax + b', items:[
        { id:'a', label:'a', min:-4, max:4, step:0.05, type:'range', tip:'Coefficient of x. Affects shape.' },
        { id:'b', label:'b', min:-4, max:4, step:0.05, type:'range', tip:'Constant term. Discriminant Δ = -16(4a³+27b²) ≠ 0 needed.' },
      ]},
      { group:'Group Law', items:[
        { id:'showGroup',   label:'Show P+Q construction', type:'toggle' },
        { id:'animP',       label:'Move P along curve', min:0, max:1, step:0.01, type:'range', tip:'Slides point P along the curve.' },
        { id:'showTorsion', label:'Show 2P (tangent line)', type:'toggle' },
      ]},
    ];
    this.presets=[
      {id:'secp256k1', name:'secp256k1 (Bitcoin)', params:{a:0,   b:7,   animP:0.3}},
      {id:'curve25519',name:'Curve25519 shape',    params:{a:-1,  b:0,   animP:0.25}},
      {id:'nodal',     name:'Nodal (degenerate)',  params:{a:0,   b:0,   animP:0.3}},
      {id:'cuspidal',  name:'Cuspidal cubic',      params:{a:0,   b:0.001,animP:0.3}},
      {id:'twist',     name:'Two components',      params:{a:-3,  b:2,   animP:0.2}},
      {id:'classic',   name:'Classic y²=x³−x',    params:{a:-1,  b:0,   animP:0.25}},
      {id:'fermat',    name:'Fermat-related',      params:{a:-5,  b:4,   animP:0.3}},
    ];
    this.domain='Algebraic Geometry';
    this.formula='y² = x³ + ax + b';
    this.description='Elliptic curves form an abelian group under the chord-and-tangent law. Fundamental in cryptography (ECC) and the proof of Fermat\'s Last Theorem.';
    this.stepsPerFrame=0; this._dirty=true;
  }

  getFormula() {
    const {a,b}=this.params;
    const as=a===0?'':a>0?` + ${a}x`:` − ${Math.abs(a)}x`;
    const bs=b===0?'':b>0?` + ${b}`:` − ${Math.abs(b)}`;
    const disc=-16*(4*a*a*a+27*b*b);
    return `y² = x³${as}${bs}   Δ=${disc.toFixed(2)}${Math.abs(disc)<0.01?' (singular!)':''}`;
  }

  discriminant() { const {a,b}=this.params; return -16*(4*a*a*a+27*b*b); }

  // Find y for given x on curve (returns null or [y1,y2])
  yForX(x) {
    const {a,b}=this.params;
    const rhs = x*x*x + a*x + b;
    if (rhs<0) return null;
    const y=Math.sqrt(rhs);
    return [y,-y];
  }

  // Parametric: parameterize the real points by arc length approximation
  // Returns a point on the real component for t in [0,1]
  ptOnCurve(t) {
    const {a,b}=this.params;
    // Scan x range for real points, pick tth one
    const pts=[];
    for(let xi=-3.99;xi<=4;xi+=0.04){
      const ys=this.yForX(xi);
      if(ys) { pts.push({x:xi,y:ys[0]}); pts.push({x:xi,y:ys[1]}); }
    }
    if(!pts.length) return {x:0,y:0};
    pts.sort((a,b)=>a.x-b.x||a.y-b.y);
    return pts[Math.floor(t*pts.length)%pts.length];
  }

  // Group law: P+Q
  addPoints(P, Q) {
    const {a}=this.params;
    if (!P||!Q) return null;
    const eps=1e-10;
    if (Math.abs(P.x-Q.x)<eps && Math.abs(P.y+Q.y)<eps) return null; // P+(-P)=O
    let m;
    if (Math.abs(P.x-Q.x)<eps) {
      // tangent (2P)
      if (Math.abs(P.y)<eps) return null;
      m = (3*P.x*P.x + a) / (2*P.y);
    } else {
      m = (Q.y-P.y)/(Q.x-P.x);
    }
    const rx = m*m - P.x - Q.x;
    const ry = -(m*(rx-P.x)+P.y);
    return {x:rx,y:ry};
  }

  reset() { this._dirty=true; }
  update() {}
  onParamChange() { this._dirty=true; }

  render(ctx, canvas) {
    this._dirty=false;
    const W=canvas.width,H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    const vp=this.vp;
    drawAxes(ctx,vp,W,H);

    const {a,b,showGroup,animP,showTorsion}=this.params;
    const disc=this.discriminant();
    const singular=Math.abs(disc)<0.01;

    // Draw curve
    ctx.strokeStyle=singular?'#c42020':'#1a4fa8'; ctx.lineWidth=2;
    // Trace upper branch
    const branchColor = singular ? '#c42020':'#1a4fa8';
    for(const sign of [1,-1]){
      ctx.beginPath(); let started=false;
      for(let xi=-4;xi<=4;xi+=0.015){
        const rhs=xi*xi*xi+a*xi+b;
        if(rhs<0){started=false;continue;}
        const y=sign*Math.sqrt(rhs);
        const [cx,cy]=vp.toCanvas(xi,y,W,H);
        if(!started){ctx.moveTo(cx,cy);started=true;}else ctx.lineTo(cx,cy);
      }
      ctx.stroke();
    }

    // Group law visualization
    if(showGroup && !singular){
      // Choose P and Q on curve
      const P=this.ptOnCurve(animP);
      const Q=this.ptOnCurve((animP+0.35)%1);
      if(P&&Q){
        const R=this.addPoints(P,Q);
        if(R){
          // Draw chord P-Q extended to R, reflect
          const [px,py]=vp.toCanvas(P.x,P.y,W,H);
          const [qx,qy]=vp.toCanvas(Q.x,Q.y,W,H);
          const [rx,ry]=vp.toCanvas(R.x,R.y,W,H);
          const [rrx,rry]=vp.toCanvas(R.x,-R.y,W,H);
          // Chord
          ctx.save(); ctx.strokeStyle='rgba(160,80,0,0.8)'; ctx.lineWidth=1.2; ctx.setLineDash([4,3]);
          ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(qx,qy); ctx.lineTo(rx,ry); ctx.stroke();
          // Vertical reflection line
          ctx.strokeStyle='rgba(100,100,100,0.5)';
          ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rrx,rry); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
          dot(ctx,px,py,5,'#c42020',null); label(ctx,'P',px+6,py-6,{color:'#c42020',size:12});
          dot(ctx,qx,qy,5,'#1a6b1a',null); label(ctx,'Q',qx+6,qy-6,{color:'#1a6b1a',size:12});
          dot(ctx,rx,ry,4,'#aaa',null);    label(ctx,'−(P+Q)',rx+6,ry-6,{color:'#888',size:10});
          dot(ctx,rrx,rry,5,'#6020a0',null); label(ctx,'P+Q',rrx+6,rry-6,{color:'#6020a0',size:12});
        }
        // 2P (tangent)
        if(showTorsion){
          const P2=this.addPoints(P,P);
          if(P2){
            const [tx,ty]=vp.toCanvas(P2.x,-P2.y,W,H);
            dot(ctx,tx,ty,5,'#a05000',null); label(ctx,'2P',tx+6,ty-6,{color:'#a05000',size:12});
          }
        }
      }
    }

    // Discriminant warning
    if(singular){
      label(ctx,'WARNING: Singular curve (Δ=0). Not an elliptic curve!',8,8,{color:'#c42020',size:11,bg:'rgba(255,220,220,0.9)'});
    }

    const [ax_,ay_]=vp.toCanvas(-3.5,5,W,H);
    label(ctx,this.getFormula(),8,8,{color:'#333',size:11,bg:'rgba(255,255,255,0.85)'});
    if(showGroup&&!singular) label(ctx,'Chord-tangent: P+Q defined by reflection of intersection',8,H-16,{color:'#888',size:10});
  }

  onWheel(cx,cy,delta,W,H){ this.vp.zoom(delta>0?1.3:.77,cx,cy,W,H); this._dirty=true; }
  onMouseDrag(ddx,ddy,cx,cy,W,H){ this.vp.pan(ddx,ddy,W,H); this._dirty=true; }
  coordInfo(cx,cy,W,H){
    const [x,y]=this.vp.toWorld(cx,cy,W,H);
    const {a,b}=this.params; const lhs=y*y, rhs=x*x*x+a*x+b;
    return `x=${x.toFixed(3)}  y=${y.toFixed(3)}  |  y²−(x³+ax+b) = ${(lhs-rhs).toFixed(3)}`;
  }
}
