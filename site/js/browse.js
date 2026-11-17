import { renderNav, loadData, latestAndPrevious, artistsOn, fmt, deltaHTML, esc, showError, store, cmp, LABELS } from "./common.js";

renderNav("browse.html");
const app = document.getElementById("app");
const STAR_KEY = "music-tracker-shortlist";
const NUM_COLS = ["fans", "albums", "top_track_rank", "listeners", "playcount"];

let artists = [], before = new Map();
let shortlist = new Set(store.get(STAR_KEY, []));
let sort = { key: "listeners", dir: -1 };

try {
  const { rows } = await loadData();
  const [latest, previous] = latestAndPrevious(rows);
  artists = latest ? artistsOn(rows, latest) : [];
  before = new Map(previous ? artistsOn(rows, previous).map(a => [a.item_id, a]) : []);
  setup(latest);
} catch (e) {
  showError(app, e);
}

function setup(latest) {
  const genres = [...new Set(artists.map(a => a.genre))].sort();
  app.innerHTML = `
    <h1>Browse</h1>
    <p class="lede">Latest values for every artist${latest ? ` (${latest})` : ""}. Click a column header to sort; ★ saves an artist to your shortlist on this device.</p>
    <div class="card">
      <div class="controls">
        <label class="control">Search artists<input type="search" id="q" placeholder="e.g. Tame"></label>
        <label class="control">Genre<select id="genre"><option value="">All genres</option>${genres.map(g => `<option>${esc(g)}</option>`).join("")}</select></label>
        <label class="control">Last.fm listeners<select id="minListeners">
          <option value="0">Any size</option><option value="500000">500K+</option><option value="1000000">1M+</option>
          <option value="3000000">3M+</option><option value="5000000">5M+</option></select></label>
        <label class="control">Deezer fans<select id="minFans">
          <option value="0">Any size</option><option value="100000">100K+</option><option value="1000000">1M+</option>
          <option value="5000000">5M+</option></select></label>
        <label class="control">Sort by<select id="sortSel">
          ${NUM_COLS.flatMap(k => [[k, -1], [k, 1]]).map(([k, d]) => `<option value="${k}:${d}">${LABELS[k]} ${d < 0 ? "↓ high to low" : "↑ low to high"}</option>`).join("")}
          <option value="item:1">Artist A→Z</option></select></label>
        <label class="check"><input type="checkbox" id="starOnly"> Shortlist only</label>
      </div>
      <p class="small muted" id="count"></p>
      <div class="table-wrap"><table>
        <thead><tr><th aria-label="Shortlist">★</th><th class="sortable" data-key="item">Artist <span class="arrow"></span></th><th>Genre</th><th>Top track</th>
          ${NUM_COLS.map(k => `<th class="num sortable" data-key="${k}">${LABELS[k]} <span class="arrow"></span></th>`).join("")}</tr></thead>
        <tbody id="rows"></tbody>
      </table></div>
    </div>
    <div class="card"><h2>Your shortlist</h2><div id="shortlist" class="chips"></div></div>`;

  for (const id of ["q", "genre", "minListeners", "minFans", "starOnly"])
    document.getElementById(id).addEventListener("input", draw);
  document.getElementById("sortSel").addEventListener("change", e => {
    const [k, d] = e.target.value.split(":");
    sort = { key: k, dir: Number(d) };
    draw();
  });
  app.querySelectorAll("th.sortable").forEach(th => th.addEventListener("click", () => {
    const k = th.dataset.key;
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === "item" ? 1 : -1 };
    draw();
  }));
  app.addEventListener("click", e => {
    const b = e.target.closest(".star-btn");
    if (!b) return;
    const id = b.dataset.id;
    shortlist.has(id) ? shortlist.delete(id) : shortlist.add(id);
    store.set(STAR_KEY, [...shortlist]);
    draw();
  });
  draw();
}

function draw() {
  const q = document.getElementById("q").value.trim().toLowerCase();
  const genre = document.getElementById("genre").value;
  const minL = Number(document.getElementById("minListeners").value);
  const minF = Number(document.getElementById("minFans").value);
  const starOnly = document.getElementById("starOnly").checked;
  const sel = document.getElementById("sortSel");
  const opt = `${sort.key}:${sort.dir}`;
  if ([...sel.options].some(o => o.value === opt)) sel.value = opt;

  let list = artists.filter(a =>
    (!q || a.item.toLowerCase().includes(q)) &&
    (!genre || a.genre === genre) &&
    (!minL || (a.listeners ?? -1) >= minL) &&
    (!minF || (a.fans ?? -1) >= minF) &&
    (!starOnly || shortlist.has(a.item_id)));

  list.sort((a, b) => {
    if (sort.key === "item") return sort.dir * cmp(a.item.toLowerCase(), b.item.toLowerCase());
    const x = a[sort.key], y = b[sort.key];
    if (x == null && y == null) return 0;
    if (x == null) return 1;          // empty values always last
    if (y == null) return -1;
    return sort.dir * (x - y);
  });

  app.querySelectorAll("th.sortable").forEach(th => {
    th.querySelector(".arrow").textContent = th.dataset.key === sort.key ? (sort.dir < 0 ? "↓" : "↑") : "";
    th.setAttribute("aria-sort", th.dataset.key === sort.key ? (sort.dir < 0 ? "descending" : "ascending") : "none");
  });
  document.getElementById("count").textContent = `Showing ${list.length} of ${artists.length} artists`;
  document.getElementById("rows").innerHTML = list.length ? list.map(a => {
    const b = before.get(a.item_id) || {};
    const on = shortlist.has(a.item_id);
    return `<tr>
      <td><button class="star-btn" data-id="${a.item_id}" aria-pressed="${on}" aria-label="${on ? "Remove from" : "Add to"} shortlist">${on ? "★" : "☆"}</button></td>
      <td><strong>${esc(a.item)}</strong></td>
      <td><span class="genre-pill">${esc(a.genre)}</span></td>
      <td>${esc(a.top_track ?? "—")}</td>
      ${NUM_COLS.map(k => `<td class="num">${fmt(a[k])}${before.size && k !== "albums" ? deltaHTML(a[k] ?? null, b[k] ?? null) : ""}</td>`).join("")}
    </tr>`;
  }).join("") : `<tr><td colspan="9" class="empty">No artists match these filters.</td></tr>`;

  const starred = artists.filter(a => shortlist.has(a.item_id));
  document.getElementById("shortlist").innerHTML = starred.length
    ? starred.map(a => `<button class="chip star-btn" data-id="${a.item_id}" aria-pressed="true" title="Remove from shortlist">★ ${esc(a.item)}</button>`).join("")
    : `<span class="muted small">No artists starred yet. Tap ☆ in the table.</span>`;
}
