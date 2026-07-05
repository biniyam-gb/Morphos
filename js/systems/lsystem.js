
// L-Systems — Lindenmayer formal grammars
import { clearCanvas, label } from '../plot.js';
import { cmCSS } from '../colormap.js';

export class LSystem {
  constructor(W,H){
    this.canvasW=W; this.canvasH=H;
    this._lines=[]; this._dirty=true;
    this.params={
      axiom:'X', rules:'X -> F+[[X]-X]-F[-FX]+X\nF -> FF',
      angle:25, iterations:6, lengthScale:1.0, strokeWidth:1.0,
      colorMode:'depth', colormap:'viridis',
    };
    this.paramDefs=[
      { group:'Grammar', items:[
        { id:'axiom',       label:'Axiom',           type:'code', tip:'Starting string.' },
        { id:'rules',       label:'Production rules', type:'textarea', tip:'One per line: A -> expansion. F=draw, +=turn left, -=turn right, []=push/pop.' },
        { id:'angle',       label:'Angle (°)', min:1,max:180,step:0.5, type:'range' },
        { id:'iterations',  label:'Iterations', min:1,max:12,step:1, type:'range', tip:'Exponential growth — careful above 8.' },
      ]},
      { group:'Style', items:[
        { id:'lengthScale', label:'Length scale', min:0.05,max:3,step:0.05, type:'range' },
        { id:'strokeWidth', label:'Stroke width',  min:0.1,max:4,step:0.1, type:'range' },
        { id:'colorMode',   label:'Color by', type:'select', options:['depth','sequence','angle','solid'] },
        { id:'colormap',    label:'Color map', type:'colormap' },
      ]},
    ];
    this.presets=[
      {id:'plant',   name:'🌿 Plant',          params:{axiom:'X',rules:'X -> F+[[X]-X]-F[-FX]+X\nF -> FF',angle:25,iterations:6,colormap:'viridis',colorMode:'depth'}},
      {id:'dragon',  name:'Dragon Curve',       params:{axiom:'F',rules:'F -> F+G\nG -> F-G',angle:90,iterations:13,colormap:'plasma',colorMode:'sequence'}},
      {id:'sierp',   name:'Sierpiński Triangle',params:{axiom:'F-G-G',rules:'F -> F-G+F+G-F\nG -> GG',angle:120,iterations:7,colormap:'hot',colorMode:'depth'}},
      {id:'koch',    name:'Koch Snowflake',     params:{axiom:'F--F--F',rules:'F -> F+F--F+F',angle:60,iterations:5,colormap:'coolwarm',colorMode:'sequence'}},
      {id:'hilbert', name:'Hilbert Curve',      params:{axiom:'X',rules:'X -> -YF+XFX+FY-\nY -> +XF-YFY-FX+',angle:90,iterations:7,colormap:'inferno',colorMode:'sequence'}},
      {id:'levy',    name:'Lévy C Curve',       params:{axiom:'F',rules:'F -> +F--F+',angle:45,iterations:14,colormap:'viridis',colorMode:'sequence'}},
      {id:'bush',    name:'Bush',               params:{axiom:'F',rules:'F -> F[+F]F[-F]F',angle:25.7,iterations:5,colormap:'viridis',colorMode:'depth'}},
      {id:'gosper',  name:'Gosper / Flowsnake', params:{axiom:'F',rules:'F -> F-G--G+F++FF+G-\nG -> +F-GG--G-F++F+G',angle:60,iterations:5,colormap:'plasma',colorMode:'sequence'}},
    ];
    this.domain='Formal Systems';
    this.stepsPerFrame=0;
    this._rebuild();
  }

  getFormula(){ return `Iterations: ${this.params.iterations}  |  Angle: ${this.params.angle}°  |  Length: ${this.params.lengthScale}`; }
  get description(){ return 'Formal rewriting systems interpreted as turtle graphics. Models plant branching, fractals, space-filling curves. F=forward, +=turn left, -=turn right, []=branch.'; }

