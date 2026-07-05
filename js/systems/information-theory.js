// Information Theory -- Shannon entropy, Huffman coding, and channel
// capacity of the binary symmetric channel.
import { clearCanvas, label } from '../plot.js';

function entropy(probs) {
  return -probs.filter(p => p > 0).reduce((s, p) => s + p * Math.log2(p), 0);
}
function binaryEntropy(p) {
  if (p <= 0 || p >= 1) return 0;
  return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

function buildHuffman(freqs) {
  let nodes = freqs.map((f, i) => ({ ...f, id: i, isLeaf: true }));
  let nextId = freqs.length;
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    const left = nodes.shift(), right = nodes.shift();
    nodes.push({ id: nextId++, freq: left.freq + right.freq, left, right, isLeaf: false });
  }
  return nodes[0];
}
function computeCodes(node, prefix, codes) {
  if (node.isLeaf) { codes[node.symbol] = prefix || '0'; return; }
  computeCodes(node.left, prefix + '0', codes);
  computeCodes(node.right, prefix + '1', codes);
}
function treeDepth(node) { return node.isLeaf ? 0 : 1 + Math.max(treeDepth(node.left), treeDepth(node.right)); }
function assignPositions(node, depth, xRange, positions) {
  if (node.isLeaf) { positions.set(node.id, { x: (xRange[0] + xRange[1]) / 2, y: depth, node }); return (xRange[0] + xRange[1]) / 2; }
  const mid = (xRange[0] + xRange[1]) / 2;
  const leftLeaves = countLeaves(node.left), rightLeaves = countLeaves(node.right);
  const split = xRange[0] + (xRange[1] - xRange[0]) * (leftLeaves / (leftLeaves + rightLeaves));
  const lx = assignPositions(node.left, depth + 1, [xRange[0], split], positions);
  const rx = assignPositions(node.right, depth + 1, [split, xRange[1]], positions);
  positions.set(node.id, { x: (lx + rx) / 2, y: depth, node });
  return (lx + rx) / 2;
}
function countLeaves(node) { return node.isLeaf ? 1 : countLeaves(node.left) + countLeaves(node.right); }

function parseFreqs(str) {
  const out = [];
  for (const part of str.split(',')) {
    const m = part.trim().match(/^(\S+)\s*:\s*(\d+(?:\.\d+)?)$/);
    if (m) out.push({ symbol: m[1], freq: parseFloat(m[2]) });
  }
  return out;
}

export class InformationTheory {
  constructor(W, H) {
    this.canvasW = W; this.canvasH = H;
    this.params = {
      view: 'entropy',        // entropy | huffman | channel
      p0: 0.5, p1: 0.25, p2: 0.125, p3: 0.125,
      huffmanFreqs: 'A:45,B:13,C:12,D:16,E:9,F:5',
      crossoverP: 0.1,
    };
    this.paramDefs = [
      { group: 'Topic', items: [
        { id: 'view', label: 'View', type: 'select', options: ['entropy', 'huffman', 'channel'],
          tip: 'entropy: information content of a distribution. huffman: optimal prefix-free coding. channel: noisy-channel capacity.' },
      ]},
      { group: 'Probability Distribution', items: [
        { id: 'p0', label: 'p\u2081', min: 0, max: 1, step: 0.01, type: 'range' },
        { id: 'p1', label: 'p\u2082', min: 0, max: 1, step: 0.01, type: 'range' },
        { id: 'p2', label: 'p\u2083', min: 0, max: 1, step: 0.01, type: 'range' },
        { id: 'p3', label: 'p\u2084', min: 0, max: 1, step: 0.01, type: 'range' },
        { id: '_guide', type: 'hint', html: 'Probabilities are auto-normalized to sum to 1 before computing entropy.' },
      ]},
      { group: 'Huffman Coding', items: [
        { id: 'huffmanFreqs', label: 'Symbol:frequency pairs', type: 'code', tip: 'Comma-separated, e.g. A:45,B:13,C:12' },
      ]},
      { group: 'Binary Symmetric Channel', items: [
        { id: 'crossoverP', label: 'Crossover probability p', min: 0, max: 0.5, step: 0.005, type: 'range',
          tip: 'Probability a transmitted bit is flipped by noise.' },
      ]},
    ];
    this.presets = [
      { id: 'uniform', name: 'Uniform (max entropy)', params: { view: 'entropy', p0: 0.25, p1: 0.25, p2: 0.25, p3: 0.25 } },
      { id: 'skewed',   name: 'Skewed (low entropy)',   params: { view: 'entropy', p0: 0.85, p1: 0.07, p2: 0.05, p3: 0.03 } },
      { id: 'huff1',    name: 'Classic Huffman example', params: { view: 'huffman', huffmanFreqs: 'A:45,B:13,C:12,D:16,E:9,F:5' } },
      { id: 'chan',     name: 'Channel capacity curve',   params: { view: 'channel', crossoverP: 0.1 } },
    ];
    this.domain = 'Information Theory';
    this.stepsPerFrame = 0;
    this._dirty = true;
    this._rebuildHuffman();
  }

