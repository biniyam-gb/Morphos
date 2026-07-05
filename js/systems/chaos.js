
// Chaos & Bifurcation — Logistic map, cobweb, Lyapunov exponents
import { clearCanvas, label } from '../plot.js';

export class Chaos {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = {
      view:'bifurcation',   // bifurcation | cobweb | lyapunov | timeseries
      map:'logistic',       // logistic | sine | tent | cubic
      r: 3.7, x0: 0.5,
      rMin:2.5, rMax:4.0,
      skip:200, keep:150,
      showFeigenbaum:true,
    };
    this.paramDefs=[
      { group:'Map & View', items:[
        { id:'view', label:'View', type:'select', options:['bifurcation','cobweb','timeseries','lyapunov'],
          tip:'Bifurcation: how fixed points split as r increases. Cobweb: graphical iteration. Lyapunov: chaos measure.' },
        { id:'map',  label:'Map f(x,r)', type:'select', options:['logistic','sine','tent','cubic'],
          tip:'logistic: rx(1-x). sine: r·sin(πx). tent: r·min(x,1-x). cubic: rx(1-x²).' },
      ]},
      { group:'Parameters', items:[
        { id:'r',    label:'Parameter r', min:0, max:4.0, step:0.001, type:'range' },
        { id:'x0',   label:'Initial x₀',  min:0.01, max:0.99, step:0.01, type:'range' },
        { id:'rMin', label:'r range min',  min:0,   max:3.5, step:0.05, type:'range' },
        { id:'rMax', label:'r range max',  min:2.0, max:4.0, step:0.05, type:'range' },
      ]},
      { group:'Render', items:[
        { id:'skip', label:'Transient skip',  min:50, max:500, step:10, type:'range', tip:'Iterations discarded before plotting.' },
        { id:'keep', label:'Points kept',     min:20, max:400, step:10, type:'range' },
        { id:'showFeigenbaum', label:'Show Feigenbaum points', type:'toggle', tip:'Mark δ≈4.669 period-doubling cascade.' },
      ]},
    ];
    this.presets=[
      {id:'bif-log', name:'Logistic Bifurcation', params:{view:'bifurcation',map:'logistic',rMin:2.5,rMax:4.0,skip:200,keep:150}},
      {id:'cobweb-chaos', name:'Cobweb r=3.9', params:{view:'cobweb',map:'logistic',r:3.9,x0:0.2}},
      {id:'cobweb-period2',name:'Cobweb Period-2', params:{view:'cobweb',map:'logistic',r:3.2,x0:0.2}},
      {id:'timeseries', name:'Time Series r=3.7', params:{view:'timeseries',map:'logistic',r:3.7,x0:0.5}},
      {id:'lyapunov', name:'Lyapunov Exponents', params:{view:'lyapunov',map:'logistic',rMin:2.5,rMax:4.0}},
      {id:'sine-bif', name:'Sine Map Bifurcation', params:{view:'bifurcation',map:'sine',rMin:0.5,rMax:1.0}},
    ];
    this.domain='Chaos Theory';
    this.formula='xₙ₊₁ = r·xₙ·(1 − xₙ)';
    this.description='The logistic map is the canonical route to chaos via period-doubling. Feigenbaum constant δ≈4.6692 is universal. At r≈3.57 onset of chaos.';
    this.stepsPerFrame=0;
    this._dirty=true;
  }

  _map(x, r) {
    switch(this.params.map) {
      case 'sine':  return r*Math.sin(Math.PI*x);
      case 'tent':  return r*Math.min(x,1-x);
      case 'cubic': return r*x*(1-x*x)*0.5;
      default:      return r*x*(1-x);
    }
  }
  _dmap(x, r) {
    switch(this.params.map) {
      case 'sine':  return r*Math.PI*Math.cos(Math.PI*x);
      case 'tent':  return x<0.5?r:-r;
      case 'cubic': return r*(1-3*x*x)*0.5;
      default:      return r*(1-2*x);
    }
  }

  getFormula() {
    const m={'logistic':'r·xₙ·(1−xₙ)','sine':'r·sin(πxₙ)','tent':'r·min(xₙ,1−xₙ)','cubic':'r·xₙ·(1−xₙ²)/2'};
    return `xₙ₊₁ = ${m[this.params.map]||'f(xₙ,r)'}   [r = ${this.params.r.toFixed(3)}]`;
  }

  reset() { this._dirty=true; }
  update() {}
  onParamChange(id) { this._dirty=true; }

  render(ctx, canvas) {
    if (!this._dirty) return; this._dirty=false;
    const W=canvas.width, H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    const v = this.params.view;
    if (v==='bifurcation') this._renderBif(ctx,W,H);
    else if (v==='cobweb')  this._renderCobweb(ctx,W,H);
    else if (v==='timeseries') this._renderTS(ctx,W,H);
    else if (v==='lyapunov') this._renderLyapunov(ctx,W,H);
  }

  _renderBif(ctx,W,H) {
    const {rMin,rMax,skip,keep} = this.params;
    const pad=48;
    const toC = (r,x)=>[pad+(r-rMin)/(rMax-rMin)*(W-2*pad), H-pad-x*(H-2*pad)];

    // Axes
    ctx.strokeStyle='#aaa'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad,pad);   ctx.lineTo(pad,H-pad);   ctx.stroke();

    // Axis labels
    ctx.fillStyle='#555'; ctx.font='11px Courier New'; ctx.textAlign='center';
    const rSteps=5;
    for(let i=0;i<=rSteps;i++){
      const r=rMin+(rMax-rMin)*i/rSteps;
      const cx=pad+(r-rMin)/(rMax-rMin)*(W-2*pad);
      ctx.fillText(r.toFixed(2),cx,H-pad+14);
    }
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(let i=0;i<=4;i++){
      const x=i/4;
      const cy=H-pad-x*(H-2*pad);
      ctx.fillText(x.toFixed(2),pad-5,cy);
    }
    ctx.save(); ctx.translate(14,H/2); ctx.rotate(-Math.PI/2);
    ctx.textAlign='center'; ctx.fillText('xₙ (attractor)',0,0); ctx.restore();
    ctx.textAlign='center'; ctx.fillText('r (parameter)',W/2,H-8);

    // Plot
    const cols=W-2*pad;
    ctx.fillStyle='rgba(26,79,168,0.7)';
    for(let ci=0;ci<cols;ci++){
      const r=rMin+(ci/cols)*(rMax-rMin);
      let x=0.5;
      for(let i=0;i<skip;i++) x=this._map(x,r);
      for(let i=0;i<keep;i++){
        x=this._map(x,r);
        const [cx,cy]=toC(r,x);
        ctx.fillRect(cx,cy,1,1);
      }
    }

    // Feigenbaum points
    if(this.params.showFeigenbaum){
      const fps=[3.0,3.449,3.544,3.5644,3.5688];
      ctx.strokeStyle='rgba(180,20,20,0.5)'; ctx.lineWidth=0.8; ctx.setLineDash([3,4]);
      for(const fr of fps){
        if(fr<rMin||fr>rMax) continue;
        const [cx]=toC(fr,0);
        ctx.beginPath(); ctx.moveTo(cx,pad); ctx.lineTo(cx,H-pad); ctx.stroke();
      }
      ctx.setLineDash([]);
      label(ctx,'Period-doubling cascade  δ≈4.669',pad+4,pad+4,{color:'#b82020',size:10});
    }

    label(ctx,'Bifurcation Diagram',pad+4,H-pad-16,{color:'#555',size:11});
  }

  _renderCobweb(ctx,W,H) {
    const {r, x0} = this.params;
    const pad=48;
    const tx=x=>pad+x*(W-2*pad);
    const ty=x=>H-pad-x*(H-2*pad);

    // Map curve
    ctx.strokeStyle='#1a4fa8'; ctx.lineWidth=1.5;
    ctx.beginPath();
    for(let i=0;i<=200;i++){
      const x=i/200;
      const fx=this._map(x,r);
      i===0?ctx.moveTo(tx(x),ty(fx)):ctx.lineTo(tx(x),ty(fx));
    }
    ctx.stroke();
    // Diagonal y=x
    ctx.strokeStyle='#aaa'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(tx(0),ty(0)); ctx.lineTo(tx(1),ty(1)); ctx.stroke();
    // Axes
    ctx.strokeStyle='#aaa';
    ctx.beginPath(); ctx.moveTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad,pad);   ctx.lineTo(pad,H-pad);   ctx.stroke();
    // Labels
    ctx.fillStyle='#555'; ctx.font='10px Courier New';
    ctx.textAlign='center'; ctx.fillText(`r = ${r.toFixed(3)}`,W/2,H-8);
    ctx.fillText('xₙ',W/2,H-pad+14);

    // Cobweb
    ctx.strokeStyle='#c42020'; ctx.lineWidth=1.2;
    ctx.beginPath();
    let x=x0;
    ctx.moveTo(tx(x),ty(0));
    for(let i=0;i<120;i++){
      const fx=this._map(x,r);
      ctx.lineTo(tx(x),ty(fx));
      ctx.lineTo(tx(fx),ty(fx));
      x=fx;
    }
    ctx.stroke();
    // Start point
    ctx.fillStyle='#c42020'; ctx.beginPath(); ctx.arc(tx(x0),ty(0),4,0,Math.PI*2); ctx.fill();
    label(ctx,`f(x) = ${this.getFormula().split('=')[1].split('[')[0].trim()}`,pad+4,pad+4,{color:'#1a4fa8',size:11});
  }

  _renderTS(ctx,W,H) {
    const {r,x0} = this.params;
    const N=200; const pad=40;
    const pts=[];
    let x=x0;
    for(let i=0;i<N;i++){ x=this._map(x,r); pts.push(x); }
    const tw=x=>pad+(x/(N-1))*(W-2*pad);
    const ty=x=>H-pad-x*(H-2*pad);
    ctx.strokeStyle='#aaa'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad,pad); ctx.lineTo(pad,H-pad); ctx.stroke();
    ctx.strokeStyle='#1a4fa8'; ctx.lineWidth=1.5; ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(tw(0),ty(pts[0]));
    for(let i=1;i<pts.length;i++) ctx.lineTo(tw(i),ty(pts[i]));
    ctx.stroke();
    ctx.fillStyle='#1a4fa8';
    for(let i=0;i<pts.length;i+=2){ctx.beginPath();ctx.arc(tw(i),ty(pts[i]),1.5,0,Math.PI*2);ctx.fill();}
    label(ctx,`r=${r.toFixed(3)}  x₀=${x0.toFixed(3)}`,pad,pad-4,{color:'#555',size:11});
    ctx.fillStyle='#555'; ctx.font='10px Courier New'; ctx.textAlign='center';
    ctx.fillText('n (iteration)',W/2,H-6); ctx.fillText('xₙ',14,H/2);
  }

  _renderLyapunov(ctx,W,H) {
    const {rMin,rMax} = this.params;
    const pad=48; const cols=W-2*pad; const N=800;
    // Compute Lyapunov exponents
    const lam=[];
    for(let ci=0;ci<=cols;ci++){
      const r=rMin+(ci/cols)*(rMax-rMin);
      let x=0.5; let s=0;
      for(let i=0;i<100;i++) x=this._map(x,r);
      for(let i=0;i<N;i++){
        const d=Math.abs(this._dmap(x,r));
        s+=d>1e-12?Math.log(d):-10;
        x=this._map(x,r);
      }
      lam.push(s/N);
    }
    const maxL=Math.max(...lam), minL=Math.min(...lam.filter(isFinite));
    const range=Math.max(Math.abs(maxL),Math.abs(minL));
    const ty=v=>H/2-v/range*(H/2-pad);
    // Grid
    ctx.strokeStyle='#ddd'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad,H/2); ctx.lineTo(W-pad,H/2); ctx.stroke();
    ctx.strokeStyle='#aaa';
    ctx.beginPath(); ctx.moveTo(pad,pad); ctx.lineTo(pad,H-pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
    // Plot
    for(let ci=0;ci<cols;ci++){
      const l=lam[ci]; if(!isFinite(l)) continue;
      const x=pad+ci; const y=ty(l);
      ctx.strokeStyle=l>0?'rgba(180,20,20,0.8)':'rgba(26,79,168,0.8)';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x,H/2); ctx.lineTo(x,y); ctx.stroke();
    }
    // Labels
    ctx.fillStyle='#555'; ctx.font='10px Courier New';
    ctx.textAlign='center'; ctx.fillText('r',W/2,H-6);
    ctx.fillText('0',pad-12,H/2+4); ctx.fillText('+',pad-12,pad+4); ctx.fillText('−',pad-12,H-pad-4);
    label(ctx,'λ>0: chaos (red)  λ<0: order (blue)',pad+4,pad,{color:'#555',size:10});
    ctx.textAlign='center';
    for(let i=0;i<=5;i++){
      const r=rMin+(rMax-rMin)*i/5;
      ctx.fillText(r.toFixed(2),pad+(W-2*pad)*i/5,H-pad+13);
    }
  }

  coordInfo(cx,cy,W,H){
    const {rMin,rMax}=this.params; const pad=48;
    const r=rMin+(cx-pad)/(W-2*pad)*(rMax-rMin);
    const x=1-(cy-pad)/(W-2*pad);
    return `r=${r.toFixed(4)}  x=${Math.max(0,Math.min(1,x)).toFixed(4)}`;
  }
}
