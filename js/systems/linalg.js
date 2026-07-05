
// Linear Algebra — 2D Matrix transformations, eigenvectors, SVD
import { clearCanvas, label, dot, drawAxes, Viewport } from '../plot.js';

export class LinearAlgebra {
  constructor(W,H){
    this.canvasW=W; this.canvasH=H;
    this.vp=new Viewport(-4,4,-4,4);
    this.params={
      a:1, b:0, c:0, d:1,  // 2x2 matrix [[a,b],[c,d]]
      view:'transform',      // transform | eigen | svd | iteration
      showGrid:true, showEigen:true,
      animT:0,
      preset:'Identity',
    };
    this.paramDefs=[
      { group:'Matrix  A = [[a,b],[c,d]]', items:[
        { id:'a', label:'a (M₁₁)', min:-4, max:4, step:0.05, type:'range' },
        { id:'b', label:'b (M₁₂)', min:-4, max:4, step:0.05, type:'range' },
        { id:'c', label:'c (M₂₁)', min:-4, max:4, step:0.05, type:'range' },
        { id:'d', label:'d (M₂₂)', min:-4, max:4, step:0.05, type:'range' },
      ]},
      { group:'View', items:[
        { id:'view', label:'Mode', type:'select', options:['transform','eigen','svd','power-iteration'],
          tip:'Transform: see how A deforms the plane. Eigen: eigenvectors. SVD: singular vectors. Power: Aⁿv convergence.' },
        { id:'showGrid', label:'Show grid',       type:'toggle' },
        { id:'showEigen',label:'Show eigenvectors',type:'toggle' },
        { id:'animT',    label:'Interpolation t', min:0, max:1, step:0.01, type:'range', tip:'Animate between I and A.' },
      ]},
    ];
    this.presets=[
      {id:'id',   name:'Identity',          params:{a:1, b:0, c:0, d:1,animT:1}},
      {id:'rot45',name:'Rotation 45°',      params:{a:.707,b:-.707,c:.707,d:.707,animT:1}},
      {id:'shear',name:'Shear',             params:{a:1, b:1, c:0, d:1,animT:1}},
      {id:'scale',name:'Non-uniform scale', params:{a:2, b:0, c:0, d:.5,animT:1}},
      {id:'proj', name:'Projection',        params:{a:1, b:0, c:0, d:0,animT:1}},
      {id:'refl', name:'Reflection (x-axis)',params:{a:1,b:0, c:0, d:-1,animT:1}},
      {id:'skew', name:'Skew-symmetric',    params:{a:0, b:-1,c:1, d:0,animT:1}},
      {id:'eigen',name:'Distinct eigenvals', params:{a:3, b:1, c:1, d:2,animT:1}},
    ];
    this.domain='Linear Algebra';
    this.stepsPerFrame=0; this._dirty=true;
    this.formula='T(v) = Av';
    this.description='Visualize how a 2×2 matrix transforms the plane. Eigenvectors are unchanged in direction. The determinant = area scaling factor. Drag the t-slider to animate.';
  }

  getFormula(){
    const {a,b,c,d}=this.params;
    const det=a*d-b*c;
    const tr=a+d;
    // eigenvalues via quadratic formula
    const disc=tr*tr-4*det;
    const ev = disc>=0
      ? `λ₁=${((tr+Math.sqrt(disc))/2).toFixed(2)}, λ₂=${((tr-Math.sqrt(disc))/2).toFixed(2)}`
      : `λ = ${(tr/2).toFixed(2)} ± ${(Math.sqrt(-disc)/2).toFixed(2)}i`;
    return `det=${det.toFixed(2)}  tr=${tr.toFixed(2)}  ${ev}`;
  }

  _eigen(){
    const {a,b,c,d}=this.params;
    const tr=a+d, det=a*d-b*c;
    const disc=tr*tr-4*det;
    if(disc<0) return null; // complex eigenvalues
    const l1=(tr+Math.sqrt(disc))/2, l2=(tr-Math.sqrt(disc))/2;
    const v1=b!==0?{x:b,y:l1-a}:{x:l1-d,y:c};
    const v2=b!==0?{x:b,y:l2-a}:{x:l2-d,y:c};
    const n1=Math.sqrt(v1.x**2+v1.y**2)||1, n2=Math.sqrt(v2.x**2+v2.y**2)||1;
    return [{x:v1.x/n1,y:v1.y/n1,l:l1},{x:v2.x/n2,y:v2.y/n2,l:l2}];
  }

  _apply(x,y,t=1){
    const {a,b,c,d}=this.params;
    // Lerp between I and A
    const at=1+(a-1)*t, bt=b*t, ct=c*t, dt=1+(d-1)*t;
    return [at*x+bt*y, ct*x+dt*y];
  }