  _parseRules(src){
    const m={};
    for(const line of src.split('\n')){
      const mm=line.match(/^([A-Za-z])\s*[-=>\u2192]+\s*(.+)$/);
      if(mm) m[mm[1].trim()]=mm[2].trim();
    }
    return m;
  }

  _expand(axiom,rules,n){
    let s=axiom.replace(/\s/g,'');
    for(let i=0;i<n;i++){
      let next=''; for(const c of s) next+=rules[c]||c;
      s=next; if(s.length>600000)break;
    }
    return s;
  }

  _turtle(str,angleDeg,baseLen){
    const lines=[]; const stack=[]; const ang=angleDeg*Math.PI/180;
    let x=0,y=0,dir=-Math.PI/2,depth=0,seq=0,len=baseLen;
    for(const c of str){
      if(c==='F'||c==='G'){ const nx=x+Math.cos(dir)*len,ny=y+Math.sin(dir)*len; lines.push({x1:x,y1:y,x2:nx,y2:ny,depth,seq,dir}); x=nx;y=ny;seq++; }
      else if(c==='f'){x+=Math.cos(dir)*len;y+=Math.sin(dir)*len;}
      else if(c==='+')dir+=ang; else if(c==='-')dir-=ang;
      else if(c==='['){stack.push({x,y,dir,depth,len});depth++;}
      else if(c===']'){if(stack.length)({x,y,dir,depth,len}=stack.pop());}
      else if(c==='<')len*=0.8; else if(c==='>')len*=1.25;
    }
    return lines;
  }

  _rebuild(){
    const{axiom,rules:rs,angle,iterations,lengthScale}=this.params;
    const rules=this._parseRules(rs);
    const str=this._expand(axiom,rules,iterations);
    this._lines=this._turtle(str,angle,10*lengthScale);
    this._dirty=false;
  }

  reset(){this._dirty=true;this._rebuild();}
  update(){}
  onParamChange(id){this._dirty=true;this._rebuild();}

  render(ctx,canvas){
    if(this._dirty)this._rebuild();
    const{colormap,strokeWidth,colorMode}=this.params;
    const lines=this._lines;
    clearCanvas(ctx,canvas.width,canvas.height,'#fff');
    if(!lines.length)return;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const l of lines){
      if(l.x1<minX)minX=l.x1;if(l.x2<minX)minX=l.x2;if(l.y1<minY)minY=l.y1;if(l.y2<minY)minY=l.y2;
      if(l.x1>maxX)maxX=l.x1;if(l.x2>maxX)maxX=l.x2;if(l.y1>maxY)maxY=l.y1;if(l.y2>maxY)maxY=l.y2;
    }
    const W=canvas.width,H=canvas.height,pad=36;
    const sc=Math.min((W-2*pad)/(maxX-minX||1),(H-2*pad)/(maxY-minY||1));
    const ox=pad+(W-2*pad-(maxX-minX)*sc)/2,oy=pad+(H-2*pad-(maxY-minY)*sc)/2;
    const tx=x=>(x-minX)*sc+ox, ty=y=>(y-minY)*sc+oy;
    const maxDepth=Math.max(...lines.map(l=>l.depth))||1, maxSeq=lines.length||1;
    ctx.lineWidth=strokeWidth; ctx.lineCap='round';
    for(const l of lines){
      const t=colorMode==='depth'?l.depth/maxDepth:colorMode==='sequence'?l.seq/maxSeq:colorMode==='angle'?((l.dir%(Math.PI*2))/(Math.PI*2)+1)%1:0.6;
      ctx.strokeStyle=cmCSS(colormap,t);
      ctx.beginPath();ctx.moveTo(tx(l.x1),ty(l.y1));ctx.lineTo(tx(l.x2),ty(l.y2));ctx.stroke();
    }
    label(ctx,`${lines.length.toLocaleString()} segments`,8,8,{color:'#555',size:11,bg:'rgba(255,255,255,0.85)'});
  }

  coordInfo(){return `L-System: ${this._lines.length} segments generated`;}
}
