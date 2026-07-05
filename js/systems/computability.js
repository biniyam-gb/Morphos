// Computability Theory -- Turing Machines & Lambda Calculus
// Two equivalent (Church-Turing thesis) models of mechanical computation.
import { clearCanvas, label } from '../plot.js';

// ---------- Turing Machine ----------
function parseTM(text) {
  const rules = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\w+)\s*,\s*(\S+)\s*->\s*(\S+)\s*,\s*([LRNlrn])\s*,\s*(\w+)$/);
    if (m) {
      const [, state, sym, newSym, dir, newState] = m;
      rules[state + ',' + sym] = { newSym, dir: dir.toUpperCase(), newState };
    }
  }
  return rules;
}

const TM_PRESETS = {
  'Busy Beaver (2-state)': {
    rules: 'A,0->1,R,B\nA,1->1,L,B\nB,0->1,L,A\nB,1->1,R,HALT',
    tape: '', blank: '0', headStart: 0,
    desc: 'The 2-state 2-symbol busy beaver champion. Provably halts after 6 steps having written 4 ones -- the maximum possible for any 2-state machine.'
  },
  'Busy Beaver (3-state)': {
    rules: 'A,0->1,R,B\nA,1->1,R,HALT\nB,0->0,R,C\nB,1->1,R,B\nC,0->1,L,C\nC,1->1,L,A',
    tape: '', blank: '0', headStart: 0,
    desc: 'A known high-scoring 3-state busy beaver. The busy beaver function BB(n) is not computable -- it grows faster than any computable function, since computing it would let you solve the halting problem.'
  },
  'Bit Flipper': {
    rules: 'A,0->1,R,A\nA,1->0,R,A\nA,_->_,R,HALT',
    tape: '0101100', blank: '_', headStart: 0,
    desc: 'Flips every 0 to 1 and 1 to 0 until reaching a blank, then halts. A simple total (always-halting) computable function.'
  },
  'Binary Increment (+1)': {
    rules: 'A,1->0,L,A\nA,0->1,L,HALT\nA,_->1,L,HALT',
    tape: '1011', blank: '_', headStart: 3,
    desc: 'Adds 1 to a binary number, starting at the rightmost digit and carrying left -- exactly ripple-carry addition, the same algorithm hardware adders use.'
  },
  'Custom': {
    rules: 'A,0->1,R,B\nA,1->1,L,B\nB,0->1,L,A\nB,1->1,R,HALT',
    tape: '', blank: '0', headStart: 0,
    desc: 'Edit the transition table freely. Format: STATE,SYMBOL -> NEWSYMBOL,DIR,NEWSTATE'
  },
};

// ---------- Lambda Calculus ----------
function lcTokenize(s) {
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '\\' || c === '\u03bb') { tokens.push('\\'); i++; continue; }
    if (c === '.' || c === '(' || c === ')') { tokens.push(c); i++; continue; }
    let j = i;
    while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
    if (j === i) { i++; continue; }
    tokens.push(s.slice(i, j));
    i = j;
  }
  return tokens;
}

function lcParse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  function parseTerm() { return parseApp(); }
  function parseApp() {
    let t = parseAtomReq();
    while (true) {
      if (peek() === undefined || peek() === ')') break;
      const save = pos;
      let a;
      try { a = parseAtomReq(); } catch (e) { pos = save; break; }
      t = { type: 'app', func: t, arg: a };
    }
    return t;
  }
  function parseAtomReq() {
    const t = peek();
    if (t === '\\') {
      next();
      const param = next();
      if (peek() !== '.') throw new Error('expected . after lambda parameter');
      next();
      const body = parseTerm();
      return { type: 'abs', param, body };
    }
    if (t === '(') {
      next();
      const inner = parseTerm();
      if (peek() !== ')') throw new Error('expected )');
      next();
      return inner;
    }
    if (t && /^[A-Za-z0-9_]+$/.test(t)) { next(); return { type: 'var', name: t }; }
    throw new Error('unexpected token: ' + t);
  }
  const result = parseTerm();
  if (pos < tokens.length) throw new Error('unexpected trailing input');
  return result;
}

