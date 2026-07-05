
import { hsv2rgb } from '../colormap.js';
import { Viewport, clearCanvas, label } from '../plot.js';

const MATH = `"use strict";const {sin,cos,tan,exp,log,sqrt,abs,pow,atan,atan2,sinh,cosh,tanh,sign,floor,ceil,min,max,PI,E}=Math;const pi=PI,e=E;`;

// Built-in presets: fast (re,im)→{r,i}
const FNS = {
  'z':               (r,i)=>({r,i}),
  'z²':              (r,i)=>({r:r*r-i*i,i:2*r*i}),
  'z³':              (r,i)=>({r:r*(r*r-3*i*i),i:i*(3*r*r-i*i)}),
  'z⁴ − 1':         (r,i)=>{const r2=r*r-i*i,i2=2*r*i,r4=r2*r2-i2*i2,i4=2*r2*i2;return{r:r4-1,i:i4};},
  '1/z':             (r,i)=>{const d=r*r+i*i;return{r:r/d,i:-i/d};},
  '(z−1)/(z+1)':    (r,i)=>{const ar=r-1,br=r+1;const d=br*br+i*i;return{r:(ar*br+i*i)/d,i:(i*br-ar*i)/d};},
  '(z²+1)/(z²−1)':  (r,i)=>{const nr=r*r-i*i+1,ni=2*r*i,dr=r*r-i*i-1,di=2*r*i;const d=dr*dr+di*di;return d<1e-14?{r:Infinity,i:0}:{r:(nr*dr+ni*di)/d,i:(ni*dr-nr*di)/d};},
  'eᶻ':             (r,i)=>{const e=Math.exp(r);return{r:e*Math.cos(i),i:e*Math.sin(i)};},
  'sin(z)':          (r,i)=>({r:Math.sin(r)*Math.cosh(i),i:Math.cos(r)*Math.sinh(i)}),
  'cos(z)':          (r,i)=>({r:Math.cos(r)*Math.cosh(i),i:-Math.sin(r)*Math.sinh(i)}),
  'tan(z)':          (r,i)=>{const sr=Math.sin(r),cr=Math.cos(r),sh=Math.sinh(i),ch=Math.cosh(i);const d=cr*cr*ch*ch+sr*sr*sh*sh||1e-14;return{r:(sr*cr*ch*ch+sr*cr*sh*sh)/d,i:(sh*ch)/(d)};},
  'log(z)':          (r,i)=>({r:0.5*Math.log(r*r+i*i),i:Math.atan2(i,r)}),
  '√z':              (r,i)=>{const m=Math.sqrt(Math.sqrt(r*r+i*i)),a=Math.atan2(i,r)/2;return{r:m*Math.cos(a),i:m*Math.sin(a)};},
  'z^z':             (r,i)=>{const lr=0.5*Math.log(r*r+i*i),la=Math.atan2(i,r),wr=r*lr-i*la,wi=r*la+i*lr;const e2=Math.exp(wr);return{r:e2*Math.cos(wi),i:e2*Math.sin(wi)};},
  'e^(1/z)':         (r,i)=>{const d=r*r+i*i;if(d<1e-14)return{r:Infinity,i:0};const e2=Math.exp(r/d);return{r:e2*Math.cos(-i/d),i:e2*Math.sin(-i/d)};},
  'sin(1/z)':        (r,i)=>{const d=r*r+i*i;if(d<1e-14)return{r:0,i:0};const ur=r/d,ui=-i/d;return{r:Math.sin(ur)*Math.cosh(ui),i:Math.cos(ur)*Math.sinh(ui)};},
  'sin(z)/z':        (r,i)=>{const sn={r:Math.sin(r)*Math.cosh(i),i:Math.cos(r)*Math.sinh(i)};const d=r*r+i*i;if(d<1e-14)return{r:1,i:0};return{r:(sn.r*r+sn.i*i)/d,i:(sn.i*r-sn.r*i)/d};},
  'Newton z³−1':     (r,i)=>{const r2=r*r-i*i,i2=2*r*i,r3=r*r2-i*i2,i3=r*i2+i*r2;const d3r=3*r2,d3i=3*i2;const d=d3r*d3r+d3i*d3i||1e-14;const qr=(r3-1)*d3r+i3*d3i,qi=i3*d3r-(r3-1)*d3i;return{r:r-qr/d,i:i-qi/d};},
  'Custom':          null,   // handled by _customFn
};

