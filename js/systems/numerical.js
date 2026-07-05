
import { Viewport, drawAxes, clearCanvas, label, dot } from '../plot.js';

const MATH=`"use strict";const {sin,cos,tan,exp,log,sqrt,abs,pow,atan,atan2,sinh,cosh,sign,floor,ceil,min,max,PI,E}=Math;const pi=PI,e=E;`;

function compile1D(expr){ try{return new Function('x',MATH+`return (${expr});`);}catch(e){return null;} }

const FPRESETS={
  'x³ − x − 2':     {f:'x*x*x - x - 2',          df:'3*x*x - 1',          x0:2,   xr:[-2,3]},
  'cos(x) − x':     {f:'cos(x) - x',               df:'-sin(x) - 1',        x0:0.5, xr:[-1,3]},
  'x² − 2 (√2)':   {f:'x*x - 2',                  df:'2*x',                x0:2,   xr:[-0.5,3]},
  'eˣ − 3':         {f:'exp(x) - 3',               df:'exp(x)',             x0:1,   xr:[-1,3]},
  'x·sin(x) − 1':  {f:'x*sin(x) - 1',             df:'sin(x)+x*cos(x)',   x0:1,   xr:[-2,4]},
  'x³ − 5x (roots)':{f:'x*x*x - 5*x',             df:'3*x*x - 5',         x0:3,   xr:[-3,3]},
  'Wilkinson p(x)':{f:'(x-1)*(x-2)*(x-3)*(x-4)', df:'(x-2)*(x-3)*(x-4)+(x-1)*(x-3)*(x-4)+(x-1)*(x-2)*(x-4)+(x-1)*(x-2)*(x-3)', x0:4.5, xr:[-0.5,5]},
  'Custom':         {f:'x*x*x - x - 2',            df:'3*x*x - 1',          x0:2,   xr:[-2,3]},
};

export class NumericalMethods {
  constructor(W,H){
    this.canvasW=W; this.canvasH=H;
    this.vp=new Viewport(-2,3,-4,6);
    this.params={
      view:'newton',   // newton | bisection | secant | fixedpoint | euler-rk4
      preset:'x³ − x − 2',
      fExpr:'x*x*x - x - 2', dfExpr:'3*x*x - 1',
      x0:2, a:-1, b:3,  // bisection interval
      tol:1e-8, maxIter:20,
      gExpr:'x - 0.3*(x*x*x - x - 2)',  // fixed-point g(x)
      // ODE for Euler/RK4 view
      odeF:'cos(x) - y', odeY0:0, odeX0:0, odeX1:5, odeSteps:20,
    };
    this.paramDefs=[
      { group:'Method', items:[
        { id:'view', label:'Algorithm', type:'select',
          options:['newton','bisection','secant','fixedpoint','euler-rk4'],
          tip:'Newton: quadratic convergence. Bisection: linear, always works. Secant: superlinear. Fixed-point: linear if |g\'(x*)|<1.' },
      ]},
      { group:'Root-finding  f(x) = 0', items:[
        { id:'preset', label:'Preset function', type:'select', options:Object.keys(FPRESETS) },
        { id:'_guide', type:'hint', html:'<b>Custom expressions:</b> variable <code>x</code>, functions <code>sin cos exp log sqrt abs pow pi e</code><br>Newton needs f and f\'. Bisection needs interval [a,b] with sign change.' },
        { id:'fExpr',  label:'f(x) =',  type:'code' },
        { id:'dfExpr', label:"f'(x) =", type:'code', tip:"Used by Newton's method. Leave blank to use numerical diff." },
        { id:'x0',     label:'x₀ (starting point)', min:-10, max:10, step:0.1, type:'range' },
        { id:'a',      label:'a (bisection left)',  min:-10, max:0,  step:0.1, type:'range' },
        { id:'b',      label:'b (bisection right)', min:0,   max:10, step:0.1, type:'range' },
        { id:'maxIter',label:'Max iterations', min:3, max:50, step:1, type:'range' },
      ]},
      { group:'Fixed-point  xₙ₊₁ = g(xₙ)', items:[
        { id:'gExpr',  label:'g(x) =', type:'code', tip:'Must satisfy |g\'(x*)| < 1 near root for convergence.' },
      ]},
      { group:'Euler vs RK4  dy/dx = f(x,y)', items:[
        { id:'_guide2', type:'hint', html:'Compares Euler (O(h)) and RK4 (O(h⁴)) ODE solvers on the same problem.' },
        { id:'odeF',    label:"f(x,y) =", type:'code' },
        { id:'odeY0',   label:'y(x₀)',    min:-5, max:5, step:0.1, type:'range' },
        { id:'odeX0',   label:'x₀',       min:-5, max:5, step:0.1, type:'range' },
        { id:'odeX1',   label:'x₁',       min:0,  max:20,step:0.5, type:'range' },
        { id:'odeSteps',label:'Steps (n)', min:4, max:100,step:2,  type:'range', tip:'More steps = smaller h = more accurate' },
      ]},
    ];
    this.presets=[
      {id:'nw1',name:'Newton: x³−x−2',      params:{view:'newton',   preset:'x³ − x − 2'}},
      {id:'bi1',name:'Bisection: cos(x)−x', params:{view:'bisection',preset:'cos(x) − x', a:0, b:2}},
      {id:'se1',name:'Secant: x³−x−2',      params:{view:'secant',   preset:'x³ − x − 2'}},
      {id:'fp1',name:'Fixed-point iteration',params:{view:'fixedpoint',preset:'x³ − x − 2', gExpr:'x-0.3*(x*x*x-x-2)'}},
      {id:'ode',name:'Euler vs RK4',         params:{view:'euler-rk4',odeF:'cos(x)-y',odeY0:0,odeX0:0,odeX1:5,odeSteps:12}},
    ];
    this.domain='Numerical Analysis';
    this.description='Root-finding algorithms and ODE integrators. Compare convergence rates. Try different starting points to see how initial conditions affect convergence.';
    this._dirty=true;
    this.stepsPerFrame=0;
  }

