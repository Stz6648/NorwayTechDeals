// Builds the US (English, USD, eBay-focused) site into us/public from us/content/guides/*.json and ../products.json.
// Safe by design: writes only inside us/public. Never touches the Norwegian site or products.json.
// Guards: approved merchant, eBay campaign id, USD only, disclosure and sponsored rel on every page with links,
// and publishing is refused while the domain or contact email are placeholders.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const here = __dirname;
const root = path.resolve(here, "..");
const outDir = path.join(here, "public");
const cfg = JSON.parse(fs.readFileSync(path.join(here, "site.config.json"), "utf8"));
const products = JSON.parse(fs.readFileSync(path.join(root, "products.json"), "utf8"));
const merchants = JSON.parse(fs.readFileSync(path.join(root, "data", "merchants.json"), "utf8"));
const guides = fs.readdirSync(path.join(here, "content", "guides")).filter(f => f.endsWith(".json")).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(here, "content", "guides", f), "utf8")));

const errors = [];
const placeholder = /YOUR-DOMAIN/.test(cfg.domain) || !cfg.contactEmail;
if (cfg.publish && placeholder) errors.push("publish is true but domain or contactEmail is still a placeholder");
const SITE = cfg.domain.replace(/\/$/, "");
const ROBOTS = cfg.publish ? "index,follow" : "noindex,nofollow";

