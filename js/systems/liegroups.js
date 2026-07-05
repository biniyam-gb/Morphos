
// Lie Groups — SO(3) rotations, quaternions, Lie algebra so(3)
import { clearCanvas, label } from '../plot.js';

function quatMul(a, b) {
  return [
    a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
    a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
    a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
    a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0],
  ];
}
function quatFromAxisAngle(axis, angle) {
  const [x,y,z] = axis; const n = Math.sqrt(x*x+y*y+z*z)||1;
  const s = Math.sin(angle/2);
  return [Math.cos(angle/2), x/n*s, y/n*s, z/n*s];
}
function quatRotate(q, v) {
  const p = [0, v[0], v[1], v[2]];
  const qc = [q[0],-q[1],-q[2],-q[3]];
  const r = quatMul(quatMul(q,p),qc);
  return [r[1],r[2],r[3]];
}
function quatToMatrix(q) {
  const [w,x,y,z]=q;
  return [
    [1-2*y*y-2*z*z, 2*x*y-2*z*w,   2*x*z+2*y*w],
    [2*x*y+2*z*w,   1-2*x*x-2*z*z, 2*y*z-2*x*w],
    [2*x*z-2*y*w,   2*y*z+2*x*w,   1-2*x*x-2*y*y],
  ];
}

function project3(v, rx, ry, scale, W, H) {
  const [x,y,z]=v;
  const cy=Math.cos(ry),sy=Math.sin(ry);
  const x2=x*cy+z*sy, z2=-x*sy+z*cy;
  const cx=Math.cos(rx),sx=Math.sin(rx);
  const y3=y*cx-z2*sx, z3=y*sx+z2*cx;
  return [W/2+x2*scale, H/2-y3*scale, z3];
}

export class LieGroups {
  constructor(W,H) {
    this.canvasW=W; this.canvasH=H;
    this.params = {
      view: 'rotation',  // rotation | gimbal | commutator | generator
      axisX: 0, axisY: 1, axisZ: 0, angle: 0,
      omegaX: 0.3, omegaY: 0.5, omegaZ: 0.1,  // angular velocity for continuous rotation
      showAxes: true, showTrail: true, objectType: 'cube',
      viewRotX: 0.4, viewRotY: 0.5,
      animate: true,
    };
    this.paramDefs = [
      { group: 'View Mode', items: [
        { id: 'view', label: 'Topic', type: 'select', options: ['rotation','gimbal','commutator','generator'],
          tip: 'rotation: object rotating by R∈SO(3). gimbal: Euler angle gimbal lock demo. commutator: [Lx,Ly]=Lz visualization. generator: exponential map exp(θL).' },
        { id: 'objectType', label: 'Object', type: 'select', options: ['cube','axes','asymmetric'] },
      ]},
      { group: 'Rotation Axis & Angle', items: [
        { id: 'axisX', label: 'Axis x', min:-1, max:1, step:0.05, type: 'range' },
        { id: 'axisY', label: 'Axis y', min:-1, max:1, step:0.05, type: 'range' },
        { id: 'axisZ', label: 'Axis z', min:-1, max:1, step:0.05, type: 'range' },
        { id: 'angle', label: 'Angle θ', min:-Math.PI*2, max:Math.PI*2, step:0.02, type: 'range' },
      ]},
      { group: 'Continuous Rotation', items: [
        { id: 'animate', label: 'Animate (apply ω continuously)', type: 'toggle' },
        { id: 'omegaX', label: 'ωx (rad/s)', min:-2, max:2, step:0.05, type: 'range' },
        { id: 'omegaY', label: 'ωy (rad/s)', min:-2, max:2, step:0.05, type: 'range' },
        { id: 'omegaZ', label: 'ωz (rad/s)', min:-2, max:2, step:0.05, type: 'range' },
      ]},
      { group: 'Display', items: [
        { id: 'showAxes',  label: 'Show coordinate axes', type: 'toggle' },
        { id: 'showTrail', label: 'Show angular momentum trail', type: 'toggle' },
        { id: 'viewRotX', label: 'View tilt', min:-Math.PI,max:Math.PI,step:0.01,type:'range' },
        { id: 'viewRotY', label: 'View spin', min:-Math.PI,max:Math.PI,step:0.01,type:'range' },
      ]},
    ];
    this.presets = [
      { id: 'spin-y', name: 'Spin around Y',       params: { view:'rotation', axisX:0,axisY:1,axisZ:0, omegaY:0.8, omegaX:0, omegaZ:0, animate:true } },
      { id: 'tumble', name: 'Tumbling (chaotic)',  params: { view:'rotation', omegaX:0.4,omegaY:0.7,omegaZ:0.3, animate:true, objectType:'asymmetric' } },
      { id: 'gimbal', name: 'Gimbal lock demo',     params: { view:'gimbal', animate:false } },
      { id: 'commut', name: 'Lie bracket [Lx,Ly]',  params: { view:'commutator', animate:false } },
      { id: 'genmap', name: 'Exponential map',       params: { view:'generator', animate:false, angle:1 } },
    ];
    this.domain = 'Lie Groups & Representation Theory';
    this.description = 'SO(3): the group of 3D rotations. Quaternions provide a double-cover (Spin(3)≅SU(2)). The Lie algebra so(3) has generators Lx,Ly,Lz with [Lx,Ly]=Lz (cyclic) — infinitesimal rotations don\'t commute, the origin of angular momentum non-commutativity in QM.';
    this.stepsPerFrame = 1;
    this._q = [1,0,0,0]; // identity quaternion
    this._trail = [];
    this._t = 0;
  }

