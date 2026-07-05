
// Optimization Landscape — gradient descent, momentum, Adam on f(x,y)
import { Viewport, drawAxes, clearCanvas, label, dot } from '../plot.js';
import { sampleCM } from '../colormap.js';

const MATH=`"use strict";const{sin,cos,tan,exp,log,sqrt,abs,pow,atan,atan2,sinh,cosh,sign,floor,ceil,min,max,PI,E}=Math;const pi=PI,e=E;`;

const FUNC_PRESETS = {
  'Bowl (convex)':        { f:'x*x + y*y',            xr:[-3,3],   yr:[-3,3],   desc:'Strongly convex. Unique global minimum at (0,0). GD always converges.' },
  'Elongated Bowl':       { f:'x*x + 10*y*y',          xr:[-3,3],   yr:[-1,1],   desc:'Ill-conditioned (κ=10). GD zigzags; momentum helps dramatically.' },
  'Rosenbrock Banana':    { f:'(1-x)*(1-x)+100*(y-x*x)*(y-x*x)', xr:[-2,2], yr:[-1,3], desc:'Classic hard benchmark. Narrow curved valley. Global min at (1,1). GD is very slow.' },
  'Saddle Point':         { f:'x*x - y*y',             xr:[-3,3],   yr:[-3,3],   desc:'Saddle at (0,0). Gradient descent gets "stuck" near saddle for a while.' },
  'Rastrigin':            { f:'20+x*x+y*y-10*(cos(2*pi*x)+cos(2*pi*y))', xr:[-4,4], yr:[-4,4], desc:'Many local minima. GD reliably gets trapped. Hard for gradient methods.' },
  'Himmelblau':           { f:'(x*x+y-11)*(x*x+y-11)+(x+y*y-7)*(x+y*y-7)', xr:[-5,5], yr:[-5,5], desc:'Four equal global minima at (3,2),(−2.8,3.1),(−3.8,−3.3),(3.6,−1.8).' },
  'Booth':                { f:'(x+2*y-7)*(x+2*y-7)+(2*x+y-5)*(2*x+y-5)', xr:[-5,5], yr:[-5,5], desc:'Convex. Global min at (1,3).' },
  'Beale':                { f:'(1.5-x+x*y)*(1.5-x+x*y)+(2.25-x+x*y*y)*(2.25-x+x*y*y)+(2.625-x+x*y*y*y)*(2.625-x+x*y*y*y)', xr:[-4.5,4.5], yr:[-4.5,4.5], desc:'Multiple local minima. Global min at (3,0.5).' },
  'Double Banana':        { f:'(x*x+y*y-2)*(x*x+y*y-2)*0.5 + (x-1)*(x-1)*0.2', xr:[-2.5,2.5], yr:[-2.5,2.5], desc:'Circular valley with gentle symmetry breaking.' },
  'Custom':               { f:'x*x + y*y', xr:[-3,3], yr:[-3,3], desc:'Edit f(x,y) below.' },
};

function compileF(expr) {
  try { return new Function('x','y',MATH+`return (${expr});`); }
  catch(e){ return null; }
}

