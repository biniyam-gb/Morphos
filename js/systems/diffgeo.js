
// Differential Geometry — Space curves, Frenet-Serret frame, curvature & torsion
import { clearCanvas, label } from '../plot.js';

const MATH=`"use strict";const{sin,cos,tan,exp,log,sqrt,abs,pow,atan,atan2,sinh,cosh,sign,floor,ceil,min,max,PI,E}=Math;const pi=PI,e=E;`;

const CURVE_PRESETS = {
  'Helix':            { x:'cos(t)', y:'sin(t)', z:'0.3*t', tr:[0,6*Math.PI], desc:'Constant curvature κ and torsion τ. κ=1/(1+0.09), τ=0.3/(1+0.09). The "straightest" curve on a cylinder.' },
  'Trefoil Knot':      { x:'sin(t)+2*sin(2*t)', y:'cos(t)-2*cos(2*t)', z:'-sin(3*t)', tr:[0,2*Math.PI], desc:'(2,3) torus knot. Curvature and torsion vary periodically.' },
  'Viviani Curve':      { x:'1+cos(t)', y:'sin(t)', z:'2*sin(t/2)', tr:[0,4*Math.PI], desc:'Intersection of sphere x²+y²+z²=4 and cylinder (x-1)²+y²=1.' },
  'Toroidal Spiral':    { x:'(2+cos(8*t))*cos(t)', y:'(2+cos(8*t))*sin(t)', z:'sin(8*t)', tr:[0,2*Math.PI], desc:'Spiral wrapping around a torus.' },
  'Lissajous 3D':       { x:'sin(3*t)', y:'sin(4*t)', z:'sin(5*t)', tr:[0,2*Math.PI], desc:'3D Lissajous figure — closed if frequency ratios are rational.' },
  'Conical Spiral':     { x:'t*cos(8*t)*0.3', y:'t*sin(8*t)*0.3', z:'t*0.3', tr:[0,6], desc:'Curvature and torsion both decrease with t — approaches a straight line.' },
  'Twisted Cubic':      { x:'t', y:'t*t*0.4', z:'t*t*t*0.1', tr:[-3,3], desc:'Algebraic curve (t,t²,t³). Torsion is constant! (unusual algebraic property)' },
  'Custom':             { x:'cos(t)', y:'sin(t)', z:'0.3*t', tr:[0,6*Math.PI], desc:'Edit x(t),y(t),z(t) below.' },
};

function compile1(expr){ try{return new Function('t',MATH+`return (${expr});`);}catch(e){return null;} }

function project3(x,y,z,rx,ry,scale,W,H) {
  const cy=Math.cos(ry), sy=Math.sin(ry);
  const x2=x*cy+z*sy, z2=-x*sy+z*cy;
  const cx=Math.cos(rx), sx=Math.sin(rx);
  const y3=y*cx-z2*sx, z3=y*sx+z2*cx;
  return [W/2+x2*scale, H/2-y3*scale, z3];
}

export class DiffGeo {
  constructor(W,H) {
    this.canvasW=W; this.canvasH=H;
    this.params = {
      curve: 'Trefoil Knot',
      xExpr:'sin(t)+2*sin(2*t)', yExpr:'cos(t)-2*cos(2*t)', zExpr:'-sin(3*t)',
      tMin:0, tMax:2*Math.PI, steps: 300,
      showFrame: true, frameAt: 0.3,
      showCurvComb: false, colorBy: 'curvature',
      rotX: 0.4, rotY: 0.6, autoRotate: true,
    };
    this.paramDefs = [
      { group: 'Curve r(t) = (x(t),y(t),z(t))', items: [
        { id: 'curve', label: 'Preset', type: 'select', options: Object.keys(CURVE_PRESETS) },
        { id: '_guide', type: 'hint', html: 'Variable: <code>t</code>  |  Functions: <code>sin cos tan exp sqrt pi</code><br>Curvature κ=|r\'×r\'\'|/|r\'|³, Torsion τ=(r\'×r\'\').r\'\'\'/|r\'×r\'\'|²' },
        { id: 'xExpr', label: 'x(t) =', type: 'code' },
        { id: 'yExpr', label: 'y(t) =', type: 'code' },
        { id: 'zExpr', label: 'z(t) =', type: 'code' },
      ]},
      { group: 'Frenet-Serret Frame', items: [
        { id: 'showFrame', label: 'Show T,N,B frame', type: 'toggle', tip: 'Tangent (red), Normal (green), Binormal (blue) — orthonormal moving frame.' },
        { id: 'frameAt', label: 'Frame position (0-1)', min: 0, max: 1, step: 0.005, type: 'range' },
        { id: 'colorBy', label: 'Color curve by', type: 'select', options: ['curvature','torsion','arc-param','solid'] },
      ]},
      { group: 'View', items: [
        { id: 'autoRotate', label: 'Auto-rotate', type: 'toggle' },
        { id: 'rotX', label: 'Tilt', min:-Math.PI,max:Math.PI,step:0.01, type: 'range' },
        { id: 'rotY', label: 'Spin', min:-Math.PI,max:Math.PI,step:0.01, type: 'range' },
      ]},
    ];
    this.presets = Object.keys(CURVE_PRESETS).map(k=>({id:k,name:k,params:{curve:k}}));
    this.domain = 'Differential Geometry';
    this.stepsPerFrame = 1;
    this._loadPreset('Trefoil Knot');
  }

