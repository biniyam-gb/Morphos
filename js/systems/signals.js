
// Signal Processing — FFT, filtering, aliasing, spectral analysis
import { clearCanvas, label } from '../plot.js';

const MATH=`"use strict";const{sin,cos,tan,exp,log,sqrt,abs,pow,atan,atan2,sinh,cosh,sign,floor,ceil,min,max,PI,E}=Math;const pi=PI,e=E;`;

// Discrete Fourier Transform (slow, but clear)
function dft(x) {
  const N=x.length; const re=new Float64Array(N), im=new Float64Array(N);
  for(let k=0;k<N;k++){
    for(let n=0;n<N;n++){
      const a=2*Math.PI*k*n/N;
      re[k]+=x[n]*Math.cos(a); im[k]-=x[n]*Math.sin(a);
    }
    re[k]/=N; im[k]/=N;
  }
  return{re,im};
}
function idft(re,im){
  const N=re.length; const out=new Float64Array(N);
  for(let n=0;n<N;n++){
    for(let k=0;k<N;k++){
      const a=2*Math.PI*k*n/N;
      out[n]+=re[k]*Math.cos(a)-im[k]*Math.sin(a);
    }
  }
  return out;
}

const SIGNAL_PRESETS = {
  'Square Wave':     { fn:(t)=>Math.sign(Math.sin(2*Math.PI*4*t)), desc:'Sum of odd harmonics: 4/π·Σ sin(nωt)/n. Shows Gibbs phenomenon.' },
  'Sawtooth':        { fn:(t)=>2*(t%1)-1, desc:'All harmonics: 2/π·Σ (−1)ⁿ⁺¹ sin(nωt)/n.' },
  'Triangle':        { fn:(t)=>Math.asin(Math.sin(2*Math.PI*3*t))*2/Math.PI, desc:'Odd harmonics with 1/n² decay. Smoother than square.' },
  'Sinusoid':        { fn:(t)=>Math.sin(2*Math.PI*5*t), desc:'Pure tone. Single spike in spectrum.' },
  'Two Tones':       { fn:(t)=>Math.sin(2*Math.PI*3*t)+0.5*Math.sin(2*Math.PI*7*t), desc:'Two sinusoids. Two spikes in spectrum.' },
  'AM Signal':       { fn:(t)=>(1+0.7*Math.cos(2*Math.PI*2*t))*Math.sin(2*Math.PI*10*t), desc:'Amplitude modulated carrier. Sidebands visible in spectrum.' },
  'FM Signal':       { fn:(t)=>Math.sin(2*Math.PI*(8*t+2*Math.sin(2*Math.PI*t))), desc:'Frequency modulated. Rich harmonic spectrum.' },
  'Chirp':           { fn:(t)=>Math.sin(2*Math.PI*(2+14*t)*t), desc:'Linear chirp: frequency sweeps from 2 to 16 Hz.' },
  'Gaussian Pulse':  { fn:(t)=>Math.exp(-((t-0.5)**2)/0.005), desc:'Gaussian pulse. Fourier transform is also Gaussian (uncertainty principle).' },
  'Impulse':         { fn:(t)=>Math.abs(t-0.5)<0.01?1:0, desc:'Delta approximation. Flat spectrum (all frequencies equally).' },
  'White Noise':     { fn:(t,seed=0)=>Math.sin(997*t*1000+seed)*0.5+Math.sin(1997*t*1000+seed)*0.5, desc:'Pseudo-random. Flat power spectrum.' },
  'Custom':          { fn:(t)=>Math.sin(2*Math.PI*5*t), desc:'Edit expression below.' },
};

const FILTER_TYPES = ['none','low-pass','high-pass','band-pass','band-stop','gaussian-smooth'];

