
import { clearCanvas, label, dot } from '../plot.js';

const MATH = `"use strict";
const {sin,cos,tan,exp,log,sqrt,abs,pow,atan,atan2,sinh,cosh,tanh,
       sign,floor,ceil,round,min,max,hypot,PI,E}=Math;
const pi=PI, e=E;`;

function randn() {
  let u=0,v=0;
  while(!u)u=Math.random(); while(!v)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}
function binomC(n,k){let r=1;for(let i=0;i<k;i++)r=r*(n-i)/(i+1);return r;}

// ── 2D Brownian Motion ────────────────────────────────────────────
class Walk2D {
  constructor(){ this.trails=[]; this.steps=0; }
  reset(W,H){
    const cols=['#c42020','#1a4fa8','#1a6b1a','#a05000','#6020a0','#1a7a7a'];
    this.trails=cols.map(c=>({pts:[{x:W/2,y:H/2}],col:c}));
    this.steps=0;
  }
  step(sigma,W,H){
    for(const t of this.trails){
      const l=t.pts[t.pts.length-1];
      const nx=l.x+randn()*sigma*7, ny=l.y+randn()*sigma*7;
      t.pts.push({x:nx,y:ny}); if(t.pts.length>800)t.pts.shift();
    }
    this.steps++;
  }
  render(ctx,W,H,sigma){
    clearCanvas(ctx,W,H,'#fff');
    for(const t of this.trails){
      if(t.pts.length<2)continue;
      ctx.strokeStyle=t.col+'bb';ctx.lineWidth=1.2;ctx.lineJoin='round';
      ctx.beginPath();ctx.moveTo(t.pts[0].x,t.pts[0].y);
      for(let i=1;i<t.pts.length;i++)ctx.lineTo(t.pts[i].x,t.pts[i].y);
      ctx.stroke();
      const l=t.pts[t.pts.length-1];
      ctx.fillStyle=t.col;ctx.beginPath();ctx.arc(l.x,l.y,4,0,Math.PI*2);ctx.fill();
    }
    const expR=sigma*7*Math.sqrt(this.steps);
    ctx.save();ctx.strokeStyle='rgba(0,0,0,0.1)';ctx.lineWidth=1;ctx.setLineDash([4,5]);
    ctx.beginPath();ctx.arc(W/2,H/2,Math.min(expR,W/2-8),0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);ctx.restore();
    label(ctx,`2D Brownian Motion — ${this.trails.length} walkers — n=${this.steps}`,8,8,{color:'#333',size:12,bg:'rgba(255,255,255,0.9)'});
    label(ctx,'Dashed ring = E[|B_n|] ~ σ√n  (diffusion)',8,H-18,{color:'#888',size:10});
  }
}