  getFormula(){
    const m={newton:"Newton-Raphson: xₙ₊₁ = xₙ − f(xₙ)/f'(xₙ)  [quadratic convergence]",
      bisection:'Bisection: halve [a,b] at each step  [linear, O(1/2ⁿ)]',
      secant:'Secant: xₙ₊₁ = xₙ − f(xₙ)·(xₙ−xₙ₋₁)/(f(xₙ)−f(xₙ₋₁))  [superlinear]',
      fixedpoint:'Fixed-point: xₙ₊₁ = g(xₙ)  [converges if |g\'(x*)|<1]',
      'euler-rk4':'Euler: yₙ₊₁=yₙ+hf  vs  RK4: 4th-order Runge-Kutta'};
    return m[this.params.view]||'';
  }

  reset(){ this._dirty=true; }
  update(){}
  onParamChange(id){
    if(id==='preset'||id==='_preset'){
      const p=FPRESETS[this.params.preset];
      if(p){this.params.fExpr=p.f;this.params.dfExpr=p.df;this.params.x0=p.x0;
        this.vp=new Viewport(p.xr[0]-0.3,p.xr[1]+0.3,-4,8);}
    }
    this._dirty=true;
  }
  onMouseDrag(ddx,ddy,cx,cy,W,H){ this.vp.pan(ddx,ddy,W,H); this._dirty=true; }
  onWheel(cx,cy,delta,W,H){ this.vp.zoom(delta>0?1.3:0.77,cx,cy,W,H); this._dirty=true; }

  render(ctx,canvas){
    if(!this._dirty)return; this._dirty=false;
    const W=canvas.width,H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    const v=this.params.view;
    if(v==='euler-rk4') this._renderODE(ctx,W,H);
    else this._renderRoot(ctx,W,H,v);
  }

  _evalF(x){
    const f=compile1D(this.params.fExpr);
    if(!f)return NaN;
    try{const r=f(x);return isFinite(r)?r:NaN;}catch(e){return NaN;}
  }
  _evalDF(x){
    const df=compile1D(this.params.dfExpr);
    if(df){try{const r=df(x);if(isFinite(r))return r;}catch(e){}}
    // Numerical diff
    const h=1e-7,fv=this._evalF(x);
    return(this._evalF(x+h)-fv)/h;
  }
  _evalG(x){
    const g=compile1D(this.params.gExpr);
    if(!g)return x;
    try{const r=g(x);return isFinite(r)?r:x;}catch(e){return x;}
  }

