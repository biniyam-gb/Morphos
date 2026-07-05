// js/colormap.js — Scientific colormaps
export const CM = {
  viridis:   [[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],
  plasma:    [[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],
  inferno:   [[0,0,4],[85,15,109],[186,54,85],[249,140,10],[252,255,164]],
  magma:     [[0,0,4],[79,18,123],[181,54,122],[251,135,97],[252,253,191]],
  hot:       [[0,0,0],[180,0,0],[255,128,0],[255,255,0],[255,255,255]],
  coolwarm:  [[59,76,192],[180,220,255],[245,245,245],[255,200,180],[180,4,38]],
  rdbu:      [[5,48,97],[145,191,219],[247,247,247],[244,165,130],[178,24,43]],
  spectral:  [[158,1,66],[230,97,1],[254,224,139],[171,221,164],[43,131,186]],
  twilight:  [[226,217,226],[150,110,180],[70,40,100],[110,60,120],[226,217,226]],
  gray:      [[0,0,0],[128,128,128],[255,255,255]],
  jet:       [[0,0,128],[0,0,255],[0,255,255],[255,255,0],[255,0,0],[128,0,0]],
  hsv:       [[255,0,0],[255,255,0],[0,255,0],[0,255,255],[0,0,255],[255,0,255],[255,0,0]],
};
export const CM_NAMES = Object.keys(CM);

export function sampleCM(name, t) {
  const c = CM[name] || CM.viridis;
  const s = Math.max(0, Math.min(1, t)) * (c.length - 1);
  const lo = Math.floor(s), hi = Math.min(lo + 1, c.length - 1), f = s - lo;
  return [c[lo][0]+f*(c[hi][0]-c[lo][0]), c[lo][1]+f*(c[hi][1]-c[lo][1]), c[lo][2]+f*(c[hi][2]-c[lo][2])].map(Math.round);
}

export function cmCSS(name, t) { const [r,g,b] = sampleCM(name,t); return `rgb(${r},${g},${b})`; }

export function cmGradient(name) {
  const c = CM[name] || CM.viridis;
  return `linear-gradient(to right, ${c.map((v,i)=>`rgb(${v}) ${Math.round(i/(c.length-1)*100)}%`).join(',')})`;
}

// HSV color for domain coloring
export function hsv2rgb(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
  let r,g,b;
  switch(i%6){case 0:r=v;g=t;b=p;break; case 1:r=q;g=v;b=p;break;
               case 2:r=p;g=v;b=t;break; case 3:r=p;g=q;b=v;break;
               case 4:r=t;g=p;b=v;break; case 5:r=v;g=p;b=q;break;}
  return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
}
