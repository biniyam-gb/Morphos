
// Number Theory — Ulam Spiral, Collatz, Modular Arithmetic, Prime patterns
import { clearCanvas, label } from '../plot.js';

function sieve(n){
  const c=new Uint8Array(n+1).fill(1); c[0]=c[1]=0;
  for(let i=2;i*i<=n;i++) if(c[i]) for(let j=i*i;j<=n;j+=i) c[j]=0;
  return c;
}

function collatz(n){
  const seq=[n];
  while(n!==1){ n=n%2===0?n/2:3*n+1; seq.push(n); if(seq.length>10000)break; }
  return seq;
}

function numDivisors(n,maxN){
  const d=new Uint16Array(maxN+1);
  for(let i=1;i<=maxN;i++) for(let j=i;j<=maxN;j+=i) d[j]++;
  return d;
}

export class NumberTheory {
  constructor(W,H){
    this.canvasW=W; this.canvasH=H;
    this.params={
      view:'ulam',   // ulam | collatz | modtable | goldbach | primerace
      ulamSize:201,  // must be odd
      ulamColor:'prime',  // prime | divisors | mod3 | mod6
      collatzN:27,
      modN:12,
      goldbachMax:200,
    };
    this.paramDefs=[
      { group:'View', items:[
        { id:'view', label:'Visualization', type:'select',
          options:['ulam','collatz','modtable','goldbach','primerace'],
          tip:'Ulam: prime spiral. Collatz: 3n+1 orbits. Mod table: multiplicative structure. Goldbach: even = p+q.' },
      ]},
      { group:'Ulam Spiral', items:[
        { id:'ulamSize', label:'Grid size (odd)', min:51,max:401,step:2, type:'range', tip:'Number of cells per side.' },
        { id:'ulamColor', label:'Color by', type:'select', options:['prime','divisors','mod3','mod6','mod12'] },
      ]},
      { group:'Collatz', items:[
        { id:'collatzN', label:'Starting N', min:1,max:9999,step:1, type:'range', tip:'Collatz conjecture: always reaches 1.' },
      ]},
      { group:'Modular Table', items:[
        { id:'modN', label:'Modulus n', min:2,max:50,step:1, type:'range', tip:'Shows i×j mod n as a color.' },
      ]},
      { group:'Goldbach', items:[
        { id:'goldbachMax', label:'Check even n up to', min:10,max:1000,step:10, type:'range', tip:'Goldbach conjecture: every even n>2 = p+q.' },
      ]},
    ];
    this.presets=[
      {id:'ulam-prime',  name:'Ulam Spiral (primes)',    params:{view:'ulam',ulamColor:'prime',ulamSize:201}},
      {id:'ulam-div',    name:'Ulam (divisor count)',     params:{view:'ulam',ulamColor:'divisors',ulamSize:201}},
      {id:'ulam-mod6',   name:'Ulam (mod 6)',             params:{view:'ulam',ulamColor:'mod6',ulamSize:201}},
      {id:'collatz-27',  name:'Collatz n=27 (long!)',     params:{view:'collatz',collatzN:27}},
      {id:'collatz-pick',name:'Collatz explorer',         params:{view:'collatz',collatzN:100}},
      {id:'modtable-12', name:'×-table mod 12',           params:{view:'modtable',modN:12}},
      {id:'modtable-p',  name:'×-table mod 7 (prime)',    params:{view:'modtable',modN:7}},
      {id:'goldbach',    name:'Goldbach partitions',      params:{view:'goldbach',goldbachMax:500}},
      {id:'primerace',   name:'Prime race mod 4',         params:{view:'primerace'}},
    ];
    this.domain='Number Theory';
    this.formula='π(n) ~ n/ln(n)  (Prime Number Theorem)';
    this.description='Visual explorations of prime structure, modular arithmetic, the Collatz conjecture (3n+1), and Goldbach\'s conjecture.';
    this.stepsPerFrame=0; this._dirty=true;
  }

  getFormula(){
    const v=this.params.view;
    if(v==='ulam') return 'Ulam spiral: natural numbers wound in a square — primes align diagonally';
    if(v==='collatz') return `Collatz: ${this.params.collatzN} → ${this.params.collatzN%2?`3×${this.params.collatzN}+1`:`${this.params.collatzN}/2`} → … → 1 (conjectured)`;
    if(v==='modtable') return `(i × j) mod ${this.params.modN}`;
    if(v==='goldbach') return `Goldbach: ∀ even n > 2, ∃ primes p,q: n = p + q`;
    if(v==='primerace') return 'Chebyshev bias: primes 3 mod 4 tend to lead primes 1 mod 4';
    return '';
  }

  reset(){ this._dirty=true; }
  update(){}
  onParamChange(id){ if(id==='view'||id==='_preset') this._dirty=true; else this._dirty=true; }

