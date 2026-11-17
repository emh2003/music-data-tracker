import { renderNav, loadData, latestAndPrevious, computeMoves, artistsOn, fmt, fmtPct, fmtSigned, compact,
         esc, showError, avatar, badge, countUp, timeAgo, reducedMotion, LABELS, METRICS, TOP_MOVES } from "./common.js";
import { initArtistSheet } from "./artist.js";

renderNav("index.html");
const app = document.getElementById("app");

try {
  const { rows, status } = await loadData();
  render(rows, status);
  initArtistSheet(rows);
} catch (e) {
  showError(app, e);
}

function render(rows, status) {
  const [latest, previous] = latestAndPrevious(rows);
  if (!latest) { app.innerHTML = `<div class="card empty">The pipeline has not produced any data yet.</div>`; return; }
  const now = artistsOn(rows, latest);
  const byId = new Map(now.map(a => [a.item_id, a]));
  const before = new Map(previous ? artistsOn(rows, previous).map(a => [a.item_id, a]) : []);
  const moves = computeMoves(rows);
  const runTime = status ? new Date(status.run_time) : null;
  const maxPct = Math.max(1e-9, ...moves.map(m => Math.abs(m.pct)));

  // Spotlight: the three biggest moves; on the first day, the three biggest audiences.
  const spots = moves.length
    ? moves.slice(0, 3).map(m => ({ a: byId.get(m.item_id), label: m === moves[0] ? "🔥 Top mover" : "Also moving",
        big: { count: m.pct, dec: 2, pre: m.pct > 0 ? "+" : "", suf: "%" },
        sub: `${LABELS[m.metric]} · ${fmt(m.old)} → ${fmt(m.new)}` }))
    : [...now].sort((x, y) => (y.listeners ?? 0) - (x.listeners ?? 0)).slice(0, 3).map((a, i) => ({ a,
        label: i === 0 ? "👑 Biggest audience" : `#${i + 1} audience`,
        big: { count: a.listeners ?? 0, suf: "" }, sub: "Last.fm listeners · moves appear after day two" }));

  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap">
      <div>
        <div class="eyebrow">Daily drop · ${latest}</div>
        <h1>What moved <span class="grad-text">today</span></h1>
      </div>
      ${runTime ? `<span class="live" title="${esc(status.run_time)}"><span class="pulse"></span>Updated ${timeAgo(runTime)} · ${runTime.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>` : ""}
    </div>
    <p class="lede">${now.length} artists, two sources, one run a day. ${previous ? `Compared with ${previous}.` : "This is the first day, so there is nothing to compare yet."} Tap any artist for their full card.</p>

    <section class="spotlight">
      ${spots.map((s, i) => `<article class="spot ${i === 0 ? "hero" : ""}" data-artist="${s.a.item_id}" tabindex="0" role="button" aria-label="Open ${esc(s.a.item)}">
        <div class="eyebrow">${s.label}</div>
        <div class="big" data-count="${s.big.count}" data-dec="${s.big.dec ?? 0}" data-pre="${s.big.pre ?? ""}" data-suf="${s.big.suf}">0</div>
        <div class="who" style="margin-top:10px"><span class="ring">${avatar(s.a, i === 0 ? "lg" : "")}</span>
          <div><div class="artist">${esc(s.a.item)}</div><div class="muted small">${s.sub}</div></div></div>
      </article>`).join("")}
    </section>

    <div class="tiles">
      <div class="tile"><div class="label">Artists tracked</div><div class="value" data-count="${status ? status.items : now.length}">0</div><div class="sub">in the latest run</div></div>
      <div class="tile"><div class="label">Days with data</div><div class="value" data-count="${status ? status.days_with_success : 0}">0</div><div class="sub">since ${status?.first_run_date ?? "—"}</div></div>
      <div class="tile"><div class="label">New today</div><div class="value" data-count="${status ? status.new_today.length : 0}">0</div><div class="sub">${status?.new_today.length ? esc(status.new_today.join(", ")) : "none appeared"}</div></div>
      <div class="tile"><div class="label">Gone today</div><div class="value" data-count="${status ? status.gone_today.length : 0}">0</div><div class="sub">${status?.gone_today.length ? esc(status.gone_today.join(", ")) : "none disappeared"}</div></div>
    </div>

    <section class="card">
      <div class="card-head"><h2>Sources</h2><span class="small muted">Each source is called once per artist, every day</span></div>
      <div class="sources">
        ${(status?.sources ?? []).map(s => `
          <div class="source"><span class="dot ${s.ok ? "ok" : "fail"}" aria-hidden="true">${s.ok ? "✓" : "✕"}</span>
          <strong>${s.name === "deezer" ? "Deezer" : s.name === "lastfm" ? "Last.fm" : esc(s.name)}</strong>
          <span class="muted">${s.ok ? `${s.count} artists` : "failed this run"}</span></div>`).join("")}
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Biggest moves since the previous run</h2><span class="small muted">The ${TOP_MOVES} largest percent changes, up or down</span></div>
      ${moves.length ? `<div class="movers">${moves.map((m, i) => `
        <div class="mover" data-artist="${m.item_id}" tabindex="0" role="button" aria-label="Open ${esc(m.item)}">
          <span class="rank">${i + 1}</span>
          <span class="who">${avatar(byId.get(m.item_id) || m, "sm")}<span class="name">${esc(m.item)}</span></span>
          <span class="metric-chip">${LABELS[m.metric]}</span>
          <span class="meter"><span class="${m.change > 0 ? "up" : "down"}" data-w="${(Math.abs(m.pct) / maxPct * 100).toFixed(1)}"></span></span>
          <span style="text-align:right"><span class="badge ${m.change > 0 ? "up" : "down"}">${m.change > 0 ? "▲" : "▼"} ${fmtPct(m.pct)}</span>
            <div class="vals">${fmt(m.old)} → ${fmt(m.new)} (${fmtSigned(m.change)})</div></span>
        </div>`).join("")}</div>`
        : `<p class="empty">No moves yet. They appear once there are two days of data. Check back after tomorrow's run ✨</p>`}
    </section>

    <section class="card">
      <div class="card-head"><h2>Latest values</h2><span class="small muted">Badges show the change since ${previous ?? "the previous run"}</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Artist</th><th>Top track</th>${METRICS.map(k => `<th class="num">${LABELS[k]}</th>`).join("")}</tr></thead>
        <tbody>${now.map(a => {
          const b = before.get(a.item_id) || {};
          return `<tr class="clickable" data-artist="${a.item_id}" tabindex="0">
            <td><span class="who">${avatar(a, "sm")}<span><span class="name">${esc(a.item)}</span><br><span class="genre-pill">${esc(a.genre)}</span></span></span></td>
            <td class="small">${esc(a.top_track ?? "—")}</td>
            ${METRICS.map(k => `<td class="num">${fmt(a[k])}${previous ? `<div style="margin-top:3px">${badge(a[k] ?? null, b[k] ?? null)}</div>` : ""}</td>`).join("")}
          </tr>`;
        }).join("")}</tbody>
      </table></div>
    </section>`;

  countUp(app);
  // grow the move meters after the first paint
  requestAnimationFrame(() => requestAnimationFrame(() =>
    app.querySelectorAll(".meter > span").forEach(s => s.style.width = s.dataset.w + "%")));
  if (reducedMotion()) app.querySelectorAll(".meter > span").forEach(s => s.style.width = s.dataset.w + "%");
}