  getFormula() {
    const m = {
      rotation: 'R = exp(θ[axis]ₓ)  — Rodrigues\' rotation formula',
      gimbal:   'R = Rz(γ)Ry(β)Rx(α)  — Euler angles, lock when β=±π/2',
      commutator: '[Lx,Ly] = LxLy − LyLx = Lz   (so(3) Lie algebra)',
      generator: 'exp(θL) = I + θL + θ²L²/2! + …  (matrix exponential)',
    };
    return m[this.params.view] || '';
  }

  reset() { this._q=[1,0,0,0]; this._trail=[]; this._t=0; }
  onParamChange() {}
  onMouseDrag(ddx,ddy) { this.params.viewRotY+=ddx*0.008; this.params.viewRotX+=ddy*0.008; }

  update() {
    if (!this.params.animate) return;
    const { omegaX, omegaY, omegaZ } = this.params;
    const omega = Math.sqrt(omegaX**2+omegaY**2+omegaZ**2);
    if (omega > 1e-6) {
      const dt = 0.04;
      const dq = quatFromAxisAngle([omegaX,omegaY,omegaZ], omega*dt);
      this._q = quatMul(dq, this._q);
      // Normalize
      const n = Math.sqrt(this._q.reduce((s,v)=>s+v*v,0));
      this._q = this._q.map(v=>v/n);
    }
    this._t += 0.04;
    if (this.params.showTrail) {
      const axisDir = quatRotate(this._q, [0,1,0]);
      this._trail.push(axisDir);
      if (this._trail.length>200) this._trail.shift();
    }
  }

  _getCubeVerts() {
    const s=0.7;
    return [[-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s],[-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s]];
  }
  _cubeEdges() { return [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]; }

  render(ctx, canvas) {
    const W=canvas.width, H=canvas.height;
    clearCanvas(ctx,W,H,'#fff');
    const v = this.params.view;
    if (v==='rotation') this._renderRotation(ctx,W,H);
    else if (v==='gimbal') this._renderGimbal(ctx,W,H);
    else if (v==='commutator') this._renderCommutator(ctx,W,H);
    else if (v==='generator') this._renderGenerator(ctx,W,H);
  }

