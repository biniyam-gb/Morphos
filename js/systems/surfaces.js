
// Parametric Surfaces & Topology — 3D rendering on 2D canvas
import { clearCanvas, label } from '../plot.js';

const SURFACES = {
  'Torus': {
    fn:(u,v)=>{const R=2,r=0.8,cu=Math.cos(u),su=Math.sin(u),cv=Math.cos(v),sv=Math.sin(v);return[(R+r*cv)*cu,(R+r*cv)*su,r*sv];},
    uRange:[0,Math.PI*2], vRange:[0,Math.PI*2], uSteps:60, vSteps:30,
    desc:'Genus-1 surface. Euler characteristic χ=0. Homeomorphic to S¹×S¹. Fundamental group: Z×Z.',
  },
  'Sphere': {
    fn:(u,v)=>{const cu=Math.cos(u),su=Math.sin(u),cv=Math.cos(v),sv=Math.sin(v);return[sv*cu,sv*su,cv];},
    uRange:[0,Math.PI*2], vRange:[0,Math.PI], uSteps:40, vSteps:20,
    desc:'Genus-0 surface. χ=2. Simply connected. Every loop contracts to a point. Hairy Ball theorem: no nonvanishing tangent field.',
  },
  'Möbius Strip': {
    fn:(u,v)=>{const h=v-0.5,a=u/2,R=2;return[(R+h*Math.cos(a))*Math.cos(u),(R+h*Math.cos(a))*Math.sin(u),h*Math.sin(a)];},
    uRange:[0,Math.PI*2], vRange:[0,1], uSteps:80, vSteps:8,
    desc:'Non-orientable surface with one side and one edge. Cannot be embedded in R³ without self-intersection. χ=0.',
  },
  'Klein Bottle': {
    fn:(u,v)=>{
      const a=u<Math.PI?1:-1;
      const x=(2.5+Math.cos(u/2)*Math.sin(v)-Math.sin(u/2)*Math.sin(2*v))*Math.cos(u);
      const y=(2.5+Math.cos(u/2)*Math.sin(v)-Math.sin(u/2)*Math.sin(2*v))*Math.sin(u);
      const z=Math.sin(u/2)*Math.sin(v)+Math.cos(u/2)*Math.sin(2*v);
      return[x*0.4,y*0.4,z*0.4];
    },
    uRange:[0,Math.PI*2], vRange:[0,Math.PI*2], uSteps:60, vSteps:30,
    desc:'Non-orientable closed surface. No boundary. Cannot be embedded in R³ (self-intersects). χ=0. Requires 4D for true embedding.',
  },
  'Boy\'s Surface': {
    fn:(u,v)=>{
      const cu=Math.cos(u),su=Math.sin(u),cv=Math.cos(v),sv=Math.sin(v),cv2=Math.cos(2*v),sv2=Math.sin(2*v);
      const x=(Math.sqrt(2)*cu*cu*cv2+cu*sv2)*2/(2-Math.sqrt(2)*Math.sin(3*u)*sv2);
      const y=(Math.sqrt(2)*su*cu*cv2-su*sv2)*2/(2-Math.sqrt(2)*Math.sin(3*u)*sv2)||0;
      const z=(3*cu*cu)/(2-Math.sqrt(2)*Math.sin(3*u)*sv2)||0;
      return[isFinite(x)?x*0.4:0,isFinite(y)?y*0.4:0,isFinite(z)?z*0.4:0];
    },
    uRange:[0,Math.PI], vRange:[0,Math.PI*2], uSteps:40, vSteps:40,
    desc:'A real projective plane immersion in R³. Non-orientable, no self-intersections except along a curve. χ=1.',
  },
  'Trefoil Knot Tube': {
    fn:(u,v)=>{
      const t=u; const r=0.25;
      const kx=(Math.sin(t)+2*Math.sin(2*t));
      const ky=(Math.cos(t)-2*Math.cos(2*t));
      const kz=-Math.sin(3*t);
      const mag=Math.sqrt(kx*kx+ky*ky+kz*kz)||1;
      const tx=-kx/mag,ty=-ky/mag,tz=-kz/mag;
      const bx=ky*0-kz*0,by=kz*1-0,bz=0-ky*1;
      const bn=Math.sqrt(bx*bx+by*by+bz*bz)||1;
      const nx=ty*bz/bn-tz*by/bn, ny=tz*bx/bn-tx*bz/bn, nz=tx*by/bn-ty*bx/bn;
      const cv=Math.cos(v),sv=Math.sin(v);
      return[kx*0.4+r*(nx*cv+bx/bn*sv)*1.5, ky*0.4+r*(ny*cv+by/bn*sv)*1.5, kz*0.4+r*(nz*cv+bz/bn*sv)*1.5];
    },
    uRange:[0,Math.PI*2], vRange:[0,Math.PI*2], uSteps:120, vSteps:12,
    desc:'Trefoil knot (simplest non-trivial knot) thickened into a torus. Knot group: ⟨a,b | a²=b³⟩. Genus-1 fiber surface.',
  },
  'Enneper Surface': {
    fn:(u,v)=>{return[u-u*u*u/3+u*v*v, v-v*v*v/3+v*u*u, u*u-v*v];},
    uRange:[-1.2,1.2], vRange:[-1.2,1.2], uSteps:40, vSteps:40,
    desc:'Minimal surface (mean curvature H=0 everywhere). Self-intersects. Found by Enneper (1864) via Weierstrass representation.',
  },
  'Catenoid': {
    fn:(u,v)=>{return[Math.cosh(u)*Math.cos(v),Math.cosh(u)*Math.sin(v),u];},
    uRange:[-1.5,1.5], vRange:[0,Math.PI*2], uSteps:30, vSteps:40,
    desc:'Minimal surface of revolution. Soap film between two rings. Isometric to helicoid (they share the same first fundamental form).',
  },
};