export class SignalProcessing {
  constructor(W,H){
    this.canvasW=W; this.canvasH=H;
    this.N=256;
    this.params={
      signal:'Square Wave',
      signalExpr:'sign(sin(2*pi*4*t))',
      filter:'low-pass',
      cutoff1:8, cutoff2:20,
      view:'split',   // split | spectrogram | aliasing
      aliasN:30,      // undersampling demo
    };
    this.paramDefs=[
      { group:'Signal', items:[
        { id:'signal', label:'Preset', type:'select', options:Object.keys(SIGNAL_PRESETS) },
        { id:'_guide', type:'hint', html:'Variable: <code>t</code> ∈ [0,1]  |  Functions: <code>sin cos exp abs sign floor pi</code><br>Custom example: <code>sin(2*pi*5*t) + 0.3*sin(2*pi*13*t)</code>' },
        { id:'signalExpr', label:'x(t) =', type:'code' },
      ]},
      { group:'Filter', items:[
        { id:'filter',  label:'Filter type', type:'select', options:FILTER_TYPES,
          tip:'Applied in frequency domain. Shows Gibbs, ringing, and spectral effects.' },
        { id:'cutoff1', label:'Cutoff f₁ (Hz)', min:1, max:60, step:1, type:'range' },
        { id:'cutoff2', label:'Cutoff f₂ (Hz)', min:2, max:80, step:1, type:'range', tip:'Upper cutoff for band-pass/stop.' },
      ]},
      { group:'View', items:[
        { id:'view', label:'Display', type:'select', options:['split','spectrogram','aliasing'],
          tip:'split: time+spectrum+filtered. spectrogram: time-frequency. aliasing: undersampling demo.' },
        { id:'aliasN', label:'Alias: samples', min:5, max:128, step:1, type:'range', tip:'Reduce to see aliasing (Nyquist violation).' },
      ]},
    ];
    this.presets=[
      {id:'sq',  name:'Square wave + LP filter', params:{signal:'Square Wave',   filter:'low-pass',  cutoff1:8,  view:'split'}},
      {id:'am',  name:'AM signal spectrum',       params:{signal:'AM Signal',     filter:'none',      view:'split'}},
      {id:'chirp',name:'Chirp spectrogram',       params:{signal:'Chirp',         filter:'none',      view:'spectrogram'}},
      {id:'gibbs',name:'Gibbs phenomenon',        params:{signal:'Square Wave',   filter:'low-pass',  cutoff1:15, view:'split'}},
      {id:'alias',name:'Aliasing demo',           params:{signal:'Sinusoid',      filter:'none',      view:'aliasing',aliasN:12}},
      {id:'gauss',name:'Gaussian + uncertainty',  params:{signal:'Gaussian Pulse',filter:'none',      view:'split'}},
      {id:'noise',name:'White noise spectrum',    params:{signal:'White Noise',   filter:'low-pass',  cutoff1:20, view:'split'}},
    ];
    this.domain='Signal Processing & Fourier Analysis';
    this.description='Discrete Fourier Transform, spectral filtering, and sampling theory. Filter in frequency domain = convolve in time domain. Nyquist: sample rate must exceed 2× highest frequency.';
    this.stepsPerFrame=0;
    this._dirty=true;
    this._computeSignal();
  }

  getFormula(){
    const m={
      'none':'X[k] = Σ x[n]·e^{−2πikn/N}  (DFT)',
      'low-pass':'H[k] = 1 if |k|<f_c else 0  (ideal LP)',
      'high-pass':'H[k] = 0 if |k|<f_c else 1  (ideal HP)',
      'band-pass':'H[k] = 1 if f₁<|k|<f₂  (BP)',
      'band-stop':'H[k] = 0 if f₁<|k|<f₂  (BS/notch)',
      'gaussian-smooth':'H[k] = exp(−k²/(2f_c²))  (Gaussian)',
    };
    return m[this.params.filter]||'';
  }

  _evalSignal(t){
    if(this.params.signal==='Custom'){
      try{return new Function('t',MATH+`return (${this.params.signalExpr})`)(t);}catch(e){return 0;}
    }
    const p=SIGNAL_PRESETS[this.params.signal];
    if(!p)return 0;
    const v=p.fn(t); return isFinite(v)?v:0;
  }

  _computeSignal(){
    const N=this.N;
    this._x=new Float64Array(N);
    for(let i=0;i<N;i++) this._x[i]=this._evalSignal(i/N);
    // DFT
    const{re,im}=dft(this._x);
    this._re=re; this._im=im;
    // Apply filter
    const reF=Float64Array.from(re), imF=Float64Array.from(im);
    const{filter,cutoff1,cutoff2}=this.params;
    for(let k=0;k<N;k++){
      const f=k<=N/2?k:N-k;
      let H=1;
      if(filter==='low-pass')    H=f<cutoff1?1:0;
      else if(filter==='high-pass')  H=f>=cutoff1?1:0;
      else if(filter==='band-pass')  H=(f>=cutoff1&&f<cutoff2)?1:0;
      else if(filter==='band-stop')  H=(f>=cutoff1&&f<cutoff2)?0:1;
      else if(filter==='gaussian-smooth') H=Math.exp(-f*f/(2*cutoff1*cutoff1));
      reF[k]*=H; imF[k]*=H;
    }
    this._filtered=idft(reF,imF);
    this._reF=reF; this._imF=imF;
    this._dirty=false;
  }