export class Optimization {
  constructor(W,H){
    this.canvasW=W; this.canvasH=H;
    this.vp=new Viewport(-3,3,-3,3);
    this.params={
      preset:'Rosenbrock Banana',
      fExpr:'(1-x)*(1-x)+100*(y-x*x)*(y-x*x)',
      method:'gradient-descent',  // gradient-descent | momentum | adam | newton
      lr:0.005, beta1:0.9, beta2:0.999,
      colormap:'plasma',
      showGradField:false,
      maxSteps:2000,
    };
    this.paramDefs=[
      { group:'Function f(x,y)', items:[
        { id:'preset',  label:'Preset', type:'select', options:Object.keys(FUNC_PRESETS) },
        { id:'_guide',  type:'hint', html:'Variables: <code>x</code>, <code>y</code>  |  Functions: <code>sin cos exp log sqrt abs pow pi e</code><br><b>Click on the canvas</b> to start descent from that point.' },
        { id:'fExpr',   label:'f(x,y) =', type:'code' },
      ]},
      { group:'Algorithm', items:[
        { id:'method', label:'Method', type:'select',
          options:['gradient-descent','momentum','adam','newton'],
          tip:'GD: xₙ₊₁=xₙ−lr·∇f. Momentum: adds velocity. Adam: adaptive learning rates. Newton: uses Hessian.' },
        { id:'lr',    label:'Learning rate', min:0.0001, max:0.1, step:0.0001, type:'range' },
        { id:'beta1', label:'β₁ (momentum)', min:0.5, max:0.999, step:0.01, type:'range', tip:'Momentum coefficient. Used by Momentum and Adam.' },
        { id:'showGradField', label:'Show gradient field', type:'toggle' },
        { id:'maxSteps', label:'Max steps', min:100, max:10000, step:100, type:'range' },
      ]},
      { group:'View', items:[
        { id:'colormap', label:'Color map', type:'colormap' },
        { id:'_zin',    label:'Zoom In',   type:'button' },
        { id:'_zout',   label:'Zoom Out',  type:'button' },
        { id:'_reset',  label:'Clear paths',type:'button' },
      ]},
    ];
    this.presets=Object.keys(FUNC_PRESETS).map(k=>({id:k,name:k,params:{preset:k}}));
    this.domain='Optimization & Calculus';
    this.description='Visualize gradient descent and variants on 2D loss landscapes. Click anywhere to start descent from that point. Compare how GD, Momentum, and Adam behave on different surfaces.';
    this.stepsPerFrame=0;
    this._fn=null; this._paths=[]; this._bgDirty=true; this._bgCache=null;
    this._compileF();
  }

  _compileF(){
    this._fn=compileF(this.params.fExpr);
    this._bgDirty=true;
  }

  _evalF(x,y){ if(!this._fn)return 0; try{const v=this._fn(x,y);return isFinite(v)?v:1e10;}catch(e){return 1e10;} }

  _grad(x,y,h=1e-5){
    return[(this._evalF(x+h,y)-this._evalF(x-h,y))/(2*h),
           (this._evalF(x,y+h)-this._evalF(x,y-h))/(2*h)];
  }
  _hessian(x,y,h=1e-4){
    const fxx=(this._evalF(x+h,y)-2*this._evalF(x,y)+this._evalF(x-h,y))/(h*h);
    const fyy=(this._evalF(x,y+h)-2*this._evalF(x,y)+this._evalF(x,y-h))/(h*h);
    const fxy=(this._evalF(x+h,y+h)-this._evalF(x+h,y-h)-this._evalF(x-h,y+h)+this._evalF(x-h,y-h))/(4*h*h);
    return{fxx,fyy,fxy};
  }