// ── 1D Random Walk ────────────────────────────────────────────────
class Walk1D {
  constructor(){ this.walkers=[]; this.step_=0; }
  reset(){
    const cols=['#c42020','#1a4fa8','#1a6b1a','#a05000','#6020a0','#1a7a7a','#884400','#004488'];
    this.walkers=cols.map(c=>({pos:0,history:[0],col:c}));
    this.step_=0;
  }
  step(){
    for(const w of this.walkers){
      w.pos+=Math.random()<0.5?1:-1;
      w.history.push(w.pos);
      if(w.history.length>500)w.history.shift();
    }
    this.step_++;
  }
  render(ctx,W,H){
    clearCanvas(ctx,W,H,'#fff');
    const pad=48,maxS=Math.min(this.step_+1,400);
    const tw=i=>pad+i/Math.max(1,maxS-1)*(W-2*pad), cy=H/2;
    const sc=(H-2*pad)/(2*Math.sqrt(maxS+1)*2.5);
    ctx.strokeStyle='#ddd';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad,cy);ctx.lineTo(W-pad,cy);ctx.stroke();
    ctx.save();ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.setLineDash([3,5]);
    for(const k of[1,2,-1,-2]){
      const yy=cy-k*Math.sqrt(maxS)*sc;
      ctx.beginPath();ctx.moveTo(pad,yy);ctx.lineTo(W-pad,yy);ctx.stroke();
      label(ctx,`${k>0?'+':''}${k}σ√n`,W-pad+4,yy-6,{color:'#ccc',size:9});
    }
    ctx.setLineDash([]);ctx.restore();
    for(const w of this.walkers){
      const hist=w.history.slice(-maxS);
      ctx.strokeStyle=w.col+'99';ctx.lineWidth=1;ctx.lineJoin='round';
      ctx.beginPath();ctx.moveTo(tw(0),cy-hist[0]*sc);
      for(let i=1;i<hist.length;i++)ctx.lineTo(tw(i),cy-hist[i]*sc);
      ctx.stroke();
    }
    label(ctx,`1D Random Walk — ${this.walkers.length} walkers — step ${this.step_}`,8,8,{color:'#333',size:12,bg:'rgba(255,255,255,0.9)'});
    label(ctx,'Bands = ±σ√n, ±2σ√n',8,H-18,{color:'#888',size:10});
  }
}

// ── Central Limit Theorem ─────────────────────────────────────────
class CLTDemo {
  constructor(){ this.samples=[]; }
  reset(){ this.samples=[]; }
  step(n){
    for(let i=0;i<80;i++){
      let s=0;for(let j=0;j<n;j++)s+=(Math.random()-0.5);
      this.samples.push(s/Math.sqrt(n/12));
      if(this.samples.length>6000)this.samples.shift();
    }
  }
  render(ctx,W,H,n){
    clearCanvas(ctx,W,H,'#fff');
    const bins=64,pad=48,bw=(W-2*pad)/bins,hist=new Float32Array(bins);
    for(const s of this.samples){const b=Math.floor((s+4)/8*bins);if(b>=0&&b<bins)hist[b]++;}
    const mx=Math.max(...hist)||1;
    ctx.fillStyle='rgba(26,79,168,0.65)';
    for(let i=0;i<bins;i++){const h=(hist[i]/mx)*(H-2*pad-20);ctx.fillRect(pad+i*bw,H-pad-h,bw-1,h);}
    ctx.strokeStyle='#c42020';ctx.lineWidth=2.5;
    ctx.beginPath();
    for(let i=0;i<=300;i++){const x=-4+(i/300)*8;const cy=H-pad-Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)*2.506*(H-2*pad-20)*0.85;i===0?ctx.moveTo(pad+(x+4)/8*(W-2*pad),cy):ctx.lineTo(pad+(x+4)/8*(W-2*pad),cy);}
    ctx.stroke();
    // axis labels
    ctx.fillStyle='#888';ctx.font='10px Courier New';ctx.textAlign='center';
    [-3,-2,-1,0,1,2,3].forEach(x=>{ctx.fillText(x,pad+(x+4)/8*(W-2*pad),H-pad+13);});
    label(ctx,`CLT: sum of n=${n} uniform[−½,½] vars — ${this.samples.length} trials`,8,8,{color:'#333',size:12,bg:'rgba(255,255,255,0.9)'});
    label(ctx,'Blue: empirical  |  Red: N(0,1)  |  Converges as n→∞',8,H-18,{color:'#555',size:10});
  }
}