  reset(){}
  update(){}
  onParamChange(id){
    if(id==='signal'||id==='_preset') this.params.signalExpr=`sign(sin(2*pi*4*t))`; // reset
    this._computeSignal(); this._dirty=true;
  }

  render(ctx,canvas){
    this._computeSignal();
    const W=canvas.width,H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    const v=this.params.view;
    if(v==='split')       this._renderSplit(ctx,W,H);
    else if(v==='spectrogram') this._renderSpectrogram(ctx,W,H);
    else if(v==='aliasing')    this._renderAliasing(ctx,W,H);
  }

  _drawWave(ctx,data,x0,y0,pw,ph,col,fill=false){
    const N=data.length;
    const mx=Math.max(1e-10,...data.map(Math.abs));
    const tx=i=>x0+(i/N)*pw;
    const ty=v=>y0+ph/2-v/mx*(ph/2-4);
    if(fill){
      ctx.fillStyle=col.replace(')',',0.1)').replace('rgb','rgba');
      ctx.beginPath();ctx.moveTo(tx(0),y0+ph/2);
      for(let i=0;i<N;i++)ctx.lineTo(tx(i),ty(data[i]));
      ctx.lineTo(tx(N-1),y0+ph/2);ctx.closePath();ctx.fill();
    }
    ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(tx(0),ty(data[0]));
    for(let i=1;i<N;i++)ctx.lineTo(tx(i),ty(data[i]));
    ctx.stroke();
    // Zero line
    ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.moveTo(x0,y0+ph/2);ctx.lineTo(x0+pw,y0+ph/2);ctx.stroke();
  }

  _drawSpectrum(ctx,re,im,x0,y0,pw,ph,col,showPhase=false){
    const N=re.length, half=Math.floor(N/2);
    const amps=Array.from({length:half},(_,k)=>Math.sqrt(re[k]*re[k]+im[k]*im[k]));
    const mx=Math.max(1e-10,...amps);
    const bw=pw/half;
    ctx.fillStyle=col;
    for(let k=0;k<half;k++){
      const h=(amps[k]/mx)*(ph-4);
      ctx.fillRect(x0+k*bw,y0+ph-h,Math.max(1,bw-1),h);
    }
    ctx.strokeStyle='rgba(0,0,0,0.1)';ctx.lineWidth=0.5;
    ctx.beginPath();ctx.moveTo(x0,y0+ph);ctx.lineTo(x0+pw,y0+ph);ctx.stroke();
  }

