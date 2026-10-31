'use strict';

// 小型 SVG 圖表：單一數列的長條圖與折線圖，含點按提示框
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function niceTicks(min, max, count = 4) {
    if (min === max) { min -= 1; max += 1; }
    const raw = (max - min) / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
    return ticks;
  }

  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function fmt(v) {
    return Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('zh-TW', { maximumFractionDigits: 1 }) + 'k'
                               : v.toLocaleString('zh-TW', { maximumFractionDigits: 1 });
  }

  /**
   * points: [{ label, value, tip }]
   * opts: { type: 'bar' | 'line', zero: bool, height, ariaLabel }
   */
  function draw(container, points, opts) {
    container.textContent = '';
    const W = Math.max(container.clientWidth, 240);
    const H = opts.height || 170;
    const padL = 38, padR = 10, padT = 8, padB = 24;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const values = points.map(p => p.value);
    const target = Number.isFinite(opts.target) ? opts.target : null;
    let lo = Math.min(...values), hi = Math.max(...values, target ?? -Infinity);
    if (opts.zero) lo = Math.min(0, lo);
    if (!opts.zero) { const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.05 || 1; lo -= pad; hi += pad; }
    const ticks = niceTicks(lo, hi);
    const yMin = ticks[0], yMax = ticks[ticks.length - 1];
    const y = v => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    const n = points.length;
    const band = plotW / n;
    const inset = opts.type === 'line' ? 8 : 0;
    const x = i => opts.type === 'bar'
      ? padL + band * (i + 0.5)
      : n === 1 ? padL + plotW / 2 : padL + inset + ((plotW - inset * 2) * i) / (n - 1);

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': opts.ariaLabel || '' });

    for (const t of ticks) {
      const ty = y(t);
      svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: ty, y2: ty, class: t === yMin ? 'c-base' : 'c-grid' }));
      const lab = el('text', { x: padL - 6, y: ty + 4, 'text-anchor': 'end', class: 'c-lab' });
      lab.textContent = fmt(t);
      svg.appendChild(lab);
    }

    // 只標首、中、尾三個 x 標籤，避免擠在一起
    const xIdx = [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
    for (const i of xIdx) {
      const anchor = n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      const lx = opts.type === 'bar' ? (anchor === 'start' ? x(i) - band * 0.3 : anchor === 'end' ? x(i) + band * 0.3 : x(i)) : x(i);
      const t = el('text', { x: lx, y: H - 6, 'text-anchor': anchor, class: 'c-lab' });
      t.textContent = points[i].label;
      svg.appendChild(t);
    }

    const marks = [];
    let cross = null;
    if (opts.type === 'bar') {
      const bw = Math.min(28, band * 0.62);
      const base = y(Math.max(0, yMin));
      points.forEach((p, i) => {
        const top = y(p.value), h = base - top;
        if (h <= 0) { marks.push(null); return; }
        const r = Math.min(4, h, bw / 2), x0 = x(i) - bw / 2;
        const d = `M${x0},${base}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${base}Z`;
        const path = el('path', { d, class: 'c-bar' });
        svg.appendChild(path);
        marks.push(path);
      });
    } else {
      if (n > 1) {
        const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join('');
        svg.appendChild(el('path', { d, class: 'c-line' }));
      }
      cross = el('line', { y1: padT, y2: padT + plotH, class: 'c-cross', visibility: 'hidden' });
      svg.appendChild(cross);
      points.forEach((p, i) => {
        const show = n <= 16 || i === n - 1;
        const dot = el('circle', { cx: x(i), cy: y(p.value), r: 4, class: 'c-dot', visibility: show ? 'visible' : 'hidden' });
        dot.dataset.always = show ? '1' : '';
        svg.appendChild(dot);
        marks.push(dot);
      });
    }

    // 目標參考線：畫在資料上方，標籤放右上
    if (target !== null) {
      const ty = y(target);
      svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: ty, y2: ty, class: 'c-target' }));
      const lab = el('text', { x: W - padR, y: ty - 5, 'text-anchor': 'end', class: 'c-lab c-target-lab' });
      lab.textContent = `目標 ${fmt(target)}`;
      svg.appendChild(lab);
    }

    const hit = el('rect', { x: padL, y: 0, width: plotW, height: H - padB, class: 'c-hit' });
    svg.appendChild(hit);
    container.appendChild(svg);

    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.hidden = true;
    container.appendChild(tip);

    let active = -1;
    function show(i) {
      if (i === active) return;
      active = i;
      marks.forEach((m, j) => {
        if (!m) return;
        if (opts.type === 'bar') m.classList.toggle('dim', i >= 0 && j !== i);
        else { m.setAttribute('r', j === i ? 5 : 4); m.setAttribute('visibility', j === i || m.dataset.always ? 'visible' : 'hidden'); }
      });
      if (i < 0) { tip.hidden = true; if (cross) cross.setAttribute('visibility', 'hidden'); return; }
      if (cross) { cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible'); }
      tip.textContent = points[i].tip;
      tip.hidden = false;
      const half = tip.offsetWidth / 2;
      tip.style.left = Math.min(Math.max(x(i), half), W - half) + 'px';
    }
    function pick(ev) {
      const rect = svg.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * W;
      let best = 0, bd = Infinity;
      for (let i = 0; i < n; i++) { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } }
      show(best);
    }
    hit.addEventListener('pointerdown', pick);
    hit.addEventListener('pointermove', pick);
    hit.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') show(-1); });
  }

  return { draw };
})();