// ── Animated Galton Board ─────────────────────────────────────────
class GaltonBoard {
  constructor(){ this.levels=14; this.reset(); }
  reset(){
    this.bins=new Array(this.levels+1).fill(0);
    this.activeBalls=[]; this.frame=0;
  }
  step(levels){
    this.levels=levels; this.frame++;
    if(this.frame%4===0) this.activeBalls.push({level:0,pos:0,t:0});
    const done=[];
    for(const b of this.activeBalls){
      b.t+=0.3;
      if(b.t>=1){b.t=0;b.level++;b.pos+=Math.random()<0.5?1:-1;
        if(b.level>this.levels){done.push(b);const bi=Math.floor((b.pos+this.levels)/2);if(bi>=0&&bi<=this.levels)this.bins[bi]++;}}
    }
    for(const b of done)this.activeBalls.splice(this.activeBalls.indexOf(b),1);
    if(this.activeBalls.length>60)this.activeBalls.splice(0,this.activeBalls.length-60);
  }
  render(ctx,W,H){
    clearCanvas(ctx,W,H,'#fff');
    const L=this.levels,pad=48,binW=(W-2*pad)/(L+2),rowH=(H-pad*1.8)/(L+2.5),cx0=W/2;
    ctx.fillStyle='#999';
    for(let r=0;r<=L;r++)for(let c=0;c<=r;c++){const px=cx0+(c-r/2)*binW,py=pad+r*rowH;ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();}
    // Active balls
    ctx.fillStyle='rgba(200,40,40,0.85)';
    for(const b of this.activeBalls){
      const px=cx0+(b.pos/2)*binW,py=pad+(b.level+b.t)*rowH;
      if(isFinite(px)&&isFinite(py)){ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();}
    }
    // Bins
    const baseY=pad+(L+1)*rowH;
    const mx=Math.max(...this.bins,1);
    const total=this.bins.reduce((a,b)=>a+b,0)||1;
    ctx.fillStyle='rgba(26,79,168,0.65)';
    for(let i=0;i<=L;i++){const h=(this.bins[i]/mx)*(H-baseY-20),bx=cx0+(i-L/2)*binW-binW*0.42;ctx.fillRect(bx,baseY-h,binW*0.84,h);}
    // Binomial overlay
    ctx.strokeStyle='#c42020';ctx.lineWidth=2;
    ctx.beginPath();
    for(let i=0;i<=L;i++){const binom=binomC(L,i)*Math.pow(0.5,L)*total;const h=(binom/mx)*(H-baseY-20);const bx=cx0+(i-L/2)*binW;i===0?ctx.moveTo(bx,baseY-h):ctx.lineTo(bx,baseY-h);}
    ctx.stroke();
    label(ctx,`Galton Board — ${L} levels | ${total} balls`,8,8,{color:'#333',size:12,bg:'rgba(255,255,255,0.9)'});
    label(ctx,'Blue: counts  |  Red: Binomial(n,½) → Normal',8,H-18,{color:'#555',size:10});
  }
}

