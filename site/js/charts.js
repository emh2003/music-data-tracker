// Small SVG charts with hover tooltips. No library, so the site works offline.
import { esc } from "./common.js";

const NS = "http://www.w3.org/2000/svg";
export const SERIES = 8; // categorical slots; never cycled

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

function niceTicks(min, max, count = 5) {
  if (min === max) { max = min + 1; min = min - 1; }
  const span = max - min;
  const step0 = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = span / count / step0;
  const step = step0 * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

function tooltip(container) {
  let t = container.querySelector(".tooltip");
  if (!t) { t = document.createElement("div"); t.className = "tooltip"; container.appendChild(t); }
  return {
    show(html, x, y) {
      t.innerHTML = html;
      t.style.opacity = 1;
      const w = container.clientWidth, tw = t.offsetWidth;
      t.style.left = Math.min(Math.max(0, x + 12), w - tw) + "px";
      t.style.top = Math.max(0, y - 10) + "px";
    },
    hide() { t.style.opacity = 0; },
  };
}

const shortDate = d => { const [, m, day] = d.split("-"); return `${+m}/${+day}`; };

/**
 * Line chart. series: [{name, slot, values: Map(date -> number)}], dates: sorted list.
 * fmtY formats axis ticks, fmtV formats tooltip values.
 */
export function lineChart(container, { dates, series, fmtY, fmtV, height = 300 }) {
  container.innerHTML = "";
  container.classList.add("chart");
  const W = Math.max(320, container.clientWidth || 800), H = height;
  const m = { t: 12, r: 16, b: 28, l: 64 };
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Line chart" }, container);
  const vals = series.flatMap(s => dates.map(d => s.values.get(d)).filter(v => v !== undefined && v !== null));
  if (!vals.length || !dates.length) {
    container.innerHTML = `<div class="empty">No data for this selection yet.</div>`;
    return;
  }
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x = i => m.l + (dates.length === 1 ? (W - m.l - m.r) / 2 : i * (W - m.l - m.r) / (dates.length - 1));
  const y = v => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);

  const g = el("g", { class: "grid" }, svg);
  for (const tv of ticks) {
    el("line", { x1: m.l, x2: W - m.r, y1: y(tv), y2: y(tv) }, g);
    el("text", { x: m.l - 8, y: y(tv) + 4, "text-anchor": "end" }, svg).textContent = fmtY(tv);
  }
  const every = Math.ceil(dates.length / Math.max(2, Math.floor((W - m.l) / 70)));
  dates.forEach((d, i) => {
    if (i % every === 0 || i === dates.length - 1)
      el("text", { x: x(i), y: H - 8, "text-anchor": "middle" }, svg).textContent = shortDate(d);
  });

  for (const s of series) {
    const color = `var(--series-${s.slot})`;
    let path = "", pen = false;
    dates.forEach((d, i) => {
      const v = s.values.get(d);
      if (v === undefined || v === null) { pen = false; return; }
      path += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    el("path", { d: path, fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    dates.forEach((d, i) => {
      const v = s.values.get(d);
      if (v !== undefined && v !== null && dates.length <= 40)
        el("circle", { cx: x(i), cy: y(v), r: 3.5, fill: color, stroke: "var(--surface-1)", "stroke-width": 2 }, svg);
    });
  }

  // crosshair + tooltip
  const tip = tooltip(container);
  const cross = el("line", { y1: m.t, y2: H - m.b, stroke: "var(--text-muted)", "stroke-dasharray": "3 3", opacity: 0 }, svg);
  const hit = el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" }, svg);
  const move = ev => {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (W / r.width);
    const i = dates.length === 1 ? 0 : Math.round((px - m.l) / ((W - m.l - m.r) / (dates.length - 1)));
    const idx = Math.max(0, Math.min(dates.length - 1, i));
    cross.setAttribute("x1", x(idx)); cross.setAttribute("x2", x(idx)); cross.setAttribute("opacity", 1);
    const d = dates[idx];
    const rows = series
      .map(s => ({ s, v: s.values.get(d) }))
      .filter(o => o.v !== undefined && o.v !== null)
      .sort((a, b) => b.v - a.v)
      .map(o => `<div class="t-row"><span class="t-key" style="--c:var(--series-${o.s.slot})">${esc(o.s.name)}</span><span>${fmtV(o.v)}</span></div>`)
      .join("");
    tip.show(`<div class="t-title">${d}</div>${rows || "no values"}`, x(idx) * r.width / W, ev.clientY - r.top);
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerleave", () => { tip.hide(); cross.setAttribute("opacity", 0); });

  // legend (always, for 2+ series)
  if (series.length > 1) {
    const lg = document.createElement("div");
    lg.className = "legend";
    lg.innerHTML = series.map(s => `<span style="--c:var(--series-${s.slot})">${esc(s.name)}</span>`).join("");
    container.appendChild(lg);
  }
}

/**
 * Horizontal bar chart. bars: [{label, value, note?}]. Positive and negative values
 * share one zero baseline; negatives use the second color and say "down" in the tooltip.
 */
export function barChart(container, { bars, fmtV, fmtAxis = fmtV }) {
  container.innerHTML = "";
  container.classList.add("chart");
  if (!bars.length) { container.innerHTML = `<div class="empty">Not enough history yet.</div>`; return; }
  const W = Math.max(320, container.clientWidth || 800);
  const rowH = 26, m = { t: 6, r: 90, b: 24, l: 150 };
  const H = m.t + m.b + bars.length * rowH;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Bar chart" }, container);
  const lo = Math.min(0, ...bars.map(b => b.value)), hi = Math.max(0, ...bars.map(b => b.value));
  const ticks = niceTicks(lo, hi, 4);
  const a = ticks[0], z = ticks[ticks.length - 1];
  const x = v => m.l + (v - a) / (z - a) * (W - m.l - m.r);
  const g = el("g", { class: "grid" }, svg);
  for (const tv of ticks) {
    el("line", { x1: x(tv), x2: x(tv), y1: m.t, y2: H - m.b }, g);
    el("text", { x: x(tv), y: H - 6, "text-anchor": "middle" }, svg).textContent = fmtAxis(tv);
  }
  const tip = tooltip(container);
  bars.forEach((b, i) => {
    const yy = m.t + i * rowH;
    const neg = b.value < 0;
    const x0 = x(0), x1 = x(b.value);
    const w = Math.max(1, Math.abs(x1 - x0));
    const left = Math.min(x0, x1);
    el("text", { x: m.l - 10, y: yy + rowH / 2 + 4, "text-anchor": "end", style: "fill:var(--text-primary)" }, svg).textContent = b.label;
    // bar with a 4px rounded data-end, anchored square on the baseline
    const h = rowH - 8, r = Math.min(4, w / 2);
    const top = yy + 4;
    const d = neg
      ? `M${x0},${top} H${left + r} Q${left},${top} ${left},${top + r} V${top + h - r} Q${left},${top + h} ${left + r},${top + h} H${x0} Z`
      : `M${x0},${top} H${x1 - r} Q${x1},${top} ${x1},${top + r} V${top + h - r} Q${x1},${top + h} ${x1 - r},${top + h} H${x0} Z`;
    el("path", { d, fill: neg ? "var(--series-2)" : "var(--series-1)" }, svg);
    // value label: past the end of a positive bar; just right of the baseline for a negative one
    el("text", { x: (neg ? x0 : x1) + 6, y: yy + rowH / 2 + 4, "text-anchor": "start" }, svg).textContent = fmtV(b.value);
    const hit = el("rect", { x: 0, y: yy, width: W, height: rowH, fill: "transparent" }, svg);
    hit.addEventListener("pointermove", ev => {
      const r = svg.getBoundingClientRect();
      tip.show(`<div class="t-title">${esc(b.label)}</div><div class="t-row"><span>${neg ? "Down" : "Value"}</span><span>${fmtV(b.value)}</span></div>${b.note ? `<div class="small muted">${esc(b.note)}</div>` : ""}`,
        ev.clientX - r.left, ev.clientY - r.top);
    });
    hit.addEventListener("pointerleave", () => tip.hide());
  });
  el("line", { class: "baseline", x1: x(0), x2: x(0), y1: m.t, y2: H - m.b }, svg);
}