const DESCS = {
  'z':'Identity map. Hue rotates once around origin. The "reference" coloring.',
  'z²':'Hue rotates twice. Zero at origin (2 sheets). Conformal except at z=0.',
  'z³':'Three-fold symmetry. Phase winds 3× around origin.',
  'z⁴ − 1':'Four roots of unity at ±1,±i. Zeros → hue winds around each.',
  '1/z':'Inversion + conjugation. Pole at origin. Maps circles↔circles.',
  '(z−1)/(z+1)':'Möbius transform. Maps right half-plane to unit disk.',
  '(z²+1)/(z²−1)':'Two zeros ±i, two poles ±1.',
  'eᶻ':'2πi-periodic. Essential singularity at ∞. Surjective onto ℂ\\{0}.',
  'sin(z)':'Zeros at nπ. Conformal everywhere except at those points.',
  'cos(z)':'Zeros at π/2+nπ.',
  'tan(z)':'Simple poles at π/2+nπ. Meromorphic.',
  'log(z)':'Multi-valued. Branch cut on negative real axis.',
  '√z':'Branch cut on negative real axis. Two-sheeted Riemann surface.',
  'z^z':'Essential singularity at 0. Non-trivial winding behavior.',
  'e^(1/z)':'Picard: takes every value (except possibly one) near z=0.',
  'sin(1/z)':'Essential singularity at 0. Infinitely many zeros accumulating at 0.',
  'sin(z)/z':'Removable singularity at 0 (value=1). Zeros at nπ, n≠0.',
  'Newton z³−1':'One Newton step for z³=1. Three basins of attraction with fractal boundary.',
  'Custom':'Edit u(x,y) and v(x,y) below. f(z)=u+iv where z=x+iy.',
};

export class ComplexDomain {
  constructor(W,H){
    this.canvasW=W; this.canvasH=H;
    this.vp=new Viewport(-3,3,-3,3);
    this._dirty=true; this._customFn=null;
    this.params={
      fn:'sin(z)',
      uExpr:'x*x - y*y',  // real part for Custom mode
      vExpr:'2*x*y',       // imag part for Custom mode
      contourPhase:true, contourMag:true,
      colorMode:'standard', brightGamma:0.5,
    };
    this.paramDefs=[
      { group:'Function', items:[
        { id:'fn', label:'f(z)', type:'select', options:Object.keys(FNS),
          tip:'Choose a preset, or select "Custom" to write your own.' },
      ]},
      { group:'Custom f(z) = u(x,y) + i·v(x,y)', items:[
        { id:'_guide', type:'hint', html:'Variables: <code>x</code>=Re(z), <code>y</code>=Im(z)<br>Functions: <code>sin cos exp log sqrt abs pow atan2 pi e</code><br>Example z²: <code>u = x*x-y*y</code>, <code>v = 2*x*y</code><br>Check Cauchy-Riemann: ∂u/∂x=∂v/∂y, ∂u/∂y=−∂v/∂x' },
        { id:'uExpr', label:'u(x,y) = Re[f]', type:'code' },
        { id:'vExpr', label:'v(x,y) = Im[f]', type:'code' },
      ]},
      { group:'Coloring', items:[
        { id:'colorMode', label:'Mode', type:'select', options:['standard','phase-only','magnitude-only','checkerboard'] },
        { id:'contourPhase', label:'Phase contours',    type:'toggle' },
        { id:'contourMag',   label:'Modulus contours',  type:'toggle' },
        { id:'brightGamma',  label:'Brightness γ', min:0.1,max:2.0,step:0.05, type:'range' },
      ]},
      { group:'View', items:[
        { id:'_zin',   label:'Zoom In',   type:'button' },
        { id:'_zout',  label:'Zoom Out',  type:'button' },
        { id:'_reset', label:'Reset View',type:'button' },
      ]},
    ];
    this.presets=Object.keys(FNS).map(k=>({id:k,name:k,params:{fn:k}}));
    this.domain='Complex Analysis';
    this.description=DESCS['sin(z)'];
    this.formula='f(z) = sin(z)';
    this.stepsPerFrame=0;
  }

  getFormula(){ return `f(z) = ${this.params.fn==='Custom'?`(${this.params.uExpr}) + i(${this.params.vExpr})`:this.params.fn}`; }

  _compileCustom(){
    try{
      const fu=new Function('x','y',MATH+`return (${this.params.uExpr});`);
      const fv=new Function('x','y',MATH+`return (${this.params.vExpr});`);
      this._customFn=(r,i)=>{
        try{const rv=fu(r,i),iv=fv(r,i);return{r:isFinite(rv)?rv:0,i:isFinite(iv)?iv:0};}
        catch(e){return{r:0,i:0};}
      };
    }catch(e){this._customFn=null;}
  }

  reset(){ this._dirty=true; }
  update(){}

  onParamChange(id){
    if(id==='fn'){this.description=DESCS[this.params.fn]||'';}
    if(id==='_zin')    this.vp.zoom(0.5,this.canvasW/2,this.canvasH/2,this.canvasW,this.canvasH);
    if(id==='_zout')   this.vp.zoom(2.0,this.canvasW/2,this.canvasH/2,this.canvasW,this.canvasH);
    if(id==='_reset')  this.vp=new Viewport(-3,3,-3,3);
    if(id==='uExpr'||id==='vExpr') this._compileCustom();
    this._dirty=true;
  }