// ── Animated Markov Chain ─────────────────────────────────────────
class MarkovChain {
  constructor(){
    this.states=['S₁','S₂','S₃','S₄'];
    this.colors=['#c42020','#1a4fa8','#1a6b1a','#a05000'];
    this.P=[[0.6,0.25,0.1,0.05],[0.3,0.4,0.2,0.1],[0.1,0.2,0.5,0.2],[0.1,0.15,0.25,0.5]];
    this.reset();
  }
  reset(){ this.current=0;this.history=[0];this.counts=[1,0,0,0];this.step_=0;this.timer=0; }
  step(){
    this.timer++;
    if(this.timer<6)return;
    this.timer=0;
    const row=this.P[this.current];let r=Math.random(),acc=0;
    for(let j=0;j<row.length;j++){acc+=row[j];if(r<acc){this.current=j;break;}}
    this.history.push(this.current);if(this.history.length>80)this.history.shift();
    this.counts[this.current]++;this.step_++;
  }
  render(ctx,W,H){
    clearCanvas(ctx,W,H,'#fff');
    const n=this.states.length,R=Math.min(W,H)*0.24,cx0=W*0.40,cy0=H/2;
    const pos=this.states.map((_,i)=>({x:cx0+R*Math.cos(i*Math.PI*2/n-Math.PI/2),y:cy0+R*Math.sin(i*Math.PI*2/n-Math.PI/2)}));
    // Arrows
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      if(this.P[i][j]<0.05)continue;
      const w=this.P[i][j];
      if(i===j){
        ctx.save();ctx.strokeStyle=`rgba(0,0,0,${0.12+w*0.5})`;ctx.lineWidth=w*5;
        ctx.beginPath();ctx.arc(pos[i].x+24,pos[i].y-24,16,0,Math.PI*2);ctx.stroke();
        label(ctx,w.toFixed(2),pos[i].x+33,pos[i].y-44,{color:'#888',size:9});ctx.restore();
      } else {
        const dx=pos[j].x-pos[i].x,dy=pos[j].y-pos[i].y,d=Math.sqrt(dx*dx+dy*dy)||1;
        const ox=-dy/d*10,oy=dx/d*10;
        const sx=pos[i].x+ox+dx/d*26,sy=pos[i].y+oy+dy/d*26,ex=pos[j].x+ox-dx/d*26,ey=pos[j].y+oy-dy/d*26;
        ctx.save();ctx.strokeStyle=`rgba(0,0,0,${0.1+w*0.5})`;ctx.lineWidth=w*5+0.5;
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
        const ang=Math.atan2(ey-sy,ex-sx);
        ctx.fillStyle=`rgba(0,0,0,${0.18+w*0.5})`;
        ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-10*Math.cos(ang-0.4),ey-10*Math.sin(ang-0.4));ctx.lineTo(ex-10*Math.cos(ang+0.4),ey-10*Math.sin(ang+0.4));ctx.closePath();ctx.fill();
        label(ctx,w.toFixed(2),(sx+ex)/2+ox*0.6,(sy+ey)/2+oy*0.6,{color:'#777',size:9,bg:'rgba(255,255,255,0.7)'});
        ctx.restore();
      }
    }
    // Nodes
    for(let i=0;i<n;i++){
      const cur=i===this.current;
      ctx.save();ctx.fillStyle=this.colors[i];ctx.globalAlpha=cur?1:0.5;
      ctx.beginPath();ctx.arc(pos[i].x,pos[i].y,cur?30:22,0,Math.PI*2);ctx.fill();
      if(cur){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();}
      ctx.fillStyle='#fff';ctx.globalAlpha=1;ctx.font='bold 12px Courier New';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(this.states[i],pos[i].x,pos[i].y);ctx.restore();
    }
    // History strip
    const bx=W*0.80,by=H*0.1,stripH=(H*0.8)/Math.max(1,this.history.length);
    label(ctx,'History',bx,by-18,{color:'#555',size:10});
    for(let i=0;i<this.history.length;i++){ctx.fillStyle=this.colors[this.history[i]];ctx.fillRect(bx,by+i*stripH,W*0.12,Math.max(1,stripH-0.5));}
    // Stationary dist
    let pi=[.25,.25,.25,.25];
    for(let k=0;k<300;k++){const np=pi.map((_,j)=>pi.reduce((s,v,ii)=>s+v*this.P[ii][j],0));pi=np;}
    const tot=this.counts.reduce((a,b)=>a+b,0)||1;
    label(ctx,'Stationary π vs empirical:',8,H-82,{color:'#333',size:10,bg:'rgba(255,255,255,0.88)'});
    this.states.forEach((s,i)=>label(ctx,`${s}: π=${pi[i].toFixed(3)}  emp=${(this.counts[i]/tot).toFixed(3)}`,8,H-66+i*16,{color:this.colors[i],size:10,bg:'rgba(255,255,255,0.85)'}));
    label(ctx,`Step: ${this.step_}  current: ${this.states[this.current]}`,8,8,{color:'#333',size:12,bg:'rgba(255,255,255,0.9)'});
  }
}

