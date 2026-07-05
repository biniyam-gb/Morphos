
export class Exporter {
  constructor(renderer) { this.renderer = renderer; }

  exportPNG(filename = 'morphogen.png') {
    const a = document.createElement('a');
    a.href = this.renderer.toDataURL('image/png');
    a.download = filename; a.click();
  }

  exportSVG(filename = 'morphogen.svg', instance = null) {
    const { canvas } = this.renderer;
    const W = canvas.width, H = canvas.height;
    let inner = '';
    if (instance && typeof instance.getSVGElements === 'function') {
      inner = instance.getSVGElements(W, H);
    } else {
      inner = `<image href="${this.renderer.toDataURL()}" width="${W}" height="${H}"/>`;
    }
    const svg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fff"/>
  ${inner}
</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    URL.revokeObjectURL(a.href);
  }
}