  render(ctx,canvas){
    if(!this._dirty)return; this._dirty=false;
    const W=canvas.width,H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    const v=this.params.view;
    if(v==='ulam') this._renderUlam(ctx,W,H);
    else if(v==='collatz') this._renderCollatz(ctx,W,H);
    else if(v==='modtable') this._renderModTable(ctx,W,H);
    else if(v==='goldbach') this._renderGoldbach(ctx,W,H);
    else if(v==='primerace') this._renderPrimeRace(ctx,W,H);
  }

  _renderUlam(ctx,W,H){
    const sz=this.params.ulamSize; const maxN=sz*sz;
    const primes=sieve(maxN);
    const divs=this.params.ulamColor==='divisors'?numDivisors(0,maxN):null;
    const maxDiv=divs?Math.max(...divs.slice(1,maxN+1)):1;
    const cell=Math.floor(Math.min(W,H)/sz);
    const ox=Math.floor((W-sz*cell)/2), oy=Math.floor((H-sz*cell)/2);
    // Generate spiral coordinates
    let x=Math.floor(sz/2),y=Math.floor(sz/2),dx=0,dy=-1;
    let steps=1,stepCount=0,turnCount=0;
    const coords=new Array(maxN);
    for(let n=1;n<=maxN;n++){
      coords[n-1]={x,y};
      x+=dx; y+=dy; stepCount++;
      if(stepCount===steps){
        stepCount=0; [dx,dy]=[-dy,dx]; turnCount++;
        if(turnCount%2===0) steps++;
      }
    }
    for(let n=1;n<=maxN;n++){
      const {x:cx,y:cy}=coords[n-1];
      const px=ox+cx*cell, py=oy+cy*cell;
      let col;
      const cm=this.params.ulamColor;
      if(cm==='prime'){
        if(!primes[n]) continue;
        col='#1a4fa8';
      } else if(cm==='divisors'){
        const t=divs[n]/maxDiv;
        const r=Math.round(255*t),b=Math.round(255*(1-t));
        col=`rgb(${r},0,${b})`;
      } else if(cm==='mod3'){ col=['#fff','#c42020','#1a4fa8'][n%3]; if(col==='#fff')continue; }
      else if(cm==='mod6'){ const c=['#fff','#c42020','#1a4fa8','#1a6b1a','#a05000','#6020a0'][n%6]; if(c==='#fff')continue; col=c; }
      else if(cm==='mod12'){ if(n%12===0)continue; const h=(n%12)/12; col=`hsl(${h*360},70%,40%)`; }
      else col='#333';
      ctx.fillStyle=col;
      ctx.fillRect(px,py,cell,cell);
    }
    label(ctx,`Ulam Spiral  n=1…${maxN}  [${sz}×${sz}]`,6,6,{color:'#333',size:11,bg:'rgba(255,255,255,0.85)'});
    label(ctx,'Primes tend to align on diagonals — a deep mystery',6,H-16,{color:'#666',size:10});
  }

