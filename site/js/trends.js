import { renderNav, loadData, datesIn, movesBetween, artistsOn, fmt, fmtPct, fmtSigned, compact, esc,
         showError, store, cmp, LABELS, METRICS, SOURCE_OF } from "./common.js";
import { lineChart, barChart, SERIES } from "./charts.js";

renderNav("trends.html");
const app = document.getElementById("app");
const SEL_KEY = "music-tracker-trend-selection";

let rows = [], dates = [], names = new Map();

try {
  ({ rows } = await loadData());
  dates = datesIn(rows);
  for (const r of rows) names.set(r.item_id, r.item);
  render();
} catch (e) {
  showError(app, e);
}

// value of one column for one artist on one date (from the source that reports it)
function seriesOf(itemId, metric) {
  const m = new Map();
  for (const r of rows)
    if (r.item_id === itemId && r.source === SOURCE_OF[metric] && r[metric] !== null) m.set(r.date, r[metric]);
  return m;
}
// first and last non-empty value of a column for every artist
function firstLast(metric) {
  const out = [];
  for (const id of [...names.keys()].sort(cmp)) {
    const s = seriesOf(id, metric);
    const ds = [...s.keys()].sort();
    if (ds.length < 2) continue;
    const d0 = ds[0], d1 = ds[ds.length - 1];
    out.push({ id, item: names.get(id), d0, d1, v0: s.get(d0), v1: s.get(d1),
               days: (Date.parse(d1) - Date.parse(d0)) / 86400000 });
  }
  return out;
}

function render() {
  if (!dates.length) { app.innerHTML = `<div class="card empty">No data yet.</div>`; return; }
  const span = `${dates[0]} to ${dates[dates.length - 1]} (${dates.length} day${dates.length > 1 ? "s" : ""})`;
  app.innerHTML = `
    <h1>Trends</h1>
    <p class="lede">A report on the history the pipeline has built: ${span}. Every number below is computed in your browser from <code>data/history.csv</code>, so the page updates as the history grows.</p>

    <section class="card">
      <h2>Each value over the days</h2>
      <div class="controls">
        <label class="control">Value<select id="metric">${METRICS.map(m => `<option value="${m}">${LABELS[m]}</option>`).join("")}</select></label>
        <label class="control">Show as<select id="mode"><option value="abs">Actual values</option><option value="pct">% change since first day</option></select></label>
      </div>
      <div class="control" style="margin-bottom:10px">Artists (pick up to ${SERIES})</div>
      <div id="picker" class="chips" style="margin-bottom:14px"></div>
      <div id="main-chart"></div>
    </section>
    <div id="findings"></div>`;

  setupMainChart();
  renderFindings();
}

// ---------- main chart with item picker ----------
function setupMainChart() {
  const ids = [...names.keys()].sort((a, b) => cmp(names.get(a), names.get(b)));
  // slot follows the artist: picked artists keep their color when others change
  let slots = new Map(store.get(SEL_KEY, ["sza", "tame-impala", "green-day", "flo-milli", "tyler-childers"])
    .filter(id => names.has(id)).slice(0, SERIES).map((id, i) => [id, i + 1]));
  const picker = document.getElementById("picker");
  const draw = () => {
    picker.innerHTML = ids.map(id => {
      const s = slots.get(id);
      return `<button class="chip" data-id="${id}" aria-pressed="${!!s}"><span class="swatch" style="${s ? `background:var(--series-${s})` : ""}"></span>${esc(names.get(id))}</button>`;
    }).join("");
    const metric = document.getElementById("metric").value;
    const mode = document.getElementById("mode").value;
    const series = [...slots.entries()].sort((a, b) => a[1] - b[1]).map(([id, slot]) => {
      let values = seriesOf(id, metric);
      if (mode === "pct") {
        const first = values.get([...values.keys()].sort()[0]);
        values = new Map([...values].map(([d, v]) => [d, first ? (v / first - 1) * 100 : null]));
      }
      return { name: names.get(id), slot, values };
    });
    const isPct = mode === "pct";
    lineChart(document.getElementById("main-chart"), {
      dates, series,
      fmtY: v => isPct ? v.toFixed(Math.abs(v) < 1 ? 2 : 1) + "%" : compact(v),
      fmtV: v => isPct ? fmtPct(v, 3) : fmt(v),
    });
  };
  picker.addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    const id = b.dataset.id;
    if (slots.has(id)) slots.delete(id);
    else {
      if (slots.size >= SERIES) return;
      const used = new Set(slots.values());
      let s = 1; while (used.has(s)) s++;
      slots.set(id, s);
    }
    store.set(SEL_KEY, [...slots.keys()]);
    draw();
  });
  document.getElementById("metric").addEventListener("change", draw);
  document.getElementById("mode").addEventListener("change", draw);
  draw();
  let w = window.innerWidth;
  window.addEventListener("resize", () => { if (Math.abs(window.innerWidth - w) > 40) { w = window.innerWidth; draw(); } });
}