function lcShow(term) {
  switch (term.type) {
    case 'var': return term.name;
    case 'abs': return `\\${term.param}.${lcShow(term.body)}`;
    case 'app': {
      const f = term.func.type === 'abs' ? `(${lcShow(term.func)})` : lcShow(term.func);
      const a = (term.arg.type === 'app' || term.arg.type === 'abs') ? `(${lcShow(term.arg)})` : lcShow(term.arg);
      return `${f} ${a}`;
    }
  }
}

function lcFreeVars(term) {
  switch (term.type) {
    case 'var': return new Set([term.name]);
    case 'abs': { const s = lcFreeVars(term.body); s.delete(term.param); return s; }
    case 'app': { const s = lcFreeVars(term.func); for (const v of lcFreeVars(term.arg)) s.add(v); return s; }
  }
}

function lcFresh(base, avoid) {
  let i = 0, name = base;
  while (avoid.has(name)) { i++; name = base + i; }
  return name;
}

function lcSubst(term, x, N) {
  switch (term.type) {
    case 'var': return term.name === x ? N : term;
    case 'app': return { type: 'app', func: lcSubst(term.func, x, N), arg: lcSubst(term.arg, x, N) };
    case 'abs':
      if (term.param === x) return term;
      if (!lcFreeVars(N).has(term.param)) {
        return { type: 'abs', param: term.param, body: lcSubst(term.body, x, N) };
      } else {
        const avoid = new Set([...lcFreeVars(N), ...lcFreeVars(term.body), x]);
        const newParam = lcFresh(term.param, avoid);
        const renamed = lcSubst(term.body, term.param, { type: 'var', name: newParam });
        return { type: 'abs', param: newParam, body: lcSubst(renamed, x, N) };
      }
  }
}

// Normal-order (leftmost-outermost) single-step reduction -- finds a normal
// form whenever one exists.
function lcStep(term) {
  if (term.type === 'app' && term.func.type === 'abs') {
    return { reduced: true, term: lcSubst(term.func.body, term.func.param, term.arg) };
  }
  if (term.type === 'app') {
    const f = lcStep(term.func);
    if (f.reduced) return { reduced: true, term: { type: 'app', func: f.term, arg: term.arg } };
    const a = lcStep(term.arg);
    if (a.reduced) return { reduced: true, term: { type: 'app', func: term.func, arg: a.term } };
    return { reduced: false, term };
  }
  if (term.type === 'abs') {
    const b = lcStep(term.body);
    if (b.reduced) return { reduced: true, term: { type: 'abs', param: term.param, body: b.term } };
    return { reduced: false, term };
  }
  return { reduced: false, term };
}

const LC_PRESETS = {
  'Identity: (\\x.x) y': { term: '(\\x.x) y', desc: 'The identity combinator I applied to y. Reduces in a single step.' },
  'K combinator: (\\x.\\y.x) a b': { term: '(\\x.\\y.x) a b', desc: 'K discards its second argument: K a b reduces to a. This IS how "true" is encoded in the untyped lambda calculus.' },
  'Church 2 + 3': { term: '(\\m.\\n.\\f.\\x.m f (n f x)) (\\f.\\x.f (f x)) (\\f.\\x.f (f (f x)))', desc: 'Church-encoded addition. A number n is the function that applies f, n times. Watch it reduce to the 5-fold application of f.' },
  'Church 2 x 3': { term: '(\\m.\\n.\\f.m (n f)) (\\f.\\x.f (f x)) (\\f.\\x.f (f (f x)))', desc: 'Church multiplication is literally function composition: applying f a total of m*n times.' },
  'SKI: S K K a = a': { term: '(\\x.\\y.\\z.x z (y z)) (\\x.\\y.x) (\\x.\\y.x) a', desc: 'S K K behaves exactly like I (identity) for any argument -- a classical combinator identity, and the basis of combinator-only ("point-free") computation.' },
  'Y combinator (non-terminating)': { term: '(\\f.(\\x.f (x x)) (\\x.f (x x))) (\\y.y)', desc: 'The Y combinator enables recursion with no named self-reference. Applied here it reduces forever -- a concrete, tiny instance of the undecidability of the halting problem.' },
  'Custom': { term: '(\\x.x) y', desc: 'Type any lambda term. Use \\x.body for lambda-x.body and juxtaposition for application.' },
};