  _renderSplit(ctx,W,H){
    const pad=10,gap=8,nRows=3;
    const rH=Math.floor((H-pad*2-gap*(nRows-1))/nRows)-22;
    const pW=W-80;
    const rows=[pad, pad+rH+22+gap, pad+(rH+22+gap)*2];
    const labels=['Original x(t)','Spectrum |X[k]| (freq domain)','Filtered x̂(t) after '+this.params.filter];
    const cols=['#1a4fa8','#1a6b1a','#c42020'];
    this._drawWave(ctx,this._x,       60,rows[0],pW,rH,cols[0],true);
    this._drawSpectrum(ctx,this._re,this._im,60,rows[1],pW,rH,cols[1]+'88');
    this._drawWave(ctx,this._filtered,60,rows[2],pW,rH,cols[2],true);
    // Filter response overlay on spectrum
    const N=this.N,half=Math.floor(N/2),{filter,cutoff1,cutoff2}=this.params;
    ctx.strokeStyle='rgba(200,100,0,0.7)';ctx.lineWidth=2;ctx.setLineDash([4,3]);
    ctx.beginPath();
    for(let k=0;k<half;k++){
      const f=k; let H2=1;
      if(filter==='low-pass')    H2=f<cutoff1?1:0.02;
      else if(filter==='high-pass')  H2=f>=cutoff1?1:0.02;
      else if(filter==='band-pass')  H2=(f>=cutoff1&&f<cutoff2)?1:0.02;
      else if(filter==='band-stop')  H2=(f>=cutoff1&&f<cutoff2)?0.02:1;
      else if(filter==='gaussian-smooth') H2=Math.exp(-f*f/(2*cutoff1*cutoff1));
      const x=60+(k/half)*pW, y=rows[1]+rH*(1-H2*0.9)-4;
      k===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();ctx.setLineDash([]);
    rows.forEach((r,i)=>label(ctx,labels[i],62,r+2,{color:cols[i],size:10}));
    label(ctx,`${this.params.signal}  N=${this.N}`,8,8,{color:'#333',size:11,bg:'rgba(255,255,255,0.88)'});
    label(ctx,'Orange dashed: filter response H[k]',62,rows[1]+rH-2,{color:'#b06000',size:9});
  }

  _renderSpectrogram(ctx,W,H){
    // Time-frequency: sliding window DFT
    const N=this.N,winSize=32,hop=2;
    const cols=Math.floor((N-winSize)/hop);
    const freqBins=Math.floor(winSize/2);
    const imgd=ctx.createImageData(cols,freqBins);
    const data=imgd.data;
    let gMax=0;
    const grid=[];
    for(let c=0;c<cols;c++){
      const win=new Float64Array(winSize);
      for(let i=0;i<winSize;i++){
        const idx=c*hop+i;
        win[i]=this._x[idx]*(0.5-0.5*Math.cos(2*Math.PI*i/winSize)); // Hann window
      }
      const{re,im}=dft(win);
      const row=Array.from({length:freqBins},(_,k)=>Math.sqrt(re[k]*re[k]+im[k]*im[k]));
      grid.push(row);
      const m=Math.max(...row);if(m>gMax)gMax=m;
    }
    for(let c=0;c<cols;c++)for(let f=0;f<freqBins;f++){
      const t=Math.pow(grid[c][f]/(gMax||1),0.5);
      const[r,g,b]=sampleCM_local(t);
      const p=((freqBins-1-f)*cols+c)*4;
      data[p]=r;data[p+1]=g;data[p+2]=b;data[p+3]=255;
    }
    const tmp=document.createElement('canvas');tmp.width=cols;tmp.height=freqBins;
    tmp.getContext('2d').putImageData(imgd,0,0);
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(tmp,50,30,W-60,H-60);
    ctx.fillStyle='#555';ctx.font='11px Courier New';
    ctx.textAlign='center';ctx.fillText('time →',W/2,H-10);
    ctx.save();ctx.translate(14,H/2);ctx.rotate(-Math.PI/2);
    ctx.textAlign='center';ctx.fillText('frequency ↑',0,0);ctx.restore();
    label(ctx,`Spectrogram: ${this.params.signal}`,8,8,{color:'#333',size:12,bg:'rgba(255,255,255,0.9)'});
  }

  _renderAliasing(ctx,W,H){
    const N=512, aliasN=Math.round(this.params.aliasN);
    // Dense signal
    const dense=Array.from({length:N},(_,i)=>this._evalSignal(i/N));
    // Undersampled
    const sparse=Array.from({length:aliasN},(_,i)=>this._evalSignal(i/aliasN));
    const pad=48,pw=W-2*pad,ph=(H-2*pad-30)/2;
    // Draw dense
    this._drawWave(ctx,new Float64Array(dense),pad,pad,pw,ph,'#1a4fa8',false);
    // Draw sparse samples as dots
    ctx.fillStyle='#c42020';
    for(let i=0;i<sparse.length;i++){
      const sx=pad+(i/aliasN)*pw;
      const sy=pad+ph/2-sparse[i]/Math.max(1e-10,...dense.map(Math.abs))*(ph/2-4);
      ctx.beginPath();ctx.arc(sx,sy,4,0,Math.PI*2);ctx.fill();
    }
    // Reconstructed (connect dots)
    ctx.strokeStyle='rgba(200,20,20,0.5)';ctx.lineWidth=1.5;ctx.lineJoin='round';
    ctx.beginPath();
    for(let i=0;i<sparse.length;i++){
      const sx=pad+(i/aliasN)*pw;
      const sy=pad+ph/2-sparse[i]/Math.max(1e-10,...dense.map(Math.abs))*(ph/2-4);
      i===0?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);
    }
    ctx.stroke();
    label(ctx,`Blue: true signal (N=${N})   Red: sampled at n=${aliasN}`,pad,pad-4,{color:'#333',size:11,bg:'rgba(255,255,255,0.88)'});
    const nyquist=aliasN/2;
    label(ctx,`Nyquist: can recover frequencies up to ${nyquist} Hz only`,pad,H/2+10,{color:'#888',size:10});
    label(ctx,`${this.params.signal}  |  Decrease "samples" to see aliasing`,pad,H-16,{color:'#888',size:10});
  }

  coordInfo(){ return `N=${this.N} samples  |  Nyquist freq=${this.N/2} Hz`; }
}

// Local simple colormap for spectrogram (plasma-ish)
function sampleCM_local(t){
  const r=Math.round(Math.min(255,t*3*255));
  const g=Math.round(Math.max(0,Math.min(255,(t*3-1)*255)));
  const b=Math.round(Math.max(0,Math.min(255,(1-t*2)*180)));
  return[r,g,b];
}
