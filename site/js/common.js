// Shared code for all three pages: navigation, data loading, the move rule, formatting.
// Every number on the site is computed here, in the browser, from data/history.csv.

export const METRICS = ["fans", "top_track_rank", "listeners", "playcount"];
export const LABELS = {
  fans: "Deezer fans",
  top_track_rank: "Top-track rank",
  listeners: "Last.fm listeners",
  playcount: "Last.fm plays",
  albums: "Deezer albums",
};
export const SOURCE_OF = { fans: "deezer", top_track_rank: "deezer", listeners: "lastfm", playcount: "lastfm" };
export const TOP_MOVES = 10;

// ---------- navigation (one bar, shared) and theme ----------
const THEME_KEY = "music-tracker-theme";
export function currentTheme() { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === "dark" ? "#0b0a12" : "#f6f5fb";
  const b = document.getElementById("theme-btn");
  if (b) { b.textContent = t === "dark" ? "☀" : "☾"; b.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode"); }
  document.dispatchEvent(new CustomEvent("themechange", { detail: t }));
}

export function renderNav(current) {
  const links = [
    ["index.html", "Today"],
    ["browse.html", "Browse"],
    ["trends.html", "Trends"],
  ];
  const nav = document.createElement("nav");
  nav.className = "nav";
  nav.innerHTML = `<div class="nav-inner">
    <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">♫</span><span class="name">Music Tracker</span></a>
    <div class="tabs">${links.map(([href, name]) => `<a class="tab" href="${href}"${href === current ? ' aria-current="page"' : ""}>${name}</a>`).join("")}</div>
    <span class="spacer"></span>
    <span class="offline-badge">Offline · saved data</span>
    <button class="icon-btn" id="theme-btn" type="button"></button>
  </div>`;
  document.body.prepend(nav);
  applyTheme(currentTheme());
  document.getElementById("theme-btn").addEventListener("click", () => {
    const t = currentTheme() === "dark" ? "light" : "dark";
    store.set(THEME_KEY, t);
    applyTheme(t);
  });
  // follow the system setting until the person picks a theme
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", e => {
    if (store.get(THEME_KEY, null) === null) applyTheme(e.matches ? "dark" : "light");
  });
  const setOnline = () => document.body.classList.toggle("offline", !navigator.onLine);
  window.addEventListener("online", setOnline);
  window.addEventListener("offline", setOnline);
  setOnline();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

