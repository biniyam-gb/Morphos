
import { Viewport, drawAxes, clearCanvas, rk4, label, dot } from '../plot.js';

const MATH = `"use strict";const {sin,cos,tan,exp,log,sqrt,abs,pow,atan,atan2,sinh,cosh,tanh,sign,floor,ceil,min,max,PI,E}=Math;const pi=PI,e=E;`;

function compileODE(expr) {
  try { return new Function('x','y','t', MATH+`return (${expr});`); }
  catch(e){ return null; }
}

const PRESETS = {
  'Harmonic Oscillator':   { dx:'y',                    dy:'-x',                          xr:[-4,4],yr:[-4,4],  desc:'ẋ=y, ẏ=−x. Circles = conserved E=(x²+y²)/2. Eigenvalues ±i (center).' },
  'Nonlinear Pendulum':    { dx:'y',                    dy:'-sin(x)',                      xr:[-7,7],yr:[-4,4],  desc:'ẋ=y, ẏ=−sin(x). Libration vs rotation separated by separatrix.' },
  'Damped Pendulum':       { dx:'y',                    dy:'-sin(x)-0.3*y',               xr:[-7,7],yr:[-4,4],  desc:'Damping γ=0.3. Stable spirals at (2kπ,0), saddles at ((2k+1)π,0).' },
  'Van der Pol (μ=1)':     { dx:'y',                    dy:'(1-x*x)*y-x',                 xr:[-4,4],yr:[-4,4],  desc:'Limit cycle oscillator. ẍ−μ(1−x²)ẋ+x=0. Self-sustained at amplitude ≈2.' },
  'Van der Pol (μ=3)':     { dx:'y',                    dy:'3*(1-x*x)*y-x',               xr:[-4,4],yr:[-6,6],  desc:'Stiff limit cycle (μ=3). Near-discontinuous relaxation oscillations.' },
  'Lotka-Volterra':        { dx:'x*(1.5-0.5*y)',        dy:'y*(-1+0.5*x)',                xr:[-0.5,8],yr:[-0.5,8],desc:'Predator-prey: ẋ=x(α−βy), ẏ=y(δx−γ). Closed orbits.' },
  'SIR Epidemic':          { dx:'-0.3*x*y',             dy:'0.3*x*y-0.1*y',              xr:[-0.1,1.1],yr:[-0.1,1.1],desc:'S\'=−βSI, I\'=βSI−γI. R₀=3. Epidemic curve on [0,1]².' },
  'Duffing (double-well)': { dx:'y',                    dy:'x-x*x*x-0.1*y',              xr:[-2,2],yr:[-2,2],  desc:'Double-well: V=−x²/2+x⁴/4. Two stable spirals ±(1,0), unstable saddle at origin.' },
  'Hopf Bifurcation':      { dx:'0.5*x-y-x*(x*x+y*y)', dy:'x+0.5*y-y*(x*x+y*y)',       xr:[-2,2],yr:[-2,2],  desc:'Stable limit cycle radius √μ (μ=0.5). Unstable spiral inside.' },
  'Saddle Point':          { dx:'x',                    dy:'-y',                          xr:[-3,3],yr:[-3,3],  desc:'Eigenvalues ±1. Stable manifold: y-axis. Unstable: x-axis.' },
  'Spiral Sink':           { dx:'-0.3*x-y',             dy:'x-0.3*y',                    xr:[-3,3],yr:[-3,3],  desc:'Eigenvalues −0.3±i. Asymptotically stable spiral.' },
  'Glycolysis (Sel\'kov)': { dx:'-x+0.08*y+x*x*y',    dy:'0.6-0.08*y-x*x*y',          xr:[-0.2,3],yr:[-0.2,5],desc:'Sel\'kov model of glycolytic oscillations. Limit cycle in positive quadrant.' },
  'FitzHugh-Nagumo':       { dx:'x-x*x*x/3-y+0.5',    dy:'0.08*(x+0.7-0.8*y)',         xr:[-3,3],yr:[-2,2],  desc:'Simplified neuron model. Excitable medium: threshold → spike → recovery.' },
  'Competitive Exclusion': { dx:'x*(1-x-0.5*y)',       dy:'y*(0.75-y-0.5*x)',           xr:[-0.2,1.4],yr:[-0.2,1.4],desc:'Two competing species. Winner-takes-all. Coexistence equilibrium is unstable saddle.' },
  'Custom':                { dx:'y',                    dy:'-sin(x)',                     xr:[-5,5],yr:[-4,4],  desc:'Edit the expressions below. All Math functions available.' },
};