  _renderCollatz(ctx,W,H){
    const N0=Math.round(this.params.collatzN);
    const seq=collatz(N0);
    const maxV=Math.max(...seq); const pad=48;
    const tw=i=>pad+(i/(seq.length-1||1))*(W-2*pad);
    const ty=v=>H-pad-((v-1)/(maxV-1||1))*(H-2*pad);
    // Axes
    ctx.strokeStyle='#ccc'; ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad,H-pad);ctx.lineTo(W-pad,H-pad);ctx.stroke();
    ctx.beginPath();ctx.moveTo(pad,pad);ctx.lineTo(pad,H-pad);ctx.stroke();
    // Plot
    ctx.strokeStyle='#1a4fa8'; ctx.lineWidth=1.5; ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(tw(0),ty(seq[0]));
    for(let i=1;i<seq.length;i++) ctx.lineTo(tw(i),ty(seq[i]));
    ctx.stroke();
    ctx.fillStyle='#1a4fa8';
    for(let i=0;i<seq.length;i+=Math.max(1,Math.floor(seq.length/80))){
      ctx.beginPath(); ctx.arc(tw(i),ty(seq[i]),2,0,Math.PI*2); ctx.fill();
    }
    // Mark max
    const mi=seq.indexOf(maxV);
    ctx.save(); ctx.strokeStyle='#c42020'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(tw(mi),ty(maxV)); ctx.lineTo(tw(mi),H-pad); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx,`max=${maxV} at step ${mi}`,tw(mi)+4,ty(maxV)-4,{color:'#c42020',size:10});
    ctx.restore();
    label(ctx,`Collatz orbit of ${N0}:  ${seq.length} steps to reach 1`,6,6,{color:'#333',size:12,bg:'rgba(255,255,255,0.85)'});
    ctx.fillStyle='#555'; ctx.font='10px Courier New'; ctx.textAlign='center';
    ctx.fillText('step n',W/2,H-8); ctx.textAlign='right'; ctx.fillText('value',pad-4,pad);
  }

  _renderModTable(ctx,W,H){
    const n=this.params.modN; const pad=32;
    const cell=Math.floor(Math.min(W-2*pad,H-2*pad)/n);
    const ox=Math.floor((W-n*cell)/2), oy=Math.floor((H-n*cell)/2);
    for(let i=0;i<n;i++){
      for(let j=0;j<n;j++){
        const v=(i*j)%n;
        const t=v/n;
        ctx.fillStyle=`hsl(${t*300+30},70%,${35+t*25}%)`;
        ctx.fillRect(ox+j*cell,oy+i*cell,cell,cell);
        if(cell>=16){
          ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.font=`${Math.min(cell-4,14)}px Courier New`;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(v,ox+j*cell+cell/2,oy+i*cell+cell/2);
        }
      }
    }
    label(ctx,`Multiplication table (i×j) mod ${n}`,6,6,{color:'#333',size:12,bg:'rgba(255,255,255,0.85)'});
    if(n<=20&&sieve(n)[n-1]) label(ctx,`${n} is prime → every nonzero element has an inverse (field)`,6,H-16,{color:'#1a6b1a',size:10});
    else label(ctx,`${n} is composite → some elements lack inverses`,6,H-16,{color:'#888',size:10});
  }

  _renderGoldbach(ctx,W,H){
    const maxE=this.params.goldbachMax; const pad=48;
    const pr=sieve(maxE);
    const points=[];
    for(let n=4;n<=maxE;n+=2){
      let best=0;
      for(let p=2;p<=n/2;p++) if(pr[p]&&pr[n-p]){ best=p; break; }
      if(best) points.push({n,p:best,q:n-best});
    }
    const tw=p=>pad+(p.n-4)/(maxE-4)*(W-2*pad);
    const ty=p=>H-pad-(p.p/(p.n/2))*(H-2*pad);
    ctx.strokeStyle='#aaa'; ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad,H-pad);ctx.lineTo(W-pad,H-pad);ctx.stroke();
    ctx.beginPath();ctx.moveTo(pad,pad);ctx.lineTo(pad,H-pad);ctx.stroke();
    ctx.fillStyle='rgba(26,79,168,0.6)';
    for(const pt of points){
      const cx=tw(pt); const cy=ty(pt);
      ctx.fillRect(cx-1,cy-1,2,2);
    }
    label(ctx,`Goldbach: even n = p + q (smallest prime p shown)  n ≤ ${maxE}`,6,6,{color:'#333',size:11,bg:'rgba(255,255,255,0.85)'});
    label(ctx,'Unproven since 1742. Verified to 4×10¹⁸.',6,H-16,{color:'#666',size:10});
  }

  _renderPrimeRace(ctx,W,H){
    const MAX=2000; const pr=sieve(MAX);
    const pad=48;
    let lead1=0,lead3=0,tie=0; // 1 mod 4, 3 mod 4
    const history=[]; let s1=0,s3=0;
    for(let p=3;p<=MAX;p++){
      if(!pr[p]) continue;
      if(p%4===1) s1++;
      if(p%4===3) s3++;
      history.push({p,s1,s3});
    }
    const maxS=Math.max(history[history.length-1]?.s1||1,history[history.length-1]?.s3||1);
    const tx=i=>pad+(i/history.length)*(W-2*pad);
    const ty=v=>H-pad-(v/maxS)*(H-2*pad);
    ctx.strokeStyle='#aaa'; ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad,H-pad);ctx.lineTo(W-pad,H-pad);ctx.stroke();
    ctx.beginPath();ctx.moveTo(pad,pad);ctx.lineTo(pad,H-pad);ctx.stroke();
    // p≡1 mod 4
    ctx.strokeStyle='#1a4fa8'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(tx(0),ty(history[0]?.s1||0));
    for(let i=1;i<history.length;i++) ctx.lineTo(tx(i),ty(history[i].s1));
    ctx.stroke();
    // p≡3 mod 4
    ctx.strokeStyle='#c42020'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(tx(0),ty(history[0]?.s3||0));
    for(let i=1;i<history.length;i++) ctx.lineTo(tx(i),ty(history[i].s3));
    ctx.stroke();
    label(ctx,'Prime Race: p≡1(mod 4) [blue] vs p≡3(mod 4) [red]',6,6,{color:'#333',size:11,bg:'rgba(255,255,255,0.85)'});
    label(ctx,'Chebyshev\'s bias: 3 mod 4 leads most of the time (proven 1994)',6,H-16,{color:'#666',size:10});
  }

  coordInfo(cx,cy,W,H){ return `view: ${this.params.view}`; }
}
