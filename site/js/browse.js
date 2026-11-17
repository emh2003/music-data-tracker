import { renderNav, loadData, latestAndPrevious, artistsOn, datesIn, fmt, compact, esc, showError, store, cmp,
         avatar, badge, starButton, shortlist, LABELS } from "./common.js";
import { sparkline } from "./charts.js";
import { initArtistSheet } from "./artist.js";

renderNav("browse.html");
const app = document.getElementById("app");
const VIEW_KEY = "music-tracker-browse-view";
const NUM_COLS = ["fans", "albums", "top_track_rank", "listeners", "playcount"];

let artists = [], before = new Map(), trend = new Map();
let sort = { key: "listeners", dir: -1 };
let view = store.get(VIEW_KEY, "cards");
let genre = "";

try {
  const { rows } = await loadData();
  const [latest, previous] = latestAndPrevious(rows);
  artists = latest ? artistsOn(rows, latest) : [];
  before = new Map(previous ? artistsOn(rows, previous).map(a => [a.item_id, a]) : []);
  const dates = datesIn(rows);
  for (const a of artists) {   // listeners over the days, for the card sparkline
    const by = new Map(rows.filter(r => r.item_id === a.item_id && r.source === "lastfm").map(r => [r.date, r.listeners]));
    trend.set(a.item_id, dates.map(d => by.get(d) ?? null));
  }
  setup(latest);
  initArtistSheet(rows);
} catch (e) {
  showError(app, e);
}

function setup(latest) {
  const genres = [...new Set(artists.map(a => a.genre))].sort();
  app.innerHTML = `
    <div class="eyebrow">${latest ? `Latest · ${latest}` : ""}</div>
    <h1>Browse the <span class="grad-text">lineup</span></h1>
    <p class="lede">Latest values for every artist. Filter, search, sort, and ☆ star your favorites to build a shortlist that stays on this device. Tap a card for the full story.</p>
    <div class="card">
      <div class="controls">
        <label class="control search">Search artists<input type="search" id="q" placeholder="Try “tame”…  press / to jump here"></label>
        <label class="control">Last.fm listeners<select id="minListeners">
          <option value="0">Any size</option><option value="500000">500K+</option><option value="1000000">1M+</option>
          <option value="3000000">3M+</option><option value="5000000">5M+</option></select></label>
        <label class="control">Deezer fans<select id="minFans">
          <option value="0">Any size</option><option value="100000">100K+</option><option value="1000000">1M+</option>
          <option value="5000000">5M+</option></select></label>
        <label class="control">Sort by<select id="sortSel">
          ${NUM_COLS.flatMap(k => [[k, -1], [k, 1]]).map(([k, d]) => `<option value="${k}:${d}">${LABELS[k]} ${d < 0 ? "↓ high to low" : "↑ low to high"}</option>`).join("")}
          <option value="item:1">Artist A→Z</option><option value="item:-1">Artist Z→A</option></select></label>
        <label class="check"><input type="checkbox" id="starOnly"> ★ Shortlist only</label>
        <span class="spacer" style="flex:1"></span>
        <div class="seg" role="group" aria-label="View">
          <button type="button" data-view="cards" aria-pressed="${view === "cards"}">▦ Cards</button>
          <button type="button" data-view="table" aria-pressed="${view === "table"}">☰ Table</button>
        </div>
      </div>
      <div class="chips" id="genres" style="margin-bottom:14px" role="group" aria-label="Genre">
        <button class="chip plain" data-genre="" aria-pressed="true">All genres</button>
        ${genres.map(g => `<button class="chip plain" data-genre="${esc(g)}" aria-pressed="false">${esc(g)}</button>`).join("")}
      </div>
      <p class="small muted" id="count"></p>
      <div id="results"></div>
    </div>
    <div class="card"><div class="card-head"><h2>★ Your shortlist</h2><span class="small muted">Saved in this browser</span></div><div id="shortlist" class="chips"></div></div>`;

  for (const id of ["q", "minListeners", "minFans", "starOnly"])
    document.getElementById(id).addEventListener("input", draw);
  document.getElementById("sortSel").addEventListener("change", e => {
    const [k, d] = e.target.value.split(":");
    sort = { key: k, dir: Number(d) };
    draw();
  });
  document.getElementById("genres").addEventListener("click", e => {
    const b = e.target.closest("[data-genre]");
    if (!b) return;
    genre = b.dataset.genre;
    document.querySelectorAll("#genres .chip").forEach(c => c.setAttribute("aria-pressed", c === b));
    draw();
  });
  app.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => {
    view = b.dataset.view;
    store.set(VIEW_KEY, view);
    app.querySelectorAll("[data-view]").forEach(x => x.setAttribute("aria-pressed", x === b));
    draw();
  }));
  app.addEventListener("click", e => {
    const th = e.target.closest("th.sortable");
    if (!th) return;
    const k = th.dataset.key;
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === "item" ? 1 : -1 };
    draw();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "/" && !/input|select|textarea/i.test(document.activeElement.tagName)) {
      e.preventDefault(); document.getElementById("q").focus();
    }
  });
  document.addEventListener("shortlistchange", () => draw());
  draw();
}