  _runDescent(x0,y0){
    const{method,lr,beta1,maxSteps}=this.params;
    const pts=[{x:x0,y:y0,f:this._evalF(x0,y0)}];
    let x=x0,y=y0,vx=0,vy=0,mx=0,my=0,vx2=0,vy2=0,step=0;
    for(let i=0;i<maxSteps;i++){
      const[gx,gy]=this._grad(x,y);
      const gnorm=Math.sqrt(gx*gx+gy*gy);
      if(gnorm<1e-8)break;
      let dx,dy;
      if(method==='gradient-descent'){ dx=-lr*gx; dy=-lr*gy; }
      else if(method==='momentum'){ vx=beta1*vx+lr*gx; vy=beta1*vy+lr*gy; dx=-vx; dy=-vy; }
      else if(method==='adam'){
        step++;
        const beta2=this.params.beta2||0.999, eps=1e-8;
        mx=beta1*mx+(1-beta1)*gx; my=beta1*my+(1-beta1)*gy;
        vx2=beta2*vx2+(1-beta2)*gx*gx; vy2=beta2*vy2+(1-beta2)*gy*gy;
        const mxH=mx/(1-Math.pow(beta1,step)), myH=my/(1-Math.pow(beta1,step));
        const vxH=vx2/(1-Math.pow(beta2,step)), vyH=vy2/(1-Math.pow(beta2,step));
        dx=-lr*mxH/(Math.sqrt(vxH)+eps); dy=-lr*myH/(Math.sqrt(vyH)+eps);
      } else if(method==='newton'){
        const{fxx,fyy,fxy}=this._hessian(x,y);
        const det=fxx*fyy-fxy*fxy||1e-14;
        dx=-(fyy*gx-fxy*gy)/det*lr; dy=-(-fxy*gx+fxx*gy)/det*lr;
      } else { dx=-lr*gx; dy=-lr*gy; }
      x+=dx; y+=dy;
      const fv=this._evalF(x,y);
      pts.push({x,y,f:fv});
      if(!isFinite(x)||!isFinite(y)||!isFinite(fv))break;
      if(Math.abs(dx)<1e-10&&Math.abs(dy)<1e-10)break;
    }
    return pts;
  }

  getFormula(){
    const m={
      'gradient-descent':'xₙ₊₁ = xₙ − η·∇f(xₙ)',
      'momentum':         'vₙ₊₁ = βvₙ + η∇f  |  xₙ₊₁ = xₙ − vₙ₊₁',
      'adam':             'Adam: adaptive learning rate per coordinate',
      'newton':           "xₙ₊₁ = xₙ − H⁻¹·∇f  (Newton's method)",
    };
    return (m[this.params.method]||'') + `   f(x,y)=${this.params.fExpr.slice(0,40)}`;
  }

  reset(){ this._paths=[]; }
  update(){}
  onParamChange(id){
    if(id==='preset'||id==='_preset'){
      const p=FUNC_PRESETS[this.params.preset];
      if(p){ this.params.fExpr=p.f; this.vp=new Viewport(p.xr[0],p.xr[1],p.yr[0],p.yr[1]); this.description=p.desc; }
    }
    if(id==='fExpr'||id==='preset'||id==='_preset') this._compileF();
    if(id==='_zin')   this.vp.zoom(0.6,this.canvasW/2,this.canvasH/2,this.canvasW,this.canvasH);
    if(id==='_zout')  this.vp.zoom(1.7,this.canvasW/2,this.canvasH/2,this.canvasW,this.canvasH);
    if(id==='_reset') this._paths=[];
    this._bgDirty=true;
  }
  onMouseDrag(ddx,ddy,cx,cy,W,H){ this.vp.pan(ddx,ddy,W,H); this._bgDirty=true; }
  onWheel(cx,cy,delta,W,H){ this.vp.zoom(delta>0?1.25:0.8,cx,cy,W,H); this._bgDirty=true; }
  onClick(cx,cy,W,H){
    const[wx,wy]=this.vp.toWorld(cx,cy,W,H);
    const pts=this._runDescent(wx,wy);
    const cols=['#c42020','#1a4fa8','#1a6b1a','#a05000','#6020a0','#1a7a7a','#884400'];
    this._paths.push({pts,color:cols[this._paths.length%cols.length],method:this.params.method});
  }