  _iterateNewton(){
    const pts=[this.params.x0]; let x=this.params.x0;
    for(let i=0;i<this.params.maxIter;i++){
      const fv=this._evalF(x),dv=this._evalDF(x);
      if(!isFinite(fv)||Math.abs(dv)<1e-14)break;
      const xn=x-fv/dv; pts.push(xn);
      if(Math.abs(xn-x)<this.params.tol)break;
      x=xn;
    }
    return pts;
  }

  _iterateBisection(){
    let a=this.params.a,b=this.params.b;
    const pts=[a,b];
    if(this._evalF(a)*this._evalF(b)>0)return pts;
    for(let i=0;i<this.params.maxIter;i++){
      const m=(a+b)/2; pts.push(m);
      const fm=this._evalF(m);
      if(Math.abs(fm)<this.params.tol||Math.abs(b-a)/2<this.params.tol)break;
      if(this._evalF(a)*fm<0)b=m; else a=m;
    }
    return pts;
  }

  _iterateSecant(){
    let x0=this.params.x0,x1=x0+0.5;
    const pts=[x0,x1];
    for(let i=0;i<this.params.maxIter;i++){
      const f0=this._evalF(x0),f1=this._evalF(x1);
      if(Math.abs(f1-f0)<1e-14)break;
      const xn=x1-f1*(x1-x0)/(f1-f0); pts.push(xn);
      if(Math.abs(xn-x1)<this.params.tol)break;
      x0=x1; x1=xn;
    }
    return pts;
  }

  _iterateFixedPoint(){
    let x=this.params.x0; const pts=[x];
    for(let i=0;i<this.params.maxIter;i++){
      const xn=this._evalG(x); pts.push(xn);
      if(Math.abs(xn-x)<this.params.tol)break;
      x=xn;
    }
    return pts;
  }