  _renderRotation(ctx,W,H) {
    const { viewRotX, viewRotY, showAxes, showTrail, axisX,axisY,axisZ,angle } = this.params;
    const scale = Math.min(W,H)*0.22;
    let q = this._q;
    if (!this.params.animate) q = quatFromAxisAngle([axisX,axisY,axisZ], angle);

    if (showAxes) {
      const axes=[[1.3,0,0,'#c42020','x'],[0,1.3,0,'#1a6b1a','y'],[0,0,1.3,'#1a4fa8','z']];
      for (const [x,y,z,col,lbl] of axes) {
        const [px,py] = project3([x,y,z],viewRotX,viewRotY,scale,W,H);
        const [ox,oy] = project3([0,0,0],viewRotX,viewRotY,scale,W,H);
        ctx.strokeStyle=col+'55'; ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(px,py);ctx.stroke();
        label(ctx,lbl,px+4,py-4,{color:col+'aa',size:11});
      }
    }

    // Trail (angular momentum / pole path)
    if (showTrail && this._trail.length>1) {
      ctx.strokeStyle='rgba(160,80,0,0.5)'; ctx.lineWidth=1.5;
      ctx.beginPath();
      this._trail.forEach((p,i)=>{
        const [px,py]=project3(p,viewRotX,viewRotY,scale,W,H);
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      });
      ctx.stroke();
    }

    // Object
    const verts = this.params.objectType==='cube' ? this._getCubeVerts()
      : this.params.objectType==='asymmetric' ? this._getCubeVerts().map((v,i)=>[v[0]*(1+i*0.05),v[1],v[2]*(1-i*0.03)])
      : [[1,0,0],[0,1,0],[0,0,1]];

    const rotated = verts.map(v => quatRotate(q, v));
    const proj = rotated.map(v => project3(v,viewRotX,viewRotY,scale,W,H));

    if (this.params.objectType !== 'axes') {
      const edges = this._cubeEdges();
      // Sort edges by depth
      const edgesWithDepth = edges.map(([a,b]) => ({a,b,z:(proj[a][2]+proj[b][2])/2}));
      edgesWithDepth.sort((e1,e2)=>e1.z-e2.z);
      for (const {a,b,z} of edgesWithDepth) {
        const t=(z+2)/4;
        ctx.strokeStyle=`hsl(${230-t*100},60%,${35+t*20}%)`; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(proj[a][0],proj[a][1]); ctx.lineTo(proj[b][0],proj[b][1]); ctx.stroke();
      }
      proj.forEach(p => { ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(p[0],p[1],2.5,0,Math.PI*2); ctx.fill(); });
    } else {
      const cols=['#c42020','#1a6b1a','#1a4fa8'];
      const [ox,oy]=project3([0,0,0],viewRotX,viewRotY,scale,W,H);
      proj.forEach((p,i)=>{
        ctx.strokeStyle=cols[i]; ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(p[0],p[1]);ctx.stroke();
        label(ctx,['x\'','y\'','z\''][i],p[0]+4,p[1]-4,{color:cols[i],size:12});
      });
    }

    label(ctx, `q = (${q[0].toFixed(3)}, ${q[1].toFixed(3)}, ${q[2].toFixed(3)}, ${q[3].toFixed(3)})`, 8, 8, { color:'#333', size:11, bg:'rgba(255,255,255,0.9)' });
    label(ctx, '|q|=1 (unit quaternion ↔ SO(3) rotation, 2:1 cover)', 8, 26, { color:'#666', size:10, bg:'rgba(255,255,255,0.85)' });
  }