const COLORS = ['#c42020','#1a4fa8','#1a6b1a','#a05000','#6020a0','#1a7a7a','#884400','#004488','#880044','#008844'];

export class PhasePortrait {
  constructor(W,H){
    this.canvasW=W; this.canvasH=H;
    this.vp=new Viewport(-4,4,-4,4);
    this.trajectories=[]; this.t=0; this._fn=null; this._compileErr=null;
    this.params={
      preset:'Harmonic Oscillator',
      dxExpr:'y', dyExpr:'-x',
      dt:0.025, speed:3, maxLen:700,
      showField:true, showNullclines:true, showEnergyLabels:false,
    };
    this.paramDefs=[
      { group:'System', items:[
        { id:'preset', label:'Preset', type:'select', options:Object.keys(PRESETS),
          tip:'Select a system, or choose "Custom" to write your own expressions below.' },
      ]},
      { group:'Custom Equations (always editable)', items:[
        { id:'_guide', type:'hint', html:'Variables: <code>x</code>, <code>y</code>, <code>t</code><br>Functions: <code>sin cos tan exp log sqrt abs pow atan2 sinh tanh sign pi e</code><br>Example — Van der Pol: <code>dx=y</code>, <code>dy=(1-x*x)*y-x</code>' },
        { id:'dxExpr', label:'dx/dt =', type:'code' },
        { id:'dyExpr', label:'dy/dt =', type:'code' },
      ]},
      { group:'Display', items:[
        { id:'showField',      label:'Vector field',   type:'toggle' },
        { id:'showNullclines', label:'Nullclines',     type:'toggle', tip:'Red: ẋ=0  Blue: ẏ=0' },
        { id:'dt',     label:'Time step',    min:0.002,max:0.08,step:0.002, type:'range' },
        { id:'speed',  label:'Steps/frame',  min:1,max:20,step:1, type:'range' },
        { id:'maxLen', label:'Trail length', min:100,max:2000,step:100, type:'range' },
      ]},
    ];
    this.presets=Object.keys(PRESETS).map(k=>({id:k,name:k,params:{preset:k}}));
    this.domain='Dynamical Systems';
    this._loadPreset('Harmonic Oscillator');
  }

  _loadPreset(name){
    const p=PRESETS[name]; if(!p)return;
    this.params.dxExpr=p.dx; this.params.dyExpr=p.dy;
    this.vp=new Viewport(p.xr[0],p.xr[1],p.yr[0],p.yr[1]);
    this.description=p.desc;
    this.trajectories=[]; this.t=0;
    this._compile();
  }

  _compile(){
    const fx=compileODE(this.params.dxExpr), fy=compileODE(this.params.dyExpr);
    if(fx&&fy){
      this._fn=(x,y)=>{
        try{return[fx(x,y,this.t),fy(x,y,this.t)];}catch(e){return[0,0];}
      };
      this._compileErr=null;
    } else { this._compileErr='Expression error'; }
  }

  getFormula(){ return `ẋ = ${this.params.dxExpr}   |   ẏ = ${this.params.dyExpr}`; }
  get stepsPerFrame(){ return Math.round(this.params.speed); }

  reset(){ this.trajectories=[]; this.t=0; }

  onParamChange(id){
    if(id==='preset'||id==='_preset') this._loadPreset(this.params.preset);
    else if(id==='dxExpr'||id==='dyExpr') { this._compile(); this.trajectories=[]; }
  }

  onClick(cx,cy,W,H){
    const [wx,wy]=this.vp.toWorld(cx,cy,W,H);
    this.trajectories.push({pts:[{x:wx,y:wy}],color:COLORS[this.trajectories.length%COLORS.length]});
  }
  onMouseDrag(ddx,ddy,cx,cy,W,H){ this.vp.pan(ddx,ddy,W,H); }
  onWheel(cx,cy,delta,W,H){ this.vp.zoom(delta>0?1.25:0.8,cx,cy,W,H); }

  update(){
    if(!this._fn)return;
    const{dt,maxLen}=this.params;
    for(const tr of this.trajectories){
      const last=tr.pts[tr.pts.length-1];
      try{
        const[nx,ny]=rk4(this._fn,last.x,last.y,dt);
        if(isFinite(nx)&&isFinite(ny)&&Math.abs(nx)<500&&Math.abs(ny)<500){
          tr.pts.push({x:nx,y:ny});
          if(tr.pts.length>maxLen)tr.pts.shift();
        }
      }catch(e){}
    }
    this.t+=this.params.dt;
  }