  _loadPreset(name) {
    const p = CURVE_PRESETS[name]; if(!p) return;
    this.params.xExpr=p.x; this.params.yExpr=p.y; this.params.zExpr=p.z;
    this.params.tMin=p.tr[0]; this.params.tMax=p.tr[1];
    this.description = p.desc;
  }

  getFormula() { return `r(t) = (${this.params.xExpr}, ${this.params.yExpr}, ${this.params.zExpr})`; }
  reset() { this.params.rotX=0.4; this.params.rotY=0.6; }
  update() { if (this.params.autoRotate) this.params.rotY += 0.006; }
  onParamChange(id) {
    if (id==='curve'||id==='_preset') this._loadPreset(this.params.curve);
  }
  onMouseDrag(ddx,ddy) { this.params.rotY+=ddx*0.008; this.params.rotX+=ddy*0.008; }

  _evalCurve(t, fx, fy, fz) {
    try { return [fx(t), fy(t), fz(t)]; } catch(e) { return [0,0,0]; }
  }

  _computeGeometry() {
    const { xExpr, yExpr, zExpr, tMin, tMax, steps } = this.params;
    const fx=compile1(xExpr), fy=compile1(yExpr), fz=compile1(zExpr);
    if (!fx||!fy||!fz) return null;
    const h = (tMax-tMin)/steps*0.5;
    const pts = [];
    for (let i=0; i<=steps; i++) {
      const t = tMin + (tMax-tMin)*i/steps;
      const r  = this._evalCurve(t,fx,fy,fz);
      const r1 = this._evalCurve(t+h,fx,fy,fz), rm1 = this._evalCurve(t-h,fx,fy,fz);
      const rp = [(r1[0]-rm1[0])/(2*h),(r1[1]-rm1[1])/(2*h),(r1[2]-rm1[2])/(2*h)];
      const r2 = this._evalCurve(t+2*h,fx,fy,fz);
      const rpp = [(r1[0]-2*r[0]+rm1[0])/(h*h),(r1[1]-2*r[1]+rm1[1])/(h*h),(r1[2]-2*r[2]+rm1[2])/(h*h)];
      // Cross product r' x r''
      const cx = rp[1]*rpp[2]-rp[2]*rpp[1], cy = rp[2]*rpp[0]-rp[0]*rpp[2], cz = rp[0]*rpp[1]-rp[1]*rpp[0];
      const crossMag = Math.sqrt(cx*cx+cy*cy+cz*cz);
      const speedMag = Math.sqrt(rp[0]**2+rp[1]**2+rp[2]**2)||1e-9;
      const curvature = crossMag / (speedMag**3);
      // Tangent, Normal, Binormal
      const T = rp.map(v=>v/speedMag);
      let N = [0,0,0], B = [0,0,0];
      if (crossMag > 1e-9) {
        B = [cx/crossMag, cy/crossMag, cz/crossMag];
        N = [B[1]*T[2]-B[2]*T[1], B[2]*T[0]-B[0]*T[2], B[0]*T[1]-B[1]*T[0]];
      }
      pts.push({ t, r, T, N, B, curvature });
    }
    // Torsion needs 3rd derivative — approximate via curvature change + B rotation
    for (let i=1;i<pts.length-1;i++) {
      const dB = [pts[i+1].B[0]-pts[i-1].B[0], pts[i+1].B[1]-pts[i-1].B[1], pts[i+1].B[2]-pts[i-1].B[2]];
      const dt2 = (tMax-tMin)/steps*2;
      const dBdt = dB.map(v=>v/dt2);
      // dB/dt = -τ N  →  τ = -dB/dt · N
      const tors = -(dBdt[0]*pts[i].N[0]+dBdt[1]*pts[i].N[1]+dBdt[2]*pts[i].N[2]);
      pts[i].torsion = tors;
    }
    pts[0].torsion = pts[1]?.torsion||0;
    pts[pts.length-1].torsion = pts[pts.length-2]?.torsion||0;
    return pts;
  }