export class Computability {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = {
      view: 'turing-machine',
      tmPreset: 'Busy Beaver (2-state)',
      tmRules: TM_PRESETS['Busy Beaver (2-state)'].rules,
      tmTape: TM_PRESETS['Busy Beaver (2-state)'].tape,
      tmBlank: '0',
      tmHeadStart: 0,
      lcPreset: 'Church 2 + 3',
      lcTerm: LC_PRESETS['Church 2 + 3'].term,
      autoRun: true,
      speed: 1,
      maxSteps: 300,
    };
    this.paramDefs = [
      { group: 'Model of Computation', items: [
        { id: 'view', label: 'Model', type: 'select', options: ['turing-machine', 'lambda-calculus'],
          tip: 'Two equivalent (Church-Turing thesis) models of what is mechanically computable.' },
        { id: 'autoRun', label: 'Auto-run', type: 'toggle' },
        { id: 'speed', label: 'Steps/frame', min: 1, max: 20, step: 1, type: 'range' },
      ]},
      { group: 'Turing Machine', items: [
        { id: 'tmPreset', label: 'Preset', type: 'select', options: Object.keys(TM_PRESETS) },
        { id: '_guide', type: 'hint', html: 'Format: <code>STATE,SYMBOL -&gt; NEWSYMBOL,DIR,NEWSTATE</code> one rule per line. DIR is L or R. Any state that appears on the right but never on the left (e.g. HALT) stops the machine.' },
        { id: 'tmRules', label: 'Transition table', type: 'textarea' },
        { id: 'tmTape',  label: 'Initial tape', type: 'code' },
        { id: 'tmBlank', label: 'Blank symbol', type: 'code' },
        { id: 'tmHeadStart', label: 'Initial head position', min: 0, max: 30, step: 1, type: 'range' },
      ]},
      { group: 'Lambda Calculus', items: [
        { id: 'lcPreset', label: 'Preset', type: 'select', options: Object.keys(LC_PRESETS) },
        { id: '_guide2', type: 'hint', html: 'Syntax: <code>\\x.body</code> for the lambda abstraction, juxtaposition for application, parens to group. Reduction order is normal (leftmost-outermost) -- it finds a normal form whenever one exists.' },
        { id: 'lcTerm', label: 'Term', type: 'code' },
        { id: 'maxSteps', label: 'Max reduction steps', min: 20, max: 1000, step: 20, type: 'range' },
      ]},
    ];
    this.presets = [
      { id: 'bb2',  name: 'Busy Beaver (2-state)', params: { view: 'turing-machine', tmPreset: 'Busy Beaver (2-state)' } },
      { id: 'bb3',  name: 'Busy Beaver (3-state)', params: { view: 'turing-machine', tmPreset: 'Busy Beaver (3-state)' } },
      { id: 'flip', name: 'Bit flipper',            params: { view: 'turing-machine', tmPreset: 'Bit Flipper' } },
      { id: 'inc',  name: 'Binary increment',        params: { view: 'turing-machine', tmPreset: 'Binary Increment (+1)' } },
      { id: 'lc1',  name: 'Church arithmetic',        params: { view: 'lambda-calculus', lcPreset: 'Church 2 + 3' } },
      { id: 'lc2',  name: 'Y combinator (loops!)',    params: { view: 'lambda-calculus', lcPreset: 'Y combinator (non-terminating)' } },
    ];
    this.domain = 'Computability & Logic';
    this.stepsPerFrame = 1;
    this._loadTM(this.params.tmPreset);
    this._loadLC(this.params.lcPreset);
  }

  _loadTM(name) {
    const p = TM_PRESETS[name]; if (!p) return;
    this.params.tmRules = p.rules;
    this.params.tmTape = p.tape;
    this.params.tmBlank = p.blank;
    this.params.tmHeadStart = p.headStart;
    this._tmDesc = p.desc;
    this._resetTM();
  }
  _loadLC(name) {
    const p = LC_PRESETS[name]; if (!p) return;
    this.params.lcTerm = p.term;
    this._lcDesc = p.desc;
    this._resetLC();
  }

  _resetTM() {
    this._tmRulesParsed = parseTM(this.params.tmRules);
    this._tape = new Map();
    const str = this.params.tmTape || '';
    for (let i = 0; i < str.length; i++) this._tape.set(i, str[i]);
    this._head = this.params.tmHeadStart || 0;
    this._state = 'A';
    this._tmSteps = 0;
    this._tmHalted = false;
    this._tmHaltReason = '';
  }
  _resetLC() {
    try {
      this._lcTerm = lcParse(lcTokenize(this.params.lcTerm));
      this._lcError = null;
    } catch (e) {
      this._lcTerm = null;
      this._lcError = e.message;
    }
    this._lcSteps = 0;
    this._lcHalted = false;
    this._lcHistory = [];
  }

  getFormula() {
    if (this.params.view === 'turing-machine') return `Turing machine -- state ${this._state}, step ${this._tmSteps}${this._tmHalted ? ' (HALTED)' : ''}`;
    return `Lambda calculus -- step ${this._lcSteps}${this._lcHalted ? ' (normal form reached)' : ''}`;
  }
  get description() {
    return this.params.view === 'turing-machine' ? (this._tmDesc || '') : (this._lcDesc || '');
  }

  reset() {
    if (this.params.view === 'turing-machine') this._resetTM();
    else this._resetLC();
  }
  onParamChange(id) {
    if (id === 'tmPreset') this._loadTM(this.params.tmPreset);
    else if (id === 'lcPreset') this._loadLC(this.params.lcPreset);
    else if (id === 'tmRules' || id === 'tmTape' || id === 'tmBlank' || id === 'tmHeadStart') this._resetTM();
    else if (id === 'lcTerm') this._resetLC();
    else if (id === '_preset') { this._loadTM(this.params.tmPreset); this._loadLC(this.params.lcPreset); }
  }

  update() {
    if (!this.params.autoRun) return;
    const n = Math.round(this.params.speed);
    for (let i = 0; i < n; i++) this._stepOnce();
  }

  _stepOnce() {
    if (this.params.view === 'turing-machine') this._stepTM();
    else this._stepLC();
  }

  _stepTM() {
    if (this._tmHalted) return;
    const sym = this._tape.get(this._head) ?? this.params.tmBlank;
    const rule = this._tmRulesParsed[this._state + ',' + sym];
    if (!rule) { this._tmHalted = true; this._tmHaltReason = `no rule for (${this._state}, ${sym})`; return; }
    this._tape.set(this._head, rule.newSym);
    if (rule.dir === 'R') this._head++;
    else if (rule.dir === 'L') this._head--;
    this._state = rule.newState;
    this._tmSteps++;
    if (/^HALT/i.test(this._state)) { this._tmHalted = true; this._tmHaltReason = 'reached HALT state'; }
  }

  _stepLC() {
    if (this._lcHalted || !this._lcTerm) return;
    if (this._lcSteps >= this.params.maxSteps) { this._lcHalted = true; return; }
    const { reduced, term } = lcStep(this._lcTerm);
    this._lcHistory.push(this._lcTerm);
    if (this._lcHistory.length > 10) this._lcHistory.shift();
    if (!reduced) { this._lcHalted = true; return; }
    this._lcTerm = term;
    this._lcSteps++;
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    if (this.params.view === 'turing-machine') this._renderTM(ctx, W, H);
    else this._renderLC(ctx, W, H);
  }

  _renderTM(ctx, W, H) {
    const cellW = 30, midY = H * 0.4;
    const visibleCells = Math.floor(W / cellW);
    const startPos = this._head - Math.floor(visibleCells / 2);
    for (let i = 0; i < visibleCells; i++) {
      const pos = startPos + i;
      const x = i * cellW;
      const sym = this._tape.get(pos) ?? this.params.tmBlank;
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
      ctx.strokeRect(x, midY, cellW, cellW);
      ctx.fillStyle = sym === this.params.tmBlank ? '#aaa' : '#1a4fa8';
      ctx.font = '14px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sym, x + cellW / 2, midY + cellW / 2);
      if (pos === this._head) {
        ctx.fillStyle = this._tmHalted ? '#c42020' : '#1a6b1a';
        ctx.beginPath();
        ctx.moveTo(x + cellW / 2 - 7, midY - 6);
        ctx.lineTo(x + cellW / 2 + 7, midY - 6);
        ctx.lineTo(x + cellW / 2, midY + 2);
        ctx.closePath(); ctx.fill();
      }
    }
    label(ctx, `state: ${this._state}   step: ${this._tmSteps}${this._tmHalted ? '   HALTED (' + this._tmHaltReason + ')' : ''}`, 8, 8, { color: this._tmHalted ? '#c42020' : '#333', size: 12, bg: 'rgba(255,255,255,0.9)' });
    const rules = Object.entries(this._tmRulesParsed);
    rules.slice(0, 14).forEach(([k, v], i) => {
      const [st] = k.split(',');
      const active = st === this._state;
      ctx.fillStyle = active ? '#1a6b1a' : '#888';
      ctx.font = active ? 'bold 11px Courier New' : '11px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText(`${k} -> ${v.newSym},${v.dir},${v.newState}`, 8, H - 16 - (rules.length - 1 - i) * 14);
    });
  }

  _renderLC(ctx, W, H) {
    if (this._lcError) {
      label(ctx, `Parse error: ${this._lcError}`, 20, 20, { color: '#c42020', size: 13 });
      return;
    }
    const pad = 16;
    let y = pad;
    this._lcHistory.forEach((t, i) => {
      const s = lcShow(t);
      ctx.font = '12px Courier New'; ctx.fillStyle = '#999'; ctx.textAlign = 'left';
      ctx.fillText(`${this._lcSteps - (this._lcHistory.length - i)}: ${s.length > 90 ? s.slice(0, 90) + '\u2026' : s}`, pad, y);
      y += 20;
    });
    const cur = this._lcTerm ? lcShow(this._lcTerm) : '';
    ctx.font = 'bold 14px Courier New'; ctx.fillStyle = this._lcHalted ? '#1a6b1a' : '#1a4fa8';
    const display = cur.length > 120 ? cur.slice(0, 120) + '\u2026' : cur;
    ctx.fillText(`${this._lcSteps}: ${display}`, pad, y + 6);
    const msg = this._lcHalted
      ? (this._lcSteps >= this.params.maxSteps ? `Step limit (${this.params.maxSteps}) reached -- may not have a normal form` : 'Normal form reached -- reduction complete')
      : 'Reducing (normal order: leftmost-outermost redex first)...';
    label(ctx, msg, pad, H - 30, { color: this._lcHalted ? '#1a6b1a' : '#666', size: 11 });
  }

  coordInfo() {
    return this.params.view === 'turing-machine'
      ? `head=${this._head}  state=${this._state}  step=${this._tmSteps}`
      : `step=${this._lcSteps}${this._lcHalted ? ' (halted)' : ''}`;
  }
}