  reset(){ this._dirty=true; }
  update(){}
  onParamChange(){ this._dirty=true; }
  onWheel(cx,cy,delta,W,H){ this.vp.zoom(delta>0?1.3:.77,cx,cy,W,H); this._dirty=true; }
  onMouseDrag(ddx,ddy,cx,cy,W,H){ this.vp.pan(ddx,ddy,W,H); this._dirty=true; }

  render(ctx,canvas){
    this._dirty=false;
    const W=canvas.width,H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    const vp=this.vp;
    drawAxes(ctx,vp,W,H);
    const t=this.params.animT;

    // Original grid (faint)
    if(this.params.showGrid){
      ctx.save(); ctx.strokeStyle='rgba(180,180,220,0.4)'; ctx.lineWidth=0.8;
      for(let gx=-4;gx<=4;gx++){
        const pts=[[-4,gx],[4,gx]]; // horizontal
        ctx.beginPath();
        const [cx1,cy1]=vp.toCanvas(this._apply(-4,gx,t)[0],this._apply(-4,gx,t)[1],W,H);
        const [cx2,cy2]=vp.toCanvas(this._apply(4,gx,t)[0],this._apply(4,gx,t)[1],W,H);
        ctx.moveTo(cx1,cy1); ctx.lineTo(cx2,cy2); ctx.stroke();
        const [cx3,cy3]=vp.toCanvas(this._apply(gx,-4,t)[0],this._apply(gx,-4,t)[1],W,H);
        const [cx4,cy4]=vp.toCanvas(this._apply(gx,4,t)[0],this._apply(gx,4,t)[1],W,H);
        ctx.beginPath(); ctx.moveTo(cx3,cy3); ctx.lineTo(cx4,cy4); ctx.stroke();
      }
      ctx.restore();
    }

    // Unit square → transformed
    const corners=[[0,0],[1,0],[1,1],[0,1]];
    const tc=corners.map(([x,y])=>this._apply(x,y,t));
    ctx.save(); ctx.strokeStyle='#1a4fa8'; ctx.fillStyle='rgba(26,79,168,0.1)'; ctx.lineWidth=1.5;
    ctx.beginPath();
    tc.forEach(([x,y],i)=>{ const[cx,cy]=vp.toCanvas(x,y,W,H); i===0?ctx.moveTo(cx,cy):ctx.lineTo(cx,cy); });
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // Basis vectors
    const drawVec=(ox,oy,tx2,ty2,col,lbl)=>{
      const[x1,y1]=vp.toCanvas(ox,oy,W,H),[x2,y2]=vp.toCanvas(tx2,ty2,W,H);
      ctx.save(); ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      const a=Math.atan2(y2-y1,x2-x1);
      ctx.beginPath(); ctx.moveTo(x2,y2);
      ctx.lineTo(x2-8*Math.cos(a-0.4),y2-8*Math.sin(a-0.4));
      ctx.lineTo(x2-8*Math.cos(a+0.4),y2-8*Math.sin(a+0.4));
      ctx.closePath(); ctx.fill();
      label(ctx,lbl,x2+5,y2-5,{color:col,size:12}); ctx.restore();
    };
    const [e1x,e1y]=this._apply(1,0,t);
    const [e2x,e2y]=this._apply(0,1,t);
    drawVec(0,0,e1x,e1y,'#c42020','Ae₁');
    drawVec(0,0,e2x,e2y,'#1a6b1a','Ae₂');

    // Eigenvectors
    if(this.params.showEigen){
      const evs=this._eigen();
      if(evs){
        for(const ev of evs){
          const sc=2;
          drawVec(-ev.x*sc,-ev.y*sc,ev.x*sc,ev.y*sc,'rgba(160,80,0,0.7)',`λ=${ev.l.toFixed(2)}`);
        }
      }
    }

    // Info panel
    const {a,b,c,d}=this.params;
    const matStr=`[${a.toFixed(2)} ${b.toFixed(2)}; ${c.toFixed(2)} ${d.toFixed(2)}]`;
    label(ctx,`A = ${matStr}`,8,8,{color:'#333',size:11,bg:'rgba(255,255,255,0.88)'});
    label(ctx,this.getFormula(),8,26,{color:'#555',size:10,bg:'rgba(255,255,255,0.88)'});
    if(this.params.showEigen&&!this._eigen()) label(ctx,'Complex eigenvalues — spiral behavior',8,44,{color:'#c42020',size:10});
  }

  coordInfo(cx,cy,W,H){
    const[x,y]=this.vp.toWorld(cx,cy,W,H);
    const[tx,ty]=this._apply(x,y);
    return `v=(${x.toFixed(2)},${y.toFixed(2)})  Av=(${tx.toFixed(2)},${ty.toFixed(2)})`;
  }
}