  _renderRoot(ctx,W,H,method){
    drawAxes(ctx,this.vp,W,H);

    // Plot f(x)
    ctx.strokeStyle='#1a4fa8'; ctx.lineWidth=2;
    ctx.beginPath(); let started=false;
    for(let i=0;i<=400;i++){
      const x=this.vp.xMin+(i/400)*this.vp.width();
      const y=this._evalF(x);
      const[cx,cy]=this.vp.toCanvas(x,y,W,H);
      if(!isFinite(y)||Math.abs(y)>this.vp.height()*3){started=false;continue;}
      if(!started){ctx.moveTo(cx,cy);started=true;}else ctx.lineTo(cx,cy);
    }
    ctx.stroke();

    // Fixed-point: also plot g(x) and y=x
    if(method==='fixedpoint'){
      ctx.strokeStyle='#1a6b1a'; ctx.lineWidth=1.5;
      ctx.beginPath(); started=false;
      for(let i=0;i<=300;i++){
        const x=this.vp.xMin+(i/300)*this.vp.width();
        const y=this._evalG(x);
        const[cx,cy]=this.vp.toCanvas(x,y,W,H);
        if(!isFinite(y)||Math.abs(y)>this.vp.height()*3){started=false;continue;}
        if(!started){ctx.moveTo(cx,cy);started=true;}else ctx.lineTo(cx,cy);
      }
      ctx.stroke();
      // y=x diagonal
      ctx.strokeStyle='#aaa'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      const[c1x,c1y]=this.vp.toCanvas(this.vp.xMin,this.vp.xMin,W,H);
      const[c2x,c2y]=this.vp.toCanvas(this.vp.xMax,this.vp.xMax,W,H);
      ctx.beginPath();ctx.moveTo(c1x,c1y);ctx.lineTo(c2x,c2y);ctx.stroke();
      ctx.setLineDash([]);
    }

    // Iterations
    let pts;
    if(method==='newton')     pts=this._iterateNewton();
    else if(method==='bisect') pts=this._iterateBisection();
    else if(method==='bisection') pts=this._iterateBisection();
    else if(method==='secant')    pts=this._iterateSecant();
    else if(method==='fixedpoint'){
      // Cobweb diagram
      pts=this._iterateFixedPoint();
      ctx.strokeStyle='#c42020'; ctx.lineWidth=1.5;
      ctx.beginPath();
      const[sx,sy]=this.vp.toCanvas(pts[0],0,W,H); ctx.moveTo(sx,sy);
      for(let i=0;i<pts.length-1;i++){
        const gx=this._evalG(pts[i]);
        const[ax,ay]=this.vp.toCanvas(pts[i],gx,W,H);
        const[bx,by]=this.vp.toCanvas(gx,gx,W,H);
        ctx.lineTo(ax,ay); ctx.lineTo(bx,by);
      }
      ctx.stroke();
    }

    if(!pts)return;

    // Newton: tangent lines
    if(method==='newton'){
      for(let i=0;i<Math.min(pts.length-1,8);i++){
        const x=pts[i],fx=this._evalF(x),dfx=this._evalDF(x);
        if(!isFinite(fx)||!isFinite(dfx))continue;
        const t=0.8, x1=x-t,x2=x+t;
        const y1=fx+dfx*(x1-x),y2=fx+dfx*(x2-x);
        const[c1x,c1y]=this.vp.toCanvas(x1,y1,W,H);
        const[c2x,c2y]=this.vp.toCanvas(x2,y2,W,H);
        const hue=i/10;
        ctx.strokeStyle=`hsla(${hue*300+20},70%,45%,0.7)`;ctx.lineWidth=1;
        ctx.setLineDash([3,3]);
        ctx.beginPath();ctx.moveTo(c1x,c1y);ctx.lineTo(c2x,c2y);ctx.stroke();
        ctx.setLineDash([]);
        // vertical drop
        const[vx1,vy1]=this.vp.toCanvas(pts[i+1],0,W,H);
        const[vx2,vy2]=this.vp.toCanvas(pts[i+1],this._evalF(pts[i+1]),W,H);
        ctx.strokeStyle=`hsla(${hue*300+20},70%,45%,0.4)`;ctx.lineWidth=0.8;
        ctx.beginPath();ctx.moveTo(vx1,vy1);ctx.lineTo(vx2,vy2);ctx.stroke();
      }
    }

    // Plot iteration points
    const iters=Math.min(pts.length,this.params.maxIter+1);
    for(let i=0;i<iters;i++){
      const x=pts[i], fx=method==='fixedpoint'?0:this._evalF(x);
      const[cx,cy]=this.vp.toCanvas(x,fx||0,W,H);
      const t=i/iters;
      dot(ctx,cx,cy,4,`hsl(${t*200+10},80%,45%)`,i===0?'x₀':i===iters-1?`x${iters-1}`:'');
    }

    // Info panel
    const root=pts[pts.length-1];
    const err=Math.abs(this._evalF(root));
    label(ctx,`${this.params.preset}`,8,8,{color:'#333',size:12,bg:'rgba(255,255,255,0.9)'});
    label(ctx,`Root ≈ ${root.toFixed(8)}  |f(root)|=${err.toExponential(2)}`,8,26,{color:'#555',size:11,bg:'rgba(255,255,255,0.88)'});
    label(ctx,`${iters-1} iterations`,8,44,{color:'#888',size:10,bg:'rgba(255,255,255,0.85)'});

    // Convergence log plot (small, bottom-right)
    const bw=180,bh=80,bx=W-bw-8,by=H-bh-30;
    ctx.save();
    ctx.fillStyle='rgba(248,246,240,0.93)';ctx.strokeStyle='#ccc';ctx.lineWidth=1;
    ctx.fillRect(bx,by,bw,bh+16);ctx.strokeRect(bx,by,bw,bh+16);
    const errs=pts.slice(1).map(x=>Math.abs(this._evalF(x))).filter(e=>e>0);
    if(errs.length>1){
      const logMin=Math.log10(Math.min(...errs)||1e-16),logMax=Math.log10(Math.max(...errs)||1);
      const range=logMax-logMin||1;
      ctx.strokeStyle='#c42020';ctx.lineWidth=1.5;
      ctx.beginPath();
      errs.forEach((err2,i)=>{
        const ex=bx+i/(errs.length-1)*bw;
        const ey=by+bh-(Math.log10(err2||1e-16)-logMin)/range*bh;
        i===0?ctx.moveTo(ex,ey):ctx.lineTo(ex,ey);
      });
      ctx.stroke();
    }
    label(ctx,'Convergence (log|f|)',bx+3,by+bh+2,{color:'#888',size:9});
    ctx.restore();
  }

