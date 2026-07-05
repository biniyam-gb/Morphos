
import { CM_NAMES, cmGradient } from '../colormap.js';

export function buildControls(container, instance, onChanged) {
  container.innerHTML = '';

  // Presets
  if (instance.presets?.length) {
    const sec = section('PRESETS');
    const grid = document.createElement('div');
    grid.className = 'preset-grid';
    for (const p of instance.presets) {
      const btn = mk('button', 'pbtn', p.name);
      btn.title = p.name;
      btn.addEventListener('click', () => {
        Object.assign(instance.params, p.params);
        if (typeof instance.onParamChange === 'function') instance.onParamChange('_preset');
        if (typeof instance.reset === 'function') instance.reset();
        buildControls(container, instance, onChanged);
        onChanged('_preset');
        grid.querySelectorAll('.pbtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      grid.appendChild(btn);
    }
    sec.appendChild(grid);
    container.appendChild(sec);
  }

  // Param groups
  for (const group of (instance.paramDefs || [])) {
    const sec = section(group.group);
    for (const def of group.items) sec.appendChild(buildRow(def, instance, onChanged));
    container.appendChild(sec);
  }
}

function section(title) {
  const d = mk('div', 'ctrl-section');
  const h = mk('div', 'ctrl-section-hd', title);
  d.appendChild(h);
  return d;
}

function mk(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls)  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function buildRow(def, inst, onChanged) {
  const row = mk('div', 'ctrl-row');
  switch (def.type) {
    case 'range':    return buildRange(row, def, inst, onChanged);
    case 'select':   return buildSelect(row, def, inst, onChanged);
    case 'toggle':   return buildToggle(row, def, inst, onChanged);
    case 'colormap': return buildColormap(row, def, inst, onChanged);
    case 'code':     return buildCode(row, def, inst, onChanged, false);
    case 'textarea': return buildCode(row, def, inst, onChanged, true);
    case 'button':   return buildButton(row, def, inst, onChanged);
    case 'hint':     return buildHint(row, def);
    default:         return row;
  }
}

function fmt(v) {
  if (typeof v !== 'number') return String(v);
  if (Number.isInteger(v))   return String(v);
  if (Math.abs(v) < 0.001)  return v.toFixed(5);
  if (Math.abs(v) < 1)      return v.toFixed(3);
  return v.toFixed(2);
}

function buildRange(row, def, inst, onChanged) {
  const v = inst.params[def.id] ?? 0;
  const lr = mk('div', 'ctrl-lr');
  lr.innerHTML = `<span class="ctrl-label">${def.label}</span><span class="ctrl-val" id="rv-${CSS.escape(def.id)}">${fmt(v)}</span>`;
  row.appendChild(lr);
  if (def.tip) row.appendChild(mk('div', 'ctrl-tip', def.tip));
  const inp = document.createElement('input');
  inp.type = 'range'; inp.min = def.min; inp.max = def.max; inp.step = def.step; inp.value = v;
  inp.setAttribute('aria-label', def.label);
  inp.addEventListener('input', e => {
    const nv = parseFloat(e.target.value);
    inst.params[def.id] = nv;
    const vEl = document.getElementById(`rv-${CSS.escape(def.id)}`);
    if (vEl) vEl.textContent = fmt(nv);
    if (typeof inst.onParamChange === 'function') inst.onParamChange(def.id);
    onChanged(def.id);
  });
  row.appendChild(inp);
  return row;
}

function buildSelect(row, def, inst, onChanged) {
  const v = inst.params[def.id] ?? (def.options?.[0]);
  const lr = mk('div', 'ctrl-lr');
  lr.innerHTML = `<span class="ctrl-label">${def.label}</span>`;
  row.appendChild(lr);
  if (def.tip) row.appendChild(mk('div', 'ctrl-tip', def.tip));
  const sel = document.createElement('select');
  sel.className = 'ps'; sel.setAttribute('aria-label', def.label);
  for (const opt of (def.options || [])) {
    const o = document.createElement('option');
    o.value = opt; o.textContent = opt;
    if (opt === v) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', e => {
    inst.params[def.id] = e.target.value;
    if (typeof inst.onParamChange === 'function') inst.onParamChange(def.id);
    onChanged(def.id);
  });
  row.appendChild(sel);
  return row;
}

function buildToggle(row, def, inst, onChanged) {
  const v = !!inst.params[def.id];
  const uid = `tgl-${def.id}-${Math.random().toString(36).slice(2,6)}`;
  const lr = mk('div', 'ctrl-lr toggle-row');
  lr.style.cursor = 'pointer';
  lr.innerHTML = `<span class="ctrl-label">${def.label}</span><div class="toggle${v ? ' on' : ''}" id="${uid}" role="checkbox" aria-checked="${v}" tabindex="0" aria-label="${def.label}"></div>`;
  if (def.tip) row.appendChild(mk('div', 'ctrl-tip', def.tip));
  const toggle = () => {
    inst.params[def.id] = !inst.params[def.id];
    const t = document.getElementById(uid);
    if (t) { t.classList.toggle('on', inst.params[def.id]); t.setAttribute('aria-checked', inst.params[def.id]); }
    if (typeof inst.onParamChange === 'function') inst.onParamChange(def.id);
    onChanged(def.id);
  };
  lr.addEventListener('click', toggle);
  const tEl = lr.querySelector(`#${uid}`);
  if (tEl) tEl.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
  row.appendChild(lr);
  return row;
}

function buildColormap(row, def, inst, onChanged) {
  const cur = inst.params[def.id] || 'viridis';
  row.appendChild(mk('div', 'ctrl-label', def.label));
  const grid = mk('div', 'cm-grid');
  for (const name of CM_NAMES) {
    const sw = mk('div', 'cm-swatch' + (name === cur ? ' active' : ''));
    sw.style.background = cmGradient(name);
    sw.title = name;
    sw.setAttribute('role', 'button');
    sw.setAttribute('tabindex', '0');
    sw.setAttribute('aria-label', `Colormap: ${name}`);
    const pick = () => {
      inst.params[def.id] = name;
      grid.querySelectorAll('.cm-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      if (typeof inst.onParamChange === 'function') inst.onParamChange(def.id);
      onChanged(def.id);
    };
    sw.addEventListener('click', pick);
    sw.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pick(); } });
    grid.appendChild(sw);
  }
  row.appendChild(grid);
  return row;
}