// ---------- small UI helpers ----------
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function toast(msg) {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; wrap.setAttribute("role", "status"); document.body.appendChild(wrap); }
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// Artist photo, or their initials when there is no photo (or offline).
export function avatar(a, size = "") {
  const initials = esc((a.item || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase());
  if (!a.image) return `<span class="avatar ${size}" aria-hidden="true">${initials}</span>`;
  return `<img class="avatar ${size}" src="${esc(a.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"
    onerror="this.outerHTML='<span class=&quot;avatar ${size}&quot; aria-hidden=&quot;true&quot;>${initials}</span>'">`;
}

// Animate every [data-count] number inside root from 0 to its value.
export function countUp(root = document) {
  root.querySelectorAll("[data-count]").forEach(el => {
    const target = Number(el.dataset.count), dec = Number(el.dataset.dec || 0);
    const pre = el.dataset.pre || "", suf = el.dataset.suf || "";
    const show = v => el.textContent = pre + (dec ? v.toFixed(dec) : fmt(v)) + suf;
    if (reducedMotion() || !isFinite(target)) { show(target); return; }
    const t0 = performance.now(), dur = 900;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      show(target * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function badge(cur, prev, { pct = true, abs = true } = {}) {
  if (cur == null || prev == null) return `<span class="badge flat">new</span>`;
  const d = cur - prev;
  if (d === 0) return `<span class="badge flat">±0</span>`;
  const parts = [];
  if (abs) parts.push(compact(Math.abs(d)));
  if (pct && prev !== 0) parts.push(fmtPct(d / prev * 100));
  return `<span class="badge ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${parts.join(" · ")}</span>`;
}

export function timeAgo(date) {
  const s = (Date.now() - date.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

// ---------- CSV ----------
export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", i = 0, q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
    i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.length > 1 || r[0] !== "");
  return body.map(r => Object.fromEntries(header.map((h, j) => [h, r[j] ?? ""])));
}

const NUMERIC = [...METRICS, "albums"];
export function typed(rows) {
  return rows.map(r => {
    const o = { ...r };
    for (const k of NUMERIC) o[k] = r[k] === "" || r[k] === undefined ? null : Number(r[k]);
    return o;
  });
}

// ---------- data loading ----------
export async function loadData() {
  const [h, s] = await Promise.all([
    fetch("data/history.csv", { cache: "no-store" }),
    fetch("data/status.json", { cache: "no-store" }),
  ]);
  if (!h.ok) throw new Error("Could not load data/history.csv");
  const rows = typed(parseCSV(await h.text()));
  const status = s.ok ? await s.json() : null;
  return { rows, status };
}

// ---------- helpers that mirror tracker/moves.py ----------
export function datesIn(rows) {
  return [...new Set(rows.map(r => r.date))].sort();
}
export function latestAndPrevious(rows) {
  const d = datesIn(rows);
  return [d[d.length - 1] ?? null, d.length > 1 ? d[d.length - 2] : null];
}

// The move rule: for each artist, source and numeric column, pct = (new - old) / old * 100
// between the latest date and the previous date in the history. Skip empty values,
// old = 0, and unchanged values. Rank by |pct|, ties by item_id then column.
export function movesBetween(rows, prevDate, curDate) {
  const old = new Map(rows.filter(r => r.date === prevDate).map(r => [r.item_id + "|" + r.source, r]));
  const out = [];
  for (const r of rows) {
    if (r.date !== curDate) continue;
    const o = old.get(r.item_id + "|" + r.source);
    if (!o) continue;
    for (const m of METRICS) {
      const a = o[m], b = r[m];
      if (a === null || b === null || a === 0 || a === b) continue;
      out.push({ item_id: r.item_id, item: r.item, source: r.source, metric: m, date: curDate,
                 old: a, new: b, change: b - a, pct: (b - a) / a * 100 });
    }
  }
  out.sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct) || cmp(x.item_id, y.item_id) || cmp(x.metric, y.metric));
  return out;
}
export function computeMoves(rows, limit = TOP_MOVES) {
  const [latest, previous] = latestAndPrevious(rows);
  if (!previous) return [];
  const all = movesBetween(rows, previous, latest);
  return limit ? all.slice(0, limit) : all;
}
// Python sorts strings by code point; match that exactly (not localeCompare).
export function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

// One object per artist for a date, joining the two sources' rows.
export function artistsOn(rows, date) {
  const map = new Map();
  for (const r of rows) {
    if (r.date !== date) continue;
    const a = map.get(r.item_id) || { item_id: r.item_id, item: r.item, genre: r.genre, sources: [] };
    a.sources.push(r.source);
    for (const k of NUMERIC) if (r[k] !== null) a[k] = r[k];
    if (r.top_track) a.top_track = r.top_track;
    if (r.image) a.image = r.image;
    map.set(r.item_id, a);
  }
  return [...map.values()].sort((x, y) => cmp(x.item_id, y.item_id));
}

// ---------- formatting ----------
const nf = new Intl.NumberFormat("en-US");
export const fmt = v => (v === null || v === undefined || Number.isNaN(v) ? "—" : nf.format(Math.round(v)));
export const fmtPct = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + v.toFixed(d) + "%");
export const fmtSigned = v => (v > 0 ? "+" : "") + nf.format(v);
export function compact(v) {
  if (v === null || v === undefined) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "K";
  return String(Math.round(v * 100) / 100);
}
export function deltaHTML(cur, prev) {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return `<span class="delta flat">no previous</span>`;
  const d = cur - prev;
  if (d === 0) return `<span class="delta flat">no change</span>`;
  const pct = prev !== 0 ? ` (${fmtPct(d / prev * 100)})` : "";
  return `<span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${fmtSigned(d)}${pct}</span>`;
}
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function showError(el, err) {
  el.innerHTML = `<div class="card empty">Could not load the data: ${esc(err.message)}.
    If you are offline and have never opened this page online, there is nothing saved yet.</div>`;
}

// localStorage can be missing or throw (private mode); never let that break the page.
export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

// ---------- shortlist (shared by every page, kept in this browser) ----------
const STAR_KEY = "music-tracker-shortlist";
export const shortlist = {
  ids() { return new Set(store.get(STAR_KEY, [])); },
  has(id) { return this.ids().has(id); },
  toggle(id, name) {
    const s = this.ids();
    const on = !s.has(id);
    on ? s.add(id) : s.delete(id);
    store.set(STAR_KEY, [...s]);
    toast(on ? `★ ${name} added to your shortlist` : `${name} removed from your shortlist`);
    document.dispatchEvent(new CustomEvent("shortlistchange", { detail: { id, on } }));
    return on;
  },
};
// Any button with class star-btn and data-id / data-name toggles the shortlist.
document.addEventListener("click", e => {
  const b = e.target.closest(".star-btn[data-id]");
  if (!b) return;
  e.stopPropagation();
  const on = shortlist.toggle(b.dataset.id, b.dataset.name || b.dataset.id);
  document.querySelectorAll(`.star-btn[data-id="${CSS.escape(b.dataset.id)}"]`).forEach(x => {
    x.setAttribute("aria-pressed", on); x.textContent = on ? "★" : "☆";
    x.setAttribute("aria-label", `${on ? "Remove from" : "Add to"} shortlist`);
  });
  if (!reducedMotion()) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
}, true);
export function starButton(a) {
  const on = shortlist.has(a.item_id);
  return `<button class="star-btn" type="button" data-id="${esc(a.item_id)}" data-name="${esc(a.item)}" aria-pressed="${on}" aria-label="${on ? "Remove from" : "Add to"} shortlist">${on ? "★" : "☆"}</button>`;
}