function project(x,y,z,rx,ry,W,H){
  // Rotate around Y then X
  const cy=Math.cos(ry),sy=Math.sin(ry);
  const x2=x*cy+z*sy, z2=-x*sy+z*cy;
  const cx=Math.cos(rx),sx=Math.sin(rx);
  const y3=y*cx-z2*sx, z3=y*sx+z2*cx;
  const f=300/(z3+6);
  return[W/2+x2*f,H/2-y3*f,z3];
}

export class Surfaces {
  constructor(W,H){
    this.canvasW=W; this.canvasH=H;
    this.params={ surface:'Torus', colorMode:'normal', showWire:true, showFill:true, rotX:0.4, rotY:0.5, autoRotate:true, rotSpeed:0.008 };
    this.paramDefs=[
      { group:'Surface', items:[
        { id:'surface', label:'Surface', type:'select', options:Object.keys(SURFACES),
          tip:'Choose a parametric surface or topological object.' },
      ]},
      { group:'Render', items:[
        { id:'colorMode', label:'Coloring', type:'select', options:['normal','uv','depth','curvature'] },
        { id:'showFill',  label:'Filled faces',    type:'toggle' },
        { id:'showWire',  label:'Wireframe',        type:'toggle' },
        { id:'autoRotate',label:'Auto-rotate',      type:'toggle' },
        { id:'rotSpeed',  label:'Rotation speed', min:0,max:0.04,step:0.002, type:'range' },
      ]},
      { group:'View (drag to rotate)', items:[
        { id:'rotX', label:'Tilt X', min:-Math.PI,max:Math.PI,step:0.01, type:'range' },
        { id:'rotY', label:'Spin Y', min:-Math.PI,max:Math.PI,step:0.01, type:'range' },
      ]},
    ];
    this.presets=Object.keys(SURFACES).map(k=>({id:k,name:k,params:{surface:k}}));
    this.domain='Topology';
    this.stepsPerFrame=1;
    this._drag=null;
  }