  render(ctx, canvas) {
    const W=canvas.width, H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    const pts = this._computeGeometry();
    if (!pts) { label(ctx,'Expression error',W/2-60,H/2,{color:'#c42020',size:13}); return; }

    // Determine bounding box for scale
    let maxR=0;
    for (const p of pts) maxR = Math.max(maxR, Math.hypot(...p.r));
    const scale = Math.min(W,H)*0.32 / (maxR||1);
    const { rotX, rotY, colorBy } = this.params;

    const maxCurv = Math.max(...pts.map(p=>p.curvature).filter(isFinite), 1e-6);
    const maxTors = Math.max(...pts.map(p=>Math.abs(p.torsion||0)).filter(isFinite), 1e-6);

    // Project all points, sort by depth for painter's algorithm
    const proj = pts.map((p,i) => {
      const [px,py,pz] = project3(p.r[0],p.r[1],p.r[2],rotX,rotY,scale,W,H);
      return { ...p, px, py, pz, idx:i };
    });

    ctx.lineWidth = 2.5; ctx.lineCap='round';
    for (let i=0; i<proj.length-1; i++) {
      let t;
      if (colorBy==='curvature') t = Math.min(1, proj[i].curvature/maxCurv);
      else if (colorBy==='torsion') t = Math.min(1, Math.abs(proj[i].torsion||0)/maxTors);
      else if (colorBy==='arc-param') t = i/proj.length;
      else t = 0.5;
      const hue = colorBy==='solid' ? 220 : (1-t)*240;
      ctx.strokeStyle = `hsl(${hue},70%,${40+t*15}%)`;
      ctx.beginPath(); ctx.moveTo(proj[i].px,proj[i].py); ctx.lineTo(proj[i+1].px,proj[i+1].py); ctx.stroke();
    }

    // Frenet frame at selected point
    if (this.params.showFrame) {
      const idx = Math.min(proj.length-1, Math.floor(this.params.frameAt*proj.length));
      const p = proj[idx];
      const drawVec = (dir, col, lbl, len=0.5) => {
        const end = [p.r[0]+dir[0]*len*maxR*0.4, p.r[1]+dir[1]*len*maxR*0.4, p.r[2]+dir[2]*len*maxR*0.4];
        const [ex,ey] = project3(end[0],end[1],end[2],rotX,rotY,scale,W,H);
        ctx.strokeStyle=col; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(p.px,p.py); ctx.lineTo(ex,ey); ctx.stroke();
        // arrowhead
        const ang=Math.atan2(ey-p.py,ex-p.px);
        ctx.fillStyle=col;
        ctx.beginPath();ctx.moveTo(ex,ey);
        ctx.lineTo(ex-7*Math.cos(ang-0.4),ey-7*Math.sin(ang-0.4));
        ctx.lineTo(ex-7*Math.cos(ang+0.4),ey-7*Math.sin(ang+0.4));
        ctx.closePath();ctx.fill();
        label(ctx,lbl,ex+4,ey-4,{color:col,size:13});
      };
      drawVec(p.T,'#c42020','T');
      drawVec(p.N,'#1a6b1a','N');
      drawVec(p.B,'#1a4fa8','B');
      ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(p.px,p.py,4,0,Math.PI*2); ctx.fill();
      label(ctx, `κ=${p.curvature.toFixed(4)}  τ=${(p.torsion||0).toFixed(4)}`, p.px+8, p.py+16, { color:'#555', size:10, bg:'rgba(255,255,255,0.85)' });
    }

    label(ctx, this.getFormula(), 8, 8, { color:'#333', size:11, bg:'rgba(255,255,255,0.9)' });
    label(ctx, this.params.colorBy==='solid'?'':`Color: ${this.params.colorBy}  (bright=high)`, 8, 26, { color:'#666', size:10, bg:'rgba(255,255,255,0.85)' });
    label(ctx, 'Drag to rotate', 8, H-16, { color:'#aaa', size:10 });
  }

  coordInfo() { return `t∈[${this.params.tMin.toFixed(2)},${this.params.tMax.toFixed(2)}]`; }
}