  get description() {
    const m = {
      entropy: 'Shannon entropy H(X)=\u2212\u03a3 p\u1d62 log\u2082 p\u1d62 measures the average number of bits needed to describe an outcome drawn from this distribution. Maximized by the uniform distribution.',
      huffman: 'Huffman coding greedily builds an optimal prefix-free binary code: repeatedly merge the two least-frequent symbols. No code can beat the entropy on average (Shannon\'s source coding theorem), and Huffman gets provably within 1 bit of it.',
      channel: 'Shannon\'s noisy-channel coding theorem (1948): even over a channel that corrupts bits, error-free communication is possible at any rate below capacity C, by using longer and cleverer codes.',
    };
    return m[this.params.view] || '';
  }
  getFormula() {
    if (this.params.view === 'entropy') return 'H(X) = \u2212\u03a3 p\u1d62 log\u2082 p\u1d62   (bits)';
    if (this.params.view === 'huffman') return 'Greedy: merge two smallest-frequency nodes, repeat';
    return 'C = 1 \u2212 H\u2082(p)   (bits per channel use)';
  }

  _normalizedProbs() {
    const raw = [this.params.p0 ?? 0.5, this.params.p1 ?? 0.25, this.params.p2 ?? 0.125, this.params.p3 ?? 0.125];
    const s = raw.reduce((a, b) => a + b, 0) || 1;
    return raw.map(p => p / s);
  }
  _rebuildHuffman() {
    const freqs = parseFreqs(this.params.huffmanFreqs);
    if (!freqs.length) { this._huffmanTree = null; return; }
    this._huffmanTree = buildHuffman(freqs);
    this._huffmanCodes = {};
    computeCodes(this._huffmanTree, '', this._huffmanCodes);
    this._huffmanFreqsList = freqs;
  }

  reset() { this._dirty = true; }
  update() {}
  onParamChange(id) {
    if (id === 'p0' || id === 'p1' || id === 'p2' || id === 'p3') {
      this.params.p0 = this.params.p0 ?? 0.5; this.params.p1 = this.params.p1 ?? 0.25;
      this.params.p2 = this.params.p2 ?? 0.125; this.params.p3 = this.params.p3 ?? 0.125;
    }
    if (id === 'huffmanFreqs' || id === '_preset') this._rebuildHuffman();
    this._dirty = true;
  }

  render(ctx, canvas) {
    const W = canvas.width, H = canvas.height;
    clearCanvas(ctx, W, H, '#fff');
    const v = this.params.view;
    if (v === 'entropy') this._renderEntropy(ctx, W, H);
    else if (v === 'huffman') this._renderHuffman(ctx, W, H);
    else if (v === 'channel') this._renderChannel(ctx, W, H);
  }

  _renderEntropy(ctx, W, H) {
    const probs = this._normalizedProbs();
    const H_X = entropy(probs);
    const maxH = Math.log2(probs.length);
    const pad = 60, gw = W - 2 * pad, gh = H - 2 * pad - 40;
    const bw = gw / probs.length;
    const cols = ['#c42020', '#1a4fa8', '#1a6b1a', '#a05000'];
    probs.forEach((p, i) => {
      const h = p * gh * 2;
      ctx.fillStyle = cols[i]; ctx.fillRect(pad + i * bw + bw * 0.15, pad + gh - h, bw * 0.7, h);
      ctx.fillStyle = '#333'; ctx.font = '11px Courier New'; ctx.textAlign = 'center';
      ctx.fillText(`p${i+1}=${p.toFixed(3)}`, pad + i * bw + bw / 2, pad + gh + 16);
    });
    ctx.strokeStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(pad, pad + gh); ctx.lineTo(pad + gw, pad + gh); ctx.stroke();

    label(ctx, `H(X) = ${H_X.toFixed(4)} bits   (max possible = log\u2082(${probs.length}) = ${maxH.toFixed(4)} bits)`, pad, 8, { color: '#333', size: 13, bg: 'rgba(255,255,255,0.9)' });
    // Entropy fraction bar
    const fracW = (H_X / maxH) * gw;
    ctx.fillStyle = 'rgba(26,107,26,0.5)'; ctx.fillRect(pad, pad + gh + 34, fracW, 14);
    ctx.strokeStyle = '#888'; ctx.strokeRect(pad, pad + gh + 34, gw, 14);
    label(ctx, `${(100 * H_X / maxH).toFixed(1)}% of maximum entropy`, pad, pad + gh + 52, { color: '#1a6b1a', size: 10 });
  }

