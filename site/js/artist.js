// The artist sheet: a pop-up card with an artist's photo, top track and every value
// over the days. Any element with data-artist="<item_id>" opens it.
import { datesIn, artistsOn, latestAndPrevious, fmt, esc, avatar, badge, starButton, LABELS, METRICS, SOURCE_OF } from "./common.js";
import { sparkline } from "./charts.js";

export function initArtistSheet(rows) {
  const dates = datesIn(rows);
  const [latest, previous] = latestAndPrevious(rows);
  const now = new Map(artistsOn(rows, latest).map(a => [a.item_id, a]));
  const before = new Map(previous ? artistsOn(rows, previous).map(a => [a.item_id, a]) : []);
  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  document.body.appendChild(dlg);
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });  // click outside closes

  function series(id, m) {
    const by = new Map(rows.filter(r => r.item_id === id && r.source === SOURCE_OF[m]).map(r => [r.date, r[m]]));
    return dates.map(d => by.has(d) ? by.get(d) : null);
  }

  function open(id) {
    const a = now.get(id);
    if (!a) return;
    const b = before.get(id) || {};
    const first = rows.find(r => r.item_id === id)?.date;
    dlg.innerHTML = `
      <div class="sheet-hero">
        <span class="ring">${avatar(a, "xl")}</span>
        <div>
          <div class="eyebrow" style="color:rgba(255,255,255,.8)">Artist</div>
          <h2>${esc(a.item)}</h2>
          <div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span class="genre-pill">${esc(a.genre)}</span>${starButton(a)}</div>
        </div>
        <button class="icon-btn close" type="button" aria-label="Close">✕</button>
      </div>
      <div class="sheet-body">
        ${a.top_track ? `<div class="now-playing"><span class="eq" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
          <div><div class="eyebrow">Top track on Deezer</div><strong>${esc(a.top_track)}</strong></div></div>` : ""}
        <div class="sheet-stats">
          ${METRICS.map((m, i) => `<div class="sheet-stat">
            <div class="k">${LABELS[m]}</div>
            <div class="v">${fmt(a[m])}</div>
            ${previous ? badge(a[m] ?? null, b[m] ?? null) : `<span class="badge flat">first day</span>`}
            ${sparkline(series(id, m), `var(--series-${[1, 7, 2, 3][i]})`)}
          </div>`).join("")}
        </div>
        <p class="small muted" style="margin:14px 0 0">Tracked since ${first} · ${dates.filter(d => d >= first).length} day(s) of history · lines show every day so far.</p>
      </div>`;
    dlg.querySelector(".close").addEventListener("click", () => dlg.close());
    dlg.showModal();
  }

  document.addEventListener("click", e => {
    if (e.target.closest(".star-btn")) return;
    const t = e.target.closest("[data-artist]");
    if (t) open(t.dataset.artist);
  });
  document.addEventListener("keydown", e => {
    const t = e.target.closest?.("[data-artist]");
    if (t && (e.key === "Enter" || e.key === " ") && !e.target.closest(".star-btn")) { e.preventDefault(); open(t.dataset.artist); }
  });
  return open;
}
