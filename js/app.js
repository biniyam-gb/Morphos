
import { SYSTEMS }       from './systems/index.js';
import { Renderer }      from './renderer.js';
import { Exporter }      from './exporter.js';
import { buildSidebar, setSidebarActive } from './ui/sidebar.js';
import { buildControls } from './ui/controls.js';

class App {
  static SIM_STEP_MS = 1000 / 60;      // simulation always advances as if the display were 60Hz
  static MAX_CATCHUP_STEPS = 8;         // cap catch-up work after a stall so we don't spiral

  constructor() {
    this.renderer  = new Renderer(document.getElementById('canvas'));
    this.exporter  = new Exporter(this.renderer);
    this.instance  = null;
    this.sysDef    = null;
    this.running   = false;
    this.frame     = 0;
    this.rafId     = null;
    this.lastTs    = 0;
    this.fps       = 0;
    this._accumMs  = 0;
    this._prevX    = 0;
    this._prevY    = 0;
    this._mouseDown = false;

    this._bindUI();
    buildSidebar(document.getElementById('sidebar-inner'), SYSTEMS, id => this.load(id));
    this.load('complex-domain');
  }

  // Convert client mouse event → actual canvas pixel coords (handles CSS scaling)
  _coords(e) {
    const canvas = this.renderer.canvas;
    const rect   = canvas.getBoundingClientRect();
    return {
      cx: (e.clientX - rect.left) * (canvas.width  / rect.width),
      cy: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  _bindUI() {
    const canvas = this.renderer.canvas;

    document.getElementById('btn-play').addEventListener('click',  () => this.togglePlay());
    document.getElementById('btn-reset').addEventListener('click', () => this.reset());
    document.getElementById('btn-step').addEventListener('click',  () => this.step());
    document.getElementById('btn-png').addEventListener('click',   () =>
      this.exporter.exportPNG(`morphogen-${this.sysDef?.id||'export'}.png`));
    document.getElementById('btn-svg').addEventListener('click',   () =>
      this.exporter.exportSVG(`morphogen-${this.sysDef?.id||'export'}.svg`, this.instance));
    document.getElementById('size-select').addEventListener('change', e => {
      const s = parseInt(e.target.value);
      this.renderer.resize(s, s);
      if (this.instance) { this.instance.canvasW = s; this.instance.canvasH = s; this.reset(); }
    });

    window.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ')  { e.preventDefault(); this.togglePlay(); }
      if (e.key === 'r' || e.key === 'R') this.reset();
      if (e.key === '.')  this.step();
    });

    canvas.addEventListener('mousedown', e => {
      const { cx, cy } = this._coords(e);
      this._prevX = cx; this._prevY = cy;
      this._mouseDown = true;
      this._callMethod('onMouseDown', cx, cy, canvas.width, canvas.height, e);
    });

    canvas.addEventListener('mousemove', e => {
      const { cx, cy } = this._coords(e);
      const W = canvas.width, H = canvas.height;

      if (this._mouseDown) {
        const ddx = cx - this._prevX;
        const ddy = cy - this._prevY;
        this._callMethod('onMouseDrag', ddx, ddy, cx, cy, W, H);
      }
      this._prevX = cx; this._prevY = cy;

      // Update status bar
      const vp = this.instance?.vp;
      if (vp) {
        const [wx, wy] = vp.toWorld(cx, cy, W, H);
        document.getElementById('sb-coords').textContent =
          `x: ${wx.toFixed(4)}  y: ${wy.toFixed(4)}`;
      }
      if (this.instance?.coordInfo) {
        document.getElementById('sb-info').textContent =
          this.instance.coordInfo(cx, cy, W, H) || '';
      }
    });

    canvas.addEventListener('mouseup',    () => { this._mouseDown = false; this._callMethod('onMouseUp'); });
    canvas.addEventListener('mouseleave', () => { this._mouseDown = false; this._callMethod('onMouseUp'); });

    canvas.addEventListener('click', e => {
      const { cx, cy } = this._coords(e);
      this._callMethod('onClick', cx, cy, canvas.width, canvas.height, e);
    });

    canvas.addEventListener('dblclick', e => {
      const { cx, cy } = this._coords(e);
      this._callMethod('onDblClick', cx, cy, canvas.width, canvas.height, e);
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const { cx, cy } = this._coords(e);
      this._callMethod('onWheel', cx, cy, e.deltaY, canvas.width, canvas.height);
      if (!this.running) this._draw();
    }, { passive: false });
  }