  _renderODE(ctx,W,H){
    const{odeF,odeY0,odeX0,odeX1,odeSteps}=this.params;
    const fn=compile1D ? null : null;
    let ffn; try{ffn=new Function('x','y',MATH+`return (${odeF});`);}catch(e){ffn=null;}

    const h=(odeX1-odeX0)/odeSteps;
    // Euler
    const eulerPts=[{x:odeX0,y:odeY0}];
    let ex=odeX0,ey=odeY0;
    for(let i=0;i<odeSteps;i++){
      const dy=ffn?ffn(ex,ey):0;
      ex+=h; ey+=h*dy; eulerPts.push({x:ex,y:ey});
    }
    // RK4
    const rk4Pts=[{x:odeX0,y:odeY0}];
    let rx=odeX0,ry=odeY0;
    for(let i=0;i<odeSteps;i++){
      const f=ffn?ffn.bind(null):((x,y)=>0);
      const k1=ffn?ffn(rx,ry):0;
      const k2=ffn?ffn(rx+h/2,ry+h/2*k1):0;
      const k3=ffn?ffn(rx+h/2,ry+h/2*k2):0;
      const k4=ffn?ffn(rx+h,ry+h*k3):0;
      rx+=h; ry+=h*(k1+2*k2+2*k3+k4)/6;
      rk4Pts.push({x:rx,y:ry});
    }
    // Dense RK4 (reference)
    const refPts=[{x:odeX0,y:odeY0}]; let refX=odeX0,refY=odeY0;
    const nh=odeSteps*10, rh=(odeX1-odeX0)/nh;
    for(let i=0;i<nh;i++){
      const k1=ffn?ffn(refX,refY):0,k2=ffn?ffn(refX+rh/2,refY+rh/2*k1):0,k3=ffn?ffn(refX+rh/2,refY+rh/2*k2):0,k4=ffn?ffn(refX+rh,refY+rh*k3):0;
      refX+=rh; refY+=rh*(k1+2*k2+2*k3+k4)/6; refPts.push({x:refX,y:refY});
    }

    const allY=[...eulerPts,...rk4Pts,...refPts].map(p=>p.y).filter(isFinite);
    const yMin=Math.min(...allY)-0.5, yMax=Math.max(...allY)+0.5;
    this.vp=new Viewport(odeX0-0.2,odeX1+0.2,yMin,yMax);
    drawAxes(ctx,this.vp,W,H);

    const draw=(pts,col,lw)=>{
      ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.lineJoin='round';
      ctx.beginPath();
      pts.forEach((p,i)=>{const[cx,cy]=this.vp.toCanvas(p.x,p.y,W,H);i===0?ctx.moveTo(cx,cy):ctx.lineTo(cx,cy);});
      ctx.stroke();
    };
    draw(refPts,'rgba(0,0,0,0.2)',1);
    draw(eulerPts,'#c42020',2);
    draw(rk4Pts,'#1a4fa8',2);
    eulerPts.forEach(p=>{const[cx,cy]=this.vp.toCanvas(p.x,p.y,W,H);ctx.fillStyle='rgba(180,20,20,0.7)';ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.fill();});
    rk4Pts.forEach(p=>{const[cx,cy]=this.vp.toCanvas(p.x,p.y,W,H);ctx.fillStyle='rgba(26,79,168,0.7)';ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.fill();});

    label(ctx,`dy/dx = ${odeF}  |  y(${odeX0})=${odeY0}  |  n=${odeSteps} steps`,8,8,{color:'#333',size:11,bg:'rgba(255,255,255,0.9)'});
    label(ctx,'Red: Euler O(h)   Blue: RK4 O(h⁴)   Gray: reference (dense RK4)',8,H-18,{color:'#555',size:10});
  }

  coordInfo(cx,cy,W,H){
    const[x,y]=this.vp.toWorld(cx,cy,W,H);
    const fx=this._evalF(x);
    return`x=${x.toFixed(4)}  f(x)=${isFinite(fx)?fx.toFixed(4):'—'}`;
  }
}
