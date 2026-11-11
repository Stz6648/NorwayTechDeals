// Used GPU / CPU price index for usedtechradar.com, built from ../price-history.json (one row per eBay listing per day).
// Uses the same model rules as the model price pages (us/content/models.json) so the numbers match those pages.
// Output: an HTML body for the index page plus a CSV that journalists can download and cite.
"use strict";

const MIN_PER_DAY = 5; // a model/condition/day needs at least this many listings to count

function buildPriceIndex({ history, modelCfg, BAD, groupOf, median, usd, esc }) {
  const models = modelCfg.models;
  // series[slug][group][date] = [prices]
  const series = {};
  for (const m of models) {
    const re = new RegExp(m.match, "i"), ex = m.exclude ? new RegExp(m.exclude, "i") : null;
    const s = (series[m.slug] = { New: {}, Used: {} });
    for (const r of history) {
      if (r.currency !== "USD" || r.category !== m.category) continue;
      const name = r.productName || "", price = Number(r.price);
      if (!(price > 0) || !re.test(name) || (ex && ex.test(name)) || BAD.test(name)) continue;
      if (m.minPrice && price < m.minPrice) continue;
      const g = groupOf(r.condition);
      if (g !== "New" && g !== "Used") continue;
      if (g === "New" && /\b(used|pre-?owned)\b/i.test(name)) continue;
      if (g === "Used" && /\b(brand new|new sealed|sealed|new in box)\b/i.test(name)) continue;
      (s[g][r.date] ||= []).push(price);
    }
  }

  const allDates = [...new Set(history.filter(r => r.currency === "USD").map(r => r.date))].sort();
  if (allDates.length < 2) return null;
  const last = allDates[allDates.length - 1], first = allDates[0];
  const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const weekAgo = [...allDates].reverse().find(d => dayDiff(d, last) >= 7) || first;

  const med = (slug, g, d) => { const a = series[slug][g][d]; return a && a.length >= MIN_PER_DAY ? median(a) : null; };
  const pct = (a, b) => (a != null && b != null ? ((a / b) - 1) * 100 : null);

  const rows = [];
  for (const m of models) {
    const uNow = med(m.slug, "Used", last), nNow = med(m.slug, "New", last);
    if (uNow == null) continue;
    rows.push({
      m, uNow, nNow,
      uWeek: pct(uNow, med(m.slug, "Used", weekAgo)),
      uStart: pct(uNow, med(m.slug, "Used", first)),
      nWeek: pct(nNow, med(m.slug, "New", weekAgo)),
      gap: nNow != null ? (1 - uNow / nNow) * 100 : null,
      count: (series[m.slug].Used[last] || []).length,
      vsMsrp: m.msrp ? pct(uNow, m.msrp) : null
    });
  }
  if (!rows.length) return null;

  // Headline index per category: median across models of (used median that day / used median on the first day) * 100.
  const indexFor = cat => allDates.map(d => {
    const rel = rows.filter(r => r.m.category === cat).map(r => {
      const a = med(r.m.slug, "Used", d), b = med(r.m.slug, "Used", first);
      return a != null && b != null ? (a / b) * 100 : null;
    }).filter(v => v != null);
    return { d, v: rel.length >= 3 ? median(rel) : null };
  });
  const gpuIdx = indexFor("Graphics Cards"), cpuIdx = indexFor("Processors");

  const fmtPct = v => (v == null ? "–" : Math.abs(v) < 0.05 ? "0.0%" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%");
  const dateLong = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const dateShort = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // Inline SVG line chart, no scripts.
  const chart = (sets) => {
    const W = 760, H = 260, L = 44, R = 16, T = 16, B = 34;
    const vals = sets.flatMap(s => s.pts.map(p => p.v)).filter(v => v != null);
    if (!vals.length) return "";
    let lo = Math.min(...vals, 100), hi = Math.max(...vals, 100);
    const pad = Math.max(1, (hi - lo) * 0.15); lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
    const x = i => L + (i * (W - L - R)) / Math.max(1, allDates.length - 1);
    const y = v => T + ((hi - v) * (H - T - B)) / (hi - lo);
    const ticks = [lo, (lo + hi) / 2, hi].map(v => Math.round(v));
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Used price index chart" style="width:100%;height:auto;background:#141922;border:1px solid #2a2f3a;border-radius:12px">`;
    for (const t of ticks) svg += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="#2a2f3a"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="#a3adbd">${t}</text>`;
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(100)}" y2="${y(100)}" stroke="#5a6475" stroke-dasharray="4 4"/>`;
    const step = Math.ceil(allDates.length / 8);
    allDates.forEach((d, i) => { if (i % step === 0 || i === allDates.length - 1) svg += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#a3adbd">${dateShort(d)}</text>`; });
    for (const s of sets) {
      const pts = s.pts.map((p, i) => (p.v == null ? null : `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`)).filter(Boolean);
      if (pts.length > 1) svg += `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" points="${pts.join(" ")}"/>`;
    }
    return svg + `</svg><p class="muted">${sets.map(s => `<span style="color:${s.color}">■</span> ${esc(s.name)}`).join(" &nbsp; ")} · 100 = ${esc(dateLong(first))}</p>`;
  };

  const gpuNow = gpuIdx[gpuIdx.length - 1].v, cpuNow = cpuIdx[cpuIdx.length - 1].v;
  const gpuWeekIdx = (gpuIdx.find(p => p.d === weekAgo) || {}).v;
  const gpuRows = rows.filter(r => r.m.category === "Graphics Cards").sort((a, b) => (b.uWeek ?? -1e9) - (a.uWeek ?? -1e9));
  const cpuRows = rows.filter(r => r.m.category === "Processors").sort((a, b) => (b.uWeek ?? -1e9) - (a.uWeek ?? -1e9));
  const up = gpuRows.filter(r => r.uWeek != null && r.uWeek >= 2), down = gpuRows.filter(r => r.uWeek != null && r.uWeek <= -2);
  const biggest = [...gpuRows].filter(r => r.uWeek != null).sort((a, b) => Math.abs(b.uWeek) - Math.abs(a.uWeek))[0];

  const table = rs => `<div class="tw"><table><thead><tr><th>Model</th><th>Used median</th><th>7-day change</th><th>Since ${esc(dateShort(first))}</th><th>New median</th><th>Used vs new</th><th>Used vs launch price</th></tr></thead><tbody>${rs.map(r => `<tr><td><a href="/price-${r.m.slug}">${esc(r.m.name)}</a></td><td>${usd(Math.round(r.uNow))}</td><td>${fmtPct(r.uWeek)}</td><td>${fmtPct(r.uStart)}</td><td>${r.nNow != null ? usd(Math.round(r.nNow)) : "–"}</td><td>${r.gap == null ? "–" : Math.round(r.gap) > 0 ? Math.round(r.gap) + "% cheaper" : Math.round(r.gap) < 0 ? Math.abs(Math.round(r.gap)) + "% pricier" : "same"}</td><td>${fmtPct(r.vsMsrp)}</td></tr>`).join("")}</tbody></table></div>`;

  const summary = `Used graphics card asking prices on eBay ${gpuNow == null ? "were tracked" : gpuNow >= 100.5 ? `are up ${(gpuNow - 100).toFixed(1)}%` : gpuNow <= 99.5 ? `are down ${(100 - gpuNow).toFixed(1)}%` : "are flat"} since ${dateLong(first)}, measured as the median change across ${gpuRows.length} GPU models.`
    + (biggest ? ` The biggest 7-day move: the ${biggest.m.name}, ${fmtPct(biggest.uWeek)} to a median of ${usd(Math.round(biggest.uNow))}.` : "");

  const body = `<h1>Used GPU &amp; CPU Price Index (eBay, US)</h1>
<p class="muted">Updated ${esc(dateLong(last))} · data since ${esc(dateLong(first))} · refreshed automatically several times a day</p>
<p><strong>${esc(summary)}</strong></p>
<p>Over the last 7 days, ${up.length} of ${gpuRows.length} GPU models got more expensive used (+2% or more) and ${down.length} got cheaper (−2% or more). ${gpuWeekIdx != null && gpuNow != null ? `The used GPU index moved ${fmtPct((gpuNow / gpuWeekIdx - 1) * 100)} week on week.` : ""}${cpuNow != null ? ` Used CPUs: index at ${cpuNow.toFixed(1)} (${fmtPct(cpuNow - 100)} since ${esc(dateShort(first))}).` : ""}</p>
<h2>Used price index</h2>
${chart([{ name: "Used GPUs", color: "#ffb84d", pts: gpuIdx }, { name: "Used CPUs", color: "#7eeaff", pts: cpuIdx }])}
<h2>Graphics cards: used prices by model</h2>
${table(gpuRows)}
${cpuRows.length ? `<h2>Processors: used prices by model</h2>${table(cpuRows)}` : ""}
<p><a class="cta" href="/used-price-index.csv" download>Download the data (CSV)</a></p>
<h2>Methodology</h2>
<p>We collect fixed-price eBay US listings for each model several times a day through the eBay API. For every model and day we take the <strong>median asking price</strong> of working units in used condition (and separately, new), after removing parts-only, untested, bundle and box-only listings and anything below a sanity floor for that model. A model needs at least ${MIN_PER_DAY} listings on a day to count. The headline index is the median across models of each model's used median relative to ${esc(dateLong(first))} (= 100), so one expensive card cannot dominate it.</p>
<p>These are asking prices, not completed sales, and listings come and go, so small day-to-day moves are noise. Treat changes under about 2% as flat.</p>
<h2>Using this data</h2>
<p>Journalists, creators and researchers are welcome to quote these numbers or embed the chart. Please credit <strong>Used Tech Radar</strong> and link to this page. For a specific cut of the data (another model, a longer window), email <a href="mailto:${esc("contact@usedtechradar.com")}">contact@usedtechradar.com</a>.</p>`;

  const csv = ["date,model,category,condition,median_usd,listings"];
  for (const m of models) for (const g of ["Used", "New"]) for (const d of allDates) {
    const a = series[m.slug][g][d];
    if (a && a.length >= MIN_PER_DAY) csv.push([d, `"${m.name}"`, `"${m.category}"`, g, median(a).toFixed(2), a.length].join(","));
  }

  return {
    body, csv: csv.join("\n") + "\n", summary, last, first,
    desc: `Used GPU prices on eBay: ${summary}`.slice(0, 300),
    pitch: { summary, gpuNow, cpuNow, up, down, gpuRows, cpuRows, first, last, weekAgo, fmtPct }
  };
}

module.exports = { buildPriceIndex };