  render(ctx,canvas){
    const W=canvas.width,H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    drawAxes(ctx,this.vp,W,H);
    const fn=this._fn;

    if(this._compileErr){
      label(ctx,`Error: ${this._compileErr}`,W/2-100,H/2,{color:'#c42020',size:13});
      return;
    }
    if(!fn)return;

    // Nullclines
    if(this.params.showNullclines){
      const steps=90;
      for(let py=0;py<steps;py++){
        const y0=this.vp.yMin+(py/steps)*this.vp.height();
        for(let px=0;px<steps;px++){
          const x0=this.vp.xMin+(px/steps)*this.vp.width();
          const x1=this.vp.xMin+((px+1)/steps)*this.vp.width();
          const[dx0]=fn(x0,y0); const[dx1]=fn(x1,y0);
          const[,dy0]=fn(x0,y0); const[,dy1]=fn(x1,y0);
          const[c0,c1]=this.vp.toCanvas((x0+x1)/2,(y0+this.vp.yMin/steps+this.vp.height()/steps*0.5),W,H);
          if(dx0*dx1<=0){ctx.fillStyle='rgba(200,20,20,0.45)';ctx.fillRect(c0-1,c1-1,2,2);}
          if(dy0*dy1<=0){ctx.fillStyle='rgba(20,50,200,0.45)';ctx.fillRect(c0-1,c1-1,2,2);}
        }
      }
    }

    // Vector field
    if(this.params.showField){
      const steps=22,cw=W/steps,ch=H/steps;
      for(let i=0;i<=steps;i++){
        for(let j=0;j<=steps;j++){
          const cx=i*cw,cy=j*ch;
          const[wx,wy]=this.vp.toWorld(cx,cy,W,H);
          const[vx,vy]=fn(wx,wy);
          const mag=Math.sqrt(vx*vx+vy*vy)||1;
          const len=Math.min(1,Math.log1p(mag)/3)*cw*0.38;
          const ax=vx/mag*len,ay=-vy/mag*len;
          const hue=(Math.atan2(-ay,ax)/(Math.PI*2)+1)%1;
          ctx.strokeStyle=`hsla(${hue*360+200},55%,42%,0.65)`;
          ctx.fillStyle=`hsla(${hue*360+200},55%,42%,0.65)`;
          ctx.lineWidth=0.9;
          ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+ax,cy+ay);ctx.stroke();
          ctx.beginPath();ctx.arc(cx+ax,cy+ay,1.4,0,Math.PI*2);ctx.fill();
        }
      }
    }

    // Trajectories
    for(const tr of this.trajectories){
      if(tr.pts.length<2)continue;
      ctx.save();ctx.strokeStyle=tr.color;ctx.lineWidth=1.8;ctx.lineJoin='round';
      ctx.beginPath();
      const[cx0,cy0]=this.vp.toCanvas(tr.pts[0].x,tr.pts[0].y,W,H);
      ctx.moveTo(cx0,cy0);
      for(let i=1;i<tr.pts.length;i++){
        const[cx,cy]=this.vp.toCanvas(tr.pts[i].x,tr.pts[i].y,W,H);
        ctx.lineTo(cx,cy);
      }
      ctx.stroke();
      const last=tr.pts[tr.pts.length-1];
      const[lx,ly]=this.vp.toCanvas(last.x,last.y,W,H);
      dot(ctx,lx,ly,4,tr.color);
      ctx.restore();
    }

    if(this.params.showNullclines){
      label(ctx,'■ ẋ=0',W-60,H-30,{color:'rgba(200,20,20,0.9)',size:10});
      label(ctx,'■ ẏ=0',W-60,H-18,{color:'rgba(20,50,200,0.9)',size:10});
    }
    label(ctx,'Click to spawn trajectory  |  Drag=pan  Scroll=zoom',6,H-16,{color:'#aaa',size:10});
  }

  coordInfo(cx,cy,W,H){
    const[x,y]=this.vp.toWorld(cx,cy,W,H);
    if(!this._fn)return'';
    const[dx,dy]=this._fn(x,y);
    return `(${x.toFixed(3)},${y.toFixed(3)})  ẋ=${dx.toFixed(3)}  ẏ=${dy.toFixed(3)}`;
  }
}