  _renderGimbal(ctx,W,H) {
    // Three nested rings (Euler angle gimbals), show lock when middle ring=90°
    const t = this._t*0.3;
    const alpha = t, beta = Math.sin(t*0.4)*Math.PI/2*0.95, gamma = t*1.3; // beta oscillates near ±90°
    const scale = Math.min(W,H)*0.28;
    const vrx=this.params.viewRotX, vry=this.params.viewRotY;

    const ringPts = (R, rotFn) => {
      const pts=[];
      for (let i=0;i<=40;i++){
        const a=i/40*Math.PI*2;
        let p=[R*Math.cos(a),R*Math.sin(a),0];
        p=rotFn(p);
        pts.push(p);
      }
      return pts;
    };
    const Rz=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a),p[2]];
    const Ry=(p,a)=>[p[0]*Math.cos(a)+p[2]*Math.sin(a),p[1],-p[0]*Math.sin(a)+p[2]*Math.cos(a)];
    const Rx=(p,a)=>[p[0],p[1]*Math.cos(a)-p[2]*Math.sin(a),p[1]*Math.sin(a)+p[2]*Math.cos(a)];

    const outer = ringPts(1.0, p=>Rz(p,alpha));
    const middle = ringPts(0.75, p=>Rz(Ry(p,beta),alpha));
    const inner = ringPts(0.5, p=>Rz(Ry(Rx(p,gamma),beta),alpha));

    const drawRing = (pts,col) => {
      ctx.strokeStyle=col; ctx.lineWidth=2.5;
      ctx.beginPath();
      pts.forEach((p,i)=>{ const [px,py]=project3(p,vrx,vry,scale,W,H); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
      ctx.closePath(); ctx.stroke();
    };
    drawRing(outer,'#c42020'); drawRing(middle,'#1a6b1a'); drawRing(inner,'#1a4fa8');

    const lockAmount = Math.abs(Math.abs(beta)-Math.PI/2);
    const isLocked = lockAmount < 0.08;
    label(ctx, `Euler angles: α=${(alpha%(2*Math.PI)).toFixed(2)} β=${beta.toFixed(2)} γ=${(gamma%(2*Math.PI)).toFixed(2)}`, 8, 8, { color:'#333', size:11, bg:'rgba(255,255,255,0.9)' });
    if (isLocked) label(ctx, '⚠ GIMBAL LOCK: β≈±90° — inner & outer axes align, 1 DOF lost!', 8, 26, { color:'#c42020', size:12, bg:'rgba(255,220,220,0.95)' });
    else label(ctx, 'Red=outer(α) Green=middle(β) Blue=inner(γ)', 8, 26, { color:'#666', size:10, bg:'rgba(255,255,255,0.85)' });
  }

  _renderCommutator(ctx,W,H) {
    // Show that rotating by small angle around X then Y differs from Y then X
    const scale = Math.min(W,H)*0.22;
    const vrx=this.params.viewRotX, vry=this.params.viewRotY;
    const eps = 0.4;
    const v0 = [1,0,0];

    const qx = quatFromAxisAngle([1,0,0],eps), qy = quatFromAxisAngle([0,1,0],eps);
    const qxInv = quatFromAxisAngle([1,0,0],-eps), qyInv = quatFromAxisAngle([0,1,0],-eps);

    // Apply RxRy and RyRx to a test vector, show difference
    let p1 = quatRotate(qx, quatRotate(qy, v0));
    let p2 = quatRotate(qy, quatRotate(qx, v0));
    // Commutator path: Rx Ry Rx⁻¹ Ry⁻¹
    let pc = quatRotate(qxInv, quatRotate(qyInv, quatRotate(qx, quatRotate(qy, v0))));

    const drawArrow = (target, col, lbl) => {
      const [ox,oy]=project3([0,0,0],vrx,vry,scale,W,H);
      const [px,py]=project3(target,vrx,vry,scale,W,H);
      ctx.strokeStyle=col; ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(px,py);ctx.stroke();
      ctx.fillStyle=col; ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();
      label(ctx,lbl,px+5,py-5,{color:col,size:12});
    };

    // Axes
    const axes=[[1.3,0,0,'#ddd','x'],[0,1.3,0,'#ddd','y'],[0,0,1.3,'#ddd','z']];
    for (const [x,y,z,col,lbl] of axes) {
      const [px,py]=project3([x,y,z],vrx,vry,scale,W,H);
      const [ox,oy]=project3([0,0,0],vrx,vry,scale,W,H);
      ctx.strokeStyle=col;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(px,py);ctx.stroke();
    }

    drawArrow(v0, '#888', 'v₀');
    drawArrow(p1, '#c42020', 'RxRy·v');
    drawArrow(p2, '#1a4fa8', 'RyRx·v');
    drawArrow(pc, '#6020a0', '[Rx,Ry]·v');

    const diff = Math.hypot(p1[0]-p2[0],p1[1]-p2[1],p1[2]-p2[2]);
    label(ctx, `Lie bracket: [Lx,Ly] = Lz  (infinitesimal rotations don't commute)`, 8, 8, { color:'#333', size:12, bg:'rgba(255,255,255,0.9)' });
    label(ctx, `|RxRy·v − RyRx·v| = ${diff.toFixed(4)} ≈ ε² for small ε=${eps}`, 8, 26, { color:'#666', size:10, bg:'rgba(255,255,255,0.85)' });
    label(ctx, 'This is the origin of angular momentum non-commutativity in QM', 8, H-16, { color:'#888', size:10 });
  }

  _renderGenerator(ctx,W,H) {
    const scale = Math.min(W,H)*0.22;
    const vrx=this.params.viewRotX, vry=this.params.viewRotY;
    const theta = this.params.angle;
    // Show exp(θ Lz) acting on a vector, with intermediate path
    const v0 = [1,0,0];
    const steps=60;
    const pathPts=[];
    for (let i=0;i<=steps;i++){
      const a = theta*i/steps;
      const q = quatFromAxisAngle([this.params.axisX||0,this.params.axisY||0,this.params.axisZ||1],a);
      pathPts.push(quatRotate(q,v0));
    }
    // Draw axes
    const axes=[[1.3,0,0,'#ddd'],[0,1.3,0,'#ddd'],[0,0,1.3,'#ddd']];
    for (const [x,y,z,col] of axes) {
      const [px,py]=project3([x,y,z],vrx,vry,scale,W,H);
      const [ox,oy]=project3([0,0,0],vrx,vry,scale,W,H);
      ctx.strokeStyle=col;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(px,py);ctx.stroke();
    }
    // Path
    ctx.strokeStyle='#1a4fa8'; ctx.lineWidth=2;
    ctx.beginPath();
    pathPts.forEach((p,i)=>{const[px,py]=project3(p,vrx,vry,scale,W,H);i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);});
    ctx.stroke();
    // Endpoint
    const last=pathPts[pathPts.length-1];
    const [lx,ly]=project3(last,vrx,vry,scale,W,H);
    ctx.fillStyle='#c42020';ctx.beginPath();ctx.arc(lx,ly,5,0,Math.PI*2);ctx.fill();
    const [ox,oy]=project3([0,0,0],vrx,vry,scale,W,H);
    const [sx,sy]=project3(v0,vrx,vry,scale,W,H);
    ctx.fillStyle='#888';ctx.beginPath();ctx.arc(sx,sy,4,0,Math.PI*2);ctx.fill();
    label(ctx,'v₀',sx+5,sy-5,{color:'#888',size:11});
    label(ctx,'exp(θL)v₀',lx+5,ly-5,{color:'#c42020',size:11});

    label(ctx, `exp(θL) for θ=${theta.toFixed(3)} rad  —  the exponential map from Lie algebra to Lie group`, 8, 8, { color:'#333', size:11, bg:'rgba(255,255,255,0.9)' });
    label(ctx, 'Path traces θ from 0 to current value — generators integrate to finite rotations', 8, 26, { color:'#666', size:10, bg:'rgba(255,255,255,0.85)' });
  }

  coordInfo() { return `view: ${this.params.view}`; }
}