// ── Levy Flight ────────────────────────────────────────────────────
class LevyFlight {
  constructor(){ this.reset(); }
  reset(W,H){ this.pts=[{x:W/2,y:H/2}]; this.W=W||800; this.H=H||800; }
  step(alpha,W,H){
    const last=this.pts[this.pts.length-1];
    const u=Math.random();
    const r=Math.pow(u,-1/alpha)*15;  // Pareto-distributed step
    const theta=Math.random()*Math.PI*2;
    const nx=last.x+r*Math.cos(theta), ny=last.y+r*Math.sin(theta);
    this.pts.push({x:nx,y:ny});
    if(this.pts.length>2000)this.pts.shift();
  }
  render(ctx,W,H,alpha){
    clearCanvas(ctx,W,H,'#fff');
    if(this.pts.length<2)return;
    ctx.strokeStyle='rgba(26,79,168,0.6)';ctx.lineWidth=0.8;ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(this.pts[0].x,this.pts[0].y);
    for(let i=1;i<this.pts.length;i++)ctx.lineTo(this.pts[i].x,this.pts[i].y);
    ctx.stroke();
    const l=this.pts[this.pts.length-1];
    ctx.fillStyle='#c42020';ctx.beginPath();ctx.arc(l.x,l.y,5,0,Math.PI*2);ctx.fill();
    label(ctx,`Lévy Flight  α=${alpha.toFixed(2)}  (α<2 → heavy tails, long jumps)`,8,8,{color:'#333',size:12,bg:'rgba(255,255,255,0.9)'});
    label(ctx,'Power-law step distribution: P(r)~r^{−α−1}  vs Gaussian (α=2)',8,H-18,{color:'#666',size:10});
  }
}

// ── Main export ───────────────────────────────────────────────────
export class Probability {
  constructor(W,H){
    this.canvasW=W; this.canvasH=H;
    this.params={ view:'walk2d', sigma:1.5, cltN:20, galtonLevels:14, levyAlpha:1.5 };
    this.paramDefs=[
      { group:'View', items:[
        { id:'view', label:'Visualization', type:'select',
          options:['walk2d','walk1d','clt','galton','markov','levy'],
          tip:'All animated in real-time. Press Reset (↺) to restart.' },
      ]},
      { group:'Parameters', items:[
        { id:'sigma',        label:'Step size σ',   min:0.3, max:4,  step:0.1, type:'range' },
        { id:'cltN',         label:'CLT sum n',      min:1,   max:60, step:1,   type:'range', tip:'n→∞: converges to Normal by CLT' },
        { id:'galtonLevels', label:'Galton levels',  min:6,   max:20, step:1,   type:'range' },
        { id:'levyAlpha',    label:'Lévy α',         min:0.5, max:2.0,step:0.05,type:'range', tip:'α<2: super-diffusion; α→2: Brownian' },
      ]},
      { group:'Guide', items:[
        { id:'_guide', type:'hint', html:'<b>walk2d / walk1d:</b> Classic random walks. <b>clt:</b> Sum of n uniform r.v.s converges to N(0,1). <b>galton:</b> Ball-in-peg device showing binomial→normal. <b>markov:</b> Chain on 4 states; empirical frequency converges to stationary π. <b>levy:</b> Heavy-tailed random walk with α-stable steps.' },
      ]},
    ];
    this.presets=[
      {id:'w2d',  name:'Brownian Motion 2D', params:{view:'walk2d'}},
      {id:'w1d',  name:'Random Walk 1D',     params:{view:'walk1d'}},
      {id:'clt',  name:'Central Limit Thm',  params:{view:'clt',cltN:20}},
      {id:'gal',  name:'Galton Board',        params:{view:'galton'}},
      {id:'mar',  name:'Markov Chain',         params:{view:'markov'}},
      {id:'lev',  name:'Lévy Flight',          params:{view:'levy',levyAlpha:1.2}},
    ];
    this.domain='Probability & Statistics';
    this.stepsPerFrame=2;
    this._sub={
      walk2d:new Walk2D(), walk1d:new Walk1D(), clt:new CLTDemo(),
      galton:new GaltonBoard(), markov:new MarkovChain(), levy:new LevyFlight(),
    };
    this._sub.walk2d.reset(W,H);
    this._sub.walk1d.reset();
    this._sub.levy.reset(W,H);
  }