  onClick(cx,cy,W,H,e){ if(e?.detail===2){this.vp.zoom(0.25,cx,cy,W,H);this._dirty=true;} }
  onDblClick(cx,cy,W,H){ this.vp.zoom(0.25,cx,cy,W,H); this._dirty=true; }
  onMouseDrag(ddx,ddy,cx,cy,W,H){ this.vp.pan(ddx,ddy,W,H); this._dirty=true; }
  onWheel(cx,cy,delta,W,H){ this.vp.zoom(delta>0?1.3:0.77,cx,cy,W,H); this._dirty=true; }

  render(ctx,canvas){
    if(!this._dirty)return; this._dirty=false;
    const W=canvas.width,H=canvas.height;
    const{fn,contourPhase,contourMag,colorMode,brightGamma}=this.params;
    let func=FNS[fn];
    if(fn==='Custom'){
      if(!this._customFn)this._compileCustom();
      func=this._customFn;
    }
    if(!func){clearCanvas(ctx,W,H,'#fff');label(ctx,'Expression error',8,8,{color:'#c42020',size:13});return;}

    const RS = 0.42;
    const rW = Math.max(60, Math.floor(W * RS)), rH = Math.max(60, Math.floor(H * RS));
    const imgd = ctx.createImageData(rW, rH);
    const data = imgd.data;
    const vp = this.vp;
    for (let py = 0; py < rH; py++) {
      for (let px = 0; px < rW; px++) {
        const [re, im] = vp.toWorld(px * W / rW, py * H / rH, W, H);
        const { r: fr, i: fi } = func(re, im);
        if (!isFinite(fr) || !isFinite(fi)) {
          const p = (py * rW + px) * 4; data[p] = 20; data[p+1] = 20; data[p+2] = 20; data[p+3] = 255; continue;
        }
        const phase=Math.atan2(fi,fr);
        const mag=Math.sqrt(fr*fr+fi*fi);
        const hue=phase/(2*Math.PI)+0.5;
        let sat=1,v=1;
        if(colorMode==='standard'){
          const logM=mag>0?Math.log(mag):-20;
          const b=Math.pow(0.5*(1+Math.sin(logM*Math.PI/Math.log(2))),brightGamma);
          v=isFinite(b)?Math.max(0.1,Math.min(1,b)):0.1;
        } else if(colorMode==='magnitude-only'){
          const logM=mag>0?Math.log2(mag):-10;
          v=0.5+0.5*Math.sin(logM*Math.PI); sat=0;
        } else if(colorMode==='checkerboard'){
          v=0.85; sat=0.7;
          const cu=Math.floor(re*2)%2===0,cv=Math.floor(im*2)%2===0;
          if(cu!==cv){v=0.55;}
        }
        let[r,g,b]=hsv2rgb(hue,sat,v);
        if(contourPhase){const n=12,t=((phase/(2*Math.PI)+1)%1)*n;if(t-Math.floor(t)<0.06){r=r*.35;g=g*.35;b=b*.35;}}
        if(contourMag&&mag>0){const logM=Math.log2(mag),t=logM-Math.floor(logM);if(t<0.07||t>0.93){r=r*.35;g=g*.35;b=b*.35;}}
        const p=(py*rW+px)*4;data[p]=r;data[p+1]=g;data[p+2]=b;data[p+3]=255;
      }
    }
    const tmp=document.createElement('canvas'); tmp.width=rW; tmp.height=rH;
    tmp.getContext('2d').putImageData(imgd,0,0);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='medium';
    ctx.drawImage(tmp,0,0,W,H);
    // Axes
    ctx.save();ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=1;
    const[ox,oy]=vp.toCanvas(0,0,W,H);
    ctx.beginPath();ctx.moveTo(0,oy);ctx.lineTo(W,oy);ctx.stroke();
    ctx.beginPath();ctx.moveTo(ox,0);ctx.lineTo(ox,H);ctx.stroke();
    ctx.restore();
    label(ctx,this.getFormula(),8,8,{color:'rgba(0,0,0,0.85)',size:12,bg:'rgba(255,255,255,0.8)'});
    label(ctx,`Re:[${vp.xMin.toFixed(2)},${vp.xMax.toFixed(2)}] Im:[${vp.yMin.toFixed(2)},${vp.yMax.toFixed(2)}]  dblclick=zoom`,8,H-18,{color:'rgba(0,0,0,0.5)',size:10});
  }

  coordInfo(cx,cy,W,H){
    const[re,im]=this.vp.toWorld(cx,cy,W,H);
    let fn=FNS[this.params.fn];
    if(this.params.fn==='Custom')fn=this._customFn;
    if(!fn)return`z=${re.toFixed(4)}+${im.toFixed(4)}i`;
    const{r:fr,i:fi}=fn(re,im);
    const mag=Math.sqrt(fr*fr+fi*fi),arg=Math.atan2(fi,fr);
    return`z=${re.toFixed(3)}+${im.toFixed(3)}i  →  |f|=${mag.toFixed(3)} arg=${(arg*180/Math.PI).toFixed(1)}°`;
  }
}