  _renderHuffman(ctx, W, H) {
    if (!this._huffmanTree) { label(ctx, 'No valid symbol:frequency pairs parsed', 20, 20, { color: '#c42020', size: 12 }); return; }
    const depth = treeDepth(this._huffmanTree);
    const positions = new Map();
    assignPositions(this._huffmanTree, 0, [40, W - 40], positions);
    const rowH = Math.min(70, (H - 140) / Math.max(1, depth));
    const draw = (node) => {
      const pos = positions.get(node.id);
      const px = pos.x, py = 30 + pos.y * rowH;
      if (!node.isLeaf) {
        for (const [child, bit] of [[node.left, '0'], [node.right, '1']]) {
          const cp = positions.get(child.id);
          const cx = cp.x, cy = 30 + cp.y * rowH;
          ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, cy); ctx.stroke();
          ctx.fillStyle = '#888'; ctx.font = '10px Courier New'; ctx.textAlign = 'center';
          ctx.fillText(bit, (px + cx) / 2 + (bit === '0' ? -8 : 8), (py + cy) / 2);
          draw(child);
        }
      }
      ctx.fillStyle = node.isLeaf ? '#1a4fa8' : '#888';
      ctx.beginPath(); ctx.arc(px, py, node.isLeaf ? 5 : 3, 0, Math.PI * 2); ctx.fill();
      if (node.isLeaf) {
        ctx.fillStyle = '#333'; ctx.font = '11px Courier New'; ctx.textAlign = 'center';
        ctx.fillText(`${node.symbol}:${node.freq}`, px, py + 16);
        ctx.fillStyle = '#1a4fa8'; ctx.font = 'bold 10px Courier New';
        ctx.fillText(this._huffmanCodes[node.symbol], px, py + 29);
      }
    };
    draw(this._huffmanTree);

    const total = this._huffmanFreqsList.reduce((s, f) => s + f.freq, 0);
    const probs = this._huffmanFreqsList.map(f => f.freq / total);
    const H_X = entropy(probs);
    const avgLen = this._huffmanFreqsList.reduce((s, f) => s + (f.freq / total) * this._huffmanCodes[f.symbol].length, 0);
    label(ctx, `Entropy H(X) = ${H_X.toFixed(4)} bits/symbol   Huffman average = ${avgLen.toFixed(4)} bits/symbol`, 8, H - 34, { color: '#333', size: 11, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, `Overhead: ${(avgLen - H_X).toFixed(4)} bits (Huffman is provably within 1 bit of entropy)`, 8, H - 16, { color: '#666', size: 10, bg: 'rgba(255,255,255,0.86)' });
  }

  _renderChannel(ctx, W, H) {
    const pad = 60;
    const gw = W - 2 * pad, gh = H - 2 * pad - 20;
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, pad + gh); ctx.lineTo(pad + gw, pad + gh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, pad + gh); ctx.stroke();
    ctx.strokeStyle = '#1a4fa8'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const p = 0.5 * i / 200;
      const C = 1 - binaryEntropy(p);
      const x = pad + (p / 0.5) * gw, y = pad + gh - C * gh;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    const p0 = this.params.crossoverP, C0 = 1 - binaryEntropy(p0);
    const cx0 = pad + (p0 / 0.5) * gw, cy0 = pad + gh - C0 * gh;
    ctx.fillStyle = '#c42020'; ctx.beginPath(); ctx.arc(cx0, cy0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(196,32,32,0.4)'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cx0, pad + gh); ctx.lineTo(cx0, cy0); ctx.lineTo(pad, cy0); ctx.stroke();
    ctx.setLineDash([]);

    label(ctx, `Binary Symmetric Channel capacity  C(p) = 1 \u2212 H\u2082(p)`, pad, 8, { color: '#333', size: 12, bg: 'rgba(255,255,255,0.9)' });
    label(ctx, `At p=${p0.toFixed(3)}: C = ${C0.toFixed(4)} bits/use`, pad, 26, { color: '#c42020', size: 11, bg: 'rgba(255,255,255,0.86)' });
    label(ctx, 'p=0: perfect channel, C=1.  p=0.5: pure noise, C=0 (output independent of input)', pad, H - 12, { color: '#666', size: 10 });
    ctx.fillStyle = '#888'; ctx.font = '10px Courier New'; ctx.textAlign = 'center';
    ctx.fillText('crossover probability p', W/2, H - 30);
  }

  coordInfo() { return `view: ${this.params.view}`; }
}