  _callMethod(method, ...args) {
    if (this.instance && typeof this.instance[method] === 'function') {
      this.instance[method](...args);
      if (!this.running) this._draw();
    }
  }

  load(id) {
    this.pause();
    this.frame = 0;
    this.sysDef = SYSTEMS.find(s => s.id === id);
    if (!this.sysDef) return;

    const { width, height } = this.renderer.canvas;
    this.instance = this.sysDef.create(width, height);

    document.getElementById('panel-sysname').textContent  = this.sysDef.name;
    document.getElementById('panel-domain').textContent   = this.sysDef.group || '';
    document.getElementById('panel-desc').textContent     = this.instance.description || '';
    document.getElementById('formula-text').textContent   = this.instance.getFormula?.() || '';

    setSidebarActive(id);

    const refreshControls = () => {
      buildControls(
        document.getElementById('controls'),
        this.instance,
        () => {
          document.getElementById('formula-text').textContent = this.instance.getFormula?.() || '';
          document.getElementById('panel-desc').textContent   = this.instance.description || '';
          if (!this.running) this._draw();
        }
      );
    };
    refreshControls();

    this._draw();
    const spf = this.instance.stepsPerFrame ?? 0;
    if (spf > 0) this.play();
  }

  togglePlay() { this.running ? this.pause() : this.play(); }

  play() {
    if (this.running) return;
    this.running = true;
    document.getElementById('btn-play').classList.add('active');
    document.getElementById('btn-play').textContent = '⏸';
    this.lastTs = performance.now();
    this._accumMs = 0;
    this.rafId = requestAnimationFrame(ts => this._loop(ts));
  }

  pause() {
    this.running = false;
    document.getElementById('btn-play').classList.remove('active');
    document.getElementById('btn-play').textContent = '▶';
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  reset() {
    const wasRunning = this.running;
    this.pause();
    this.frame = 0;
    this.instance?.reset();
    this._draw();
    document.getElementById('hud-frame').textContent = 'f:0';
    if (wasRunning && (this.instance?.stepsPerFrame ?? 0) > 0) this.play();
  }

  step() {
    this.instance?.update();
    this.frame++;
    this._draw();
    document.getElementById('hud-frame').textContent = `f:${this.frame}`;
  }

  _loop(ts) {
    if (!this.running) return;
    let frameDt = ts - this.lastTs;
    this.lastTs = ts;
    if (frameDt > 250) frameDt = 250;           // clamp huge gaps (tab was backgrounded)
    if (frameDt > 0) this.fps = Math.round(1000 / frameDt);

    // Fixed-timestep accumulator: simulation always advances at a constant
    // real-world rate (equivalent to 60Hz), regardless of the display's
    // actual refresh rate. Without this, everything runs proportionally
    // faster on 120Hz/144Hz displays than on 60Hz ones, since
    // requestAnimationFrame simply fires at whatever rate the display
    // refreshes.
    this._accumMs = (this._accumMs || 0) + frameDt;
    const spf = this.instance?.stepsPerFrame ?? 1;
    let caughtUp = 0;
    while (this._accumMs >= App.SIM_STEP_MS && caughtUp < App.MAX_CATCHUP_STEPS) {
      for (let i = 0; i < spf; i++) this.instance?.update();
      this._accumMs -= App.SIM_STEP_MS;
      this.frame++;
      caughtUp++;
    }
    this._draw();

    document.getElementById('hud-frame').textContent = `f:${this.frame}`;
    document.getElementById('sb-fps').textContent    = `${this.fps} fps`;
    document.getElementById('formula-text').textContent = this.instance?.getFormula?.() || '';

    this.rafId = requestAnimationFrame(ts => this._loop(ts));
  }

  _draw() {
    if (!this.instance) return;
    this.instance.render(this.renderer.ctx, this.renderer.canvas);
  }
}

window.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