  getFormula(){ return SURFACES[this.params.surface]?.desc?.split('.')[0]||this.params.surface; }
  get description(){ return SURFACES[this.params.surface]?.desc||''; }
  reset(){ this.params.rotX=0.4; this.params.rotY=0.5; }
  onParamChange(){}
  onMouseDown(cx,cy){}
  onMouseDrag(ddx,ddy){
    this.params.rotY+=ddx*0.008;
    this.params.rotX+=ddy*0.008;
  }

  update(){
    if(this.params.autoRotate) this.params.rotY+=this.params.rotSpeed;
  }

  render(ctx,canvas){
    const W=canvas.width,H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    const surf=SURFACES[this.params.surface];
    if(!surf)return;
    const {uRange,vRange,uSteps,vSteps,fn}=surf;
    const {rotX,rotY,showWire,showFill,colorMode}=this.params;
    const [u0,u1]=uRange,[v0,v1]=vRange;

    // Build mesh
    const pts=[];
    for(let i=0;i<=uSteps;i++){
      const row=[];
      for(let j=0;j<=vSteps;j++){
        const u=u0+(u1-u0)*i/uSteps;
        const v=v0+(v1-v0)*j/vSteps;
        const [x,y,z]=fn(u,v);
        const [px,py,pz]=project(x,y,z,rotX,rotY,W,H);
        row.push({px,py,pz,u:i/uSteps,v:j/vSteps,x,y,z});
      }
      pts.push(row);
    }

    // Collect & sort faces by depth
    const faces=[];
    for(let i=0;i<uSteps;i++){
      for(let j=0;j<vSteps;j++){
        const a=pts[i][j],b=pts[i+1][j],c=pts[i+1][j+1],d=pts[i][j+1];
        const depth=(a.pz+b.pz+c.pz+d.pz)/4;
        // Normal
        const ax=b.px-a.px,ay=b.py-a.py,bx=d.px-a.px,by=d.py-a.py;
        const nz=ax*by-ay*bx;
        faces.push({a,b,c,d,depth,nz,i,j});
      }
    }
    faces.sort((a,b)=>b.depth-a.depth);

    const maxZ=Math.max(...faces.map(f=>f.depth)),minZ=Math.min(...faces.map(f=>f.depth));

    for(const {a,b,c,d,depth,nz,i,j} of faces){
      if(showFill){
        let col;
        const t=(depth-minZ)/(maxZ-minZ||1);
        const lit=Math.max(0,Math.min(1,nz/1000+0.5));
        if(colorMode==='depth'){ col=`hsl(${200+t*120},60%,${30+lit*40}%)`; }
        else if(colorMode==='uv'){ col=`hsl(${a.u*360},60%,${30+a.v*35}%)`; }
        else if(colorMode==='normal'){ const h=(Math.atan2(nz,1000)/(Math.PI)+0.5)*240; col=`hsl(${h},55%,${35+lit*30}%)`; }
        else { col=`hsl(200,50%,${35+lit*35}%)`; }
        ctx.fillStyle=col;
        ctx.beginPath();
        ctx.moveTo(a.px,a.py); ctx.lineTo(b.px,b.py); ctx.lineTo(c.px,c.py); ctx.lineTo(d.px,d.py);
        ctx.closePath(); ctx.fill();
      }
      if(showWire&&(i%4===0||j%4===0)){
        ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=0.4;
        ctx.beginPath();
        ctx.moveTo(a.px,a.py); ctx.lineTo(b.px,b.py); ctx.lineTo(c.px,c.py); ctx.lineTo(d.px,d.py);
        ctx.closePath(); ctx.stroke();
      }
    }

    label(ctx,this.params.surface,8,8,{color:'#333',size:13,bg:'rgba(255,255,255,0.88)'});
    label(ctx,SURFACES[this.params.surface]?.desc?.split('.')[0]||'',8,26,{color:'#555',size:10,bg:'rgba(255,255,255,0.82)'});
    label(ctx,'Drag to rotate',8,H-16,{color:'#888',size:10});
  }

  coordInfo(){ return `rotX=${this.params.rotX.toFixed(2)}  rotY=${this.params.rotY.toFixed(2)}`; }
}