  get description(){
    const m={walk2d:'Brownian motion: ∑ i.i.d. Gaussian steps. Var grows linearly: E[|B_n|²]=nσ².',walk1d:'Simple ±1 random walk. Dashed envelope = ±σ√n diffusion bands.',clt:'Central Limit Theorem: sum of n i.i.d. uniforms converges to N(0,σ²). Increase n to watch the histogram approach the normal curve.',galton:'Balls fall through pegs, each bouncing left/right with p=½. Heights follow Binomial(n,½) — converges to Normal.',markov:'Finite Markov chain. Transition matrix P, stationary distribution π solves πP=π.',levy:'Lévy flight: steps drawn from a power-law distribution. α<2 gives heavy tails and anomalous diffusion. Models financial returns, earthquake sizes, foraging animals.'};
    return m[this.params.view]||'';
  }

  getFormula(){
    const m={walk2d:'E[|B_n|²] = nσ²  (Brownian diffusion)',walk1d:'S_n=X₁+⋯+Xₙ, Xᵢ=±1  →  S_n/√n → N(0,1)',clt:'(X₁+⋯+Xₙ)/√n → N(0,σ²)  as n→∞',galton:'bin(n,½) → N(n/2,n/4)  as n→∞',markov:'π = πP  (stationary distribution)',levy:'P(step>r) ~ r^{−α}  (power law, α-stable)'};
    return m[this.params.view]||'';
  }

  reset(){
    const v=this.params.view;
    if(v==='walk2d'){this._sub.walk2d.reset(this.canvasW,this.canvasH);}
    else if(v==='walk1d'){this._sub.walk1d.reset();}
    else if(v==='clt'){this._sub.clt.reset();}
    else if(v==='galton'){this._sub.galton.reset();}
    else if(v==='markov'){this._sub.markov.reset();}
    else if(v==='levy'){this._sub.levy.reset(this.canvasW,this.canvasH);}
  }

  onParamChange(id){
    if(id==='view'||id==='_preset') this.reset();
    if(id==='galtonLevels'){
      this._sub.galton.levels=this.params.galtonLevels;
      this._sub.galton.bins=new Array(this.params.galtonLevels+1).fill(0);
      this._sub.galton.activeBalls=[];
    }
  }

  update(){
    const v=this.params.view;
    if(v==='walk2d')  this._sub.walk2d.step(this.params.sigma,this.canvasW,this.canvasH);
    else if(v==='walk1d') this._sub.walk1d.step();
    else if(v==='clt')    this._sub.clt.step(this.params.cltN);
    else if(v==='galton') this._sub.galton.step(this.params.galtonLevels);
    else if(v==='markov') this._sub.markov.step();
    else if(v==='levy')   this._sub.levy.step(this.params.levyAlpha,this.canvasW,this.canvasH);
  }

  render(ctx,canvas){
    const W=canvas.width,H=canvas.height,v=this.params.view;
    if(v==='walk2d')  this._sub.walk2d.render(ctx,W,H,this.params.sigma);
    else if(v==='walk1d') this._sub.walk1d.render(ctx,W,H);
    else if(v==='clt')    this._sub.clt.render(ctx,W,H,this.params.cltN);
    else if(v==='galton') this._sub.galton.render(ctx,W,H);
    else if(v==='markov') this._sub.markov.render(ctx,W,H);
    else if(v==='levy')   this._sub.levy.render(ctx,W,H,this.params.levyAlpha);
  }

  coordInfo(){ return `view: ${this.params.view}  |  ↺ to restart`; }
}
