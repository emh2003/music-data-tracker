import { renderNav, loadData, latestAndPrevious, computeMoves, artistsOn, fmt, fmtPct, fmtSigned,
         deltaHTML, esc, showError, LABELS, TOP_MOVES } from "./common.js";

renderNav("index.html");
const app = document.getElementById("app");

try {
  const { rows, status } = await loadData();
  render(rows, status);
} catch (e) {
  showError(app, e);
}

function render(rows, status) {
  const [latest, previous] = latestAndPrevious(rows);
  if (!latest) { app.innerHTML = `<div class="card empty">The pipeline has not produced any data yet.</div>`; return; }
  const now = artistsOn(rows, latest);
  const before = new Map(previous ? artistsOn(rows, previous).map(a => [a.item_id, a]) : []);
  const moves = computeMoves(rows);
  const runTime = status ? new Date(status.run_time) : null;

  app.innerHTML = `
    <h1>Today</h1>
    <p class="lede">Latest run ${runTime ? `<strong>${runTime.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong> (${esc(status.run_time)})` : ""}
      · data for <strong>${latest}</strong>${previous ? `, compared with ${previous}` : " (first day, nothing to compare yet)"}</p>

    <div class="tiles">
      <div class="tile"><div class="label">Artists tracked</div><div class="value">${status ? status.items : now.length}</div><div class="sub">in the latest run</div></div>
      <div class="tile"><div class="label">Days with data</div><div class="value">${status ? status.days_with_success : "—"}</div><div class="sub">since ${status?.first_run_date ?? "—"}</div></div>
      <div class="tile"><div class="label">New today</div><div class="value">${status ? status.new_today.length : 0}</div><div class="sub">${status && status.new_today.length ? esc(status.new_today.join(", ")) : "none appeared"}</div></div>
      <div class="tile"><div class="label">Gone today</div><div class="value">${status ? status.gone_today.length : 0}</div><div class="sub">${status && status.gone_today.length ? esc(status.gone_today.join(", ")) : "none disappeared"}</div></div>
    </div>

    <section class="card">
      <h2>Sources</h2>
      <div class="sources">
        ${(status?.sources ?? []).map(s => `
          <div class="source"><span class="dot ${s.ok ? "ok" : "fail"}" aria-hidden="true">${s.ok ? "✓" : "✕"}</span>
          <strong>${s.name === "deezer" ? "Deezer" : s.name === "lastfm" ? "Last.fm" : esc(s.name)}</strong>
          <span class="muted">${s.ok ? `OK · ${s.count} artists` : "Failed this run"}</span></div>`).join("")}
      </div>
    </section>

    <section class="card">
      <h2>Biggest moves since the previous run</h2>
      <p class="small muted">Percent change of each value since the previous date; the ${TOP_MOVES} largest, up or down.</p>
      ${moves.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Artist</th><th>Value</th><th class="num">Old</th><th class="num">New</th><th class="num">Change</th></tr></thead>
        <tbody>${moves.map(m => `<tr><td>${esc(m.item)}</td><td>${LABELS[m.metric]}</td>
          <td class="num">${fmt(m.old)}</td><td class="num">${fmt(m.new)}</td>
          <td class="num"><span class="delta ${m.change > 0 ? "up" : "down"}">${m.change > 0 ? "▲" : "▼"} ${fmtSigned(m.change)} (${fmtPct(m.pct)})</span></td></tr>`).join("")}
        </tbody></table></div>` : `<p class="empty">No moves yet. Moves appear once there are two days of data.</p>`}
    </section>

    <section class="card">
      <h2>Latest values</h2>
      <p class="small muted">Change is since ${previous ?? "the previous run"}.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Artist</th><th>Top track</th>
          ${["fans", "top_track_rank", "listeners", "playcount"].map(k => `<th class="num">${LABELS[k]}</th>`).join("")}</tr></thead>
        <tbody>${now.map(a => {
          const b = before.get(a.item_id) || {};
          return `<tr><td><strong>${esc(a.item)}</strong><br><span class="genre-pill">${esc(a.genre)}</span></td>
            <td>${esc(a.top_track ?? "—")}</td>
            ${["fans", "top_track_rank", "listeners", "playcount"].map(k =>
              `<td class="num">${fmt(a[k])}${previous ? deltaHTML(a[k] ?? null, b[k] ?? null) : ""}</td>`).join("")}
          </tr>`;
        }).join("")}</tbody>
      </table></div>
    </section>`;
}