// ---------- findings ----------
function section(heading, paragraph, how, chartOpts, table) {
  const s = document.createElement("section");
  s.className = "card finding";
  s.innerHTML = `<h2>${heading}</h2><p>${paragraph}</p><p class="how">How it's computed: ${how}</p><div class="fchart"></div>
    ${table ? `<details><summary>Show the numbers as a table</summary><div class="table-wrap">${table}</div></details>` : ""}`;
  document.getElementById("findings").appendChild(s);
  if (chartOpts) barChart(s.querySelector(".fchart"), chartOpts);
  return s;
}
function tbl(head, body) {
  return `<table><thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ""}>${h}</th>`).join("")}</tr></thead><tbody>${
    body.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function notEnough(title) {
  section(title, "This finding needs at least two days of history. It will fill in automatically after the next daily run.",
    "compares the first and latest dates in the history file.", null, null);
}

function renderFindings() {
  // 1. Listener growth
  const lis = firstLast("listeners").map(o => ({ ...o, pct: (o.v1 - o.v0) / o.v0 * 100, gain: o.v1 - o.v0 }))
    .sort((a, b) => b.pct - a.pct || cmp(a.id, b.id));
  if (lis.length) {
    const top = lis[0], bottom = lis[lis.length - 1];
    section(`${esc(top.item)} grew their Last.fm audience the fastest: ${fmtPct(top.pct, 3)} listeners since ${top.d0}`,
      `${esc(top.item)} went from ${fmt(top.v0)} to ${fmt(top.v1)} Last.fm listeners between ${top.d0} and ${top.d1}, a gain of ${fmtSigned(top.gain)}.
       At the other end, ${esc(bottom.item)} changed by ${fmtPct(bottom.pct, 3)} (${fmtSigned(bottom.gain)}).
       Listeners count unique people who have ever played the artist, so a big percentage jump points to new listeners discovering them.`,
      "for each artist, (listeners on the latest date − listeners on the first date) ÷ listeners on the first date × 100, using the lastfm rows.",
      { bars: lis.map(o => ({ label: o.item, value: o.pct, note: `${fmt(o.v0)} → ${fmt(o.v1)}` })), fmtV: v => fmtPct(v, 3), fmtAxis: v => v.toFixed(2) + "%" },
      tbl(["Artist", `Listeners ${lis[0].d0}`, `Listeners ${lis[0].d1}`, "Change", "% change"],
        lis.map(o => [esc(o.item), fmt(o.v0), fmt(o.v1), fmtSigned(o.gain), fmtPct(o.pct, 3)])));
  } else notEnough("Who is growing their Last.fm audience fastest?");

  // 2. Plays per day
  const plays = firstLast("playcount").map(o => ({ ...o, perDay: (o.v1 - o.v0) / o.days }))
    .sort((a, b) => b.perDay - a.perDay || cmp(a.id, b.id));
  if (plays.length) {
    const top = plays[0], second = plays[1];
    const total = plays.reduce((s, o) => s + o.perDay, 0);
    section(`${esc(top.item)} piles up the most plays: about ${fmt(top.perDay)} Last.fm scrobbles a day`,
      `Between ${top.d0} and ${top.d1}, ${esc(top.item)}'s Last.fm play count rose from ${fmt(top.v0)} to ${fmt(top.v1)}, about ${fmt(top.perDay)} plays per day.
       ${second ? `${esc(second.item)} is next with about ${fmt(second.perDay)} a day. ` : ""}Together the ${plays.length} artists gained about ${fmt(total)} plays per day,
       and ${esc(top.item)} alone accounts for ${(top.perDay / total * 100).toFixed(1)}% of that.`,
      "for each artist, (playcount on the latest date − playcount on the first date) ÷ the number of days between those dates, using the lastfm rows.",
      { bars: plays.map(o => ({ label: o.item, value: o.perDay, note: `${fmt(o.v0)} → ${fmt(o.v1)} over ${o.days} day(s)` })), fmtV: v => fmt(v), fmtAxis: compact },
      tbl(["Artist", "First playcount", "Latest playcount", "Days", "Plays per day"],
        plays.map(o => [esc(o.item), fmt(o.v0), fmt(o.v1), o.days, fmt(o.perDay)])));
  } else notEnough("Who adds the most plays per day?");

  // 3. Deezer fans gained or lost
  const fans = firstLast("fans").map(o => ({ ...o, gain: o.v1 - o.v0 }))
    .sort((a, b) => b.gain - a.gain || cmp(a.id, b.id));
  if (fans.length) {
    const top = fans[0], losers = fans.filter(o => o.gain < 0), flat = fans.filter(o => o.gain === 0);
    section(`${esc(top.item)} won the most Deezer fans: ${fmtSigned(top.gain)} since ${top.d0}`,
      `${esc(top.item)} went from ${fmt(top.v0)} to ${fmt(top.v1)} Deezer fans. ${losers.length
        ? `${losers.length} artist${losers.length > 1 ? "s" : ""} lost fans, led by ${esc(losers[losers.length - 1].item)} (${fmtSigned(losers[losers.length - 1].gain)}).`
        : "No artist lost fans over this period."} ${flat.length ? `${flat.length} did not change at all.` : ""}
       Deezer fans are people who follow the artist, and unlike Last.fm listeners they can go down when people unfollow.`,
      "for each artist, fans on the latest date − fans on the first date, using the deezer rows.",
      { bars: fans.map(o => ({ label: o.item, value: o.gain, note: `${fmt(o.v0)} → ${fmt(o.v1)}` })), fmtV: fmtSigned, fmtAxis: compact },
      tbl(["Artist", "First fans", "Latest fans", "Change"], fans.map(o => [esc(o.item), fmt(o.v0), fmt(o.v1), fmtSigned(o.gain)])));
  } else notEnough("Who is winning Deezer fans?");

  // 4. Biggest single-day move, day by day
  const daily = [];
  for (let i = 1; i < dates.length; i++) {
    const all = movesBetween(rows, dates[i - 1], dates[i]);
    if (all.length) daily.push(all[0]);
  }
  if (daily.length) {
    const best = [...daily].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || cmp(a.date, b.date))[0];
    section(`The biggest single-day move was ${esc(best.item)}'s ${LABELS[best.metric].toLowerCase()} on ${best.date}: ${fmtPct(best.pct)}`,
      `On ${best.date}, ${esc(best.item)}'s ${LABELS[best.metric].toLowerCase()} went from ${fmt(best.old)} to ${fmt(best.new)} (${fmtSigned(best.change)}), the largest one-day percent change of any value in the history.
       The chart shows the largest move of each day. Top-track rank is Deezer's popularity score for the artist's most popular track, and it swings far more than follower counts, so it usually drives the biggest days.`,
      "for every pair of consecutive dates, apply the move rule (percent change of each artist's fans, top-track rank, listeners and playcount from one date to the next) and keep the largest change by size; the headline is the largest of those.",
      { bars: daily.map(m => ({ label: m.date, value: m.pct, note: `${m.item} · ${LABELS[m.metric]}: ${fmt(m.old)} → ${fmt(m.new)}` })), fmtV: v => fmtPct(v), fmtAxis: v => v.toFixed(0) + "%" },
      tbl(["Date", "Artist", "Value", "Old", "New", "% change"], daily.map(m => [m.date, esc(m.item), LABELS[m.metric], fmt(m.old), fmt(m.new), fmtPct(m.pct)])));
  } else notEnough("Which day had the biggest move?");

  // 5. Plays per listener (works from day one)
  const latest = dates[dates.length - 1];
  const eng = artistsOn(rows, latest).filter(a => a.listeners && a.playcount)
    .map(a => ({ ...a, ppl: a.playcount / a.listeners }))
    .sort((a, b) => b.ppl - a.ppl || cmp(a.item_id, b.item_id));
  if (eng.length) {
    const top = eng[0], low = eng[eng.length - 1];
    const bigL = [...eng].sort((a, b) => b.listeners - a.listeners)[0], smallL = [...eng].sort((a, b) => a.listeners - b.listeners)[0];
    section(`${esc(top.item)} has the most devoted listeners: ${top.ppl.toFixed(1)} plays per listener`,
      `On ${latest}, ${esc(top.item)} had ${fmt(top.playcount)} Last.fm plays from ${fmt(top.listeners)} listeners, ${top.ppl.toFixed(1)} plays each,
       ${(top.ppl / low.ppl).toFixed(1)}× the ${low.ppl.toFixed(1)} of ${esc(low.item)}. Audience size is a different story:
       ${esc(bigL.item)} has the most listeners (${fmt(bigL.listeners)}), ${(bigL.listeners / smallL.listeners).toFixed(0)}× ${esc(smallL.item)} (${fmt(smallL.listeners)}).`,
      "for each artist on the latest date, playcount ÷ listeners from the lastfm rows; the size comparison is largest listeners ÷ smallest listeners.",
      { bars: eng.map(a => ({ label: a.item, value: a.ppl, note: `${fmt(a.playcount)} plays / ${fmt(a.listeners)} listeners` })), fmtV: v => v.toFixed(1), fmtAxis: v => String(v) },
      tbl(["Artist", "Plays", "Listeners", "Plays per listener"], eng.map(a => [esc(a.item), fmt(a.playcount), fmt(a.listeners), a.ppl.toFixed(1)])));
  }
}