function buildCode(row, def, inst, onChanged, multi) {
  const v = inst.params[def.id] ?? '';
  row.appendChild(mk('div', 'ctrl-label', def.label));
  if (def.tip) row.appendChild(mk('div', 'ctrl-tip', def.tip));
  const inp = document.createElement(multi ? 'textarea' : 'input');
  inp.className = 'code-in';
  inp.setAttribute('aria-label', def.label);
  if (multi) { inp.rows = 3; inp.value = v; } else { inp.type = 'text'; inp.value = v; }
  inp.addEventListener('change', e => {
    inst.params[def.id] = e.target.value;
    if (typeof inst.onParamChange === 'function') inst.onParamChange(def.id);
    onChanged(def.id);
  });
  row.appendChild(inp);
  return row;
}

function buildButton(row, def, inst, onChanged) {
  const btn = mk('button', 'pbtn', def.label);
  btn.style.cssText = 'width:100%;margin-top:4px';
  btn.addEventListener('click', () => {
    if (typeof inst.onParamChange === 'function') inst.onParamChange(def.id);
    onChanged(def.id);
  });
  row.appendChild(btn);
  return row;
}

function buildHint(row, def) {
  row.className = 'ctrl-row hint-row';
  const d = mk('div', 'hint-text');
  d.innerHTML = def.html || def.text || '';
  row.appendChild(d);
  return row;
}