let snapDate = new Date().toISOString().slice(0, 10);
try { snapDate = execFileSync("git", ["log", "-1", "--format=%cs", "--", "products.json"], { cwd: root, encoding: "utf8" }).trim() || snapDate; } catch (_) {}
const __stamps = products.flatMap(p => (p.offers || []).map(o => Date.parse(o.updatedAt || ""))).filter(Number.isFinite);
if (__stamps.length) snapDate = new Date(Math.max(...__stamps)).toISOString().slice(0, 10); // real fetch date once refresh-ebay has run
const dateEn = new Date(snapDate + "T12:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const usd = n => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2 });
const BAD = /\b(for parts|not working|broken|untested|empty box|box only|lot of|bundle|read description|as[- ]is|no returns)\b/i;
const groupOf = c => { c = String(c || "").toLowerCase(); if (c.includes("refurbished")) return "Refurbished"; if (c === "new") return "New"; if (c.includes("open box")) return "Open box"; if (c === "used") return "Used"; return "Other"; };

function find(spec, groups, count) {
  const m = new RegExp(spec.match, "i"), ex = spec.exclude ? new RegExp(spec.exclude, "i") : null;
  const out = [];
  for (const p of products) {
    if (p.category !== spec.category) continue;
    const o = (p.offers || [])[0];
    if (!o || o.affiliate !== true || Number(o.price) <= 0) continue;
    if (!m.test(p.name) || BAD.test(p.name) || (ex && ex.test(p.name))) continue;
    if (spec.minPrice && Number(o.price) < spec.minPrice) continue;
    if (!groups.includes(groupOf(o.condition))) continue;
    const g = groupOf(o.condition);
    // Skip listings whose own title contradicts the condition label (e.g. "Open box" labelled "USED").
    if ((g === "New" || g === "Open box" || g === "Refurbished") && /\b(used|pre-?owned)\b/i.test(p.name)) continue;
    if (g === "Used" && /\b(brand new|new sealed|sealed|new in box)\b/i.test(p.name)) continue;
    out.push({ p, o });
  }
  out.sort((a, b) => Number(a.o.price) - Number(b.o.price));
  return out.slice(0, count);
}
function check(slug, hit) {
  const { p, o } = hit;
  if (!merchants[o.store] || merchants[o.store].status !== "approved") errors.push(`${slug}: merchant ${o.store} not approved`);
  if (!String(o.url).includes("campid=" + cfg.ebayCampId)) errors.push(`${slug}: ${p.id} link missing campaign id`);
  if (o.currency !== "USD") errors.push(`${slug}: ${p.id} currency ${o.currency}`);
}

const CSS = `:root{--bg:#0f1115;--panel:#171a21;--line:#2a2f3a;--text:#f2f4f8;--muted:#a3adbd;--acc:#ffb84d}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.7}a{color:inherit}.shell{max-width:860px;margin:auto;padding:0 20px}header{border-bottom:1px solid #ffffff16}.nav{height:62px;display:flex;align-items:center;justify-content:space-between;gap:14px}.logo{font-size:20px;font-weight:900;letter-spacing:-.5px;text-decoration:none;color:var(--acc)}.nav a.l{font-size:13px;color:#c9d2e0;text-decoration:none}main{padding:30px 0 60px}h1{font-size:clamp(28px,5vw,40px);line-height:1.15;letter-spacing:-1px;margin:0 0 14px}h2{font-size:22px;margin:34px 0 10px}h3{font-size:16px;line-height:1.4;margin:6px 0 8px}p{color:#d3dbe8}.muted{font-size:12px;color:var(--muted)}.notice{background:#33291a;color:#ffd99b;border-radius:10px;padding:13px 15px;font-size:14px;margin:18px 0}.card{display:block;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0;text-decoration:none}.card:hover{border-color:var(--acc)}.card b{display:block;font-size:17px}.card span{font-size:13px;color:var(--muted)}.picks{display:grid;gap:16px}.pick{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;display:grid;grid-template-columns:120px 1fr;gap:16px}.pick img{width:120px;height:120px;object-fit:contain;background:#f4f6f8;border-radius:10px;padding:6px}.label{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--acc);font-weight:800}.price{font-size:22px;font-weight:900;margin:4px 0}.price small{display:block;font-size:11px;font-weight:400;color:var(--muted)}ul{margin:6px 0 10px;padding-left:20px;color:#d3dbe8;font-size:14px}.cta{display:inline-block;background:var(--acc);color:#1a1205;font-weight:900;font-size:13px;padding:11px 15px;border-radius:8px;text-decoration:none}.empty{border:1px dashed #44505f;border-radius:10px;padding:14px;color:var(--muted);font-size:14px}table{width:100%;border-collapse:collapse;font-size:14px;margin:12px 0}th,td{border-bottom:1px solid var(--line);padding:9px 8px;text-align:left;vertical-align:top}th{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}td a{color:var(--acc)}.tw{overflow-x:auto}.disclosure{background:#141922;border:1px solid var(--line);border-radius:12px;padding:16px 18px;font-size:13px;color:#aeb9ca;margin-top:32px}footer{border-top:1px solid #ffffff16;padding:22px 0;color:#8896ab;font-size:12px}.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:24px;align-items:center;margin:8px 0 6px}.hero h1{margin:0 0 12px}.heroFig{margin:0}.heroFig figcaption{font-size:11px;color:var(--muted);margin-top:6px}.hero img{width:100%;height:auto;object-fit:cover;border-radius:18px;box-shadow:0 20px 50px #000a,0 0 60px #7a3cff33}.chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}.chip{font-size:12px;font-weight:800;letter-spacing:.4px;border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 12px}.chip i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}@media(max-width:700px){.hero{grid-template-columns:1fr}}@media(max-width:620px){.pick{grid-template-columns:1fr}.pick img{width:100%;height:170px}}`;
const DISCLOSURE = `<div class="disclosure"><strong>Affiliate disclosure:</strong> ${esc(cfg.brand)} is a participant in the eBay Partner Network. If you click a link to eBay and make a qualifying purchase, we may earn a commission at no extra cost to you. We are not the seller and do not control eBay listings. <a href="/affiliate-disclosure">Read more</a>.</div>`;
const PRICE_NOTICE = `<div class="notice"><strong>About prices:</strong> Prices are eBay listing prices in US dollars from our catalogue snapshot dated ${esc(dateEn)}. Listings sell out and prices change, so the price on eBay is the one that counts. Item price only: shipping, sales tax and fees may apply.</div>`;

function page({ slug, title, desc, body, type = "website" }) {
  const url = slug ? `${SITE}/${slug}` : `${SITE}/`;
  return `<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="google-site-verification" content="ziac4kcZYhkGJsz7Xocozv1VZAPNtLwRn6E55eAd3Kw" />
<title>${esc(title.length + cfg.brand.length + 3 <= 62 ? title + " | " + cfg.brand : title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${ROBOTS}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${type}"><meta property="og:url" content="${esc(url)}">
${slug ? `<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":SITE+"/"},{"@type":"ListItem","position":2,"name":title,"item":url}]},...(type==="article"?[{"@type":"Article","headline":title.slice(0,110),"description":desc,"mainEntityOfPage":url,"dateModified":snapDate,"author":{"@type":"Organization","name":cfg.brand},"publisher":{"@type":"Organization","name":cfg.brand}}]:[])]}).replace(/</g,"\\u003c")}</script>` : `<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"WebSite","name":cfg.brand,"url":SITE+"/"}).replace(/</g,"\\u003c")}</script>`}
<style>${CSS}</style>
</head>
<body>
<header><div class="shell nav"><a class="logo" href="/">${esc(cfg.brand)}</a><a class="l" href="/">Guides</a></div></header>
<main class="shell">
${body}
</main>
<footer><div class="shell">© ${new Date().getFullYear()} ${esc(cfg.brand)} · <a href="/about">About</a> · <a href="/affiliate-disclosure">Affiliate disclosure</a> · <a href="/privacy">Privacy</a></div></footer>
</body>
</html>
`;
}
const write = (name, html) => fs.writeFileSync(path.join(outDir, name + ".html"), html);

function pickCard(spec, hit) {
  check(spec.__slug, hit);
  const { p, o } = hit;
  return `<article class="pick"><img loading="lazy" src="${esc(p.image)}" alt="${esc(p.name)}"><div><div class="label">${esc(spec.label)}</div><h3>${esc(p.name)}</h3><p class="muted">Condition: ${esc(o.condition)} · Sold on eBay</p><div class="price">${usd(o.price)}<small>eBay listing price, ${esc(dateEn)}. Shipping and tax extra.</small></div><strong>Pros</strong><ul>${(spec.pros || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul><strong>Cons</strong><ul>${(spec.cons || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul><a class="cta" href="${esc(o.url)}" target="_blank" rel="nofollow sponsored noopener">View listing on eBay ↗</a></div></article>`;
}

function buildGuide(g) {
  let main = "";
  const GROUPS = ["New", "Open box", "Used", "Refurbished"];
  if (g.type === "pricegap") {
    for (const t of g.tiers) {
      t.__slug = g.slug;
      const rows = [];
      let newPrice = null;
      for (const grp of GROUPS) {
        const hit = find(t, [grp], 1)[0];
        if (!hit) { rows.push(`<tr><td>${grp}</td><td colspan="3" class="muted">No qualifying listing in catalogue</td></tr>`); continue; }
        check(g.slug, hit);
        const price = Number(hit.o.price);
        if (grp === "New") newPrice = price;
        const diff = grp === "New" || newPrice == null ? "" : (price < newPrice ? `${Math.round((1 - price / newPrice) * 100)}% below new` : `${Math.round((price / newPrice - 1) * 100)}% above new`);
        rows.push(`<tr><td>${grp}</td><td>${usd(price)}</td><td>${esc(diff)}</td><td><a href="${esc(hit.o.url)}" target="_blank" rel="nofollow sponsored noopener">${esc(hit.p.name.slice(0, 60))}${hit.p.name.length > 60 ? "…" : ""} ↗</a></td></tr>`);
      }
      main += `<h2>${esc(t.name)}</h2><div class="tw"><table><thead><tr><th>Condition</th><th>Cheapest listing</th><th>Versus cheapest new</th><th>Listing</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
    }
    main += `<p class="muted">${esc(g.tableNote)}</p>`;
  } else if (g.type !== "text") {
    main += `<h2>${esc(g.picksHeading)}</h2><div class="picks">`;
    for (const spec of g.picks) {
      spec.__slug = g.slug;
      const hits = find(spec, (spec.conditions || ["new"]).map(c => c === "new" ? "New" : c === "open box" ? "Open box" : c === "used" ? "Used" : "Refurbished"), spec.count || 1);
      main += hits.length ? hits.map(h => pickCard(spec, h)).join("") : `<div class="empty">No qualifying listing in our catalogue right now for: ${esc(spec.label)}.</div>`;
    }
    main += `</div><h2>How we chose</h2><p>${esc(g.howWeChoose)}</p>`;
  }
  const secs = (g.sections || []).map(s => `<h2>${esc(s.h2)}</h2>` + (s.paragraphs || []).map(t => `<p>${esc(t)}</p>`).join("") + (s.list ? `<ul>${s.list.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "")).join("");
  const body = `<h1>${esc(g.h1)}</h1><p class="muted">Catalogue snapshot: ${esc(dateEn)}</p>${g.intro.map(t => `<p>${esc(t)}</p>`).join("")}${PRICE_NOTICE}${main}${secs}${DISCLOSURE}`;
  const html = page({ slug: g.slug, title: g.title, desc: g.description, body, type: "article" });
  if (/\bNOK\b|\bkr\b/.test(html)) errors.push(`${g.slug}: contains NOK/kr`);
  if (!html.includes("eBay Partner Network")) errors.push(`${g.slug}: missing disclosure`);
  if (/<a [^>]*href="https?:[^"]*ebay[^"]*"(?![^>]*sponsored)/.test(html)) errors.push(`${g.slug}: eBay link without sponsored rel`);
  write(g.slug, html);
}


// ---- Per-model price pages: data driven, generated only when the catalogue has enough real listings ----
const modelCfg = JSON.parse(fs.readFileSync(path.join(here, "content", "models.json"), "utf8"));
const median = a => { const s2 = [...a].sort((x, y) => x - y), m = Math.floor(s2.length / 2); return s2.length % 2 ? s2[m] : (s2[m - 1] + s2[m]) / 2; };
const GROUP_ORDER = ["New", "Open box", "Used", "Refurbished"];
const TIPS = {
  "New": "Check that the seller is an established retailer with the original manufacturer warranty, and that the listing is not a gray-market import.",
  "Open box": "Open box means returned or opened, usually in working order. Ask whether the original box, accessories and warranty are included.",
  "Used": "Prefer sellers with high feedback and a clear return policy. Ask for photos of the actual card and, for GPUs, whether it was used for mining.",
  "Refurbished": "Look at who refurbished it: manufacturer or eBay-certified programs carry a warranty, seller-refurbished items often do not."
};
const modelPages = [];
// Display-only cleanup of seller listing titles: emoji, check marks, stale shipping dates and shouting.
const cleanTitle = s => String(s || "")
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
  .replace(/\b(ships?|shipping)\s+(on\s+)?\d{1,2}\/\d{1,2}\b/ig, "")
  .replace(/\b(new listing|new low price|stability tested!?)\b/ig, "")
  .replace(/\s{2,}/g, " ").replace(/\s+([,.;:!])/g, "$1").trim();
const pctGap = (a, b) => Math.round((1 - a / b) * 100); // how much cheaper a is than b

// Original, data-driven analysis for a model page. Every number comes from the same snapshot as the tables.
function modelExtras(m, by, newLow) {
  const stat = g => by[g].length ? (() => { const ps = by[g].map(h => Number(h.o.price)); return { n: ps.length, low: Math.min(...ps), med: median(ps), high: Math.max(...ps) }; })() : null;
  const S = Object.fromEntries(GROUP_ORDER.map(g => [g, stat(g)]));
  const isGpu = m.category === "Graphics Cards";
  const noun = isGpu ? "card" : "processor";
  const parts = [];

  // 1. Overview: what the page covers and how big the snapshot is.
  const counts = GROUP_ORDER.filter(g => S[g]).map(g => `${S[g].n} ${g.toLowerCase()}`).join(", ");
  parts.push(`<h2>${esc(m.name)} on eBay: what the snapshot shows</h2><p>This page tracks ${esc(m.name)} listings on eBay in four conditions: new, open box, used and refurbished. The ${esc(dateEn)} snapshot has ${counts} listings. We only count fixed-price listings and skip parts-only, untested and bundle listings, so the numbers describe working ${noun}s sold as the ${esc(m.name)} itself.</p>`
    + (m.msrp && newLow ? `<p>The ${esc(m.name)} launched at a US list price of ${usd(m.msrp)}. The cheapest new eBay listing in this snapshot is ${usd(newLow)}, which is ${newLow >= m.msrp ? Math.round((newLow / m.msrp - 1) * 100) + "% above" : pctGap(newLow, m.msrp) + "% below"} that launch price.</p>` : ""));

  // 2. Is used worth it? Computed from the snapshot, with a plain verdict.
  const u = S["Used"], n = S["New"];
  if (u && n) {
    const gapLow = pctGap(u.low, n.low), gapMed = pctGap(u.med, n.med);
    const verdict = gapMed >= 20 ? "a gap large enough that used can be worth the extra checking" : gapMed >= 8 ? "a moderate gap, so condition, warranty and return policy matter more than the headline price" : `a small gap, so a new ${noun} with the full manufacturer warranty is often the safer buy`;
    parts.push(`<h2>Is a used ${esc(m.name)} worth it right now?</h2><p>The cheapest used listing is ${usd(u.low)} against ${usd(n.low)} for the cheapest new one, ${gapLow >= 0 ? gapLow + "% less" : Math.abs(gapLow) + "% more"}. Comparing medians, used listings are ${gapMed >= 0 ? gapMed + "% cheaper" : Math.abs(gapMed) + "% more expensive"} than new (${usd(u.med)} against ${usd(n.med)}). That is ${verdict}.</p><p>Prices on eBay move every day, so check this gap again before you buy. If the used discount is small, also look at open box and refurbished listings, which sometimes sit in between.</p>`);
  }
  const r = S["Refurbished"];
  if (r && n) {
    parts.push(`<p>Refurbished is not always the cheap option. The lowest refurbished listing here is ${usd(r.low)}, ${r.low < n.low ? pctGap(r.low, n.low) + "% below" : Math.round((r.low / n.low - 1) * 100) + "% above"} the cheapest new one. Compare against the lowest new price before you pay extra for a refurbished label, and check who did the refurbishing.</p>`);
  }
  const ob = S["Open box"];
  if (ob && n) {
    parts.push(`<p>Open box listings start at ${usd(ob.low)} (median ${usd(ob.med)}). They can be a good compromise if the original box, accessories and warranty are included, so ask the seller before you buy.</p>`);
  }

  // 3. Condition guide.
  parts.push(`<h2>New, open box, used and refurbished: what each means</h2><ul>${GROUP_ORDER.filter(g => S[g]).map(g => `<li><strong>${g}:</strong> ${esc(TIPS[g])}</li>`).join("")}</ul>`);

  // 4. Checklist.
  const extra = (m.buyingNotes || []).map(x => `<li>${esc(x)}</li>`).join("");
  parts.push(`<h2>Checklist before you buy a used ${esc(m.name)}</h2><ol><li>Check the seller: feedback score, account history and a return policy you can actually use.</li><li>Ask for photos of the actual ${noun}, including the serial number sticker. Stock photos alone are a warning sign.</li>${isGpu ? "<li>Ask whether it was used for mining, rendering or in a server. Heavy long-term use wears fans and thermal pads faster than light gaming.</li>" : "<li>Look for bent pins or marks on the socket side, and ask whether the processor was overclocked.</li>"}<li>Ask whether the manufacturer warranty transfers to a new owner. This differs by brand, so confirm with the seller.</li>${extra}<li>Test it as soon as it arrives, during the return window. Run a stress test and watch temperatures.</li><li>Be careful with prices far below the median in the table above, and with listings that say box only, for parts or untested.</li></ol>`);

  // 5. FAQ with the same snapshot numbers.
  const faq = [];
  if (u) faq.push([`How much does a used ${m.name} cost on eBay?`, `In our ${dateEn} snapshot, used ${m.name} listings run from ${usd(u.low)} to ${usd(u.high)}, with a median of ${usd(u.med)}, across ${u.n} listings.`]);
  if (n) faq.push([`How much does a new ${m.name} cost on eBay?`, `New listings start at ${usd(n.low)} and have a median of ${usd(n.med)} in this snapshot (${n.n} listings). Check that the seller is an established retailer and that the listing includes the manufacturer warranty.`]);
  if (u && n) faq.push([`Is a used ${m.name} cheaper than a new one?`, `Right now the cheapest used listing is ${pctGap(u.low, n.low) >= 0 ? pctGap(u.low, n.low) + "% below" : Math.abs(pctGap(u.low, n.low)) + "% above"} the cheapest new listing. The gap changes with the market, so compare the two rows in the table at the top of this page.`]);
  faq.push([`Is refurbished better than used?`, `It depends on who refurbished it. Manufacturer or eBay-certified programs usually carry a warranty. A seller's own refurbishment often does not, so read the listing before you buy.`]);
  faq.push([`How often is this page updated?`, `The catalogue is refreshed from eBay automatically and the date at the top of the page shows the latest snapshot. The price on eBay is always the one that counts.`]);
  parts.push(`<h2>${esc(m.name)} price FAQ</h2>${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}`);
  return parts.join("");
}

const descFor = (m, by, newLow) => {
  const bits = [];
  if (newLow != null) bits.push(`new from ${usd(newLow)}`);
  for (const g of ["Open box", "Used", "Refurbished"]) if (by[g].length) bits.push(`${g.toLowerCase()} from ${usd(Number(by[g][0].o.price))}`);
  return `${m.name} on eBay (${dateEn}): ${bits.join(", ")}. Lowest and median price by condition, a used vs new comparison and a buying checklist.`.slice(0, 300);
};

function buildModel(m) {
  const hits = [];
  const re = new RegExp(m.match, "i"), ex = m.exclude ? new RegExp(m.exclude, "i") : null;
  for (const p of products) {
    if (p.category !== m.category) continue;
    const o = (p.offers || [])[0];
    if (!o || o.affiliate !== true || !(Number(o.price) > 0)) continue;
    if (!re.test(p.name) || (ex && ex.test(p.name)) || BAD.test(p.name)) continue;
    if (m.minPrice && Number(o.price) < m.minPrice) continue;
    const g = groupOf(o.condition);
    if (!GROUP_ORDER.includes(g)) continue;
    if ((g === "New" || g === "Open box" || g === "Refurbished") && /\b(used|pre-?owned)\b/i.test(p.name)) continue;
    if (g === "Used" && /\b(brand new|new sealed|sealed|new in box)\b/i.test(p.name)) continue;
    hits.push({ p, o, g });
  }
  if (hits.length < modelCfg.minListings) return;
  for (const h of hits) check("model-" + m.slug, h);
  const by = Object.fromEntries(GROUP_ORDER.map(g => [g, hits.filter(h => h.g === g).sort((a, b) => Number(a.o.price) - Number(b.o.price))]));
  const newLow = by["New"].length ? Number(by["New"][0].o.price) : null;
  const rows = GROUP_ORDER.filter(g => by[g].length).map(g => {
    const prices = by[g].map(h => Number(h.o.price)), low = Math.min(...prices);
    const diff = g === "New" || newLow == null ? "" : (low < newLow ? `${Math.round((1 - low / newLow) * 100)}% below` : `${Math.round((low / newLow - 1) * 100)}% above`);
    return `<tr><td>${g}</td><td>${prices.length}</td><td>${usd(low)}</td><td>${usd(median(prices))}</td><td>${esc(diff)}</td></tr>`;
  }).join("");
  const lists = GROUP_ORDER.filter(g => by[g].length).map(g => `<h2>${g} ${esc(m.name)} on eBay</h2><p class="muted">${esc(TIPS[g])}</p><div class="tw"><table><thead><tr><th>Price</th><th>Listing</th><th>Condition</th></tr></thead><tbody>${by[g].slice(0, 5).map(h => `<tr><td>${usd(h.o.price)}</td><td><a href="${esc(h.o.url)}" target="_blank" rel="nofollow sponsored noopener">${esc(cleanTitle(h.p.name).slice(0, 80))}${cleanTitle(h.p.name).length > 80 ? "…" : ""} ↗</a></td><td>${esc(h.o.condition)}</td></tr>`).join("")}</tbody></table></div>`).join("");
  const cheapestAll = hits.reduce((a, b) => Number(b.o.price) < Number(a.o.price) ? b : a);
  const lead = `On ${esc(dateEn)} we found ${hits.length} qualifying eBay listings for the ${esc(m.name)}. ` + (newLow != null ? `The cheapest new one costs ${usd(newLow)}. ` : "") + `The lowest price in any condition is ${usd(cheapestAll.o.price)} (${esc(cheapestAll.g.toLowerCase())}).`;
  const slug = "price-" + m.slug;
  const body = `<h1>${esc(m.name)} price on eBay by condition</h1><p class="muted">Last updated: ${esc(dateEn)} · catalogue snapshot</p><p>${lead}</p>${PRICE_NOTICE}<h2>Price by condition</h2><div class="tw"><table><thead><tr><th>Condition</th><th>Listings</th><th>Lowest</th><th>Median</th><th>Lowest vs cheapest new</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted">Median and lowest are calculated from the listings in our catalogue snapshot, not from every eBay listing.</p>${lists}${modelExtras(m, by, newLow)}<h2>Before you buy</h2><p>Always compare the exact variant, check the seller's feedback and return policy, and read the full listing. A low price is only a good deal if the item is what it says it is.</p>${DISCLOSURE}`;
  const html = page({ slug, title: `${m.name} price on eBay by condition`, desc: descFor(m, by, newLow), body, type: "article" });
  if (/\bNOK\b|\bkr\b/.test(html)) errors.push(`${slug}: contains NOK/kr`);
  if (!html.includes("eBay Partner Network")) errors.push(`${slug}: missing disclosure`);
  if (/<a [^>]*href="https?:[^"]*ebay[^"]*"(?![^>]*sponsored)/.test(html)) errors.push(`${slug}: eBay link without sponsored rel`);
  write(slug, html);
  modelPages.push({ slug, name: m.name, category: m.category, count: hits.length, low: Number(cheapestAll.o.price) });
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(outDir, "images"), { recursive: true });

for (const f of fs.readdirSync(outDir)) if (/^price-.*\.html$/.test(f)) fs.unlinkSync(path.join(outDir, f));
for (const g of guides) buildGuide(g);
for (const m of modelCfg.models) buildModel(m);
// Internal links: each model page links to other price pages in the same category and to the guides.
for (const mp of modelPages) {
  const f = path.join(outDir, mp.slug + ".html");
  const related = modelPages.filter(x => x.category === mp.category && x.slug !== mp.slug).slice(0, 6);
  const block = `<h2>More price checks</h2><ul>${related.map(x => `<li><a href="/${x.slug}">${esc(x.name)} price on eBay</a></li>`).join("")}</ul><p>New to buying used? Read our ${mp.category === "Processors" ? `<a href="/used-vs-new-cpu-price-gap">used vs new CPU comparison</a>` : `<a href="/used-gpu-buying-guide-ebay">used graphics card checklist</a>`} and <a href="/ebay-refurbished-vs-used-explained">refurbished vs used explained</a>, or see how used prices are moving in our <a href="/used-gpu-price-index">used GPU &amp; CPU price index</a>.</p>`;
  let html = fs.readFileSync(f, "utf8");
  if (html.includes("</main>") && !html.includes("More price checks")) { html = html.replace("</main>", block + "</main>"); fs.writeFileSync(f, html); }
}

// ---- Used price index page (from price-history.json) ----
const { buildPriceIndex } = require("./price-index.js");
let priceIndex = null;
try {
  const history = JSON.parse(fs.readFileSync(path.join(root, "price-history.json"), "utf8"));
  priceIndex = buildPriceIndex({ history, modelCfg, BAD, groupOf, median, usd, esc });
} catch (e) { errors.push("price index: " + e.message); }
if (priceIndex) {
  const html = page({ slug: "used-gpu-price-index", title: "Used GPU Price Index (eBay, US)", desc: priceIndex.desc, body: priceIndex.body + DISCLOSURE, type: "article" });
  write("used-gpu-price-index", html);
  fs.writeFileSync(path.join(outDir, "used-price-index.csv"), priceIndex.csv);
  fs.writeFileSync(path.join(here, "price-index-summary.json"), JSON.stringify({ updated: priceIndex.last, since: priceIndex.first, summary: priceIndex.summary }, null, 2) + "\n");
}

write("index", page({
  slug: "", title: "Used vs New PC Hardware Prices on eBay", desc: "Honest price comparisons of new, open-box, used and refurbished PC hardware on eBay, with the risks spelled out.",
  body: `<section class="hero"><div><h1>${esc(cfg.tagline)}</h1><p>We compare what the same hardware costs new, open-box, used and refurbished on eBay, and explain how to buy safely.</p><div class="chips"><span class="chip"><i style="background:#7eeaff"></i>New</span><span class="chip"><i style="background:#a77bff"></i>Open box</span><span class="chip"><i style="background:#ffb84d"></i>Used</span><span class="chip"><i style="background:#c5f36b"></i>Refurbished</span></div></div><figure class="heroFig"><img src="https://images.unsplash.com/photo-1719927604476-dc404b85358f?auto=format&amp;fit=crop&amp;w=900&amp;h=760&amp;q=80" alt="Gaming PC with glass side panel and blue RGB fans" width="900" height="760" fetchpriority="high"><figcaption>Photo by <a href="https://unsplash.com/photos/GYj9ts-qvlQ?utm_source=usedtechradar&amp;utm_medium=referral" rel="noopener">Bhautik Patel</a> on <a href="https://unsplash.com/?utm_source=usedtechradar&amp;utm_medium=referral" rel="noopener">Unsplash</a></figcaption></figure></section>${PRICE_NOTICE}${priceIndex ? `<a class="card" href="/used-gpu-price-index" style="border-color:var(--acc)"><b>Used GPU &amp; CPU Price Index</b><span>${esc(priceIndex.summary)}</span></a>` : ""}<h2>Guides</h2>` +
    guides.map(g => `<a class="card" href="/${g.slug}"><b>${esc(g.h1)}</b><span>${esc(g.description)}</span></a>`).join("") +
    (modelPages.length ? `<h2>Price check by model</h2>` + ["Graphics Cards", "Processors"].map(c => modelPages.filter(x => x.category === c).length ? `<h3>${c}</h3>` + modelPages.filter(x => x.category === c).map(x => `<a class="card" href="/${x.slug}"><b>${esc(x.name)}</b><span>${x.count} listings, from ${usd(x.low)}</span></a>`).join("") : "").join("") : "") + DISCLOSURE
}));
write("about", page({ slug: "about", title: "About", desc: `About ${cfg.brand}.`, body: `<h1>About ${esc(cfg.brand)}</h1><p>${esc(cfg.brand)} is an independent site that compares prices for new, open-box, used and refurbished PC hardware on eBay. We earn a commission when you buy through our links, which is how the site is funded.</p><p>We do not sell anything ourselves and we have not tested the products listed. Our prices come from a catalogue snapshot and can be out of date by the time you read them.</p>${cfg.contactEmail ? `<p>Contact: <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a></p>` : ""}${DISCLOSURE}` }));
write("affiliate-disclosure", page({ slug: "affiliate-disclosure", title: "Affiliate disclosure", desc: "How this site earns money from eBay links.", body: `<h1>Affiliate disclosure</h1><p>${esc(cfg.brand)} is a participant in the eBay Partner Network, an affiliate program. When you click a link to eBay on this site and make a qualifying purchase, we may earn a commission. It does not change the price you pay.</p><p>Commissions do not decide which listings appear. We list the cheapest qualifying listing in our catalogue for each category we compare. That is not the same as a recommendation of a particular seller. Always check the seller's feedback, the return policy and the exact condition before you buy.</p>` }));
write("privacy", page({ slug: "privacy", title: "Privacy", desc: "Privacy information.", body: `<h1>Privacy</h1><p>This site does not ask you to create an account, does not use analytics or advertising cookies, and does not collect personal information through forms. Our hosting provider (Cloudflare) may keep standard server logs, such as IP address and pages requested, for security and operations.</p><p>When you click a link to eBay, eBay and its affiliate partners may set cookies to attribute the visit to us. Their privacy policies apply on their sites. If we add analytics or other tools in the future, we will update this page first.</p>${cfg.contactEmail ? `<p>Questions: <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a></p>` : ""}` }));

// Cloudflare Pages: a 404.html makes unknown URLs return a real 404 instead of the home page with status 200.
fs.writeFileSync(path.join(outDir, "404.html"), page({ slug: "", title: "Page not found", desc: "This page does not exist.", body: `<h1>Page not found</h1><p>This page does not exist or has moved. <a href="/">Go to the home page</a> for all price checks and guides.</p>` }).replace(`<meta name="robots" content="${ROBOTS}">`, `<meta name="robots" content="noindex">`).replace(/<link rel="canonical"[^>]*>\n?/, ""));
fs.writeFileSync(path.join(outDir, "robots.txt"), cfg.publish ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n");
if (cfg.publish) {
  const urls = ["", ...guides.map(g => g.slug), ...modelPages.map(x => x.slug), ...(priceIndex ? ["used-gpu-price-index"] : []), "about", "affiliate-disclosure", "privacy"];
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(u => `  <url><loc>${SITE}/${u}</loc><lastmod>${snapDate}</lastmod></url>`).join("\n") + "\n</urlset>\n");
} else if (fs.existsSync(path.join(outDir, "sitemap.xml"))) fs.unlinkSync(path.join(outDir, "sitemap.xml"));

if (errors.length) { console.error("US build failed:\n - " + errors.join("\n - ")); process.exit(1); }
console.log(`US site built: ${guides.length} guides, ${modelPages.length} model pages, ${cfg.publish ? "PUBLISHED" : "draft (noindex, robots disallow all)"}`);