  _renderBg(ctx,W,H){
    if(!this._bgDirty&&this._bgCache){
      ctx.putImageData(this._bgCache,0,0);
      return;
    }
    const vp=this.vp,cm=this.params.colormap;
    const rW=Math.floor(W*0.6),rH=Math.floor(H*0.6);
    // Sample f on grid
    const vals=new Float32Array(rW*rH);
    let mn=Infinity,mx2=-Infinity;
    for(let py=0;py<rH;py++){
      for(let px=0;px<rW;px++){
        const[x,y]=vp.toWorld(px*W/rW,py*H/rH,W,H);
        const v=this._evalF(x,y);
        vals[py*rW+px]=v;
        if(isFinite(v)){if(v<mn)mn=v;if(v>mx2)mx2=v;}
      }
    }
    const range=Math.max(mx2-mn,1e-10);
    const imgd=ctx.createImageData(rW,rH);
    const data=imgd.data;
    for(let i=0;i<rW*rH;i++){
      const v=vals[i]; const t=isFinite(v)?Math.pow((v-mn)/range,0.4):1;
      const[r,g,b]=sampleCM(cm,t);
      const p=i*4; data[p]=r;data[p+1]=g;data[p+2]=b;data[p+3]=255;
    }
    // Scale up
    const tmp=document.createElement('canvas');tmp.width=rW;tmp.height=rH;
    tmp.getContext('2d').putImageData(imgd,0,0);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(tmp,0,0,W,H);
    this._bgCache=ctx.getImageData(0,0,W,H);
    this._bgDirty=false;
  }

  render(ctx,canvas){
    const W=canvas.width,H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    this._renderBg(ctx,W,H);

    // Gradient field
    if(this.params.showGradField){
      const steps=22,cw=W/steps;
      for(let i=0;i<steps;i++)for(let j=0;j<steps;j++){
        const cx2=i*cw+cw/2,cy2=j*cw+cw/2;
        const[wx,wy]=this.vp.toWorld(cx2,cy2,W,H);
        const[gx,gy]=this._grad(wx,wy);
        const gm=Math.sqrt(gx*gx+gy*gy)||1;
        const len=Math.min(1,Math.log1p(gm)/4)*cw*0.38;
        const ax=gx/gm*len,ay=-gy/gm*len;
        ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=0.8;
        ctx.beginPath();ctx.moveTo(cx2,cy2);ctx.lineTo(cx2+ax,cy2+ay);ctx.stroke();
      }
    }

    // Descent paths
    for(const path of this._paths){
      const pts=path.pts; if(pts.length<2)continue;
      ctx.strokeStyle=path.color;ctx.lineWidth=2;ctx.lineJoin='round';
      ctx.beginPath();
      for(let i=0;i<pts.length;i++){
        const[cx2,cy2]=this.vp.toCanvas(pts[i].x,pts[i].y,W,H);
        i===0?ctx.moveTo(cx2,cy2):ctx.lineTo(cx2,cy2);
      }
      ctx.stroke();
      // Start
      const[sx,sy]=this.vp.toCanvas(pts[0].x,pts[0].y,W,H);
      ctx.fillStyle=path.color;ctx.beginPath();ctx.arc(sx,sy,6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx,sy,3,0,Math.PI*2);ctx.fill();
      // End
      const last=pts[pts.length-1];
      const[ex,ey]=this.vp.toCanvas(last.x,last.y,W,H);
      dot(ctx,ex,ey,5,path.color,`f=${last.f.toFixed(4)}`);
      // Step count
      if(pts.length>1) label(ctx,`${path.method}: ${pts.length-1} steps`,sx+8,sy-16,{color:path.color,size:10,bg:'rgba(255,255,255,0.7)'});
    }

    label(ctx,this.params.preset,8,8,{color:'rgba(255,255,255,0.95)',size:12,bg:'rgba(0,0,0,0.45)'});
    label(ctx,'Click to start descent  |  Drag=pan  Scroll=zoom',8,H-18,{color:'rgba(255,255,255,0.7)',size:10});
  }

  coordInfo(cx,cy,W,H){
    const[x,y]=this.vp.toWorld(cx,cy,W,H);
    const fv=this._evalF(x,y);
    const[gx,gy]=this._grad(x,y);
    return`(${x.toFixed(3)},${y.toFixed(3)})  f=${fv.toFixed(4)}  |∇f|=${Math.sqrt(gx*gx+gy*gy).toFixed(4)}`;
  }
}