function filtered() {
  const q = document.getElementById("q").value.trim().toLowerCase();
  const minL = Number(document.getElementById("minListeners").value);
  const minF = Number(document.getElementById("minFans").value);
  const starOnly = document.getElementById("starOnly").checked;
  const stars = shortlist.ids();
  const list = artists.filter(a =>
    (!q || a.item.toLowerCase().includes(q)) &&
    (!genre || a.genre === genre) &&
    (!minL || (a.listeners ?? -1) >= minL) &&
    (!minF || (a.fans ?? -1) >= minF) &&
    (!starOnly || stars.has(a.item_id)));
  list.sort((a, b) => {
    if (sort.key === "item") return sort.dir * cmp(a.item.toLowerCase(), b.item.toLowerCase());
    const x = a[sort.key], y = b[sort.key];
    if (x == null && y == null) return 0;
    if (x == null) return 1;          // empty values always last
    if (y == null) return -1;
    return sort.dir * (x - y);
  });
  return list;
}

function draw() {
  const sel = document.getElementById("sortSel");
  const opt = `${sort.key}:${sort.dir}`;
  if ([...sel.options].some(o => o.value === opt)) sel.value = opt;
  const list = filtered();
  document.getElementById("count").textContent = `Showing ${list.length} of ${artists.length} artists`;
  const res = document.getElementById("results");
  if (!list.length) res.innerHTML = `<p class="empty">No artists match these filters. Try clearing one 👀</p>`;
  else if (view === "cards") res.innerHTML = `<div class="grid-cards">${list.map((a, i) => card(a, i)).join("")}</div>`;
  else res.innerHTML = table(list);

  const starred = artists.filter(a => shortlist.has(a.item_id));
  document.getElementById("shortlist").innerHTML = starred.length
    ? starred.map(a => `<button class="chip" type="button" data-artist="${a.item_id}">${avatar(a, "xs")}${esc(a.item)}</button>`).join("")
    : `<span class="muted small">Nothing starred yet. Tap ☆ on any artist.</span>`;
}

function card(a, i) {
  const b = before.get(a.item_id) || {};
  const has = before.size > 0;
  const stat = (k, label) => `<div class="stat"><div class="k">${label}</div><div class="v">${compact(a[k])}</div>${has ? badge(a[k] ?? null, b[k] ?? null, { abs: false }) : ""}</div>`;
  return `<article class="acard" data-artist="${a.item_id}" tabindex="0" role="button" aria-label="Open ${esc(a.item)}" style="animation-delay:${Math.min(i, 12) * 30}ms">
    ${starButton(a)}
    <div class="who">${avatar(a, "lg")}<div style="min-width:0"><div class="name">${esc(a.item)}</div><span class="genre-pill">${esc(a.genre)}</span></div></div>
    <div class="stats">
      ${stat("listeners", "Listeners")}${stat("playcount", "Plays")}${stat("fans", "Deezer fans")}${stat("top_track_rank", "Track rank")}
    </div>
    <div class="track">♪ ${esc(a.top_track ?? "—")}</div>
    <div class="spark" title="Last.fm listeners over the days">${sparkline(trend.get(a.item_id) || [], "var(--accent)")}</div>
  </article>`;
}

function table(list) {
  const arrow = k => k === sort.key ? (sort.dir < 0 ? "↓" : "↑") : "";
  const aria = k => k === sort.key ? (sort.dir < 0 ? "descending" : "ascending") : "none";
  return `<div class="table-wrap"><table>
    <thead><tr><th aria-label="Shortlist">★</th><th class="sortable" data-key="item" aria-sort="${aria("item")}">Artist <span class="arrow">${arrow("item")}</span></th><th>Top track</th>
      ${NUM_COLS.map(k => `<th class="num sortable" data-key="${k}" aria-sort="${aria(k)}">${LABELS[k]} <span class="arrow">${arrow(k)}</span></th>`).join("")}</tr></thead>
    <tbody>${list.map(a => {
      const b = before.get(a.item_id) || {};
      return `<tr class="clickable" data-artist="${a.item_id}" tabindex="0">
        <td>${starButton(a)}</td>
        <td><span class="who">${avatar(a, "sm")}<span><span class="name">${esc(a.item)}</span><br><span class="genre-pill">${esc(a.genre)}</span></span></span></td>
        <td class="small">${esc(a.top_track ?? "—")}</td>
        ${NUM_COLS.map(k => `<td class="num">${fmt(a[k])}${before.size && k !== "albums" ? `<div style="margin-top:3px">${badge(a[k] ?? null, b[k] ?? null)}</div>` : ""}</td>`).join("")}
      </tr>`;
    }).join("")}</tbody></table></div>`;
}
