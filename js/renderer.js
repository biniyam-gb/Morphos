
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
  }
  resize(w, h) { this.canvas.width = w; this.canvas.height = h; }
  toDataURL(type = 'image/png') { return this.canvas.toDataURL(type); }
}
